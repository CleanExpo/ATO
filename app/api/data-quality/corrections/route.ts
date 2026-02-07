/**
 * GET /api/data-quality/corrections?tenantId=xxx
 *
 * Get correction logs for a tenant.
 *
 * Query Parameters:
 * - tenantId: string (required)
 * - status: string (optional) - 'applied', 'reverted', 'failed'
 * - correctionMethod: string (optional) - 'journal_entry', 'reclassification', etc.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createValidationError, createErrorResponse } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { getCorrectionLogs, revertCorrection } from '@/lib/xero/auto-correction-engine'
import { createServiceClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:data-quality:corrections')

export async function GET(request: NextRequest) {
    try {
        // Authenticate and validate tenant access
        const auth = await requireAuth(request)
        if (isErrorResponse(auth)) return auth

        const { tenantId } = auth

        // Optional filters
        const status = request.nextUrl.searchParams.get('status') || undefined
        const correctionMethod = request.nextUrl.searchParams.get('correctionMethod') || undefined

        const logs = await getCorrectionLogs(tenantId, {
            status,
            correctionMethod
        })

        return NextResponse.json({
            corrections: logs,
            count: logs.length
        })

    } catch (error) {
        console.error('Failed to get correction logs:', error)
        return createErrorResponse(error, { operation: 'getCorrectionLogs' }, 500)
    }
}

/**
 * POST /api/data-quality/corrections/revert
 *
 * Revert a correction (undo)
 *
 * Body:
 * - tenantId: string (required)
 * - correctionId: string (required)
 */
export async function POST(request: NextRequest) {
    try {
        // Authenticate and validate tenant access (tenantId from body)
        const auth = await requireAuth(request, { tenantIdSource: 'body' })
        if (isErrorResponse(auth)) return auth

        const { tenantId } = auth
        const body = await request.json()

        const correctionId = body.correctionId
        if (!correctionId || typeof correctionId !== 'string') {
            return createValidationError('correctionId is required and must be a string')
        }

        log.info('Reverting correction', { correctionId, tenantId })

        // Get Xero tokens
        const supabase = await createServiceClient()
        const { data: connection, error: connectionError } = await supabase
            .from('xero_connections')
            .select('*')
            .eq('tenant_id', tenantId)
            .maybeSingle()

        if (connectionError || !connection) {
            return createErrorResponse(
                new Error('Xero connection not found'),
                { operation: 'revertCorrection' },
                404
            )
        }

        // Revert correction
        const success = await revertCorrection(
            tenantId,
            correctionId,
            {
                tenantId,
                accessToken: connection.access_token,
                refreshToken: connection.refresh_token
            }
        )

        if (success) {
            return NextResponse.json({
                success: true,
                message: 'Correction reverted successfully'
            })
        } else {
            return NextResponse.json({
                success: false,
                message: 'Failed to revert correction'
            }, { status: 500 })
        }

    } catch (error) {
        console.error('Failed to revert correction:', error)
        return createErrorResponse(error, { operation: 'revertCorrection' }, 500)
    }
}
