/**
 * Year-over-Year Comparison Component
 *
 * Provides detailed comparison between two financial years
 */

'use client'

import { useState, useEffect } from 'react'
import { ArrowRight, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react'

interface YearComparison {
  metric: string
  year1Value: number
  year2Value: number
  change: number
  percentageChange: number
  trend: 'improved' | 'declined' | 'stable'
}

interface ComparisonResponse {
  year1: {
    name: string
    totalTransactions: number
    totalAmount: number
    rndCandidates: number
    rndPotential: number
    deductionCount: number
    deductionPotential: number
    averageConfidence: number
  }
  year2: {
    name: string
    totalTransactions: number
    totalAmount: number
    rndCandidates: number
    rndPotential: number
    deductionCount: number
    deductionPotential: number
    averageConfidence: number
  }
  comparisons: YearComparison[]
  insights: {
    newCategories: string[]
    removedCategories: string[]
    topMovers: Array<{
      category: string
      year1Amount: number
      year2Amount: number
      change: number
      percentageChange: number
    }>
  }
}

interface YearComparisonProps {
  tenantId: string
  availableYears: string[]
}

export function YearComparison({ tenantId, availableYears }: YearComparisonProps) {
  const [year1, setYear1] = useState<string>(
    availableYears[availableYears.length - 2] || ''
  )
  const [year2, setYear2] = useState<string>(
    availableYears[availableYears.length - 1] || ''
  )
  const [data, setData] = useState<ComparisonResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (year1 && year2 && year1 !== year2) {
      fetchComparison()
    }
  }, [year1, year2, tenantId])

  const fetchComparison = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch(
        `/api/audit/year-comparison?tenantId=${tenantId}&year1=${year1}&year2=${year2}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch comparison')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch comparison')
    } finally {
      setIsLoading(false)
    }
  }

  if (availableYears.length < 2) {
    return (
      <div className="p-8 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400" />
          <p className="text-yellow-400">
            Need at least 2 years of data for comparison. Only{' '}
            {availableYears.length} year(s) available.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Year Selection */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Select Years to Compare</h3>
        <div className="flex items-center gap-4">
          <select
            value={year1}
            onChange={(e) => setYear1(e.target.value)}
            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <div className="p-2">
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>

          <select
            value={year2}
            onChange={(e) => setYear2(e.target.value)}
            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {year1 === year2 && (
          <p className="mt-3 text-sm text-yellow-400">
            Please select two different years to compare
          </p>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-8 text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-400">Loading comparison...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Comparison Results */}
      {data && !isLoading && (
        <>
          {/* Key Metrics Comparison */}
          <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-lg font-semibold">Key Metrics</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">
                      Metric
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-gray-400">
                      {data.year1.name}
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-gray-400">
                      {data.year2.name}
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-gray-400">
                      Change
                    </th>
                    <th className="px-6 py-3 text-center text-sm font-medium text-gray-400">
                      Trend
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.comparisons.map((comparison) => (
                    <tr key={comparison.metric} className="hover:bg-white/5">
                      <td className="px-6 py-4 text-sm font-medium">
                        {comparison.metric}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-300">
                        {formatValue(comparison.metric, comparison.year1Value)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-300">
                        {formatValue(comparison.metric, comparison.year2Value)}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm text-right font-medium ${
                          comparison.trend === 'improved'
                            ? 'text-green-400'
                            : comparison.trend === 'declined'
                            ? 'text-red-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {comparison.percentageChange >= 0 ? '+' : ''}
                        {comparison.percentageChange.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-center">
                        <TrendIcon trend={comparison.trend} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Insights */}
          {(data.insights.newCategories.length > 0 ||
            data.insights.removedCategories.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* New Categories */}
              {data.insights.newCategories.length > 0 && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
                  <h4 className="text-sm font-medium text-green-400 mb-3">
                    New Categories in {data.year2.name}
                  </h4>
                  <ul className="space-y-2">
                    {data.insights.newCategories.slice(0, 5).map((cat) => (
                      <li key={cat} className="text-sm text-gray-300 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                        {cat}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Removed Categories */}
              {data.insights.removedCategories.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
                  <h4 className="text-sm font-medium text-red-400 mb-3">
                    Removed Categories from {data.year1.name}
                  </h4>
                  <ul className="space-y-2">
                    {data.insights.removedCategories.slice(0, 5).map((cat) => (
                      <li key={cat} className="text-sm text-gray-300 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                        {cat}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Top Movers */}
          {data.insights.topMovers.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-400 mb-4">
                Biggest Category Changes
              </h4>
              <div className="space-y-3">
                {data.insights.topMovers.slice(0, 5).map((mover) => (
                  <div
                    key={mover.category}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-300 truncate flex-1">
                      {mover.category}
                    </span>
                    <div className="flex items-center gap-4 ml-4">
                      <span className="text-sm text-gray-400">
                        {formatCurrency(mover.year1Amount)} →{' '}
                        {formatCurrency(mover.year2Amount)}
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          mover.percentageChange >= 0
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}
                      >
                        {mover.percentageChange >= 0 ? '+' : ''}
                        {mover.percentageChange.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Trend Icon Component
 */
function TrendIcon({ trend }: { trend: 'improved' | 'declined' | 'stable' }) {
  switch (trend) {
    case 'improved':
      return <TrendingUp className="w-5 h-5 text-green-400 inline" />
    case 'declined':
      return <TrendingDown className="w-5 h-5 text-red-400 inline" />
    default:
      return <Minus className="w-5 h-5 text-gray-400 inline" />
  }
}

/**
 * Format value based on metric type
 */
function formatValue(metric: string, value: number): string {
  if (metric.includes('($)')) {
    return formatCurrency(value)
  } else if (metric.includes('(%)')) {
    return `${value.toFixed(1)}%`
  } else {
    return value.toLocaleString()
  }
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
