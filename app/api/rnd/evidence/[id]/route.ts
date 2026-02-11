/**
 * R&D Evidence API - Single Evidence Item Operations
 *
 * GET    /api/rnd/evidence/[id] - Get single evidence item
 * PATCH  /api/rnd/evidence/[id] - Update evidence item
 * DELETE /api/rnd/evidence/[id] - Delete evidence item
 *
 * Manages individual R&D evidence items for Division 355 four-element test.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  createErrorResponse,
  createValidationError,
  createNotFoundError,
} from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import {
  type UpdateRndEvidenceRequest,
  dbRowToRndEvidence,
} from '@/lib/types/rnd-evidence'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:rnd:evidence:detail')

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/rnd/evidence/[id]
 *
 * Get a single evidence item by ID.
 *
 * Query Parameters:
 * - tenantId: string (required for validation)
 *
 * Response:
 * - evidence: RndEvidence record
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'query' })
    if (isErrorResponse(auth)) return auth

    const { id } = await context.params
    const searchParams = request.nextUrl.searchParams
    const tenantId = searchParams.get('tenantId')

    if (!tenantId) {
      return createValidationError('tenantId is required')
    }

    if (!id) {
      return createValidationError('evidence id is required')
    }

    log.info('Fetching evidence', { id, tenantId })

    const supabase = await createServiceClient()

    const { data, error } = await supabase
      .from('rnd_evidence')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return createNotFoundError('Evidence item', { id })
      }
      console.error('[R&D Evidence] Database error:', error)
      return createErrorResponse(error, { operation: 'getEvidence', id }, 500)
    }

    const evidence = dbRowToRndEvidence(data)

    return NextResponse.json({ evidence })
  } catch (error) {
    console.error('[R&D Evidence] Error:', error)
    return createErrorResponse(error, { operation: 'getEvidence' }, 500)
  }
}

/**
 * PATCH /api/rnd/evidence/[id]
 *
 * Update an existing evidence item.
 *
 * Request Body:
 * {
 *   tenantId: string (required for validation)
 *   title?: string
 *   description?: string
 *   documentId?: string
 *   url?: string
 *   dateCreated?: string (YYYY-MM-DD)
 *   isContemporaneous?: boolean
 * }
 *
 * Response:
 * - evidence: Updated evidence record
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { tenantIdSource: 'body' })
    if (isErrorResponse(auth)) return auth

    const { id } = await context.params
    const body: UpdateRndEvidenceRequest & { tenantId?: string } =
      await request.json()

    if (!body.tenantId) {
      return createValidationError('tenantId is required')
    }

    if (!id) {
      return createValidationError('evidence id is required')
    }

    // Validate URL format if provided
    if (body.url && !isValidUrl(body.url)) {
      return createValidationError('url must be a valid URL')
    }

    // Validate date format if provided
    if (body.dateCreated && !/^\d{4}-\d{2}-\d{2}$/.test(body.dateCreated)) {
      return createValidationError('dateCreated must be in YYYY-MM-DD format')
    }

    log.info('Updating evidence', { id, tenantId: body.tenantId })

    const supabase = await createServiceClient()

    // Verify the evidence exists and belongs to the tenant
    const { data: existing, error: fetchError } = await supabase
      .from('rnd_evidence')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', body.tenantId)
      .single()

    if (fetchError || !existing) {
      return createNotFoundError('Evidence item', { id })
    }

    // Build update object (only include provided fields)
    const updateData: Record<string, unknown> = {}

    if (body.title !== undefined) {
      updateData.title = body.title.trim()
    }

    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null
    }

    if (body.documentId !== undefined) {
      updateData.document_id = body.documentId || null
    }

    if (body.url !== undefined) {
      updateData.url = body.url || null
    }

    if (body.dateCreated !== undefined) {
      updateData.date_created = body.dateCreated || null
    }

    if (body.isContemporaneous !== undefined) {
      updateData.is_contemporaneous = body.isContemporaneous
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return createValidationError('No fields to update')
    }

    const { data, error } = await supabase
      .from('rnd_evidence')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', body.tenantId)
      .select()
      .single()

    if (error) {
      console.error('[R&D Evidence] Update error:', error)
      return createErrorResponse(error, { operation: 'updateEvidence', id }, 500)
    }

    const evidence = dbRowToRndEvidence(data)

    return NextResponse.json({
      evidence,
      message: 'Evidence updated successfully',
    })
  } catch (error) {
    console.error('[R&D Evidence] Error:', error)
    return createErrorResponse(error, { operation: 'updateEvidence' }, 500)
  }
}

/**
 * DELETE /api/rnd/evidence/[id]
 *
 * Delete an evidence item.
 *
 * Query Parameters:
 * - tenantId: string (required for validation)
 *
 * Response:
 * - success: boolean
 * - message: string
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'query' })
    if (isErrorResponse(auth)) return auth

    const { id } = await context.params
    const searchParams = request.nextUrl.searchParams
    const tenantId = searchParams.get('tenantId')

    if (!tenantId) {
      return createValidationError('tenantId is required')
    }

    if (!id) {
      return createValidationError('evidence id is required')
    }

    log.info('Deleting evidence', { id, tenantId })

    const supabase = await createServiceClient()

    // Verify the evidence exists and belongs to the tenant
    const { data: existing, error: fetchError } = await supabase
      .from('rnd_evidence')
      .select('id, element, project_name')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError || !existing) {
      return createNotFoundError('Evidence item', { id })
    }

    const { error } = await supabase
      .from('rnd_evidence')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) {
      console.error('[R&D Evidence] Delete error:', error)
      return createErrorResponse(error, { operation: 'deleteEvidence', id }, 500)
    }

    return NextResponse.json({
      success: true,
      message: `Evidence deleted for ${existing.element} in project ${existing.project_name}`,
    })
  } catch (error) {
    console.error('[R&D Evidence] Error:', error)
    return createErrorResponse(error, { operation: 'deleteEvidence' }, 500)
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
