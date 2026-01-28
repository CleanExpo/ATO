/**
 * Enhanced Batch Processor
 *
 * Optimized version of batch-processor.ts with:
 * - Smart caching (skip already-analyzed transactions)
 * - Resume functionality (continue from checkpoint)
 * - Auto-tuning batch sizes
 * - ETA calculation
 * - Budget monitoring
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getCachedTransactions } from '@/lib/xero/historical-fetcher'
import {
  analyzeTransactionBatch,
  estimateAnalysisCost,
  getModelInfo,
  type TransactionContext,
  type BusinessContext,
  type ForensicAnalysis,
} from './forensic-analyzer'
import { invalidateTenantCache } from '@/lib/cache/cache-manager'
import {
  filterUnanalyzedTransactions,
  getResumeCheckpoint,
  calculateETA,
  formatETA,
  checkBudget,
  PerformanceTracker,
  type BudgetConfig,
  type EnhancedProgress,
} from './analysis-optimizer'
import type { AnalysisProgress, AnalysisOptions } from './batch-processor'

/**
 * Enhanced analysis options with optimization features
 */
export interface EnhancedAnalysisOptions extends AnalysisOptions {
  /** Skip already-analyzed transactions (default: true) */
  useCaching?: boolean

  /** Resume from last checkpoint if analysis was interrupted (default: true) */
  allowResume?: boolean

  /** Auto-tune batch size based on performance (default: true) */
  autoTuneBatchSize?: boolean

  /** Budget configuration for cost monitoring */
  budget?: BudgetConfig

  /** Callback for enhanced progress updates */
  onEnhancedProgress?: (progress: EnhancedProgress) => void
}

/**
 * Analyze all cached transactions with optimizations
 *
 * This is an enhanced version of analyzeAllTransactions() from batch-processor.ts
 * with smart caching, resume functionality, and auto-tuning.
 */
