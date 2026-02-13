/**
 * POST /api/audit/analyze-chunk
 *
 * Chunked AI analysis endpoint - processes a batch of transactions at a time to work within Vercel's timeout limits.
 * Client should call repeatedly until allComplete is true.
 *
 * Body:
 * - tenantId: string (required) - Xero tenant ID
 * - batch: number (optional) - Batch number to process (defaults to 0)
 * - batchSize: number (optional) - Transactions per batch (defaults to 25, max 50)
 *
 * Response:
 * - success: boolean
 * - analyzed: number - Transactions analyzed this batch
 * - totalAnalyzed: number - Total transactions analyzed so far
 * - totalTransactions: number - Total transactions to analyze
 * - hasMore: boolean - Whether there are more batches
 * - nextBatch: number - Next batch number (if hasMore)
 * - allComplete: boolean - Whether ALL batches have been processed
 * - progress: number - Overall progress percentage
 * - timing: { analyzeMs, totalMs }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { getCachedTransactions } from '@/lib/xero/historical-fetcher'
import { analyzeTransactionBatch, estimateAnalysisCost, type TransactionContext, type BusinessContext, type ForensicAnalysis } from '@/lib/ai/forensic-analyzer'
import { invalidateTenantCache } from '@/lib/cache/cache-manager'
import { isSingleUserMode } from '@/lib/auth/single-user-check'
import { createLogger } from '@/lib/logger'
import { applyDistributedRateLimit, DISTRIBUTED_RATE_LIMITS } from '@/lib/middleware/apply-rate-limit'
import type { SupabaseServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const log = createLogger('api:audit:analyze-chunk')

/** Shape of a raw cached transaction (union of Xero invoice/bank transaction fields) */
interface CachedTransaction {
    bankTransactionID?: string
    invoiceID?: string
    transactionID?: string
    date?: string
    reference?: string
    total?: number
    contact?: { name?: string }
    lineItems?: Array<{
        description?: string
        quantity?: number
        unitAmount?: number
        accountCode?: string
    }>
}

export const maxDuration = 300 // 5 minutes for Vercel Pro

const DEFAULT_BATCH_SIZE = 25 // 5 concurrent Gemini calls: 25 txns ≈ 5 rounds × 25s = 125s
const MAX_BATCH_SIZE = 50

