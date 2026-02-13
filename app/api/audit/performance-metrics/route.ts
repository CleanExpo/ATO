/**
 * GET /api/audit/performance-metrics
 *
 * Get performance metrics for all operations.
 * Shows API response times, cache hit rates, and slow operations.
 *
 * Response:
 * - summaries: Performance summary for each operation
 * - slowOperations: Operations slower than 1 second
 * - unreliableOperations: Operations with <95% success rate
 * - cacheStats: Cache hit/miss statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import performanceMonitor, { formatDuration, getPerformanceGrade } from '@/lib/monitoring/performance-monitor'
import cacheManager from '@/lib/cache/cache-manager'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'query' })
    if (isErrorResponse(auth)) return auth

    // Get performance summaries
    const summaries = performanceMonitor.getAllSummaries()
    const slowOperations = performanceMonitor.getSlowOperations(1000)
    const unreliableOperations = performanceMonitor.getUnreliableOperations(95)

    // Get cache statistics
    const cacheStats = cacheManager.getStats()

    // Format summaries for better readability
    const formattedSummaries = summaries.map((s) => ({
      ...s,
      grade: getPerformanceGrade(s.averageDuration),
      averageDurationFormatted: formatDuration(s.averageDuration),
      p50Formatted: formatDuration(s.p50),
      p95Formatted: formatDuration(s.p95),
      p99Formatted: formatDuration(s.p99),
    }))

    return NextResponse.json({
      summaries: formattedSummaries,
      slowOperations: slowOperations.map((s) => ({
        ...s,
        grade: getPerformanceGrade(s.averageDuration),
        averageDurationFormatted: formatDuration(s.averageDuration),
      })),
      unreliableOperations,
      cacheStats,
      health: {
        overallGrade: calculateOverallGrade(summaries),
        slowOperationCount: slowOperations.length,
        unreliableOperationCount: unreliableOperations.length,
        cacheHitRate: cacheStats.hitRate,
      },
    })
  } catch (error) {
    console.error('Failed to get performance metrics:', error)
    return NextResponse.json(
      { error: 'Failed to get performance metrics' },
      { status: 500 }
    )
  }
}

interface PerformanceSummary {
    averageDuration: number
}

function calculateOverallGrade(summaries: PerformanceSummary[]): string {
  if (summaries.length === 0) return 'N/A'

  const totalDuration = summaries.reduce((sum, s) => sum + s.averageDuration, 0)
  const avgDuration = totalDuration / summaries.length

  return getPerformanceGrade(avgDuration)
}