export async function analyzeAllTransactionsOptimized(
  tenantId: string,
  businessContext: Partial<BusinessContext>,
  options: EnhancedAnalysisOptions = {}
): Promise<EnhancedProgress> {
  const {
    batchSize: initialBatchSize = 50,
    useCaching = true,
    allowResume = true,
    autoTuneBatchSize = true,
    budget,
    onProgress,
    onEnhancedProgress,
  } = options

  const supabase = await createServiceClient()
  const performanceTracker = new PerformanceTracker()
  const analysisStartTime = new Date()

  let currentBatchSize = initialBatchSize

  // Initialize enhanced progress
  const progress: EnhancedProgress = {
    tenantId,
    status: 'analyzing',
    progress: 0,
    transactionsAnalyzed: 0,
    totalTransactions: 0,
    currentBatch: 0,
    totalBatches: 0,
    estimatedCostUSD: 0,
    eta: null,
    remainingMinutes: null,
    cacheHitRate: 0,
    avgTimePerTransaction: 0,
    currentBatchSize,
    budgetRemaining: budget?.maxCostUSD || 0,
  }

  try {
    console.log(`🚀 Starting optimized AI analysis for tenant ${tenantId}`)

    // Check for resume checkpoint
    let resumeFromCount = 0
    if (allowResume) {
      const checkpoint = await getResumeCheckpoint(tenantId)
      if (checkpoint.canResume) {
        resumeFromCount = checkpoint.lastAnalyzedCount
        console.log(`♻️  Resuming from checkpoint: ${resumeFromCount} transactions already analyzed`)
        progress.transactionsAnalyzed = resumeFromCount
      }
    }

    // Get all cached transactions
    const allTransactions = await getCachedTransactions(tenantId)
    console.log(`📊 Found ${allTransactions.length} cached transactions`)

    // Filter out already-analyzed if caching enabled
    const { unanalyzed, alreadyAnalyzed, cacheHitRate } = await filterUnanalyzedTransactions(
      tenantId,
      allTransactions,
      !useCaching // forceReanalyze = !useCaching
    )

    progress.cacheHitRate = cacheHitRate
    progress.totalTransactions = allTransactions.length
    progress.transactionsAnalyzed = alreadyAnalyzed.length

    console.log(
      `📦 Cache analysis: ${unanalyzed.length} to analyze, ${alreadyAnalyzed.length} cached (${cacheHitRate.toFixed(1)}% hit rate)`
    )

    // If everything is cached, we're done!
    if (unanalyzed.length === 0) {
      console.log('✅ All transactions already analyzed (100% cache hit)')
      progress.status = 'complete'
      progress.progress = 100
      await updateAnalysisProgress(tenantId, progress)
      return progress
    }

    // Budget check
    const costEstimate = estimateAnalysisCost(unanalyzed.length)
    progress.estimatedCostUSD = costEstimate.estimatedCostUSD

    if (budget) {
      const budgetCheck = await checkBudget(tenantId, costEstimate.estimatedCostUSD, budget)

      if (!budgetCheck.withinBudget) {
        throw new Error(budgetCheck.message || 'Budget exceeded')
      }

      if (budgetCheck.warningTriggered) {
        console.warn(`⚠️  ${budgetCheck.message}`)
      }

      progress.budgetRemaining = budgetCheck.remainingBudget
    }

    // Calculate batches for unanalyzed transactions only
    const totalBatches = Math.ceil(unanalyzed.length / currentBatchSize)
    progress.totalBatches = totalBatches

    console.log(
      `💰 Estimated cost: $${costEstimate.estimatedCostUSD.toFixed(4)} for ${unanalyzed.length} new transactions`
    )

    // Get business context
    if (!businessContext.name) {
      const { data: connection } = await supabase
        .from('xero_connections')
        .select('organisation_name, tenant_name')
        .eq('tenant_id', tenantId)
        .single()

      businessContext.name =
        connection?.organisation_name || connection?.tenant_name || 'Unknown Business'
    }

    // Store initial progress
    await updateAnalysisProgress(tenantId, progress)
    if (onEnhancedProgress) {
      onEnhancedProgress(progress)
    }

    // Process unanalyzed transactions in batches
    let totalAnalyzedNew = 0
    let totalCostAccumulated = 0

    for (let batch = 0; batch < totalBatches; batch++) {
      const batchStartTime = Date.now()
      progress.currentBatch = batch + 1

      // Auto-tune batch size after first few batches
      if (autoTuneBatchSize && batch > 2) {
        const suggestedSize = performanceTracker.suggestBatchSize({
          rateLimit: 15, // Gemini free tier: 15/minute
          maxBatchSize: 100,
          minBatchSize: 10,
        })

        if (suggestedSize !== currentBatchSize) {
          console.log(`🎯 Auto-tuning batch size: ${currentBatchSize} → ${suggestedSize}`)
          currentBatchSize = suggestedSize
          progress.currentBatchSize = currentBatchSize
        }
      }

      console.log(`Processing batch ${batch + 1}/${totalBatches} (size: ${currentBatchSize})...`)

      // Get batch slice
      const startIndex = batch * currentBatchSize
      const endIndex = Math.min(startIndex + currentBatchSize, unanalyzed.length)
      const batchTransactions = unanalyzed.slice(startIndex, endIndex)

      if (batchTransactions.length === 0) {
        break
      }

      // Convert to analysis format
      const transactionContexts: TransactionContext[] = batchTransactions.map((txn) => ({
        transactionID:
          (txn as any).bankTransactionID ||
          (txn as any).invoiceID ||
          (txn as any).transactionID ||
          'unknown',
        date: txn.date || '',
        description: buildDescription(txn),
        amount: txn.total || 0,
        supplier: txn.contact?.name,
        accountCode: txn.lineItems?.[0]?.accountCode,
        lineItems: txn.lineItems?.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitAmount: li.unitAmount,
          accountCode: li.accountCode,
        })),
      }))

      // Analyze batch
      let analyses: ForensicAnalysis[]
      let hadError = false

      try {
        analyses = await analyzeTransactionBatch(
          transactionContexts,
          {
            name: businessContext.name!,
            abn: businessContext.abn,
            industry: businessContext.industry,
            financialYear: businessContext.financialYear || 'N/A',
          },
          (completed, total) => {
            const batchProgress = (completed / total) * 100
            console.log(`  Batch progress: ${batchProgress.toFixed(0)}%`)
          }
        )
      } catch (error) {
        hadError = true
        console.error(`Batch ${batch + 1} failed:`, error)
        performanceTracker.recordBatch(batchTransactions.length, Date.now() - batchStartTime, true)
        throw error // Re-throw to stop analysis
      }

      // Store analyses in database
      await storeAnalysisResults(tenantId, analyses, batchTransactions)

      // Track cost
      const batchCost = estimateAnalysisCost(analyses.length).estimatedCostUSD
      totalCostAccumulated += batchCost
      await trackAnalysisCost(tenantId, analyses.length, batchCost)

      // Record performance
      const batchDuration = Date.now() - batchStartTime
      performanceTracker.recordBatch(batchTransactions.length, batchDuration, hadError)

      // Update progress
      totalAnalyzedNew += analyses.length
      progress.transactionsAnalyzed = alreadyAnalyzed.length + totalAnalyzedNew
      progress.progress = (progress.transactionsAnalyzed / progress.totalTransactions) * 100

      // Calculate ETA
      const performanceMetrics = performanceTracker.getMetrics()
      progress.avgTimePerTransaction = performanceMetrics.avgTransactionTimeMs

      const etaCalc = calculateETA(
        totalAnalyzedNew,
        unanalyzed.length,
        analysisStartTime
      )
      progress.eta = etaCalc.eta
      progress.remainingMinutes = etaCalc.remainingMinutes

      // Update budget remaining
      if (budget) {
        progress.budgetRemaining = budget.maxCostUSD - totalCostAccumulated
      }

      // Store and notify progress
      await updateAnalysisProgress(tenantId, progress)

      if (onEnhancedProgress) {
        onEnhancedProgress(progress)
      }

      if (onProgress) {
        onProgress(progress)
      }

      const etaFormatted = formatETA(etaCalc.eta, etaCalc.remainingMinutes)
      console.log(
        `✓ Batch complete: ${progress.transactionsAnalyzed}/${progress.totalTransactions} (${progress.progress.toFixed(1)}%) - ETA: ${etaFormatted}`
      )
    }

    // Mark complete
    progress.status = 'complete'
    progress.progress = 100
    progress.eta = null
    progress.remainingMinutes = null
    await updateAnalysisProgress(tenantId, progress)

    // Invalidate tenant cache
    const invalidatedCount = invalidateTenantCache(tenantId)
    console.log(`🗑️  Invalidated ${invalidatedCount} cache entries for tenant ${tenantId}`)

    console.log(
      `✅ Analysis complete: ${totalAnalyzedNew} new, ${alreadyAnalyzed.length} cached, $${totalCostAccumulated.toFixed(4)} cost`
    )

    return progress
  } catch (error) {
    console.error('❌ Analysis failed:', error)

    progress.status = 'error'
    progress.errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await updateAnalysisProgress(tenantId, progress)

    throw error
  }
}

