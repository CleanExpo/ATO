/**
 * AI Analysis Optimizer
 *
 * Enhances batch processing with:
 * - Result caching (avoid re-analyzing)
 * - Resume functionality (continue interrupted analysis)
 * - Auto-tuning batch size (optimize for rate limits)
 * - ETA calculation (time remaining estimates)
 * - Budget monitoring (cost alerts)
 */

import { createServiceClient } from '@/lib/supabase/server'
import type { AnalysisProgress } from './batch-processor'

/**
 * Check which transactions have already been analyzed
 *
 * @param tenantId - Tenant to check
 * @param transactionIds - Transaction IDs to check
 * @returns Set of already-analyzed transaction IDs
 */
export async function getAnalyzedTransactionIds(
  tenantId: string,
  transactionIds: string[]
): Promise<Set<string>> {
  const supabase = await createServiceClient()

  // Query existing analysis results
  const { data, error } = await supabase
    .from('forensic_analysis_results')
    .select('transaction_id')
    .eq('tenant_id', tenantId)
    .in('transaction_id', transactionIds)

  if (error) {
    console.warn('Failed to check analyzed transactions:', error)
    return new Set() // Return empty set on error (will re-analyze)
  }

  // Return set of analyzed IDs
  return new Set(data.map(r => r.transaction_id))
}

/**
 * Filter out already-analyzed transactions
 *
 * @param tenantId - Tenant ID
 * @param transactions - All transactions
 * @param forceReanalyze - If true, ignore cache and analyze all
 * @returns Transactions that need analysis
 */
export async function filterUnanalyzedTransactions<T extends { transactionID?: string }>(
  tenantId: string,
  transactions: T[],
  forceReanalyze: boolean = false
): Promise<{
  unanalyzed: T[]
  alreadyAnalyzed: T[]
  cacheHitRate: number
}> {
  if (forceReanalyze) {
    return {
      unanalyzed: transactions,
      alreadyAnalyzed: [],
      cacheHitRate: 0,
    }
  }

  // Extract transaction IDs
  const transactionIds = transactions
    .map(t => t.transactionID)
    .filter(Boolean) as string[]

  if (transactionIds.length === 0) {
    return {
      unanalyzed: transactions,
      alreadyAnalyzed: [],
      cacheHitRate: 0,
    }
  }

  // Get already-analyzed IDs
  const analyzedIds = await getAnalyzedTransactionIds(tenantId, transactionIds)

  // Split into analyzed and unanalyzed
  const unanalyzed: T[] = []
  const alreadyAnalyzed: T[] = []

  transactions.forEach(txn => {
    if (txn.transactionID && analyzedIds.has(txn.transactionID)) {
      alreadyAnalyzed.push(txn)
    } else {
      unanalyzed.push(txn)
    }
  })

  const cacheHitRate = transactions.length > 0
    ? (alreadyAnalyzed.length / transactions.length) * 100
    : 0

  console.log(`Cache hit rate: ${cacheHitRate.toFixed(1)}% (${alreadyAnalyzed.length}/${transactions.length} already analyzed)`)

  return {
    unanalyzed,
    alreadyAnalyzed,
    cacheHitRate,
  }
}

/**
 * Calculate optimal batch size based on:
 * - API rate limits (15/minute for Gemini free tier)
 * - Recent performance metrics
 * - Available budget
 */
export function calculateOptimalBatchSize(config: {
  rateLimit: number // Requests per minute
  avgProcessingTimeMs: number // Average time per transaction
  targetUtilization: number // 0-1, how much of rate limit to use
  maxBatchSize: number // Hard limit
  minBatchSize: number // Hard minimum
}): number {
  const {
    rateLimit,
    avgProcessingTimeMs,
    targetUtilization = 0.8,
    maxBatchSize = 100,
    minBatchSize = 10,
  } = config

  // Calculate how many requests we can make per minute at target utilization
  const targetRequestsPerMinute = rateLimit * targetUtilization

  // Calculate batch size based on processing time
  // If each transaction takes 4 seconds, we can do 15 per minute
  const transactionsPerMinute = 60000 / avgProcessingTimeMs

  // Use whichever is more conservative
  const calculated = Math.floor(Math.min(targetRequestsPerMinute, transactionsPerMinute))

  // Clamp to bounds
  return Math.max(minBatchSize, Math.min(calculated, maxBatchSize))
}

