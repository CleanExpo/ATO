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
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { analyzeFBT } from '@/lib/analysis/fbt-engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { tenantIdSource: 'body' })
    if (isErrorResponse(auth)) return auth

    const body = await request.json()
    const { fbtYear } = body

    const result = await analyzeFBT(auth.tenantId, fbtYear)

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'analyzeFBT' }, 500)
  }
}
