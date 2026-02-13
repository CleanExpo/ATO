/**
 * Trends Analysis Component
 *
 * Visualizes multi-year trends and year-over-year comparisons
 */

'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  DollarSign,
  FileText,
  Target,
} from 'lucide-react'

interface YearlyMetrics {
  financialYear: string
  totalTransactions: number
  totalAmount: number
  rndCandidates: number
  rndPotential: number
  deductionOpportunities: number
  deductionPotential: number
  averageConfidence: number
  topCategories: Array<{ category: string; count: number; amount: number }>
}

interface TrendData {
  metric: string
  data: Array<{ year: string; value: number }>
  change: number
  trend: 'increasing' | 'decreasing' | 'stable'
}

interface TrendsResponse {
  yearlyMetrics: YearlyMetrics[]
  trends: TrendData[]
  summary: {
    yearsAnalyzed: number
    totalOpportunity: number
    averageYearlyGrowth: number
    firstYear?: string
    lastYear?: string
  }
}

interface TrendsAnalysisProps {
  tenantId: string
}

export function TrendsAnalysis({ tenantId }: TrendsAnalysisProps) {
  const [data, setData] = useState<TrendsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTrends()
  }, [tenantId])

  const fetchTrends = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/audit/trends?tenantId=${tenantId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch trends')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch trends')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-gray-400">Loading historical trends...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-lg">
        <p className="text-red-400">{error || 'No data available'}</p>
      </div>
    )
  }

  if (data.yearlyMetrics.length === 0) {
    return (
      <div className="p-8 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <p className="text-yellow-400">
          No historical data found. Run analysis on your transactions first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          icon={Calendar}
          label="Years Analyzed"
          value={data.summary.yearsAnalyzed.toString()}
          subtitle={`${data.summary.firstYear} to ${data.summary.lastYear}`}
        />
        <SummaryCard
          icon={DollarSign}
          label="Total Opportunity"
          value={formatCurrency(data.summary.totalOpportunity)}
          subtitle="Across all years"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Avg Yearly Growth"
          value={`${data.summary.averageYearlyGrowth.toFixed(1)}%`}
          subtitle="Transaction volume"
          trend={data.summary.averageYearlyGrowth > 0 ? 'up' : 'down'}
        />
      </div>

      {/* Trend Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.trends.map((trend) => (
          <TrendCard key={trend.metric} trend={trend} />
        ))}
      </div>

      {/* Yearly Breakdown Table */}
      <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold">Yearly Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">
                  Financial Year
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-400">
                  Transactions
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-400">
                  R&D Candidates
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-400">
                  R&D Potential
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-400">
                  Deductions
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-400">
                  Avg Confidence
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.yearlyMetrics.map((year) => (
                <tr key={year.financialYear} className="hover:bg-white/5">
                  <td className="px-6 py-4 text-sm font-medium">
                    {year.financialYear}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-300">
                    {year.totalTransactions.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-300">
                    {year.rndCandidates.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-green-400">
                    {formatCurrency(year.rndPotential)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-blue-400">
                    {formatCurrency(year.deductionPotential)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-300">
                    {year.averageConfidence.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Categories by Year */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.yearlyMetrics.map((year) => (
          <div
            key={year.financialYear}
            className="bg-white/5 border border-white/10 rounded-lg p-6"
          >
            <h4 className="text-sm font-medium text-gray-400 mb-4">
              Top Categories - {year.financialYear}
            </h4>
            <div className="space-y-2">
              {year.topCategories.slice(0, 3).map((cat) => (
                <div key={cat.category} className="flex justify-between text-sm">
                  <span className="text-gray-300 truncate">{cat.category}</span>
                  <span className="text-gray-400 ml-2">
                    {formatCurrency(cat.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Summary Card Component
 */
function SummaryCard({
  icon: Icon,
  label,
  value,
  subtitle,
  trend,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  subtitle: string
  trend?: 'up' | 'down'
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Icon className="w-5 h-5 text-blue-400" />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-sm ${
              trend === 'up' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {trend === 'up' ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
          </div>
        )}
      </div>
      <div className="text-2xl font-semibold mb-1">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  )
}

/**
 * Trend Card Component
 */
function TrendCard({ trend }: { trend: TrendData }) {
  const getTrendIcon = () => {
    switch (trend.trend) {
      case 'increasing':
        return <TrendingUp className="w-5 h-5 text-green-400" />
      case 'decreasing':
        return <TrendingDown className="w-5 h-5 text-red-400" />
      default:
        return <Minus className="w-5 h-5 text-gray-400" />
    }
  }

  const getTrendColor = () => {
    switch (trend.trend) {
      case 'increasing':
        return 'text-green-400'
      case 'decreasing':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-sm font-medium text-gray-400">{trend.metric}</h4>
          <div className={`text-2xl font-semibold mt-1 ${getTrendColor()}`}>
            {trend.change >= 0 ? '+' : ''}
            {trend.change.toFixed(1)}%
          </div>
        </div>
        {getTrendIcon()}
      </div>

      {/* Simple sparkline visualization */}
      <div className="flex items-end gap-1 h-16">
        {trend.data.map((point, index) => {
          const maxValue = Math.max(...trend.data.map((d) => d.value))
          const height = (point.value / maxValue) * 100

          return (
            <div
              key={point.year}
              className="flex-1 bg-blue-500/30 hover:bg-blue-500/50 rounded-t transition-colors cursor-pointer"
              style={{ height: `${height}%` }}
              title={`${point.year}: ${formatCurrency(point.value)}`}
            />
          )
        })}
      </div>

      <div className="flex justify-between text-xs text-gray-500 mt-2">
        <span>{trend.data[0]?.year}</span>
        <span>{trend.data[trend.data.length - 1]?.year}</span>
      </div>
    </div>
  )
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
