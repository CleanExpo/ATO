/**
 * POST /api/analysis/nz/provisional-tax
 *
 * Analyse New Zealand provisional tax obligations including method comparison,
 * instalment scheduling, and use-of-money interest calculations.
 *
 * Body:
 * - tenantId: string (required)
 * - financialYear: string (optional, "FY2024-25" format)
 * - priorYearRIT: number (required, prior year residual income tax in NZD)
 * - estimatedIncome: number (optional, estimated current year income in NZD)
 *
 * Returns: NZProvisionalTaxSummary with method comparison (standard, estimation, AIM),
 * instalment dates, UOMI exposure, and safe harbour assessment
 *
 * Legislation: Tax Administration Act 1994 (NZ) Part 7
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { analyzeNZProvisionalTax } from '@/lib/analysis/nz/provisional-tax-engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { tenantIdSource: 'body' })
    if (isErrorResponse(auth)) return auth

    const body = await request.json()
    const { financialYear, priorYearRIT, estimatedIncome } = body

    if (priorYearRIT === undefined || typeof priorYearRIT !== 'number') {
      return createValidationError('priorYearRIT must be a number')
    }

    const result = await analyzeNZProvisionalTax(auth.tenantId, financialYear, priorYearRIT, estimatedIncome)

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'analyzeNZProvisionalTax' }, 500)
  }
}
