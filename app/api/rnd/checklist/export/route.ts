/**
 * R&D Checklist Export API
 *
 * GET /api/rnd/checklist/export?tenantId=X&registrationId=Y&format=csv
 *
 * Exports the R&D claim preparation checklist as CSV for offline use
 * or sharing with tax advisors.
 *
 * Division 355 ITAA 1997 - R&D Tax Incentive claim preparation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import {
  CATEGORY_CONFIG,
  dbRowToChecklistTemplate,
  dbRowToChecklistItem,
  mergeTemplatesWithCompletion,
} from '@/lib/types/rnd-checklist'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:rnd:checklist:export')

/**
 * GET /api/rnd/checklist/export
 *
 * Export checklist as CSV.
 *
 * Query Parameters:
 * - tenantId: string (required)
 * - registrationId?: string (optional)
 * - format: 'csv' (required, only CSV supported)
 *
 * Response:
 * - CSV file download
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenantId = searchParams.get('tenantId')
    const registrationId = searchParams.get('registrationId')
    const format = searchParams.get('format') || 'csv'

    if (!tenantId) {
      return createValidationError('tenantId is required')
    }

    if (format !== 'csv') {
      return createValidationError('Only CSV format is currently supported')
    }

    log.info('Exporting checklist', { tenantId, format })

    const supabase = await createServiceClient()

    // Fetch templates
    const { data: templateRows, error: templateError } = await supabase
      .from('rnd_checklist_templates')
      .select('*')
      .order('category', { ascending: true })
      .order('display_order', { ascending: true })

    if (templateError) {
      console.error('[R&D Checklist Export] Template fetch error:', templateError)
      return createErrorResponse(templateError, { operation: 'exportChecklist', tenantId }, 500)
    }

    const templates = (templateRows || []).map(dbRowToChecklistTemplate)

    // Fetch completions
    let completionQuery = supabase
      .from('rnd_checklist_items')
      .select('*')
      .eq('tenant_id', tenantId)

    if (registrationId) {
      completionQuery = completionQuery.eq('registration_id', registrationId)
    }

    const { data: completionRows, error: completionError } = await completionQuery

    if (completionError) {
      console.error('[R&D Checklist Export] Completion fetch error:', completionError)
      return createErrorResponse(completionError, { operation: 'exportChecklist', tenantId }, 500)
    }

    const completions = (completionRows || []).map(dbRowToChecklistItem)

    // Merge data
    const allItems = mergeTemplatesWithCompletion(templates, completions)

    // Generate CSV
    const csvRows: string[] = []

    // Header row
    csvRows.push(
      [
        'Category',
        'Item',
        'Description',
        'Mandatory',
        'Completed',
        'Completed At',
        'Completed By',
        'Legislation Reference',
        'Notes',
      ]
        .map(escapeCsvField)
        .join(',')
    )

    // Data rows
    for (const item of allItems) {
      const categoryLabel = CATEGORY_CONFIG[item.category]?.label ?? item.category

      csvRows.push(
        [
          categoryLabel,
          item.title,
          item.description ?? '',
          item.isMandatory ? 'Yes' : 'No',
          item.isCompleted ? 'Yes' : 'No',
          item.completedAt ? new Date(item.completedAt).toLocaleDateString('en-AU') : '',
          item.completedBy ?? '',
          item.legislationReference ?? '',
          item.notes ?? '',
        ]
          .map(escapeCsvField)
          .join(',')
      )
    }

    const csvContent = csvRows.join('\n')
    const filename = `rnd_checklist_${tenantId}_${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[R&D Checklist Export] Error:', error)
    return createErrorResponse(error, { operation: 'exportChecklist' }, 500)
  }
}

/**
 * Escape a CSV field value
 * Wraps in double quotes if the value contains commas, quotes, or newlines
 */
function escapeCsvField(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
