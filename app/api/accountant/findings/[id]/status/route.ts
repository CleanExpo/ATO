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

    // TODO: Trigger notification if status changed to approved (for client report inclusion)
    // TODO: If status is rejected, may want to trigger ML retraining or feedback loop

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
