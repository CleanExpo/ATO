/**
 * Comprehensive Tax Overview Dashboard
 *
 * Shows the complete tax picture:
 * - Refund/Shortfall calculation
 * - All opportunities (R&D, deductions, losses, Division 7A)
 * - Issues found and recommendations
 * - Beautiful, easy-to-understand visualizations
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  FileText,
  Beaker,
  Scale,
  Building2,
  ArrowRight,
  RefreshCw,
  Download
} from 'lucide-react'
import AnimatedCounter from '@/components/dashboard/AnimatedCounter'
import Link from 'next/link'

interface TaxOverview {
  // Financial Summary
  totalOpportunities: number
  estimatedRefund: number
  taxShortfall: number
  netPosition: number // Positive = refund, Negative = owe tax

  // Opportunities Breakdown
  rndOffsetAvailable: number
  deductionsAvailable: number
  lossesAvailable: number
  div7aRisk: number

  // Issues
  totalIssues: number
  criticalIssues: number
  dataQualityIssues: number
  complianceRisks: number

  // Recommendations
  recommendations: Array<{
    id: string
    priority: 'high' | 'medium' | 'low'
    category: string
    title: string
    description: string
    potentialSaving: number
    action: string
  }>

  // Status
  lastAnalyzed: string | null
  dataUpToDate: boolean
  analysisProgress: number
}

export default function TaxOverviewPage() {
  const router = useRouter()
  const [overview, setOverview] = useState<TaxOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [runningAnalysis, setRunningAnalysis] = useState(false)

  // Fetch tenant ID
  useEffect(() => {
    async function fetchTenant() {
      try {
        const response = await fetch('/api/xero/organizations')
        const data = await response.json()
        if (data.connections?.[0]) {
          setTenantId(data.connections[0].tenant_id)
        }
      } catch (error) {
        console.error('Failed to fetch tenant:', error)
      }
    }
    fetchTenant()
  }, [])

  // Fetch comprehensive overview
  useEffect(() => {
    if (!tenantId) return

    async function fetchOverview() {
      try {
        setLoading(true)

        // Fetch analysis results
        const analysisResponse = await fetch(
          `/api/audit/analysis-results?tenantId=${tenantId}`
        )
        const analysisData = await analysisResponse.json()

        // Fetch data quality scan results
        const dqResponse = await fetch(
          `/api/data-quality/scan?tenantId=${tenantId}`
        )
        const dqData = await dqResponse.json()

        // Fetch recommendations
        const recsResponse = await fetch(
          `/api/audit/recommendations?tenantId=${tenantId}`
        )
        const recsData = await recsResponse.json()

        // Calculate comprehensive overview
        const summary = analysisData.summary || {}
        const results = analysisData.results || []

        // Calculate R&D offset (43.5% of eligible R&D spend)
        const rndCandidates = results.filter((r: any) => r.is_rnd_candidate)
        const rndTotalSpend = rndCandidates.reduce(
          (sum: number, r: any) => sum + Math.abs(r.transaction_amount || 0),
          0
        )
        const rndOffset = rndTotalSpend * 0.435 // 43.5% R&D tax offset

        // Calculate general deductions (tax saved at company rate 25%)
        const fullyDeductible = results.filter((r: any) => r.is_fully_deductible)
        const deductibleAmount = fullyDeductible.reduce(
          (sum: number, r: any) => sum + (r.claimable_amount || 0),
          0
        )
        const deductionsSaving = deductibleAmount * 0.25 // 25% company tax rate

        // Calculate loss carry-forward value
        const lossesValue = summary.losses?.totalLosses || 0
        const lossesSaving = lossesValue * 0.25

        // Division 7A risk
        const div7aRisk = summary.compliance?.division7aRisk || 0

        // Total opportunities
        const totalOpportunities = rndOffset + deductionsSaving + lossesSaving

        // Estimated refund vs shortfall
        // If user hasn't claimed these, they may be entitled to refund
        const estimatedRefund = totalOpportunities
        const taxShortfall = div7aRisk // Potential deemed dividends taxed
        const netPosition = estimatedRefund - taxShortfall

        // Issues
        const totalIssues = (dqData.issuesFound || 0) + (summary.compliance?.requiresDocumentation || 0)
        const criticalIssues = summary.compliance?.division7aRisk || 0
        const dataQualityIssues = dqData.issuesFound || 0
        const complianceRisks = summary.compliance?.fbtImplications || 0

        const overview: TaxOverview = {
          totalOpportunities,
          estimatedRefund,
          taxShortfall,
          netPosition,
          rndOffsetAvailable: rndOffset,
          deductionsAvailable: deductionsSaving,
          lossesAvailable: lossesSaving,
          div7aRisk: div7aRisk * 0.47, // Taxed at marginal rate ~47%
          totalIssues,
          criticalIssues,
          dataQualityIssues,
          complianceRisks,
          recommendations: recsData.recommendations || [],
          lastAnalyzed: analysisData.lastAnalyzed || null,
          dataUpToDate: analysisData.results?.length > 0,
          analysisProgress: 100
        }

        setOverview(overview)
      } catch (error) {
        console.error('Failed to fetch overview:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchOverview()
  }, [tenantId])

  async function runComprehensiveAnalysis() {
    if (!tenantId) return

    setRunningAnalysis(true)

    try {
      // Run historical sync (5 years)
      await fetch('/api/audit/sync-historical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, years: 5 })
      })

      // Run AI analysis
      await fetch('/api/audit/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      })

      // Run data quality scan
      await fetch('/api/data-quality/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      })

      // Refresh overview after 5 seconds
      setTimeout(() => {
        window.location.reload()
      }, 5000)
    } catch (error) {
      console.error('Failed to run analysis:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="loading-spinner" />
      </div>
    )
  }

  if (!overview || !overview.dataUpToDate) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="glass-card max-w-2xl w-full p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold mb-4">No Analysis Data Available</h2>
          <p className="text-[var(--text-secondary)] mb-8">
            Run a comprehensive tax analysis to see your refund potential, opportunities, and recommendations.
          </p>
          <button
            onClick={runComprehensiveAnalysis}
            disabled={runningAnalysis}
            className="btn btn-primary btn-lg"
          >
            {runningAnalysis ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Running Analysis...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Run Comprehensive Analysis
              </>
            )}
          </button>
          <p className="text-sm text-[var(--text-muted)] mt-4">
            This will analyze 5 years of transactions (~5-10 minutes)
          </p>
        </div>
      </div>
    )
  }

  const isRefund = overview.netPosition > 0
  const isShortfall = overview.netPosition < 0

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold">ATO Optimizer</h1>
              <p className="text-xs text-[var(--text-muted)]">Tax Intelligence</p>
            </div>
          </div>

          <nav className="space-y-1">
            <Link href="/dashboard" className="sidebar-link">
              <DollarSign className="w-5 h-5" />
              <span>Dashboard</span>
            </Link>
            <Link href="/dashboard/overview" className="sidebar-link active">
              <FileText className="w-5 h-5" />
              <span>Tax Overview</span>
            </Link>
            <Link href="/dashboard/data-quality" className="sidebar-link">
              <CheckCircle className="w-5 h-5" />
              <span>Data Quality</span>
            </Link>
            <Link href="/dashboard/forensic-audit" className="sidebar-link">
              <FileText className="w-5 h-5" />
              <span>Forensic Audit</span>
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-[280px] flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Comprehensive Tax Overview</h2>
            <p className="text-[var(--text-secondary)]">
              {overview.lastAnalyzed
                ? `Last analyzed: ${new Date(overview.lastAnalyzed).toLocaleDateString()}`
                : 'Complete tax position analysis'
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="btn btn-secondary"
            >
              <Download className="w-4 h-4" />
              Download Report
            </button>
            <button
              onClick={runComprehensiveAnalysis}
              disabled={runningAnalysis}
              className="btn btn-primary"
            >
              <RefreshCw className={`w-4 h-4 ${runningAnalysis ? 'animate-spin' : ''}`} />
              Refresh Analysis
            </button>
          </div>
        </div>

        {/* Net Position - Hero Card */}
        <div className={`glass-card p-8 mb-8 border-2 ${
          isRefund ? 'border-emerald-500/50 bg-emerald-500/5' :
          isShortfall ? 'border-red-500/50 bg-red-500/5' :
          'border-amber-500/50 bg-amber-500/5'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-2">Estimated Net Position</p>
              <div className="flex items-baseline gap-4 mb-4">
                <AnimatedCounter
                  value={Math.abs(overview.netPosition)}
                  format="currency"
                  decimals={0}
                  className={`text-6xl font-bold ${
                    isRefund ? 'text-emerald-400' :
                    isShortfall ? 'text-red-400' :
                    'text-amber-400'
                  }`}
                />
                <div className={`text-2xl font-semibold ${
                  isRefund ? 'text-emerald-400' :
                  isShortfall ? 'text-red-400' :
                  'text-amber-400'
                }`}>
                  {isRefund ? 'Potential Refund' : isShortfall ? 'Potential Tax Owed' : 'Neutral'}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-1">Opportunities Found</p>
                  <AnimatedCounter
                    value={overview.totalOpportunities}
                    format="currency"
                    decimals={0}
                    className="text-lg font-bold text-emerald-400"
                  />
                </div>
                {overview.taxShortfall > 0 && (
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-1">Potential Liabilities</p>
                    <AnimatedCounter
                      value={overview.taxShortfall}
                      format="currency"
                      decimals={0}
                      className="text-lg font-bold text-red-400"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className={`w-24 h-24 rounded-2xl flex items-center justify-center ${
              isRefund ? 'bg-emerald-500/20' :
              isShortfall ? 'bg-red-500/20' :
              'bg-amber-500/20'
            }`}>
              {isRefund ? (
                <TrendingUp className="w-12 h-12 text-emerald-400" />
              ) : isShortfall ? (
                <TrendingDown className="w-12 h-12 text-red-400" />
              ) : (
                <Scale className="w-12 h-12 text-amber-400" />
              )}
            </div>
          </div>
        </div>

        {/* Opportunities Breakdown */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">Tax Opportunities Breakdown</h3>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[var(--text-secondary)]">R&D Tax Offset</span>
                <Beaker className="w-5 h-5 text-emerald-400" />
              </div>
              <AnimatedCounter
                value={overview.rndOffsetAvailable}
                format="currency"
                decimals={0}
                className="text-3xl font-bold text-emerald-400"
              />
              <p className="text-xs text-[var(--text-muted)] mt-2">
                43.5% offset on eligible R&D
              </p>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[var(--text-secondary)]">Deductions</span>
                <FileText className="w-5 h-5 text-sky-400" />
              </div>
              <AnimatedCounter
                value={overview.deductionsAvailable}
                format="currency"
                decimals={0}
                className="text-3xl font-bold text-sky-400"
              />
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Tax saved on deductions
              </p>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[var(--text-secondary)]">Loss Carry-Forward</span>
                <TrendingDown className="w-5 h-5 text-purple-400" />
              </div>
              <AnimatedCounter
                value={overview.lossesAvailable}
                format="currency"
                decimals={0}
                className="text-3xl font-bold text-purple-400"
              />
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Future tax benefit
              </p>
            </div>

            <div className="glass-card p-6 border-red-500/30 bg-red-500/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[var(--text-secondary)]">Division 7A Risk</span>
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <AnimatedCounter
                value={overview.div7aRisk}
                format="currency"
                decimals={0}
                className="text-3xl font-bold text-red-400"
              />
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Potential deemed dividend tax
              </p>
            </div>
          </div>
        </div>

        {/* Issues Summary */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">Issues Requiring Attention</h3>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[var(--text-secondary)]">Total Issues</span>
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <AnimatedCounter
                value={overview.totalIssues}
                className="text-3xl font-bold"
              />
            </div>

            <div className="glass-card p-6 border-red-500/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[var(--text-secondary)]">Critical Issues</span>
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <AnimatedCounter
                value={overview.criticalIssues}
                className="text-3xl font-bold text-red-400"
              />
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[var(--text-secondary)]">Data Quality</span>
                <CheckCircle className="w-5 h-5 text-sky-400" />
              </div>
              <AnimatedCounter
                value={overview.dataQualityIssues}
                className="text-3xl font-bold"
              />
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[var(--text-secondary)]">Compliance Risks</span>
                <Scale className="w-5 h-5 text-purple-400" />
              </div>
              <AnimatedCounter
                value={overview.complianceRisks}
                className="text-3xl font-bold"
              />
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">Recommended Actions</h3>
          <div className="glass-card divide-y divide-[var(--border-default)]">
            {overview.recommendations.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)]">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No recommendations available. Run analysis to generate recommendations.</p>
              </div>
            ) : (
              overview.recommendations.slice(0, 10).map(rec => (
                <div key={rec.id} className="p-6 hover:bg-white/5 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`priority-badge ${rec.priority}`}>
                          {rec.priority.toUpperCase()}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">{rec.category}</span>
                      </div>
                      <h4 className="font-semibold text-[var(--text-primary)] mb-2">{rec.title}</h4>
                      <p className="text-sm text-[var(--text-secondary)] mb-3">{rec.description}</p>
                      <div className="flex items-center gap-4">
                        <div className="text-emerald-400 font-semibold">
                          Potential Saving: ${rec.potentialSaving.toLocaleString()}
                        </div>
                        <button className="text-sm text-sky-400 hover:text-sky-300 flex items-center gap-1">
                          {rec.action} <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Next Steps */}
        <div className="glass-card p-8 bg-gradient-to-br from-sky-500/10 to-emerald-500/10 border-sky-500/30">
          <h3 className="text-xl font-bold mb-4">Next Steps</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <p className="text-[var(--text-secondary)]">
                Review and resolve <span className="font-bold text-[var(--text-primary)]">{overview.criticalIssues} critical issues</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <p className="text-[var(--text-secondary)]">
                Claim <span className="font-bold text-emerald-400">${overview.rndOffsetAvailable.toLocaleString()}</span> in R&D tax offsets
              </p>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <p className="text-[var(--text-secondary)]">
                Review <span className="font-bold text-[var(--text-primary)]">{overview.totalIssues} data quality issues</span>
              </p>
            </div>
            {overview.div7aRisk > 1000 && (
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-[var(--text-secondary)]">
                  <span className="font-bold text-red-400">Urgent:</span> Review Division 7A compliance to avoid ${overview.div7aRisk.toLocaleString()} deemed dividend tax
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
