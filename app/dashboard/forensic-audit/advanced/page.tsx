/**
 * Enhanced Forensic Audit Dashboard
 *
 * Features:
 * - Multi-year analysis progress visualization
 * - Live opportunity counters by tax area
 * - Real-time charts showing findings
 * - Activity feed with recent discoveries
 * - Dual-format view (Client vs Accountant)
 */

'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Beaker, TrendingDown, Building2, AlertCircle, CheckCircle, Clock, Target } from 'lucide-react'
import LiveProgressCard from '@/components/dashboard/LiveProgressCard'
import AnimatedCounter from '@/components/dashboard/AnimatedCounter'
import LiveChart from '@/components/dashboard/LiveChart'
import ActivityFeed, { ActivityItem } from '@/components/dashboard/ActivityFeed'
import FormatToggleWrapper from '@/components/dashboard/FormatToggleWrapper'
import {
  transformForensicAuditToClientView,
  type ForensicAuditResult
} from '@/lib/utils/client-view-transformer'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'

interface YearProgress {
  status: 'complete' | 'analyzing' | 'queued' | 'idle'
  progress?: number
  transactions?: number
  currentTransaction?: number
}

interface DashboardData {
  syncStatus: {
    status: 'idle' | 'syncing' | 'complete' | 'error'
    progress: number
    transactionsSynced: number
    totalTransactions: number
    lastSyncAt?: string
  }
  analysisStatus: {
    status: 'idle' | 'analyzing' | 'complete' | 'error'
    progress: number
    transactionsAnalyzed: number
    totalTransactions: number
  }
  recommendations: {
    totalAdjustedBenefit: number
    byTaxArea: {
      rnd: number
      deductions: number
      losses: number
      div7a: number
    }
    byPriority: {
      critical: number
      high: number
      medium: number
      low: number
    }
    criticalRecommendations: Array<{
      id: string
      action: string
      adjustedBenefit: number
      deadline: string
    }>
  }
  yearProgress?: Record<string, YearProgress>
  currentYear?: string
}

export default function ForensicAuditDashboardEnhancedPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>}>
      <ForensicAuditDashboardEnhanced />
    </Suspense>
  )
}

