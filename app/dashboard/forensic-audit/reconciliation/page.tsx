/**
 * Reconciliation Analysis Dashboard
 *
 * Scientific Luxury Design System implementation.
 * Shows reconciliation status across all accounts:
 * - Unreconciled bank transactions
 * - Suggested matches (bank <-> invoice)
 * - Duplicate detection
 * - Missing transaction entries
 */

'use client'

import { Suspense, useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { MobileNav } from '@/components/ui/MobileNav'
import { generateXeroUrl } from '@/lib/xero/url-generator'

// ─── Types ───────────────────────────────────────────────────────────

interface ReconciliationData {
  tenantId: string
  analysedAt: string
  totalBankTransactions: number
  totalInvoices: number
  unreconciledItems: UnreconciledItem[]
  unreconciledCount: number
  unreconciledAmount: number
  suggestedMatches: SuggestedMatch[]
  matchCount: number
  matchAmount: number
  duplicates: DuplicateGroup[]
  duplicateCount: number
  duplicateExposure: number
  missingEntries: MissingEntry[]
  missingCount: number
  missingAmount: number
  byFinancialYear: Record<string, YearReconciliation>
}

interface UnreconciledItem {
  transactionId: string
  transactionType: string
  transactionDate: string
  contactName: string | null
  description: string | null
  amount: number
  accountCode: string | null
  financialYear: string
  daysPending: number
  status: string
}

interface SuggestedMatch {
  bankTransaction: TransactionRef
  matchedTransaction: TransactionRef
  matchScore: number
  matchReasons: string[]
  amountDifference: number
  dateDifference: number
}

interface TransactionRef {
  transactionId: string
  transactionType: string
  transactionDate: string
  contactName: string | null
  description: string | null
  amount: number
  reference: string | null
  accountCode: string | null
}

interface DuplicateGroup {
  duplicateType: 'exact' | 'probable' | 'possible'
  confidence: number
  totalExposure: number
  matchReasons: string[]
  transactions: TransactionRef[]
}

interface MissingEntry {
  invoice: TransactionRef
  expectedType: 'bank_payment' | 'bank_receipt'
  reason: string
  daysSinceInvoice: number
}

interface YearReconciliation {
  financialYear: string
  unreconciledCount: number
  unreconciledAmount: number
  suggestedMatches: number
  duplicates: number
  missingEntries: number
}

type TabType = 'unreconciled' | 'matches' | 'duplicates' | 'missing'

const PAGE_SIZE = 25

// ─── Design Tokens ───────────────────────────────────────────────────

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
  magenta: '#FF00FF',
  grey: '#6B7280',
} as const

const TAB_COLOURS: Record<TabType, string> = {
  unreconciled: SPECTRAL.amber,
  matches: SPECTRAL.cyan,
  duplicates: SPECTRAL.red,
  missing: SPECTRAL.magenta,
}

