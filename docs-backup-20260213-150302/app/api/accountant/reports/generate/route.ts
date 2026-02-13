/**
 * POST /api/accountant/reports/generate
 *
 * Generate an accountant workflow Excel report from findings.
 *
 * Body:
 * - tenantId: string (required)
 * - format: 'excel' (required)
 * - workflowAreas?: string[] (optional, defaults to all)
 * - statuses?: string[] (optional, defaults to ['approved'])
 * - financialYear?: string (optional)
 * - organizationName?: string (optional)
 * - abn?: string (optional)
 *
 * Response: Excel binary download
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { isSingleUserMode } from '@/lib/auth/single-user-check'
import { createAdminClient } from '@/lib/supabase/server'
import {
  generateAccountantReportData,
  generateAccountantExcel,
} from '@/lib/reports/accountant-report-generator'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const requestForAuth = request.clone() as NextRequest

    let body: {
      tenantId?: string
      format?: string
      workflowAreas?: string[]
      statuses?: string[]
      financialYear?: string
      organizationName?: string
      abn?: string
    }
    try {
      body = await request.json()
    } catch {
      return createValidationError('Invalid JSON body')
    }

    const { tenantId, format, workflowAreas, statuses, financialYear, organizationName, abn } = body

    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required and must be a string')
    }

    if (format !== 'excel') {
      return createValidationError('format must be "excel"')
    }

    let validatedTenantId: string

    if (isSingleUserMode()) {
      validatedTenantId = tenantId
    } else {
      const auth = await requireAuth(requestForAuth, { tenantIdSource: 'body' })
      if (isErrorResponse(auth)) return auth
      validatedTenantId = auth.tenantId
    }

    const supabase = createAdminClient()

    // Resolve organization_id
    const { data: connection } = await supabase
      .from('xero_connections')
      .select('organization_id')
      .eq('tenant_id', validatedTenantId)
      .single()

    const validAreas = ['sundries', 'deductions', 'fbt', 'div7a', 'documents', 'reconciliation']
    const filteredAreas = workflowAreas?.filter((a) => validAreas.includes(a)) as
      | ('sundries' | 'deductions' | 'fbt' | 'div7a' | 'documents' | 'reconciliation')[]
      | undefined

    const reportOptions = {
      organizationId: connection?.organization_id || '',
      tenantId: validatedTenantId,
      workflowAreas: filteredAreas?.length ? filteredAreas : undefined,
      statuses: statuses?.length ? statuses : ['approved'],
      financialYear,
      organizationName,
      abn,
    }

    const findings = await generateAccountantReportData(supabase, reportOptions)

    if (findings.length === 0) {
      return NextResponse.json(
        { error: 'No findings match the specified filters. Try adjusting your criteria.' },
        { status: 404 }
      )
    }

    const buffer = await generateAccountantExcel(findings, reportOptions)

    const safeName = (organizationName || 'report').replace(/[^a-z0-9]/gi, '-')
    const filename = `accountant-findings-${safeName}-${Date.now()}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (error) {
    console.error('Failed to generate accountant report:', error)
    return createErrorResponse(error, { operation: 'generateAccountantReport' }, 500)
  }
}
