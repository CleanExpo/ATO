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

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/logger'
import { getCachedTransactions } from '@/lib/xero/historical-fetcher'
import { getCachedMYOBTransactions } from '@/lib/integrations/myob-historical-fetcher'
import { getCachedQuickBooksTransactions } from '@/lib/integrations/quickbooks-historical-fetcher'
import { analyzeTransactionBatch, estimateAnalysisCost, getModelInfo, type TransactionContext, type BusinessContext, type ForensicAnalysis } from './forensic-analyzer'
import { invalidateTenantCache } from '@/lib/cache/cache-manager'
import { getAdapter } from '@/lib/integrations'
import type { CanonicalTransaction } from '@/lib/integrations/canonical-schema'
import { triggerAlertGeneration } from '@/lib/alerts/alert-generator'
import slack from '@/lib/slack/slack-notifier'

const log = createLogger('ai:batch-processor')

// Types
export interface AnalysisProgress {
    tenantId: string
    platform?: 'xero' | 'myob' | 'quickbooks'
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
    platform?: 'xero' | 'myob' | 'quickbooks' // Platform to analyze
    onProgress?: (progress: AnalysisProgress) => void
}

/**
 * Analyze all cached transactions for a tenant
 * Supports multiple platforms (Xero, MYOB, QuickBooks)
 */
