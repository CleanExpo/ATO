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
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuthOnly, isErrorResponse } from '@/lib/auth/require-auth'
import { requireTenantAccess } from '@/lib/auth/tenant-guard'
import { getAnalysisStatus } from '@/lib/ai/batch-processor'

// Single-user mode: Skip auth and use tenantId directly from URL
const SINGLE_USER_MODE = process.env.SINGLE_USER_MODE === 'true' || true

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ tenantId: string }> }
) {
    try {
        const { tenantId } = await params

        if (!tenantId) {
            return createValidationError('tenantId parameter is required')
        }

        if (!SINGLE_USER_MODE) {
            // Multi-user mode: Authenticate user
            const auth = await requireAuthOnly(request)
            if (isErrorResponse(auth)) return auth

            // Validate tenant access
            const tenantCheck = await requireTenantAccess(auth.supabase, auth.user.id, tenantId)
            if (tenantCheck instanceof NextResponse) return tenantCheck
        }

        console.log(`Getting analysis status for tenant ${tenantId}`)

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
        if (status.status === 'analyzing' && status.progress > 0) {
            // Estimate based on progress
            // Assume ~1-2 seconds per transaction
            const remainingTransactions = status.totalTransactions - status.transactionsAnalyzed
            const estimatedSecondsPerTransaction = 1.5
            const estimatedSeconds = remainingTransactions * estimatedSecondsPerTransaction

            if (estimatedSeconds > 3600) {
                eta = `${Math.ceil(estimatedSeconds / 3600)} hours`
            } else if (estimatedSeconds > 60) {
                eta = `${Math.ceil(estimatedSeconds / 60)} minutes`
            } else {
                eta = `${Math.ceil(estimatedSeconds)} seconds`
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
            isAnalyzing: status.status === 'analyzing'
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
