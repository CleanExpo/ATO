/**
 * R&D Registration API - Single Registration Operations
 *
 * GET    /api/rnd/registrations/[id]
 * PATCH  /api/rnd/registrations/[id]
 * DELETE /api/rnd/registrations/[id]
 *
 * Manages individual R&D Tax Incentive (Division 355 ITAA 1997) registration records.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  createErrorResponse,
  createValidationError,
  createNotFoundError,
} from '@/lib/api/errors'
import {
  type RndRegistration,
  type UpdateRndRegistrationRequest,
  calculateDaysUntilDeadline,
  calculateUrgencyLevel,
} from '@/lib/types/rnd-registration'

/**
 * GET /api/rnd/registrations/[id]
 *
 * Get a single R&D registration by ID.
 *
 * Response:
 * - registration: Full registration details with computed urgency fields
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return createValidationError('Registration ID is required')
    }

    console.log(`[R&D Registration] Fetching registration ${id}`)

    const supabase = await createServiceClient()

    const { data, error } = await supabase
      .from('rnd_registrations')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return createNotFoundError(`Registration ${id}`)
      }
      console.error('[R&D Registration] Database error:', error)
      return createErrorResponse(error, { operation: 'fetchRegistration', id }, 500)
    }

    // Calculate computed fields
    const daysUntilDeadline = calculateDaysUntilDeadline(data.deadline_date)
    const urgencyLevel = calculateUrgencyLevel(daysUntilDeadline, data.registration_status)

    const registration: RndRegistration & { daysUntilDeadline: number; urgencyLevel: string } = {
      id: data.id,
      tenantId: data.tenant_id,
      financialYear: data.financial_year,
      registrationStatus: data.registration_status,
      ausindustryReference: data.ausindustry_reference,
      submissionDate: data.submission_date,
      approvalDate: data.approval_date,
      deadlineDate: data.deadline_date,
      eligibleExpenditure: data.eligible_expenditure ? parseFloat(data.eligible_expenditure) : undefined,
      estimatedOffset: data.estimated_offset ? parseFloat(data.estimated_offset) : undefined,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      daysUntilDeadline,
      urgencyLevel,
    }

    return NextResponse.json({ registration })
  } catch (error) {
    console.error('[R&D Registration] Error:', error)
    return createErrorResponse(error, { operation: 'getRegistration' }, 500)
  }
}

/**
 * PATCH /api/rnd/registrations/[id]
 *
 * Update an R&D registration.
 *
 * Request Body:
 * {
 *   registrationStatus?: string
 *   ausindustryReference?: string
 *   submissionDate?: string
 *   approvalDate?: string
 *   eligibleExpenditure?: number
 *   estimatedOffset?: number
 *   notes?: string
 * }
 *
 * Response:
 * - registration: Updated registration record
 * - message: Success message
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body: UpdateRndRegistrationRequest = await request.json()

    if (!id) {
      return createValidationError('Registration ID is required')
    }

    // Validate status if provided
    const validStatuses = ['not_started', 'in_progress', 'submitted', 'approved', 'rejected']
    if (body.registrationStatus && !validStatuses.includes(body.registrationStatus)) {
      return createValidationError(`registrationStatus must be one of: ${validStatuses.join(', ')}`)
    }

    console.log(`[R&D Registration] Updating registration ${id}`)

    const supabase = await createServiceClient()

    // Check if registration exists
    const { data: existing, error: fetchError } = await supabase
      .from('rnd_registrations')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return createNotFoundError(`Registration ${id}`)
    }

    // Build update object (only include provided fields)
    const updateData: Record<string, unknown> = {}

    if (body.registrationStatus !== undefined) {
      updateData.registration_status = body.registrationStatus
    }
    if (body.ausindustryReference !== undefined) {
      updateData.ausindustry_reference = body.ausindustryReference
    }
    if (body.submissionDate !== undefined) {
      updateData.submission_date = body.submissionDate
    }
    if (body.approvalDate !== undefined) {
      updateData.approval_date = body.approvalDate
    }
    if (body.eligibleExpenditure !== undefined) {
      updateData.eligible_expenditure = body.eligibleExpenditure
    }
    if (body.estimatedOffset !== undefined) {
      updateData.estimated_offset = body.estimatedOffset
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes
    }

    // Auto-set submission date when status changes to submitted
    if (body.registrationStatus === 'submitted' && !body.submissionDate) {
      updateData.submission_date = new Date().toISOString()
    }

    // Auto-set approval date when status changes to approved
    if (body.registrationStatus === 'approved' && !body.approvalDate) {
      updateData.approval_date = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('rnd_registrations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[R&D Registration] Update error:', error)
      return createErrorResponse(error, { operation: 'updateRegistration', id }, 500)
    }

    // Calculate computed fields
    const daysUntilDeadline = calculateDaysUntilDeadline(data.deadline_date)
    const urgencyLevel = calculateUrgencyLevel(daysUntilDeadline, data.registration_status)

    const registration: RndRegistration & { daysUntilDeadline: number; urgencyLevel: string } = {
      id: data.id,
      tenantId: data.tenant_id,
      financialYear: data.financial_year,
      registrationStatus: data.registration_status,
      ausindustryReference: data.ausindustry_reference,
      submissionDate: data.submission_date,
      approvalDate: data.approval_date,
      deadlineDate: data.deadline_date,
      eligibleExpenditure: data.eligible_expenditure ? parseFloat(data.eligible_expenditure) : undefined,
      estimatedOffset: data.estimated_offset ? parseFloat(data.estimated_offset) : undefined,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      daysUntilDeadline,
      urgencyLevel,
    }

    return NextResponse.json({
      registration,
      message: `Registration ${id} updated successfully`,
    })
  } catch (error) {
    console.error('[R&D Registration] Error:', error)
    return createErrorResponse(error, { operation: 'updateRegistration' }, 500)
  }
}

/**
 * DELETE /api/rnd/registrations/[id]
 *
 * Delete an R&D registration.
 *
 * Response:
 * - success: boolean
 * - message: string
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return createValidationError('Registration ID is required')
    }

    console.log(`[R&D Registration] Deleting registration ${id}`)

    const supabase = await createServiceClient()

    // Check if registration exists
    const { data: existing, error: fetchError } = await supabase
      .from('rnd_registrations')
      .select('id, financial_year')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return createNotFoundError(`Registration ${id}`)
    }

    // Delete the registration
    const { error } = await supabase
      .from('rnd_registrations')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[R&D Registration] Delete error:', error)
      return createErrorResponse(error, { operation: 'deleteRegistration', id }, 500)
    }

    return NextResponse.json({
      success: true,
      message: `Registration for ${existing.financial_year} deleted successfully`,
    })
  } catch (error) {
    console.error('[R&D Registration] Error:', error)
    return createErrorResponse(error, { operation: 'deleteRegistration' }, 500)
  }
}
