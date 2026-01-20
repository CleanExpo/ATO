/**
 * GET /api/audit/cost-stats
 *
 * Get quick aggregate cost statistics (lightweight endpoint for dashboard widgets).
 *
 * Query Parameters:
 * - tenantId: string (required)
 *
 * Response:
 * - Quick summary stats only (no breakdown or trends)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { getCostSummary } from '@/lib/ai/batch-processor'
import cacheManager, { CacheTTL } from '@/lib/cache/cache-manager'

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId')

    if (!tenantId) {
      return createValidationError('tenantId query parameter is required')
    }

    // Cache cost stats for 5 minutes
    const cacheKey = `cost-stats:${tenantId}`
    const stats = await cacheManager.getOrCompute(
      cacheKey,
      async () => await getCostSummary(tenantId),
      CacheTTL.costSummary
    )

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Failed to get cost stats:', error)
    return createErrorResponse(error, { operation: 'getCostStats' }, 500)
  }
}
