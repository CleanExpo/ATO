/**
 * Division 7A Calculator API
 *
 * Calculate minimum yearly repayments for Division 7A loans
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import {
  calculateDiv7ARepayments,
  checkDiv7ACompliance,
  compareLoanOptions,
} from '@/lib/calculators/division7a-calculator'

export const dynamic = 'force-dynamic'

// Validation schema
const div7aCalculationSchema = z.object({
  loanAmount: z.number().positive('Loan amount must be positive'),
  loanDate: z.string(), // ISO date
  isSecured: z.boolean(),
  interestRate: z.number().min(0).max(1).optional(), // 0-1 (e.g., 0.0877 for 8.77%)
})

const div7aComplianceSchema = z.object({
  loanAmount: z.number().positive(),
  loanDate: z.string(),
  isSecured: z.boolean(),
  interestRate: z.number().min(0).max(1).optional(),
  actualRepayments: z.array(
    z.object({
      date: z.string(),
      amount: z.number(),
    })
  ),
})

const div7aComparisonSchema = z.object({
  loanAmount: z.number().positive(),
})

/**
 * POST /api/strategies/division7a
 *
 * Calculate Division 7A repayment schedule
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { tenantIdSource: 'body' })
    if (isErrorResponse(auth)) return auth

    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'calculate'

    switch (action) {
      case 'calculate': {
        const validation = div7aCalculationSchema.safeParse(body)
        if (!validation.success) {
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: validation.error.errors,
            },
            { status: 400 }
          )
        }

        const result = calculateDiv7ARepayments(validation.data)
        return NextResponse.json(result)
      }

      case 'compliance': {
        const validation = div7aComplianceSchema.safeParse(body)
        if (!validation.success) {
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: validation.error.errors,
            },
            { status: 400 }
          )
        }

        const { actualRepayments, ...loanDetails } = validation.data
        const result = checkDiv7ACompliance(loanDetails, actualRepayments)
        return NextResponse.json(result)
      }

      case 'compare': {
        const validation = div7aComparisonSchema.safeParse(body)
        if (!validation.success) {
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: validation.error.errors,
            },
            { status: 400 }
          )
        }

        const result = compareLoanOptions(validation.data.loanAmount)
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: calculate, compliance, or compare' },
          { status: 400 }
        )
    }
  } catch (error: unknown) {
    console.error('Division 7A calculation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
