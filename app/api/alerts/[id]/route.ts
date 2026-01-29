/**
 * PATCH /api/alerts/[id]
 *
 * Update a tax alert's status
 *
 * Body:
 * {
 *   status: 'read' | 'acknowledged' | 'dismissed' | 'actioned'
 * }
 *
 * Response:
 * {
 *   success: boolean
 *   alert: TaxAlert
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: alertId } = await params
        const supabase = await createClient()

        // Check auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Validate alert ID
        if (!alertId) {
            return createValidationError('Alert ID is required')
        }

        // Parse body
        const body = await request.json()
        const { status } = body

        // Validate status
        const validStatuses = ['read', 'acknowledged', 'dismissed', 'actioned']
        if (!status || !validStatuses.includes(status)) {
            return createValidationError(`Status must be one of: ${validStatuses.join(', ')}`)
        }

        // Check if alert exists and belongs to user
        const { data: existingAlert, error: fetchError } = await supabase
            .from('tax_alerts')
            .select('*')
            .eq('id', alertId)
            .eq('tenant_id', user.id)
            .single()

        if (fetchError || !existingAlert) {
            return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
        }

        // Build update object
        const updateData: any = {
            status,
            updated_at: new Date().toISOString()
        }

        // Set timestamp for status change
        if (status === 'read' && !existingAlert.read_at) {
            updateData.read_at = new Date().toISOString()
        } else if (status === 'acknowledged') {
            updateData.acknowledged_at = new Date().toISOString()
        } else if (status === 'actioned') {
            updateData.actioned_at = new Date().toISOString()
        }

        // Update alert
        const { data: updatedAlert, error: updateError } = await supabase
            .from('tax_alerts')
            .update(updateData)
            .eq('id', alertId)
            .eq('tenant_id', user.id)
            .select()
            .single()

        if (updateError) {
            console.error('Error updating alert:', updateError)
            return createErrorResponse(updateError, { operation: 'updateAlert', alertId })
        }

        // Log in history
        await supabase.from('tax_alert_history').insert({
            alert_id: alertId,
            tenant_id: user.id,
            event_type: status,
            user_agent: request.headers.get('user-agent'),
            ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
            metadata: { previous_status: existingAlert.status }
        })

        return NextResponse.json({
            success: true,
            alert: updatedAlert
        })

    } catch (error) {
        console.error('Error in PATCH /api/alerts/[id]:', error)
        return createErrorResponse(error, { operation: 'updateAlert' })
    }
}

/**
 * DELETE /api/alerts/[id]
 *
 * Delete a tax alert (permanent removal)
 *
 * Response:
 * {
 *   success: boolean
 * }
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: alertId } = await params
        const supabase = await createClient()

        // Check auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Validate alert ID
        if (!alertId) {
            return createValidationError('Alert ID is required')
        }

        // Delete alert (will cascade to history due to ON DELETE CASCADE)
        const { error: deleteError } = await supabase
            .from('tax_alerts')
            .delete()
            .eq('id', alertId)
            .eq('tenant_id', user.id)

        if (deleteError) {
            console.error('Error deleting alert:', deleteError)
            return createErrorResponse(deleteError, { operation: 'deleteAlert', alertId })
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Error in DELETE /api/alerts/[id]:', error)
        return createErrorResponse(error, { operation: 'deleteAlert' })
    }
}