// Import helper functions from batch-processor
function buildDescription(transaction: any): string {
  const parts: string[] = []

  if (transaction.reference) {
    parts.push(transaction.reference)
  }

  if (transaction.contact?.name) {
    parts.push(`from ${transaction.contact.name}`)
  }

  if (transaction.lineItems && transaction.lineItems.length > 0) {
    const descriptions = transaction.lineItems
      .map((li: any) => li.description)
      .filter(Boolean)
      .join('; ')

    if (descriptions) {
      parts.push(descriptions)
    }
  }

  return parts.join(' - ') || 'No description'
}

async function storeAnalysisResults(
  tenantId: string,
  analyses: ForensicAnalysis[],
  originalTransactions: any[]
): Promise<void> {
  const supabase = await createServiceClient()

  const records = analyses.map((analysis, index) => {
    const txn = originalTransactions[index]
    const financialYear = calculateFinancialYear(txn.date)

    return {
      tenant_id: tenantId,
      transaction_id: analysis.transactionId,
      financial_year: financialYear,
      transaction_amount: txn.total || 0,
      transaction_date: txn.date || null,
      transaction_description: buildDescription(txn),
      supplier_name: txn.contact?.name || null,
      primary_category: analysis.categories.primary,
      secondary_categories: analysis.categories.secondary,
      category_confidence: analysis.categories.confidence,
      is_rnd_candidate: analysis.rndAssessment.isRndCandidate,
      meets_div355_criteria: analysis.rndAssessment.meetsDiv355Criteria,
      rnd_activity_type: analysis.rndAssessment.activityType,
      rnd_confidence: analysis.rndAssessment.confidence,
      rnd_reasoning: analysis.rndAssessment.reasoning,
      div355_outcome_unknown: analysis.rndAssessment.fourElementTest.outcomeUnknown.met,
      div355_systematic_approach: analysis.rndAssessment.fourElementTest.systematicApproach.met,
      div355_new_knowledge: analysis.rndAssessment.fourElementTest.newKnowledge.met,
      div355_scientific_method: analysis.rndAssessment.fourElementTest.scientificMethod.met,
      is_fully_deductible: analysis.deductionEligibility.isFullyDeductible,
      deduction_type: analysis.deductionEligibility.deductionType,
      claimable_amount: analysis.deductionEligibility.claimableAmount,
      deduction_restrictions: analysis.deductionEligibility.restrictions,
      deduction_confidence: analysis.deductionEligibility.confidence,
      requires_documentation: analysis.complianceFlags.requiresDocumentation,
      fbt_implications: analysis.complianceFlags.fbtImplications,
      division7a_risk: analysis.complianceFlags.division7aRisk,
      compliance_notes: analysis.complianceFlags.notes,
      ai_model: getModelInfo().model,
    }
  })

  // Deduplicate
  const uniqueRecords = Array.from(
    new Map(records.map((r) => [`${r.tenant_id}:${r.transaction_id}`, r])).values()
  )

  const { error } = await supabase.from('forensic_analysis_results').upsert(uniqueRecords, {
    onConflict: 'tenant_id,transaction_id',
    ignoreDuplicates: false,
  })

  if (error) {
    console.error('Error storing analysis results:', error)
    throw error
  }

  console.log(`💾 Stored ${uniqueRecords.length} analysis results`)
}

