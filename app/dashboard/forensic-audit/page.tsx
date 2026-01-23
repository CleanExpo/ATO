/**
 * Forensic Tax Audit - Vertical Data Stream Design
 *
 * Cyber-physical aesthetic with vertical node layout
 * No boxes, no carousels - just floating nodes connected by a glowing line
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

    setProgress(p => ({ ...p, stage: 'syncing' }))
    setIsPolling(true)

    try {
      await fetch('/api/audit/sync-historical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, years: 5 })
      })

      pollUntilComplete()
    } catch (err) {
      console.error('Failed to start:', err)
      setProgress(p => ({ ...p, stage: 'error', error: 'Failed to start sync' }))
    }
  }

  async function pollUntilComplete() {
    if (!tenantId) return

    const poll = async () => {
      try {
        const syncRes = await fetch(`/api/audit/sync-status/${tenantId}`)
        const syncData = await syncRes.json()

        if (syncData.status === 'complete') {
          setProgress(p => ({ ...p, stage: 'analyzing' }))
          await fetch('/api/audit/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId })
          })
          pollAnalysis()
        } else {
          setProgress(p => ({
            ...p,
            syncProgress: syncData.progress || 0,
            transactionsSynced: syncData.transactionsSynced || 0,
            totalTransactions: syncData.totalEstimated || p.totalTransactions
          }))
          setTimeout(poll, 3000)
        }
      } catch (err) {
        console.error('Polling error:', err)
        setTimeout(poll, 5000)
      }
    }

    poll()
  }

  async function pollAnalysis() {
    if (!tenantId) return

    const poll = async () => {
      try {
        const analysisRes = await fetch(`/api/audit/analysis-status/${tenantId}`)
        const analysisData = await analysisRes.json()

        if (analysisData.status === 'complete') {
          const recRes = await fetch(`/api/audit/recommendations?tenantId=${tenantId}`)
          const recData = await recRes.json()

          setProgress(p => ({
            ...p,
            stage: 'complete',
            analysisProgress: 100,
            transactionsAnalyzed: analysisData.transactionsAnalyzed || 0,
            totalBenefit: recData.summary?.totalAdjustedBenefit || 0
          }))
          setIsPolling(false)
        } else {
          setProgress(p => ({
            ...p,
            analysisProgress: analysisData.progress || 0,
            transactionsAnalyzed: analysisData.transactionsAnalyzed || 0
          }))
          setTimeout(poll, 5000)
        }
      } catch (err) {
        console.error('Analysis polling error:', err)
        setTimeout(poll, 5000)
      }
    }

    poll()
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
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 relative overflow-hidden">

      {/* Ambient Background Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="text-center mb-16 relative z-10">
        <h1 className="text-3xl md:text-4xl font-light tracking-[0.3em] text-white/90 uppercase mb-3">
          Forensic Audit
        </h1>
        <p className="text-sm tracking-[0.2em] text-cyan-400/60 uppercase">
          AI-Powered Tax Intelligence
        </p>
      </div>

      {/* Vertical Data Stream */}
      <div className="relative z-10 flex flex-col items-center">

        {/* The Glowing Vertical Line */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px">
          <div className="w-full h-full bg-gradient-to-b from-cyan-400/80 via-teal-400/40 to-teal-400/10" />
          {/* Animated pulse on the line */}
          {(progress.stage === 'syncing' || progress.stage === 'analyzing') && (
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-cyan-400 to-transparent animate-pulse-down" />
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
          <div className="inline-flex items-center gap-3 px-6 py-3 border border-cyan-500/20 bg-cyan-500/5">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs tracking-[0.15em] text-cyan-400/80 uppercase font-mono">
              {progress.stage === 'syncing' ? 'Data Stream Active' : 'Neural Processing'}
            </span>
          </div>
          <p className="text-xs text-white/30 mt-4 tracking-wide">
            Process runs in background. Safe to navigate away.
          </p>
        </div>
      )}

      {/* Completion State */}
      {progress.stage === 'complete' && (
        <div className="mt-16 relative z-10 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 border border-emerald-500/30 bg-emerald-500/5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs tracking-[0.15em] text-emerald-400/80 uppercase font-mono">
              Analysis Complete
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {progress.stage === 'error' && (
        <div className="mt-16 relative z-10 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 border border-red-500/30 bg-red-500/5">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs tracking-[0.15em] text-red-400/80 uppercase font-mono">
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
      <div className={`
        absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full transition-all duration-300
        ${isActive ? 'bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)]' : ''}
        ${isComplete ? 'bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)]' : ''}
        ${isInactive ? 'bg-white/20 border border-white/10' : ''}
      `} />

      {/* Left Content */}
      <div className="w-48 text-right pr-8">
        <div className={`
          flex items-center justify-end gap-3 mb-2
          ${isActive ? 'text-white' : isComplete ? 'text-emerald-400/80' : 'text-white/40'}
        `}>
          <span className="text-sm tracking-[0.2em] font-medium uppercase">{label}</span>
          <div className={isActive ? 'text-cyan-400' : isComplete ? 'text-emerald-400' : 'text-white/30'}>
            {isComplete ? <CheckCircle2 className="w-5 h-5" /> : icon}
          </div>
        </div>
        <p className={`
          text-xs tracking-wide
          ${isActive ? 'text-white/60' : 'text-white/30'}
        `}>
          {sublabel}
        </p>

        {/* Progress indicator */}
        {progress !== undefined && isActive && (
          <div className="mt-3 h-px bg-white/10 w-full">
            <div
              className="h-full bg-cyan-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
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
            className={`
              group relative px-6 py-2.5 font-mono text-xs tracking-[0.15em] uppercase
              transition-all duration-200 border
              ${highlight
                ? 'border-emerald-400/50 text-emerald-400 hover:bg-emerald-400 hover:text-black'
                : 'border-white/30 text-white/80 hover:bg-white hover:text-black hover:border-white'
              }
            `}
          >
            <span className="relative z-10">[ {actionLabel} ]</span>
          </button>
        )}
      </div>
    </div>
  )
}
