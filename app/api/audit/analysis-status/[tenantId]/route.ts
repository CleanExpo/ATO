/**
 * GET /api/audit/analysis-status/:tenantId
 *
 * Get current AI analysis status for polling.
 *
 * Response:
 * - status: 'idle' | 'analyzing' | 'complete' | 'error'
 * - progress: number (0-100)
 * - transactionsAnalyzed: number
 * - totalTransactions: number
 * - currentBatch: number
 * - totalBatches: number
 * - estimatedCostUSD: number
 * - errorMessage?: string
 * - eta?: string
 * - lastBatchTime?: number (ms)
 * - averageBatchTime?: number (ms)
 * - rndCandidates?: number
 * - totalDeductions?: number
 * - division7aItems?: number
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuthOnly, isErrorResponse } from '@/lib/auth/require-auth'
import { requireTenantAccess } from '@/lib/auth/tenant-guard'
import { getAnalysisStatus } from '@/lib/ai/batch-processor'
import { createAdminClient } from '@/lib/supabase/server'
import { isSingleUserMode } from '@/lib/auth/single-user-check'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const log = createLogger('api:audit:analysis-status')

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> }
) {
    try {
        const { tenantId } = await params

        if (!tenantId) {
            return createValidationError('tenantId parameter is required')
        }

        if (!isSingleUserMode()) {
            // Multi-user mode: Authenticate user
            const auth = await requireAuthOnly(request)
            if (isErrorResponse(auth)) return auth

            // Validate tenant access
            const tenantCheck = await requireTenantAccess(auth.supabase, auth.user.id, tenantId)
            if (tenantCheck instanceof NextResponse) return tenantCheck
        }

        log.info('Getting analysis status', { tenantId })

        const status = await getAnalysisStatus(tenantId)

        if (!status) {
            return NextResponse.json({
                status: 'idle',
                progress: 0,
                transactionsAnalyzed: 0,
                totalTransactions: 0,
                currentBatch: 0,
                totalBatches: 0,
                estimatedCostUSD: 0,
                message: 'No analysis has been started yet for this tenant'
            })
        }

        // Calculate ETA
        let eta: string | undefined
        const averageBatchTime = 4000 // 4 seconds per batch (25 transactions at Gemini rate limit)

        if (status.status === 'analyzing' && status.progress > 0) {
            // Estimate based on batch progress
            const remainingBatches = status.totalBatches - status.currentBatch
            const estimatedMs = remainingBatches * averageBatchTime
            const estimatedSeconds = estimatedMs / 1000

            if (estimatedSeconds > 3600) {
                eta = `${Math.ceil(estimatedSeconds / 3600)} hours`
            } else if (estimatedSeconds > 60) {
                eta = `${Math.ceil(estimatedSeconds / 60)} minutes`
            } else {
                eta = `${Math.ceil(estimatedSeconds)} seconds`
            }
        }

        // Fetch live statistics from analysis results
        let rndCandidates = 0
        let totalDeductions = 0
        let division7aItems = 0

        if (status.status === 'analyzing' || status.status === 'complete') {
            try {
                const supabase = createAdminClient()
                const { data: statsData } = await supabase
                    .from('forensic_analysis_results')
                    .select('is_rnd_candidate, claimable_amount, division7a_risk')
                    .eq('tenant_id', tenantId)

                if (statsData) {
                    rndCandidates = statsData.filter(r => r.is_rnd_candidate).length
                    totalDeductions = statsData.reduce((sum, r) => sum + (r.claimable_amount || 0), 0)
                    division7aItems = statsData.filter(r => r.division7a_risk).length
                }
            } catch (err) {
                console.error('Failed to fetch live stats:', err)
            }
        }

        return NextResponse.json({
            status: status.status,
            progress: status.progress,
            transactionsAnalyzed: status.transactionsAnalyzed,
            totalTransactions: status.totalTransactions,
            currentBatch: status.currentBatch,
            totalBatches: status.totalBatches,
            estimatedCostUSD: status.estimatedCostUSD,
            errorMessage: status.errorMessage,
            eta,
            message: getStatusMessage(status.status, status.progress),
            // For UI convenience
            isComplete: status.status === 'complete',
            isError: status.status === 'error',
            isAnalyzing: status.status === 'analyzing',
            // Enhanced fields for progress panel
            averageBatchTime,
            rndCandidates,
            totalDeductions,
            division7aItems,
        })

    } catch (error) {
        console.error('Failed to get analysis status:', error)
        return createErrorResponse(error, { operation: 'getAnalysisStatus' }, 500)
    }
}

function getStatusMessage(status: string, progress: number): string {
    switch (status) {
        case 'idle':
            return 'Ready to start AI analysis'
        case 'analyzing':
            return `AI analyzing transactions... ${progress.toFixed(1)}% complete`
        case 'complete':
            return 'AI analysis complete - ready to view findings'
        case 'error':
            return 'Analysis encountered an error - check errorMessage for details'
        default:
            return 'Unknown analysis status'
    }
}
