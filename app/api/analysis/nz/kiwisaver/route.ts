/**
 * POST /api/analysis/nz/kiwisaver
 *
 * Analyse KiwiSaver employer obligations including ESCT calculations,
 * employer contributions, and rate optimisation.
 *
 * Body:
 * - tenantId: string (required)
 * - financialYear: string (optional, "FY2024-25" format)
 * - employees: array (required, employee KiwiSaver records)
 *
 * Returns: KiwiSaverSummary with ESCT calculations, employer contribution
 * totals, rate optimisation suggestions, and savings suspension tracking
 *
 * Legislation: KiwiSaver Act 2006
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { analyzeKiwiSaver } from '@/lib/analysis/nz/kiwisaver-engine'

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

    const result = await analyzeKiwiSaver(auth.tenantId, financialYear, employees)

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'analyzeKiwiSaver' }, 500)
  }
}
