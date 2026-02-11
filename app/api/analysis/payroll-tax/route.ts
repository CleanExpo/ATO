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
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { analyzePayrollTax } from '@/lib/analysis/payroll-tax-engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { tenantIdSource: 'body' })
    if (isErrorResponse(auth)) return auth

    const body = await request.json()
    const { financialYear, ...options } = body

    const result = await analyzePayrollTax(auth.tenantId, financialYear, options)

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'analyzePayrollTax' }, 500)
  }
}
