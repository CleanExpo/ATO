/**
 * Reconciliation Analysis Dashboard
 *
 * Shows reconciliation status across all accounts:
 * - Unreconciled bank transactions
 * - Suggested matches (bank <-> invoice)
 * - Duplicate detection
 * - Missing transaction entries
 */

'use client'

import { Suspense, useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
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

// ─── SVG Icons ───────────────────────────────────────────────────────

function ExternalLinkIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

function AlertTriangleIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

function FileSearchIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.243 3 3 0 00-4.243 4.243z" />
    </svg>
  )
}

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

// ─── Component ───────────────────────────────────────────────────────

export default function ReconciliationPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
          <p className="mt-3 text-gray-400">Loading reconciliation...</p>
        </div>
      </div>
    }>
      <ReconciliationPage />
    </Suspense>
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
        // Auto-select tab with most items
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

  // Calculate total issues
  const totalIssues = data
    ? data.unreconciledCount + data.matchCount + data.duplicateCount + data.missingCount
    : 0

  const totalExposure = data
    ? data.unreconciledAmount + data.matchAmount + data.duplicateExposure + data.missingAmount
    : 0

  const tabs: { key: TabType; label: string; count: number; colour: string }[] = data
    ? [
        { key: 'unreconciled', label: 'Unreconciled', count: data.unreconciledCount, colour: 'amber' },
        { key: 'matches', label: 'Suggested Matches', count: data.matchCount, colour: 'blue' },
        { key: 'duplicates', label: 'Duplicates', count: data.duplicateCount, colour: 'red' },
        { key: 'missing', label: 'Missing Entries', count: data.missingCount, colour: 'purple' },
      ]
    : []

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <MobileNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/dashboard/forensic-audit${tenantId ? `?tenantId=${tenantId}` : ''}`}
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Forensic Audit
          </Link>
          {data && !loading && (
            <button
              onClick={() => loadReconciliation()}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
            >
              <RefreshIcon />
              Refresh
            </button>
          )}
        </div>

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Reconciliation Analysis</h1>
          <p className="text-gray-400 mt-2 text-lg">
            Identify unreconciled items, suggested matches, and potential duplicates across all accounts
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="mt-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent" />
            <p className="mt-4 text-gray-400 text-lg">Analysing reconciliation status...</p>
            <p className="mt-1 text-gray-600 text-sm">Scanning bank transactions, invoices, and matching patterns</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-8 p-6 bg-red-900/20 border border-red-500/40 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangleIcon />
              <div>
                <h3 className="text-red-400 font-semibold">Analysis Error</h3>
                <p className="text-red-400/80 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Data loaded */}
        {data && !loading && (
          <>
            {/* Overview Bar */}
            <div className="mb-6 p-5 bg-gradient-to-r from-gray-900 to-gray-900/50 border border-gray-800 rounded-xl">
              <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Issues Found</p>
                  <p className="text-3xl font-bold text-white">{totalIssues.toLocaleString()}</p>
                </div>
                <div className="hidden sm:block h-12 w-px bg-gray-800" />
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Exposure</p>
                  <p className="text-3xl font-bold text-red-400">{formatCurrency(totalExposure)}</p>
                </div>
                <div className="hidden sm:block h-12 w-px bg-gray-800" />
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Transactions Scanned</p>
                  <p className="text-3xl font-bold text-gray-300">
                    {(data.totalBankTransactions + data.totalInvoices).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-center text-xs text-gray-600 mt-3 pt-3 border-t border-gray-800/50">
                <p>Bank: {data.totalBankTransactions.toLocaleString()} | Invoices: {data.totalInvoices.toLocaleString()} | Analysed {new Date(data.analysedAt).toLocaleString('en-AU')}</p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <SummaryCard
                icon={<AlertTriangleIcon />}
                label="Unreconciled"
                count={data.unreconciledCount}
                amount={data.unreconciledAmount}
                colour="amber"
                subtitle="Bank transactions pending reconciliation"
                isActive={activeTab === 'unreconciled'}
                onClick={() => setActiveTab('unreconciled')}
              />
              <SummaryCard
                icon={<LinkIcon />}
                label="Suggested Matches"
                count={data.matchCount}
                amount={data.matchAmount}
                colour="blue"
                subtitle="Potential bank-to-invoice matches"
                isActive={activeTab === 'matches'}
                onClick={() => setActiveTab('matches')}
              />
              <SummaryCard
                icon={<CopyIcon />}
                label="Duplicates"
                count={data.duplicateCount}
                amount={data.duplicateExposure}
                colour="red"
                amountLabel="Exposure"
                subtitle="Potential duplicate entries detected"
                isActive={activeTab === 'duplicates'}
                onClick={() => setActiveTab('duplicates')}
              />
              <SummaryCard
                icon={<FileSearchIcon />}
                label="Missing Entries"
                count={data.missingCount}
                amount={data.missingAmount}
                colour="purple"
                subtitle="Paid invoices without bank entries"
                isActive={activeTab === 'missing'}
                onClick={() => setActiveTab('missing')}
              />
            </div>

            {/* Financial Year Breakdown */}
            {Object.keys(data.byFinancialYear).length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 text-center">
                  Breakdown by Financial Year
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(data.byFinancialYear)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([fy, yr]) => {
                      const yearTotal = yr.unreconciledCount + yr.suggestedMatches + yr.duplicates + yr.missingEntries
                      return (
                        <div
                          key={fy}
                          className="p-4 bg-gray-900/80 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors text-center"
                        >
                          <div className="flex items-center justify-center gap-3 mb-3">
                            <span className="text-white font-semibold text-lg">{fy}</span>
                            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
                              {yearTotal} issues
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center justify-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span className="text-xs text-gray-400">
                                {yr.unreconciledCount} unreconciled
                              </span>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              <span className="text-xs text-gray-400">
                                {yr.suggestedMatches} matches
                              </span>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-xs text-gray-400">
                                {yr.duplicates} duplicates
                              </span>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-purple-500" />
                              <span className="text-xs text-gray-400">
                                {yr.missingEntries} missing
                              </span>
                            </div>
                          </div>
                          {yr.unreconciledAmount > 0 && (
                            <p className="mt-2 text-xs text-amber-400/80">
                              Unreconciled: {formatCurrency(yr.unreconciledAmount)}
                            </p>
                          )}
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="border-b border-gray-800 mb-0">
              <div className="flex gap-0 justify-center">
                {tabs.map((tab) => {
                  const colourActiveMap: Record<string, string> = {
                    amber: 'border-amber-500 text-amber-400',
                    blue: 'border-blue-500 text-blue-400',
                    red: 'border-red-500 text-red-400',
                    purple: 'border-purple-500 text-purple-400',
                  }
                  const countBgMap: Record<string, string> = {
                    amber: 'bg-amber-500/20 text-amber-400',
                    blue: 'bg-blue-500/20 text-blue-400',
                    red: 'bg-red-500/20 text-red-400',
                    purple: 'bg-purple-500/20 text-purple-400',
                  }
                  const isActive = activeTab === tab.key

                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`relative px-5 py-3.5 text-sm font-medium transition-all ${
                        isActive
                          ? `${colourActiveMap[tab.colour]} border-b-2 bg-gray-900/50`
                          : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent hover:bg-gray-900/30'
                      }`}
                    >
                      {tab.label}
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                        isActive ? countBgMap[tab.colour] : 'bg-gray-800 text-gray-500'
                      }`}>
                        {tab.count.toLocaleString()}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Tab Content */}
            <div className="bg-gray-900/30 border-x border-b border-gray-800 rounded-b-xl p-5 min-h-[300px]">
              {activeTab === 'unreconciled' && (
                <UnreconciledTab items={data.unreconciledItems} />
              )}
              {activeTab === 'matches' && (
                <MatchesTab matches={data.suggestedMatches} />
              )}
              {activeTab === 'duplicates' && (
                <DuplicatesTab duplicates={data.duplicates} />
              )}
              {activeTab === 'missing' && (
                <MissingTab entries={data.missingEntries} />
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 text-center text-xs text-gray-600">
              <p>
                Analysis is read-only. No data is modified in Xero. | Last analysed: {new Date(data.analysedAt).toLocaleString('en-AU')}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Summary Card ────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  count,
  amount,
  colour,
  amountLabel = 'Amount',
  subtitle,
  isActive,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  count: number
  amount: number
  colour: 'amber' | 'blue' | 'red' | 'purple'
  amountLabel?: string
  subtitle: string
  isActive: boolean
  onClick: () => void
}) {
  const styles = {
    amber: {
      border: isActive ? 'border-amber-500' : 'border-amber-500/30',
      bg: 'bg-amber-900/10',
      icon: 'text-amber-400',
      count: 'text-amber-400',
      amount: 'text-amber-300/80',
      glow: isActive ? 'shadow-amber-500/10 shadow-lg' : '',
    },
    blue: {
      border: isActive ? 'border-blue-500' : 'border-blue-500/30',
      bg: 'bg-blue-900/10',
      icon: 'text-blue-400',
      count: 'text-blue-400',
      amount: 'text-blue-300/80',
      glow: isActive ? 'shadow-blue-500/10 shadow-lg' : '',
    },
    red: {
      border: isActive ? 'border-red-500' : 'border-red-500/30',
      bg: 'bg-red-900/10',
      icon: 'text-red-400',
      count: 'text-red-400',
      amount: 'text-red-300/80',
      glow: isActive ? 'shadow-red-500/10 shadow-lg' : '',
    },
    purple: {
      border: isActive ? 'border-purple-500' : 'border-purple-500/30',
      bg: 'bg-purple-900/10',
      icon: 'text-purple-400',
      count: 'text-purple-400',
      amount: 'text-purple-300/80',
      glow: isActive ? 'shadow-purple-500/10 shadow-lg' : '',
    },
  }

  const s = styles[colour]

  return (
    <button
      onClick={onClick}
      className={`p-5 rounded-xl border ${s.border} ${s.bg} ${s.glow} text-center transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer`}
    >
      <div className="flex items-center justify-center gap-3 mb-3">
        <div className={s.icon}>{icon}</div>
        {count > 0 && (
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              colour === 'amber' ? 'bg-amber-400' :
              colour === 'blue' ? 'bg-blue-400' :
              colour === 'red' ? 'bg-red-400' : 'bg-purple-400'
            }`} />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${
              colour === 'amber' ? 'bg-amber-500' :
              colour === 'blue' ? 'bg-blue-500' :
              colour === 'red' ? 'bg-red-500' : 'bg-purple-500'
            }`} />
          </span>
        )}
      </div>
      <p className="text-sm text-gray-400 font-medium">{label}</p>
      <p className={`text-3xl font-bold ${s.count} mt-1`}>{count.toLocaleString()}</p>
      <p className={`text-sm ${s.amount} font-mono mt-1`}>
        {amountLabel}: {formatCurrency(amount)}
      </p>
      <p className="text-xs text-gray-600 mt-2">{subtitle}</p>
    </button>
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
    <div className="flex flex-col items-center gap-3 mt-4 pt-4 border-t border-gray-800">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="px-3 py-1.5 text-sm text-gray-500">
          {page + 1} / {totalPages}
        </span>
        <button
          onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
      <p className="text-sm text-gray-500">
        Showing {showing.from}-{showing.to} of {showing.total.toLocaleString()}
      </p>
    </div>
  )
}

