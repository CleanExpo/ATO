/**
 * Small Business Entity (SBE) Checker API
 *
 * Check eligibility for small business tax concessions
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import {
  checkSBEEligibility,
  calculateTurnoverReductionStrategies,
  estimateSBEConcessionsValue,
} from '@/lib/calculators/sbe-checker'

// Validation schema
const sbeCheckSchema = z.object({
  entities: z.array(
    z.object({
      name: z.string(),
      abn: z.string().optional(),
      turnover: z.number().nonnegative(),
      relationship: z.enum(['primary', 'connected', 'affiliate']),
      controlPercentage: z.number().min(0).max(100).optional(),
    })
  ),
})

const turnoverReductionSchema = z.object({
  currentTurnover: z.number().positive(),
})

const valueEstimateSchema = z.object({
  turnover: z.number().positive(),
  assetPurchases: z.number().nonnegative(),
  employeeCount: z.number().int().nonnegative(),
})

/**
 * POST /api/strategies/sbe-checker
 *
 * Check Small Business Entity eligibility
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { tenantIdSource: 'body' })
    if (isErrorResponse(auth)) return auth

    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'check'

    switch (action) {
      case 'check': {
        const validation = sbeCheckSchema.safeParse(body)
        if (!validation.success) {
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: validation.error.errors,
            },
            { status: 400 }
          )
        }

        const result = checkSBEEligibility(validation.data.entities)
        return NextResponse.json(result)
      }

      case 'reduction-strategies': {
        const validation = turnoverReductionSchema.safeParse(body)
        if (!validation.success) {
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: validation.error.errors,
            },
            { status: 400 }
          )
        }

        const result = calculateTurnoverReductionStrategies(
          validation.data.currentTurnover
        )
        return NextResponse.json({ strategies: result })
      }

      case 'estimate-value': {
        const validation = valueEstimateSchema.safeParse(body)
        if (!validation.success) {
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: validation.error.errors,
            },
            { status: 400 }
          )
        }

        const result = estimateSBEConcessionsValue(
          validation.data.turnover,
          validation.data.assetPurchases,
          validation.data.employeeCount
        )
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json(
          {
            error:
              'Invalid action. Use: check, reduction-strategies, or estimate-value',
          },
          { status: 400 }
        )
    }
  } catch (error: unknown) {
    console.error('SBE checker error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
