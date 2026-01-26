/**
 * Recommendations Page
 *
 * Shows all actionable recommendations with filtering and sorting
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MobileNav } from '@/components/ui/MobileNav'
import ExpandableRecommendationCard from '@/components/forensic-audit/ExpandableRecommendationCard'

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

export default function RecommendationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [filteredRecommendations, setFilteredRecommendations] = useState<Recommendation[]>([])
  const [priorityFilter, setPriorityFilter] = useState<FilterType>('all')
  const [taxAreaFilter, setTaxAreaFilter] = useState<TaxAreaFilter>('all')
  const [error, setError] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)

  // Fetch tenant ID from URL params or organizations API
  useEffect(() => {
    async function fetchTenantId() {
      // Check URL parameter first
      const urlTenantId = searchParams.get('tenantId')
      if (urlTenantId) {
        setTenantId(urlTenantId)
        return
      }

      // Otherwise fetch from organizations API
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

  if (loading || !tenantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-[var(--text-secondary)]">Loading recommendations...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="alert alert--error max-w-md">
          <h2 className="font-semibold mb-2">Error</h2>
          <p>{error}</p>
          <button onClick={() => router.back()} className="btn btn-primary mt-4">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const totalBenefit = filteredRecommendations.reduce((sum, rec) => sum + rec.adjustedBenefit, 0)

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard/forensic-audit" className="text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Actionable Recommendations</h1>
          <p className="text-[var(--text-secondary)]">Prioritized tax optimization opportunities with specific actions</p>
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
              <ExpandableRecommendationCard
                key={rec.id}
                recommendation={{
                  ...rec,
                  legislativeReference: rec.legislativeReference || 'Section 8-1 ITAA 1997',
                  documentationRequired: rec.documentationRequired || [],
                }}
                tenantId={tenantId || ''}
              />
            ))
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  )
}
