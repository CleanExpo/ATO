/**
 * Expandable Recommendation Card
 *
 * Shows recommendation summary in collapsed state.
 * Expands to show transaction table with Xero links on click.
 *
 * Features:
 * - Click anywhere on header to expand/collapse
 * - Lazy loads transactions only when expanded
 * - Animated expand/collapse with framer-motion
 * - Pagination support (20 at a time)
 * - Direct Xero links for each transaction
 */

'use client'

import { useState, useCallback } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Calendar,
  DollarSign,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
}

export default function ExpandableRecommendationCard({
  recommendation,
  tenantId,
}: ExpandableRecommendationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<TransactionsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const priorityColors: Record<string, string> = {
    critical: 'border-l-red-500 bg-red-500/5',
    high: 'border-l-orange-500 bg-orange-500/5',
    medium: 'border-l-yellow-500 bg-yellow-500/5',
    low: 'border-l-gray-400 bg-gray-400/5',
  }

  const priorityBadgeColors: Record<string, string> = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-gray-900',
    low: 'bg-gray-500 text-white',
  }

  const taxAreaLabels: Record<string, string> = {
    rnd: 'R&D Tax Incentive',
    deductions: 'Deductions',
    losses: 'Loss Carry-Forward',
    div7a: 'Division 7A',
  }

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

  function handleToggle() {
    const willExpand = !isExpanded
    setIsExpanded(willExpand)

    if (willExpand && transactions.length === 0) {
      loadTransactions()
    }
  }

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

  return (
    <div
      className={`border-l-4 rounded-lg shadow-sm transition-all duration-300 bg-white ${
        priorityColors[recommendation.priority] || priorityColors.low
      } ${isExpanded ? 'ring-2 ring-purple-500/30 shadow-md' : 'hover:shadow-md'}`}
    >
      {/* Header - Always visible */}
      <div
        className="p-5 cursor-pointer select-none"
        onClick={handleToggle}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${
                  priorityBadgeColors[recommendation.priority] || priorityBadgeColors.low
                }`}
              >
                {recommendation.priority}
              </span>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                {taxAreaLabels[recommendation.taxArea] || recommendation.taxArea}
              </span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                {recommendation.financialYear}
              </span>
              {recommendation.transactionCount > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                  {recommendation.transactionCount} transactions
                </span>
              )}
            </div>

            {/* Action */}
            <h3 className="text-lg font-semibold text-gray-900 mb-2 leading-tight">
              {recommendation.action}
            </h3>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {recommendation.description}
            </p>

            {/* Details row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>
                <strong className="text-gray-700">Confidence:</strong> {recommendation.confidence}%
              </span>
              <span>
                <strong className="text-gray-700">Reference:</strong> {recommendation.legislativeReference}
              </span>
              {recommendation.deadline && (
                <span>
                  <strong className="text-gray-700">Deadline:</strong> {formatDate(recommendation.deadline)}
                </span>
              )}
            </div>
          </div>

          {/* Right side - benefit and chevron */}
          <div className="flex flex-col items-end flex-shrink-0">
            <div className="text-right mb-2">
              <p className="text-xs text-gray-500 mb-0.5">Adjusted Benefit</p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(recommendation.adjustedBenefit)}
              </p>
            </div>
            <div className="p-1 rounded-full bg-gray-100">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-200 p-5 bg-gray-50/50">
              {/* Summary Cards */}
              {summary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm text-gray-500">Total Amount</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(summary.totalAmount)}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-gray-500">Transactions</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">
                      {summary.transactionCount}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-purple-500" />
                      <span className="text-sm text-gray-500">By Year</span>
                    </div>
                    <div className="text-sm text-gray-700 space-y-0.5">
                      {Object.entries(summary.byFinancialYear)
                        .sort(([a], [b]) => b.localeCompare(a))
                        .slice(0, 3)
                        .map(([fy, data]) => (
                          <div key={fy} className="flex justify-between">
                            <span className="text-gray-500">{fy}:</span>
                            <span className="font-medium">{formatCurrency(data.amount)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Documentation Required */}
              {recommendation.documentationRequired && recommendation.documentationRequired.length > 0 && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-800 mb-2">
                        Documentation Required
                      </h4>
                      <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                        {recommendation.documentationRequired.map((doc, i) => (
                          <li key={i}>{doc}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* ATO Forms */}
              {recommendation.atoForms && recommendation.atoForms.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">
                    ATO Forms Required
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {recommendation.atoForms.map((form, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                        {form}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Transactions Table */}
              {loading && transactions.length === 0 ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-2" />
                  <p className="text-gray-500">Loading transactions...</p>
                </div>
              ) : error ? (
                <div className="text-center py-8 text-red-600">
                  <p className="mb-2">{error}</p>
                  <button
                    onClick={() => loadTransactions()}
                    className="text-sm text-purple-600 hover:text-purple-700 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : transactions.length > 0 ? (
                <>
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Transaction Details
                    <span className="font-normal text-gray-500 ml-2">
                      (Top {transactions.length} by amount)
                    </span>
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="text-left py-3 px-4 text-gray-600 font-medium">
                            Date
                          </th>
                          <th className="text-left py-3 px-4 text-gray-600 font-medium">
                            Supplier/Contact
                          </th>
                          <th className="text-left py-3 px-4 text-gray-600 font-medium">
                            Description
                          </th>
                          <th className="text-left py-3 px-4 text-gray-600 font-medium">
                            Account
                          </th>
                          <th className="text-right py-3 px-4 text-gray-600 font-medium">
                            Amount
                          </th>
                          <th className="text-center py-3 px-4 text-gray-600 font-medium">
                            Xero
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {transactions.map((txn, index) => (
                          <tr
                            key={txn.transactionId}
                            className={`border-t border-gray-100 hover:bg-gray-50 ${
                              index % 2 === 1 ? 'bg-gray-50/50' : ''
                            }`}
                          >
                            <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                              {formatDate(txn.transactionDate)}
                            </td>
                            <td className="py-3 px-4 text-gray-900 font-medium">
                              {txn.contactName || <span className="text-gray-400 italic">Unknown</span>}
                            </td>
                            <td className="py-3 px-4 text-gray-600 max-w-xs truncate" title={txn.description}>
                              {txn.description}
                            </td>
                            <td className="py-3 px-4 text-gray-500 text-xs">
                              {txn.accountCode || '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-gray-900">
                              {formatCurrencyDetailed(txn.amount)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {txn.xeroUrl ? (
                                <a
                                  href={txn.xeroUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Open in Xero"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Load more button */}
                  {hasMore && (
                    <div className="text-center mt-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          loadTransactions(true)
                        }}
                        disabled={loading}
                        className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
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
                <p className="text-center py-8 text-gray-500">
                  No transaction details available for this recommendation
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
