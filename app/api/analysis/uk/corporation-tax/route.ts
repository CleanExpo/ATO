/**
 * POST /api/analysis/uk/corporation-tax
 *
 * Analyse UK corporation tax obligations including marginal relief,
 * associated companies impact, quarterly instalment payments, and R&D relief.
 *
 * Body:
 * - tenantId: string (required)
 * - financialYear: string (optional, "FY2024-25" format)
 * - taxableProfit: number (required, taxable profit in GBP)
 * - associatedCompanies: number (optional, defaults to 0)
 *
 * Returns: UKCorporationTaxSummary with effective rate, marginal relief
 * calculation, QIP schedule, and R&D relief eligibility
 *
 * Legislation: Corporation Tax Act 2010
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { analyzeUKCorporationTax } from '@/lib/analysis/uk/corporation-tax-engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { tenantIdSource: 'body' })
    if (isErrorResponse(auth)) return auth

    const body = await request.json()
    const { financialYear, taxableProfit, associatedCompanies = 0 } = body

    if (taxableProfit === undefined || typeof taxableProfit !== 'number') {
      return createValidationError('taxableProfit must be a number')
    }

    const result = await analyzeUKCorporationTax(auth.tenantId, financialYear, taxableProfit, associatedCompanies)

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'analyzeUKCorporationTax' }, 500)
  }
}
