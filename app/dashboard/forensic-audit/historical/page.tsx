/**
 * Historical Analysis Page
 *
 * Multi-year trend analysis and year-over-year comparisons
 */

'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import { TrendsAnalysis } from '@/components/forensic-audit/TrendsAnalysis'
import { YearComparison } from '@/components/forensic-audit/YearComparison'
import { BarChart3, GitCompare, Calendar, TrendingUp, AlertCircle } from 'lucide-react'

type TabType = 'trends' | 'comparison'

export default function HistoricalAnalysisPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>}>
      <HistoricalAnalysisContent />
    </Suspense>
  )
}

function HistoricalAnalysisContent() {
  const searchParams = useSearchParams()
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [tenantError, setTenantError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('trends')
  const [availableYears, setAvailableYears] = useState<string[]>([])
  const [isLoadingYears, setIsLoadingYears] = useState(true)

  // Resolve tenant ID dynamically
  useEffect(() => {
    async function fetchTenantId() {
      try {
        const urlTenantId = searchParams.get('tenantId')
        if (urlTenantId) {
          setTenantId(urlTenantId)
          return
        }

        const response = await fetch('/api/xero/organizations')
        const data = await response.json()

        if (data.connections && data.connections.length > 0) {
          setTenantId(data.connections[0].tenant_id)
        } else {
          setTenantError('No Xero connections found. Please connect your Xero account first.')
        }
      } catch (err) {
        console.error('Failed to fetch tenant ID:', err)
        setTenantError('Failed to load Xero connection')
      }
    }
    fetchTenantId()
  }, [searchParams])

  useEffect(() => {
    if (!tenantId) return
    fetchAvailableYears()
  }, [tenantId])

  const fetchAvailableYears = async () => {
    if (!tenantId) return
    try {
      setIsLoadingYears(true)
      const response = await fetch(`/api/audit/trends?tenantId=${tenantId}`)
      if (response.ok) {
        const data = await response.json()
        const years = data.yearlyMetrics
          .map((m: { financialYear: string }) => m.financialYear)
          .sort()
        setAvailableYears(years)
      }
    } catch (error) {
      console.error('Failed to fetch available years:', error)
    } finally {
      setIsLoadingYears(false)
    }
  }

  if (!tenantId && !tenantError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-gray-400">Loading connection...</p>
        </div>
      </div>
    )
  }

  if (tenantError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="glass-card p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Connection Error</h2>
          <p className="text-gray-400">{tenantError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <TrendingUp className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Historical Analysis</h1>
              <p className="text-gray-400 mt-1">
                Multi-year trends and year-over-year comparisons
              </p>
            </div>
          </div>

          {/* Stats Summary */}
          {!isLoadingYears && availableYears.length > 0 && (
            <div className="flex items-center gap-4 px-6 py-3 bg-white/5 border border-white/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-300">
                  {availableYears.length} financial years analyzed
                </span>
              </div>
              <div className="w-px h-4 bg-white/10" />
              <div className="text-sm text-gray-400">
                {availableYears[0]} to {availableYears[availableYears.length - 1]}
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab('trends')}
            className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'trends'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="font-medium">Multi-Year Trends</span>
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'comparison'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <GitCompare className="w-5 h-5" />
            <span className="font-medium">Year Comparison</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'trends' && tenantId && <TrendsAnalysis tenantId={tenantId} />}
          {activeTab === 'comparison' && tenantId && (
            <YearComparison tenantId={tenantId} availableYears={availableYears} />
          )}
        </div>
      </div>

      <TaxDisclaimer />
    </div>
  )
}
