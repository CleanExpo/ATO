'use client'

/**
 * Cost Monitoring Dashboard
 *
 * Displays AI analysis cost breakdown, trends, and projections.
 * Helps accountants track API usage and optimize analysis costs.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import { MobileNav } from '@/components/ui/MobileNav'
import StatCard from '@/components/audit/StatCard'

interface CostSummary {
  totalBatches: number
  totalTransactions: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCostUSD: number
  averageCostPerBatch: number
  averageCostPerTransaction: number
  firstAnalysis: string | null
  lastAnalysis: string | null
}

interface CostBreakdown {
  id: string
  analyzedAt: string
  transactionsInBatch: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUSD: number
  model: string
}

interface DailyTrend {
  date: string
  costUSD: number
  transactions: number
  batches: number
}

interface WeeklyTrend {
  weekStart: string
  costUSD: number
  transactions: number
  batches: number
}

interface Projections {
  nextBatch: number
  next100Transactions: number
  next1000Transactions: number
}

interface CostMonitoringData {
  summary: CostSummary
  breakdown: CostBreakdown[]
  trends: {
    daily: DailyTrend[]
    weekly: WeeklyTrend[]
  }
  projections: Projections
}

export default function CostMonitoringPage() {
  const [data, setData] = useState<CostMonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)

  // Get real tenant ID from Xero connection
  useEffect(() => {
    async function getTenant() {
      try {
        const res = await fetch('/api/xero/organizations')
        const orgs = await res.json()
        if (orgs.connections?.[0]?.tenant_id) {
          setTenantId(orgs.connections[0].tenant_id)
        } else {
          setTenantId('default')
        }
      } catch {
        setTenantId('default')
      }
    }
    getTenant()
  }, [])

  useEffect(() => {
    if (tenantId) {
      loadCostData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  async function loadCostData() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/audit/cost-monitoring?tenantId=${tenantId}`)

      if (!response.ok) {
        throw new Error(`Failed to load cost data: ${response.statusText}`)
      }

      const costData = await response.json()
      setData(costData)
    } catch (err) {
      console.error('Failed to load cost data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load cost data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-[var(--text-secondary)]">Loading cost data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="alert alert--error">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p>{error}</p>
          <button onClick={loadCostData} className="btn btn-primary mt-4">
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { summary, breakdown, trends, projections } = data

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard/forensic-audit" className="text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] mb-2 inline-block">
          ← Back to Forensic Audit Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">AI Analysis Cost Monitoring</h1>
        <p className="text-[var(--text-secondary)] mt-2">
          Track API usage, optimise costs, and project future analysis expenses.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Total Cost"
          value={`$${summary.totalCostUSD.toFixed(2)} USD`}
          subtext={`${summary.totalBatches} batches`}
          icon="💰"
          color="blue"
          size="lg"
        />
        <StatCard
          label="Transactions Analysed"
          value={summary.totalTransactions.toLocaleString()}
          subtext={`Avg $${summary.averageCostPerTransaction.toFixed(4)} each`}
          icon="📊"
          color="green"
        />
        <StatCard
          label="Total Tokens"
          value={summary.totalTokens.toLocaleString()}
          subtext={`${summary.totalInputTokens.toLocaleString()} in, ${summary.totalOutputTokens.toLocaleString()} out`}
          icon="🔤"
          color="purple"
        />
        <StatCard
          label="Avg Cost per Batch"
          value={`$${summary.averageCostPerBatch.toFixed(4)}`}
          subtext={`${summary.totalBatches} batches total`}
          icon="📦"
          color="orange"
        />
      </div>

      {/* Cost Projections */}
      <div className="glass-card p-6 mb-8">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Cost Projections</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Estimated costs for future analysis based on your historical average
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-4">
            <div className="text-sm text-[var(--text-muted)]">Next Batch (50 transactions)</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>
              ${projections.nextBatch.toFixed(4)}
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="text-sm text-[var(--text-muted)]">Next 100 Transactions</div>
            <div className="text-2xl font-bold" style={{ color: '#00FF88' }}>
              ${projections.next100Transactions.toFixed(2)}
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="text-sm text-[var(--text-muted)]">Next 1,000 Transactions</div>
            <div className="text-2xl font-bold" style={{ color: '#8855FF' }}>
              ${projections.next1000Transactions.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Daily Trends */}
      {trends.daily.length > 0 && (
        <div className="glass-card p-6 mb-8">
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Daily Trends</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="text-left">Date</th>
                  <th className="text-right">Cost (USD)</th>
                  <th className="text-right">Transactions</th>
                  <th className="text-right">Batches</th>
                </tr>
              </thead>
              <tbody>
                {trends.daily.slice(-14).map((day) => (
                  <tr key={day.date}>
                    <td>{new Date(day.date).toLocaleDateString()}</td>
                    <td className="text-right font-semibold">${day.costUSD.toFixed(4)}</td>
                    <td className="text-right">{day.transactions}</td>
                    <td className="text-right">{day.batches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Weekly Trends */}
      {trends.weekly.length > 0 && (
        <div className="glass-card p-6 mb-8">
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Weekly Trends</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="text-left">Week Starting</th>
                  <th className="text-right">Cost (USD)</th>
                  <th className="text-right">Transactions</th>
                  <th className="text-right">Batches</th>
                </tr>
              </thead>
              <tbody>
                {trends.weekly.slice(-8).map((week) => (
                  <tr key={week.weekStart}>
                    <td>{new Date(week.weekStart).toLocaleDateString()}</td>
                    <td className="text-right font-semibold">${week.costUSD.toFixed(2)}</td>
                    <td className="text-right">{week.transactions}</td>
                    <td className="text-right">{week.batches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Batches */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Recent Analysis Batches</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="text-left">Analysed At</th>
                <th className="text-right">Transactions</th>
                <th className="text-right">Input Tokens</th>
                <th className="text-right">Output Tokens</th>
                <th className="text-right">Total Tokens</th>
                <th className="text-right">Cost (USD)</th>
                <th className="text-left">Model</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.slice(0, 20).map((batch) => (
                <tr key={batch.id}>
                  <td>
                    {new Date(batch.analyzedAt).toLocaleString()}
                  </td>
                  <td className="text-right">{batch.transactionsInBatch}</td>
                  <td className="text-right">{batch.inputTokens.toLocaleString()}</td>
                  <td className="text-right">{batch.outputTokens.toLocaleString()}</td>
                  <td className="text-right font-semibold">{batch.totalTokens.toLocaleString()}</td>
                  <td className="text-right font-semibold" style={{ color: '#00FF88' }}>
                    ${batch.costUSD.toFixed(4)}
                  </td>
                  <td className="text-xs text-[var(--text-muted)]">{batch.model}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {breakdown.length > 20 && (
          <p className="text-sm text-[var(--text-muted)] mt-4 text-center">
            Showing 20 most recent batches of {breakdown.length} total
          </p>
        )}
      </div>

      {/* Cost Optimization Tips */}
      <div className="glass-card p-6 mt-8" style={{ background: 'rgba(0, 245, 255, 0.04)', border: '0.5px solid rgba(0, 245, 255, 0.15)' }}>
        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--accent-primary)' }}>Cost Optimisation Tips</h2>
        <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
          <li>• <strong>Batch processing:</strong> Analysing transactions in larger batches (50-100) reduces overhead</li>
          <li>• <strong>Incremental sync:</strong> Only analyse new transactions instead of re-analysing historical data</li>
          <li>• <strong>Cache results:</strong> Use cached analysis results when possible (30-minute TTL)</li>
          <li>• <strong>Filter strategically:</strong> Pre-filter obvious non-deductible expenses before AI analysis</li>
          <li>• <strong>Monitor trends:</strong> Watch for cost spikes that may indicate inefficient analysis</li>
        </ul>
      </div>

      <TaxDisclaimer />

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  )
}
