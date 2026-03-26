/**
 * POST /api/analysis/uk/vat
 *
 * Analyse UK Value Added Tax obligations including supply classification,
 * flat rate scheme eligibility, and Making Tax Digital compliance.
 *
 * Body:
 * - tenantId: string (required)
 * - financialYear: string (optional, "FY2024-25" format)
 * - transactions: array (required, transaction records for VAT analysis)
 *
 * Returns: UKVATSummary with supply classification, input/output VAT,
 * flat rate scheme comparison, partial exemption analysis, and MTD status
 *
 * Legislation: Value Added Tax Act 1994
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { analyzeUKVAT } from '@/lib/analysis/uk/vat-engine'

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

    const result = await analyzeUKVAT(auth.tenantId, financialYear, transactions)

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, { operation: 'analyzeUKVAT' }, 500)
  }
}
