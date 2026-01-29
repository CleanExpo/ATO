/**
 * Consolidated Reporting - Multi-Organization Portfolio View
 *
 * Aggregates tax opportunities across 50+ client organizations for accountants.
 * Provides portfolio-level insights and downloadable reports.
 */

'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Download,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  BarChart3,
  FileSpreadsheet,
  Loader2,
  Users,
  DollarSign,
  Clock,
  Target,
  ChevronRight,
} from 'lucide-react'
import type { ConsolidatedReport } from '@/lib/reports/consolidated-report-generator'
import { formatCurrency, formatPercentage } from '@/lib/reports/formatting-utils'

type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error'

export default function ConsolidatedReportPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-dashboard)]">
          <Loader />
        </div>
      }
    >
      <ConsolidatedReportPage />
    </Suspense>
  )
}

const Loader = () => (
  <div className="flex flex-col items-center gap-4">
    <div className="w-12 h-12 rounded-3xl border-2 border-sky-500/20 border-t-sky-500 animate-spin" />
    <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest animate-pulse">
      Loading Portfolio
    </span>
  </div>
)

function ConsolidatedReportPage() {
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [report, setReport] = useState<ConsolidatedReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [batchSize, setBatchSize] = useState(5)

  const handleGenerateReport = async () => {
    try {
      setStatus('generating')
      setError(null)

      const response = await fetch('/api/reports/consolidated/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to generate report')
      }

      const data: ConsolidatedReport = await response.json()
      setReport(data)
      setStatus('complete')
    } catch (err) {
      console.error('Failed to generate consolidated report:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setStatus('error')
    }
  }

  const handleDownloadExcel = async () => {
    try {
      setIsDownloading(true)

      const response = await fetch('/api/reports/consolidated/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize, format: 'excel' }),
      })

      if (!response.ok) {
        throw new Error('Failed to download report')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Consolidated-Report-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Failed to download report:', err)
      alert('Failed to download report. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <>
      {/* Ambient Visuals */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-sky-500/5 blur-[100px] rounded-full" />
      </div>

      {/* Page Content */}
      <div className="relative z-10 py-12 pt-20 space-y-12">
        {/* Header */}
        <header className="text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-emerald-400 uppercase tracking-widest"
          >
            <Building2 className="w-3 h-3" />
            Portfolio Intelligence v2.2
          </motion.div>

          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter">
            Consolidated
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-400">
              Portfolio Reporting
            </span>
          </h1>

          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Aggregate tax opportunities across all your client organizations. Generate comprehensive
            portfolio reports in seconds, not hours.
          </p>
        </header>

        {/* Control Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-8 border border-white/10 rounded-3xl"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 flex-1">
              <label className="text-sm font-bold text-white/80">Batch Size</label>
              <p className="text-xs text-white/50">
                Controls parallel processing (lower = less server load)
              </p>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                disabled={status === 'generating'}
                className="w-full md:w-48 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
              >
                <option value={3}>3 (Safer)</option>
                <option value={5}>5 (Balanced)</option>
                <option value={7}>7 (Faster)</option>
                <option value={10}>10 (Maximum)</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleGenerateReport}
                disabled={status === 'generating'}
                className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'generating' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Generate Report
                  </>
                )}
              </button>

              {report && (
                <button
                  onClick={handleDownloadExcel}
                  disabled={isDownloading}
                  className="btn btn-secondary flex items-center gap-2 disabled:opacity-50"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download Excel
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Error State */}
        <AnimatePresence>
          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card p-6 border-l-4 border-l-red-500 bg-red-500/5"
            >
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-white mb-1">Generation Failed</h3>
                  <p className="text-sm text-white/70">{error}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Report Results */}
        <AnimatePresence>
          {report && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-8"
            >
              {/* Portfolio Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <SummaryCard
                  icon={<Users className="w-5 h-5" />}
                  label="Total Clients"
                  value={report.metadata.totalClients.toString()}
                  subValue={`${report.metadata.successfulReports} successful`}
                  color="sky"
                />
                <SummaryCard
                  icon={<DollarSign className="w-5 h-5" />}
                  label="Total Opportunity"
                  value={formatCurrency(report.portfolioSummary.totalAdjustedOpportunity)}
                  subValue={`Avg: ${formatCurrency(report.portfolioSummary.averageOpportunityPerClient)}`}
                  color="emerald"
                />
                <SummaryCard
                  icon={<Clock className="w-5 h-5" />}
                  label="Time Saved"
                  value={`${report.insights.totalTimeSaved}h`}
                  subValue={`vs manual analysis`}
                  color="violet"
                />
                <SummaryCard
                  icon={<Target className="w-5 h-5" />}
                  label="Action Items"
                  value={report.insights.criticalActionItems.toString()}
                  subValue={`>$50K opportunities`}
                  color="amber"
                />
              </div>

              {/* Breakdown by Category */}
              <div className="glass-card p-8 rounded-3xl border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-emerald-400" />
                  Opportunity Breakdown
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <CategoryCard
                    label="R&D Tax Incentive"
                    value={formatCurrency(report.portfolioSummary.totalRndOpportunity)}
                    color="sky"
                  />
                  <CategoryCard
                    label="Deductions"
                    value={formatCurrency(report.portfolioSummary.totalDeductionOpportunity)}
                    color="emerald"
                  />
                  <CategoryCard
                    label="Loss Recovery"
                    value={formatCurrency(report.portfolioSummary.totalLossRecovery)}
                    color="violet"
                  />
                  <CategoryCard
                    label="Div 7A Risk"
                    value={formatCurrency(report.portfolioSummary.totalDiv7aRisk)}
                    color="red"
                  />
                </div>
              </div>

              {/* Top Clients */}
              <div className="glass-card p-8 rounded-3xl border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                  Top 10 Opportunities
                </h2>
                <div className="space-y-3">
                  {report.portfolioSummary.topClients.map((client, index) => (
                    <div
                      key={client.name}
                      className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-sky-500/20 flex items-center justify-center">
                          <span className="text-sm font-bold text-emerald-400">
                            {index + 1}
                          </span>
                        </div>
                        <span className="font-medium text-white">{client.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-400">
                          {formatCurrency(client.opportunity)}
                        </div>
                        <div className="text-xs text-white/50">
                          {formatPercentage(client.percentage)} of total
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Client Reports Table */}
              <div className="glass-card p-8 rounded-3xl border border-white/10">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
                    Client Reports ({report.clientReports.length})
                  </h2>
                  <span className="text-sm text-white/50">
                    Generated: {new Date(report.metadata.generatedAt).toLocaleString('en-AU')}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-xs font-bold text-white/60 uppercase">
                          Organization
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-white/60 uppercase">
                          Status
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-white/60 uppercase">
                          Opportunity
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-white/60 uppercase">
                          R&D
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-white/60 uppercase">
                          Deductions
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-white/60 uppercase">
                          Confidence
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.clientReports
                        .sort((a, b) => b.adjustedOpportunity - a.adjustedOpportunity)
                        .map((client) => (
                          <tr
                            key={client.organizationId}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="font-medium text-white">
                                {client.organizationName}
                              </div>
                              {client.abn && (
                                <div className="text-xs text-white/50">ABN: {client.abn}</div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {client.status === 'completed' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Complete
                                </span>
                              ) : client.status === 'failed' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-400 text-xs">
                                  <XCircle className="w-3 h-3" />
                                  Failed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs">
                                  <Clock className="w-3 h-3" />
                                  {client.status}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-400">
                              {formatCurrency(client.adjustedOpportunity)}
                            </td>
                            <td className="py-3 px-4 text-right text-white/70">
                              {formatCurrency(client.breakdown.rnd)}
                            </td>
                            <td className="py-3 px-4 text-right text-white/70">
                              {formatCurrency(client.breakdown.deductions)}
                            </td>
                            <td className="py-3 px-4 text-right text-white/70">
                              {client.confidence.toFixed(0)}%
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Generation Metrics */}
              <div className="text-center text-sm text-white/50">
                Generated in {(report.generationMetrics.processingTimeMs / 1000).toFixed(2)}s •{' '}
                {report.generationMetrics.parallelBatches} parallel batches • Report ID:{' '}
                {report.metadata.reportId}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

// Helper Components

interface SummaryCardProps {
  icon: React.ReactNode
  label: string
  value: string
  subValue?: string
  color: 'sky' | 'emerald' | 'violet' | 'amber'
}

function SummaryCard({ icon, label, value, subValue, color }: SummaryCardProps) {
  const colorClasses = {
    sky: 'from-sky-500/20 to-sky-500/5 border-sky-500/20',
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
    violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/20',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
  }

  const iconColor = {
    sky: 'text-sky-400',
    emerald: 'text-emerald-400',
    violet: 'text-violet-400',
    amber: 'text-amber-400',
  }

  return (
    <div
      className={`glass-card p-6 rounded-2xl border bg-gradient-to-br ${colorClasses[color]}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`${iconColor[color]}`}>{icon}</div>
      </div>
      <div className="text-3xl font-black text-white mb-1">{value}</div>
      <div className="text-sm text-white/60">{label}</div>
      {subValue && <div className="text-xs text-white/40 mt-1">{subValue}</div>}
    </div>
  )
}

interface CategoryCardProps {
  label: string
  value: string
  color: 'sky' | 'emerald' | 'violet' | 'red'
}

function CategoryCard({ label, value, color }: CategoryCardProps) {
  const colorClasses = {
    sky: 'text-sky-400',
    emerald: 'text-emerald-400',
    violet: 'text-violet-400',
    red: 'text-red-400',
  }

  return (
    <div className="p-4 rounded-xl bg-white/5">
      <div className="text-sm text-white/60 mb-2">{label}</div>
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</div>
    </div>
  )
}
