/**
 * Recommendations Page
 *
 * Shows all actionable recommendations with filtering and sorting
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
}

type FilterType = 'all' | 'critical' | 'high' | 'medium' | 'low'
type TaxAreaFilter = 'all' | 'rnd' | 'deductions' | 'losses' | 'div7a'

export default function RecommendationsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [filteredRecommendations, setFilteredRecommendations] = useState<Recommendation[]>([])
  const [priorityFilter, setPriorityFilter] = useState<FilterType>('all')
  const [taxAreaFilter, setTaxAreaFilter] = useState<TaxAreaFilter>('all')
  const [error, setError] = useState<string | null>(null)

  const tenantId = 'demo-tenant'

  useEffect(() => {
    loadRecommendations()
  }, [])

  useEffect(() => {
    filterRecommendations()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priorityFilter, taxAreaFilter, recommendations])

  async function loadRecommendations() {
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

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case 'critical':
        return 'border-red-500 bg-red-50'
      case 'high':
        return 'border-orange-500 bg-orange-50'
      case 'medium':
        return 'border-yellow-500 bg-yellow-50'
      case 'low':
        return 'border-gray-500 bg-gray-50'
      default:
        return 'border-gray-300 bg-white'
    }
  }

  function getPriorityBadgeColor(priority: string): string {
    switch (priority) {
      case 'critical':
        return 'bg-red-600 text-white'
      case 'high':
        return 'bg-orange-600 text-white'
      case 'medium':
        return 'bg-yellow-600 text-white'
      case 'low':
        return 'bg-gray-600 text-white'
      default:
        return 'bg-gray-400 text-white'
    }
  }

  function getTaxAreaLabel(taxArea: string): string {
    switch (taxArea) {
      case 'rnd':
        return 'R&D'
      case 'deductions':
        return 'Deductions'
      case 'losses':
        return 'Losses'
      case 'div7a':
        return 'Division 7A'
      default:
        return taxArea
    }
  }

  function getAmendmentWindowIcon(window: string): string {
    switch (window) {
      case 'closing_soon':
        return '⚠️'
      case 'closed':
        return '❌'
      default:
        return '✅'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading recommendations...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const totalBenefit = filteredRecommendations.reduce((sum, rec) => sum + rec.adjustedBenefit, 0)

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard/forensic-audit" className="text-blue-600 hover:text-blue-700 mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Actionable Recommendations</h1>
          <p className="text-gray-600">Prioritized tax optimization opportunities with specific actions</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Priority</label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setPriorityFilter('all')}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    priorityFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All ({recommendations.length})
                </button>
                <button
                  onClick={() => setPriorityFilter('critical')}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    priorityFilter === 'critical'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Critical ({recommendations.filter((r) => r.priority === 'critical').length})
                </button>
                <button
                  onClick={() => setPriorityFilter('high')}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    priorityFilter === 'high'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  High ({recommendations.filter((r) => r.priority === 'high').length})
                </button>
                <button
                  onClick={() => setPriorityFilter('medium')}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    priorityFilter === 'medium'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Medium ({recommendations.filter((r) => r.priority === 'medium').length})
                </button>
                <button
                  onClick={() => setPriorityFilter('low')}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    priorityFilter === 'low'
                      ? 'bg-gray-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Low ({recommendations.filter((r) => r.priority === 'low').length})
                </button>
              </div>
            </div>

            {/* Tax Area Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Tax Area</label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setTaxAreaFilter('all')}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    taxAreaFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setTaxAreaFilter('rnd')}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    taxAreaFilter === 'rnd'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  R&D
                </button>
                <button
                  onClick={() => setTaxAreaFilter('deductions')}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    taxAreaFilter === 'deductions'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Deductions
                </button>
                <button
                  onClick={() => setTaxAreaFilter('losses')}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    taxAreaFilter === 'losses'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Losses
                </button>
                <button
                  onClick={() => setTaxAreaFilter('div7a')}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    taxAreaFilter === 'div7a'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Division 7A
                </button>
              </div>
            </div>
          </div>

          {/* Total Benefit */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Filtered Total Benefit (Confidence-Adjusted)</p>
            <p className="text-3xl font-bold text-green-600">
              ${totalBenefit.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Recommendations List */}
        <div className="space-y-4">
          {filteredRecommendations.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-500 text-lg">No recommendations match the current filters</p>
              <button
                onClick={() => {
                  setPriorityFilter('all')
                  setTaxAreaFilter('all')
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            filteredRecommendations.map((rec) => (
              <div
                key={rec.id}
                className={`border-l-4 ${getPriorityColor(rec.priority)} rounded-r shadow hover:shadow-lg transition cursor-pointer p-6`}
                onClick={() => router.push(`/dashboard/forensic-audit/recommendations/${rec.id}?tenantId=${tenantId}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Priority Badge */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`px-3 py-1 rounded text-xs font-bold ${getPriorityBadgeColor(rec.priority)}`}>
                        {rec.priority.toUpperCase()}
                      </span>
                      <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium">
                        {getTaxAreaLabel(rec.taxArea)}
                      </span>
                      <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium">
                        {rec.financialYear}
                      </span>
                      <span className="text-sm">
                        {getAmendmentWindowIcon(rec.amendmentWindow)}{' '}
                        {rec.amendmentWindow === 'closing_soon'
                          ? 'Deadline Approaching'
                          : rec.amendmentWindow === 'closed'
                          ? 'Deadline Passed'
                          : 'Amendment Window Open'}
                      </span>
                    </div>

                    {/* Action */}
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{rec.action}</h3>

                    {/* Description */}
                    <p className="text-sm text-gray-700 mb-3">{rec.description}</p>

                    {/* Details */}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span>
                        <strong>Benefit:</strong> ${rec.adjustedBenefit.toLocaleString('en-AU')}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Confidence:</strong> {rec.confidence}%
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Deadline:</strong> {new Date(rec.deadline).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Forms:</strong> {rec.atoForms.join(', ')}
                      </span>
                      {rec.transactionCount > 0 && (
                        <>
                          <span>•</span>
                          <span>
                            <strong>Transactions:</strong> {rec.transactionCount}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Benefit Amount */}
                  <div className="text-right ml-6">
                    <p className="text-sm text-gray-500 mb-1">Adjusted Benefit</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${rec.adjustedBenefit.toLocaleString('en-AU')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Net: ${rec.netBenefit.toLocaleString('en-AU')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
