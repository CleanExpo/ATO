/**
 * POST /api/analysis/payg-instalments
 *
 * Analyze PAYG instalment obligations and optimisation opportunities.
 *
 * Body:
 * - tenantId: string (required)
 * - financialYear: string (optional)
 * - currentMethod: 'amount' | 'rate' (optional)
 * - notifiedRate: number (optional)
 * - notifiedAmount: number (optional)
 * - hasVaried: boolean (optional)
 * - variedAmount: number (optional)
 * - annualTurnover: number (optional)
 * - corporateTaxRate: number (optional)
 * - priorYearTaxLiability: number (optional)
 *
 * Returns: PAYGInstalmentAnalysis with quarterly breakdown, variation analysis
 *
 * Legislation: Division 45 Schedule 1 TAA 1953
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { analyzePAYGInstalments } from '@/lib/analysis/payg-instalment-engine'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenantId, financialYear, ...options } = body

    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required')
    }

    const result = await analyzePAYGInstalments(tenantId, financialYear, options)

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'analyzePAYGInstalments' }, 500)
  }
}
