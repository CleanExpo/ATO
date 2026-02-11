/**
 * POST /api/audit/reset-analysis
 *
 * Reset stuck analysis status to allow restarting.
 *
 * Body:
 * - tenantId: string (required)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { isSingleUserMode } from '@/lib/auth/single-user-check'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const log = createLogger('api:audit:reset-analysis')

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAuth(request.clone() as NextRequest, { tenantIdSource: 'body' })
        if (isErrorResponse(auth)) return auth

        const body = await request.json()
        let tenantId: string

        if (isSingleUserMode()) {
            tenantId = body.tenantId
            if (!tenantId) {
                return createValidationError('tenantId is required')
            }
        } else {
            tenantId = auth.tenantId
        }

        log.info('Resetting analysis status', { tenantId })

        const supabase = createAdminClient()

        // Reset the status to 'idle'
        const { error } = await supabase
            .from('audit_sync_status')
            .update({
                sync_status: 'idle',
                transactions_synced: 0,
                total_transactions: 0,
                error_message: null,
                updated_at: new Date().toISOString()
            })
            .eq('tenant_id', tenantId)

        if (error) {
            console.error('Error resetting analysis status:', error)
            return createErrorResponse(error, { operation: 'resetAnalysis' }, 500)
        }

        return NextResponse.json({
            success: true,
            message: 'Analysis status reset to idle'
        })

    } catch (error) {
        console.error('Failed to reset analysis status:', error)
        return createErrorResponse(error, { operation: 'resetAnalysis' }, 500)
    }
}
