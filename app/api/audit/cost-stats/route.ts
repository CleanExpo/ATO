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
import { createErrorResponse } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { getCostSummary } from '@/lib/ai/batch-processor'
import cacheManager, { CacheTTL } from '@/lib/cache/cache-manager'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Authenticate and validate tenant access
    const auth = await requireAuth(request)
    if (isErrorResponse(auth)) return auth

    const { tenantId } = auth

    // Cache cost stats for 5 minutes
    const cacheKey = `cost-stats:${tenantId}`
    const stats = await cacheManager.getOrCompute(
      cacheKey,
      async () => await getCostSummary(tenantId),
      CacheTTL.costSummary
    )

    const response = NextResponse.json(stats)
    response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=60')
    return response
  } catch (error) {
    console.error('Failed to get cost stats:', error)
    return createErrorResponse(error, { operation: 'getCostStats' }, 500)
  }
}