export async function analyzeAllTransactions(
    tenantId: string,
    businessContext: Partial<BusinessContext>,
    options: AnalysisOptions = {}
): Promise<AnalysisProgress> {
    const batchSize = options.batchSize || 50 // Process 50 at a time
    const platform = options.platform || 'xero' // Default to Xero for backwards compatibility

    // Use service client to bypass RLS for server-side operations
    const supabase = await createServiceClient()

    // Initialize progress
    const progress: AnalysisProgress = {
        tenantId,
        platform,
        status: 'analyzing',
        progress: 0,
        transactionsAnalyzed: 0,
        totalTransactions: 0,
        currentBatch: 0,
        totalBatches: 0,
        estimatedCostUSD: 0,
    }

    const analysisStartTime = Date.now()

    try {
        log.info('Starting AI analysis', { platform, tenantId })

        // Get user email for Slack notifications
        const { data: { user } } = await supabase.auth.admin.getUserById(tenantId)
        const userEmail = user?.email || 'unknown@example.com'

        // Get total count of cached transactions for this platform
        const { count, error: countError } = await supabase
            .from('historical_transactions_cache')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('platform', platform)

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

        log.info('Analysis plan', { platform, totalTransactions, totalBatches, estimatedCostUSD: costEstimate.estimatedCostUSD })

        // Notify Slack: Analysis started
        try {
            await slack.notifyAnalysisStarted(tenantId, userEmail, platform, totalTransactions)
        } catch (error) {
            log.warn('Failed to send Slack notification (non-fatal)', { error: error instanceof Error ? error.message : String(error) })
        }

        // Store initial progress
        await updateAnalysisProgress(tenantId, progress, platform)
        if (options.onProgress) {
            options.onProgress(progress)
        }

        // Get business context (if not fully provided)
        if (!businessContext.name) {
            if (platform === 'xero') {
                const { data: connection } = await supabase
                    .from('xero_connections')
                    .select('organisation_name, tenant_name')
                    .eq('tenant_id', tenantId)
                    .single()

                businessContext.name = connection?.organisation_name || connection?.tenant_name || 'Unknown Business'
            } else if (platform === 'myob') {
                const { data: connection } = await supabase
                    .from('myob_connections')
                    .select('company_file_name')
                    .eq('company_file_id', tenantId)
                    .single()

                businessContext.name = connection?.company_file_name || 'Unknown Business'
            } else if (platform === 'quickbooks') {
                // Get company name from QuickBooks API or tokens table
                const { data: tokens } = await supabase
                    .from('quickbooks_tokens')
                    .select('realm_id')
                    .eq('tenant_id', tenantId)
                    .single()

                businessContext.name = tokens?.realm_id ? `QuickBooks Company (${tokens.realm_id})` : 'Unknown Business'
            }
        }

        // Fetch ALL cached transactions ONCE (outside the loop)
        let allCachedTransactions: any[]
        if (platform === 'xero') {
            allCachedTransactions = await getCachedTransactions(tenantId)
        } else if (platform === 'myob') {
            allCachedTransactions = await getCachedMYOBTransactions(tenantId)
        } else if (platform === 'quickbooks') {
            allCachedTransactions = await getCachedQuickBooksTransactions(tenantId)
        } else {
            throw new Error(`Unsupported platform: ${platform}`)
        }

        log.info('Fetched cached transactions', { platform, count: allCachedTransactions.length })

        // Process in batches
        let totalAnalyzed = 0
        let totalCostAccumulated = 0

        for (let batch = 0; batch < totalBatches; batch++) {
            progress.currentBatch = batch + 1

            log.info('Processing batch', { platform, batch: batch + 1, totalBatches })

            const startIndex = batch * batchSize
            const endIndex = Math.min(startIndex + batchSize, allCachedTransactions.length)
            const batchTransactions = allCachedTransactions.slice(startIndex, endIndex)

            if (batchTransactions.length === 0) {
                break // No more transactions
            }

            // Convert to analysis format using canonical schema
            // This ensures platform-agnostic AI analysis
            const transactionContexts: TransactionContext[] = batchTransactions.map(txn => {
                // For canonical transactions (already normalized by adapter)
                if (platform === 'xero' || platform === 'myob' || platform === 'quickbooks') {
                    // Extract transaction ID
                    const transactionId = txn.transactionID ||
                                          (txn as any).UID || // MYOB
                                          (txn as any).Id || // QuickBooks
                                          (txn as any).bankTransactionID ||
                                          (txn as any).invoiceID ||
                                          'unknown'

                    return {
                        transactionID: transactionId,
                        date: txn.date || txn.Date || txn.TxnDate || '',
                        description: buildDescriptionFromTransaction(txn, platform),
                        amount: txn.total || txn.TotalAmount || txn.TotalAmt || 0,
                        supplier: txn.contact?.name || txn.Contact?.Name || txn.VendorRef?.name || txn.CustomerRef?.name,
                        accountCode: txn.lineItems?.[0]?.accountCode || txn.Lines?.[0]?.Account?.DisplayID || txn.Line?.[0]?.AccountBasedExpenseLineDetail?.AccountRef?.value,
                        lineItems: (txn.lineItems || txn.Lines || txn.Line || []).map((li: any) => ({
                            description: li.description || li.Description,
                            quantity: li.quantity || li.ShipQuantity || li.BillQuantity,
                            unitAmount: li.unitAmount || li.UnitPrice || li.Amount,
                            accountCode: li.accountCode || li.Account?.DisplayID || li.AccountBasedExpenseLineDetail?.AccountRef?.value,
                        }))
                    }
                }

                // Fallback for legacy format
                return {
                    transactionID: (txn as any).bankTransactionID ||
                                   (txn as any).invoiceID ||
                                   (txn as any).transactionID ||
                                   'unknown',
                    date: txn.date || '',
                    description: buildDescription(txn),
                    amount: txn.total || 0,
                    supplier: txn.contact?.name,
                    accountCode: txn.lineItems?.[0]?.accountCode,
                    lineItems: txn.lineItems?.map((li: any) => ({
                        description: li.description,
                        quantity: li.quantity,
                        unitAmount: li.unitAmount,
                        accountCode: li.accountCode,
                    }))
                }
            })

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
                    log.debug('Batch progress', { batchProgress: Math.round(batchProgress) })
                }
            )

            // Store analyses in database
            await storeAnalysisResults(tenantId, analyses, batchTransactions, platform)

            // Track cost
            const batchCost = estimateAnalysisCost(analyses.length).estimatedCostUSD
            totalCostAccumulated += batchCost

            // Check cost limit
            const costLimitUSD = parseFloat(process.env.AI_COST_LIMIT_USD || '10')
            if (totalCostAccumulated > costLimitUSD) {
                log.warn('AI cost limit exceeded, stopping analysis', { totalCostUSD: totalCostAccumulated, costLimitUSD })
                progress.status = 'error'
                progress.errorMessage = `Cost limit exceeded ($${totalCostAccumulated.toFixed(2)} > $${costLimitUSD} limit). Set AI_COST_LIMIT_USD env var to increase.`
                await updateAnalysisProgress(tenantId, progress, platform)
                break
            }

            await trackAnalysisCost(tenantId, analyses.length, batchCost, platform)

            // Update progress
            totalAnalyzed += analyses.length
            progress.transactionsAnalyzed = totalAnalyzed
            progress.progress = (totalAnalyzed / totalTransactions) * 100

            await updateAnalysisProgress(tenantId, progress, platform)
            if (options.onProgress) {
                options.onProgress(progress)
            }

            log.info('Batch complete', { platform, totalAnalyzed, totalTransactions, progressPct: Number(progress.progress.toFixed(1)) })
        }

        // Mark complete
        progress.status = 'complete'
        progress.progress = 100
        await updateAnalysisProgress(tenantId, progress, platform)

        // Invalidate all cached data for this tenant (analysis results changed)
        const invalidatedCount = invalidateTenantCache(tenantId)
        log.info('Invalidated cache entries', { tenantId, invalidatedCount })

        log.info('Analysis complete', { platform, totalAnalyzed, costUSD: totalCostAccumulated })

        // Trigger tax alert generation
        const financialYear = businessContext.financialYear || new Date().getFullYear().toString()
        try {
            log.info('Triggering alert generation', { financialYear })
            const alertCount = await triggerAlertGeneration(tenantId, financialYear, platform)
            log.info('Generated tax alerts', { alertCount })
        } catch (alertError) {
            log.warn('Error generating alerts (non-fatal)', { error: alertError instanceof Error ? alertError.message : String(alertError) })
            // Don't fail the entire analysis if alert generation fails
        }

        // Calculate analysis statistics for Slack notification
        const analysisTimeMinutes = (Date.now() - analysisStartTime) / (1000 * 60)

        // Get R&D statistics
        const { data: rndStats } = await supabase
            .from('forensic_analysis_results')
            .select('is_rnd_candidate, adjusted_benefit')
            .eq('tenant_id', tenantId)
            .eq('platform', platform)
            .eq('financial_year', financialYear)
            .eq('is_rnd_candidate', true)

        const rndCandidates = rndStats?.length || 0
        const potentialRndBenefit = rndStats?.reduce((sum, r) => sum + (r.adjusted_benefit || 0), 0) || 0

        // Get deduction statistics
        const { data: deductionStats } = await supabase
            .from('forensic_analysis_results')
            .select('amount, flags')
            .eq('tenant_id', tenantId)
            .eq('platform', platform)
            .eq('financial_year', financialYear)

        const deductionOpportunities = deductionStats?.filter(r =>
            r.flags && Array.isArray(r.flags) && r.flags.some((flag: string) =>
                flag.toLowerCase().includes('deduction') || flag.toLowerCase().includes('claim')
            )
        ).length || 0

        const potentialDeductions = deductionStats?.filter(r =>
            r.flags && Array.isArray(r.flags) && r.flags.some((flag: string) =>
                flag.toLowerCase().includes('deduction') || flag.toLowerCase().includes('claim')
            )
        ).reduce((sum, r) => sum + Math.abs(r.amount), 0) || 0

        // Notify Slack: Analysis complete
        try {
            await slack.notifyAnalysisComplete(tenantId, userEmail, platform, {
                totalTransactions,
                rndCandidates,
                potentialRndBenefit,
                deductionOpportunities,
                potentialDeductions,
                analysisTimeMinutes,
                costUSD: totalCostAccumulated
            })
        } catch (error) {
            log.warn('Failed to send Slack notification (non-fatal)', { error: error instanceof Error ? error.message : String(error) })
        }

        return progress

    } catch (error) {
        log.error('Analysis failed', error instanceof Error ? error : undefined, { platform, tenantId })

        progress.status = 'error'
        progress.errorMessage = error instanceof Error ? error.message : 'Unknown error'

        await updateAnalysisProgress(tenantId, progress, platform)

        // Notify Slack about error
        try {
            const { data: { user } } = await supabase.auth.admin.getUserById(tenantId)
            const userEmail = user?.email || 'unknown@example.com'

            await slack.notifyError(
                'AI Analysis Failed',
                error instanceof Error ? error.message : 'Unknown error',
                {
                    userId: tenantId,
                    endpoint: `/api/audit/analyze (${platform})`,
                    stackTrace: error instanceof Error ? error.stack : undefined
                }
            )
        } catch (slackError) {
            log.warn('Failed to send Slack error notification (non-fatal)', { error: slackError instanceof Error ? slackError.message : String(slackError) })
        }

        throw error
    }
}