function ForensicAuditDashboardEnhanced() {
  const _router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function fetchTenantId() {
      try {
        // Check URL parameter first
        const urlTenantId = searchParams.get('tenantId')
        if (urlTenantId) {
          setTenantId(urlTenantId)
          return
        }

        // Otherwise fetch from organizations API
        const response = await fetch('/api/xero/organizations')
        const data = await response.json()

        if (data.connections && data.connections.length > 0) {
          setTenantId(data.connections[0].tenant_id)
        } else {
          setError('No Xero connections found. Please connect your Xero account first.')
        }
      } catch (err) {
        console.error('Failed to fetch tenant ID:', err)
        setError('Failed to load Xero connection')
      }
    }
    fetchTenantId()
  }, [searchParams])

  const addActivity = (activity: ActivityItem) => {
    setActivities(prev => [...prev, activity])
  }

  const loadDashboardData = useCallback(async () => {
    if (!tenantId) return

    try {
      setLoading(true)
      setError(null)

      // Fetch all data in parallel
      const [syncResponse, analysisResponse, recommendationsResponse] = await Promise.all([
        fetch(`/api/audit/sync-status/${tenantId}`),
        fetch(`/api/audit/analysis-status/${tenantId}`),
        fetch(`/api/audit/recommendations?tenantId=${tenantId}`)
      ])

      const syncData = await syncResponse.json()
      const analysisData = await analysisResponse.json()
      const recommendationsData = await recommendationsResponse.json()

      setData({
        syncStatus: {
          status: syncData.status,
          progress: syncData.progress || 0,
          transactionsSynced: syncData.transactionsSynced || 0,
          totalTransactions: syncData.totalEstimated || syncData.totalTransactions || 12236,
          lastSyncAt: syncData.lastSyncAt
        },
        analysisStatus: {
          status: analysisData.status,
          progress: analysisData.progress || 0,
          transactionsAnalyzed: analysisData.transactionsAnalyzed || 0,
          totalTransactions: analysisData.totalTransactions || 12236
        },
        recommendations: recommendationsData.summary || {
          totalAdjustedBenefit: 0,
          byTaxArea: { rnd: 0, deductions: 0, losses: 0, div7a: 0 },
          byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
          criticalRecommendations: []
        },
        yearProgress: analysisData.yearProgress,
        currentYear: analysisData.currentYear
      })

      // Add activity
      if (analysisData.status === 'analyzing') {
        addActivity({
          id: Date.now().toString(),
          timestamp: new Date(),
          message: `Analyzing ${analysisData.currentYear || 'transactions'}...`,
          type: 'info'
        })
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (tenantId) {
      loadDashboardData()
    }
  }, [tenantId, loadDashboardData])

  async function startHistoricalSync() {
    if (!tenantId) return

    addActivity({
      id: Date.now().toString(),
      timestamp: new Date(),
      message: 'Starting 5-year historical data sync...',
      type: 'info'
    })

    try {
      const response = await fetch('/api/audit/sync-historical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, years: 5 })
      })

      if (response.ok) {
        pollSyncProgress()
      }
    } catch (err) {
      console.error('Failed to start sync:', err)
      setError('Failed to start historical sync')
    }
  }

  async function startAnalysis() {
    if (!tenantId) return

    addActivity({
      id: Date.now().toString(),
      timestamp: new Date(),
      message: 'Starting AI forensic analysis...',
      type: 'info'
    })

    try {
      const response = await fetch('/api/audit/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      })

      if (response.ok) {
        pollAnalysisProgress()
      }
    } catch (err) {
      console.error('Failed to start analysis:', err)
      setError('Failed to start AI analysis')
    }
  }

  function pollSyncProgress() {
    const interval = setInterval(async () => {
      await loadDashboardData()

      if (data?.syncStatus.status === 'complete' || data?.syncStatus.status === 'error') {
        clearInterval(interval)
        setPollInterval(null)
        addActivity({
          id: Date.now().toString(),
          timestamp: new Date(),
          message: `Sync complete! ${data.syncStatus.transactionsSynced} transactions synced`,
          type: 'success'
        })
      }
    }, 5000)

    setPollInterval(interval)
  }

  function pollAnalysisProgress() {
    const interval = setInterval(async () => {
      await loadDashboardData()

      if (data?.analysisStatus.status === 'complete' || data?.analysisStatus.status === 'error') {
        clearInterval(interval)
        setPollInterval(null)
        addActivity({
          id: Date.now().toString(),
          timestamp: new Date(),
          message: `Analysis complete! Found $${Math.round(data.recommendations.totalAdjustedBenefit / 1000)}k in opportunities`,
          type: 'success'
        })
      }
    }, 15000)

    setPollInterval(interval)
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [pollInterval])

  // Chart data for opportunities by year - fetched from API
  const [opportunitiesByYear, setOpportunitiesByYear] = useState<Array<{ name: string; value: number }>>([])

  useEffect(() => {
    if (!tenantId) return
    async function fetchOpportunities() {
      try {
        const res = await fetch(`/api/audit/opportunities-by-year?tenantId=${tenantId}`)
        const json = await res.json()
        setOpportunitiesByYear(json.opportunities || [])
      } catch (err) {
        console.error('Failed to fetch opportunities by year:', err)
      }
    }
    fetchOpportunities()
  }, [tenantId, data?.analysisStatus.status])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-[var(--text-secondary)]">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="glass-card p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Error</h2>
          <p className="text-[var(--text-secondary)] mb-4">{error}</p>
          <button onClick={() => loadDashboardData()} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const isReady = data?.syncStatus.status === 'complete' && data?.analysisStatus.status === 'complete'
  const isAnalyzing = data?.analysisStatus.status === 'analyzing'

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            Forensic Tax Audit Dashboard
          </h1>
          <p className="text-[var(--text-secondary)]">
            5-year comprehensive analysis with AI-powered insights
          </p>
        </div>

        {/* Live Progress Cards */}
        {(data?.syncStatus.status === 'syncing' || data?.analysisStatus.status === 'analyzing') && (
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            {/* Historical Sync Progress */}
            {data?.syncStatus.status === 'syncing' && (
              <LiveProgressCard
                title="Historical Data Sync"
                value={data.syncStatus.transactionsSynced}
                total={data.syncStatus.totalTransactions}
                percentage={data.syncStatus.progress}
                icon={<Building2 className="w-6 h-6" />}
                color="xero"
                subtitle="Fetching 5 years of transaction data"
                isAnimating={true}
              />
            )}

            {/* AI Analysis Progress */}
            {data?.analysisStatus.status === 'analyzing' && (
              <LiveProgressCard
                title="AI Forensic Analysis"
                value={data.analysisStatus.transactionsAnalyzed}
                total={data.analysisStatus.totalTransactions}
                percentage={data.analysisStatus.progress}
                icon={<Beaker className="w-6 h-6" />}
                color="ai"
                subtitle={`Analyzing ${data.currentYear || 'transactions'}`}
                isAnimating={true}
              />
            )}
          </div>
        )}

        {/* Year-by-Year Progress */}
        {isAnalyzing && data?.yearProgress && (
          <div className="glass-card p-6 mb-8">
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              Year-by-Year Progress
            </h3>
            <div className="space-y-3">
              {Object.entries(data.yearProgress).map(([year, progress]) => (
                <div key={year} className="flex items-center gap-4">
                  <div className="w-32 font-medium text-[var(--text-primary)]">{year}</div>
                  <div className="flex-1">
                    {progress.status === 'complete' ? (
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle className="w-5 h-5" />
                        <span>Complete ({progress.transactions} transactions)</span>
                      </div>
                    ) : progress.status === 'analyzing' ? (
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                              style={{ width: `${progress.progress || 0}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm text-[var(--text-secondary)]">
                          {progress.currentTransaction} / {progress.transactions}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[var(--text-muted)]">
                        <Clock className="w-5 h-5" />
                        <span>Queued</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opportunity Counters - Show when analysis is complete */}
        {isReady && data && (
          <>
            {/* Total Opportunity Hero */}
            <div className="glass-card p-8 mb-8 text-center">
              <p className="text-[var(--text-muted)] text-sm uppercase tracking-wide mb-2">
                Total Tax Opportunity
              </p>
              <AnimatedCounter
                value={data.recommendations.totalAdjustedBenefit}
                format="currency"
                decimals={2}
                className="text-5xl font-bold text-emerald-400"
              />
              <p className="text-[var(--text-secondary)] text-sm mt-2">
                Confidence-adjusted benefit
              </p>
            </div>

            {/* Opportunity Breakdown */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <Link href="/dashboard/forensic-audit/rnd">
                <div className="glass-card p-6 hover:border-purple-500/50 transition-colors cursor-pointer border-l-4 border-l-purple-500">
                  <div className="flex items-center gap-3 mb-3">
                    <Beaker className="w-6 h-6 text-purple-400" />
                    <h3 className="font-semibold text-[var(--text-primary)]">R&D Tax Incentive</h3>
                  </div>
                  <AnimatedCounter
                    value={data.recommendations.byTaxArea.rnd}
                    format="currency"
                    decimals={0}
                    className="text-3xl font-bold text-purple-400"
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-2">Division 355 • 43.5% offset</p>
                </div>
              </Link>

              <div className="glass-card p-6 border-l-4 border-l-sky-500">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingDown className="w-6 h-6 text-sky-400" />
                  <h3 className="font-semibold text-[var(--text-primary)]">Deductions</h3>
                </div>
                <AnimatedCounter
                  value={data.recommendations.byTaxArea.deductions}
                  format="currency"
                  decimals={0}
                  className="text-3xl font-bold text-sky-400"
                />
                <p className="text-xs text-[var(--text-muted)] mt-2">Division 8 • Section 8-1</p>
              </div>

              <div className="glass-card p-6 border-l-4 border-l-amber-500">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingDown className="w-6 h-6 text-amber-400" />
                  <h3 className="font-semibold text-[var(--text-primary)]">Loss Carry-Forward</h3>
                </div>
                <AnimatedCounter
                  value={data.recommendations.byTaxArea.losses}
                  format="currency"
                  decimals={0}
                  className="text-3xl font-bold text-amber-400"
                />
                <p className="text-xs text-[var(--text-muted)] mt-2">Division 36/165</p>
              </div>

              <div className="glass-card p-6 border-l-4 border-l-red-500">
                <div className="flex items-center gap-3 mb-3">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                  <h3 className="font-semibold text-[var(--text-primary)]">Division 7A</h3>
                </div>
                <AnimatedCounter
                  value={data.recommendations.byTaxArea.div7a}
                  format="currency"
                  decimals={0}
                  className="text-3xl font-bold text-red-400"
                />
                <p className="text-xs text-[var(--text-muted)] mt-2">ITAA 1936</p>
              </div>
            </div>

            {/* Opportunities Chart */}
            {opportunitiesByYear.length > 0 && (
              <div className="mb-8">
                <LiveChart
                  data={opportunitiesByYear}
                  type="bar"
                  title="Opportunities by Year"
                  dataKey="value"
                  height={300}
                />
              </div>
            )}

            {/* Dual-Format Results */}
            <FormatToggleWrapper
              clientView={<ClientView data={data} />}
              technicalView={<TechnicalView data={data} />}
              defaultView="accountant"
            />
          </>
        )}

        {/* Activity Feed */}
        {activities.length > 0 && (
          <div className="mt-8">
            <ActivityFeed items={activities} maxItems={20} autoScroll={true} showTimestamps={true} />
          </div>
        )}

        {/* Quick Actions - Show when not ready */}
        {!isReady && (
          <div className="glass-card p-8 text-center">
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              Ready to Start?
            </h3>
            <p className="text-[var(--text-secondary)] mb-6 max-w-xl mx-auto">
              Run a comprehensive 5-year forensic analysis to discover tax opportunities
            </p>
            <div className="flex gap-4 justify-center">
              {data?.syncStatus.status !== 'complete' && (
                <button onClick={startHistoricalSync} className="btn btn-primary">
                  Start Historical Sync
                </button>
              )}
              {data?.syncStatus.status === 'complete' && data?.analysisStatus.status !== 'complete' && (
                <button onClick={startAnalysis} className="btn btn-primary">
                  Start AI Analysis
                </button>
              )}
            </div>
          </div>
        )}
        <TaxDisclaimer />
      </div>
    </div>
  )
}

// Client View Component
function ClientView({ data }: { data: DashboardData }) {
  const forensicResult: ForensicAuditResult = {
    totalAdjustedBenefit: data.recommendations.totalAdjustedBenefit,
    byTaxArea: data.recommendations.byTaxArea,
    byPriority: data.recommendations.byPriority,
    transactionsAnalyzed: data.analysisStatus.transactionsAnalyzed,
    yearsAnalyzed: 5
  }

  const summary = transformForensicAuditToClientView(forensicResult)

  return (
    <div className="space-y-6">
      {/* Headline */}
      <div className="glass-card p-8 text-center">
        <div className="mb-2 flex justify-center"><Target className="w-10 h-10 text-sky-400" /></div>
        <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-4">
          {summary.headline}
        </h2>
        <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">
          {summary.whatThisMeans}
        </p>
      </div>

      {/* Key Findings */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
          What We Found
        </h3>
        <ul className="space-y-3">
          {summary.keyFindings.map((finding, index) => (
            <li key={index} className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span className="text-[var(--text-secondary)]">{finding}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Opportunity Breakdown */}
      {summary.issueBreakdown.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
            Where the Savings Come From
          </h3>
          <div className="space-y-3">
            {summary.issueBreakdown.map((item, index) => (
              <div key={index} className="flex items-center gap-4">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1">
                  <p className="font-medium text-[var(--text-primary)]">{item.name}</p>
                  <p className="text-sm text-[var(--text-muted)]">{item.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-[var(--text-primary)]">
                    {item.percentage.toFixed(0)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Steps */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
          Next Steps
        </h3>
        <ol className="space-y-3">
          {summary.nextSteps.map((step, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-sm font-semibold">
                {index + 1}
              </span>
              <span className="text-[var(--text-secondary)]">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Download Button */}
      <div className="flex justify-center">
        <button className="btn btn-primary opacity-50 cursor-not-allowed" disabled title="Coming soon">
          Download Client-Friendly Report (Coming Soon)
        </button>
      </div>
    </div>
  )
}

// Technical View Component
function TechnicalView({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6">
      {/* Analysis Summary */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
          Analysis Summary
        </h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-[var(--text-muted)] mb-1">Transactions Analyzed</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {data.analysisStatus.transactionsAnalyzed.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-[var(--text-muted)] mb-1">Years Covered</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">5 Years</p>
          </div>
          <div>
            <p className="text-sm text-[var(--text-muted)] mb-1">Critical Items</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {data.recommendations.byPriority.critical}
            </p>
          </div>
        </div>
      </div>

      {/* Tax Area Breakdown */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
          Opportunities by Tax Area
        </h3>
        <div className="space-y-4">
          <TaxAreaRow
            label="R&D Tax Incentive (Division 355)"
            amount={data.recommendations.byTaxArea.rnd}
            description="43.5% offset on eligible R&D expenditure"
          />
          <TaxAreaRow
            label="General Deductions (Division 8, Section 8-1)"
            amount={data.recommendations.byTaxArea.deductions}
            description="Missed business expense deductions"
          />
          <TaxAreaRow
            label="Loss Carry-Forward (Division 36/165)"
            amount={data.recommendations.byTaxArea.losses}
            description="Unused tax losses from prior years"
          />
          <TaxAreaRow
            label="Division 7A Compliance (ITAA 1936)"
            amount={data.recommendations.byTaxArea.div7a}
            description="Deemed dividend risks to address"
          />
        </div>
      </div>

      {/* Priority Breakdown */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
          Recommendations by Priority
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/30">
            <div className="text-3xl font-bold text-red-400">
              {data.recommendations.byPriority.critical}
            </div>
            <div className="text-sm text-[var(--text-muted)]">Critical</div>
          </div>
          <div className="text-center p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
            <div className="text-3xl font-bold text-amber-400">
              {data.recommendations.byPriority.high}
            </div>
            <div className="text-sm text-[var(--text-muted)]">High</div>
          </div>
          <div className="text-center p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
            <div className="text-3xl font-bold text-yellow-400">
              {data.recommendations.byPriority.medium}
            </div>
            <div className="text-sm text-[var(--text-muted)]">Medium</div>
          </div>
          <div className="text-center p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
            <div className="text-3xl font-bold text-emerald-400">
              {data.recommendations.byPriority.low}
            </div>
            <div className="text-sm text-[var(--text-muted)]">Low</div>
          </div>
        </div>
      </div>

      {/* Download Buttons */}
      <div className="flex gap-4">
        <button className="btn btn-primary flex-1 opacity-50 cursor-not-allowed" disabled title="Coming soon">
          Download Technical PDF (Coming Soon)
        </button>
        <button className="btn btn-secondary flex-1 opacity-50 cursor-not-allowed" disabled title="Coming soon">
          Export Excel Workbook (Coming Soon)
        </button>
        <button className="btn btn-secondary flex-1 opacity-50 cursor-not-allowed" disabled title="Coming soon">
          Amendment Schedules (Coming Soon)
        </button>
      </div>
    </div>
  )
}

// Helper component
function TaxAreaRow({ label, amount, description }: { label: string; amount: number; description: string }) {
  return (
    <div className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-lg">
      <div>
        <p className="font-semibold text-[var(--text-primary)]">{label}</p>
        <p className="text-sm text-[var(--text-muted)]">{description}</p>
      </div>
      <div className="text-2xl font-bold text-emerald-400">
        ${Math.round(amount / 1000)}k
      </div>
    </div>
  )
}
