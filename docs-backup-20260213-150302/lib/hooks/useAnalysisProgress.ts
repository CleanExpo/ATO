/**
 * useAnalysisProgress Hook
 *
 * Custom hook for tracking analysis progress with enhanced state management,
 * adaptive polling, time estimates, and batch history.
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Types ───────────────────────────────────────────────────────────

export type AnalysisStage = 'idle' | 'syncing' | 'analyzing' | 'complete' | 'error'

export interface BatchInfo {
  number: number
  total: number
  transactionsInBatch: number
  successCount: number
  failureCount: number
}

export interface TimeEstimate {
  startedAt: Date | null
  elapsedMs: number
  remainingMs: number | null
  averageBatchTimeMs: number | null
}

export interface LiveStats {
  totalAnalyzed: number
  rndCandidates: number
  totalDeductions: number
  division7aItems: number
}

export interface BatchActivity {
  timestamp: Date
  batchNumber: number
  analyzedCount: number
  success: boolean
  duration: number
}

export interface AnalysisProgressState {
  stage: AnalysisStage
  overallProgress: number
  syncProgress: number
  batch: BatchInfo | null
  timeEstimate: TimeEstimate
  stats: LiveStats
  recentBatches: BatchActivity[]
  error: string | null
  lastUpdated: Date | null
  isStalled: boolean
  isRateLimited: boolean
}

interface UseAnalysisProgressOptions {
  pollingIntervalActive?: number  // ms, default 2000
  pollingIntervalIdle?: number    // ms, default 10000
  stalledThresholdMs?: number     // ms, default 120000 (2 minutes)
}

// ─── API Response Types ──────────────────────────────────────────────

interface SyncStatusResponse {
  status: string  // 'idle' | 'syncing' | 'complete' | 'error'
  progress?: number
  transactionsSynced?: number
  totalEstimated?: number
}

interface AnalysisStatusResponse {
  status: string  // 'idle' | 'analyzing' | 'complete' | 'error'
  progress: number
  transactionsAnalyzed: number
  totalTransactions: number
  currentBatch: number
  totalBatches: number
  estimatedCostUSD: number
  errorMessage?: string
  eta?: string
  // Enhanced fields (added by this plan)
  lastBatchTime?: number
  averageBatchTime?: number
  rndCandidates?: number
  totalDeductions?: number
  division7aItems?: number
}

// ─── Hook Implementation ─────────────────────────────────────────────

export function useAnalysisProgress(
  tenantId: string | null,
  options: UseAnalysisProgressOptions = {}
): AnalysisProgressState & {
  refetch: () => Promise<void>
  startPolling: () => void
  stopPolling: () => void
} {
  const {
    pollingIntervalActive = 2000,
    pollingIntervalIdle = 10000,
    stalledThresholdMs = 120000,
  } = options

  // State
  const [state, setState] = useState<AnalysisProgressState>({
    stage: 'idle',
    overallProgress: 0,
    syncProgress: 0,
    batch: null,
    timeEstimate: {
      startedAt: null,
      elapsedMs: 0,
      remainingMs: null,
      averageBatchTimeMs: null,
    },
    stats: {
      totalAnalyzed: 0,
      rndCandidates: 0,
      totalDeductions: 0,
      division7aItems: 0,
    },
    recentBatches: [],
    error: null,
    lastUpdated: null,
    isStalled: false,
    isRateLimited: false,
  })

  // Refs for tracking
  const isPollingRef = useRef(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startedAtRef = useRef<Date | null>(null)
  const lastBatchNumberRef = useRef<number>(0)
  const batchTimesRef = useRef<number[]>([])
  const lastProgressTimeRef = useRef<Date | null>(null)

  // Fetch current status
  const fetchStatus = useCallback(async () => {
    if (!tenantId) return

    try {
      const [syncRes, analysisRes] = await Promise.all([
        fetch(`/api/audit/sync-status/${tenantId}`),
        fetch(`/api/audit/analysis-status/${tenantId}`),
      ])

      const syncData: SyncStatusResponse = await syncRes.json()
      const analysisData: AnalysisStatusResponse = await analysisRes.json()

      // Determine stage
      let stage: AnalysisStage = 'idle'
      if (analysisData.status === 'complete') {
        stage = 'complete'
      } else if (analysisData.status === 'error') {
        stage = 'error'
      } else if (analysisData.status === 'analyzing') {
        stage = 'analyzing'
      } else if (syncData.status === 'syncing') {
        stage = 'syncing'
      } else if (syncData.status === 'complete' && analysisData.status !== 'complete') {
        stage = 'analyzing'
      }

      // Track batch completion
      const now = new Date()
      let newBatches = [...state.recentBatches]

      if (analysisData.currentBatch > lastBatchNumberRef.current && lastBatchNumberRef.current > 0) {
        // A new batch completed
        const batchDuration = lastProgressTimeRef.current
          ? now.getTime() - lastProgressTimeRef.current.getTime()
          : 4000 // Default estimate

        // Add to batch times for averaging
        batchTimesRef.current.push(batchDuration)
        if (batchTimesRef.current.length > 10) {
          batchTimesRef.current.shift()
        }

        // Add to recent batches
        newBatches.unshift({
          timestamp: now,
          batchNumber: analysisData.currentBatch - 1,
          analyzedCount: 25, // Default batch size
          success: true,
          duration: batchDuration,
        })

        // Keep only last 10 batches
        if (newBatches.length > 10) {
          newBatches = newBatches.slice(0, 10)
        }
      }

      lastBatchNumberRef.current = analysisData.currentBatch
      lastProgressTimeRef.current = now

      // Calculate time estimates
      let startedAt = startedAtRef.current
      if ((stage === 'syncing' || stage === 'analyzing') && !startedAt) {
        startedAt = now
        startedAtRef.current = startedAt
      }

      const elapsedMs = startedAt ? now.getTime() - startedAt.getTime() : 0

      // Calculate average batch time
      const avgBatchTime = batchTimesRef.current.length > 0
        ? batchTimesRef.current.reduce((a, b) => a + b, 0) / batchTimesRef.current.length
        : analysisData.averageBatchTime || 4000

      // Calculate remaining time
      let remainingMs: number | null = null
      if (stage === 'analyzing' && analysisData.totalBatches > 0) {
        const remainingBatches = analysisData.totalBatches - analysisData.currentBatch
        remainingMs = remainingBatches * avgBatchTime
        // Add 20% buffer
        remainingMs = Math.round(remainingMs * 1.2)
      }

      // Check if stalled
      const timeSinceLastUpdate = lastProgressTimeRef.current
        ? now.getTime() - lastProgressTimeRef.current.getTime()
        : 0
      const isStalled = stage === 'analyzing' && timeSinceLastUpdate > stalledThresholdMs

      // Check for rate limiting (error message contains rate limit)
      const isRateLimited = analysisData.errorMessage?.toLowerCase().includes('rate') || false

      // Fetch live stats if analyzing or complete
      let stats = state.stats
      if (stage === 'analyzing' || stage === 'complete') {
        try {
          const statsRes = await fetch(`/api/audit/analysis-results?tenantId=${tenantId}&pageSize=1`)
          const statsData = await statsRes.json()
          if (statsData.summary) {
            stats = {
              totalAnalyzed: statsData.summary.total || analysisData.transactionsAnalyzed,
              rndCandidates: statsData.summary.rnd?.candidates || analysisData.rndCandidates || 0,
              totalDeductions: statsData.summary.deductions?.totalClaimableAmount || analysisData.totalDeductions || 0,
              division7aItems: statsData.summary.compliance?.division7aRisk || analysisData.division7aItems || 0,
            }
          }
        } catch (err) {
          console.error('Failed to fetch live stats:', err)
        }
      }

      setState({
        stage,
        overallProgress: analysisData.progress || 0,
        syncProgress: syncData.progress || 0,
        batch: analysisData.currentBatch > 0 ? {
          number: analysisData.currentBatch,
          total: analysisData.totalBatches,
          transactionsInBatch: 25,
          successCount: 0,
          failureCount: 0,
        } : null,
        timeEstimate: {
          startedAt,
          elapsedMs,
          remainingMs,
          averageBatchTimeMs: avgBatchTime,
        },
        stats,
        recentBatches: newBatches,
        error: analysisData.errorMessage || null,
        lastUpdated: now,
        isStalled,
        isRateLimited,
      })

      // Reset started time if complete
      if (stage === 'complete' || stage === 'idle') {
        startedAtRef.current = null
        batchTimesRef.current = []
        lastBatchNumberRef.current = 0
      }

    } catch (err) {
      console.error('Failed to fetch analysis status:', err)
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to fetch status',
        lastUpdated: new Date(),
      }))
    }
  }, [tenantId, state.recentBatches, state.stats, stalledThresholdMs])

  // Start polling
  const startPolling = useCallback(() => {
    if (isPollingRef.current) return
    isPollingRef.current = true

    // Initial fetch
    fetchStatus()

    // Set up interval
    const interval = state.stage === 'syncing' || state.stage === 'analyzing'
      ? pollingIntervalActive
      : pollingIntervalIdle

    pollingIntervalRef.current = setInterval(fetchStatus, interval)
  }, [fetchStatus, state.stage, pollingIntervalActive, pollingIntervalIdle])

  // Stop polling
  const stopPolling = useCallback(() => {
    isPollingRef.current = false
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  // Auto-adjust polling interval based on stage
  useEffect(() => {
    if (!isPollingRef.current) return

    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    // Set new interval based on stage
    const interval = state.stage === 'syncing' || state.stage === 'analyzing'
      ? pollingIntervalActive
      : pollingIntervalIdle

    pollingIntervalRef.current = setInterval(fetchStatus, interval)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [state.stage, fetchStatus, pollingIntervalActive, pollingIntervalIdle])

  // Initial fetch when tenantId changes
  useEffect(() => {
    if (tenantId) {
      fetchStatus()
    }
  }, [tenantId, fetchStatus])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  return {
    ...state,
    refetch: fetchStatus,
    startPolling,
    stopPolling,
  }
}

export default useAnalysisProgress
