/**
 * POST /api/analysis/psi
 *
 * Analyze Personal Services Income classification and PSB determination.
 *
 * Body:
 * - tenantId: string (required)
 * - financialYear: string (optional)
 * - hasPSBDetermination: boolean (optional)
 * - providesOwnTools: boolean (optional)
 * - liableForDefects: boolean (optional)
 * - hasSeparatePremises: boolean (optional)
 * - unrelatedClientCount: number (optional)
 *
 * Returns: PSIAnalysis with test results, deduction restrictions
 *
 * Legislation: Division 85-87 ITAA 1997
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { analyzePSI } from '@/lib/analysis/psi-engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { tenantIdSource: 'body' })
    if (isErrorResponse(auth)) return auth

    const body = await request.json()
    const {
      financialYear,
      hasPSBDetermination,
      providesOwnTools,
      liableForDefects,
      hasSeparatePremises,
      unrelatedClientCount,
    } = body

    const result = await analyzePSI(auth.tenantId, financialYear, {
      hasPSBDetermination,
      providesOwnTools,
      liableForDefects,
      hasSeparatePremises,
      unrelatedClientCount,
    })

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'analyzePSI' }, 500)
  }
}
