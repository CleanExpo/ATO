/**
 * POST /api/analysis/uk/income-tax
 *
 * Analyse UK income tax obligations including bracket calculations,
 * personal allowance taper, Scottish rate variations, and dividend tax.
 *
 * Body:
 * - tenantId: string (required)
 * - financialYear: string (optional, "FY2024-25" format)
 * - income: number (required, total assessable income in GBP)
 * - entityType: string (optional, 'individual' | 'sole_trader' | 'partnership')
 *
 * Returns: UKIncomeTaxSummary with bracket breakdown, personal allowance
 * calculation, effective rate, Scottish rate comparison, and dividend tax analysis
 *
 * Legislation: Income Tax Act 2007 (UK)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { analyzeUKIncomeTax } from '@/lib/analysis/uk/income-tax-engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { tenantIdSource: 'body' })
    if (isErrorResponse(auth)) return auth

    const body = await request.json()
    const { financialYear, income, entityType } = body

    if (income === undefined || typeof income !== 'number') {
      return createValidationError('income must be a number')
    }

    const result = await analyzeUKIncomeTax(auth.tenantId, financialYear, income, entityType)

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'analyzeUKIncomeTax' }, 500)
  }
}
