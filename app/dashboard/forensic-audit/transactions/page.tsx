/**
 * Transaction Explorer Page
 *
 * Scientific Luxury Design System implementation.
 * Interactive filterable data grid showing all analysed transactions.
 */

'use client'

import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { MobileNav } from '@/components/ui/MobileNav'

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

function formatDate(dateString: string | null): string {
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
        let aVal: any, bVal: any

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
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-20 text-center">
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
                  transactions.map((txn, idx) => (
                    <motion.tr
                      key={txn.transaction_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.5), duration: 0.3, ease: EASING.outExpo }}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm text-white/50 font-mono tabular-nums">
                        {formatDate(txn.transaction_date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[200px]">
                          <p className="text-sm text-white/70 truncate">{txn.supplier_name || 'Unknown'}</p>
                          <p className="text-[10px] text-white/30 truncate mt-0.5">
                            {txn.transaction_description?.substring(0, 50) || '-'}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        <span className={txn.transaction_amount >= 0 ? 'text-white/70' : 'text-red-400'}>
                          {formatCurrency(Math.abs(txn.transaction_amount))}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-[0.1em] border-[0.5px]"
                          style={{
                            borderColor: `${getCategoryColour(txn.primary_category)}30`,
                            color: getCategoryColour(txn.primary_category),
                            backgroundColor: `${getCategoryColour(txn.primary_category)}08`,
                          }}
                        >
                          {txn.primary_category || 'Uncategorised'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-12 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${txn.category_confidence || 0}%`,
                                backgroundColor: (txn.category_confidence || 0) >= 80 ? SPECTRAL.emerald :
                                  (txn.category_confidence || 0) >= 60 ? SPECTRAL.amber : SPECTRAL.red
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-white/40 tabular-nums w-8">
                            {txn.category_confidence || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {txn.is_rnd_candidate ? (
                          <span
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold"
                            style={{
                              backgroundColor: `${SPECTRAL.magenta}15`,
                              color: SPECTRAL.magenta,
                              border: `0.5px solid ${SPECTRAL.magenta}40`
                            }}
                          >
                            R
                          </span>
                        ) : (
                          <span className="text-white/20">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-white/50">
                          {txn.deduction_type || (txn.is_fully_deductible ? 'Full' : '-')}
                        </span>
                      </td>
                    </motion.tr>
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
    </div>
  )
}
