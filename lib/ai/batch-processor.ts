/**
 * Batch Processor
 *
 * Manages AI analysis of large transaction batches with:
 * - Queue management
 * - Progress tracking
 * - Error recovery
 * - Cost tracking
 * - Database storage
 */

import { createClient } from '@/lib/supabase/server'
import { getCachedTransactions } from '@/lib/xero/historical-fetcher'
import { analyzeTransactionBatch, estimateAnalysisCost, getModelInfo, type TransactionContext, type BusinessContext, type ForensicAnalysis } from './forensic-analyzer'
import { invalidateTenantCache } from '@/lib/cache/cache-manager'

// Types
export interface AnalysisProgress {
    tenantId: string
    status: 'idle' | 'analyzing' | 'complete' | 'error'
    progress: number // 0-100
    transactionsAnalyzed: number
    totalTransactions: number
    currentBatch: number
    totalBatches: number
    estimatedCostUSD: number
    errorMessage?: string
}

export interface AnalysisOptions {
    batchSize?: number // Transactions per batch (default: 50)
    onProgress?: (progress: AnalysisProgress) => void
}

/**
 * Analyze all cached transactions for a tenant
 */
export async function analyzeAllTransactions(
    tenantId: string,
    businessContext: Partial<BusinessContext>,
    options: AnalysisOptions = {}
): Promise<AnalysisProgress> {
    const batchSize = options.batchSize || 50 // Process 50 at a time
    const supabase = await createClient()

    // Initialize progress
    const progress: AnalysisProgress = {
        tenantId,
        status: 'analyzing',
        progress: 0,
        transactionsAnalyzed: 0,
        totalTransactions: 0,
        currentBatch: 0,
        totalBatches: 0,
        estimatedCostUSD: 0,
    }

    try {
        console.log(`Starting AI analysis for tenant ${tenantId}`)

        // Get total count of cached transactions
        const { count, error: countError } = await supabase
            .from('historical_transactions_cache')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)

        if (countError) {
            throw countError
        }

        const totalTransactions = count || 0
        const totalBatches = Math.ceil(totalTransactions / batchSize)

        progress.totalTransactions = totalTransactions
        progress.totalBatches = totalBatches

        // Calculate estimated cost
        const costEstimate = estimateAnalysisCost(totalTransactions)
        progress.estimatedCostUSD = costEstimate.estimatedCostUSD

        console.log(`Total transactions: ${totalTransactions}, Batches: ${totalBatches}, Est. cost: $${costEstimate.estimatedCostUSD.toFixed(2)}`)

        // Store initial progress
        await updateAnalysisProgress(tenantId, progress)
        if (options.onProgress) {
            options.onProgress(progress)
        }

        // Get business context (if not fully provided)
        if (!businessContext.name) {
            const { data: connection } = await supabase
                .from('xero_connections')
                .select('organisation_name, tenant_name')
                .eq('tenant_id', tenantId)
                .single()

            businessContext.name = connection?.organisation_name || connection?.tenant_name || 'Unknown Business'
        }

        // Process in batches
        let totalAnalyzed = 0
        let totalCostAccumulated = 0

        for (let batch = 0; batch < totalBatches; batch++) {
            progress.currentBatch = batch + 1

            console.log(`Processing batch ${batch + 1}/${totalBatches}...`)

            // Fetch batch of cached transactions
            const cachedTransactions = await getCachedTransactions(tenantId)
            const startIndex = batch * batchSize
            const endIndex = Math.min(startIndex + batchSize, cachedTransactions.length)
            const batchTransactions = cachedTransactions.slice(startIndex, endIndex)

            if (batchTransactions.length === 0) {
                break // No more transactions
            }

            // Convert to analysis format
            const transactionContexts: TransactionContext[] = batchTransactions.map(txn => ({
                transactionID: txn.transactionID || 'unknown',
                date: txn.date || '',
                description: buildDescription(txn),
                amount: txn.total || 0,
                supplier: txn.contact?.name,
                accountCode: txn.lineItems?.[0]?.accountCode,
                lineItems: txn.lineItems?.map(li => ({
                    description: li.description,
                    quantity: li.quantity,
                    unitAmount: li.unitAmount,
                    accountCode: li.accountCode,
                }))
            }))

            // Analyze batch
            const analyses = await analyzeTransactionBatch(
                transactionContexts,
                {
                    name: businessContext.name!,
                    abn: businessContext.abn,
                    industry: businessContext.industry,
                    financialYear: businessContext.financialYear || 'N/A'
                },
                (completed, total) => {
                    // Intra-batch progress
                    const batchProgress = (completed / total) * 100
                    console.log(`  Batch progress: ${batchProgress.toFixed(0)}%`)
                }
            )

            // Store analyses in database
            await storeAnalysisResults(tenantId, analyses, batchTransactions)

            // Track cost
            const batchCost = estimateAnalysisCost(analyses.length).estimatedCostUSD
            totalCostAccumulated += batchCost

            await trackAnalysisCost(tenantId, analyses.length, batchCost)

            // Update progress
            totalAnalyzed += analyses.length
            progress.transactionsAnalyzed = totalAnalyzed
            progress.progress = (totalAnalyzed / totalTransactions) * 100

            await updateAnalysisProgress(tenantId, progress)
            if (options.onProgress) {
                options.onProgress(progress)
            }

            console.log(`Batch complete: ${totalAnalyzed}/${totalTransactions} (${progress.progress.toFixed(1)}%)`)
        }

        // Mark complete
        progress.status = 'complete'
        progress.progress = 100
        await updateAnalysisProgress(tenantId, progress)

        // Invalidate all cached data for this tenant (analysis results changed)
        const invalidatedCount = invalidateTenantCache(tenantId)
        console.log(`Invalidated ${invalidatedCount} cache entries for tenant ${tenantId}`)

        console.log(`Analysis complete: ${totalAnalyzed} transactions, $${totalCostAccumulated.toFixed(4)} cost`)

        return progress

    } catch (error) {
        console.error('Analysis failed:', error)

        progress.status = 'error'
        progress.errorMessage = error instanceof Error ? error.message : 'Unknown error'

        await updateAnalysisProgress(tenantId, progress)

        throw error
    }
}

