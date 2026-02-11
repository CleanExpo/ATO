/**
 * POST /api/xero/attachments
 *
 * Attach finding summaries to transactions in Xero.
 *
 * Body:
 *  - tenantId: string (required)
 *  - recommendationIds: string[] (optional - specific recommendations to attach)
 *
 * Fetches recommendations from database, generates summaries,
 * and attaches to each transaction in Xero.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createValidationError, createErrorResponse } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { attachFindingsToXero } from '@/lib/xero/attachments-api'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'body' })
    if (isErrorResponse(auth)) return auth

    const body = await request.json()
    const { tenantId, recommendationIds } = body

    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required')
    }

    const supabase = await createServiceClient()

    // Fetch recommendations
    let query = supabase
      .from('tax_recommendations')
      .select('*')
      .eq('tenant_id', tenantId)

    if (recommendationIds && Array.isArray(recommendationIds) && recommendationIds.length > 0) {
      query = query.in('id', recommendationIds)
    }

    const { data: recommendations, error } = await query

    if (error) {
      return createErrorResponse(error, { operation: 'fetch-recommendations' }, 500)
    }

    if (!recommendations || recommendations.length === 0) {
      return NextResponse.json({
        status: 'no_data',
        message: 'No recommendations found to attach',
      })
    }

    // Map database records to attachment format
    const recsForAttachment = recommendations.map((rec) => ({
      id: rec.id,
      action: rec.action || '',
      description: rec.description || '',
      taxArea: rec.tax_area || '',
      financialYear: rec.financial_year || '',
      estimatedBenefit: rec.estimated_benefit || 0,
      confidence: rec.confidence || 0,
      adjustedBenefit: rec.adjusted_benefit || 0,
      legislativeReference: rec.legislative_reference || '',
      deadline: rec.deadline || '',
      documentationRequired: rec.documentation_required || [],
      atoForms: rec.ato_forms || [],
      transactionIds: rec.transaction_ids || [],
    }))

    const result = await attachFindingsToXero({
      tenantId,
      recommendations: recsForAttachment,
    })

    return NextResponse.json({
      status: result.success ? 'complete' : 'partial',
      totalTransactions: result.totalTransactions,
      attached: result.attached,
      failed: result.failed,
      skipped: result.skipped,
      errors: result.errors.slice(0, 10), // Return first 10 errors
    })
  } catch (error) {
    return createErrorResponse(error, { operation: 'xero-attach-findings' }, 500)
  }
}
