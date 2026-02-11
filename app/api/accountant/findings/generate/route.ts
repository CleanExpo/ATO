/**
 * POST /api/accountant/findings/generate
 *
 * Triggers the forensic-to-findings mapper for a given tenant.
 * Transforms forensic_analysis_results into accountant_findings
 * across 6 workflow areas.
 *
 * Body:
 * - tenantId: string (required)
 * - financialYear?: string (optional, defaults to current FY)
 *
 * Response:
 * - status: 'complete'
 * - created: number
 * - skipped: number
 * - byArea: Record<WorkflowArea, number>
 * - message: string
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { isSingleUserMode } from '@/lib/auth/single-user-check'
import { getCurrentFinancialYear } from '@/lib/utils/financial-year'
import { generateAccountantFindings } from '@/lib/accountant/forensic-findings-mapper'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const requestForAuth = request.clone() as NextRequest

    // Parse and validate request body
    let body: { tenantId?: string; financialYear?: string }
    try {
      body = await request.json()
    } catch {
      return createValidationError('Invalid JSON body')
    }

    const { tenantId, financialYear } = body

    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required and must be a string')
    }

    let validatedTenantId: string

    if (isSingleUserMode()) {
      validatedTenantId = tenantId
    } else {
      const auth = await requireAuth(requestForAuth, { tenantIdSource: 'body' })
      if (isErrorResponse(auth)) return auth
      validatedTenantId = auth.tenantId
    }

    // Resolve organization_id from xero_connections
    const supabase = createAdminClient()

    const { data: connection, error: connError } = await supabase
      .from('xero_connections')
      .select('organization_id')
      .eq('tenant_id', validatedTenantId)
      .single()

    if (connError || !connection) {
      return createValidationError(
        'No Xero connection found for this tenant. Connect a Xero organisation first.'
      )
    }

    if (!connection.organization_id) {
      return createValidationError(
        'Xero connection has no linked organisation. Re-connect your Xero account.'
      )
    }

    const resolvedFY = financialYear || getCurrentFinancialYear()

    // Generate findings
    const result = await generateAccountantFindings(
      supabase,
      validatedTenantId,
      connection.organization_id,
      resolvedFY
    )

    const total = result.created + result.skipped

    return NextResponse.json({
      status: 'complete',
      created: result.created,
      skipped: result.skipped,
      byArea: result.byArea,
      message: total > 0
        ? `Generated ${result.created} findings from ${total} forensic analysis results`
        : 'No forensic analysis results found. Run a Forensic Audit first.',
    })
  } catch (error) {
    console.error('Failed to generate accountant findings:', error)
    return createErrorResponse(error, { operation: 'generateAccountantFindings' }, 500)
  }
}