const EASING = {
  outExpo: [0.19, 1, 0.22, 1] as const,
  smooth: [0.4, 0, 0.2, 1] as const,
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatCurrencyFull(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getXeroUrl(transactionId: string, transactionType: string): string | null {
  return generateXeroUrl({ transactionId, transactionType })
}

// ─── Breathing Orb ──────────────────────────────────────────────────

function BreathingOrb({ colour, isActive = true, size = 'sm' }: {
  colour: string
  isActive?: boolean
  size?: 'xs' | 'sm' | 'md'
}) {
  const sizes = { xs: 'h-5 w-5', sm: 'h-8 w-8', md: 'h-12 w-12' }
  const dotSizes = { xs: 'h-1.5 w-1.5', sm: 'h-2 w-2', md: 'h-3 w-3' }

  return (
    <motion.div
      className={`${sizes[size]} flex items-center justify-center rounded-full border-[0.5px]`}
      style={{
        borderColor: isActive ? `${colour}50` : 'rgba(255,255,255,0.1)',
        backgroundColor: isActive ? `${colour}10` : 'rgba(255,255,255,0.02)',
        boxShadow: isActive ? `0 0 30px ${colour}40` : 'none',
      }}
    >
      <motion.div
        className={`${dotSizes[size]} rounded-full`}
        style={{ backgroundColor: colour }}
        animate={isActive ? { scale: [1, 1.3, 1], opacity: [1, 0.6, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  )
}

// ─── External Link Icon ─────────────────────────────────────────────

function ExternalLinkIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

// ─── Component ───────────────────────────────────────────────────────

export default function ReconciliationPageWrapper() {
  return (
    <>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen" style={{ background: '#050505' }}>
          <div className="flex flex-col items-center gap-4">
            <BreathingOrb colour={SPECTRAL.cyan} isActive size="md" />
            <p className="text-white/40 text-[10px] uppercase tracking-[0.3em]">Loading Reconciliation</p>
          </div>
        </div>
      }>
        <ReconciliationPage />
      </Suspense>
      <TaxDisclaimer sticky />
    </>
  )
}

function ReconciliationPage() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReconciliationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('unreconciled')
  const [tenantId, setTenantId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTenantId() {
      const urlTenantId = searchParams.get('tenantId')
      if (urlTenantId) {
        setTenantId(urlTenantId)
        return
      }
      try {
        const response = await fetch('/api/xero/organizations')
        const orgData = await response.json()
        if (orgData.connections?.length > 0) {
          setTenantId(orgData.connections[0].tenant_id)
        } else {
          setError('No Xero connections found. Please connect your Xero account first.')
        }
      } catch {
        setError('Failed to load Xero connection')
      }
    }
    fetchTenantId()
  }, [searchParams])

  useEffect(() => {
    if (tenantId) {
      loadReconciliation()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  async function loadReconciliation() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/audit/reconciliation?tenantId=${tenantId}`)
      const result = await response.json()
      if (result.data) {
        setData(result.data)
        const counts = {
          unreconciled: result.data.unreconciledCount,
          matches: result.data.matchCount,
          duplicates: result.data.duplicateCount,
          missing: result.data.missingCount,
        }
        const maxTab = Object.entries(counts).reduce((a, b) => (b[1] > a[1] ? b : a))
        if (maxTab[1] > 0) {
          setActiveTab(maxTab[0] as TabType)
        }
      } else {
        setError(result.error || 'Failed to load reconciliation data')
      }
    } catch {
      setError('Failed to fetch reconciliation analysis')
    } finally {
      setLoading(false)
    }
  }

  const totalIssues = data
    ? data.unreconciledCount + data.matchCount + data.duplicateCount + data.missingCount
    : 0

  const totalExposure = data
    ? data.unreconciledAmount + data.matchAmount + data.duplicateExposure + data.missingAmount
    : 0

  const tabs: { key: TabType; label: string; count: number }[] = data
    ? [
        { key: 'unreconciled', label: 'Unreconciled', count: data.unreconciledCount },
        { key: 'matches', label: 'Suggested Matches', count: data.matchCount },
        { key: 'duplicates', label: 'Duplicates', count: data.duplicateCount },
        { key: 'missing', label: 'Missing Entries', count: data.missingCount },
      ]
    : []

  return (
    <div className="min-h-screen text-white" style={{ background: '#050505' }}>
      <MobileNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Navigation ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASING.outExpo }}
          className="flex items-center justify-between mb-10"
        >
          <Link
            href={`/dashboard/forensic-audit${tenantId ? `?tenantId=${tenantId}` : ''}`}
            className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 text-[10px] uppercase tracking-[0.3em] transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Forensic Audit
          </Link>
          {data && !loading && (
            <button
              onClick={() => loadReconciliation()}
              className="inline-flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/70 border-[0.5px] border-white/[0.06] hover:border-white/[0.1] rounded-sm transition-colors"
              style={{ background: 'rgba(255,255,255,0.01)' }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          )}
        </motion.div>

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASING.outExpo }}
          className="mb-12 text-center"
        >
          <h1 className="text-5xl font-extralight tracking-tight text-white">
            Reconciliation Analysis
          </h1>
          <p className="text-white/30 mt-3 text-sm tracking-wide">
            Unreconciled items, suggested matches, and potential duplicates across all accounts
          </p>
        </motion.div>

        {/* ── Loading ── */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-20 flex flex-col items-center gap-6"
          >
            <BreathingOrb colour={SPECTRAL.cyan} isActive size="md" />
            <div className="text-center">
              <p className="text-white/50 text-sm">Analysing reconciliation status</p>
              <p className="text-white/20 text-[10px] uppercase tracking-[0.3em] mt-2">
                Scanning bank transactions, invoices, and matching patterns
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Error ── */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASING.outExpo }}
            className="mt-8 p-5 border-[0.5px] rounded-sm"
            style={{
              borderColor: `${SPECTRAL.red}30`,
              backgroundColor: `${SPECTRAL.red}08`,
            }}
          >
            <div className="flex items-start gap-4">
              <BreathingOrb colour={SPECTRAL.red} isActive size="sm" />
              <div>
                <h3 className="text-sm font-medium" style={{ color: SPECTRAL.red }}>Analysis Error</h3>
                <p className="text-white/50 mt-1 text-sm">{error}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Data Loaded ── */}
        {data && !loading && (
          <>
            {/* ── Data Strip: Overview Metrics ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: EASING.outExpo }}
              className="mb-10 flex flex-wrap items-center justify-center gap-8 px-6 py-4 border-[0.5px] border-white/[0.06] rounded-sm"
              style={{ background: 'rgba(255,255,255,0.01)' }}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">Issues Found</span>
                <span className="font-mono text-2xl font-medium text-white/90 tabular-nums">
                  {totalIssues.toLocaleString()}
                </span>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">Total Exposure</span>
                <span className="font-mono text-2xl font-medium tabular-nums" style={{ color: SPECTRAL.red }}>
                  {formatCurrency(totalExposure)}
                </span>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">Scanned</span>
                <span className="font-mono text-2xl font-medium text-white/70 tabular-nums">
                  {(data.totalBankTransactions + data.totalInvoices).toLocaleString()}
                </span>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">Bank</span>
                <span className="font-mono text-lg text-white/50 tabular-nums">
                  {data.totalBankTransactions.toLocaleString()}
                </span>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">Invoices</span>
                <span className="font-mono text-lg text-white/50 tabular-nums">
                  {data.totalInvoices.toLocaleString()}
                </span>
              </div>
            </motion.div>

            {/* ── Category Indicators ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: EASING.outExpo }}
              className="mb-10 flex flex-wrap items-stretch justify-center gap-4"
            >
              {[
                { key: 'unreconciled' as TabType, label: 'Unreconciled', count: data.unreconciledCount, amount: data.unreconciledAmount, colour: SPECTRAL.amber, subtitle: 'Pending reconciliation' },
                { key: 'matches' as TabType, label: 'Suggested Matches', count: data.matchCount, amount: data.matchAmount, colour: SPECTRAL.cyan, subtitle: 'Potential matches found' },
                { key: 'duplicates' as TabType, label: 'Duplicates', count: data.duplicateCount, amount: data.duplicateExposure, colour: SPECTRAL.red, subtitle: 'Duplicate exposure' },
                { key: 'missing' as TabType, label: 'Missing Entries', count: data.missingCount, amount: data.missingAmount, colour: SPECTRAL.magenta, subtitle: 'Missing bank entries' },
              ].map((cat, idx) => {
                const isActive = activeTab === cat.key
                return (
                  <motion.button
                    key={cat.key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + idx * 0.08, duration: 0.5, ease: EASING.outExpo }}
                    onClick={() => setActiveTab(cat.key)}
                    className="flex-1 min-w-[200px] max-w-[260px] p-5 rounded-sm border-[0.5px] text-left transition-all cursor-pointer"
                    style={{
                      borderColor: isActive ? `${cat.colour}40` : 'rgba(255,255,255,0.06)',
                      backgroundColor: isActive ? `${cat.colour}08` : 'rgba(255,255,255,0.01)',
                      boxShadow: isActive ? `0 0 40px ${cat.colour}15` : 'none',
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <BreathingOrb colour={cat.colour} isActive={cat.count > 0} size="xs" />
                      <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">{cat.label}</span>
                    </div>
                    <div className="font-mono text-3xl font-medium tabular-nums" style={{ color: cat.colour }}>
                      {cat.count.toLocaleString()}
                    </div>
                    <div className="font-mono text-sm text-white/40 mt-1 tabular-nums">
                      {formatCurrency(cat.amount)}
                    </div>
                    <p className="text-[10px] text-white/20 mt-2 tracking-wide">{cat.subtitle}</p>
                  </motion.button>
                )
              })}
            </motion.div>

            {/* ── Financial Year Breakdown ── */}
            {Object.keys(data.byFinancialYear).length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3, ease: EASING.outExpo }}
                className="mb-10"
              >
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-4 text-center">
                  Breakdown by Financial Year
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {Object.entries(data.byFinancialYear)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([fy, yr], idx) => {
                      const yearTotal = yr.unreconciledCount + yr.suggestedMatches + yr.duplicates + yr.missingEntries
                      return (
                        <motion.div
                          key={fy}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + idx * 0.05, duration: 0.4, ease: EASING.outExpo }}
                          className="p-4 border-[0.5px] border-white/[0.06] rounded-sm min-w-[200px]"
                          style={{ background: 'rgba(255,255,255,0.01)' }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-white/90 font-medium">{fy}</span>
                            <span className="text-[10px] text-white/30 font-mono tabular-nums">
                              {yearTotal} issues
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {[
                              { count: yr.unreconciledCount, label: 'unrec.', colour: SPECTRAL.amber },
                              { count: yr.suggestedMatches, label: 'match', colour: SPECTRAL.cyan },
                              { count: yr.duplicates, label: 'dupl.', colour: SPECTRAL.red },
                              { count: yr.missingEntries, label: 'miss.', colour: SPECTRAL.magenta },
                            ].map((item) => (
                              <div key={item.label} className="flex items-center gap-1.5">
                                <div
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: item.colour }}
                                />
                                <span className="text-[10px] text-white/30 font-mono tabular-nums">
                                  {item.count}
                                </span>
                              </div>
                            ))}
                          </div>
                          {yr.unreconciledAmount > 0 && (
                            <p className="mt-2 text-xs font-mono tabular-nums" style={{ color: `${SPECTRAL.amber}80` }}>
                              {formatCurrency(yr.unreconciledAmount)}
                            </p>
                          )}
                        </motion.div>
                      )
                    })}
                </div>
              </motion.div>
            )}

            {/* ── Tab Navigation ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.35, ease: EASING.outExpo }}
              className="border-b border-white/[0.06] mb-0"
            >
              <div className="flex gap-0 justify-center">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.key
                  const colour = TAB_COLOURS[tab.key]

                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className="relative px-6 py-4 text-[11px] uppercase tracking-[0.15em] font-medium transition-all"
                      style={{
                        color: isActive ? colour : 'rgba(255,255,255,0.3)',
                        borderBottom: isActive ? `1px solid ${colour}` : '1px solid transparent',
                        background: isActive ? `${colour}05` : 'transparent',
                      }}
                    >
                      {tab.label}
                      <span
                        className="ml-2 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold tabular-nums"
                        style={{
                          backgroundColor: isActive ? `${colour}15` : 'rgba(255,255,255,0.03)',
                          color: isActive ? colour : 'rgba(255,255,255,0.3)',
                        }}
                      >
                        {tab.count.toLocaleString()}
                      </span>
                    </button>
                  )
                })}
              </div>
            </motion.div>

            {/* ── Tab Content ── */}
            <div
              className="border-x border-b border-white/[0.06] rounded-b-sm p-6 min-h-[300px]"
              style={{ background: 'rgba(255,255,255,0.01)' }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: EASING.smooth }}
                >
                  {activeTab === 'unreconciled' && <UnreconciledTab items={data.unreconciledItems} />}
                  {activeTab === 'matches' && <MatchesTab matches={data.suggestedMatches} />}
                  {activeTab === 'duplicates' && <DuplicatesTab duplicates={data.duplicates} />}
                  {activeTab === 'missing' && <MissingTab entries={data.missingEntries} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Footer ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-8 text-center"
            >
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/20">
                Read-only analysis &mdash; No data modified in Xero &mdash; Last analysed {new Date(data.analysedAt).toLocaleString('en-AU')}
              </p>
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Pagination Hook ─────────────────────────────────────────────────

function usePagination<T>(items: T[], pageSize: number = PAGE_SIZE) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(items.length / pageSize)
  const paginated = useMemo(
    () => items.slice(page * pageSize, (page + 1) * pageSize),
    [items, page, pageSize]
  )
  const showing = { from: page * pageSize + 1, to: Math.min((page + 1) * pageSize, items.length), total: items.length }
  return { paginated, page, setPage, totalPages, showing }
}

function PaginationBar({ page, setPage, totalPages, showing }: {
  page: number
  setPage: (p: number) => void
  totalPages: number
  showing: { from: number; to: number; total: number }
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex flex-col items-center gap-3 mt-6 pt-4 border-t border-white/[0.06]">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="px-4 py-2 text-[10px] uppercase tracking-[0.2em] border-[0.5px] border-white/[0.06] rounded-sm text-white/40 hover:text-white/70 hover:border-white/[0.1] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          style={{ background: 'rgba(255,255,255,0.01)' }}
        >
          Previous
        </button>
        <span className="px-3 py-2 text-sm text-white/30 font-mono tabular-nums">
          {page + 1} / {totalPages}
        </span>
        <button
          onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="px-4 py-2 text-[10px] uppercase tracking-[0.2em] border-[0.5px] border-white/[0.06] rounded-sm text-white/40 hover:text-white/70 hover:border-white/[0.1] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          style={{ background: 'rgba(255,255,255,0.01)' }}
        >
          Next
        </button>
      </div>
      <p className="text-[10px] text-white/20 font-mono tabular-nums tracking-wider">
        Showing {showing.from}&ndash;{showing.to} of {showing.total.toLocaleString()}
      </p>
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────

function EmptyState({ colour, title, description }: {
  colour: string
  title: string
  description: string
}) {
  return (
    <div className="py-20 flex flex-col items-center gap-4">
      <BreathingOrb colour={colour} isActive={false} size="md" />
      <h3 className="text-lg font-light text-white/70">{title}</h3>
      <p className="text-white/30 text-sm">{description}</p>
    </div>
  )
}

// ─── Unreconciled Tab ────────────────────────────────────────────────

function UnreconciledTab({ items }: { items: UnreconciledItem[] }) {
  const { paginated, page, setPage, totalPages, showing } = usePagination(items)

  if (items.length === 0) {
    return <EmptyState colour={SPECTRAL.emerald} title="All Reconciled" description="All bank transactions have been reconciled successfully." />
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {['Date', 'Contact', 'Description', 'Account', 'FY', 'Amount', 'Age', 'Xero'].map((h, _i) => (
                <th
                  key={h}
                  className={`py-3 px-4 text-[10px] uppercase tracking-[0.2em] text-white/30 font-normal ${
                    h === 'Amount' ? 'text-right' : h === 'Age' || h === 'Xero' ? 'text-center' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((item, idx) => {
              const xeroUrl = getXeroUrl(item.transactionId, item.transactionType)
              return (
                <motion.tr
                  key={item.transactionId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02, duration: 0.3, ease: EASING.outExpo }}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3 px-4 text-white/50 whitespace-nowrap font-mono text-xs tabular-nums">
                    {formatDate(item.transactionDate)}
                  </td>
                  <td className="py-3 px-4 text-white/90 font-medium max-w-[200px] truncate">
                    {item.contactName || <span className="text-white/20 italic">Unknown</span>}
                  </td>
                  <td className="py-3 px-4 text-white/40 max-w-[250px] truncate">
                    {item.description || '\u2014'}
                  </td>
                  <td className="py-3 px-4">
                    {item.accountCode ? (
                      <span className="text-[10px] px-2 py-0.5 border-[0.5px] border-white/[0.06] rounded-sm text-white/40 font-mono">
                        {item.accountCode}
                      </span>
                    ) : (
                      <span className="text-white/20">&mdash;</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-white/30 text-xs font-mono whitespace-nowrap">{item.financialYear}</td>
                  <td className="py-3 px-4 text-right font-mono font-medium whitespace-nowrap tabular-nums" style={{ color: SPECTRAL.amber }}>
                    {formatCurrencyFull(Math.abs(item.amount))}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className="inline-block px-2 py-0.5 rounded-sm text-[10px] font-mono font-medium border-[0.5px] tabular-nums"
                      style={{
                        borderColor: item.daysPending > 90
                          ? `${SPECTRAL.red}30` : item.daysPending > 30
                          ? `${SPECTRAL.amber}30` : 'rgba(255,255,255,0.06)',
                        color: item.daysPending > 90
                          ? SPECTRAL.red : item.daysPending > 30
                          ? SPECTRAL.amber : 'rgba(255,255,255,0.4)',
                        backgroundColor: item.daysPending > 90
                          ? `${SPECTRAL.red}08` : item.daysPending > 30
                          ? `${SPECTRAL.amber}08` : 'transparent',
                      }}
                    >
                      {item.daysPending}d
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {xeroUrl ? (
                      <a
                        href={xeroUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-sm hover:bg-white/[0.04] transition-colors"
                        style={{ color: SPECTRAL.cyan }}
                        title="Open in Xero"
                      >
                        <ExternalLinkIcon />
                      </a>
                    ) : (
                      <span className="text-white/10">&mdash;</span>
                    )}
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <PaginationBar page={page} setPage={setPage} totalPages={totalPages} showing={showing} />
    </div>
  )
}

// ─── Matches Tab ─────────────────────────────────────────────────────

function MatchesTab({ matches }: { matches: SuggestedMatch[] }) {
  const { paginated, page, setPage, totalPages, showing } = usePagination(matches, 10)

  if (matches.length === 0) {
    return <EmptyState colour={SPECTRAL.cyan} title="No Matches Found" description="No potential bank-to-invoice matches were identified." />
  }

  return (
    <div className="space-y-4">
      {paginated.map((match, idx) => {
        const bankUrl = getXeroUrl(match.bankTransaction.transactionId, match.bankTransaction.transactionType)
        const invoiceUrl = getXeroUrl(match.matchedTransaction.transactionId, match.matchedTransaction.transactionType)
        const scoreColour = match.matchScore >= 80 ? SPECTRAL.emerald : match.matchScore >= 60 ? SPECTRAL.amber : SPECTRAL.grey

        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.5, ease: EASING.outExpo }}
            className="p-5 border-[0.5px] border-white/[0.06] rounded-sm hover:border-white/[0.1] transition-colors"
            style={{ background: 'rgba(255,255,255,0.01)' }}
          >
            {/* Score Header */}
            <div className="flex items-center justify-center gap-4 mb-5">
              <span
                className="px-3 py-1.5 rounded-sm text-sm font-mono font-bold border-[0.5px] tabular-nums"
                style={{
                  borderColor: `${scoreColour}30`,
                  color: scoreColour,
                  backgroundColor: `${scoreColour}08`,
                }}
              >
                {match.matchScore}% Match
              </span>
              <div className="flex gap-1.5 flex-wrap justify-center">
                {match.matchReasons.map((r) => (
                  <span key={r} className="px-2 py-0.5 text-[10px] border-[0.5px] border-white/[0.06] rounded-sm text-white/30 uppercase tracking-wider">
                    {r.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
              {match.amountDifference > 0 && (
                <span className="text-[10px] text-white/20 font-mono tabular-nums">
                  Diff: {formatCurrencyFull(match.amountDifference)} | {match.dateDifference}d
                </span>
              )}
            </div>

            {/* 60/40 asymmetrical match comparison */}
            <div className="flex gap-4">
              {/* Bank Transaction - 60% */}
              <div
                className="flex-[3] p-4 border-[0.5px] rounded-sm"
                style={{ borderColor: `${SPECTRAL.cyan}15`, background: `${SPECTRAL.cyan}03` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: `${SPECTRAL.cyan}80` }}>
                    Bank Transaction
                  </p>
                  {bankUrl && (
                    <a href={bankUrl} target="_blank" rel="noopener noreferrer"
                      className="hover:opacity-70 transition-opacity" style={{ color: SPECTRAL.cyan }}>
                      <ExternalLinkIcon />
                    </a>
                  )}
                </div>
                <p className="text-white/90 font-medium">{match.bankTransaction.contactName || 'Unknown'}</p>
                <p className="text-white/40 text-sm truncate mt-0.5">
                  {match.bankTransaction.description || '\u2014'}
                </p>
                <div className="flex justify-between mt-3 pt-2 border-t border-white/[0.04]">
                  <span className="text-white/30 text-xs font-mono tabular-nums">{formatDate(match.bankTransaction.transactionDate)}</span>
                  <span className="font-mono font-bold tabular-nums" style={{ color: SPECTRAL.cyan }}>
                    {formatCurrencyFull(Math.abs(match.bankTransaction.amount))}
                  </span>
                </div>
              </div>

              {/* Matched Invoice - 40% */}
              <div
                className="flex-[2] p-4 border-[0.5px] rounded-sm"
                style={{ borderColor: `${SPECTRAL.emerald}15`, background: `${SPECTRAL.emerald}03` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: `${SPECTRAL.emerald}80` }}>
                    {match.matchedTransaction.transactionType === 'ACCPAY' ? 'Supplier Invoice' : 'Customer Invoice'}
                  </p>
                  {invoiceUrl && (
                    <a href={invoiceUrl} target="_blank" rel="noopener noreferrer"
                      className="hover:opacity-70 transition-opacity" style={{ color: SPECTRAL.emerald }}>
                      <ExternalLinkIcon />
                    </a>
                  )}
                </div>
                <p className="text-white/90 font-medium">{match.matchedTransaction.contactName || 'Unknown'}</p>
                <p className="text-white/40 text-sm truncate mt-0.5">
                  {match.matchedTransaction.reference || match.matchedTransaction.description || '\u2014'}
                </p>
                <div className="flex justify-between mt-3 pt-2 border-t border-white/[0.04]">
                  <span className="text-white/30 text-xs font-mono tabular-nums">{formatDate(match.matchedTransaction.transactionDate)}</span>
                  <span className="font-mono font-bold tabular-nums" style={{ color: SPECTRAL.emerald }}>
                    {formatCurrencyFull(Math.abs(match.matchedTransaction.amount))}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )
      })}
      <PaginationBar page={page} setPage={setPage} totalPages={totalPages} showing={showing} />
    </div>
  )
}

// ─── Duplicates Tab ──────────────────────────────────────────────────

function DuplicatesTab({ duplicates }: { duplicates: DuplicateGroup[] }) {
  const { paginated, page, setPage, totalPages, showing } = usePagination(duplicates, 15)

  if (duplicates.length === 0) {
    return <EmptyState colour={SPECTRAL.emerald} title="No Duplicates Found" description="No duplicate transactions were detected in your accounts." />
  }

  const exactCount = duplicates.filter((d) => d.duplicateType === 'exact').length
  const probableCount = duplicates.filter((d) => d.duplicateType === 'probable').length
  const possibleCount = duplicates.filter((d) => d.duplicateType === 'possible').length

  return (
    <div>
      {/* Duplicate Summary Data Strip */}
      <div className="flex items-center justify-center gap-6 mb-6 px-4 py-3 border-[0.5px] border-white/[0.06] rounded-sm"
        style={{ background: 'rgba(255,255,255,0.01)' }}
      >
        {[
          { label: 'Exact', count: exactCount, colour: SPECTRAL.red },
          { label: 'Probable', count: probableCount, colour: SPECTRAL.amber },
          { label: 'Possible', count: possibleCount, colour: SPECTRAL.grey },
        ].map((item, i) => (
          <div key={item.label} className="flex items-center gap-3">
            {i > 0 && <div className="h-4 w-px bg-white/10" />}
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.colour }} />
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">{item.label}</span>
              <span className="font-mono text-sm font-medium tabular-nums" style={{ color: item.colour }}>
                {item.count}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {paginated.map((group, idx) => {
          const typeColour = group.duplicateType === 'exact' ? SPECTRAL.red
            : group.duplicateType === 'probable' ? SPECTRAL.amber : SPECTRAL.grey

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.5, ease: EASING.outExpo }}
              className="p-5 border-[0.5px] border-white/[0.06] rounded-sm hover:border-white/[0.1] transition-colors"
              style={{ background: 'rgba(255,255,255,0.01)' }}
            >
              {/* Group Header */}
              <div className="flex items-center justify-center gap-4 mb-4 flex-wrap">
                <span
                  className="px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-[0.15em] border-[0.5px]"
                  style={{
                    borderColor: `${typeColour}30`,
                    color: typeColour,
                    backgroundColor: `${typeColour}08`,
                  }}
                >
                  {group.duplicateType}
                </span>
                <span className="text-[10px] text-white/30 font-mono tabular-nums">
                  {group.confidence}% confidence
                </span>
                <div className="flex gap-1.5 flex-wrap justify-center">
                  {group.matchReasons.map((r) => (
                    <span key={r} className="text-[10px] px-2 py-0.5 border-[0.5px] border-white/[0.06] rounded-sm text-white/20 uppercase tracking-wider">
                      {r.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                {group.totalExposure > 0 && (
                  <span className="font-mono font-bold text-sm tabular-nums" style={{ color: SPECTRAL.red }}>
                    Exposure: {formatCurrency(group.totalExposure)}
                  </span>
                )}
              </div>

              {/* Transaction rows */}
              <div className="space-y-1.5">
                {group.transactions.map((tx, txIdx) => {
                  const xeroUrl = getXeroUrl(tx.transactionId, tx.transactionType)
                  return (
                    <div
                      key={tx.transactionId}
                      className="flex items-center justify-between p-3 rounded-sm border-[0.5px]"
                      style={{
                        borderColor: txIdx === 0 ? 'rgba(255,255,255,0.06)' : `${SPECTRAL.red}15`,
                        backgroundColor: txIdx === 0 ? 'rgba(255,255,255,0.02)' : `${SPECTRAL.red}05`,
                      }}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span
                          className="text-[10px] font-medium font-mono px-2 py-0.5 rounded-sm border-[0.5px]"
                          style={{
                            borderColor: txIdx === 0 ? 'rgba(255,255,255,0.06)' : `${SPECTRAL.red}20`,
                            color: txIdx === 0 ? 'rgba(255,255,255,0.4)' : SPECTRAL.red,
                            backgroundColor: txIdx === 0 ? 'rgba(255,255,255,0.02)' : `${SPECTRAL.red}08`,
                          }}
                        >
                          {txIdx === 0 ? 'ORIG' : `COPY ${txIdx}`}
                        </span>
                        <span className="text-white/90 font-medium truncate">
                          {tx.contactName || 'Unknown'}
                        </span>
                        <span className="text-white/30 text-xs font-mono whitespace-nowrap tabular-nums">
                          {formatDate(tx.transactionDate)}
                        </span>
                        {tx.description && (
                          <span className="text-white/20 text-xs truncate max-w-[200px]">
                            {tx.description}
                          </span>
                        )}
                        {tx.reference && (
                          <span className="text-white/20 text-[10px] font-mono">
                            Ref: {tx.reference}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className="font-mono font-medium tabular-nums"
                          style={{ color: txIdx === 0 ? 'rgba(255,255,255,0.7)' : SPECTRAL.red }}
                        >
                          {formatCurrencyFull(Math.abs(tx.amount))}
                        </span>
                        {xeroUrl && (
                          <a
                            href={xeroUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-6 h-6 rounded-sm hover:bg-white/[0.04] transition-colors"
                            style={{ color: SPECTRAL.cyan }}
                            title="Open in Xero"
                          >
                            <ExternalLinkIcon />
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )
        })}
      </div>
      <PaginationBar page={page} setPage={setPage} totalPages={totalPages} showing={showing} />
    </div>
  )
}

// ─── Missing Tab ─────────────────────────────────────────────────────

function MissingTab({ entries }: { entries: MissingEntry[] }) {
  const { paginated, page, setPage, totalPages, showing } = usePagination(entries)

  if (entries.length === 0) {
    return <EmptyState colour={SPECTRAL.emerald} title="All Entries Present" description="All paid invoices have corresponding bank entries." />
  }

  const paymentCount = entries.filter((e) => e.expectedType === 'bank_payment').length
  const receiptCount = entries.filter((e) => e.expectedType === 'bank_receipt').length

  return (
    <div>
      {/* Missing Summary Data Strip */}
      <div className="flex items-center justify-center gap-6 mb-6 px-4 py-3 border-[0.5px] border-white/[0.06] rounded-sm"
        style={{ background: 'rgba(255,255,255,0.01)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SPECTRAL.red }} />
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">Missing Payments</span>
          <span className="font-mono text-sm font-medium tabular-nums" style={{ color: SPECTRAL.red }}>
            {paymentCount}
          </span>
        </div>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SPECTRAL.emerald }} />
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">Missing Receipts</span>
          <span className="font-mono text-sm font-medium tabular-nums" style={{ color: SPECTRAL.emerald }}>
            {receiptCount}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {['Invoice Date', 'Contact', 'Description', 'Reference', 'Expected', 'Amount', 'Age', 'Xero'].map((h) => (
                <th
                  key={h}
                  className={`py-3 px-4 text-[10px] uppercase tracking-[0.2em] text-white/30 font-normal ${
                    h === 'Amount' ? 'text-right' : h === 'Age' || h === 'Xero' || h === 'Expected' ? 'text-center' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((entry, idx) => {
              const xeroUrl = getXeroUrl(entry.invoice.transactionId, entry.invoice.transactionType)
              const isPayment = entry.expectedType === 'bank_payment'
              return (
                <motion.tr
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02, duration: 0.3, ease: EASING.outExpo }}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3 px-4 text-white/50 whitespace-nowrap font-mono text-xs tabular-nums">
                    {formatDate(entry.invoice.transactionDate)}
                  </td>
                  <td className="py-3 px-4 text-white/90 font-medium max-w-[200px] truncate">
                    {entry.invoice.contactName || <span className="text-white/20 italic">Unknown</span>}
                  </td>
                  <td className="py-3 px-4 text-white/40 max-w-[200px] truncate">
                    {entry.invoice.description || '\u2014'}
                  </td>
                  <td className="py-3 px-4">
                    {entry.invoice.reference ? (
                      <span className="text-[10px] font-mono text-white/40 border-[0.5px] border-white/[0.06] px-2 py-0.5 rounded-sm">
                        {entry.invoice.reference}
                      </span>
                    ) : (
                      <span className="text-white/20">&mdash;</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className="inline-block text-[10px] px-2.5 py-1 rounded-sm font-medium font-mono uppercase tracking-wider border-[0.5px]"
                      style={{
                        borderColor: isPayment ? `${SPECTRAL.red}20` : `${SPECTRAL.emerald}20`,
                        color: isPayment ? SPECTRAL.red : SPECTRAL.emerald,
                        backgroundColor: isPayment ? `${SPECTRAL.red}08` : `${SPECTRAL.emerald}08`,
                      }}
                    >
                      {isPayment ? 'Payment' : 'Receipt'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium whitespace-nowrap tabular-nums" style={{ color: SPECTRAL.magenta }}>
                    {formatCurrencyFull(Math.abs(entry.invoice.amount))}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className="inline-block px-2 py-0.5 rounded-sm text-[10px] font-mono font-medium border-[0.5px] tabular-nums"
                      style={{
                        borderColor: entry.daysSinceInvoice > 180
                          ? `${SPECTRAL.red}30` : entry.daysSinceInvoice > 90
                          ? `${SPECTRAL.amber}30` : 'rgba(255,255,255,0.06)',
                        color: entry.daysSinceInvoice > 180
                          ? SPECTRAL.red : entry.daysSinceInvoice > 90
                          ? SPECTRAL.amber : 'rgba(255,255,255,0.4)',
                        backgroundColor: entry.daysSinceInvoice > 180
                          ? `${SPECTRAL.red}08` : entry.daysSinceInvoice > 90
                          ? `${SPECTRAL.amber}08` : 'transparent',
                      }}
                    >
                      {entry.daysSinceInvoice}d
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {xeroUrl ? (
                      <a
                        href={xeroUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-6 h-6 rounded-sm hover:bg-white/[0.04] transition-colors"
                        style={{ color: SPECTRAL.cyan }}
                        title="Open in Xero"
                      >
                        <ExternalLinkIcon />
                      </a>
                    ) : (
                      <span className="text-white/10">&mdash;</span>
                    )}
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <PaginationBar page={page} setPage={setPage} totalPages={totalPages} showing={showing} />
    </div>
  )
}
