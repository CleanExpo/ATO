/**
 * POST /api/analysis/nz/gst
 *
 * Analyse New Zealand Goods and Services Tax obligations, return periods,
 * and supply classifications.
 *
 * Body:
 * - tenantId: string (required)
 * - financialYear: string (optional, "FY2024-25" format)
 * - transactions: array (required, transaction records for GST analysis)
 *
 * Returns: NZGSTSummary with supply classification, return period analysis,
 * registration status, and filing obligations
 *
 * Legislation: Goods and Services Tax Act 1985 (NZ)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { analyzeNZGST } from '@/lib/analysis/nz/gst-engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { tenantIdSource: 'body' })
    if (isErrorResponse(auth)) return auth

    const body = await request.json()
    const { financialYear, transactions } = body

    if (!transactions || !Array.isArray(transactions)) {
      return createValidationError('transactions must be a non-empty array')
    }

    const result = await analyzeNZGST(auth.tenantId, financialYear, transactions)

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'analyzeNZGST' }, 500)
  }
}