export async function POST(request: NextRequest) {
    const startTime = Date.now()

    try {
        // Rate limit analysis requests (SEC-003: expensive AI operations)
        const rateLimitResult = await applyDistributedRateLimit(
          request,
          DISTRIBUTED_RATE_LIMITS.analysis,
          'audit:analyze-chunk'
        )
        if (rateLimitResult) return rateLimitResult

        const requestForAuth = request.clone() as NextRequest
        const body = await request.json()
        let tenantId: string

        if (isSingleUserMode()) {
            tenantId = body.tenantId
            if (!tenantId) {
                return createValidationError('tenantId is required')
            }
        } else {
            const auth = await requireAuth(requestForAuth, { tenantIdSource: 'body' })
            if (isErrorResponse(auth)) return auth
            tenantId = auth.tenantId
        }

        // Parse optional fields
        const batch = body.batch || 0
        const batchSize = Math.min(body.batchSize || DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE)

        log.info('Processing batch', { batch, batchSize, tenantId })

        const supabase = createAdminClient()

        // Get all cached transactions
        const allTransactions = await getCachedTransactions(tenantId)
        const totalTransactions = allTransactions.length

        if (totalTransactions === 0) {
            return createValidationError('No cached transactions found. Run historical sync first.')
        }

        // Calculate batch range
        const startIndex = batch * batchSize
        const endIndex = Math.min(startIndex + batchSize, totalTransactions)
        const batchTransactions = allTransactions.slice(startIndex, endIndex)

        if (batchTransactions.length === 0) {
            // All done! Ensure status is marked complete
            await supabase
                .from('audit_sync_status')
                .upsert({
                    tenant_id: tenantId,
                    sync_status: 'complete',
                    transactions_synced: totalTransactions,
                    total_transactions: totalTransactions,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'tenant_id'
                })

            return NextResponse.json({
                success: true,
                analyzed: 0,
                totalAnalyzed: totalTransactions,
                totalTransactions,
                hasMore: false,
                nextBatch: null,
                allComplete: true,
                progress: 100,
                message: 'All transactions have been analyzed'
            })
        }

        // Get business context
        const { data: connection } = await supabase
            .from('xero_connections')
            .select('organisation_name, tenant_name')
            .eq('tenant_id', tenantId)
            .single()

        const businessContext: BusinessContext = {
            name: connection?.organisation_name || connection?.tenant_name || 'Unknown Business',
            financialYear: 'Multi-year'
        }

        // Convert to analysis format
        const transactionContexts: TransactionContext[] = (batchTransactions as CachedTransaction[]).map((txn) => {
            const transactionId = txn.bankTransactionID ||
                                  txn.invoiceID ||
                                  txn.transactionID ||
                                  'unknown'

            return {
                transactionID: transactionId,
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
                }))
            }
        })

        // Analyze batch with AI
        const analyzeStartTime = Date.now()
        const analyses = await analyzeTransactionBatch(
            transactionContexts,
            businessContext,
            (completed, total) => {
                log.debug('Batch progress', { batch, completed, total })
            }
        )
        const analyzeTime = Date.now() - analyzeStartTime

        log.info('Analyzed transactions', { count: analyses.length, analyzeTimeMs: analyzeTime })

        // Store analysis results
        await storeAnalysisResults(tenantId, analyses, batchTransactions as CachedTransaction[], supabase)

        // Track cost
        const costEstimate = estimateAnalysisCost(analyses.length)
        await trackAnalysisCost(tenantId, analyses.length, costEstimate.estimatedCostUSD, supabase)

        // Calculate progress
        const totalAnalyzed = endIndex
        const progress = (totalAnalyzed / totalTransactions) * 100
        const hasMore = endIndex < totalTransactions
        const allComplete = !hasMore

        // Update sync status
        await supabase
            .from('audit_sync_status')
            .upsert({
                tenant_id: tenantId,
                sync_status: allComplete ? 'complete' : 'syncing',
                transactions_synced: totalAnalyzed,
                total_transactions: totalTransactions,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'tenant_id'
            })

        // If complete, invalidate caches
        if (allComplete) {
            const invalidatedCount = invalidateTenantCache(tenantId)
            log.info('Analysis complete, cache invalidated', { invalidatedCount })
        }

        const totalTime = Date.now() - startTime
        log.info('Batch complete', { batch, totalTimeMs: totalTime, analyzed: analyses.length })

        return NextResponse.json({
            success: true,
            analyzed: analyses.length,
            totalAnalyzed,
            totalTransactions,
            hasMore,
            nextBatch: hasMore ? batch + 1 : null,
            allComplete,
            progress: Math.round(progress * 10) / 10,
            currentBatch: {
                batch,
                startIndex,
                endIndex,
                transactionsInBatch: batchTransactions.length
            },
            cost: {
                batchCostUSD: costEstimate.estimatedCostUSD,
                inputTokens: costEstimate.inputTokens,
                outputTokens: costEstimate.outputTokens
            },
            timing: {
                analyzeMs: analyzeTime,
                totalMs: totalTime
            }
        })

    } catch (error) {
        console.error('[analyze-chunk] Error:', error)

        // Return detailed error for debugging
        let errorMessage: string
        let errorStack: string | undefined

        if (error instanceof Error) {
            errorMessage = error.message
            errorStack = error.stack?.split('\n').slice(0, 5).join('\n')
        } else if (typeof error === 'object' && error !== null) {
            // Handle non-Error objects (like Supabase errors)
            errorMessage = JSON.stringify(error, null, 2)
        } else {
            errorMessage = String(error)
        }

        return NextResponse.json({
            success: false,
            error: errorMessage,
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            stack: errorStack,
            hint: errorMessage.includes('API key')
                ? 'Check GOOGLE_AI_API_KEY in Vercel environment variables'
                : errorMessage.includes('model')
                ? 'The AI model may not be available. Try a different model.'
                : 'Check Vercel function logs for details'
        }, { status: 500 })
    }
}

