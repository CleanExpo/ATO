/**
 * POST /api/analysis/payroll-tax
 *
 * Analyze state payroll tax obligations across jurisdictions.
 *
 * Body:
 * - tenantId: string (required)
 * - financialYear: string (optional)
 * - stateWages: Array<{ state, grossWages, contractorPayments, contractorDeemingAssessed, employeeCount }> (optional)
 * - isGroupMember: boolean (optional)
 * - totalGroupWages: number (optional)
 * - groupEntityCount: number (optional)
 * - groupEntityNames: string[] (optional)
 *
 * Returns: PayrollTaxAnalysis with state-by-state calculations
 *
 * Legislation: State Payroll Tax Acts (varies by jurisdiction)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { analyzePayrollTax } from '@/lib/analysis/payroll-tax-engine'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenantId, financialYear, ...options } = body

    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required')
    }

    const result = await analyzePayrollTax(tenantId, financialYear, options)

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'analyzePayrollTax' }, 500)
  }
}
