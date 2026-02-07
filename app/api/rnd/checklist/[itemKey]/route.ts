/**
 * R&D Checklist Item API - Update Completion Status
 *
 * PATCH /api/rnd/checklist/[itemKey]
 *
 * Updates the completion status of a specific checklist item.
 * Creates a completion record if one does not exist.
 *
 * Division 355 ITAA 1997 - R&D Tax Incentive claim preparation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  createErrorResponse,
  createValidationError,
  createNotFoundError,
} from '@/lib/api/errors'
import {
  type UpdateChecklistItemRequest,
  dbRowToChecklistItem,
} from '@/lib/types/rnd-checklist'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:rnd:checklist:item')

interface RouteContext {
  params: Promise<{ itemKey: string }>
}

/**
 * PATCH /api/rnd/checklist/[itemKey]
 *
 * Update completion status for a checklist item.
 *
 * Request Body:
 * {
 *   tenantId: string (required)
 *   registrationId?: string
 *   isCompleted: boolean (required)
 *   completedBy?: string
 *   notes?: string
 *   documentId?: string
 * }
 *
 * Response:
 * - item: Updated or created checklist item
 * - message: Status message
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { itemKey } = await context.params
    const body: UpdateChecklistItemRequest = await request.json()

    // Validate required fields
    if (!body.tenantId) {
      return createValidationError('tenantId is required')
    }

    if (!itemKey) {
      return createValidationError('itemKey is required')
    }

    if (typeof body.isCompleted !== 'boolean') {
      return createValidationError('isCompleted must be a boolean')
    }

    log.info('Updating checklist item', { itemKey, tenantId: body.tenantId, isCompleted: body.isCompleted })

    const supabase = await createServiceClient()

    // Verify the template item exists
    const { data: template, error: templateError } = await supabase
      .from('rnd_checklist_templates')
      .select('item_key, category')
      .eq('item_key', itemKey)
      .single()

    if (templateError || !template) {
      return createNotFoundError('Checklist template item', { itemKey })
    }

    // Check if a completion record already exists
    let existingQuery = supabase
      .from('rnd_checklist_items')
      .select('*')
      .eq('tenant_id', body.tenantId)
      .eq('item_key', itemKey)

    if (body.registrationId) {
      existingQuery = existingQuery.eq('registration_id', body.registrationId)
    }

    const { data: existing } = await existingQuery.maybeSingle()

    if (existing) {
      // Update existing record
      const updateData: Record<string, unknown> = {
        is_completed: body.isCompleted,
        completed_at: body.isCompleted ? new Date().toISOString() : null,
      }

      if (body.completedBy !== undefined) {
        updateData.completed_by = body.completedBy
      }

      if (body.notes !== undefined) {
        updateData.notes = body.notes
      }

      if (body.documentId !== undefined) {
        updateData.document_id = body.documentId
      }

      const { data, error } = await supabase
        .from('rnd_checklist_items')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('[R&D Checklist] Update error:', error)
        return createErrorResponse(error, { operation: 'updateChecklistItem', itemKey }, 500)
      }

      const item = dbRowToChecklistItem(data)

      return NextResponse.json({
        item,
        message: body.isCompleted
          ? `"${itemKey}" marked as completed`
          : `"${itemKey}" marked as incomplete`,
      })
    } else {
      // Create new completion record
      const record = {
        tenant_id: body.tenantId,
        registration_id: body.registrationId || null,
        category: template.category,
        item_key: itemKey,
        is_completed: body.isCompleted,
        completed_at: body.isCompleted ? new Date().toISOString() : null,
        completed_by: body.completedBy || null,
        notes: body.notes || null,
        document_id: body.documentId || null,
      }

      const { data, error } = await supabase
        .from('rnd_checklist_items')
        .insert(record)
        .select()
        .single()

      if (error) {
        console.error('[R&D Checklist] Insert error:', error)
        return createErrorResponse(error, { operation: 'createChecklistItem', itemKey }, 500)
      }

      const item = dbRowToChecklistItem(data)

      return NextResponse.json({
        item,
        message: body.isCompleted
          ? `"${itemKey}" marked as completed`
          : `"${itemKey}" tracked`,
      })
    }
  } catch (error) {
    console.error('[R&D Checklist] Error:', error)
    return createErrorResponse(error, { operation: 'updateChecklistItem' }, 500)
  }
}
