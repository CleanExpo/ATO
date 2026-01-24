/**
 * Forensic Tax Audit - Vertical Data Stream Design
 *
 * Clean aesthetic with vertical node layout matching lavender theme
 * Floating nodes connected by a glowing line
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Zap,
  Cpu,
  FileSearch,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { DynamicIsland, VerticalNav } from '@/components/ui/DynamicIsland'
import { MobileNav } from '@/components/ui/MobileNav'

type Stage = 'idle' | 'syncing' | 'analyzing' | 'complete' | 'error'

interface ProgressData {
  stage: Stage
  syncProgress: number
  analysisProgress: number
  transactionsSynced: number
  transactionsAnalyzed: number
  totalTransactions: number
  totalBenefit: number
  error?: string
}

export default function ForensicAuditPage() {
  const router = useRouter()
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressData>({
    stage: 'idle',
    syncProgress: 0,
    analysisProgress: 0,
    transactionsSynced: 0,
    transactionsAnalyzed: 0,
    totalTransactions: 0,
    totalBenefit: 0
  })
  const [isPolling, setIsPolling] = useState(false)

  // Fetch tenant ID on mount
  useEffect(() => {
    fetchTenantId()
  }, [])

  // Check current status when tenant loaded
  useEffect(() => {
    if (tenantId) {
      checkCurrentStatus()
    }
  }, [tenantId])

  async function fetchTenantId() {
    try {
      const response = await fetch('/api/xero/organizations')
      const data = await response.json()
      if (data.connections && data.connections.length > 0) {
        setTenantId(data.connections[0].tenant_id)
      }
    } catch (err) {
      console.error('Failed to fetch tenant ID:', err)
    }
  }

  const checkCurrentStatus = useCallback(async () => {
    if (!tenantId) return

    try {
      const [syncRes, analysisRes, recRes] = await Promise.all([
        fetch(`/api/audit/sync-status/${tenantId}`),
        fetch(`/api/audit/analysis-status/${tenantId}`),
        fetch(`/api/audit/recommendations?tenantId=${tenantId}`)
      ])

      const syncData = await syncRes.json()
      const analysisData = await analysisRes.json()
      const recData = await recRes.json()

      let stage: Stage = 'idle'
      if (analysisData.status === 'complete') {
        stage = 'complete'
      } else if (analysisData.status === 'analyzing') {
        stage = 'analyzing'
      } else if (syncData.status === 'syncing') {
        stage = 'syncing'
      } else if (syncData.status === 'complete') {
        stage = 'analyzing'
      }

      setProgress({
        stage,
        syncProgress: syncData.progress || 0,
        analysisProgress: analysisData.progress || 0,
        transactionsSynced: syncData.transactionsSynced || 0,
        transactionsAnalyzed: analysisData.transactionsAnalyzed || 0,
        totalTransactions: syncData.totalEstimated || analysisData.totalTransactions || 12000,
        totalBenefit: recData.summary?.totalAdjustedBenefit || 0
      })
    } catch (err) {
      console.error('Failed to check status:', err)
    }
  }, [tenantId])

  // Polling for progress updates
  useEffect(() => {
    if (!isPolling || !tenantId) return

    const interval = setInterval(checkCurrentStatus, 5000)
    return () => clearInterval(interval)
  }, [isPolling, tenantId, checkCurrentStatus])

  async function handleStart() {
    if (!tenantId) return

    setProgress(p => ({ ...p, stage: 'syncing', syncProgress: 0 }))
    setIsPolling(true)

    // Use chunked sync - call repeatedly until complete
    runChunkedSync()
  }

  async function runChunkedSync() {
    if (!tenantId) return

    let year: string | null = null
    let type: string | null = null
    let page = 1
    let totalSynced = 0

    const syncChunk = async () => {
      try {
        const body: Record<string, unknown> = { tenantId }
        if (year) body.year = year
        if (type) body.type = type
        if (page > 1) body.page = page

        const res = await fetch('/api/audit/sync-chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })

        const data = await res.json()

        if (!res.ok) {
          console.error('Sync chunk error:', data)
          setProgress(p => ({ ...p, stage: 'error', error: data.message || 'Sync failed' }))
          return
        }

        totalSynced += data.cached || 0

        // Update progress
        setProgress(p => ({
          ...p,
          syncProgress: data.allComplete ? 100 : (data.currentProgress ?
            Math.min(95, ((5 - getYearIndex(data.currentProgress.year)) / 5) * 100) : p.syncProgress),
          transactionsSynced: totalSynced
        }))

        if (data.allComplete) {
          // Sync done, start analysis
          console.log('Sync complete, starting analysis...')
          setProgress(p => ({ ...p, stage: 'analyzing', syncProgress: 100 }))
          runChunkedAnalysis()
        } else {
          // Continue with next chunk
          year = data.nextYear
          type = data.nextType
          page = data.hasMore ? data.nextPage : 1

          // Small delay to avoid rate limits
          setTimeout(syncChunk, 500)
        }
      } catch (err) {
        console.error('Sync chunk error:', err)
        // Retry on network errors
        setTimeout(syncChunk, 2000)
      }
    }

    syncChunk()
  }

  function getYearIndex(year: string): number {
    const match = year.match(/FY(\d{2})-(\d{2})/)
    if (!match) return 0
    return parseInt(match[1]) - 20 // FY24-25 = 4, FY23-24 = 3, etc.
  }

  async function runChunkedAnalysis() {
    if (!tenantId) return

    let offset = 0
    const batchSize = 25
    let totalAnalyzed = 0

    const analyzeChunk = async () => {
      try {
        const res = await fetch('/api/audit/analyze-chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, offset, batchSize })
        })

        const data = await res.json()

        if (!res.ok) {
          console.error('Analysis chunk error:', data)
          // Don't fail on individual chunk errors, continue
          if (data.error?.includes('No unanalyzed transactions')) {
            // Analysis complete
            await finishAnalysis()
            return
          }
          // Retry this chunk
          setTimeout(analyzeChunk, 3000)
          return
        }

        totalAnalyzed += data.analyzed || 0

        setProgress(p => ({
          ...p,
          analysisProgress: data.progress || Math.min(95, (totalAnalyzed / (data.remaining + totalAnalyzed)) * 100),
          transactionsAnalyzed: totalAnalyzed
        }))

        if (data.remaining === 0 || data.isComplete) {
          await finishAnalysis()
        } else {
          // Continue with next chunk
          offset += batchSize
          // Delay to respect Gemini rate limits (15 req/min free tier)
          setTimeout(analyzeChunk, 4500)
        }
      } catch (err) {
        console.error('Analysis chunk error:', err)
        setTimeout(analyzeChunk, 5000)
      }
    }

    analyzeChunk()
  }

  async function finishAnalysis() {
    if (!tenantId) return

    try {
      const recRes = await fetch(`/api/audit/recommendations?tenantId=${tenantId}`)
      const recData = await recRes.json()

      setProgress(p => ({
        ...p,
        stage: 'complete',
        analysisProgress: 100,
        totalBenefit: recData.summary?.totalAdjustedBenefit || 0
      }))
      setIsPolling(false)
    } catch (err) {
      console.error('Failed to get recommendations:', err)
      setProgress(p => ({ ...p, stage: 'complete', analysisProgress: 100 }))
      setIsPolling(false)
    }
  }

  function goToAdvanced() {
    router.push('/dashboard/forensic-audit/advanced')
  }

  // Determine node states
  const getNodeState = (node: 1 | 2 | 3) => {
    const { stage } = progress

    if (node === 1) {
      if (stage === 'idle') return 'active'
      return 'complete'
    }
    if (node === 2) {
      if (stage === 'syncing' || stage === 'analyzing') return 'active'
      if (stage === 'complete') return 'complete'
      return 'inactive'
    }
    if (node === 3) {
      if (stage === 'complete') return 'active'
      return 'inactive'
    }
    return 'inactive'
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Navigation */}
      <DynamicIsland showLogo />
      <VerticalNav />

      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>

        {/* Ambient Background Glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-3xl" style={{ background: 'var(--accent-primary-glow)' }} />
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full blur-3xl" style={{ background: 'var(--color-success-dim)' }} />
        </div>

        {/* Header */}
        <div className="text-center mb-16 relative z-10">
          <h1 className="typo-display" style={{ letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 'var(--space-sm)' }}>
            Forensic Audit
          </h1>
          <p style={{ fontSize: '0.875rem', letterSpacing: '0.1em', color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
            AI-Powered Tax Intelligence
          </p>
        </div>

      {/* Vertical Data Stream */}
      <div className="relative z-10 flex flex-col items-center">

        {/* The Glowing Vertical Line */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px">
          <div className="w-full h-full" style={{ background: 'linear-gradient(to bottom, var(--accent-primary), var(--accent-tertiary), transparent)' }} />
          {/* Animated pulse on the line */}
          {(progress.stage === 'syncing' || progress.stage === 'analyzing') && (
            <div className="absolute top-0 left-0 w-full h-24 animate-pulse-down" style={{ background: 'linear-gradient(to bottom, var(--accent-primary), transparent)' }} />
          )}
        </div>

        {/* Node 1: INITIATE */}
        <DataNode
          state={getNodeState(1)}
          icon={<Zap className="w-5 h-5" />}
          label="INITIATE"
          sublabel={
            progress.stage === 'idle'
              ? 'Ready to begin 5-year historical sync'
              : progress.transactionsSynced > 0
                ? `${progress.transactionsSynced.toLocaleString()} transactions synced`
                : 'Sync initiated'
          }
          action={progress.stage === 'idle' ? handleStart : undefined}
          actionLabel="INITIATE SYNC"
        />

        {/* Connector */}
        <div className="h-20 md:h-28" />

        {/* Node 2: PROCESS */}
        <DataNode
          state={getNodeState(2)}
          icon={<Cpu className="w-5 h-5" />}
          label="PROCESS"
          sublabel={
            progress.stage === 'syncing'
              ? `Syncing... ${Math.round(progress.syncProgress)}%`
              : progress.stage === 'analyzing'
                ? `Analyzing ${progress.transactionsAnalyzed.toLocaleString()} transactions`
                : 'Awaiting data stream'
          }
          progress={
            progress.stage === 'syncing'
              ? progress.syncProgress
              : progress.stage === 'analyzing'
                ? progress.analysisProgress
                : undefined
          }
        />

        {/* Connector */}
        <div className="h-20 md:h-28" />

        {/* Node 3: OUTPUT */}
        <DataNode
          state={getNodeState(3)}
          icon={<FileSearch className="w-5 h-5" />}
          label="OUTPUT"
          sublabel={
            progress.stage === 'complete'
              ? `$${Math.round(progress.totalBenefit / 1000).toLocaleString()}k in opportunities`
              : 'Awaiting analysis completion'
          }
          action={progress.stage === 'complete' ? goToAdvanced : undefined}
          actionLabel="VIEW REPORT"
          highlight={progress.stage === 'complete'}
        />

      </div>

      {/* Status Readout */}
      {progress.stage !== 'idle' && progress.stage !== 'complete' && (
        <div className="mt-16 relative z-10 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl" style={{ border: '1px solid var(--border-medium)', background: 'var(--accent-primary-dim)' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent-primary)' }} />
            <span className="text-xs tracking-[0.15em] uppercase font-mono" style={{ color: 'var(--accent-primary)' }}>
              {progress.stage === 'syncing' ? 'Data Stream Active' : 'Neural Processing'}
            </span>
          </div>
          <p className="text-xs mt-4 tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Process runs in background. Safe to navigate away.
          </p>
        </div>
      )}

      {/* Completion State */}
      {progress.stage === 'complete' && (
        <div className="mt-16 relative z-10 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl" style={{ border: '1px solid rgba(16, 185, 129, 0.3)', background: 'var(--color-success-dim)' }}>
            <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
            <span className="text-xs tracking-[0.15em] uppercase font-mono" style={{ color: 'var(--color-success)' }}>
              Analysis Complete
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {progress.stage === 'error' && (
        <div className="mt-16 relative z-10 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'var(--color-error-dim)' }}>
            <AlertCircle className="w-4 h-4" style={{ color: 'var(--color-error)' }} />
            <span className="text-xs tracking-[0.15em] uppercase font-mono" style={{ color: 'var(--color-error)' }}>
              {progress.error || 'Process Error'}
            </span>
          </div>
        </div>
      )}

      {/* CSS for pulse animation */}
      <style jsx>{`
        @keyframes pulse-down {
          0% { transform: translateY(-100%); opacity: 1; }
          100% { transform: translateY(400%); opacity: 0; }
        }
        .animate-pulse-down {
          animation: pulse-down 2s ease-in-out infinite;
        }
      `}</style>
      </main>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  )
}

// Data Node Component - Floating text/icon anchored to the vertical line
function DataNode({
  state,
  icon,
  label,
  sublabel,
  action,
  actionLabel,
  progress,
  highlight
}: {
  state: 'inactive' | 'active' | 'complete'
  icon: React.ReactNode
  label: string
  sublabel: string
  action?: () => void
  actionLabel?: string
  progress?: number
  highlight?: boolean
}) {
  const isActive = state === 'active'
  const isComplete = state === 'complete'
  const isInactive = state === 'inactive'

  return (
    <div className={`
      relative flex items-center gap-8 transition-all duration-500
      ${isInactive ? 'opacity-40' : 'opacity-100'}
    `}>

      {/* The Node Marker (on the line) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full transition-all duration-300"
        style={{
          background: isActive ? 'var(--accent-primary)' : isComplete ? 'var(--color-success)' : 'var(--border-medium)',
          boxShadow: isActive ? '0 0 20px var(--accent-primary-glow)' : isComplete ? '0 0 15px var(--color-success-dim)' : 'none'
        }}
      />

      {/* Left Content */}
      <div className="w-48 text-right pr-8">
        <div
          className="flex items-center justify-end gap-3 mb-2"
          style={{ color: isActive ? 'var(--text-primary)' : isComplete ? 'var(--color-success)' : 'var(--text-muted)' }}
        >
          <span className="text-sm tracking-[0.2em] font-medium uppercase">{label}</span>
          <div style={{ color: isActive ? 'var(--accent-primary)' : isComplete ? 'var(--color-success)' : 'var(--text-muted)' }}>
            {isComplete ? <CheckCircle2 className="w-5 h-5" /> : icon}
          </div>
        </div>
        <p
          className="text-xs tracking-wide"
          style={{ color: isActive ? 'var(--text-secondary)' : 'var(--text-muted)' }}
        >
          {sublabel}
        </p>

        {/* Progress indicator */}
        {progress !== undefined && isActive && (
          <div className="mt-3 h-1 w-full rounded-full" style={{ background: 'var(--border-light)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: 'var(--accent-primary)' }}
            />
          </div>
        )}
      </div>

      {/* Spacer for the line */}
      <div className="w-6" />

      {/* Right Content - Action Button */}
      <div className="w-48 pl-8">
        {action && actionLabel && (
          <button
            onClick={action}
            className={highlight ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