/**
 * Build descriptive text from transaction
 */
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

/**
 * Store analysis results in database
 */
async function storeAnalysisResults(
    tenantId: string,
    analyses: ForensicAnalysis[],
    originalTransactions: any[]
): Promise<void> {
    const supabase = await createClient()

    // Map analyses to database schema
    const records = analyses.map((analysis, index) => {
        const txn = originalTransactions[index]
        const financialYear = calculateFinancialYear(txn.date)

        return {
            tenant_id: tenantId,
            transaction_id: analysis.transactionId,
            financial_year: financialYear,

            // Categories
            primary_category: analysis.categories.primary,
            secondary_categories: analysis.categories.secondary,
            category_confidence: analysis.categories.confidence,

            // R&D Assessment
            is_rnd_candidate: analysis.rndAssessment.isRndCandidate,
            meets_div355_criteria: analysis.rndAssessment.meetsDiv355Criteria,
            rnd_activity_type: analysis.rndAssessment.activityType,
            rnd_confidence: analysis.rndAssessment.confidence,
            rnd_reasoning: analysis.rndAssessment.reasoning,

            // Four-element test
            outcome_unknown: analysis.rndAssessment.fourElementTest.outcomeUnknown.met,
            systematic_approach: analysis.rndAssessment.fourElementTest.systematicApproach.met,
            new_knowledge: analysis.rndAssessment.fourElementTest.newKnowledge.met,
            scientific_method: analysis.rndAssessment.fourElementTest.scientificMethod.met,

            // Deductions
            is_fully_deductible: analysis.deductionEligibility.isFullyDeductible,
            deduction_type: analysis.deductionEligibility.deductionType,
            claimable_amount: analysis.deductionEligibility.claimableAmount,
            deduction_restrictions: analysis.deductionEligibility.restrictions,
            deduction_confidence: analysis.deductionEligibility.confidence,

            // Compliance
            requires_documentation: analysis.complianceFlags.requiresDocumentation,
            fbt_implications: analysis.complianceFlags.fbtImplications,
            division7a_risk: analysis.complianceFlags.division7aRisk,
            compliance_notes: analysis.complianceFlags.notes,

            // Metadata
            ai_model: getModelInfo().model,
            analysis_version: '1.0',
        }
    })

    // Batch upsert
    const { error } = await supabase
        .from('forensic_analysis_results')
        .upsert(records, {
            onConflict: 'tenant_id,transaction_id',
            ignoreDuplicates: false,
        })

    if (error) {
        console.error('Error storing analysis results:', error)
        throw error
    }

    console.log(`Stored ${records.length} analysis results`)
}

