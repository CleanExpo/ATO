/**
 * GET /api/audit/reconciliation?tenantId=xxx
 *
 * Run reconciliation analysis on cached transaction data.
 * Read-only: identifies unreconciled items, suggested matches,
 * duplicates, and missing entries.
 *
 * Query params:
 *  - tenantId: string (required)
 *  - financialYears: string (optional, comma-separated, e.g. "FY2024-25,FY2023-24")
 */

import { NextRequest, NextResponse } from 'next/server'
import { createValidationError, createErrorResponse } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { analyzeReconciliation } from '@/lib/analysis/reconciliation-engine'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'query' })
    if (isErrorResponse(auth)) return auth

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')

    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required')
    }

    const financialYearsParam = searchParams.get('financialYears')
    const financialYears = financialYearsParam
      ? financialYearsParam.split(',').map((fy) => fy.trim())
      : undefined

    const result = await analyzeReconciliation(tenantId, { financialYears })

    return NextResponse.json({
      status: 'complete',
      data: result,
    })
  } catch (error) {
    return createErrorResponse(error, { operation: 'reconciliation-analysis' }, 500)
  }
}
