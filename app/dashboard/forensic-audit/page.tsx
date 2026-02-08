/**
 * Forensic Tax Audit - v8.1 Scientific Luxury Tier
 * 
 * Deep-sequence audit engine with real-time stream processing visualization.
 */

'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  Cpu,
  FileSearch,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Play
} from 'lucide-react'
import { AnalysisProgressPanel } from '@/components/forensic-audit/AnalysisProgressPanel'
import { useAnalysisProgress } from '@/lib/hooks/useAnalysisProgress'

type Stage = 'idle' | 'syncing' | 'analyzing' | 'complete' | 'error'
type Platform = 'xero' | 'myob' | 'quickbooks'

export default function ForensicAuditPageWrapper() {
  return (
    <>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[var(--bg-dashboard)]"><Loader /></div>}>
        <ForensicAuditPage />
      </Suspense>
      <TaxDisclaimer sticky />
    </>
  )
}

const Loader = () => (
  <div className="flex flex-col items-center gap-4">
    <div className="w-12 h-12 rounded-3xl border-2 border-sky-500/20 border-t-sky-500 animate-spin" />
    <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest animate-pulse">Initializing Stream</span>
  </div>
);

function ForensicAuditPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [platform, setPlatform] = useState<Platform>('xero')
  const [_stage, setStage] = useState<Stage>('idle')
  const [isProgressMinimized, setIsProgressMinimized] = useState(false)
  const [_showCompletionToast, _setShowCompletionToast] = useState(false)
  const [showPlatformSelector, setShowPlatformSelector] = useState(false)

  const enhancedProgress = useAnalysisProgress(tenantId, {
    pollingIntervalActive: 2000,
    pollingIntervalIdle: 10000,
  })

  // Fetch tenant ID
  useEffect(() => {
    const fetchTenantId = async () => {
      const urlTenantId = searchParams.get('tenantId')
      if (urlTenantId) {
        setTenantId(urlTenantId)
        return
      }
      try {
        const response = await fetch('/api/xero/organizations')
        if (!response.ok) {
          console.error('Failed to fetch organizations:', response.status)
          return
        }
        const data = await response.json()
        if (data.connections?.length > 0) setTenantId(data.connections[0].tenant_id)
      } catch (err) { console.error(err) }
    }
    fetchTenantId()
  }, [searchParams])

  const handleStart = async () => {
    if (!tenantId) {
      alert(`No ${platform === 'xero' ? 'Xero' : platform === 'quickbooks' ? 'QuickBooks' : 'MYOB'} connection found. Please connect your organization in Settings.`)
      return
    }

    try {
      setStage('syncing')
      setShowPlatformSelector(false)

      // 1. Trigger historical sync (platform-specific)
      const syncEndpoint = platform === 'quickbooks'
        ? '/api/quickbooks/sync'
        : '/api/audit/sync-historical'

      const syncResponse = await fetch(syncEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          years: 5,
          ...(platform !== 'quickbooks' && { platform })
        })
      })

      if (!syncResponse.ok) {
        throw new Error('Failed to start historical sync')
      }

      // 2. Poll progress will handle transition to 'analyzing'
      // 3. We'll trigger the analysis explicitly once sync finishes if needed, 
      // but the backend might already be set up to feed into it or the UI can trigger it.
      // Based on the current API, they are separate steps.
      // Let's ensure the UI triggers analysis when sync is 100%

      enhancedProgress.startPolling()
    } catch (err) {
      console.error('Audit initialization failed:', err)
      setStage('error')
    }
  }

  // Effect to trigger analysis when sync completes
  useEffect(() => {
    if (enhancedProgress.syncProgress === 100 && enhancedProgress.stage === 'syncing') {
      const startAnalysis = async () => {
        try {
          await fetch('/api/audit/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId, platform })
          })
        } catch (err) {
          console.error('Failed to trigger analysis transition:', err)
        }
      }
      startAnalysis()
    }
  }, [enhancedProgress.syncProgress, enhancedProgress.stage, tenantId, platform])

  return (
    <>
      {/* Ambient Visuals */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-sky-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-500/5 blur-[100px] rounded-full" />
      </div>

      {/* Page Content - centered by parent layout */}
      <div className="relative z-10 py-12 pt-20 space-y-20">

        {/* Header Block */}
        <header className="text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-sky-400 uppercase tracking-widest"
          >
            <ShieldCheck className="w-3 h-3" />
            Sovereign Forensic Protocol v8.1
          </motion.div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter">
            Forensic Audit
          </h1>
          <p className="text-white/40 max-w-xl mx-auto text-base lg:text-lg font-medium">
            AI-driven ledger auditing for historical tax optimization and misclassification discovery.
          </p>
        </header>

        {/* The Vertical Stream Pipeline */}
        <section className="relative flex flex-col items-center">

          {/* Connector Line */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-gradient-to-b from-sky-500/40 via-white/5 to-transparent shadow-[0_0_15px_rgba(14,165,233,0.3)]" />

          {/* Node 1: Sync */}
          <AuditNode
            index={1}
            title="INITIATE SYNC"
            description="5-year historical ledger extraction"
            icon={<Zap className="w-6 h-6" />}
            status={enhancedProgress.stage === 'idle' ? 'active' : 'complete'}
            action={enhancedProgress.stage === 'idle' ? () => setShowPlatformSelector(true) : undefined}
          />

          <div className="h-32" />

          {/* Node 2: Analyze */}
          <AuditNode
            index={2}
            title="AI ANALYSIS"
            description="Forensic transaction categorization"
            icon={<Cpu className="w-6 h-6" />}
            status={enhancedProgress.stage === 'analyzing' || enhancedProgress.stage === 'syncing' ? 'active' : enhancedProgress.stage === 'complete' ? 'complete' : 'pending'}
            progress={enhancedProgress.overallProgress}
          />

          <div className="h-32" />

          {/* Node 3: Result */}
          <AuditNode
            index={3}
            title="OPTIMIZATION"
            description="Final savings & strategy report"
            icon={<FileSearch className="w-6 h-6" />}
            status={enhancedProgress.stage === 'complete' ? 'active' : 'pending'}
            action={enhancedProgress.stage === 'complete' ? () => router.push('/dashboard/strategies') : undefined}
            actionLabel="View Results"
          />

        </section>

        {/* Platform Selector Modal */}
        <AnimatePresence>
          {showPlatformSelector && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
              onClick={() => setShowPlatformSelector(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 max-w-2xl w-full mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-2xl font-black text-white mb-2">Select Accounting Platform</h2>
                <p className="text-white/40 text-sm mb-8">Choose your accounting software to begin forensic analysis</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Xero */}
                  <button
                    onClick={() => {
                      setPlatform('xero')
                      handleStart()
                    }}
                    className={`p-6 rounded-2xl border-2 transition-all text-left group hover:scale-105 ${
                      platform === 'xero'
                        ? 'border-[#13b5ea] bg-[#13b5ea]/10'
                        : 'border-white/5 hover:border-[#13b5ea]/50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#13b5ea]/10 flex items-center justify-center mb-4">
                      <span className="text-2xl">📊</span>
                    </div>
                    <h3 className="font-bold text-white mb-1">Xero</h3>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2">Market Leader</p>
                    <p className="text-xs text-white/60">Most popular in AU/NZ with complete transaction support</p>
                  </button>

                  {/* QuickBooks */}
                  <button
                    onClick={() => {
                      setPlatform('quickbooks')
                      handleStart()
                    }}
                    className={`p-6 rounded-2xl border-2 transition-all text-left group hover:scale-105 ${
                      platform === 'quickbooks'
                        ? 'border-[#2ca01c] bg-[#2ca01c]/10'
                        : 'border-white/5 hover:border-[#2ca01c]/50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#2ca01c]/10 flex items-center justify-center mb-4">
                      <span className="text-2xl">💚</span>
                    </div>
                    <h3 className="font-bold text-white mb-1">QuickBooks</h3>
                    <p className="text-[10px] text-[#2ca01c] uppercase tracking-widest mb-2">100% Coverage</p>
                    <p className="text-xs text-white/60">36% market share with 6 transaction types supported</p>
                  </button>

                  {/* MYOB */}
                  <button
                    onClick={() => {
                      setPlatform('myob')
                      handleStart()
                    }}
                    className={`p-6 rounded-2xl border-2 transition-all text-left group hover:scale-105 ${
                      platform === 'myob'
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-white/5 hover:border-purple-500/50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
                      <span className="text-2xl">📈</span>
                    </div>
                    <h3 className="font-bold text-white mb-1">MYOB</h3>
                    <p className="text-[10px] text-purple-400 uppercase tracking-widest mb-2">Enterprise Ready</p>
                    <p className="text-xs text-white/60">Australian-built platform with robust API access</p>
                  </button>
                </div>

                <button
                  onClick={() => setShowPlatformSelector(false)}
                  className="w-full py-3 rounded-xl border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Real-time Stats Panel */}
        <AnimatePresence>
          {(enhancedProgress.stage === 'syncing' || enhancedProgress.stage === 'analyzing') && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="mt-12 w-full flex justify-center"
            >
              <AnalysisProgressPanel
                stage={enhancedProgress.stage}
                platform={platform}
                overallProgress={enhancedProgress.overallProgress}
                syncProgress={enhancedProgress.syncProgress}
                batch={enhancedProgress.batch}
                timeEstimate={enhancedProgress.timeEstimate}
                stats={enhancedProgress.stats}
                recentBatches={enhancedProgress.recentBatches}
                error={enhancedProgress.error}
                onMinimize={() => setIsProgressMinimized(!isProgressMinimized)}
                isMinimized={isProgressMinimized}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary Footer for Complete State */}
        {enhancedProgress.stage === 'complete' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl"
          >
            <SummaryCard title="Identified Benefits" value={`$${(enhancedProgress.stats.totalDeductions || 0).toLocaleString()}`} icon={TrendingUp} color="text-emerald-400" />
            <SummaryCard title="R&D Candidates" value={enhancedProgress.stats.rndCandidates || 0} icon={RefreshCw} color="text-sky-400" />
            <SummaryCard title="Audit Completion" value="100%" icon={ShieldCheck} color="text-white" />
          </motion.div>
        )}

      </div>
    </>
  )
}

interface AuditNodeProps {
  index: number
  title: string
  description: string
  icon: React.ReactNode
  status: 'active' | 'complete' | 'pending'
  action?: () => void
  actionLabel?: string
  progress?: number
}

function AuditNode({ index: _index, title, description, icon, status, action, actionLabel = 'Start', progress }: AuditNodeProps) {
  const isActive = status === 'active';
  const isComplete = status === 'complete';

  return (
    <div className="relative flex items-center justify-between w-full group">
      {/* Legend Left */}
      <div className={`w-[240px] text-right pr-12 transition-all ${isActive ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-40'}`}>
        <h3 className="text-xl font-black text-white mb-1">{title}</h3>
        <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">{description}</p>
      </div>

      {/* Central Node */}
      <div className="relative z-10 flex flex-col items-center">
        <div className={`
                    w-16 h-16 rounded-[2rem] flex items-center justify-center transition-all duration-700
                    ${isActive ? 'bg-sky-500 text-black shadow-[0_0_40px_rgba(14,165,233,0.5)] scale-110' :
            isComplete ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
              'bg-white/5 text-white/20 border border-white/10'}
                `}>
          {isComplete ? <CheckCircle2 className="w-8 h-8" /> : icon}
        </div>
        {progress !== undefined && isActive && (
          <p className="absolute -bottom-6 text-[10px] font-black text-sky-400 font-mono">{Math.round(progress)}%</p>
        )}
      </div>

      {/* Action Right */}
      <div className={`w-[240px] pl-12 transition-all ${isActive || isComplete ? 'opacity-100' : 'opacity-0'}`}>
        {action && (
          <button onClick={action} className="btn btn-primary px-8 py-3 bg-white text-black hover:bg-sky-400 transition-colors font-black text-xs uppercase tracking-widest">
            {actionLabel} <Play className="w-3 h-3 ml-2 fill-current" />
          </button>
        )}
        {isComplete && !action && (
          <div className="flex items-center gap-2 text-emerald-400 font-black text-[10px] uppercase tracking-widest">
            <CheckCircle2 className="w-4 h-4" /> Validated
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
      <div className="flex items-center gap-3 text-white/40">
        <Icon className="w-4 h-4" />
        <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
      </div>
      <div className={`text-4xl font-black ${color} font-mono italic tracking-tighter`}>{value}</div>
    </div>
  )
}
