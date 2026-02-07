/**
 * POST /api/analysis/cgt
 *
 * Analyze Capital Gains Tax events and Division 152 small business concessions.
 *
 * Body:
 * - tenantId: string (required)
 * - financialYear: string (optional, "FY2024-25" format)
 * - entityType: string (optional, 'company' | 'trust' | 'partnership' | 'individual')
 * - aggregatedTurnover: number (optional, for Div 152 eligibility)
 * - netAssetValue: number (optional, for Div 152 $6M test)
 *
 * Returns: CGTSummary with event analysis, discount calculations, Div 152 concessions
 *
 * Legislation: ITAA 1997 Part 3-1, Subdivision 152
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { analyzeCGT } from '@/lib/analysis/cgt-engine'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenantId, financialYear, entityType, aggregatedTurnover, netAssetValue } = body

    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required')
    }

    const result = await analyzeCGT(tenantId, financialYear, {
      entityType,
      aggregatedTurnover,
      netAssetValue,
    })

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'analyzeCGT' }, 500)
  }
}
