/**
 * GET /api/audit/recommendations
 *
 * Get all actionable recommendations with filtering and prioritization.
 *
 * Query Parameters:
 * - tenantId: string (required)
 * - priority?: 'critical' | 'high' | 'medium' | 'low'
 * - taxArea?: 'rnd' | 'deductions' | 'losses' | 'div7a'
 * - startYear?: string (e.g., 'FY2020-21')
 * - endYear?: string (e.g., 'FY2024-25')
 *
 * Response:
 * - summary: Overall statistics and breakdown
 * - recommendations: Array of prioritized recommendations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import {
  generateRecommendations,
  getRecommendationsByPriority,
  getRecommendationsByTaxArea,
  type Priority,
  type TaxArea,
} from '@/lib/recommendations/recommendation-engine'
import cacheManager, { CacheKeys, CacheTTL } from '@/lib/cache/cache-manager'

// Single-user mode: Skip auth and use tenantId directly
const SINGLE_USER_MODE = process.env.SINGLE_USER_MODE === 'true' || true

export async function GET(request: NextRequest) {
  try {
    let tenantId: string

    if (SINGLE_USER_MODE) {
      // Single-user mode: Get tenantId from query
      tenantId = request.nextUrl.searchParams.get('tenantId') || ''
      if (!tenantId) {
        return createValidationError('tenantId is required')
      }
    } else {
      // Multi-user mode: Authenticate and validate tenant access
      const auth = await requireAuth(request)
      if (isErrorResponse(auth)) return auth
      tenantId = auth.tenantId
    }
    const priority = request.nextUrl.searchParams.get('priority') as Priority | null
    const taxArea = request.nextUrl.searchParams.get('taxArea') as TaxArea | null
    const startYear = request.nextUrl.searchParams.get('startYear') || undefined
    const endYear = request.nextUrl.searchParams.get('endYear') || undefined

    console.log(`Getting recommendations for tenant ${tenantId}`)

    // If filtering by priority
    if (priority) {
      const validPriorities: Priority[] = ['critical', 'high', 'medium', 'low']
      if (!validPriorities.includes(priority)) {
        return createValidationError(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`)
      }

      const cacheKey = CacheKeys.recommendations(tenantId, priority)
      const recommendations = await cacheManager.getOrCompute(
        cacheKey,
        async () => await getRecommendationsByPriority(tenantId, priority),
        CacheTTL.recommendations
      )

      return NextResponse.json({
        filter: { priority },
        count: recommendations.length,
        recommendations,
      })
    }

    // If filtering by tax area
    if (taxArea) {
      const validTaxAreas: TaxArea[] = ['rnd', 'deductions', 'losses', 'div7a']
      if (!validTaxAreas.includes(taxArea)) {
        return createValidationError(`Invalid taxArea. Must be one of: ${validTaxAreas.join(', ')}`)
      }

      const cacheKey = CacheKeys.recommendations(tenantId, undefined, taxArea)
      const recommendations = await cacheManager.getOrCompute(
        cacheKey,
        async () => await getRecommendationsByTaxArea(tenantId, taxArea),
        CacheTTL.recommendations
      )

      return NextResponse.json({
        filter: { taxArea },
        count: recommendations.length,
        recommendations,
      })
    }

    // Get all recommendations with full summary (cache for 30 minutes)
    const cacheKey = CacheKeys.recommendations(tenantId)
    const summary = await cacheManager.getOrCompute(
      cacheKey,
      async () => await generateRecommendations(tenantId, startYear, endYear),
      CacheTTL.recommendations
    )

    return NextResponse.json({
      summary: {
        totalRecommendations: summary.totalRecommendations,
        totalEstimatedBenefit: summary.totalEstimatedBenefit,
        totalAdjustedBenefit: summary.totalAdjustedBenefit,
        totalNetBenefit: summary.totalNetBenefit,
        byTaxArea: summary.byTaxArea,
        byPriority: summary.byPriority,
        byYear: summary.byYear,
        byAmendmentWindow: summary.byAmendmentWindow,
      },
      criticalRecommendations: summary.criticalRecommendations,
      recommendations: summary.recommendations,
    })
  } catch (error) {
    console.error('Failed to get recommendations:', error)
    return createErrorResponse(error, { operation: 'getRecommendations' }, 500)
  }
}
