/**
 * Enhanced Main Dashboard with Live Operations Overview
 *
 * Features:
 * - Live operations status for all active processes
 * - Recent completions (last 24 hours)
 * - Animated counters for key metrics
 * - Quick action cards
 * - Real-time activity feed
 */

'use client'

import { useCallback, useEffect, Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiRequest, ApiRequestError } from '@/lib/api/client'
import {
  DollarSign,
  LayoutDashboard,
  Beaker,
  FileSearch,
  TrendingDown,
  Building2,
  Settings,
  RefreshCw,
  Plus,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Scan,
  Zap
} from 'lucide-react'
import AnimatedCounter from '@/components/dashboard/AnimatedCounter'
import LiveProgressCard from '@/components/dashboard/LiveProgressCard'
import ActivityFeed, { ActivityItem } from '@/components/dashboard/ActivityFeed'

interface Connection {
  tenant_id: string
  tenant_name: string
  organisation_name: string
  organisation_type: string
  country_code: string
  base_currency: string
  is_demo_company: boolean
  connected_at: string
  updated_at: string
}

type TransactionsSummary = {
  total: number
  rndCandidates: number
  rndValue: number
  needsReview: number
  missingTaxTypes: number
}

interface ActiveOperation {
  id: string
  type: 'data-quality' | 'forensic-audit' | 'sync'
  title: string
  progress: number
  current: number
  total: number
  status: 'running' | 'complete' | 'error'
  eta?: string
  startedAt: Date
}