/**
 * Build descriptive text from transaction
 */
function buildDescription(transaction: CachedTransaction): string {
    const parts: string[] = []

    if (transaction.reference) {
        parts.push(transaction.reference)
    }

    if (transaction.contact?.name) {
        parts.push(`from ${transaction.contact.name}`)
    }

    if (transaction.lineItems && transaction.lineItems.length > 0) {
        const descriptions = transaction.lineItems
            .map((li) => li.description)
            .filter(Boolean)
            .join('; ')

        if (descriptions) {
            parts.push(descriptions)
        }
    }

    return parts.join(' - ') || 'No description'
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
 * Store analysis results in database
 */
async function storeAnalysisResults(
    tenantId: string,
    analyses: ForensicAnalysis[],
    originalTransactions: CachedTransaction[],
    supabase: SupabaseServiceClient
): Promise<void> {
    // Map analyses to database schema
    const records = analyses.map((analysis, index) => {
        const txn = originalTransactions[index]
        const financialYear = calculateFinancialYear(txn.date || new Date().toISOString())

        return {
            tenant_id: tenantId,
            transaction_id: analysis.transactionId,
            financial_year: financialYear,
            analysis_type: 'forensic', // Required NOT NULL column

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
        }
    })

    // Deduplicate
    const uniqueRecords = Array.from(
        new Map(
            records.map(r => [`${r.tenant_id}:${r.transaction_id}`, r])
        ).values()
    )

    // Batch upsert
    const { error } = await supabase
        .from('forensic_analysis_results')
        .upsert(uniqueRecords, {
            onConflict: 'tenant_id,transaction_id',
            ignoreDuplicates: false,
        })

    if (error) {
        console.error('[analyze-chunk] Error storing results:', error)
        throw error
    }

    log.info('Stored analysis results', { count: uniqueRecords.length })
}

/**
 * Track API cost
 */
async function trackAnalysisCost(
    tenantId: string,
    transactionCount: number,
    costUSD: number,
    supabase: SupabaseServiceClient
): Promise<void> {
    const costEstimate = estimateAnalysisCost(transactionCount)

    const { error } = await supabase
        .from('ai_analysis_costs')
        .insert({
            tenant_id: tenantId,
            analysis_date: new Date().toISOString().split('T')[0],
            transactions_analyzed: transactionCount,
            api_calls_made: transactionCount,
            input_tokens: costEstimate.inputTokens,
            output_tokens: costEstimate.outputTokens,
            estimated_cost_usd: costUSD,
        })

    if (error) {
        console.error('[analyze-chunk] Error tracking cost:', error)
    }
}

// GET endpoint to check analysis status
export async function GET(request: NextRequest) {
    let tenantId: string

    if (isSingleUserMode()) {
        tenantId = request.nextUrl.searchParams.get('tenantId') || ''
        if (!tenantId) {
            return createValidationError('tenantId is required')
        }
    } else {
        const auth = await requireAuth(request)
        if (isErrorResponse(auth)) return auth
        tenantId = auth.tenantId
    }

    const supabase = createAdminClient()

    // Get sync status
    const { data: status } = await supabase
        .from('audit_sync_status')
        .select('*')
        .eq('tenant_id', tenantId)
        .single()

    // Count analyzed transactions
    const { count: analyzedCount } = await supabase
        .from('forensic_analysis_results')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)

    // Count total cached transactions
    const { count: totalCount } = await supabase
        .from('historical_transactions_cache')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)

    const progress = totalCount && totalCount > 0
        ? ((analyzedCount || 0) / totalCount) * 100
        : 0

    return NextResponse.json({
        status: status?.sync_status || 'idle',
        progress: Math.round(progress * 10) / 10,
        transactionsAnalyzed: analyzedCount || 0,
        totalTransactions: totalCount || 0,
        lastUpdate: status?.updated_at
    })
}
