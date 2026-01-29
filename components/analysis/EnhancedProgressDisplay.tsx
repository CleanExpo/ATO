/**
 * Enhanced Analysis Progress Display
 *
 * Shows optimized analysis progress with:
 * - ETA (Estimated Time of Arrival)
 * - Cache hit rate
 * - Budget monitoring
 * - Auto-tuning status
 * - Performance metrics
 */

'use client'

import { useEffect, useState } from 'react'
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  DollarSign,
  Database,
  TrendingUp,
} from 'lucide-react'
import type { EnhancedProgress } from '@/lib/ai/analysis-optimizer'
import { formatETA } from '@/lib/ai/analysis-optimizer'

interface EnhancedProgressDisplayProps {
  tenantId: string
  refreshIntervalMs?: number
  onComplete?: () => void
}

export function EnhancedProgressDisplay({
  tenantId,
  refreshIntervalMs = 5000,
  onComplete,
}: EnhancedProgressDisplayProps) {
  const [progress, setProgress] = useState<EnhancedProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/audit/analysis-status/${tenantId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch progress')
        }

        setProgress(data as EnhancedProgress)
        setIsLoading(false)

        // Trigger completion callback
        if (data.status === 'complete' && onComplete) {
          onComplete()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setIsLoading(false)
      }
    }

    // Initial fetch
    fetchProgress()

    // Poll for updates
    const interval = setInterval(fetchProgress, refreshIntervalMs)

    return () => clearInterval(interval)
  }, [tenantId, refreshIntervalMs, onComplete])

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-primary)]" />
          <p className="text-[var(--text-secondary)]">Loading analysis status...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-card p-6 border-l-4 border-l-red-500 bg-red-500/5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-400 mb-1">Failed to Load Progress</p>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!progress) {
    return (
      <div className="glass-card p-6">
        <p className="text-[var(--text-secondary)]">No analysis in progress</p>
      </div>
    )
  }

  const { status, transactionsAnalyzed, totalTransactions, eta, remainingMinutes, cacheHitRate, currentBatchSize, budgetRemaining } = progress

  const isAnalyzing = status === 'analyzing'
  const isComplete = status === 'complete'
  const hasError = status === 'error'

  return (
    <div className="space-y-4">
      {/* Main Progress Card */}
      <div className="glass-card p-6">
        {/* Status Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {isAnalyzing && <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />}
            {isComplete && <CheckCircle2 className="w-6 h-6 text-green-400" />}
            {hasError && <AlertCircle className="w-6 h-6 text-red-400" />}

            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {isAnalyzing && 'Analysis in Progress'}
                {isComplete && 'Analysis Complete'}
                {hasError && 'Analysis Failed'}
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {transactionsAnalyzed.toLocaleString()} / {totalTransactions.toLocaleString()} transactions
              </p>
            </div>
          </div>

          {isAnalyzing && eta && (
            <div className="text-right">
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <Clock className="w-4 h-4" />
                <span className="text-sm">ETA</span>
              </div>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {formatETA(eta, remainingMinutes)}
              </p>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--text-secondary)]">Progress</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {progress.progress.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-[var(--void-elevated)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>

        {/* Error Message */}
        {progress.errorMessage && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{progress.errorMessage}</p>
          </div>
        )}
      </div>

      {/* Optimization Metrics */}
      {(isAnalyzing || isComplete) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Cache Hit Rate */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-[var(--accent-primary)]" />
              <h4 className="text-sm font-medium text-[var(--text-secondary)]">Cache Hit Rate</h4>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {cacheHitRate !== undefined ? `${cacheHitRate.toFixed(1)}%` : 'N/A'}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {cacheHitRate !== undefined && cacheHitRate > 0
                ? `Saved ${Math.round((cacheHitRate / 100) * totalTransactions)} transactions`
                : 'No cache hits'}
            </p>
          </div>

          {/* Auto-Tuning */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-medium text-[var(--text-secondary)]">Batch Size</h4>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {currentBatchSize || 50}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Auto-tuned for performance</p>
          </div>

          {/* Budget Remaining */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <h4 className="text-sm font-medium text-[var(--text-secondary)]">Budget Remaining</h4>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              ${budgetRemaining !== undefined ? budgetRemaining.toFixed(2) : '0.00'}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Cost: ${progress.estimatedCostUSD.toFixed(4)}
            </p>
          </div>

          {/* Performance */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <h4 className="text-sm font-medium text-[var(--text-secondary)]">Performance</h4>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {progress.avgTimePerTransaction !== undefined
                ? `${(progress.avgTimePerTransaction / 1000).toFixed(1)}s`
                : 'N/A'}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Per transaction</p>
          </div>
        </div>
      )}

      {/* Batch Progress (for analyzing status) */}
      {isAnalyzing && progress.currentBatch > 0 && progress.totalBatches > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">
              Batch {progress.currentBatch} of {progress.totalBatches}
            </span>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {Math.round((progress.currentBatch / progress.totalBatches) * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
