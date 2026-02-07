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
import { analyzePSI } from '@/lib/analysis/psi-engine'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      tenantId,
      financialYear,
      hasPSBDetermination,
      providesOwnTools,
      liableForDefects,
      hasSeparatePremises,
      unrelatedClientCount,
    } = body

    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required')
    }

    const result = await analyzePSI(tenantId, financialYear, {
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
