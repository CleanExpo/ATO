/**
 * Transaction Explorer Page
 *
 * Scientific Luxury Design System implementation.
 * Interactive filterable data grid showing all analysed transactions.
 */

'use client'

import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { MobileNav } from '@/components/ui/MobileNav'
import { TransactionDetailRow } from '@/components/forensic-audit/TransactionDetailRow'
import { ExportModal, ExportOptions } from '@/components/forensic-audit/ExportModal'
import { exportWithFormat, quickExportExcel, quickExportAccountantPackage } from '@/lib/api/export-client'

// ─── Debounce Hook ───────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

// ─── Types ───────────────────────────────────────────────────────────

interface AnalysisResult {
  id: string
  transaction_id: string
  tenant_id: string
  financial_year: string | null
  transaction_amount: number
  transaction_date: string | null
  transaction_description: string | null
  supplier_name: string | null
  primary_category: string | null
  secondary_categories: string[] | null
  category_confidence: number | null
  is_rnd_candidate: boolean
  meets_div355_criteria: boolean
  rnd_activity_type: string | null
  rnd_confidence: number | null
  rnd_reasoning: string | null
  div355_outcome_unknown: boolean
  div355_systematic_approach: boolean
  div355_new_knowledge: boolean
  div355_scientific_method: boolean
  is_fully_deductible: boolean
  deduction_type: string | null
  claimable_amount: number | null
  deduction_restrictions: string[] | null
  deduction_confidence: number | null
  requires_documentation: boolean
  fbt_implications: boolean
  division7a_risk: boolean
  compliance_notes: string[] | null
  ai_model: string | null
  created_at: string
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasMore: boolean
}

interface Summary {
  total: number
  rnd: {
    candidates: number
    meetsDiv355: number
    coreActivities: number
    percentage: string
  }
  categories: Record<string, number>
  confidence: {
    high: number
    medium: number
    low: number
  }
  deductions: {
    fullyDeductible: number
    totalClaimableAmount: number
  }
  compliance: {
    requiresDocumentation: number
    fbtImplications: number
    division7aRisk: number
  }
  byFinancialYear: Record<string, number>
}

type SortField = 'transaction_date' | 'transaction_amount' | 'category_confidence' | 'supplier_name'
type SortDirection = 'asc' | 'desc'

// ─── Design Tokens ───────────────────────────────────────────────────

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
  magenta: '#FF00FF',
  grey: '#6B7280',
} as const

const EASING = {
  outExpo: [0.19, 1, 0.22, 1] as const,
}

const CATEGORY_COLOURS: Record<string, string> = {
  'Operating Expenses': SPECTRAL.cyan,
  'Professional Services': SPECTRAL.magenta,
  'Technology & Software': SPECTRAL.emerald,
  'Travel & Entertainment': SPECTRAL.amber,
  'Wages & Salaries': SPECTRAL.cyan,
  'Subcontractors': SPECTRAL.magenta,
  'Marketing & Advertising': SPECTRAL.emerald,
  'Repairs & Maintenance': SPECTRAL.amber,
  'Motor Vehicle': SPECTRAL.cyan,
  'Office Expenses': SPECTRAL.grey,
  'default': SPECTRAL.grey,
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

// ─── Helpers ─────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function _formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getCategoryColour(category: string | null): string {
  if (!category) return CATEGORY_COLOURS.default
  return CATEGORY_COLOURS[category] || CATEGORY_COLOURS.default
}

// ─── Component ───────────────────────────────────────────────────────

export default function TransactionsPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#050505' }}>
        <div className="flex flex-col items-center gap-4">
          <BreathingOrb colour={SPECTRAL.cyan} isActive size="md" />
          <p className="text-white/40 text-[10px] uppercase tracking-[0.3em]">Loading Transactions</p>
        </div>
      </div>
    }>
      <TransactionsPage />
    </Suspense>
  )
}

function TransactionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isInitialised = useRef(false)

  // State
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<AnalysisResult[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)

  // Filters - initialise from URL params
  const [financialYear, setFinancialYear] = useState<string>(() => searchParams.get('fy') || '')
  const [category, setCategory] = useState<string>(() => searchParams.get('category') || '')
  const [isRndCandidate, setIsRndCandidate] = useState<string>(() => searchParams.get('rnd') || '')
  const [minConfidence, setMinConfidence] = useState<number>(() => {
    const conf = searchParams.get('conf')
    return conf ? parseInt(conf, 10) : 0
  })
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('q') || '')

  // Debounced search query for API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Sorting - initialise from URL params
  const [sortField, setSortField] = useState<SortField>(() => {
    const sort = searchParams.get('sort')
    return (sort as SortField) || 'transaction_date'
  })
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const dir = searchParams.get('dir')
    return (dir as SortDirection) || 'desc'
  })

  // Pagination - initialise from URL params
  const [page, setPage] = useState(() => {
    const p = searchParams.get('page')
    return p ? parseInt(p, 10) : 1
  })
  const [pageSize, setPageSize] = useState(() => {
    const ps = searchParams.get('pageSize')
    return ps ? parseInt(ps, 10) : 50
  })

  // Selection and expansion state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Toggle selection
  function toggleSelection(transactionId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(transactionId)) {
        next.delete(transactionId)
      } else {
        next.add(transactionId)
      }
      return next
    })
  }

  // Toggle all selection
  function toggleSelectAll() {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(transactions.map(t => t.transaction_id)))
    }
  }

  // Clear selection
  function clearSelection() {
    setSelectedIds(new Set())
  }

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false)
  const [isQuickExporting, setIsQuickExporting] = useState(false)
  const [exportToast, setExportToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [organizationName, setOrganizationName] = useState('')

  // Fetch organization name
  useEffect(() => {
    async function fetchOrgName() {
      if (!tenantId) return
      try {
        const response = await fetch('/api/xero/organizations')
        const data = await response.json()
        const org = data.connections?.find((c: { tenant_id: string; organisation_name?: string; tenant_name?: string }) => c.tenant_id === tenantId)
        if (org) {
          setOrganizationName(org.organisation_name || org.tenant_name || '')
        }
      } catch (err) {
        console.error('Failed to fetch org name:', err)
      }
    }
    fetchOrgName()
  }, [tenantId])

  // Handle export
  async function handleExport(options: ExportOptions) {
    if (!tenantId) return

    const result = await exportWithFormat(tenantId, options)
    if (result.success) {
      setExportToast({ type: 'success', message: `Downloaded ${result.filename}` })
    } else {
      setExportToast({ type: 'error', message: result.error || 'Export failed' })
    }

    // Clear toast after 5 seconds
    setTimeout(() => setExportToast(null), 5000)
  }

  // Quick export handlers
  async function handleQuickExportExcel() {
    if (!tenantId || !organizationName) return
    setIsQuickExporting(true)
    setExportToast({ type: 'success', message: 'Generating Excel report...' })
    const result = await quickExportExcel(tenantId, organizationName, '')
    setIsQuickExporting(false)
    if (result.success) {
      setExportToast({ type: 'success', message: `Downloaded ${result.filename}` })
    } else {
      setExportToast({ type: 'error', message: result.error || 'Export failed' })
    }
    setTimeout(() => setExportToast(null), 5000)
  }

  async function handleQuickExportPackage() {
    if (!tenantId || !organizationName) return
    setIsQuickExporting(true)
    setExportToast({ type: 'success', message: 'Generating accountant package...' })
    const result = await quickExportAccountantPackage(tenantId, organizationName, '')
    setIsQuickExporting(false)
    if (result.success) {
      setExportToast({ type: 'success', message: `Downloaded ${result.filename}` })
    } else {
      setExportToast({ type: 'error', message: result.error || 'Export failed' })
    }
    setTimeout(() => setExportToast(null), 5000)
  }

  // Sync filters to URL for shareable links
  useEffect(() => {
    if (!tenantId) return
    // Skip the first render to avoid overwriting URL on initial load
    if (!isInitialised.current) {
      isInitialised.current = true
      return
    }

    const params = new URLSearchParams()
    params.set('tenantId', tenantId)

    if (financialYear) params.set('fy', financialYear)
    if (category) params.set('category', category)
    if (isRndCandidate) params.set('rnd', isRndCandidate)
    if (minConfidence > 0) params.set('conf', minConfidence.toString())
    if (debouncedSearchQuery) params.set('q', debouncedSearchQuery)
    if (sortField !== 'transaction_date') params.set('sort', sortField)
    if (sortDirection !== 'desc') params.set('dir', sortDirection)
    if (page > 1) params.set('page', page.toString())
    if (pageSize !== 50) params.set('pageSize', pageSize.toString())

    const newUrl = `/dashboard/forensic-audit/transactions?${params.toString()}`
    router.replace(newUrl, { scroll: false })
  }, [tenantId, financialYear, category, isRndCandidate, minConfidence, debouncedSearchQuery, sortField, sortDirection, page, pageSize, router])

  // Get tenant ID on mount
  useEffect(() => {
    async function fetchTenantId() {
      const urlTenantId = searchParams.get('tenantId')
      if (urlTenantId) {
        setTenantId(urlTenantId)
        return
      }
      try {
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

  // Load transactions when filters change
  const loadTransactions = useCallback(async () => {
    if (!tenantId) return

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.set('tenantId', tenantId)
      params.set('page', page.toString())
      params.set('pageSize', pageSize.toString())

      if (financialYear) params.set('financialYear', financialYear)
      if (isRndCandidate) params.set('isRndCandidate', isRndCandidate)
      if (category) params.set('primaryCategory', category)
      if (minConfidence > 0) params.set('minConfidence', minConfidence.toString())

      const response = await fetch(`/api/audit/analysis-results?${params}`, {
        cache: 'no-store'
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load transactions')
      }

      // Client-side sorting
      let sorted = [...(data.results || [])]
      sorted.sort((a, b) => {
        let aVal: number, bVal: number

        switch (sortField) {
          case 'transaction_date':
            aVal = a.transaction_date ? new Date(a.transaction_date).getTime() : 0
            bVal = b.transaction_date ? new Date(b.transaction_date).getTime() : 0
            break
          case 'transaction_amount':
            aVal = a.transaction_amount || 0
            bVal = b.transaction_amount || 0
            break
          case 'category_confidence':
            aVal = a.category_confidence || 0
            bVal = b.category_confidence || 0
            break
          case 'supplier_name':
            aVal = (a.supplier_name || '').toLowerCase()
            bVal = (b.supplier_name || '').toLowerCase()
            break
          default:
            return 0
        }

        if (sortDirection === 'asc') {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
        } else {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
        }
      })

      // Client-side search filter (using debounced value)
      if (debouncedSearchQuery.trim()) {
        const query = debouncedSearchQuery.toLowerCase()
        sorted = sorted.filter(txn =>
          (txn.supplier_name || '').toLowerCase().includes(query) ||
          (txn.transaction_description || '').toLowerCase().includes(query)
        )
      }

      setTransactions(sorted)
      setPagination(data.pagination)
      setSummary(data.summary)
    } catch (err) {
      console.error('Failed to load transactions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, pageSize, financialYear, isRndCandidate, category, minConfidence, sortField, sortDirection, debouncedSearchQuery])

  useEffect(() => {
    if (tenantId) {
      loadTransactions()
    }
  }, [tenantId, loadTransactions])

  // Handle sort
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Get unique categories for filter
  const categories = summary?.categories ? Object.keys(summary.categories).sort() : []

  // Get unique financial years for filter
  const financialYears = summary?.byFinancialYear ? Object.keys(summary.byFinancialYear).sort().reverse() : []

  // Loading state
  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#050505' }}>
        <div className="flex flex-col items-center gap-6">
          <BreathingOrb colour={SPECTRAL.cyan} isActive size="md" />
          <div className="text-center">
            <p className="text-white/50 text-sm">Loading transactions</p>
            <p className="text-white/20 text-[10px] uppercase tracking-[0.3em] mt-2">
              Fetching analysis results
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#050505' }}>
        <div className="max-w-md p-6 border-[0.5px] rounded-sm" style={{ borderColor: `${SPECTRAL.red}30`, backgroundColor: `${SPECTRAL.red}08` }}>
          <div className="flex items-start gap-4">
            <BreathingOrb colour={SPECTRAL.red} isActive size="sm" />
            <div>
              <h2 className="text-sm font-medium" style={{ color: SPECTRAL.red }}>Error</h2>
              <p className="text-white/50 mt-1 text-sm">{error}</p>
              <button
                onClick={() => router.back()}
                className="mt-4 px-4 py-2 text-[10px] uppercase tracking-[0.2em] border-[0.5px] border-white/[0.06] rounded-sm text-white/40 hover:text-white/70 hover:border-white/[0.1] transition-colors"
                style={{ background: 'rgba(255,255,255,0.01)' }}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white" style={{ background: '#050505' }}>
      <MobileNav />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Navigation ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASING.outExpo }}
          className="mb-10"
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
        </motion.div>

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASING.outExpo }}
          className="mb-8 text-center"
        >
          <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight text-white">
            Transaction Explorer
          </h1>
          <p className="text-white/30 mt-3 text-sm tracking-wide">
            {pagination ? `${pagination.total.toLocaleString()} analysed transactions` : 'Loading...'}
          </p>
        </motion.div>

        {/* ── Quick Export Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: EASING.outExpo }}
          className="mb-6 flex flex-wrap items-center justify-end gap-3"
        >
          <button
            onClick={handleQuickExportExcel}
            disabled={isQuickExporting || !tenantId}
            className="px-4 py-2 rounded-sm text-[10px] uppercase tracking-[0.15em] font-medium border-[0.5px] flex items-center gap-2 transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              backgroundColor: 'rgba(255,255,255,0.02)',
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Quick Excel
          </button>
          <button
            onClick={handleQuickExportPackage}
            disabled={isQuickExporting || !tenantId}
            className="px-4 py-2 rounded-sm text-[10px] uppercase tracking-[0.15em] font-medium border-[0.5px] flex items-center gap-2 transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: `${SPECTRAL.emerald}30`,
              color: SPECTRAL.emerald,
              backgroundColor: `${SPECTRAL.emerald}10`,
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            Accountant Package
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            disabled={!tenantId}
            className="px-4 py-2 rounded-sm text-[10px] uppercase tracking-[0.15em] font-medium border-[0.5px] flex items-center gap-2 transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: `${SPECTRAL.cyan}30`,
              color: SPECTRAL.cyan,
              backgroundColor: `${SPECTRAL.cyan}10`,
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Custom Export
          </button>
        </motion.div>

        {/* ── Summary Stats ── */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: EASING.outExpo }}
            className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            <div className="p-4 border-[0.5px] border-white/[0.06] rounded-sm" style={{ background: 'rgba(255,255,255,0.01)' }}>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-1">R&D Candidates</p>
              <p className="text-2xl font-light tabular-nums" style={{ color: SPECTRAL.magenta }}>
                {summary.rnd.candidates.toLocaleString()}
              </p>
            </div>
            <div className="p-4 border-[0.5px] border-white/[0.06] rounded-sm" style={{ background: 'rgba(255,255,255,0.01)' }}>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-1">Claimable Amount</p>
              <p className="text-2xl font-light tabular-nums" style={{ color: SPECTRAL.emerald }}>
                {formatCurrency(summary.deductions.totalClaimableAmount)}
              </p>
            </div>
            <div className="p-4 border-[0.5px] border-white/[0.06] rounded-sm" style={{ background: 'rgba(255,255,255,0.01)' }}>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-1">Division 7A Risk</p>
              <p className="text-2xl font-light tabular-nums" style={{ color: SPECTRAL.red }}>
                {summary.compliance.division7aRisk.toLocaleString()}
              </p>
            </div>
            <div className="p-4 border-[0.5px] border-white/[0.06] rounded-sm" style={{ background: 'rgba(255,255,255,0.01)' }}>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-1">High Confidence</p>
              <p className="text-2xl font-light tabular-nums" style={{ color: SPECTRAL.cyan }}>
                {summary.confidence.high.toLocaleString()}
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Filters ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: EASING.outExpo }}
          className="mb-6 p-4 border-[0.5px] border-white/[0.06] rounded-sm"
          style={{ background: 'rgba(255,255,255,0.01)' }}
        >
          <div className="flex flex-wrap gap-4 items-end">
            {/* Financial Year */}
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] uppercase tracking-[0.2em] text-white/30 mb-2">Financial Year</label>
              <select
                value={financialYear}
                onChange={(e) => { setFinancialYear(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 bg-transparent border-[0.5px] border-white/[0.1] rounded-sm text-sm text-white/70 focus:outline-none focus:border-white/[0.2]"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <option value="" className="bg-[#0a0a0f]">All Years</option>
                {financialYears.map(fy => (
                  <option key={fy} value={fy} className="bg-[#0a0a0f]">{fy}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] uppercase tracking-[0.2em] text-white/30 mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 bg-transparent border-[0.5px] border-white/[0.1] rounded-sm text-sm text-white/70 focus:outline-none focus:border-white/[0.2]"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <option value="" className="bg-[#0a0a0f]">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat} className="bg-[#0a0a0f]">{cat}</option>
                ))}
              </select>
            </div>

            {/* R&D Candidate */}
            <div className="flex-1 min-w-[130px]">
              <label className="block text-[10px] uppercase tracking-[0.2em] text-white/30 mb-2">R&D Candidate</label>
              <select
                value={isRndCandidate}
                onChange={(e) => { setIsRndCandidate(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 bg-transparent border-[0.5px] border-white/[0.1] rounded-sm text-sm text-white/70 focus:outline-none focus:border-white/[0.2]"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <option value="" className="bg-[#0a0a0f]">All</option>
                <option value="true" className="bg-[#0a0a0f]">Yes</option>
                <option value="false" className="bg-[#0a0a0f]">No</option>
              </select>
            </div>

            {/* Confidence Slider */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] uppercase tracking-[0.2em] text-white/30 mb-2">
                Min Confidence: {minConfidence}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={minConfidence}
                onChange={(e) => { setMinConfidence(parseInt(e.target.value)); setPage(1) }}
                className="w-full accent-cyan-400"
              />
            </div>

            {/* Search */}
            <div className="flex-[2] min-w-[200px]">
              <label className="block text-[10px] uppercase tracking-[0.2em] text-white/30 mb-2">Search</label>
              <input
                type="text"
                placeholder="Supplier or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-transparent border-[0.5px] border-white/[0.1] rounded-sm text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-white/[0.2]"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              />
            </div>
          </div>

          {/* Active filters summary */}
          {(financialYear || category || isRndCandidate || minConfidence > 0 || debouncedSearchQuery) && (
            <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between">
              <p className="text-[10px] text-white/40">
                Showing {transactions.length.toLocaleString()} of {pagination?.total.toLocaleString() || 0} transactions
                {financialYear && <span className="ml-2 text-white/60">| {financialYear}</span>}
                {category && <span className="ml-2 text-white/60">| {category}</span>}
                {isRndCandidate && <span className="ml-2 text-white/60">| R&D: {isRndCandidate}</span>}
                {minConfidence > 0 && <span className="ml-2 text-white/60">| Conf &ge; {minConfidence}%</span>}
              </p>
              <button
                onClick={() => {
                  setFinancialYear('')
                  setCategory('')
                  setIsRndCandidate('')
                  setMinConfidence(0)
                  setSearchQuery('')
                  setPage(1)
                }}
                className="text-[10px] uppercase tracking-[0.15em] text-white/40 hover:text-white/70 transition-colors"
              >
                Clear All
              </button>
            </div>
          )}
        </motion.div>

        {/* ── Selection Actions Bar ── */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: EASING.outExpo }}
              className="mb-4 p-4 border-[0.5px] rounded-sm flex items-center justify-between"
              style={{
                borderColor: `${SPECTRAL.cyan}30`,
                backgroundColor: `${SPECTRAL.cyan}08`,
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm" style={{ color: SPECTRAL.cyan }}>
                  {selectedIds.size} transaction{selectedIds.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={clearSelection}
                  className="text-[10px] uppercase tracking-[0.15em] text-white/40 hover:text-white/70 transition-colors"
                >
                  Clear
                </button>
              </div>
              <button
                onClick={() => setShowExportModal(true)}
                className="px-4 py-2 rounded-sm text-[10px] uppercase tracking-[0.15em] font-medium border-[0.5px] flex items-center gap-2 transition-all hover:brightness-110"
                style={{
                  borderColor: `${SPECTRAL.emerald}40`,
                  color: SPECTRAL.emerald,
                  backgroundColor: `${SPECTRAL.emerald}15`,
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Selected
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Table ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: EASING.outExpo }}
          className="border-[0.5px] border-white/[0.06] rounded-sm overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.01)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {/* Select All Checkbox */}
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={transactions.length > 0 && selectedIds.size === transactions.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-white/20 bg-transparent text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
                    />
                  </th>
                  <th
                    onClick={() => handleSort('transaction_date')}
                    className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium cursor-pointer hover:text-white/70 transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      Date
                      {sortField === 'transaction_date' && (
                        <span className="text-cyan-400">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort('supplier_name')}
                    className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium cursor-pointer hover:text-white/70 transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      Supplier
                      {sortField === 'supplier_name' && (
                        <span className="text-cyan-400">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort('transaction_amount')}
                    className="px-4 py-3 text-right text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium cursor-pointer hover:text-white/70 transition-colors"
                  >
                    <span className="flex items-center justify-end gap-1">
                      Amount
                      {sortField === 'transaction_amount' && (
                        <span className="text-cyan-400">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">
                    Category
                  </th>
                  <th
                    onClick={() => handleSort('category_confidence')}
                    className="px-4 py-3 text-center text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium cursor-pointer hover:text-white/70 transition-colors"
                  >
                    <span className="flex items-center justify-center gap-1">
                      Confidence
                      {sortField === 'category_confidence' && (
                        <span className="text-cyan-400">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">
                    R&D
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">
                    Deduction
                  </th>
                  <th className="px-3 py-3 w-10">
                    {/* Expand indicator header */}
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <BreathingOrb colour={SPECTRAL.grey} isActive={false} size="md" />
                        <p className="text-white/30 text-sm">No transactions match the current filters</p>
                        <button
                          onClick={() => {
                            setFinancialYear('')
                            setCategory('')
                            setIsRndCandidate('')
                            setMinConfidence(0)
                            setSearchQuery('')
                            setPage(1)
                          }}
                          className="mt-2 px-4 py-2 text-[10px] uppercase tracking-[0.2em] border-[0.5px] border-white/[0.06] rounded-sm text-white/40 hover:text-white/70 hover:border-white/[0.1] transition-colors"
                          style={{ background: 'rgba(255,255,255,0.01)' }}
                        >
                          Clear Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <TransactionDetailRow
                      key={txn.transaction_id}
                      transaction={txn}
                      isExpanded={expandedId === txn.transaction_id}
                      isSelected={selectedIds.has(txn.transaction_id)}
                      onToggleExpand={() => setExpandedId(expandedId === txn.transaction_id ? null : txn.transaction_id)}
                      onToggleSelect={() => toggleSelection(txn.transaction_id)}
                      categoryColour={getCategoryColour(txn.primary_category)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-4 py-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">Page Size</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(parseInt(e.target.value)); setPage(1) }}
                  className="px-2 py-1 bg-transparent border-[0.5px] border-white/[0.1] rounded-sm text-sm text-white/70"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  {[25, 50, 100, 500].map(size => (
                    <option key={size} value={size} className="bg-[#0a0a0f]">{size}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] border-[0.5px] border-white/[0.1] rounded-sm text-white/50 hover:text-white/70 hover:border-white/[0.2] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  Previous
                </button>

                <span className="px-3 text-sm text-white/40 tabular-nums">
                  Page {page} of {pagination.totalPages}
                </span>

                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={!pagination.hasMore}
                  className="px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] border-[0.5px] border-white/[0.1] rounded-sm text-white/50 hover:text-white/70 hover:border-white/[0.2] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Footer ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center"
        >
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/20">
            Analysis for informational purposes only &mdash; Professional review recommended
          </p>
        </motion.div>
      </div>

      {/* ── Export Modal ── */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        tenantId={tenantId || ''}
        onExport={handleExport}
        selectedTransactionIds={Array.from(selectedIds)}
        currentFilters={
          financialYear || category || isRndCandidate || minConfidence > 0
            ? {
                financialYear: financialYear || undefined,
                isRndCandidate: isRndCandidate === 'true' ? true : isRndCandidate === 'false' ? false : undefined,
                primaryCategory: category || undefined,
                minConfidence: minConfidence > 0 ? minConfidence : undefined,
              }
            : undefined
        }
        defaultOrganizationName={organizationName}
      />

      {/* ── Toast Notification ── */}
      <AnimatePresence>
        {exportToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            transition={{ duration: 0.3, ease: EASING.outExpo }}
            className="fixed bottom-6 left-1/2 z-50 px-6 py-3 rounded-sm border-[0.5px] backdrop-blur-xl flex items-center gap-3"
            style={{
              borderColor: exportToast.type === 'success' ? `${SPECTRAL.emerald}40` : `${SPECTRAL.red}40`,
              backgroundColor: exportToast.type === 'success' ? `${SPECTRAL.emerald}15` : `${SPECTRAL.red}15`,
            }}
          >
            {exportToast.type === 'success' ? (
              <svg className="w-5 h-5" style={{ color: SPECTRAL.emerald }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" style={{ color: SPECTRAL.red }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="text-sm text-white/80">{exportToast.message}</span>
            <button
              onClick={() => setExportToast(null)}
              className="ml-2 text-white/40 hover:text-white/70 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <TaxDisclaimer />
    </div>
  )
}