async function updateAnalysisProgress(tenantId: string, progress: EnhancedProgress): Promise<void> {
  const supabase = await createServiceClient()

  const { error } = await supabase.from('audit_sync_status').upsert(
    {
      tenant_id: tenantId,
      sync_status: progress.status === 'analyzing' ? 'syncing' : progress.status,
      transactions_synced: progress.transactionsAnalyzed,
      total_transactions: progress.totalTransactions,
      error_message: progress.errorMessage,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'tenant_id',
    }
  )

  if (error) {
    console.error('Error updating analysis progress:', error)
  }
}

async function trackAnalysisCost(
  tenantId: string,
  transactionCount: number,
  costUSD: number
): Promise<void> {
  const supabase = await createServiceClient()
  const costEstimate = estimateAnalysisCost(transactionCount)
  const modelInfo = getModelInfo()

  const { error } = await supabase.from('ai_analysis_costs').insert({
    tenant_id: tenantId,
    analysis_date: new Date().toISOString().split('T')[0],
    transactions_analyzed: transactionCount,
    api_calls_made: transactionCount,
    input_tokens: costEstimate.inputTokens,
    output_tokens: costEstimate.outputTokens,
    estimated_cost_usd: costUSD,
    ai_model: modelInfo.model,
  })

  if (error) {
    console.error('Error tracking cost:', error)
  }
}

function calculateFinancialYear(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = d.getMonth() + 1

  if (month >= 7) {
    return `FY${year}-${String(year + 1).slice(2)}`
  } else {
    return `FY${year - 1}-${String(year).slice(2)}`
  }
}
