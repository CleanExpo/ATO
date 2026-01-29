/**
 * GET /api/audit/sync-status/:tenantId
 *
 * Get current sync status for a tenant.
 * Used for polling during long-running historical data sync.
 *
 * Response:
 * - status: 'idle' | 'syncing' | 'complete' | 'error'
 * - progress: number (0-100)
 * - transactionsSynced: number
 * - totalEstimated: number
 * - currentYear: string (e.g., 'FY2024-25')
 * - yearsSynced: string[]
 * - errorMessage?: string
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuthOnly, isErrorResponse } from '@/lib/auth/require-auth'
import { requireTenantAccess } from '@/lib/auth/tenant-guard'
import { getSyncStatus } from '@/lib/xero/historical-fetcher'

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
            // Multi-user mode: Authenticate and validate tenant access
            const auth = await requireAuthOnly(request)
            if (isErrorResponse(auth)) return auth

            const tenantCheck = await requireTenantAccess(auth.supabase, auth.user.id, tenantId)
            if (tenantCheck instanceof NextResponse) return tenantCheck
        }

        console.log(`Getting sync status for tenant ${tenantId}`)

        const status = await getSyncStatus(tenantId)

        if (!status) {
            return NextResponse.json({
                status: 'idle',
                progress: 0,
                transactionsSynced: 0,
                totalEstimated: 0,
                yearsSynced: [],
                message: 'No sync has been started yet for this tenant'
            })
        }

        // Calculate estimated time remaining (rough estimate)
        let eta: string | undefined
        if (status.status === 'syncing' && status.progress > 0) {
            const estimatedTotalMinutes = 10 // Assume 10 minutes for full sync
            const remainingMinutes = estimatedTotalMinutes * (1 - status.progress / 100)
            if (remainingMinutes > 1) {
                eta = `${Math.ceil(remainingMinutes)} minutes`
            } else {
                eta = 'Less than 1 minute'
            }
        }

        return NextResponse.json({
            status: status.status,
            progress: status.progress,
            transactionsSynced: status.transactionsSynced,
            totalEstimated: status.totalEstimated,
            currentYear: status.currentYear,
            yearsSynced: status.yearsSynced,
            errorMessage: status.errorMessage,
            eta,
            message: getStatusMessage(status.status, status.progress),
            // For UI convenience
            isComplete: status.status === 'complete',
            isError: status.status === 'error',
            isSyncing: status.status === 'syncing'
        })

    } catch (error) {
        console.error('Failed to get sync status:', error)
        return createErrorResponse(error, { operation: 'getSyncStatus' }, 500)
    }
}

function getStatusMessage(status: string, progress: number): string {
    switch (status) {
        case 'idle':
            return 'Ready to start sync'
        case 'syncing':
            return `Syncing historical data... ${progress.toFixed(1)}% complete`
        case 'complete':
            return 'Historical data sync complete - ready for analysis'
        case 'error':
            return 'Sync encountered an error - check errorMessage for details'
        default:
            return 'Unknown sync status'
    }
}
