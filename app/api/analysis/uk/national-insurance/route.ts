/**
 * POST /api/analysis/uk/national-insurance
 *
 * Analyse UK National Insurance contributions including Class 1 (employer/employee),
 * Class 4, Employment Allowance eligibility, and salary sacrifice optimisation.
 *
 * Body:
 * - tenantId: string (required)
 * - financialYear: string (optional, "FY2024-25" format)
 * - employees: array (required, employee records for NIC calculation)
 *
 * Returns: UKNationalInsuranceSummary with Class 1 breakdown, Employment
 * Allowance status, salary sacrifice savings, and employer cost analysis
 *
 * Legislation: Social Security Contributions and Benefits Act 1992
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { analyzeUKNationalInsurance } from '@/lib/analysis/uk/national-insurance-engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { tenantIdSource: 'body' })
    if (isErrorResponse(auth)) return auth

    const body = await request.json()
    const { financialYear, employees } = body

    if (!employees || !Array.isArray(employees)) {
      return createValidationError('employees must be a non-empty array')
    }

    const result = await analyzeUKNationalInsurance(auth.tenantId, financialYear, employees)

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'analyzeUKNationalInsurance' }, 500)
  }
}
