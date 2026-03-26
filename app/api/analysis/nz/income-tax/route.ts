/**
 * POST /api/analysis/nz/income-tax
 *
 * Analyse New Zealand income tax obligations including bracket calculations,
 * IETC eligibility, and loss carry-forward positions.
 *
 * Body:
 * - tenantId: string (required)
 * - financialYear: string (optional, "FY2024-25" format)
 * - income: number (required, total assessable income in NZD)
 * - entityType: string (optional, 'individual' | 'company' | 'trust' | 'partnership')
 *
 * Returns: NZIncomeTaxSummary with bracket breakdown, effective rate,
 * IETC entitlement, and imputation credit tracking
 *
 * Legislation: Income Tax Act 2007 (NZ)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { analyzeNZIncomeTax } from '@/lib/analysis/nz/income-tax-engine'

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

    const result = await analyzeNZIncomeTax(auth.tenantId, financialYear, income, entityType)

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'analyzeNZIncomeTax' }, 500)
  }
}
