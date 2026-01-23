/**
 * Simplified Forensic Audit Landing Page
 *
 * 3 Simple Cards: Start → Analysis → Report
 * All work happens in background. After Report complete, go to advanced page.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  PlayCircle,
  Loader2,
  FileText,
  CheckCircle2,
  ArrowRight,
  Sparkles
} from 'lucide-react'

type Stage = 'idle' | 'syncing' | 'analyzing' | 'complete'

interface ProgressData {
  stage: Stage
  syncProgress: number
  analysisProgress: number
  transactionsSynced: number
  transactionsAnalyzed: number
  totalTransactions: number
  totalBenefit: number
}

export default function ForensicAuditLanding() {
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
        stage = 'analyzing' // Ready for analysis
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
      // Start historical sync
      await fetch('/api/audit/sync-historical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, years: 5 })
      })

      // Poll until sync complete, then start analysis
      pollUntilComplete()
    } catch (err) {
      console.error('Failed to start:', err)
    }
  }

  async function pollUntilComplete() {
    if (!tenantId) return

    const poll = async () => {
      const syncRes = await fetch(`/api/audit/sync-status/${tenantId}`)
      const syncData = await syncRes.json()

      if (syncData.status === 'complete') {
        // Start analysis
        setProgress(p => ({ ...p, stage: 'analyzing' }))
        await fetch('/api/audit/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId })
        })

        // Poll analysis
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
    }

    poll()
  }

  async function pollAnalysis() {
    if (!tenantId) return

    const poll = async () => {
      const analysisRes = await fetch(`/api/audit/analysis-status/${tenantId}`)
      const analysisData = await analysisRes.json()

      if (analysisData.status === 'complete') {
        // Get final results
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
    }

    poll()
  }

  function goToAdvanced() {
    router.push('/dashboard/forensic-audit/advanced')
  }

  const getStepStatus = (step: number) => {
    const { stage, syncProgress, analysisProgress } = progress

    if (step === 1) {
      if (stage === 'idle') return 'ready'
      return 'complete'
    }
    if (step === 2) {
      if (stage === 'idle') return 'pending'
      if (stage === 'syncing') return 'active'
      if (stage === 'analyzing') return 'active'
      return 'complete'
    }
    if (step === 3) {
      if (stage === 'complete') return 'ready'
      if (stage === 'analyzing' || stage === 'syncing') return 'pending'
      return 'pending'
    }
    return 'pending'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-8">
      <div className="max-w-5xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400 font-medium">AI-Powered Tax Analysis</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Forensic Tax Audit
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Discover hidden tax opportunities in your Xero data with AI-powered analysis
          </p>
        </div>

        {/* 3 Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">

          {/* Card 1: Start */}
          <StepCard
            step={1}
            title="Start"
            description="Connect your Xero account and begin the 5-year historical data sync"
            icon={<PlayCircle className="w-8 h-8" />}
            status={getStepStatus(1)}
            progress={progress.syncProgress}
            detail={progress.stage === 'syncing'
              ? `Syncing ${progress.transactionsSynced.toLocaleString()} transactions...`
              : progress.transactionsSynced > 0
                ? `${progress.transactionsSynced.toLocaleString()} transactions synced`
                : 'Ready to begin'}
            onAction={progress.stage === 'idle' ? handleStart : undefined}
            actionLabel="Start Sync"
          />

          {/* Arrow */}
          <div className="hidden md:flex items-center justify-center absolute left-1/3 -translate-x-1/2">
            <ArrowRight className="w-6 h-6 text-slate-600" />
          </div>

          {/* Card 2: Analysis */}
          <StepCard
            step={2}
            title="Analysis"
            description="AI analyzes every transaction for R&D, deductions, and compliance issues"
            icon={<Loader2 className={`w-8 h-8 ${progress.stage === 'analyzing' ? 'animate-spin' : ''}`} />}
            status={getStepStatus(2)}
            progress={progress.analysisProgress}
            detail={progress.stage === 'analyzing'
              ? `Analyzing ${progress.transactionsAnalyzed.toLocaleString()} of ${progress.totalTransactions.toLocaleString()}`
              : progress.transactionsAnalyzed > 0
                ? `${progress.transactionsAnalyzed.toLocaleString()} transactions analyzed`
                : 'Waiting for sync'}
          />

          {/* Card 3: Report */}
          <StepCard
            step={3}
            title="Report"
            description="View detailed findings, opportunities, and actionable recommendations"
            icon={<FileText className="w-8 h-8" />}
            status={getStepStatus(3)}
            detail={progress.stage === 'complete'
              ? `$${Math.round(progress.totalBenefit / 1000).toLocaleString()}k in opportunities found`
              : 'Waiting for analysis'}
            onAction={progress.stage === 'complete' ? goToAdvanced : undefined}
            actionLabel="View Report"
            highlight={progress.stage === 'complete'}
          />
        </div>

        {/* Status Bar */}
        {(progress.stage === 'syncing' || progress.stage === 'analyzing') && (
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">
                {progress.stage === 'syncing' ? 'Syncing historical data...' : 'AI analysis in progress...'}
              </span>
              <span className="text-sm font-medium text-white">
                {progress.stage === 'syncing'
                  ? `${Math.round(progress.syncProgress)}%`
                  : `${Math.round(progress.analysisProgress)}%`}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                style={{
                  width: `${progress.stage === 'syncing' ? progress.syncProgress : progress.analysisProgress}%`
                }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-3 text-center">
              This runs in the background. You can leave this page and come back later.
            </p>
          </div>
        )}

        {/* Success State */}
        {progress.stage === 'complete' && (
          <div className="bg-emerald-500/10 rounded-2xl p-8 border border-emerald-500/30 text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">Analysis Complete!</h3>
            <p className="text-4xl font-bold text-emerald-400 mb-4">
              ${Math.round(progress.totalBenefit / 1000).toLocaleString()}k
            </p>
            <p className="text-slate-400 mb-6">in potential tax opportunities discovered</p>
            <button
              onClick={goToAdvanced}
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors"
            >
              View Detailed Report →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Step Card Component
function StepCard({
  step,
  title,
  description,
  icon,
  status,
  progress,
  detail,
  onAction,
  actionLabel,
  highlight
}: {
  step: number
  title: string
  description: string
  icon: React.ReactNode
  status: 'pending' | 'ready' | 'active' | 'complete'
  progress?: number
  detail: string
  onAction?: () => void
  actionLabel?: string
  highlight?: boolean
}) {
  const statusStyles = {
    pending: 'border-slate-700/50 bg-slate-800/30 opacity-60',
    ready: 'border-slate-600/50 bg-slate-800/50 hover:border-slate-500/50',
    active: 'border-cyan-500/50 bg-cyan-500/5',
    complete: 'border-emerald-500/50 bg-emerald-500/5'
  }

  const iconStyles = {
    pending: 'text-slate-600',
    ready: 'text-slate-400',
    active: 'text-cyan-400',
    complete: 'text-emerald-400'
  }

  return (
    <div className={`
      relative rounded-2xl p-6 border transition-all duration-300
      ${statusStyles[status]}
      ${highlight ? 'ring-2 ring-emerald-500/50' : ''}
    `}>
      {/* Step Number */}
      <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center">
        <span className="text-sm font-bold text-slate-400">{step}</span>
      </div>

      {/* Status Badge */}
      {status === 'complete' && (
        <div className="absolute -top-2 -right-2">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
        </div>
      )}

      {/* Icon */}
      <div className={`mb-4 ${iconStyles[status]}`}>
        {icon}
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>

      {/* Description */}
      <p className="text-sm text-slate-400 mb-4">{description}</p>

      {/* Progress Bar (if active) */}
      {status === 'active' && progress !== undefined && (
        <div className="w-full bg-slate-700 rounded-full h-1.5 mb-4">
          <div
            className="h-full rounded-full bg-cyan-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Detail */}
      <p className="text-xs text-slate-500 mb-4">{detail}</p>

      {/* Action Button */}
      {onAction && actionLabel && (
        <button
          onClick={onAction}
          className={`
            w-full py-2.5 rounded-lg font-medium transition-colors
            ${highlight
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
              : 'bg-slate-700 hover:bg-slate-600 text-white'}
          `}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
