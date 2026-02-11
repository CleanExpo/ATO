/**
 * POST /api/analysis/cashflow-forecast
 *
 * Generate cash flow forecast with tax obligation scheduling.
 *
 * Body:
 * - tenantId: string (required)
 * - financialYear: string (optional)
 * - horizonMonths: number (optional, default 12)
 * - openingBalance: number (optional)
 * - projectedTurnover: number (optional)
 * - paygInstalmentRate: number (optional)
 * - paygNotifiedAmount: number (optional)
 * - estimatedFBTLiability: number (optional)
 * - monthlyPayroll: number (optional)
 * - corporateTaxRate: number (optional)
 * - isGSTRegistered: boolean (optional)
 * - gstFrequency: 'monthly' | 'quarterly' (optional)
 *
 * Returns: CashFlowForecast with period projections, key dates, recommendations
 *
 * DISCLAIMER: Estimates only. Not financial advice under Corporations Act 2001.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { generateCashFlowForecast } from '@/lib/analysis/cashflow-forecast-engine'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { tenantIdSource: 'body' })
    if (isErrorResponse(auth)) return auth

    const body = await request.json()
    const { financialYear, ...options } = body

    const result = await generateCashFlowForecast(auth.tenantId, financialYear, options)

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'generateCashFlowForecast' }, 500)
  }
}
