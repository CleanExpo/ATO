/**
 * POST /api/audit/analyze
 *
 * Start AI forensic analysis of cached transactions.
 * Uses Google AI (Gemini) to perform deep analysis for tax optimization.
 *
 * Body:
 * - tenantId: string (required)
 * - platform?: 'xero' | 'myob' | 'quickbooks' (optional, default: 'xero')
 * - businessName?: string (optional - will fetch from DB if not provided)
 * - industry?: string (optional)
 * - abn?: string (optional)
 * - batchSize?: number (optional, default: 50)
 *
 * Response:
 * - status: 'analyzing' | 'complete' | 'error'
 * - progress: number (0-100)
 * - transactionsAnalyzed: number
 * - totalTransactions: number
 * - estimatedCostUSD: number
 * - message: string
 * - pollUrl: string
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { analyzeAllTransactions, getAnalysisStatus } from '@/lib/ai/batch-processor'
import { estimateAnalysisCost } from '@/lib/ai/forensic-analyzer'
import { validateRequestBody, validateRequestQuery } from '@/lib/api/validation-middleware'
import { analyzeRequestSchema, tenantIdQuerySchema } from '@/lib/validation/schemas'
import { retry } from '@/lib/api/retry'
import { isSingleUserMode } from '@/lib/auth/single-user-check'
import { createLogger } from '@/lib/logger'
import { applyDistributedRateLimit, DISTRIBUTED_RATE_LIMITS } from '@/lib/middleware/apply-rate-limit'

const log = createLogger('api:audit:analyze')

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for Vercel Pro

export async function POST(request: NextRequest) {
    try {
        // Rate limit analysis requests (SEC-003: expensive AI operations)
        const rateLimitResult = await applyDistributedRateLimit(
          request,
          DISTRIBUTED_RATE_LIMITS.analysis,
          'audit:analyze'
        )
        if (rateLimitResult) return rateLimitResult

        // Clone before validation so requireAuth can also read the body
        const requestForAuth = request.clone() as NextRequest

        // Validate request body using Zod schema
        const bodyValidation = await validateRequestBody(request, analyzeRequestSchema)
        if (!bodyValidation.success) return bodyValidation.response

        const { tenantId, platform, businessName, industry, abn, batchSize } = bodyValidation.data

        let validatedTenantId: string
        const analysisPlatform = platform || 'xero' // Default to Xero

        if (isSingleUserMode()) {
            // Single-user mode: Use validated tenantId from body
            validatedTenantId = tenantId
        } else {
            // Multi-user mode: Authenticate and validate tenant access
            const auth = await requireAuth(requestForAuth, { tenantIdSource: 'body' })
            if (isErrorResponse(auth)) return auth
            validatedTenantId = auth.tenantId
        }

        log.info('Starting AI analysis', { platform: analysisPlatform, tenantId: validatedTenantId })

        // Check if already analyzing (with retry for transient DB errors)
        const currentStatus = await retry(
            () => getAnalysisStatus(validatedTenantId),
            { maxAttempts: 3, initialDelayMs: 500 }
        )

        if (currentStatus && currentStatus.status === 'analyzing') {
            return NextResponse.json({
                status: 'analyzing',
                progress: currentStatus.progress,
                transactionsAnalyzed: currentStatus.transactionsAnalyzed,
                totalTransactions: currentStatus.totalTransactions,
                estimatedCostUSD: currentStatus.estimatedCostUSD,
                message: 'Analysis already in progress'
            })
        }

        // Check if cached data exists (with retry for transient DB errors)
        const cachedCount = await retry(
            () => getCachedTransactionCount(validatedTenantId, analysisPlatform),
            { maxAttempts: 3, initialDelayMs: 500 }
        )

        if (cachedCount === 0) {
            return createValidationError('No cached transactions found. Run historical sync first.')
        }

        // Estimate cost
        const costEstimate = estimateAnalysisCost(cachedCount)

        log.info('Estimated analysis cost', { costUSD: costEstimate.estimatedCostUSD, transactionCount: cachedCount })

        // Start analysis using Next.js after() to keep execution alive
        after(async () => {
            try {
                await analyzeAllTransactions(
                    validatedTenantId,
                    {
                        name: businessName,
                        industry,
                        abn,
                    },
                    {
                        platform: analysisPlatform,
                        batchSize: batchSize ?? 50,
                        onProgress: (progress) => {
                            log.debug('Analysis progress', { platform: analysisPlatform, progress: progress.progress, analyzed: progress.transactionsAnalyzed, total: progress.totalTransactions })
                        }
                    }
                )
            } catch (error) {
                console.error(`[${analysisPlatform.toUpperCase()}] Analysis failed:`, error)
            }
        })

        // Return immediate response
        return NextResponse.json({
            status: 'analyzing',
            progress: 0,
            transactionsAnalyzed: 0,
            totalTransactions: cachedCount,
            estimatedCostUSD: costEstimate.estimatedCostUSD,
            message: `Started AI analysis of ${cachedCount} transactions. Estimated cost: $${costEstimate.estimatedCostUSD.toFixed(4)}. Poll /api/audit/analysis-status/${validatedTenantId} for progress.`,
            pollUrl: `/api/audit/analysis-status/${validatedTenantId}`,
            costBreakdown: {
                inputTokens: costEstimate.inputTokens,
                outputTokens: costEstimate.outputTokens,
                totalCost: costEstimate.estimatedCostUSD
            }
        })

    } catch (error) {
        console.error('Failed to start analysis:', error)
        return createErrorResponse(error, { operation: 'startAnalysis' }, 500)
    }
}

// GET /api/audit/analyze?tenantId=xxx
// Quick status check
export async function GET(request: NextRequest) {
    try {
        // Validate query parameters using Zod schema
        const queryValidation = validateRequestQuery(request, tenantIdQuerySchema)
        if (!queryValidation.success) return queryValidation.response

        const { tenantId } = queryValidation.data
        let validatedTenantId: string

        if (isSingleUserMode()) {
            // Single-user mode: Use validated tenantId from query
            validatedTenantId = tenantId
        } else {
            // Multi-user mode: Authenticate and validate tenant access
            const auth = await requireAuth(request)
            if (isErrorResponse(auth)) return auth
            validatedTenantId = auth.tenantId
        }

        // Get analysis status (with retry for transient DB errors)
        const status = await retry(
            () => getAnalysisStatus(validatedTenantId),
            { maxAttempts: 3, initialDelayMs: 500 }
        )

        if (!status) {
            return NextResponse.json({
                status: 'idle',
                progress: 0,
                transactionsAnalyzed: 0,
                totalTransactions: 0,
                estimatedCostUSD: 0,
                message: 'No analysis has been started yet'
            })
        }

        return NextResponse.json({
            status: status.status,
            progress: status.progress,
            transactionsAnalyzed: status.transactionsAnalyzed,
            totalTransactions: status.totalTransactions,
            estimatedCostUSD: status.estimatedCostUSD,
            errorMessage: status.errorMessage,
            message: getStatusMessage(status.status, status.progress)
        })

    } catch (error) {
        console.error('Failed to get analysis status:', error)
        return createErrorResponse(error, { operation: 'getAnalysisStatus' }, 500)
    }
}

async function getCachedTransactionCount(tenantId: string, platform: string = 'xero'): Promise<number> {
    // Use admin client to bypass RLS for server-side operations
    const { createAdminClient } = await import('@/lib/supabase/server')
    const supabase = createAdminClient()

    if (platform === 'xero' || platform === 'myob' || platform === 'quickbooks') {
        // First try with platform filter
        const { count, error } = await supabase
            .from('historical_transactions_cache')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('platform', platform)

        if (error) {
            log.error('Error counting cached transactions', error instanceof Error ? error : undefined)
            throw error
        }

        // If platform filter returns 0, try without platform filter (for records
        // that were cached before the platform column was added)
        if ((count || 0) === 0) {
            const { count: totalCount, error: totalError } = await supabase
                .from('historical_transactions_cache')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenantId)

            if (totalError) {
                log.error('Error counting cached transactions (fallback)', totalError instanceof Error ? totalError : undefined)
                throw totalError
            }

            if ((totalCount || 0) > 0) {
                log.info('Found cached transactions without platform filter, updating records', {
                    tenantId,
                    platform,
                    count: totalCount,
                })
                // Backfill platform on existing records
                await supabase
                    .from('historical_transactions_cache')
                    .update({ platform })
                    .eq('tenant_id', tenantId)
                    .is('platform', null)
            }

            return totalCount || 0
        }

        return count || 0
    } else {
        throw new Error(`Unsupported platform: ${platform}`)
    }
}

function getStatusMessage(status: string, progress: number): string {
    switch (status) {
        case 'idle':
            return 'Ready to start analysis'
        case 'analyzing':
            return `Analyzing transactions with AI... ${progress.toFixed(0)}% complete`
        case 'complete':
            return 'AI analysis complete'
        case 'error':
            return 'Analysis failed - check errorMessage'
        default:
            return 'Unknown status'
    }
}
