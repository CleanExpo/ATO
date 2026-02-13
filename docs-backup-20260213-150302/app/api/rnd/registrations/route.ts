/**
 * R&D Registration API - List and Create
 *
 * GET  /api/rnd/registrations?tenantId=X
 * POST /api/rnd/registrations
 *
 * Manages R&D Tax Incentive (Division 355 ITAA 1997) registration tracking
 * per tenant per financial year.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import {
  type RndRegistration,
  type CreateRndRegistrationRequest,
  calculateDeadlineFromFY,
  calculateDaysUntilDeadline,
  calculateUrgencyLevel,
} from '@/lib/types/rnd-registration'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const log = createLogger('api:rnd:registrations')

/**
 * GET /api/rnd/registrations
 *
 * Get all R&D registrations for a tenant.
 *
 * Query Parameters:
 * - tenantId: string (required)
 * - financialYear?: string (optional filter, e.g., 'FY2024-25')
 * - status?: string (optional filter)
 *
 * Response:
 * - registrations: Array of RndRegistration with urgency info
 * - summary: Overview statistics
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'query' })
    if (isErrorResponse(auth)) return auth

    const searchParams = request.nextUrl.searchParams
    const tenantId = searchParams.get('tenantId')
    const financialYear = searchParams.get('financialYear')
    const status = searchParams.get('status')

    if (!tenantId) {
      return createValidationError('tenantId is required')
    }

    log.info('Fetching registrations', { tenantId })

    const supabase = await createServiceClient()

    // Build query
    let query = supabase
      .from('rnd_registrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('deadline_date', { ascending: true })

    if (financialYear) {
      query = query.eq('financial_year', financialYear)
    }

    if (status) {
      query = query.eq('registration_status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('[R&D Registrations] Database error:', error)
      return createErrorResponse(error, { operation: 'fetchRegistrations', tenantId }, 500)
    }

    // Transform database records to response format with computed fields
    const registrations = (data || []).map((record) => {
      const daysUntilDeadline = calculateDaysUntilDeadline(record.deadline_date)
      const urgencyLevel = calculateUrgencyLevel(daysUntilDeadline, record.registration_status)

      return {
        id: record.id,
        tenantId: record.tenant_id,
        financialYear: record.financial_year,
        registrationStatus: record.registration_status,
        ausindustryReference: record.ausindustry_reference,
        submissionDate: record.submission_date,
        approvalDate: record.approval_date,
        deadlineDate: record.deadline_date,
        eligibleExpenditure: record.eligible_expenditure ? parseFloat(record.eligible_expenditure) : undefined,
        estimatedOffset: record.estimated_offset ? parseFloat(record.estimated_offset) : undefined,
        notes: record.notes,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        // Computed fields
        daysUntilDeadline,
        urgencyLevel,
      }
    })

    // Calculate summary statistics
    const summary = {
      total: registrations.length,
      byStatus: {
        not_started: registrations.filter((r) => r.registrationStatus === 'not_started').length,
        in_progress: registrations.filter((r) => r.registrationStatus === 'in_progress').length,
        submitted: registrations.filter((r) => r.registrationStatus === 'submitted').length,
        approved: registrations.filter((r) => r.registrationStatus === 'approved').length,
        rejected: registrations.filter((r) => r.registrationStatus === 'rejected').length,
      },
      byUrgency: {
        critical: registrations.filter((r) => r.urgencyLevel === 'critical').length,
        urgent: registrations.filter((r) => r.urgencyLevel === 'urgent').length,
        approaching: registrations.filter((r) => r.urgencyLevel === 'approaching').length,
        overdue: registrations.filter((r) => r.urgencyLevel === 'overdue').length,
      },
      totalEligibleExpenditure: registrations.reduce((sum, r) => sum + (r.eligibleExpenditure || 0), 0),
      totalEstimatedOffset: registrations.reduce((sum, r) => sum + (r.estimatedOffset || 0), 0),
    }

    return NextResponse.json({
      registrations,
      summary,
    })
  } catch (error) {
    console.error('[R&D Registrations] Error:', error)
    return createErrorResponse(error, { operation: 'getRegistrations' }, 500)
  }
}

/**
 * POST /api/rnd/registrations
 *
 * Create or update an R&D registration for a financial year.
 * Uses UPSERT (insert or update on conflict) based on tenant_id + financial_year.
 *
 * Request Body:
 * {
 *   tenantId: string (required)
 *   financialYear: string (required, e.g., 'FY2024-25')
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
 * - registration: Created/updated registration record
 * - created: boolean (true if new, false if updated)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { tenantIdSource: 'body' })
    if (isErrorResponse(auth)) return auth

    const body: CreateRndRegistrationRequest = await request.json()

    // Validate required fields
    if (!body.tenantId) {
      return createValidationError('tenantId is required')
    }

    if (!body.financialYear) {
      return createValidationError('financialYear is required')
    }

    // Validate financial year format
    if (!/^FY\d{4}-\d{2}$/.test(body.financialYear)) {
      return createValidationError('financialYear must be in format FY2024-25')
    }

    // Validate status if provided
    const validStatuses = ['not_started', 'in_progress', 'submitted', 'approved', 'rejected']
    if (body.registrationStatus && !validStatuses.includes(body.registrationStatus)) {
      return createValidationError(`registrationStatus must be one of: ${validStatuses.join(', ')}`)
    }

    log.info('Creating/updating registration', { tenantId: body.tenantId, financialYear: body.financialYear })

    // Calculate deadline date from financial year
    const deadlineDate = calculateDeadlineFromFY(body.financialYear)

    const supabase = await createServiceClient()

    // Check if registration already exists
    const { data: existing } = await supabase
      .from('rnd_registrations')
      .select('id')
      .eq('tenant_id', body.tenantId)
      .eq('financial_year', body.financialYear)
      .single()

    const isUpdate = !!existing

    // Build record for insert/update
    const record = {
      tenant_id: body.tenantId,
      financial_year: body.financialYear,
      registration_status: body.registrationStatus || 'not_started',
      ausindustry_reference: body.ausindustryReference || null,
      submission_date: body.submissionDate || null,
      approval_date: body.approvalDate || null,
      deadline_date: deadlineDate,
      eligible_expenditure: body.eligibleExpenditure || null,
      estimated_offset: body.estimatedOffset || null,
      notes: body.notes || null,
    }

    let result
    if (isUpdate) {
      // Update existing record
      const { data, error } = await supabase
        .from('rnd_registrations')
        .update(record)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('[R&D Registrations] Update error:', error)
        return createErrorResponse(error, { operation: 'updateRegistration' }, 500)
      }
      result = data
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('rnd_registrations')
        .insert(record)
        .select()
        .single()

      if (error) {
        console.error('[R&D Registrations] Insert error:', error)
        return createErrorResponse(error, { operation: 'createRegistration' }, 500)
      }
      result = data
    }

    // Calculate computed fields for response
    const daysUntilDeadline = calculateDaysUntilDeadline(result.deadline_date)
    const urgencyLevel = calculateUrgencyLevel(daysUntilDeadline, result.registration_status)

    const registration: RndRegistration & { daysUntilDeadline: number; urgencyLevel: string } = {
      id: result.id,
      tenantId: result.tenant_id,
      financialYear: result.financial_year,
      registrationStatus: result.registration_status,
      ausindustryReference: result.ausindustry_reference,
      submissionDate: result.submission_date,
      approvalDate: result.approval_date,
      deadlineDate: result.deadline_date,
      eligibleExpenditure: result.eligible_expenditure ? parseFloat(result.eligible_expenditure) : undefined,
      estimatedOffset: result.estimated_offset ? parseFloat(result.estimated_offset) : undefined,
      notes: result.notes,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      daysUntilDeadline,
      urgencyLevel,
    }

    return NextResponse.json({
      registration,
      created: !isUpdate,
      message: isUpdate
        ? `Registration updated for ${body.financialYear}`
        : `Registration created for ${body.financialYear}`,
    })
  } catch (error) {
    console.error('[R&D Registrations] Error:', error)
    return createErrorResponse(error, { operation: 'createRegistration' }, 500)
  }
}
