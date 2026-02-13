/**
 * Finding Status Update API
 *
 * PATCH /api/accountant/findings/[id]/status - Update finding status
 *
 * Implements approve/reject/defer workflow actions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { sendAlertEmail } from '@/lib/alerts/email-notifier'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * PATCH /api/accountant/findings/[id]/status
 *
 * Update finding status (approve/reject/defer)
 *
 * Body:
 * - status: 'approved' | 'rejected' | 'deferred' (required)
 * - reason: string (optional, recommended for rejection)
 * - accountantNotes: string (optional)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request, { skipTenantValidation: true })
    if (isErrorResponse(auth)) return auth

    const { id } = await params
    const supabase = await createServiceClient()
    const body = await request.json()

    // Validate status
    if (!body.status) {
      return createValidationError('status is required')
    }

    const validStatuses = ['approved', 'rejected', 'deferred', 'pending']
    if (!validStatuses.includes(body.status)) {
      return createValidationError(`status must be one of: ${validStatuses.join(', ')}`)
    }

    // Get current finding
    const { data: currentFinding, error: fetchError } = await supabase
      .from('accountant_findings')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !currentFinding) {
      return NextResponse.json(
        { error: 'Finding not found', findingId: id },
        { status: 404 }
      )
    }

    // Build update object
    const updateData: Record<string, string> = {
      status: body.status,
      updated_at: new Date().toISOString(),
    }

    if (body.reason) {
      updateData.rejection_reason = body.reason
    }

    if (body.accountantNotes) {
      updateData.accountant_notes = body.accountantNotes
    }

    // For approved findings, record approval timestamp
    if (body.status === 'approved') {
      updateData.approved_at = new Date().toISOString()
    }

    // Update finding
    const { data: updatedFinding, error: updateError } = await supabase
      .from('accountant_findings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating finding status:', updateError)
      return createErrorResponse(updateError, {
        operation: 'update_finding_status',
        findingId: id,
        newStatus: body.status,
      }, 500)
    }

    // Send email notification when a finding is approved
    if (body.status === 'approved' && updatedFinding.tenant_id) {
      try {
        const { data: prefs } = await supabase
          .from('tax_alert_preferences')
          .select('notification_email, email_notifications')
          .eq('tenant_id', updatedFinding.tenant_id)
          .eq('email_notifications', true)
          .single()

        if (prefs?.notification_email) {
          await sendAlertEmail(
            {
              id: updatedFinding.id,
              tenant_id: updatedFinding.tenant_id,
              alert_type: 'finding_approved',
              title: `Finding Approved: ${updatedFinding.title || 'Untitled Finding'}`,
              message: body.accountantNotes || 'A finding has been approved by your accountant and will be included in your next client report.',
              severity: 'info',
              category: 'Accountant Review',
              action_url: `/dashboard/findings/${updatedFinding.id}`,
              action_label: 'View Finding',
            },
            prefs.notification_email
          )
        }
      } catch (notifyError) {
        // Log but do not fail the request if notification fails
        console.error('Failed to send approval notification:', notifyError)
      }
    }

    return NextResponse.json({
      id: updatedFinding.id,
      status: updatedFinding.status,
      message: `Finding ${body.status} successfully`,
      updatedAt: updatedFinding.updated_at,
    })
  } catch (error) {
    console.error('Unexpected error in PATCH /api/accountant/findings/[id]/status:', error)
    return createErrorResponse(error, {
      operation: 'update_finding_status',
    }, 500)
  }
}
