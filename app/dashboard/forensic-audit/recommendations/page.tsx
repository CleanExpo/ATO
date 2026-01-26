/**
 * Recommendations Page
 *
 * Scientific Luxury Design System implementation.
 * Shows all actionable recommendations with filtering and sorting.
 */

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { MobileNav } from '@/components/ui/MobileNav'
import ExpandableRecommendationCard from '@/components/forensic-audit/ExpandableRecommendationCard'

// ─── Types ───────────────────────────────────────────────────────────

interface Recommendation {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  taxArea: 'rnd' | 'deductions' | 'losses' | 'div7a'
  financialYear: string
  action: string
  description: string
  estimatedBenefit: number
  confidence: number
  adjustedBenefit: number
  netBenefit: number
  atoForms: string[]
  deadline: string
  amendmentWindow: 'open' | 'closing_soon' | 'closed'
  transactionCount: number
  status: 'identified' | 'in_progress' | 'completed' | 'rejected'
  legislativeReference?: string
  documentationRequired?: string[]
}

type FilterType = 'all' | 'critical' | 'high' | 'medium' | 'low'
type TaxAreaFilter = 'all' | 'rnd' | 'deductions' | 'losses' | 'div7a'

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

const PRIORITY_COLOURS: Record<string, string> = {
  all: SPECTRAL.cyan,
  critical: SPECTRAL.red,
  high: SPECTRAL.amber,
  medium: SPECTRAL.cyan,
  low: SPECTRAL.grey,
}

const TAX_AREA_COLOURS: Record<string, string> = {
  all: SPECTRAL.cyan,
  rnd: SPECTRAL.magenta,
  deductions: SPECTRAL.cyan,
  losses: SPECTRAL.amber,
  div7a: SPECTRAL.red,
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

// ─── Component ───────────────────────────────────────────────────────

export default function RecommendationsPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#050505' }}>
        <div className="flex flex-col items-center gap-4">
          <BreathingOrb colour={SPECTRAL.cyan} isActive size="md" />
          <p className="text-white/40 text-[10px] uppercase tracking-[0.3em]">Loading Recommendations</p>
        </div>
      </div>
    }>
      <RecommendationsPage />
    </Suspense>
  )
}

function RecommendationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [filteredRecommendations, setFilteredRecommendations] = useState<Recommendation[]>([])
  const [priorityFilter, setPriorityFilter] = useState<FilterType>('all')
  const [taxAreaFilter, setTaxAreaFilter] = useState<TaxAreaFilter>('all')
  const [error, setError] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [uploadingReport, setUploadingReport] = useState(false)
  const [attachingFindings, setAttachingFindings] = useState(false)
  const [xeroActionResult, setXeroActionResult] = useState<{ type: string; message: string } | null>(null)

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

  useEffect(() => {
    if (tenantId) {
      loadRecommendations()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  useEffect(() => {
    filterRecommendations()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priorityFilter, taxAreaFilter, recommendations])

  async function loadRecommendations() {
    if (!tenantId) return
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/audit/recommendations?tenantId=${tenantId}`)
      const data = await response.json()
      setRecommendations(data.recommendations || [])
    } catch (err) {
      console.error('Failed to load recommendations:', err)
      setError('Failed to load recommendations')
    } finally {
      setLoading(false)
    }
  }

  function filterRecommendations() {
    let filtered = recommendations
    if (priorityFilter !== 'all') {
      filtered = filtered.filter((rec) => rec.priority === priorityFilter)
    }
    if (taxAreaFilter !== 'all') {
      filtered = filtered.filter((rec) => rec.taxArea === taxAreaFilter)
    }
    setFilteredRecommendations(filtered)
  }

  // Loading state
  if (loading || !tenantId) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#050505' }}>
        <div className="flex flex-col items-center gap-6">
          <BreathingOrb colour={SPECTRAL.cyan} isActive size="md" />
          <div className="text-center">
            <p className="text-white/50 text-sm">Generating recommendations</p>
            <p className="text-white/20 text-[10px] uppercase tracking-[0.3em] mt-2">
              Analysing tax optimisation opportunities
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

  const totalBenefit = filteredRecommendations.reduce((sum, rec) => sum + rec.adjustedBenefit, 0)

  return (
    <div className="min-h-screen text-white" style={{ background: '#050505' }}>
      <MobileNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

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
          className="mb-12 text-center"
        >
          <h1 className="text-5xl font-extralight tracking-tight text-white">
            Actionable Recommendations
          </h1>
          <p className="text-white/30 mt-3 text-sm tracking-wide">
            Prioritised tax optimisation opportunities with specific actions
          </p>
        </motion.div>

        {/* ── Filters ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASING.outExpo }}
          className="mb-8 p-6 border-[0.5px] border-white/[0.06] rounded-sm"
          style={{ background: 'rgba(255,255,255,0.01)' }}
        >
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Priority Filter */}
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-3 text-center">Priority</p>
              <div className="flex gap-2 flex-wrap justify-center">
                {(['all', 'critical', 'high', 'medium', 'low'] as const).map((priority) => {
                  const isActive = priorityFilter === priority
                  const colour = PRIORITY_COLOURS[priority]
                  const count = priority === 'all'
                    ? recommendations.length
                    : recommendations.filter((r) => r.priority === priority).length

                  return (
                    <button
                      key={priority}
                      onClick={() => setPriorityFilter(priority)}
                      className="px-3 py-1.5 rounded-sm text-[10px] uppercase tracking-[0.15em] font-medium border-[0.5px] transition-all"
                      style={{
                        borderColor: isActive ? `${colour}40` : 'rgba(255,255,255,0.06)',
                        color: isActive ? colour : 'rgba(255,255,255,0.4)',
                        backgroundColor: isActive ? `${colour}10` : 'transparent',
                      }}
                    >
                      {priority === 'all' ? 'All' : priority}
                      <span className="ml-1.5 font-mono tabular-nums">{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="hidden lg:block w-px bg-white/[0.06]" />

            {/* Tax Area Filter */}
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-3 text-center">Tax Area</p>
              <div className="flex gap-2 flex-wrap justify-center">
                {([
                  { key: 'all' as const, label: 'All' },
                  { key: 'rnd' as const, label: 'R&D' },
                  { key: 'deductions' as const, label: 'Deductions' },
                  { key: 'losses' as const, label: 'Losses' },
                  { key: 'div7a' as const, label: 'Division 7A' },
                ]).map(({ key, label }) => {
                  const isActive = taxAreaFilter === key
                  const colour = TAX_AREA_COLOURS[key]

                  return (
                    <button
                      key={key}
                      onClick={() => setTaxAreaFilter(key)}
                      className="px-3 py-1.5 rounded-sm text-[10px] uppercase tracking-[0.15em] font-medium border-[0.5px] transition-all"
                      style={{
                        borderColor: isActive ? `${colour}40` : 'rgba(255,255,255,0.06)',
                        color: isActive ? colour : 'rgba(255,255,255,0.4)',
                        backgroundColor: isActive ? `${colour}10` : 'transparent',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Total Benefit Data Strip */}
          <div className="mt-6 pt-6 border-t border-white/[0.06] flex items-center justify-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">
              Filtered Total Benefit (Confidence-Adjusted)
            </span>
            <span className="font-mono text-3xl font-medium tabular-nums" style={{ color: SPECTRAL.emerald }}>
              {formatCurrency(totalBenefit)}
            </span>
          </div>
        </motion.div>

        {/* ── Xero Actions ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: EASING.outExpo }}
          className="mb-8 p-4 border-[0.5px] border-white/[0.06] rounded-sm flex flex-wrap items-center justify-center gap-3"
          style={{ background: 'rgba(255,255,255,0.01)' }}
        >
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">Xero Integration</span>
          <div className="h-4 w-px bg-white/10" />

          {/* Upload Report */}
          <button
            onClick={async () => {
              if (!tenantId) return
              setUploadingReport(true)
              setXeroActionResult(null)
              try {
                const reportRes = await fetch(`/api/audit/reports/generate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tenantId, format: 'pdf' }),
                })
                const reportData = await reportRes.json()
                if (reportData.pdfBase64) {
                  const uploadRes = await fetch('/api/xero/files', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      tenantId,
                      reportType: 'forensic-audit',
                      reportContent: reportData.pdfBase64,
                      fileName: `ATO_Forensic_Audit_${new Date().toISOString().split('T')[0]}.pdf`,
                    }),
                  })
                  const uploadData = await uploadRes.json()
                  if (uploadData.fileId) {
                    setXeroActionResult({ type: 'success', message: `Report uploaded to Xero Files: ${uploadData.fileName}` })
                  } else {
                    setXeroActionResult({ type: 'error', message: uploadData.error || 'Upload failed' })
                  }
                } else {
                  setXeroActionResult({ type: 'error', message: 'Failed to generate PDF report' })
                }
              } catch {
                setXeroActionResult({ type: 'error', message: 'Failed to upload report' })
              } finally {
                setUploadingReport(false)
              }
            }}
            disabled={uploadingReport || !tenantId}
            className="px-4 py-2 rounded-sm text-[10px] uppercase tracking-[0.15em] font-medium border-[0.5px] flex items-center gap-2 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            style={{
              borderColor: `${SPECTRAL.cyan}30`,
              color: SPECTRAL.cyan,
              backgroundColor: `${SPECTRAL.cyan}08`,
            }}
          >
            {uploadingReport ? (
              <>
                <BreathingOrb colour={SPECTRAL.cyan} isActive size="xs" />
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Report to Xero
              </>
            )}
          </button>

          {/* Attach Findings */}
          <button
            onClick={async () => {
              if (!tenantId) return
              setAttachingFindings(true)
              setXeroActionResult(null)
              try {
                const res = await fetch('/api/xero/attachments', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tenantId }),
                })
                const data = await res.json()
                if (data.attached > 0) {
                  setXeroActionResult({
                    type: 'success',
                    message: `Attached findings to ${data.attached} transactions in Xero${data.failed > 0 ? ` (${data.failed} failed)` : ''}`,
                  })
                } else if (data.status === 'no_data') {
                  setXeroActionResult({ type: 'info', message: 'No recommendations with transactions to attach' })
                } else {
                  setXeroActionResult({ type: 'error', message: data.error || 'Attachment failed' })
                }
              } catch {
                setXeroActionResult({ type: 'error', message: 'Failed to attach findings' })
              } finally {
                setAttachingFindings(false)
              }
            }}
            disabled={attachingFindings || !tenantId}
            className="px-4 py-2 rounded-sm text-[10px] uppercase tracking-[0.15em] font-medium border-[0.5px] flex items-center gap-2 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            style={{
              borderColor: `${SPECTRAL.emerald}30`,
              color: SPECTRAL.emerald,
              backgroundColor: `${SPECTRAL.emerald}08`,
            }}
          >
            {attachingFindings ? (
              <>
                <BreathingOrb colour={SPECTRAL.emerald} isActive size="xs" />
                Attaching...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Attach Findings
              </>
            )}
          </button>

          {/* View Reconciliation */}
          <Link
            href={`/dashboard/forensic-audit/reconciliation${tenantId ? `?tenantId=${tenantId}` : ''}`}
            className="px-4 py-2 rounded-sm text-[10px] uppercase tracking-[0.15em] font-medium border-[0.5px] flex items-center gap-2 transition-all"
            style={{
              borderColor: `${SPECTRAL.magenta}30`,
              color: SPECTRAL.magenta,
              backgroundColor: `${SPECTRAL.magenta}08`,
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            View Reconciliation
          </Link>

          {/* Action Result */}
          {xeroActionResult && (
            <div
              className="w-full mt-2 p-3 rounded-sm text-sm border-[0.5px]"
              style={{
                borderColor: xeroActionResult.type === 'success'
                  ? `${SPECTRAL.emerald}30`
                  : xeroActionResult.type === 'info'
                    ? `${SPECTRAL.cyan}30`
                    : `${SPECTRAL.red}30`,
                color: xeroActionResult.type === 'success'
                  ? SPECTRAL.emerald
                  : xeroActionResult.type === 'info'
                    ? SPECTRAL.cyan
                    : SPECTRAL.red,
                backgroundColor: xeroActionResult.type === 'success'
                  ? `${SPECTRAL.emerald}08`
                  : xeroActionResult.type === 'info'
                    ? `${SPECTRAL.cyan}08`
                    : `${SPECTRAL.red}08`,
              }}
            >
              {xeroActionResult.message}
            </div>
          )}
        </motion.div>

        {/* ── Recommendations List ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: EASING.outExpo }}
          className="space-y-4"
        >
          {filteredRecommendations.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-4 border-[0.5px] border-white/[0.06] rounded-sm"
              style={{ background: 'rgba(255,255,255,0.01)' }}
            >
              <BreathingOrb colour={SPECTRAL.grey} isActive={false} size="md" />
              <p className="text-white/30 text-sm">No recommendations match the current filters</p>
              <button
                onClick={() => {
                  setPriorityFilter('all')
                  setTaxAreaFilter('all')
                }}
                className="mt-2 px-4 py-2 text-[10px] uppercase tracking-[0.2em] border-[0.5px] border-white/[0.06] rounded-sm text-white/40 hover:text-white/70 hover:border-white/[0.1] transition-colors"
                style={{ background: 'rgba(255,255,255,0.01)' }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            filteredRecommendations.map((rec, idx) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + idx * 0.05, duration: 0.5, ease: EASING.outExpo }}
              >
                <ExpandableRecommendationCard
                  recommendation={{
                    ...rec,
                    legislativeReference: rec.legislativeReference || 'Section 8-1 ITAA 1997',
                    documentationRequired: rec.documentationRequired || [],
                  }}
                  tenantId={tenantId || ''}
                />
              </motion.div>
            ))
          )}
        </motion.div>

        {/* ── Footer ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10 text-center"
        >
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/20">
            Analysis for informational purposes only &mdash; Professional review recommended before implementation
          </p>
        </motion.div>
      </div>
    </div>
  )
}