/**
 * Calculate ETA (Estimated Time of Arrival) for analysis completion
 */
export function calculateETA(
  transactionsAnalyzed: number,
  totalTransactions: number,
  startTime: Date,
  currentTime: Date = new Date()
): {
  eta: Date | null
  remainingMinutes: number | null
  percentComplete: number
  avgTimePerTransaction: number
} {
  const percentComplete = totalTransactions > 0
    ? (transactionsAnalyzed / totalTransactions) * 100
    : 0

  if (transactionsAnalyzed === 0 || transactionsAnalyzed >= totalTransactions) {
    return {
      eta: null,
      remainingMinutes: null,
      percentComplete,
      avgTimePerTransaction: 0,
    }
  }

  // Calculate average time per transaction
  const elapsedMs = currentTime.getTime() - startTime.getTime()
  const avgTimePerTransaction = elapsedMs / transactionsAnalyzed

  // Estimate remaining time
  const remainingTransactions = totalTransactions - transactionsAnalyzed
  const remainingMs = avgTimePerTransaction * remainingTransactions

  // Calculate ETA
  const eta = new Date(currentTime.getTime() + remainingMs)
  const remainingMinutes = remainingMs / 60000

  return {
    eta,
    remainingMinutes,
    percentComplete,
    avgTimePerTransaction,
  }
}

/**
 * Format ETA for display
 */
export function formatETA(eta: Date | null, remainingMinutes: number | null): string {
  if (!eta || !remainingMinutes) {
    return 'Calculating...'
  }

  if (remainingMinutes < 1) {
    return 'Less than 1 minute'
  } else if (remainingMinutes < 60) {
    return `~${Math.round(remainingMinutes)} minutes`
  } else {
    const hours = Math.floor(remainingMinutes / 60)
    const minutes = Math.round(remainingMinutes % 60)
    return `~${hours}h ${minutes}m`
  }
}

/**
 * Resume analysis from last checkpoint
 *
 * Finds the last batch that was successfully completed and continues from there.
 */
export async function getResumeCheckpoint(tenantId: string): Promise<{
  lastAnalyzedCount: number
  canResume: boolean
  startFromBatch: number
}> {
  const supabase = await createServiceClient()

  // Count how many transactions have been analyzed
  const { count, error } = await supabase
    .from('forensic_analysis_results')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('Failed to get resume checkpoint:', error)
    return {
      lastAnalyzedCount: 0,
      canResume: false,
      startFromBatch: 0,
    }
  }

  const lastAnalyzedCount = count || 0
  const canResume = lastAnalyzedCount > 0

  return {
    lastAnalyzedCount,
    canResume,
    startFromBatch: 0, // We'll calculate this based on batch size
  }
}

/**
 * Budget monitor - check if analysis will exceed budget
 */
export interface BudgetConfig {
  maxCostUSD: number
  warnThresholdPercent: number // Warn at this % of budget (e.g., 80)
  hardStopEnabled: boolean // Stop analysis if budget exceeded
}