/**
 * Build descriptive text from transaction (legacy)
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
 * Build descriptive text from transaction (platform-aware)
 */
function buildDescriptionFromTransaction(transaction: any, platform: string): string {
    const parts: string[] = []

    if (platform === 'xero') {
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
    } else if (platform === 'myob') {
        // MYOB format
        if (transaction.Number) {
            parts.push(transaction.Number)
        }

        if (transaction.Contact?.Name) {
            parts.push(`from ${transaction.Contact.Name}`)
        }

        if (transaction.Lines && transaction.Lines.length > 0) {
            const descriptions = transaction.Lines
                .map((li: any) => li.Description)
                .filter(Boolean)
                .join('; ')

            if (descriptions) {
                parts.push(descriptions)
            }
        }
    } else if (platform === 'quickbooks') {
        // QuickBooks format
        if (transaction.DocNumber) {
            parts.push(`#${transaction.DocNumber}`)
        }

        // Check for vendor, customer, or entity reference
        const entityName = transaction.VendorRef?.name ||
                          transaction.CustomerRef?.name ||
                          transaction.EntityRef?.name

        if (entityName) {
            parts.push(`from ${entityName}`)
        }

        // Add private note if available
        if (transaction.PrivateNote) {
            parts.push(transaction.PrivateNote)
        }

        // Add line descriptions
        if (transaction.Line && transaction.Line.length > 0) {
            const descriptions = transaction.Line
                .map((li: any) => li.Description)
                .filter(Boolean)
                .join('; ')

            if (descriptions) {
                parts.push(descriptions)
            }
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
    originalTransactions: any[],
    platform: string = 'xero'
): Promise<void> {
    // Use service client to bypass RLS for server-side operations
    const supabase = await createServiceClient()

    // Map analyses to database schema
    const records = analyses.map((analysis, index) => {
        const txn = originalTransactions[index]

        // Extract date based on platform
        const txnDate = txn.date || txn.Date || null
        const financialYear = txnDate ? calculateFinancialYear(txnDate) : 'Unknown'

        // Extract amount based on platform
        const txnAmount = txn.total || txn.TotalAmount || 0

        // Extract supplier based on platform
        const supplierName = txn.contact?.name || txn.Contact?.Name || null

        return {
            tenant_id: tenantId,
            transaction_id: analysis.transactionId,
            financial_year: financialYear,
            platform: platform,

            // Transaction metadata (for aggregations and display)
            transaction_amount: txnAmount,
            transaction_date: txnDate,
            transaction_description: buildDescriptionFromTransaction(txn, platform),
            supplier_name: supplierName,

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

            // Four-element test (Division 355)
            div355_outcome_unknown: analysis.rndAssessment.fourElementTest.outcomeUnknown.met,
            div355_systematic_approach: analysis.rndAssessment.fourElementTest.systematicApproach.met,
            div355_new_knowledge: analysis.rndAssessment.fourElementTest.newKnowledge.met,
            div355_scientific_method: analysis.rndAssessment.fourElementTest.scientificMethod.met,

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
        }
    })

    // ✅ DEDUPLICATE: Remove duplicate transaction IDs before upserting
    // PostgreSQL's ON CONFLICT DO UPDATE cannot affect the same row twice in one statement
    // This prevents "ON CONFLICT DO UPDATE command cannot affect row a second time" error
    const uniqueRecords = Array.from(
        new Map(
            records.map(r => [`${r.tenant_id}:${r.transaction_id}`, r])
        ).values()
    )

    const duplicatesRemoved = records.length - uniqueRecords.length
    if (duplicatesRemoved > 0) {
        log.warn('Deduplicated batch records', { total: records.length, unique: uniqueRecords.length, duplicatesRemoved })
    } else {
        log.debug('No duplicates found in batch', { recordCount: records.length })
    }

    // Batch upsert with deduplicated records
    const { error } = await supabase
        .from('forensic_analysis_results')
        .upsert(uniqueRecords, {
            onConflict: 'tenant_id,transaction_id',
            ignoreDuplicates: false,
        })

    if (error) {
        log.error('Error storing analysis results', error instanceof Error ? error : undefined)
        throw error
    }

    log.info('Stored analysis results', { count: uniqueRecords.length })
}

/**
 * Update analysis progress in database
 */
async function updateAnalysisProgress(
    tenantId: string,
    progress: AnalysisProgress,
    platform: string = 'xero'
): Promise<void> {
    // Use service client to bypass RLS for server-side operations
    const supabase = await createServiceClient()

    // Store in audit_sync_status table (reuse existing table)
    // In a real system, you'd have a separate analysis_status table
    const { error } = await supabase
        .from('audit_sync_status')
        .upsert({
            tenant_id: tenantId,
            platform: platform,
            sync_status: progress.status === 'analyzing' ? 'syncing' : progress.status,
            transactions_synced: progress.transactionsAnalyzed,
            total_transactions: progress.totalTransactions,  // ✅ Fixed: was total_transactions_estimated
            error_message: progress.errorMessage,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'tenant_id,platform',  // Updated for multi-platform support
        })

    if (error) {
        log.error('Error updating analysis progress', error instanceof Error ? error : undefined, { platform })
    }
}

/**
 * Track API cost in database
 */
async function trackAnalysisCost(
    tenantId: string,
    transactionCount: number,
    costUSD: number,
    platform: string = 'xero'
): Promise<void> {
    // Use service client to bypass RLS for server-side operations
    const supabase = await createServiceClient()

    const costEstimate = estimateAnalysisCost(transactionCount)
    const modelInfo = getModelInfo()

    const { error } = await supabase
        .from('ai_analysis_costs')
        .insert({
            tenant_id: tenantId,
            platform: platform,
            analysis_date: new Date().toISOString().split('T')[0],
            transactions_analyzed: transactionCount,
            api_calls_made: transactionCount, // 1 call per transaction
            input_tokens: costEstimate.inputTokens,
            output_tokens: costEstimate.outputTokens,
            estimated_cost_usd: costUSD,
            ai_model: modelInfo.model,
        })

    if (error) {
        log.error('Error tracking cost', error instanceof Error ? error : undefined, { platform })
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
    // Use service client to bypass RLS for server-side operations
    const supabase = await createServiceClient()

    const { data, error } = await supabase
        .from('audit_sync_status')
        .select('*')
        .eq('tenant_id', tenantId)
        .single()

    if (error || !data) {
        return null
    }

    // Calculate progress percentage from transactions
    const transactionsAnalyzed = data.transactions_synced || 0
    const totalTransactions = data.total_transactions || 0
    const progress = totalTransactions > 0 ? (transactionsAnalyzed / totalTransactions) * 100 : 0

    return {
        tenantId,
        status: data.sync_status === 'syncing' ? 'analyzing' : data.sync_status as any,
        progress: progress,  // ✅ Fixed: calculate from transactions instead of reading non-existent column
        transactionsAnalyzed: transactionsAnalyzed,
        totalTransactions: totalTransactions,  // ✅ Fixed: was total_transactions_estimated
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
    // Use service client to bypass RLS for server-side operations
    const supabase = await createServiceClient()

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
        log.error('Error getting analysis results', error instanceof Error ? error : undefined)
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
    // Use service client to bypass RLS for server-side operations
    const supabase = await createServiceClient()

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