/**
 * Update analysis progress in database
 */
async function updateAnalysisProgress(
    tenantId: string,
    progress: AnalysisProgress
): Promise<void> {
    const supabase = await createClient()

    // Store in audit_sync_status table (reuse existing table)
    // In a real system, you'd have a separate analysis_status table
    const { error } = await supabase
        .from('audit_sync_status')
        .upsert({
            tenant_id: tenantId,
            sync_status: progress.status === 'analyzing' ? 'syncing' : progress.status,
            sync_progress: progress.progress,
            transactions_synced: progress.transactionsAnalyzed,
            total_transactions_estimated: progress.totalTransactions,
            error_message: progress.errorMessage,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'tenant_id',
        })

    if (error) {
        console.error('Error updating analysis progress:', error)
    }
}

/**
 * Track API cost in database
 */
async function trackAnalysisCost(
    tenantId: string,
    transactionCount: number,
    costUSD: number
): Promise<void> {
    const supabase = await createClient()

    const costEstimate = estimateAnalysisCost(transactionCount)
    const modelInfo = getModelInfo()

    const { error } = await supabase
        .from('ai_analysis_costs')
        .insert({
            tenant_id: tenantId,
            analysis_date: new Date().toISOString().split('T')[0],
            transactions_analyzed: transactionCount,
            api_calls_made: transactionCount, // 1 call per transaction
            input_tokens: costEstimate.inputTokens,
            output_tokens: costEstimate.outputTokens,
            estimated_cost_usd: costUSD,
            ai_model: modelInfo.model,
        })

    if (error) {
        console.error('Error tracking cost:', error)
    }
}

/**
 * Calculate financial year from date
 */
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

/**
 * Get analysis status
 */
export async function getAnalysisStatus(tenantId: string): Promise<AnalysisProgress | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('audit_sync_status')
        .select('*')
        .eq('tenant_id', tenantId)
        .single()

    if (error || !data) {
        return null
    }

    return {
        tenantId,
        status: data.sync_status === 'syncing' ? 'analyzing' : data.sync_status as any,
        progress: parseFloat(data.sync_progress || '0'),
        transactionsAnalyzed: data.transactions_synced || 0,
        totalTransactions: data.total_transactions_estimated || 0,
        currentBatch: 0, // Not tracked in this table
        totalBatches: 0,
        estimatedCostUSD: 0, // Would need to calculate from separate table
        errorMessage: data.error_message,
    }
}

/**
 * Get analysis results
 */
export async function getAnalysisResults(
    tenantId: string,
    filters?: {
        financialYear?: string
        isRndCandidate?: boolean
        primaryCategory?: string
        minConfidence?: number
    }
): Promise<any[]> {
    const supabase = await createClient()

    let query = supabase
        .from('forensic_analysis_results')
        .select('*')
        .eq('tenant_id', tenantId)

    if (filters?.financialYear) {
        query = query.eq('financial_year', filters.financialYear)
    }

    if (filters?.isRndCandidate !== undefined) {
        query = query.eq('is_rnd_candidate', filters.isRndCandidate)
    }

    if (filters?.primaryCategory) {
        query = query.eq('primary_category', filters.primaryCategory)
    }

    if (filters?.minConfidence !== undefined) {
        query = query.gte('category_confidence', filters.minConfidence)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error getting analysis results:', error)
        throw error
    }

    return data || []
}

/**
 * Get cost summary
 */
export async function getCostSummary(tenantId: string): Promise<{
    totalCost: number
    totalTransactions: number
    totalApiCalls: number
    costPerTransaction: number
}> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('ai_analysis_costs')
        .select('*')
        .eq('tenant_id', tenantId)

    if (error) {
        throw error
    }

    const totalCost = data.reduce((sum, record) => sum + parseFloat(record.estimated_cost_usd || '0'), 0)
    const totalTransactions = data.reduce((sum, record) => sum + (record.transactions_analyzed || 0), 0)
    const totalApiCalls = data.reduce((sum, record) => sum + (record.api_calls_made || 0), 0)

    return {
        totalCost,
        totalTransactions,
        totalApiCalls,
        costPerTransaction: totalTransactions > 0 ? totalCost / totalTransactions : 0,
    }
}
