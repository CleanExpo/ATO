/**
 * R&D Checklist API - List Checklist with Completion Status
 *
 * GET /api/rnd/checklist?tenantId=X&registrationId=Y
 *
 * Returns all checklist template items merged with per-tenant completion
 * status, grouped by category with progress summaries.
 *
 * Division 355 ITAA 1997 - R&D Tax Incentive claim preparation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import {
  type ChecklistCategorySummary,
  type ChecklistProgress,
  CHECKLIST_CATEGORIES,
  CATEGORY_CONFIG,
  dbRowToChecklistTemplate,
  dbRowToChecklistItem,
  mergeTemplatesWithCompletion,
  calculateChecklistProgress,
} from '@/lib/types/rnd-checklist'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:rnd:checklist')

/**
 * GET /api/rnd/checklist
 *
 * Get the full R&D claim preparation checklist with completion status.
 *
 * Query Parameters:
 * - tenantId: string (required)
 * - registrationId?: string (optional, filter completions to specific registration)
 *
 * Response:
 * - progress: Overall checklist progress
 * - categories: Array of category summaries with items
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenantId = searchParams.get('tenantId')
    const registrationId = searchParams.get('registrationId')

    if (!tenantId) {
      return createValidationError('tenantId is required')
    }

    log.info('Fetching checklist', { tenantId })

    const supabase = await createServiceClient()

    // Fetch all templates (ordered by category and display_order)
    const { data: templateRows, error: templateError } = await supabase
      .from('rnd_checklist_templates')
      .select('*')
      .order('display_order', { ascending: true })

    if (templateError) {
      console.error('[R&D Checklist] Template fetch error:', templateError)
      return createErrorResponse(templateError, { operation: 'fetchTemplates', tenantId }, 500)
    }

    const templates = (templateRows || []).map(dbRowToChecklistTemplate)

    // Fetch completion records for this tenant
    let completionQuery = supabase
      .from('rnd_checklist_items')
      .select('*')
      .eq('tenant_id', tenantId)

    if (registrationId) {
      completionQuery = completionQuery.eq('registration_id', registrationId)
    }

    const { data: completionRows, error: completionError } = await completionQuery

    if (completionError) {
      console.error('[R&D Checklist] Completion fetch error:', completionError)
      return createErrorResponse(completionError, { operation: 'fetchCompletions', tenantId }, 500)
    }

    const completions = (completionRows || []).map(dbRowToChecklistItem)

    // Merge templates with completion data
    const allItems = mergeTemplatesWithCompletion(templates, completions)

    // Build category summaries
    const categories: ChecklistCategorySummary[] = CHECKLIST_CATEGORIES.map((category) => {
      const categoryItems = allItems
        .filter((item) => item.category === category)
        .sort((a, b) => a.displayOrder - b.displayOrder)

      const config = CATEGORY_CONFIG[category]
      const completedItems = categoryItems.filter((i) => i.isCompleted).length
      const mandatoryItems = categoryItems.filter((i) => i.isMandatory).length
      const mandatoryCompleted = categoryItems.filter(
        (i) => i.isMandatory && i.isCompleted
      ).length

      return {
        category,
        label: config.label,
        description: config.description,
        totalItems: categoryItems.length,
        completedItems,
        mandatoryItems,
        mandatoryCompleted,
        items: categoryItems,
      }
    })

    // Calculate overall progress
    const progressBase = calculateChecklistProgress(allItems)
    const progress: ChecklistProgress = {
      ...progressBase,
      categories,
    }

    return NextResponse.json({
      progress,
      totalTemplates: templates.length,
      totalCompletions: completions.length,
    })
  } catch (error) {
    console.error('[R&D Checklist] Error:', error)
    return createErrorResponse(error, { operation: 'getChecklist' }, 500)
  }
}
