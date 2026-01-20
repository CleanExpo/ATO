/**
 * Forensic Audit Dashboard - Main Page
 *
 * Interactive dashboard for exploring 5-year forensic tax audit findings.
 * Shows overview, opportunities, and actionable recommendations.
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DashboardData {
  syncStatus: {
    status: 'idle' | 'syncing' | 'complete' | 'error'
    progress: number
    transactionsSynced: number
    totalTransactions: number
    lastSyncAt?: string
  }
  analysisStatus: {
    status: 'idle' | 'analyzing' | 'complete' | 'error'
    progress: number
    transactionsAnalyzed: number
    totalTransactions: number
  }
  recommendations: {
    totalAdjustedBenefit: number
    byTaxArea: {
      rnd: number
      deductions: number
      losses: number
      div7a: number
    }
    byPriority: {
      critical: number
      high: number
      medium: number
      low: number
    }
    criticalRecommendations: Array<{
      id: string
      action: string
      adjustedBenefit: number
      deadline: string
    }>
  }
}

export default function ForensicAuditDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Mock tenant ID - in production, get from auth context
  const tenantId = 'demo-tenant'

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    try {
      setLoading(true)
      setError(null)

      // Fetch sync status
      const syncResponse = await fetch(`/api/audit/sync-status/${tenantId}`)
      const syncData = await syncResponse.json()

      // Fetch analysis status
      const analysisResponse = await fetch(`/api/audit/analysis-status/${tenantId}`)
      const analysisData = await analysisResponse.json()

      // Fetch recommendations
      const recommendationsResponse = await fetch(`/api/audit/recommendations?tenantId=${tenantId}`)
      const recommendationsData = await recommendationsResponse.json()

      setData({
        syncStatus: {
          status: syncData.status,
          progress: syncData.progress || 0,
          transactionsSynced: syncData.transactionsSynced || 0,
          totalTransactions: syncData.totalTransactions || 0,
          lastSyncAt: syncData.lastSyncAt,
        },
        analysisStatus: {
          status: analysisData.status,
          progress: analysisData.progress || 0,
          transactionsAnalyzed: analysisData.transactionsAnalyzed || 0,
          totalTransactions: analysisData.totalTransactions || 0,
        },
        recommendations: recommendationsData.summary || {
          totalAdjustedBenefit: 0,
          byTaxArea: { rnd: 0, deductions: 0, losses: 0, div7a: 0 },
          byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
          criticalRecommendations: [],
        },
      })
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  async function startHistoricalSync() {
    try {
      const response = await fetch('/api/audit/sync-historical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, years: 5 }),
      })

      if (response.ok) {
        // Start polling for progress
        pollSyncProgress()
      }
    } catch (err) {
      console.error('Failed to start sync:', err)
      setError('Failed to start historical sync')
    }
  }

  async function startAnalysis() {
    try {
      const response = await fetch('/api/audit/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })

      if (response.ok) {
        // Start polling for progress
        pollAnalysisProgress()
      }
    } catch (err) {
      console.error('Failed to start analysis:', err)
      setError('Failed to start AI analysis')
    }
  }

  function pollSyncProgress() {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/audit/sync-status/${tenantId}`)
      const syncData = await response.json()

      if (syncData.status === 'complete' || syncData.status === 'error') {
        clearInterval(interval)
        loadDashboardData()
      } else {
        setData((prev) =>
          prev
            ? {
                ...prev,
                syncStatus: {
                  status: syncData.status,
                  progress: syncData.progress || 0,
                  transactionsSynced: syncData.transactionsSynced || 0,
                  totalTransactions: syncData.totalTransactions || 0,
                },
              }
            : null
        )
      }
    }, 5000) // Poll every 5 seconds
  }

  function pollAnalysisProgress() {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/audit/analysis-status/${tenantId}`)
      const analysisData = await response.json()

      if (analysisData.status === 'complete' || analysisData.status === 'error') {
        clearInterval(interval)
        loadDashboardData()
      } else {
        setData((prev) =>
          prev
            ? {
                ...prev,
                analysisStatus: {
                  status: analysisData.status,
                  progress: analysisData.progress || 0,
                  transactionsAnalyzed: analysisData.transactionsAnalyzed || 0,
                  totalTransactions: analysisData.totalTransactions || 0,
                },
              }
            : null
        )
      }
    }, 15000) // Poll every 15 seconds
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
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
            onClick={() => loadDashboardData()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const isReady = data?.syncStatus.status === 'complete' && data?.analysisStatus.status === 'complete'

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Forensic Tax Audit Dashboard</h1>
          <p className="text-gray-600">5-year comprehensive analysis with AI-powered insights</p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Sync Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Historical Data Sync</h3>
            {data?.syncStatus.status === 'complete' ? (
              <>
                <p className="text-2xl font-bold text-green-600 mb-2">Complete ✓</p>
                <p className="text-sm text-gray-600">
                  {data.syncStatus.transactionsSynced.toLocaleString()} transactions synced
                </p>
                {data.syncStatus.lastSyncAt && (
                  <p className="text-xs text-gray-500 mt-1">
                    Last synced: {new Date(data.syncStatus.lastSyncAt).toLocaleDateString()}
                  </p>
                )}
              </>
            ) : data?.syncStatus.status === 'syncing' ? (
              <>
                <p className="text-2xl font-bold text-blue-600 mb-2">
                  {data.syncStatus.progress.toFixed(0)}%
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${data.syncStatus.progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600">
                  {data.syncStatus.transactionsSynced.toLocaleString()} /{' '}
                  {data.syncStatus.totalTransactions.toLocaleString()}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-400 mb-2">Not Started</p>
                <button
                  onClick={startHistoricalSync}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  Start Sync
                </button>
              </>
            )}
          </div>

          {/* Analysis Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">AI Analysis</h3>
            {data?.analysisStatus.status === 'complete' ? (
              <>
                <p className="text-2xl font-bold text-green-600 mb-2">Complete ✓</p>
                <p className="text-sm text-gray-600">
                  {data.analysisStatus.transactionsAnalyzed.toLocaleString()} transactions analyzed
                </p>
              </>
            ) : data?.analysisStatus.status === 'analyzing' ? (
              <>
                <p className="text-2xl font-bold text-blue-600 mb-2">
                  {data.analysisStatus.progress.toFixed(0)}%
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${data.analysisStatus.progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600">
                  {data.analysisStatus.transactionsAnalyzed.toLocaleString()} /{' '}
                  {data.analysisStatus.totalTransactions.toLocaleString()}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-400 mb-2">Not Started</p>
                <button
                  onClick={startAnalysis}
                  disabled={data?.syncStatus.status !== 'complete'}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Start Analysis
                </button>
              </>
            )}
          </div>

          {/* Start New Audit Button */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow p-6 text-white">
            <h3 className="text-sm font-medium mb-2">Quick Actions</h3>
            <p className="text-3xl font-bold mb-4">🔍</p>
            {!isReady ? (
              <button
                onClick={() => {
                  if (data?.syncStatus.status !== 'complete') {
                    startHistoricalSync()
                  } else if (data?.analysisStatus.status !== 'complete') {
                    startAnalysis()
                  }
                }}
                className="w-full px-4 py-2 bg-white text-blue-600 rounded hover:bg-blue-50 font-medium"
              >
                {data?.syncStatus.status !== 'complete' ? 'Start Audit' : 'Continue Analysis'}
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => router.push('/api/audit/reports/generate')}
                  className="w-full px-4 py-2 bg-white text-blue-600 rounded hover:bg-blue-50 font-medium text-sm"
                >
                  Generate Reports
                </button>
                <button
                  onClick={() => loadDashboardData()}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-400 font-medium text-sm"
                >
                  Refresh Data
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results Section - Only show if analysis complete */}
        {isReady && data && (
          <>
            {/* Total Opportunity */}
            <div className="bg-white rounded-lg shadow p-8 mb-8 text-center">
              <p className="text-gray-500 text-sm uppercase tracking-wide mb-2">
                Total Clawback Opportunity
              </p>
              <p className="text-5xl font-bold text-green-600 mb-2">
                ${data.recommendations.totalAdjustedBenefit.toLocaleString('en-AU', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-gray-600 text-sm">(Confidence-adjusted benefit)</p>
            </div>

            {/* Breakdown by Tax Area */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Link href="/dashboard/forensic-audit/rnd">
                <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-purple-500">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">R&D Tax Incentive</h3>
                  <p className="text-2xl font-bold text-gray-900">
                    ${data.recommendations.byTaxArea.rnd.toLocaleString('en-AU')}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Division 355 • 43.5% offset</p>
                </div>
              </Link>

              <Link href="/dashboard/forensic-audit/deductions">
                <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-blue-500">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Deductions</h3>
                  <p className="text-2xl font-bold text-gray-900">
                    ${data.recommendations.byTaxArea.deductions.toLocaleString('en-AU')}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Division 8 • Section 8-1</p>
                </div>
              </Link>

              <Link href="/dashboard/forensic-audit/losses">
                <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-orange-500">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Loss Carry-Forward</h3>
                  <p className="text-2xl font-bold text-gray-900">
                    ${data.recommendations.byTaxArea.losses.toLocaleString('en-AU')}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Division 36/165 • COT/SBT</p>
                </div>
              </Link>

              <Link href="/dashboard/forensic-audit/div7a">
                <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-red-500">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Division 7A</h3>
                  <p className="text-2xl font-bold text-gray-900">
                    ${data.recommendations.byTaxArea.div7a.toLocaleString('en-AU')}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">ITAA 1936 • Deemed dividends</p>
                </div>
              </Link>
            </div>

            {/* Priority Recommendations */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Priority Recommendations</h2>
                <div className="flex gap-4 text-sm">
                  <span className="text-red-600 font-semibold">
                    Critical: {data.recommendations.byPriority.critical}
                  </span>
                  <span className="text-orange-600 font-semibold">
                    High: {data.recommendations.byPriority.high}
                  </span>
                  <span className="text-yellow-600">Medium: {data.recommendations.byPriority.medium}</span>
                  <span className="text-gray-500">Low: {data.recommendations.byPriority.low}</span>
                </div>
              </div>

              {data.recommendations.criticalRecommendations.length > 0 ? (
                <div className="space-y-4">
                  {data.recommendations.criticalRecommendations.slice(0, 5).map((rec) => (
                    <div
                      key={rec.id}
                      className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r hover:bg-red-100 transition cursor-pointer"
                      onClick={() => router.push(`/dashboard/forensic-audit/recommendations/${rec.id}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <span className="inline-block px-2 py-1 bg-red-600 text-white text-xs font-bold rounded mr-2">
                            CRITICAL
                          </span>
                          <h3 className="inline text-gray-900 font-semibold">{rec.action}</h3>
                          <p className="text-sm text-gray-600 mt-2">
                            Benefit: ${rec.adjustedBenefit.toLocaleString('en-AU')} • Deadline:{' '}
                            {new Date(rec.deadline).toLocaleDateString()}
                          </p>
                        </div>
                        <button className="text-gray-400 hover:text-gray-600">→</button>
                      </div>
                    </div>
                  ))}

                  <Link href="/dashboard/forensic-audit/recommendations">
                    <button className="w-full mt-4 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50">
                      View All Recommendations
                    </button>
                  </Link>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No critical recommendations at this time</p>
              )}
            </div>

            {/* Export Reports */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Export Reports</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button className="px-6 py-3 bg-red-600 text-white rounded hover:bg-red-700 flex items-center justify-center gap-2">
                  <span>📄</span>
                  <span>PDF Report</span>
                </button>
                <button className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center gap-2">
                  <span>📊</span>
                  <span>Excel Workbook</span>
                </button>
                <button className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-2">
                  <span>📋</span>
                  <span>Amendment Schedules</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