// ─── Unreconciled Tab ────────────────────────────────────────────────

function UnreconciledTab({ items }: { items: UnreconciledItem[] }) {
  const { paginated, page, setPage, totalPages, showing } = usePagination(items)

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-900/20 border border-green-500/30 mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-green-400 mb-1">All Reconciled</h3>
        <p className="text-gray-500">All bank transactions have been reconciled successfully.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
              <th className="py-3 px-4 text-left font-medium">Date</th>
              <th className="py-3 px-4 text-left font-medium">Contact</th>
              <th className="py-3 px-4 text-left font-medium">Description</th>
              <th className="py-3 px-4 text-left font-medium">Account</th>
              <th className="py-3 px-4 text-left font-medium">FY</th>
              <th className="py-3 px-4 text-right font-medium">Amount</th>
              <th className="py-3 px-4 text-center font-medium">Age</th>
              <th className="py-3 px-4 text-center font-medium">Xero</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((item) => {
              const xeroUrl = getXeroUrl(item.transactionId, item.transactionType)
              return (
                <tr
                  key={item.transactionId}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="py-3 px-4 text-gray-300 whitespace-nowrap">
                    {formatDate(item.transactionDate)}
                  </td>
                  <td className="py-3 px-4 font-medium text-white max-w-[200px] truncate">
                    {item.contactName || <span className="text-gray-600 italic">Unknown</span>}
                  </td>
                  <td className="py-3 px-4 text-gray-400 max-w-[250px] truncate">
                    {item.description || '-'}
                  </td>
                  <td className="py-3 px-4">
                    {item.accountCode ? (
                      <span className="text-xs px-2 py-0.5 bg-gray-800 rounded text-gray-400 font-mono">
                        {item.accountCode}
                      </span>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">{item.financialYear}</td>
                  <td className="py-3 px-4 text-right font-mono text-amber-400 font-medium whitespace-nowrap">
                    {formatCurrencyFull(Math.abs(item.amount))}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                        item.daysPending > 90
                          ? 'bg-red-900/40 text-red-400 border border-red-500/30'
                          : item.daysPending > 30
                            ? 'bg-amber-900/40 text-amber-400 border border-amber-500/30'
                            : 'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}
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
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-blue-500/10 text-blue-400 hover:text-blue-300 transition-colors"
                        title="Open in Xero"
                      >
                        <ExternalLinkIcon />
                      </a>
                    ) : (
                      <span className="text-gray-700">-</span>
                    )}
                  </td>
                </tr>
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
    return (
      <div className="py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 border border-gray-700 mb-4">
          <LinkIcon />
        </div>
        <h3 className="text-lg font-semibold text-gray-300 mb-1">No Matches Found</h3>
        <p className="text-gray-500">No potential bank-to-invoice matches were identified.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {paginated.map((match, idx) => {
        const bankUrl = getXeroUrl(match.bankTransaction.transactionId, match.bankTransaction.transactionType)
        const invoiceUrl = getXeroUrl(match.matchedTransaction.transactionId, match.matchedTransaction.transactionType)

        return (
          <div key={idx} className="p-5 bg-gray-900/50 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors">
            {/* Score + Reasons Header */}
            <div className="flex flex-col items-center gap-2 mb-4">
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <span
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                    match.matchScore >= 80
                      ? 'bg-green-900/40 text-green-400 border border-green-500/30'
                      : match.matchScore >= 60
                        ? 'bg-amber-900/40 text-amber-400 border border-amber-500/30'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}
                >
                  {match.matchScore}% Match
                </span>
                <div className="flex gap-1.5 flex-wrap justify-center">
                  {match.matchReasons.map((r) => (
                    <span key={r} className="px-2 py-0.5 text-xs bg-gray-800 border border-gray-700 rounded-full text-gray-400">
                      {r.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
              {match.amountDifference > 0 && (
                <span className="text-xs text-gray-500">
                  Diff: {formatCurrencyFull(match.amountDifference)} | {match.dateDifference}d apart
                </span>
              )}
            </div>

            {/* Two-column match cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bank Transaction */}
              <div className="p-4 bg-gray-800/40 rounded-lg border border-blue-500/20">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Bank Transaction</p>
                  {bankUrl && (
                    <a href={bankUrl} target="_blank" rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 transition-colors">
                      <ExternalLinkIcon className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <p className="font-medium text-white">{match.bankTransaction.contactName || 'Unknown'}</p>
                <p className="text-sm text-gray-400 truncate mt-0.5">
                  {match.bankTransaction.description || '-'}
                </p>
                <div className="flex justify-between mt-3 pt-2 border-t border-gray-700/50">
                  <span className="text-gray-500 text-sm">{formatDate(match.bankTransaction.transactionDate)}</span>
                  <span className="font-mono font-bold text-blue-400">{formatCurrencyFull(Math.abs(match.bankTransaction.amount))}</span>
                </div>
              </div>

              {/* Matched Invoice */}
              <div className="p-4 bg-gray-800/40 rounded-lg border border-green-500/20">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-green-400 font-semibold uppercase tracking-wider">
                    {match.matchedTransaction.transactionType === 'ACCPAY' ? 'Supplier Invoice' : 'Customer Invoice'}
                  </p>
                  {invoiceUrl && (
                    <a href={invoiceUrl} target="_blank" rel="noopener noreferrer"
                      className="text-green-400 hover:text-green-300 transition-colors">
                      <ExternalLinkIcon className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <p className="font-medium text-white">{match.matchedTransaction.contactName || 'Unknown'}</p>
                <p className="text-sm text-gray-400 truncate mt-0.5">
                  {match.matchedTransaction.reference || match.matchedTransaction.description || '-'}
                </p>
                <div className="flex justify-between mt-3 pt-2 border-t border-gray-700/50">
                  <span className="text-gray-500 text-sm">{formatDate(match.matchedTransaction.transactionDate)}</span>
                  <span className="font-mono font-bold text-green-400">{formatCurrencyFull(Math.abs(match.matchedTransaction.amount))}</span>
                </div>
              </div>
            </div>
          </div>
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
    return (
      <div className="py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-900/20 border border-green-500/30 mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-green-400 mb-1">No Duplicates Found</h3>
        <p className="text-gray-500">No duplicate transactions were detected in your accounts.</p>
      </div>
    )
  }

  // Summary counts
  const exactCount = duplicates.filter((d) => d.duplicateType === 'exact').length
  const probableCount = duplicates.filter((d) => d.duplicateType === 'probable').length
  const possibleCount = duplicates.filter((d) => d.duplicateType === 'possible').length

  return (
    <div>
      {/* Duplicate Summary */}
      <div className="flex justify-center gap-6 mb-5">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-sm text-gray-400">Exact: <span className="text-white font-medium">{exactCount}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-amber-500" />
          <span className="text-sm text-gray-400">Probable: <span className="text-white font-medium">{probableCount}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-gray-500" />
          <span className="text-sm text-gray-400">Possible: <span className="text-white font-medium">{possibleCount}</span></span>
        </div>
      </div>

      <div className="space-y-3">
        {paginated.map((group, idx) => (
          <div key={idx} className="p-4 bg-gray-900/50 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors">
            <div className="flex flex-col items-center gap-2 mb-3">
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                    group.duplicateType === 'exact'
                      ? 'bg-red-900/40 text-red-400 border border-red-500/30'
                      : group.duplicateType === 'probable'
                        ? 'bg-amber-900/40 text-amber-400 border border-amber-500/30'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}
                >
                  {group.duplicateType}
                </span>
                <span className="text-sm text-gray-500">
                  {group.confidence}% confidence
                </span>
                <div className="flex gap-1.5 flex-wrap justify-center">
                  {group.matchReasons.map((r) => (
                    <span key={r} className="text-xs px-2 py-0.5 bg-gray-800 border border-gray-700 rounded-full text-gray-500">
                      {r.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
              {group.totalExposure > 0 && (
                <span className="text-red-400 font-bold font-mono text-sm">
                  Exposure: {formatCurrency(group.totalExposure)}
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              {group.transactions.map((tx, txIdx) => {
                const xeroUrl = getXeroUrl(tx.transactionId, tx.transactionType)
                return (
                  <div
                    key={tx.transactionId}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      txIdx === 0 ? 'bg-gray-800/60' : 'bg-red-900/10 border border-red-500/10'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        txIdx === 0 ? 'bg-gray-700 text-gray-400' : 'bg-red-900/30 text-red-400'
                      }`}>
                        {txIdx === 0 ? 'Original' : `Copy ${txIdx}`}
                      </span>
                      <span className="font-medium text-white truncate">
                        {tx.contactName || 'Unknown'}
                      </span>
                      <span className="text-gray-500 text-sm whitespace-nowrap">
                        {formatDate(tx.transactionDate)}
                      </span>
                      {tx.description && (
                        <span className="text-gray-600 text-xs truncate max-w-[200px]">
                          {tx.description}
                        </span>
                      )}
                      {tx.reference && (
                        <span className="text-gray-600 text-xs font-mono">
                          Ref: {tx.reference}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`font-mono font-medium ${txIdx === 0 ? 'text-gray-300' : 'text-red-400'}`}>
                        {formatCurrencyFull(Math.abs(tx.amount))}
                      </span>
                      {xeroUrl && (
                        <a
                          href={xeroUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-blue-500/10 text-blue-400 hover:text-blue-300 transition-colors"
                          title="Open in Xero"
                        >
                          <ExternalLinkIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <PaginationBar page={page} setPage={setPage} totalPages={totalPages} showing={showing} />
    </div>
  )
}

// ─── Missing Tab ─────────────────────────────────────────────────────

function MissingTab({ entries }: { entries: MissingEntry[] }) {
  const { paginated, page, setPage, totalPages, showing } = usePagination(entries)

  if (entries.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-900/20 border border-green-500/30 mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-green-400 mb-1">All Entries Present</h3>
        <p className="text-gray-500">All paid invoices have corresponding bank entries.</p>
      </div>
    )
  }

  // Summary stats
  const paymentCount = entries.filter((e) => e.expectedType === 'bank_payment').length
  const receiptCount = entries.filter((e) => e.expectedType === 'bank_receipt').length

  return (
    <div>
      {/* Summary */}
      <div className="flex justify-center gap-6 mb-5">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-sm text-gray-400">Missing Payments: <span className="text-white font-medium">{paymentCount}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-green-500" />
          <span className="text-sm text-gray-400">Missing Receipts: <span className="text-white font-medium">{receiptCount}</span></span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
              <th className="py-3 px-4 text-left font-medium">Invoice Date</th>
              <th className="py-3 px-4 text-left font-medium">Contact</th>
              <th className="py-3 px-4 text-left font-medium">Description</th>
              <th className="py-3 px-4 text-left font-medium">Reference</th>
              <th className="py-3 px-4 text-center font-medium">Expected</th>
              <th className="py-3 px-4 text-right font-medium">Amount</th>
              <th className="py-3 px-4 text-center font-medium">Age</th>
              <th className="py-3 px-4 text-center font-medium">Xero</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((entry, idx) => {
              const xeroUrl = getXeroUrl(entry.invoice.transactionId, entry.invoice.transactionType)
              return (
                <tr
                  key={idx}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="py-3 px-4 text-gray-300 whitespace-nowrap">
                    {formatDate(entry.invoice.transactionDate)}
                  </td>
                  <td className="py-3 px-4 font-medium text-white max-w-[200px] truncate">
                    {entry.invoice.contactName || <span className="text-gray-600 italic">Unknown</span>}
                  </td>
                  <td className="py-3 px-4 text-gray-400 max-w-[200px] truncate">
                    {entry.invoice.description || '-'}
                  </td>
                  <td className="py-3 px-4">
                    {entry.invoice.reference ? (
                      <span className="text-xs font-mono text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                        {entry.invoice.reference}
                      </span>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${
                        entry.expectedType === 'bank_payment'
                          ? 'bg-red-900/30 text-red-400 border border-red-500/20'
                          : 'bg-green-900/30 text-green-400 border border-green-500/20'
                      }`}
                    >
                      {entry.expectedType === 'bank_payment' ? 'Payment' : 'Receipt'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-purple-400 font-medium whitespace-nowrap">
                    {formatCurrencyFull(Math.abs(entry.invoice.amount))}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                        entry.daysSinceInvoice > 180
                          ? 'bg-red-900/40 text-red-400 border border-red-500/30'
                          : entry.daysSinceInvoice > 90
                            ? 'bg-amber-900/40 text-amber-400 border border-amber-500/30'
                            : 'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}
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
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-blue-500/10 text-blue-400 hover:text-blue-300 transition-colors"
                        title="Open in Xero"
                      >
                        <ExternalLinkIcon />
                      </a>
                    ) : (
                      <span className="text-gray-700">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <PaginationBar page={page} setPage={setPage} totalPages={totalPages} showing={showing} />
    </div>
  )
}
