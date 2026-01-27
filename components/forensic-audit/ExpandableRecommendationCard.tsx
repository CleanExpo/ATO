/**
 * Expandable Recommendation Card
 *
 * Scientific Luxury Design System implementation.
 * Shows recommendation summary in collapsed state.
 * Expands to show transaction table with Xero links on click.
 *
 * Features:
 * - Click anywhere on header to expand/collapse
 * - Lazy loads transactions only when expanded
 * - Animated expand/collapse with framer-motion
 * - Pagination support (20 at a time)
 * - Direct Xero links for each transaction
 * - Breathing orbs, spectral colours, data strips
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { StatusBadge } from '@/components/status'
import { DocumentList, DocumentUpload, DocumentCountBadge } from '@/components/documents'
import type { RecommendationStatus, StatusHistory } from '@/lib/types/recommendation-status'
import type { DocumentWithUrl, RecommendationDocument } from '@/lib/types/recommendation-documents'
import { getDocumentSuggestions } from '@/lib/types/recommendation-documents'

interface Transaction {
  transactionId: string
  transactionDate: string
  transactionType: string
  contactName: string | null
  description: string
  amount: number
  accountCode: string | null
  financialYear: string
  xeroUrl: string | null
}

interface TransactionsSummary {
  totalAmount: number
  transactionCount: number
  byFinancialYear: Record<string, { count: number; amount: number }>
  byCategory: Record<string, { count: number; amount: number }>
}

interface Recommendation {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  taxArea: string
  financialYear: string
  action: string
  description: string
  estimatedBenefit: number
  adjustedBenefit: number
  confidence: number
  legislativeReference: string
  documentationRequired?: string[]
  transactionCount: number
  deadline?: string
  atoForms?: string[]
}

interface ExpandableRecommendationCardProps {
  recommendation: Recommendation
  tenantId: string
  statusInfo?: {
    currentStatus: RecommendationStatus
    lastUpdatedAt?: string
    lastUpdatedBy?: string
  }
  onStatusChange?: (recommendationId: string, status: RecommendationStatus, notes?: string) => Promise<void>
  documentCount?: number
  onDocumentUpload?: (recommendationId: string, file: File, description?: string) => Promise<RecommendationDocument>
  onDocumentDelete?: (recommendationId: string, documentId: string) => Promise<void>
}

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
  outExpo: [0.19, 1, 0.22, 1] as [number, number, number, number],
}

const PRIORITY_COLOURS: Record<string, string> = {
  critical: SPECTRAL.red,
  high: SPECTRAL.amber,
  medium: SPECTRAL.cyan,
  low: SPECTRAL.grey,
}

const TAX_AREA_LABELS: Record<string, string> = {
  rnd: 'R&D Tax Incentive',
  deductions: 'Deductions',
  losses: 'Loss Carry-Forward',
  div7a: 'Division 7A',
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

function formatCurrencyDetailed(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A'
  try {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// ─── Breathing Orb ──────────────────────────────────────────────────

function BreathingOrb({ colour, isActive = true, size = 'xs' }: {
  colour: string
  isActive?: boolean
  size?: 'xs' | 'sm'
}) {
  const sizes = { xs: 'h-5 w-5', sm: 'h-8 w-8' }
  const dotSizes = { xs: 'h-1.5 w-1.5', sm: 'h-2 w-2' }

  return (
    <motion.div
      className={`${sizes[size]} flex items-center justify-center rounded-full border-[0.5px]`}
      style={{
        borderColor: isActive ? `${colour}50` : 'rgba(255,255,255,0.1)',
        backgroundColor: isActive ? `${colour}10` : 'rgba(255,255,255,0.02)',
        boxShadow: isActive ? `0 0 20px ${colour}30` : 'none',
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

function ExternalLinkIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

// ─── Component ───────────────────────────────────────────────────────

export default function ExpandableRecommendationCard({
  recommendation,
  tenantId,
  statusInfo,
  onStatusChange,
  documentCount = 0,
  onDocumentUpload,
  onDocumentDelete,
}: ExpandableRecommendationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<TransactionsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [documents, setDocuments] = useState<DocumentWithUrl[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [localDocCount, setLocalDocCount] = useState(documentCount)

  const priorityColour = PRIORITY_COLOURS[recommendation.priority] || SPECTRAL.grey

  const loadTransactions = useCallback(async (loadMore = false) => {
    if (loading) return

    const currentOffset = loadMore ? offset : 0

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/audit/recommendations/${recommendation.id}/transactions?tenantId=${tenantId}&limit=20&offset=${currentOffset}`
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load transactions')
      }

      const data = await response.json()

      if (loadMore) {
        setTransactions((prev) => [...prev, ...data.transactions])
      } else {
        setTransactions(data.transactions)
        setSummary(data.summary)
      }

      setHasMore(data.pagination.hasMore)
      setOffset(currentOffset + data.transactions.length)
    } catch (err) {
      console.error('Failed to load transactions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load transaction details')
    } finally {
      setLoading(false)
    }
  }, [loading, offset, recommendation.id, tenantId])

  const loadDocuments = useCallback(async () => {
    setDocumentsLoading(true)
    try {
      const response = await fetch(
        `/api/recommendations/${recommendation.id}/documents?tenantId=${tenantId}`
      )
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
        setLocalDocCount(data.documents?.length || 0)
      }
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      setDocumentsLoading(false)
    }
  }, [recommendation.id, tenantId])

  const handleDocumentUpload = useCallback(async (file: File, description?: string): Promise<RecommendationDocument> => {
    if (!onDocumentUpload) throw new Error('Upload not available')
    const doc = await onDocumentUpload(recommendation.id, file, description)
    // Refresh documents list
    loadDocuments()
    return doc
  }, [recommendation.id, onDocumentUpload, loadDocuments])

  const handleDocumentDelete = useCallback(async (documentId: string) => {
    if (!onDocumentDelete) return
    await onDocumentDelete(recommendation.id, documentId)
    // Refresh documents list
    loadDocuments()
  }, [recommendation.id, onDocumentDelete, loadDocuments])

  // Update local doc count when prop changes
  useEffect(() => {
    setLocalDocCount(documentCount)
  }, [documentCount])

  function handleToggle() {
    const willExpand = !isExpanded
    setIsExpanded(willExpand)

    if (willExpand && transactions.length === 0) {
      loadTransactions()
    }
    if (willExpand && documents.length === 0) {
      loadDocuments()
    }
  }

  return (
    <div
      className="border-[0.5px] rounded-sm transition-all"
      style={{
        borderColor: isExpanded ? `${priorityColour}30` : 'rgba(255,255,255,0.06)',
        backgroundColor: isExpanded ? `${priorityColour}03` : 'rgba(255,255,255,0.01)',
        boxShadow: isExpanded ? `0 0 40px ${priorityColour}08` : 'none',
      }}
    >
      {/* ── Header ── */}
      <div
        className="p-5 cursor-pointer select-none"
        onClick={handleToggle}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <BreathingOrb colour={priorityColour} isActive size="xs" />
              <span
                className="px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-[0.15em] border-[0.5px]"
                style={{
                  borderColor: `${priorityColour}30`,
                  color: priorityColour,
                  backgroundColor: `${priorityColour}08`,
                }}
              >
                {recommendation.priority}
              </span>
              <span
                className="px-2 py-0.5 rounded-sm text-[10px] uppercase tracking-[0.1em] border-[0.5px]"
                style={{
                  borderColor: `${SPECTRAL.magenta}20`,
                  color: `${SPECTRAL.magenta}90`,
                  backgroundColor: `${SPECTRAL.magenta}06`,
                }}
              >
                {TAX_AREA_LABELS[recommendation.taxArea] || recommendation.taxArea}
              </span>
              <span className="px-2 py-0.5 rounded-sm text-[10px] border-[0.5px] border-white/[0.06] text-white/40 font-mono">
                {recommendation.financialYear}
              </span>
              {recommendation.transactionCount > 0 && (
                <span
                  className="px-2 py-0.5 rounded-sm text-[10px] border-[0.5px] font-mono tabular-nums"
                  style={{
                    borderColor: `${SPECTRAL.cyan}20`,
                    color: `${SPECTRAL.cyan}80`,
                    backgroundColor: `${SPECTRAL.cyan}06`,
                  }}
                >
                  {recommendation.transactionCount} txns
                </span>
              )}
              {statusInfo && (
                <StatusBadge
                  status={statusInfo.currentStatus}
                  size="sm"
                  lastUpdatedAt={statusInfo.lastUpdatedAt}
                  lastUpdatedBy={statusInfo.lastUpdatedBy}
                  animate={false}
                />
              )}
              {localDocCount > 0 && (
                <span
                  className="px-2 py-0.5 rounded-sm text-[10px] border-[0.5px] font-mono tabular-nums flex items-center gap-1"
                  style={{
                    borderColor: 'rgba(59, 130, 246, 0.2)',
                    color: 'rgba(59, 130, 246, 0.8)',
                    backgroundColor: 'rgba(59, 130, 246, 0.06)',
                  }}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {localDocCount}
                </span>
              )}
            </div>

            {/* Action */}
            <h3 className="text-base font-medium text-white/90 mb-2 leading-tight">
              {recommendation.action}
            </h3>

            {/* Description */}
            <p className="text-sm text-white/40 mb-3 line-clamp-2">
              {recommendation.description}
            </p>

            {/* Details row */}
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-white/30">
              <span className="font-mono tabular-nums">
                <span className="uppercase tracking-[0.15em]">Conf</span> {recommendation.confidence}%
              </span>
              <div className="h-3 w-px bg-white/10" />
              <span>{recommendation.legislativeReference}</span>
              {recommendation.deadline && (
                <>
                  <div className="h-3 w-px bg-white/10" />
                  <span className="font-mono tabular-nums">{formatDate(recommendation.deadline)}</span>
                </>
              )}
            </div>
          </div>

          {/* Right side - benefit and chevron */}
          <div className="flex flex-col items-end flex-shrink-0 gap-3">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1">Adjusted Benefit</p>
              <p className="text-2xl font-mono font-medium tabular-nums" style={{ color: SPECTRAL.emerald }}>
                {formatCurrency(recommendation.adjustedBenefit)}
              </p>
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.3, ease: EASING.outExpo }}
              className="w-6 h-6 flex items-center justify-center rounded-sm border-[0.5px] border-white/[0.06]"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <svg className="w-3 h-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── Expanded Content ── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASING.outExpo }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] p-5">
              {/* Summary Data Strip */}
              {summary && (
                <div className="flex flex-wrap items-center gap-6 px-4 py-3 mb-6 border-[0.5px] border-white/[0.06] rounded-sm"
                  style={{ background: 'rgba(255,255,255,0.01)' }}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">Total Amount</span>
                    <span className="font-mono text-lg font-medium tabular-nums" style={{ color: SPECTRAL.emerald }}>
                      {formatCurrency(summary.totalAmount)}
                    </span>
                  </div>
                  <div className="h-5 w-px bg-white/10" />
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">Transactions</span>
                    <span className="font-mono text-lg font-medium text-white/70 tabular-nums">
                      {summary.transactionCount}
                    </span>
                  </div>
                  {Object.entries(summary.byFinancialYear)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .slice(0, 3)
                    .map(([fy, data]) => (
                      <div key={fy} className="flex items-baseline gap-2">
                        <div className="h-5 w-px bg-white/10" />
                        <span className="text-[10px] text-white/30 font-mono">{fy}</span>
                        <span className="font-mono text-sm text-white/50 tabular-nums">
                          {formatCurrency(data.amount)}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {/* Documentation Required */}
              {recommendation.documentationRequired && recommendation.documentationRequired.length > 0 && (
                <div
                  className="mb-6 p-4 border-[0.5px] rounded-sm"
                  style={{
                    borderColor: `${SPECTRAL.amber}20`,
                    backgroundColor: `${SPECTRAL.amber}05`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <BreathingOrb colour={SPECTRAL.amber} isActive size="xs" />
                    <div>
                      <h4 className="text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: SPECTRAL.amber }}>
                        Documentation Required
                      </h4>
                      <ul className="space-y-1">
                        {recommendation.documentationRequired.map((doc, i) => (
                          <li key={i} className="text-sm text-white/40 flex items-start gap-2">
                            <span className="text-white/20 mt-1">&bull;</span>
                            {doc}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* ATO Forms */}
              {recommendation.atoForms && recommendation.atoForms.length > 0 && (
                <div
                  className="mb-6 p-4 border-[0.5px] rounded-sm"
                  style={{
                    borderColor: `${SPECTRAL.cyan}20`,
                    backgroundColor: `${SPECTRAL.cyan}05`,
                  }}
                >
                  <h4 className="text-[10px] uppercase tracking-[0.2em] mb-3" style={{ color: SPECTRAL.cyan }}>
                    ATO Forms Required
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {recommendation.atoForms.map((form, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-sm text-xs font-mono border-[0.5px]"
                        style={{
                          borderColor: `${SPECTRAL.cyan}20`,
                          color: `${SPECTRAL.cyan}80`,
                          backgroundColor: `${SPECTRAL.cyan}08`,
                        }}
                      >
                        {form}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents Section */}
              <div className="mb-6 p-4 border-[0.5px] border-white/[0.06] rounded-sm" style={{ background: 'rgba(255,255,255,0.01)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                    Supporting Documents
                    {localDocCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">
                        {localDocCount}
                      </span>
                    )}
                  </h4>
                </div>

                {documentsLoading ? (
                  <div className="flex items-center gap-2 py-4">
                    <BreathingOrb colour={SPECTRAL.cyan} isActive size="xs" />
                    <span className="text-sm text-white/30">Loading documents...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Document List */}
                    {documents.length > 0 && (
                      <DocumentList
                        documents={documents}
                        onDelete={onDocumentDelete ? handleDocumentDelete : undefined}
                        canDelete={!!onDocumentDelete}
                      />
                    )}

                    {/* Upload Section */}
                    {onDocumentUpload && (
                      <div className="pt-4 border-t border-white/[0.06]">
                        <DocumentUpload
                          recommendationId={recommendation.id}
                          onUpload={handleDocumentUpload}
                          onUploadComplete={loadDocuments}
                          suggestedTypes={getDocumentSuggestions(recommendation.taxArea)}
                        />
                      </div>
                    )}

                    {/* Empty state */}
                    {documents.length === 0 && !onDocumentUpload && (
                      <p className="text-sm text-white/30 text-center py-4">No documents uploaded yet</p>
                    )}
                  </div>
                )}
              </div>

              {/* Transactions Table */}
              {loading && transactions.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-12">
                  <BreathingOrb colour={SPECTRAL.cyan} isActive size="sm" />
                  <p className="text-white/30 text-sm">Loading transactions...</p>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <BreathingOrb colour={SPECTRAL.red} isActive size="sm" />
                  <p className="mt-3 text-sm" style={{ color: SPECTRAL.red }}>{error}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); loadTransactions() }}
                    className="mt-3 text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/70 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : transactions.length > 0 ? (
                <>
                  <div className="flex items-baseline gap-2 mb-3">
                    <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/40">Transaction Details</h4>
                    <span className="text-[10px] text-white/20 font-mono tabular-nums">
                      Top {transactions.length} by amount
                    </span>
                  </div>
                  <div className="overflow-x-auto border-[0.5px] border-white/[0.06] rounded-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          {['Date', 'Supplier/Contact', 'Description', 'Account', 'Amount', 'Xero'].map((h) => (
                            <th
                              key={h}
                              className={`py-3 px-4 text-[10px] uppercase tracking-[0.2em] text-white/30 font-normal ${
                                h === 'Amount' ? 'text-right' : h === 'Xero' ? 'text-center' : 'text-left'
                              }`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((txn, index) => (
                          <motion.tr
                            key={txn.transactionId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.02, duration: 0.3, ease: EASING.outExpo }}
                            className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="py-3 px-4 text-white/50 whitespace-nowrap font-mono text-xs tabular-nums">
                              {formatDate(txn.transactionDate)}
                            </td>
                            <td className="py-3 px-4 text-white/90 font-medium">
                              {txn.contactName || <span className="text-white/20 italic">Unknown</span>}
                            </td>
                            <td className="py-3 px-4 text-white/40 max-w-xs truncate" title={txn.description}>
                              {txn.description}
                            </td>
                            <td className="py-3 px-4">
                              {txn.accountCode ? (
                                <span className="text-[10px] font-mono text-white/40 border-[0.5px] border-white/[0.06] px-2 py-0.5 rounded-sm">
                                  {txn.accountCode}
                                </span>
                              ) : (
                                <span className="text-white/20">&mdash;</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium text-white/70 tabular-nums">
                              {formatCurrencyDetailed(txn.amount)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {txn.xeroUrl ? (
                                <a
                                  href={txn.xeroUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-sm hover:bg-white/[0.04] transition-colors"
                                  style={{ color: SPECTRAL.cyan }}
                                  onClick={(e) => e.stopPropagation()}
                                  title="Open in Xero"
                                >
                                  <ExternalLinkIcon />
                                </a>
                              ) : (
                                <span className="text-white/10">&mdash;</span>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Load more */}
                  {hasMore && (
                    <div className="text-center mt-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); loadTransactions(true) }}
                        disabled={loading}
                        className="px-4 py-2 text-[10px] uppercase tracking-[0.2em] border-[0.5px] border-white/[0.06] rounded-sm hover:border-white/[0.1] text-white/40 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        style={{ background: 'rgba(255,255,255,0.01)' }}
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <BreathingOrb colour={SPECTRAL.cyan} isActive size="xs" />
                            Loading...
                          </span>
                        ) : (
                          'Load More Transactions'
                        )}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-white/20 text-sm">No transaction details available for this recommendation</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