interface RecentCompletion {
  id: string
  type: string
  title: string
  completedAt: Date
  result: string
  value?: number
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const justConnected = searchParams.get('connected') === 'true'

  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null)
  const [summary, setSummary] = useState<TransactionsSummary | null>(null)
  const [_summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  // Live operations state
  const [activeOperations, setActiveOperations] = useState<ActiveOperation[]>([])
  const [recentCompletions, setRecentCompletions] = useState<RecentCompletion[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])

  const _addActivity = (activity: ActivityItem) => {
    setActivities(prev => [...prev, activity])
  }

  const fetchSummary = useCallback(async (tenantId: string) => {
    try {
      setSummaryLoading(true)
      setSummaryError(null)
      const data = await apiRequest<{ summary: TransactionsSummary }>(
        `/api/xero/transactions?tenantId=${encodeURIComponent(tenantId)}`
      )
      setSummary(data.summary || null)
    } catch (error) {
      console.error('Failed to fetch summary:', error)
      const errorMessage = error instanceof ApiRequestError
        ? error.message
        : 'Failed to load summary'
      setSummaryError(errorMessage)
      setSummary(null)
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  const fetchConnections = useCallback(async () => {
    try {
      const data = await apiRequest<{ connections: Connection[] }>('/api/xero/organizations')
      setConnections(data.connections || [])
      if (data.connections?.length > 0) {
        const connection = data.connections[0]
        setActiveConnection(connection)
        fetchSummary(connection.tenant_id)
      } else {
        setActiveConnection(null)
        setSummary(null)
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error)
    } finally {
      setLoading(false)
    }
  }, [fetchSummary])

  // Poll for active operations
  const checkActiveOperations = useCallback(async () => {
    if (!activeConnection) return

    try {
      // Check data quality scan status
      const dqResponse = await fetch(`/api/data-quality/scan?tenantId=${activeConnection.tenant_id}`)
      const dqData = await dqResponse.json()

      // Check forensic audit status
      const syncResponse = await fetch(`/api/audit/sync-status/${activeConnection.tenant_id}`)
      const syncData = await syncResponse.json()

      const analysisResponse = await fetch(`/api/audit/analysis-status/${activeConnection.tenant_id}`)
      const analysisData = await analysisResponse.json()

      // Update active operations
      const operations: ActiveOperation[] = []

      if (dqData.status === 'scanning') {
        operations.push({
          id: 'data-quality',
          type: 'data-quality',
          title: 'Data Quality Scan',
          progress: dqData.progress || 0,
          current: dqData.transactionsScanned || 0,
          total: 1000,
          status: 'running',
          startedAt: new Date()
        })
      }

      if (syncData.status === 'syncing') {
        operations.push({
          id: 'sync',
          type: 'sync',
          title: 'Historical Data Sync',
          progress: syncData.progress || 0,
          current: syncData.transactionsSynced || 0,
          total: syncData.totalEstimated || syncData.totalTransactions || 12236,
          status: 'running',
          startedAt: new Date()
        })
      }

      if (analysisData.status === 'analyzing') {
        operations.push({
          id: 'forensic-audit',
          type: 'forensic-audit',
          title: 'Forensic AI Analysis',
          progress: analysisData.progress || 0,
          current: analysisData.transactionsAnalyzed || 0,
          total: analysisData.totalTransactions || 12236,
          status: 'running',
          startedAt: new Date()
        })
      }

      setActiveOperations(operations)

      // Add recent completions (mock data for now)
      if (dqData.status === 'complete') {
        setRecentCompletions(prev => {
          const exists = prev.some(c => c.id === 'dq-latest')
          if (!exists) {
            return [{
              id: 'dq-latest',
              type: 'Data Quality',
              title: 'Data Quality Scan (FY2024-25)',
              completedAt: new Date(),
              result: `${dqData.issuesFound} issues found`,
              value: dqData.issuesFound
            }, ...prev].slice(0, 5)
          }
          return prev
        })
      }
    } catch (error) {
      console.error('Failed to check operations:', error)
    }
  }, [activeConnection])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  // Poll for active operations every 5 seconds
  useEffect(() => {
    if (!activeConnection) return

    checkActiveOperations()
    const interval = setInterval(checkActiveOperations, 5000)

    return () => clearInterval(interval)
  }, [activeConnection, checkActiveOperations])

  function handleSelectConnection(connection: Connection) {
    setActiveConnection(connection)
    fetchSummary(connection.tenant_id)
  }

  const hasConnections = connections.length > 0

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold">ATO Optimizer</h1>
              <p className="text-xs text-[var(--text-muted)]">Tax Intelligence</p>
            </div>
          </div>

          <nav className="space-y-1">
            <Link href="/dashboard" className="sidebar-link active">
              <LayoutDashboard className="w-5 h-5" />
              <span>Dashboard</span>
            </Link>
            <Link href="/dashboard/data-quality" className="sidebar-link">
              <Scan className="w-5 h-5" />
              <span>Data Quality</span>
            </Link>
            <Link href="/dashboard/forensic-audit" className="sidebar-link">
              <FileSearch className="w-5 h-5" />
              <span>Forensic Audit</span>
            </Link>
            <Link href="/dashboard/rnd" className="sidebar-link">
              <Beaker className="w-5 h-5" />
              <span>R&D Assessment</span>
            </Link>
            <Link href="/dashboard/losses" className="sidebar-link">
              <TrendingDown className="w-5 h-5" />
              <span>Loss Analysis</span>
            </Link>
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-[var(--border-default)]">
          <Link href="/dashboard/settings" className="sidebar-link">
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-[280px] flex-1 p-8">
        {/* Success Banner */}
        {justConnected && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 animate-[fadeIn_0.3s_ease]">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400">Xero account connected successfully!</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold mb-1">Tax Optimization Dashboard</h2>
            <p className="text-[var(--text-secondary)]">
              {activeConnection
                ? `Connected to ${activeConnection.organisation_name || activeConnection.tenant_name}`
                : 'Connect your Xero account to get started'
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeConnection && (
              <button
                onClick={fetchConnections}
                className="btn btn-secondary"
              >
                <RefreshCw className="w-4 h-4" />
                Sync Data
              </button>
            )}
            <Link href="/api/auth/xero" className="btn btn-xero">
              <Plus className="w-4 h-4" />
              Add Connection
            </Link>
          </div>
        </div>

        {summaryError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            {summaryError}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="loading-spinner" />
          </div>
        ) : !hasConnections ? (
          /* No Connections State */
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-sky-500/10 flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-10 h-10 text-sky-400" />
            </div>
            <h3 className="text-xl font-semibold mb-3">No Xero Connections</h3>
            <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
              Connect your Xero account to analyze your financial data and
              discover tax optimization opportunities.
            </p>
            <Link href="/api/auth/xero" className="btn btn-xero text-lg px-8 py-4">
              Connect Xero Account
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        ) : (
          <>
            {/* Active Operations Section */}
            {activeOperations.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  Active Operations
                </h3>
                <div className="grid gap-4">
                  {activeOperations.map(op => (
                    <LiveProgressCard
                      key={op.id}
                      title={op.title}
                      value={op.current}
                      total={op.total}
                      percentage={op.progress}
                      icon={
                        op.type === 'data-quality' ? <Scan className="w-6 h-6" /> :
                        op.type === 'forensic-audit' ? <FileSearch className="w-6 h-6" /> :
                        <RefreshCw className="w-6 h-6" />
                      }
                      color={
                        op.type === 'data-quality' ? 'xero' :
                        op.type === 'forensic-audit' ? 'ai' :
                        'success'
                      }
                      subtitle={`Started ${op.startedAt.toLocaleTimeString()}`}
                      eta={op.eta}
                      isAnimating={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Completions */}
            {recentCompletions.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  Recent Completions (Last 24 Hours)
                </h3>
                <div className="glass-card divide-y divide-[var(--border-default)]">
                  {recentCompletions.map(completion => (
                    <div key={completion.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{completion.title}</p>
                          <p className="text-sm text-[var(--text-muted)]">
                            {completion.completedAt.toLocaleTimeString()} • {completion.result}
                          </p>
                        </div>
                      </div>
                      {completion.value !== undefined && (
                        <div className="text-lg font-bold text-emerald-400">
                          {completion.value.toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats Grid - Animated Counters */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <div className="stat-card xero">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-[var(--text-secondary)]">Connections</span>
                  <Building2 className="w-5 h-5 text-sky-400" />
                </div>
                <AnimatedCounter
                  value={connections.length}
                  className="text-3xl font-bold"
                />
                <div className="text-xs text-[var(--text-muted)]">Xero organization(s)</div>
              </div>

              <div className="stat-card accent">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-[var(--text-secondary)]">R&D Candidate Spend</span>
                  <Beaker className="w-5 h-5 text-emerald-400" />
                </div>
                <AnimatedCounter
                  value={summary?.rndValue ?? 0}
                  format="currency"
                  decimals={0}
                  className="text-3xl font-bold text-emerald-400"
                />
                <div className="text-xs text-[var(--text-muted)]">flagged by transaction analysis</div>
              </div>

              <div className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-[var(--text-secondary)]">Review Items</span>
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <AnimatedCounter
                  value={summary?.needsReview ?? 0}
                  className="text-3xl font-bold"
                />
                <div className="text-xs text-[var(--text-muted)]">requiring manual review</div>
              </div>

              <div className="stat-card warning">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-[var(--text-secondary)]">Transactions Scanned</span>
                  <TrendingDown className="w-5 h-5 text-amber-400" />
                </div>
                <AnimatedCounter
                  value={summary?.total ?? 0}
                  className="text-3xl font-bold"
                />
                <div className="text-xs text-[var(--text-muted)]">current sync window</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Link href="/dashboard/data-quality" className="glass-card p-6 hover:border-sky-500/50 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center mb-4">
                  <Scan className="w-6 h-6 text-sky-400" />
                </div>
                <h3 className="font-semibold mb-2">Data Quality Scan</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  AI-powered validation and auto-correction of your data.
                </p>
                <div className="flex items-center text-sky-400 text-sm font-medium">
                  Start Scan <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Link>

              <Link href="/dashboard/forensic-audit" className="glass-card p-6 hover:border-purple-500/50 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
                  <FileSearch className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="font-semibold mb-2">Forensic Tax Audit</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  5-year comprehensive analysis with AI-powered insights.
                </p>
                <div className="flex items-center text-purple-400 text-sm font-medium">
                  Run Audit <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Link>

              <Link href="/dashboard/rnd" className="glass-card p-6 hover:border-emerald-500/50 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                  <Beaker className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="font-semibold mb-2">R&D Tax Assessment</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Review candidate transactions for R&D tax incentive.
                </p>
                <div className="flex items-center text-emerald-400 text-sm font-medium">
                  Start Assessment <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Link>
            </div>

            {/* Activity Feed */}
            {(activities.length > 0 || activeOperations.length > 0) && (
              <ActivityFeed
                items={activities}
                maxItems={15}
                autoScroll={true}
                showTimestamps={true}
              />
            )}

            {/* Connected Organizations */}
            <div className="glass-card mt-8">
              <div className="p-6 border-b border-[var(--border-default)]">
                <h3 className="font-semibold">Connected Organizations</h3>
              </div>
              <div className="divide-y divide-[var(--border-default)]">
                {connections.map((conn) => (
                  <div key={conn.tenant_id} className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-sky-400" />
                      </div>
                      <div>
                        <div className="font-medium">{conn.organisation_name || conn.tenant_name}</div>
                        <div className="text-sm text-[var(--text-secondary)]">
                          {conn.organisation_type} - {conn.country_code} - {conn.base_currency}
                        </div>
                      </div>
                      {conn.is_demo_company && (
                        <span className="priority-badge medium">Demo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-[var(--text-muted)]">
                        Connected {new Date(conn.connected_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => handleSelectConnection(conn)}
                        className={`btn ${activeConnection?.tenant_id === conn.tenant_id ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        {activeConnection?.tenant_id === conn.tenant_id ? 'Active' : 'Select'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function DashboardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="loading-spinner" />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  )
}