export async function checkBudget(
  tenantId: string,
  estimatedAdditionalCost: number,
  config: BudgetConfig
): Promise<{
  withinBudget: boolean
  currentSpend: number
  remainingBudget: number
  warningTriggered: boolean
  message?: string
}> {
  const supabase = await createServiceClient()

  // Get current spend
  const { data, error } = await supabase
    .from('ai_analysis_costs')
    .select('estimated_cost_usd')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('Failed to check budget:', error)
    return {
      withinBudget: true, // Fail open
      currentSpend: 0,
      remainingBudget: config.maxCostUSD,
      warningTriggered: false,
    }
  }

  const currentSpend = data.reduce(
    (sum, record) => sum + parseFloat(record.estimated_cost_usd || '0'),
    0
  )
  const projectedSpend = currentSpend + estimatedAdditionalCost
  const remainingBudget = config.maxCostUSD - currentSpend
  const warnThreshold = config.maxCostUSD * (config.warnThresholdPercent / 100)

  const withinBudget = !config.hardStopEnabled || projectedSpend <= config.maxCostUSD
  const warningTriggered = projectedSpend >= warnThreshold

  let message: string | undefined
  if (!withinBudget) {
    message = `Budget exceeded: $${projectedSpend.toFixed(2)} > $${config.maxCostUSD.toFixed(2)}`
  } else if (warningTriggered) {
    message = `Budget warning: $${projectedSpend.toFixed(2)} / $${config.maxCostUSD.toFixed(2)} (${((projectedSpend / config.maxCostUSD) * 100).toFixed(0)}%)`
  }

  return {
    withinBudget,
    currentSpend,
    remainingBudget,
    warningTriggered,
    message,
  }
}

/**
 * Performance metrics for auto-tuning
 */
export interface PerformanceMetrics {
  avgTransactionTimeMs: number
  totalTransactionsProcessed: number
  successRate: number
  lastBatchTimestamp: Date
}

/**
 * Track performance metrics for batch processing
 */
export class PerformanceTracker {
  private metrics: {
    startTime: Date
    transactionsProcessed: number
    batchTimes: number[]
    errors: number
  }

  constructor() {
    this.metrics = {
      startTime: new Date(),
      transactionsProcessed: 0,
      batchTimes: [],
      errors: 0,
    }
  }

  /**
   * Record a completed batch
   */
  recordBatch(transactionCount: number, durationMs: number, hadError: boolean = false) {
    this.metrics.transactionsProcessed += transactionCount
    this.metrics.batchTimes.push(durationMs)
    if (hadError) {
      this.metrics.errors++
    }

    // Keep only last 10 batch times for rolling average
    if (this.metrics.batchTimes.length > 10) {
      this.metrics.batchTimes.shift()
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const avgBatchTime =
      this.metrics.batchTimes.length > 0
        ? this.metrics.batchTimes.reduce((a, b) => a + b, 0) / this.metrics.batchTimes.length
        : 0

    // Estimate avg time per transaction from batch times
    const avgTransactionTimeMs = avgBatchTime > 0 ? avgBatchTime / 50 : 4000 // Default 4s

    const successRate =
      this.metrics.batchTimes.length > 0
        ? (this.metrics.batchTimes.length - this.metrics.errors) / this.metrics.batchTimes.length
        : 1

    return {
      avgTransactionTimeMs,
      totalTransactionsProcessed: this.metrics.transactionsProcessed,
      successRate,
      lastBatchTimestamp: new Date(),
    }
  }

  /**
   * Suggest optimal batch size based on performance
   */
  suggestBatchSize(config: {
    rateLimit: number
    maxBatchSize: number
    minBatchSize: number
  }): number {
    const metrics = this.getMetrics()

    return calculateOptimalBatchSize({
      rateLimit: config.rateLimit,
      avgProcessingTimeMs: metrics.avgTransactionTimeMs,
      targetUtilization: 0.8,
      maxBatchSize: config.maxBatchSize,
      minBatchSize: config.minBatchSize,
    })
  }
}

/**
 * Enhanced progress with ETA and caching stats
 */
export interface EnhancedProgress extends AnalysisProgress {
  eta: Date | null
  remainingMinutes: number | null
  cacheHitRate: number
  avgTimePerTransaction: number
  currentBatchSize: number
  budgetRemaining: number
}
