/**
 * Dashboard - Scientific Luxury Tier
 *
 * Features:
 * - Dynamic Island navigation
 * - Asymmetrical 40/60 layouts
 * - Data strips for information display
 * - Holographic panels for hero sections
 * - JetBrains Mono data typography
 * - OLED void backgrounds with glass surfaces
 */

'use client'

import { useCallback, useEffect, Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { apiRequest, ApiRequestError } from '@/lib/api/client'
import {
  DollarSign,
  Beaker,
  FileSearch,
  TrendingDown,
  Building2,
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
import { DynamicIsland, VerticalNav } from '@/components/ui/DynamicIsland'
import { DataStrip, DataStripGroup } from '@/components/ui/DataStrip'
import { HoloPanel, HoloPanelGrid } from '@/components/ui/HoloPanel'
import { MobileNav } from '@/components/ui/MobileNav'

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
  const [activeOperations, setActiveOperations] = useState<ActiveOperation[]>([])
  const [recentCompletions, setRecentCompletions] = useState<RecentCompletion[]>([])

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

  const checkActiveOperations = useCallback(async () => {
    if (!activeConnection) return

    try {
      const dqResponse = await fetch(`/api/data-quality/scan?tenantId=${activeConnection.tenant_id}`)
      const dqData = await dqResponse.json()

      const syncResponse = await fetch(`/api/audit/sync-status/${activeConnection.tenant_id}`)
      const syncData = await syncResponse.json()

      const analysisResponse = await fetch(`/api/audit/analysis-status/${activeConnection.tenant_id}`)
      const analysisData = await analysisResponse.json()

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
          total: analysisData.totalTransactions || 1000,
          status: 'running',
          startedAt: new Date()
        })
      }

      setActiveOperations(operations)

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
    <div style={{ minHeight: '100vh' }}>
      {/* Dynamic Island Navigation */}
      <DynamicIsland showLogo />

      {/* Vertical Navigation (Desktop) */}
      <VerticalNav />

      {/* Main Content */}
      <main className="main-content" style={{
        paddingTop: 'var(--space-3xl)',
      }}>
        {/* Success Banner */}
        <AnimatePresence>
          {justConnected && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="alert alert--success"
              style={{ marginBottom: 'var(--space-lg)' }}
            >
              <CheckCircle className="w-5 h-5" />
              <span>Xero account connected successfully</span>
            </motion.div>
          )}
        </AnimatePresence>

        {summaryError && (
          <div className="alert alert--error" style={{ marginBottom: 'var(--space-lg)' }}>
            <AlertTriangle className="w-5 h-5" />
            <span>{summaryError}</span>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div className="loading-spinner" />
          </div>
        ) : !hasConnections ? (
          /* Empty State - No Connections */
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            style={{ textAlign: 'center', paddingTop: 'var(--space-3xl)', paddingBottom: 'var(--space-3xl)' }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              style={{
                width: 80,
                height: 80,
                borderRadius: 20,
                background: 'var(--accent-xero-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-xl)',
              }}
            >
              <Building2 className="w-10 h-10" style={{ color: 'var(--accent-xero)' }} />
            </motion.div>

            <h1 className="typo-display" style={{ marginBottom: 'var(--space-md)' }}>
              Connect Your Data
            </h1>
            <p className="typo-subtitle" style={{ maxWidth: 480, margin: '0 auto var(--space-xl)' }}>
              Link your Xero account to unlock AI-powered tax analysis
              and discover optimisation opportunities.
            </p>

            <Link href="/api/auth/xero" className="btn btn-xero" style={{ padding: 'var(--space-md) var(--space-xl)' }}>
              <DollarSign className="w-5 h-5" />
              Connect Xero Account
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        ) : (
          <>
            {/* Header Section */}
            <motion.header
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              style={{ marginBottom: 'var(--space-2xl)' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <h1 className="typo-display" style={{ marginBottom: 'var(--space-xs)' }}>
                    Tax Intelligence
                  </h1>
                  <p className="typo-subtitle">
                    {activeConnection
                      ? activeConnection.organisation_name || activeConnection.tenant_name
                      : 'Select an organisation'
                    }
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  {activeConnection && (
                    <button onClick={fetchConnections} className="btn btn-secondary">
                      <RefreshCw className="w-4 h-4" />
                      Sync
                    </button>
                  )}
                  <Link href="/api/auth/xero" className="btn btn-xero">
                    <Plus className="w-4 h-4" />
                    Add
                  </Link>
                </div>
              </div>
            </motion.header>

            {/* Active Operations */}
            <AnimatePresence>
              {activeOperations.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  style={{ marginBottom: 'var(--space-2xl)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                    <Zap className="w-4 h-4" style={{ color: 'var(--signal-high)' }} />
                    <span className="typo-label-md">Active Operations</span>
                  </div>

                  <div className="layout-stack">
                    {activeOperations.map((op, index) => (
                      <LiveProgressCard
                        key={op.id}
                        title={op.title}
                        value={op.current}
                        total={op.total}
                        percentage={op.progress}
                        icon={
                          op.type === 'data-quality' ? <Scan className="w-5 h-5" /> :
                          op.type === 'forensic-audit' ? <FileSearch className="w-5 h-5" /> :
                          <RefreshCw className="w-5 h-5" />
                        }
                        color={
                          op.type === 'data-quality' ? 'info' :
                          op.type === 'forensic-audit' ? 'ai' :
                          'xero'
                        }
                        subtitle={`Started ${op.startedAt.toLocaleTimeString()}`}
                        eta={op.eta}
                        isAnimating={true}
                        className={`stagger-${index + 1}`}
                      />
                    ))}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Stats Cards Row - Bento Style */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{ marginBottom: 'var(--space-xl)' }}
            >
              <div className="bento-grid bento-grid--stats">
                {/* R&D Candidate Spend */}
                <motion.div
                  className="stat-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <span className="stat-card__label">R&D Candidate Spend</span>
                  <AnimatedCounter
                    value={summary?.rndValue ?? 0}
                    format="currency"
                    decimals={0}
                    size="md"
                    variant="highlight"
                  />
                </motion.div>

                {/* Potential Refund */}
                <motion.div
                  className="stat-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <span className="stat-card__label">Potential Refund</span>
                  <AnimatedCounter
                    value={summary?.rndValue ? Math.round(summary.rndValue * 0.435) : 0}
                    format="currency"
                    decimals={0}
                    size="md"
                    variant="positive"
                  />
                  <span className="stat-card__trend stat-card__trend--up">43.5% offset</span>
                </motion.div>

                {/* Transactions */}
                <motion.div
                  className="stat-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <span className="stat-card__label">Transactions Scanned</span>
                  <AnimatedCounter
                    value={summary?.total ?? 0}
                    format="number"
                    decimals={0}
                    size="md"
                  />
                </motion.div>

                {/* Items to Review */}
                <motion.div
                  className="stat-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <span className="stat-card__label">Needs Review</span>
                  <AnimatedCounter
                    value={summary?.needsReview ?? 0}
                    format="number"
                    decimals={0}
                    size="md"
                  />
                  {(summary?.needsReview ?? 0) > 0 && (
                    <span className="stat-card__trend stat-card__trend--down">Action required</span>
                  )}
                </motion.div>

                {/* Connections */}
                <motion.div
                  className="stat-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <span className="stat-card__label">Xero Connections</span>
                  <AnimatedCounter
                    value={connections.length}
                    format="number"
                    decimals={0}
                    size="md"
                  />
                  <span className="stat-card__trend stat-card__trend--up">Active</span>
                </motion.div>
              </div>
            </motion.section>

            {/* Recent Completions */}
            {recentCompletions.length > 0 && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                style={{ marginTop: 'var(--space-2xl)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                  <CheckCircle className="w-4 h-4" style={{ color: 'var(--signal-success)' }} />
                  <span className="typo-label-md">Recent Completions</span>
                </div>

                <DataStripGroup>
                  {recentCompletions.map((completion, index) => (
                    <DataStrip
                      key={completion.id}
                      priority="success"
                      label={<span className="typo-label">{completion.type}</span>}
                      metric={
                        completion.value !== undefined ? (
                          <span className="typo-data" style={{ color: 'var(--signal-success)' }}>
                            {completion.value.toLocaleString()}
                          </span>
                        ) : null
                      }
                      delay={0.1 * index}
                    >
                      <div>
                        <span className="typo-subtitle">{completion.title}</span>
                        <span className="typo-label" style={{ marginLeft: 'var(--space-sm)' }}>
                          {completion.completedAt.toLocaleTimeString()}
                        </span>
                      </div>
                    </DataStrip>
                  ))}
                </DataStripGroup>
              </motion.section>
            )}

            {/* Quick Actions - Feature Cards */}
            <section style={{ marginTop: 'var(--space-xl)' }}>
              <span className="typo-label-md" style={{ marginBottom: 'var(--space-md)', display: 'block' }}>
                Quick Actions
              </span>

              <div className="bento-grid bento-grid--features">
                <Link href="/dashboard/data-quality" className="feature-card">
                  <div className="feature-card__icon feature-card__icon--blue">
                    <Scan className="w-6 h-6" />
                  </div>
                  <h3 className="feature-card__title">Data Quality</h3>
                  <p className="feature-card__description">
                    AI-powered validation and auto-correction
                  </p>
                  <span className="feature-card__action">
                    Start Scan <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>

                <Link href="/dashboard/forensic-audit" className="feature-card">
                  <div className="feature-card__icon feature-card__icon--purple">
                    <FileSearch className="w-6 h-6" />
                  </div>
                  <h3 className="feature-card__title">Forensic Audit</h3>
                  <p className="feature-card__description">
                    5-year comprehensive AI analysis
                  </p>
                  <span className="feature-card__action">
                    Run Audit <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>

                <Link href="/dashboard/rnd" className="feature-card">
                  <div className="feature-card__icon feature-card__icon--green">
                    <Beaker className="w-6 h-6" />
                  </div>
                  <h3 className="feature-card__title">R&D Assessment</h3>
                  <p className="feature-card__description">
                    Division 355 eligibility review
                  </p>
                  <span className="feature-card__action">
                    Start Review <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
              </div>
            </section>

            {/* Connected Organizations */}
            <section style={{ marginTop: 'var(--space-xl)' }}>
              <span className="typo-label-md" style={{ marginBottom: 'var(--space-md)', display: 'block' }}>
                Connected Organisations
              </span>

              <div className="layout-stack">
                {connections.map((conn) => (
                  <motion.div
                    key={conn.tenant_id}
                    className={`org-card ${activeConnection?.tenant_id === conn.tenant_id ? 'org-card--active' : ''}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="org-card__icon">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="org-card__info">
                      <div className="org-card__name">
                        {conn.organisation_name || conn.tenant_name}
                      </div>
                      <div className="org-card__meta">
                        {conn.organisation_type} • {conn.country_code} • {conn.base_currency}
                        {conn.is_demo_company && ' • Demo'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSelectConnection(conn)}
                      className={activeConnection?.tenant_id === conn.tenant_id ? 'btn btn-primary' : 'btn btn-secondary'}
                      style={{ padding: 'var(--space-xs) var(--space-md)' }}
                    >
                      {activeConnection?.tenant_id === conn.tenant_id ? 'Active' : 'Select'}
                    </button>
                  </motion.div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  )
}

function DashboardLoading() {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="spinner" />
      </motion.div>
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
