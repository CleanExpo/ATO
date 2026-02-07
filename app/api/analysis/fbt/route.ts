/**
 * POST /api/analysis/fbt
 *
 * Analyze Fringe Benefits Tax liability.
 *
 * Body:
 * - tenantId: string (required)
 * - fbtYear: string (optional, "FBT2024-25" format - note: FBT year is Apr-Mar)
 *
 * Returns: FBTSummary with benefit classification, gross-up calculations, total FBT
 *
 * Legislation: FBTAA 1986
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { analyzeFBT } from '@/lib/analysis/fbt-engine'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenantId, fbtYear } = body

    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required')
    }

    const result = await analyzeFBT(tenantId, fbtYear)

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'analyzeFBT' }, 500)
  }
}
