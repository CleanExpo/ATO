/**
 * Performance Monitoring Utilities
 *
 * Tracks API response times, cache hit rates, database query performance,
 * and provides performance insights.
 */

interface PerformanceMetric {
  operation: string
  startTime: number
  endTime?: number
  duration?: number
  success: boolean
  metadata?: Record<string, unknown>
}

interface PerformanceSummary {
  operation: string
  count: number
  totalDuration: number
  averageDuration: number
  minDuration: number
  maxDuration: number
  successRate: number
  p50: number
  p95: number
  p99: number
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]>
  private maxMetricsPerOperation: number

  constructor(maxMetricsPerOperation: number = 1000) {
    this.metrics = new Map()
    this.maxMetricsPerOperation = maxMetricsPerOperation
  }

  /**
   * Start tracking a performance metric
   */
  startOperation(operation: string, metadata?: Record<string, unknown>): string {
    const id = `${operation}-${Date.now()}-${Math.random()}`
    const metric: PerformanceMetric = {
      operation,
      startTime: Date.now(),
      success: true,
      metadata,
    }

    // Store metric
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, [])
    }

    const operationMetrics = this.metrics.get(operation)!
    operationMetrics.push(metric)

    // Limit memory usage by removing old metrics
    if (operationMetrics.length > this.maxMetricsPerOperation) {
      operationMetrics.shift()
    }

    return id
  }

  /**
   * End tracking a performance metric
   */
  endOperation(operation: string, success: boolean = true) {
    const operationMetrics = this.metrics.get(operation)
    if (!operationMetrics || operationMetrics.length === 0) {
      return
    }

    const metric = operationMetrics[operationMetrics.length - 1]
    metric.endTime = Date.now()
    metric.duration = metric.endTime - metric.startTime
    metric.success = success
  }

  /**
   * Track a complete operation (shorthand)
   */
  async trackOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    this.startOperation(operation, metadata)
    try {
      const result = await fn()
      this.endOperation(operation, true)
      return result
    } catch (error: unknown) {
      this.endOperation(operation, false)
      throw error
    }
  }

  /**
   * Get performance summary for an operation
   */
  getSummary(operation: string): PerformanceSummary | null {
    const operationMetrics = this.metrics.get(operation)
    if (!operationMetrics || operationMetrics.length === 0) {
      return null
    }

    const completedMetrics = operationMetrics.filter((m) => m.duration !== undefined)
    if (completedMetrics.length === 0) {
      return null
    }

    const durations = completedMetrics.map((m) => m.duration!).sort((a, b) => a - b)
    const totalDuration = durations.reduce((sum, d) => sum + d, 0)
    const successCount = completedMetrics.filter((m) => m.success).length

    const p50Index = Math.floor(durations.length * 0.5)
    const p95Index = Math.floor(durations.length * 0.95)
    const p99Index = Math.floor(durations.length * 0.99)

    return {
      operation,
      count: completedMetrics.length,
      totalDuration,
      averageDuration: totalDuration / completedMetrics.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      successRate: (successCount / completedMetrics.length) * 100,
      p50: durations[p50Index],
      p95: durations[p95Index],
      p99: durations[p99Index],
    }
  }

  /**
   * Get all performance summaries
   */
  getAllSummaries(): PerformanceSummary[] {
    const summaries: PerformanceSummary[] = []

    for (const operation of this.metrics.keys()) {
      const summary = this.getSummary(operation)
      if (summary) {
        summaries.push(summary)
      }
    }

    return summaries.sort((a, b) => b.averageDuration - a.averageDuration)
  }

  /**
   * Get slow operations (above threshold)
   */
  getSlowOperations(thresholdMs: number = 1000): PerformanceSummary[] {
    return this.getAllSummaries().filter((s) => s.averageDuration > thresholdMs)
  }

  /**
   * Get operations with low success rate
   */
  getUnreliableOperations(successRateThreshold: number = 95): PerformanceSummary[] {
    return this.getAllSummaries().filter((s) => s.successRate < successRateThreshold)
  }

  /**
   * Clear metrics for an operation
   */
  clearOperation(operation: string) {
    this.metrics.delete(operation)
  }

  /**
   * Clear all metrics
   */
  clearAll() {
    this.metrics.clear()
  }

  /**
   * Get raw metrics for debugging
   */
  getRawMetrics(operation: string): PerformanceMetric[] {
    return this.metrics.get(operation) || []
  }

  /**
   * Export metrics for external monitoring
   */
  exportMetrics(): Record<string, unknown> {
    const summaries = this.getAllSummaries()

    return {
      timestamp: new Date().toISOString(),
      summaries,
      totalOperations: summaries.reduce((sum, s) => sum + s.count, 0),
      slowestOperation: summaries[0]?.operation || null,
      fastestOperation: summaries[summaries.length - 1]?.operation || null,
    }
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor()

export default performanceMonitor

/**
 * Middleware wrapper for automatic performance tracking
 */
export function withPerformanceTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  operation: string,
  fn: T
): T {
  return (async (...args: unknown[]) => {
    return await performanceMonitor.trackOperation(operation, () => fn(...args))
  }) as T
}

