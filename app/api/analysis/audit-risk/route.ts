/**
 * POST /api/analysis/audit-risk
 *
 * Assess ATO audit risk based on industry benchmarks and transaction patterns.
 *
 * Body:
 * - tenantId: string (required)
 * - financialYear: string (optional)
 * - industryCode: string (optional)
 * - entityType: string (optional)
 *
 * Returns: AuditRiskAssessment with risk factors and benchmark comparison
 *
 * IMPORTANT: Benchmarks are DESCRIPTIVE, not NORMATIVE. Being outside benchmarks
 * is NOT illegal. This endpoint never recommends changing business to match benchmarks.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { assessAuditRisk } from '@/lib/analysis/audit-risk-engine'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenantId, financialYear, industryCode, entityType } = body

    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required')
    }

    const result = await assessAuditRisk(tenantId, financialYear, industryCode, entityType)

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'assessAuditRisk' }, 500)
  }
}
