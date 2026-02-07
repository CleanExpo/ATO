/**
 * R&D Evidence API - List and Create
 *
 * GET  /api/rnd/evidence?tenantId=X&registrationId=Y&projectName=Z
 * POST /api/rnd/evidence
 *
 * Manages R&D evidence collection for Division 355 four-element test.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import {
  type EvidenceElement,
  type EvidenceType,
  type CreateRndEvidenceRequest,
  dbRowToRndEvidence,
  EVIDENCE_ELEMENTS,
} from '@/lib/types/rnd-evidence'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:rnd:evidence')

const VALID_EVIDENCE_TYPES: EvidenceType[] = ['document', 'description', 'reference']

/**
 * GET /api/rnd/evidence
 *
 * Get all R&D evidence for a registration or project.
 *
 * Query Parameters:
 * - tenantId: string (required)
 * - registrationId?: string (optional filter)
 * - projectName?: string (optional filter)
 * - element?: string (optional filter: outcome_unknown, systematic_approach, new_knowledge, scientific_method)
 *
 * Response:
 * - evidence: Array of RndEvidence items
 * - summary: Evidence count by element
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenantId = searchParams.get('tenantId')
    const registrationId = searchParams.get('registrationId')
    const projectName = searchParams.get('projectName')
    const element = searchParams.get('element') as EvidenceElement | null

    if (!tenantId) {
      return createValidationError('tenantId is required')
    }

    log.info('Fetching evidence', { tenantId })

    const supabase = await createServiceClient()

    // Build query
    let query = supabase
      .from('rnd_evidence')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (registrationId) {
      query = query.eq('registration_id', registrationId)
    }

    if (projectName) {
      query = query.eq('project_name', projectName)
    }

    if (element && EVIDENCE_ELEMENTS.includes(element)) {
      query = query.eq('element', element)
    }

    const { data, error } = await query

    if (error) {
      console.error('[R&D Evidence] Database error:', error)
      return createErrorResponse(error, { operation: 'fetchEvidence', tenantId }, 500)
    }

    // Transform database records to response format
    const evidence = (data || []).map(dbRowToRndEvidence)

    // Calculate summary by element
    const summary: Record<EvidenceElement, number> = {
      outcome_unknown: 0,
      systematic_approach: 0,
      new_knowledge: 0,
      scientific_method: 0,
    }

    evidence.forEach((e) => {
      if (summary[e.element] !== undefined) {
        summary[e.element]++
      }
    })

    return NextResponse.json({
      evidence,
      summary,
      total: evidence.length,
    })
  } catch (error) {
    console.error('[R&D Evidence] Error:', error)
    return createErrorResponse(error, { operation: 'getEvidence' }, 500)
  }
}

/**
 * POST /api/rnd/evidence
 *
 * Create a new R&D evidence item.
 *
 * Request Body:
 * {
 *   tenantId: string (required)
 *   registrationId?: string
 *   projectName: string (required)
 *   element: string (required: outcome_unknown, systematic_approach, new_knowledge, scientific_method)
 *   evidenceType: string (required: document, description, reference)
 *   title: string (required)
 *   description?: string
 *   documentId?: string
 *   url?: string
 *   dateCreated?: string (YYYY-MM-DD)
 *   isContemporaneous?: boolean
 * }
 *
 * Response:
 * - evidence: Created evidence record
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateRndEvidenceRequest = await request.json()

    // Validate required fields
    if (!body.tenantId) {
      return createValidationError('tenantId is required')
    }

    if (!body.projectName) {
      return createValidationError('projectName is required')
    }

    if (!body.element) {
      return createValidationError('element is required')
    }

    if (!EVIDENCE_ELEMENTS.includes(body.element)) {
      return createValidationError(
        `element must be one of: ${EVIDENCE_ELEMENTS.join(', ')}`
      )
    }

    if (!body.evidenceType) {
      return createValidationError('evidenceType is required')
    }

    if (!VALID_EVIDENCE_TYPES.includes(body.evidenceType)) {
      return createValidationError(
        `evidenceType must be one of: ${VALID_EVIDENCE_TYPES.join(', ')}`
      )
    }

    if (!body.title || body.title.trim() === '') {
      return createValidationError('title is required')
    }

    // Validate type-specific requirements
    if (body.evidenceType === 'document' && !body.documentId) {
      return createValidationError('documentId is required for document evidence')
    }

    if (body.evidenceType === 'reference' && !body.url) {
      return createValidationError('url is required for reference evidence')
    }

    // Validate URL format if provided
    if (body.url && !isValidUrl(body.url)) {
      return createValidationError('url must be a valid URL')
    }

    // Validate date format if provided
    if (body.dateCreated && !/^\d{4}-\d{2}-\d{2}$/.test(body.dateCreated)) {
      return createValidationError('dateCreated must be in YYYY-MM-DD format')
    }

    log.info('Creating evidence', { tenantId: body.tenantId, projectName: body.projectName, element: body.element })

    const supabase = await createServiceClient()

    // Build record for insert
    const record = {
      tenant_id: body.tenantId,
      registration_id: body.registrationId || null,
      project_name: body.projectName,
      element: body.element,
      evidence_type: body.evidenceType,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      document_id: body.documentId || null,
      url: body.url || null,
      date_created: body.dateCreated || null,
      is_contemporaneous: body.isContemporaneous ?? false,
    }

    const { data, error } = await supabase
      .from('rnd_evidence')
      .insert(record)
      .select()
      .single()

    if (error) {
      console.error('[R&D Evidence] Insert error:', error)
      return createErrorResponse(error, { operation: 'createEvidence' }, 500)
    }

    const evidence = dbRowToRndEvidence(data)

    return NextResponse.json({
      evidence,
      message: `Evidence created for ${body.element}`,
    })
  } catch (error) {
    console.error('[R&D Evidence] Error:', error)
    return createErrorResponse(error, { operation: 'createEvidence' }, 500)
  }
}

/**
 * Validate URL format
 */
function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString)
    return true
  } catch {
    return false
  }
}