/**
 * Database query performance tracker
 */
export class DatabasePerformanceTracker {
  private queryTimes: Map<string, number[]>

  constructor() {
    this.queryTimes = new Map()
  }

  trackQuery(query: string, durationMs: number) {
    if (!this.queryTimes.has(query)) {
      this.queryTimes.set(query, [])
    }

    const times = this.queryTimes.get(query)!
    times.push(durationMs)

    // Keep only last 100 queries per type
    if (times.length > 100) {
      times.shift()
    }
  }

  getSlowQueries(thresholdMs: number = 500): Array<{ query: string; avgDuration: number }> {
    const slowQueries: Array<{ query: string; avgDuration: number }> = []

    for (const [query, times] of this.queryTimes.entries()) {
      const avgDuration = times.reduce((sum, t) => sum + t, 0) / times.length

      if (avgDuration > thresholdMs) {
        slowQueries.push({ query, avgDuration })
      }
    }

    return slowQueries.sort((a, b) => b.avgDuration - a.avgDuration)
  }

  getSummary() {
    const totalQueries = Array.from(this.queryTimes.values()).reduce(
      (sum, times) => sum + times.length,
      0
    )

    const allDurations = Array.from(this.queryTimes.values()).flat()
    const avgDuration =
      allDurations.length > 0
        ? allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length
        : 0

    return {
      totalQueries,
      uniqueQueries: this.queryTimes.size,
      averageDuration: avgDuration,
      slowQueries: this.getSlowQueries(),
    }
  }

  clear() {
    this.queryTimes.clear()
  }
}

// Singleton database tracker
export const databaseTracker = new DatabasePerformanceTracker()

/**
 * Helper to format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}μs`
  }
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`
  }
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Helper to get performance grade
 */
export function getPerformanceGrade(averageDurationMs: number): string {
  if (averageDurationMs < 100) return 'A'
  if (averageDurationMs < 500) return 'B'
  if (averageDurationMs < 1000) return 'C'
  if (averageDurationMs < 2000) return 'D'
  return 'F'
}

/**
 * Log performance summary to console
 */
export function logPerformanceSummary() {
  const summaries = performanceMonitor.getAllSummaries()

  if (summaries.length === 0) {
    console.log('[Performance] No metrics collected yet')
    return
  }

  console.log('\n=== Performance Summary ===')
  summaries.forEach((s) => {
    const grade = getPerformanceGrade(s.averageDuration)
    console.log(
      `[${grade}] ${s.operation}:`,
      `avg ${formatDuration(s.averageDuration)},`,
      `p95 ${formatDuration(s.p95)},`,
      `success ${s.successRate.toFixed(1)}%,`,
      `count ${s.count}`
    )
  })
  console.log('===========================\n')
}
