/**
 * POST /api/audit/sync-historical
 *
 * Start historical data sync for forensic tax audit.
 * Fetches 5 years of Xero transactions and caches them for analysis.
 *
 * Body:
 * - tenantId: string (required) - Xero tenant ID
 * - organizationId: string (optional) - Organization ID for multi-org filtering
 * - years: number (optional) - Number of years to fetch (default: 5)
 * - forceResync: boolean (optional) - Skip cache and re-fetch (default: false)
 *
 * Response:
 * - status: 'syncing' | 'complete' | 'error'
 * - progress: number (0-100)
 * - transactionsSynced: number
 * - totalEstimated: number
 * - message: string
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isTokenExpired, refreshXeroTokens } from '@/lib/xero/client'
import { createErrorResponse, createValidationError, createNotFoundError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { fetchHistoricalTransactions, getSyncStatus } from '@/lib/xero/historical-fetcher'
import { isSingleUserMode } from '@/lib/auth/single-user-check'
import type { TokenSet } from 'xero-node'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:audit:sync-historical')

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for Vercel Pro

// Helper to get valid token set for a tenant (with optional organization filtering)
async function getValidTokenSet(tenantId: string, baseUrl?: string, organizationId?: string): Promise<TokenSet | null> {
    const supabase = createAdminClient()

    let query = supabase
        .from('xero_connections')
        .select('*')
        .eq('tenant_id', tenantId)

    // Multi-org support: Filter by organization if provided
    if (organizationId) {
        query = query.eq('organization_id', organizationId)
    }

    const { data: connection, error } = await query.maybeSingle()

    if (error || !connection) {
        return null
    }

    const tokenSet = {
        access_token: connection.access_token,
        refresh_token: connection.refresh_token,
        expires_at: connection.expires_at,
        id_token: connection.id_token,
        scope: connection.scope,
        token_type: 'Bearer'
    } as TokenSet

    // Refresh if expired
    if (isTokenExpired(tokenSet)) {
        try {
            const previousRefreshToken = tokenSet.refresh_token
            const newTokens = await refreshXeroTokens(tokenSet, baseUrl)

            // Update stored tokens
            await supabase
                .from('xero_connections')
                .update({
                    access_token: newTokens.access_token,
                    refresh_token: newTokens.refresh_token,
                    expires_at: newTokens.expires_at,
                    id_token: newTokens.id_token,
                    scope: newTokens.scope,
                    updated_at: new Date().toISOString()
                })
                .eq('refresh_token', previousRefreshToken)

            return newTokens
        } catch (error) {
            console.error('Failed to refresh Xero tokens:', error)
            return null
        }
    }

    return tokenSet
}

export async function POST(request: NextRequest) {
    try {
        const baseUrl = request.nextUrl.origin
        const body = await request.json()
        let tenantId: string

        if (isSingleUserMode()) {
            // Single-user mode: Get tenantId directly from body
            tenantId = body.tenantId
            if (!tenantId) {
                return createValidationError('tenantId is required')
            }
        } else {
            // Multi-user mode: Authenticate and validate tenant access
            const auth = await requireAuth(request, { tenantIdSource: 'body' })
            if (isErrorResponse(auth)) return auth
            tenantId = auth.tenantId
        }

        // Parse optional fields
        const years = body.years && typeof body.years === 'number' ? body.years : 5
        const forceResync = body.forceResync === true
        const organizationId = body.organizationId || undefined  // Multi-org support

        // Validate years range
        if (years < 1 || years > 10) {
            return createValidationError('years must be between 1 and 10')
        }

        log.info('Starting historical sync', { tenantId, years, forceResync })

        // Check if already syncing
        const currentStatus = await getSyncStatus(tenantId)
        if (currentStatus && currentStatus.status === 'syncing') {
            return NextResponse.json({
                status: 'syncing',
                progress: currentStatus.progress,
                transactionsSynced: currentStatus.transactionsSynced,
                totalEstimated: currentStatus.totalEstimated,
                currentYear: currentStatus.currentYear,
                yearsSynced: currentStatus.yearsSynced,
                message: 'Sync already in progress'
            })
        }

        // Get valid token set (with optional organization filtering for multi-org support)
        const tokenSet = await getValidTokenSet(tenantId, baseUrl, organizationId)
        if (!tokenSet || !tokenSet.access_token || !tokenSet.refresh_token) {
            return createNotFoundError('Xero connection' + (organizationId ? ` for organization ${organizationId}` : ''))
        }

        // Start historical fetch using Next.js after() to keep execution alive
        // after() runs after the response is sent but keeps the serverless function alive
        // for up to maxDuration (300s). Without this, Vercel kills the function immediately.
        after(async () => {
            try {
                await fetchHistoricalTransactions(
                    tenantId,
                    tokenSet.access_token!,
                    tokenSet.refresh_token!,
                    {
                        years,
                        forceResync,
                        onProgress: (progress) => {
                            log.debug('Sync progress', { tenantId, progress: progress.progress, transactionsSynced: progress.transactionsSynced })
                        }
                    }
                )
            } catch (error) {
                console.error('Historical fetch failed:', error)
            }
        })

        // Return immediate response
        return NextResponse.json({
            status: 'syncing',
            progress: 0,
            transactionsSynced: 0,
            totalEstimated: years * 1000,
            message: `Started syncing ${years} years of historical data. Poll /api/audit/sync-status/${tenantId} for progress.`,
            pollUrl: `/api/audit/sync-status/${tenantId}`
        })

    } catch (error) {
        console.error('Failed to start historical sync:', error)
        return createErrorResponse(error, { operation: 'startHistoricalSync' }, 500)
    }
}

// GET /api/audit/sync-historical?tenantId=xxx
// Quick check of sync status (alternative to dedicated status endpoint)
export async function GET(request: NextRequest) {
    try {
        let tenantId: string

        if (isSingleUserMode()) {
            // Single-user mode: Get tenantId directly from query
            tenantId = request.nextUrl.searchParams.get('tenantId') || ''
            if (!tenantId) {
                return createValidationError('tenantId is required')
            }
        } else {
            // Multi-user mode: Authenticate and validate tenant access
            const auth = await requireAuth(request)
            if (isErrorResponse(auth)) return auth
            tenantId = auth.tenantId
        }

        const status = await getSyncStatus(tenantId)

        if (!status) {
            return NextResponse.json({
                status: 'idle',
                progress: 0,
                transactionsSynced: 0,
                totalEstimated: 0,
                yearsSynced: [],
                message: 'No sync has been started yet'
            })
        }

        return NextResponse.json({
            status: status.status,
            progress: status.progress,
            transactionsSynced: status.transactionsSynced,
            totalEstimated: status.totalEstimated,
            currentYear: status.currentYear,
            yearsSynced: status.yearsSynced,
            errorMessage: status.errorMessage,
            message: getStatusMessage(status.status, status.progress)
        })

    } catch (error) {
        console.error('Failed to get sync status:', error)
        return createErrorResponse(error, { operation: 'getSyncStatus' }, 500)
    }
}

function getStatusMessage(status: string, progress: number): string {
    switch (status) {
        case 'idle':
            return 'No sync in progress'
        case 'syncing':
            return `Syncing... ${progress.toFixed(0)}% complete`
        case 'complete':
            return 'Sync complete'
        case 'error':
            return 'Sync failed - check errorMessage'
        default:
            return 'Unknown status'
    }
}
