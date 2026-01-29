/**
 * Dashboard - Simplified & Clear UI
 *
 * Features:
 * - Clear "LIVE DATA" indicator showing real Xero connection
 * - Simple progress tracking
 * - Easy-to-understand organisation switcher
 * - Real-time sync status
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
  Zap,
  Shield,
  Database,
  Activity,
  Clock
} from 'lucide-react'
import AnimatedCounter from '@/components/dashboard/AnimatedCounter'
import LiveProgressCard from '@/components/dashboard/LiveProgressCard'
import { DataStrip, DataStripGroup } from '@/components/ui/DataStrip'
import { HoloPanel, HoloPanelGrid } from '@/components/ui/HoloPanel'
import { PlatformConnections } from '@/components/dashboard/PlatformConnections'

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

interface MYOBConnection {
  id: string
  companyFileId: string
  companyFileName: string
  countryCode: string
  currencyCode: string
  connectedAt: string
  lastSyncedAt: string | null
  expiresAt: string
  isExpired: boolean
}

type PlatformConnection = {
  id: string
  platform: 'xero' | 'myob'
  name: string
  type: string
  country: string
  currency: string
  isDemo: boolean
  isExpired?: boolean
  tenantId?: string
  companyFileId?: string
}

type TransactionsSummary = {
  total: number
  rndCandidates: number
  rndValue: number
  needsReview: number
  missingTaxTypes: number
  // From cached/analyzed data
  cachedTransactions: number
  analyzedTransactions: number
  totalBenefit: number
  dataSource: 'cached' | 'live'
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
  const [myobConnections, setMyobConnections] = useState<MYOBConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [activeConnection, setActiveConnection] = useState<PlatformConnection | null>(null)
  const [summary, setSummary] = useState<TransactionsSummary | null>(null)
  const [_summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [activeOperations, setActiveOperations] = useState<ActiveOperation[]>([])
  const [recentCompletions, setRecentCompletions] = useState<RecentCompletion[]>([])

  const fetchSummary = useCallback(async (tenantId: string) => {
    try {
      setSummaryLoading(true)
      setSummaryError(null)

      // Fetch from CACHED data (synced historical transactions) and AI analysis
      const [cachedRes, recommendationsRes] = await Promise.all([
        fetch(`/api/audit/cached-transactions?tenantId=${encodeURIComponent(tenantId)}&limit=1`),
        fetch(`/api/audit/recommendations?tenantId=${encodeURIComponent(tenantId)}`)
      ])

      const cachedData = await cachedRes.json()
      const recData = await recommendationsRes.json()

      // Get counts from cached data
      const cachedTotal = cachedData.summary?.totalTransactions || cachedData.pagination?.total || 0

      // Get R&D findings from AI analysis recommendations
      const rndBenefit = recData.summary?.byTaxArea?.rnd || 0
      const totalBenefit = recData.summary?.totalAdjustedBenefit || recData.summary?.totalEstimatedBenefit || 0
      const rndRecommendations = recData.recommendations?.filter((r: { taxArea: string }) => r.taxArea === 'rnd') || []

      // If we have cached data, use it; otherwise fall back to live API
      if (cachedTotal > 0) {
        setSummary({
          total: cachedTotal,
          rndCandidates: rndRecommendations.length,
          rndValue: rndBenefit,
          needsReview: recData.summary?.byPriority?.high || 0,
          missingTaxTypes: 0,
          cachedTransactions: cachedTotal,
          analyzedTransactions: recData.summary?.totalRecommendations || 0,
          totalBenefit: totalBenefit,
          dataSource: 'cached'
        })
      } else {
        // Fallback to live Xero API if no cached data
        const liveData = await apiRequest<{ summary: { total: number; rndCandidates: number; rndValue: number; needsReview: number; missingTaxTypes: number } }>(
          `/api/xero/transactions?tenantId=${encodeURIComponent(tenantId)}`
        )
        setSummary({
          ...liveData.summary,
          cachedTransactions: 0,
          analyzedTransactions: 0,
          totalBenefit: 0,
          dataSource: 'live'
        })
      }
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
      // Fetch both Xero and MYOB connections in parallel
      const [xeroData, myobData] = await Promise.all([
        apiRequest<{ connections: Connection[] }>('/api/xero/organizations').catch(() => ({ connections: [] })),
        apiRequest<{ connections: MYOBConnection[] }>('/api/myob/connections').catch(() => ({ connections: [] }))
      ])

      setConnections(xeroData.connections || [])
      setMyobConnections(myobData.connections || [])

      // Set active connection to first available (Xero first, then MYOB)
      if (xeroData.connections?.length > 0) {
        const xeroConn = xeroData.connections[0]
        const platformConn: PlatformConnection = {
          id: xeroConn.tenant_id,
          platform: 'xero',
          name: xeroConn.organisation_name || xeroConn.tenant_name,
          type: xeroConn.organisation_type,
          country: xeroConn.country_code,
          currency: xeroConn.base_currency,
          isDemo: xeroConn.is_demo_company,
          tenantId: xeroConn.tenant_id,
        }
        setActiveConnection(platformConn)
        fetchSummary(xeroConn.tenant_id)
      } else if (myobData.connections?.length > 0) {
        const myobConn = myobData.connections[0]
        const platformConn: PlatformConnection = {
          id: myobConn.id,
          platform: 'myob',
          name: myobConn.companyFileName,
          type: 'Company File',
          country: myobConn.countryCode,
          currency: myobConn.currencyCode,
          isDemo: false,
          isExpired: myobConn.isExpired,
          companyFileId: myobConn.companyFileId,
        }
        setActiveConnection(platformConn)
        // MYOB data sync will come later, for now just set it
        setSummary(null)
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
      const dqResponse = await fetch(`/api/data-quality/scan?tenantId=${activeConnection.tenantId}`)
      const dqData = await dqResponse.json()

      const syncResponse = await fetch(`/api/audit/sync-status/${activeConnection.tenantId}`)
      const syncData = await syncResponse.json()

      const analysisResponse = await fetch(`/api/audit/analysis-status/${activeConnection.tenantId}`)
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

  function handleSelectConnection(connection: PlatformConnection) {
    setActiveConnection(connection)
    // Only fetch summary for Xero connections (MYOB sync coming later)
    if (connection.platform === 'xero' && connection.tenantId) {
      fetchSummary(connection.tenantId)
    } else {
      setSummary(null)
    }
  }

  const hasConnections = connections.length > 0 || myobConnections.length > 0
  const totalConnections = connections.length + myobConnections.length

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Main Content */}
      <main className="main-content" style={{
        paddingTop: 'var(--space-3xl)',
      }}>
        {/* LIVE DATA Banner - Always visible when connected */}
        {hasConnections && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-sm) var(--space-md)',
              marginBottom: 'var(--space-lg)',
              background: 'linear-gradient(90deg, var(--color-success-dim) 0%, rgba(16, 185, 129, 0.05) 100%)',
              borderRadius: '12px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                background: 'var(--color-success-dim)',
                borderRadius: '20px',
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--color-success)',
                  animation: 'pulse 2s infinite',
                }} />
                <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: '12px', letterSpacing: '0.5px' }}>
                  LIVE DATA
                </span>
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                Connected to Xero • Real financial data
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', color: 'var(--text-muted)', fontSize: '12px' }}>
              <Shield className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
              <span>Read-only access</span>
            </div>
          </motion.div>
        )}

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
            {/* Active Operations - Enhanced with clear progress */}
            <AnimatePresence>
              {activeOperations.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  style={{
                    marginBottom: 'var(--space-xl)',
                    padding: 'var(--space-md)',
                    background: 'var(--color-indigo-dim)',
                    borderRadius: '16px',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      <Activity className="w-5 h-5" style={{ color: 'var(--color-indigo)' }} />
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                        Processing Your Data
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <Clock className="w-3 h-3" />
                      <span>Running in background</span>
                    </div>
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
              {/* Data Source Indicator */}
              {summary?.dataSource === 'cached' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-xs)',
                  marginBottom: 'var(--space-md)',
                  fontSize: '12px',
                  color: 'var(--color-success)'
                }}>
                  <Database className="w-4 h-4" />
                  <span>Showing AI-analyzed historical data (5 years)</span>
                </div>
              )}
              <div className="bento-grid bento-grid--stats">
                {/* Total Tax Benefit Found */}
                <motion.div
                  className="stat-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <span className="stat-card__label">Total Tax Benefit Found</span>
                  <AnimatedCounter
                    value={summary?.totalBenefit ?? 0}
                    format="currency"
                    decimals={0}
                    size="md"
                    variant="positive"
                  />
                  {(summary?.totalBenefit ?? 0) > 0 && (
                    <span className="stat-card__trend stat-card__trend--up">AI Analyzed</span>
                  )}
                </motion.div>

                {/* R&D Tax Offset */}
                <motion.div
                  className="stat-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <span className="stat-card__label">R&D Tax Offset</span>
                  <AnimatedCounter
                    value={summary?.rndValue ?? 0}
                    format="currency"
                    decimals={0}
                    size="md"
                    variant="highlight"
                  />
                  {(summary?.rndValue ?? 0) > 0 && (
                    <span className="stat-card__trend stat-card__trend--up">Division 355</span>
                  )}
                </motion.div>

                {/* Historical Transactions */}
                <motion.div
                  className="stat-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <span className="stat-card__label">Historical Transactions</span>
                  <AnimatedCounter
                    value={summary?.cachedTransactions ?? summary?.total ?? 0}
                    format="number"
                    decimals={0}
                    size="md"
                  />
                  {(summary?.cachedTransactions ?? 0) > 0 && (
                    <span className="stat-card__trend stat-card__trend--up">Synced</span>
                  )}
                </motion.div>

                {/* High Priority Items */}
                <motion.div
                  className="stat-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <span className="stat-card__label">High Priority</span>
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
                  <span className="stat-card__label">Platform Connections</span>
                  <AnimatedCounter
                    value={totalConnections}
                    format="number"
                    decimals={0}
                    size="md"
                  />
                  <span className="stat-card__trend stat-card__trend--up">
                    {connections.length > 0 && myobConnections.length > 0
                      ? 'Xero + MYOB'
                      : connections.length > 0
                      ? 'Xero'
                      : 'MYOB'
                    }
                  </span>
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

            {/* Connected Platforms - Xero + MYOB */}
            <PlatformConnections
              xeroConnections={connections}
              myobConnections={myobConnections}
              activeConnectionId={activeConnection?.id || null}
              onSelectConnection={handleSelectConnection}
            />
          </>
        )}
      </main>
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
