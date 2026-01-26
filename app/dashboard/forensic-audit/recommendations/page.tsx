/**
 * Recommendations Page
 *
 * Shows all actionable recommendations with filtering and sorting
 */

'use client'

import { Suspense, useEffect, useState } from 'react'
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

export default function RecommendationsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p>Loading recommendations...</p></div>}>
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
        <div className="mb-8 text-center">
          <Link href="/dashboard/forensic-audit" className="text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] mb-4 inline-block text-sm">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Actionable Recommendations</h1>
          <p className="text-[var(--text-secondary)]">Prioritised tax optimisation opportunities with specific actions</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Priority Filter */}
            <div className="text-center">
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Priority</label>
              <div className="flex gap-2 flex-wrap justify-center">
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
            <div className="text-center">
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Tax Area</label>
              <div className="flex gap-2 flex-wrap justify-center">
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
          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600 mb-1">Filtered Total Benefit (Confidence-Adjusted)</p>
            <p className="text-3xl font-bold text-green-600">
              ${totalBenefit.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Xero Actions */}
        <div className="bg-white rounded-lg shadow p-4 mb-8 flex flex-wrap items-center justify-center gap-4">
          <span className="text-sm font-medium text-gray-700">Xero Integration:</span>
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
            className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 ${
              uploadingReport
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {uploadingReport ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Report to Xero
              </>
            )}
          </button>
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
            className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 ${
              attachingFindings
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {attachingFindings ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Attaching...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Attach Findings to Transactions
              </>
            )}
          </button>
          <Link
            href={`/dashboard/forensic-audit/reconciliation${tenantId ? `?tenantId=${tenantId}` : ''}`}
            className="px-4 py-2 rounded text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            View Reconciliation
          </Link>
          {xeroActionResult && (
            <div
              className={`w-full mt-2 p-3 rounded text-sm ${
                xeroActionResult.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : xeroActionResult.type === 'info'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {xeroActionResult.message}
            </div>
          )}
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
