/**
 * Accountant Workflow Hub
 *
 * Main landing page for accountant-facing tax intelligence system.
 * Provides quick access to 6 workflow areas with smart notifications
 * and a "Generate from Audit" button to bridge forensic analysis
 * results into actionable findings.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import {
  FileText,
  Receipt,
  Car,
  Building2,
  FileCheck,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  TrendingUp,
  Loader2,
  Zap,
} from 'lucide-react'

type WorkflowAreaId = 'sundries' | 'deductions' | 'fbt' | 'div7a' | 'documents' | 'reconciliation'

interface WorkflowArea {
  id: WorkflowAreaId
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  color: string
}

const WORKFLOW_AREAS: WorkflowArea[] = [
  {
    id: 'sundries',
    title: 'Sundries',
    description: 'Miscellaneous transactions requiring classification',
    icon: FileText,
    href: '/dashboard/accountant/sundries',
    color: '#00D9FF',
  },
  {
    id: 'deductions',
    title: 'Deductions (Section 8-1)',
    description: 'General deduction eligibility analysis',
    icon: Receipt,
    href: '/dashboard/accountant/deductions',
    color: '#FF0080',
  },
  {
    id: 'fbt',
    title: 'Fringe Benefits Tax',
    description: 'FBT liability analysis and optimization',
    icon: Car,
    href: '/dashboard/accountant/fbt',
    color: '#FFFF00',
  },
  {
    id: 'div7a',
    title: 'Division 7A',
    description: 'Private company loan and deemed dividend analysis',
    icon: Building2,
    href: '/dashboard/accountant/div7a',
    color: '#00FF00',
  },
  {
    id: 'documents',
    title: 'Source Documents',
    description: 'Missing or insufficient documentation review',
    icon: FileCheck,
    href: '/dashboard/accountant/documents',
    color: '#FF00FF',
  },
  {
    id: 'reconciliation',
    title: 'Reconciliation',
    description: 'Account balance and GL reconciliation issues',
    icon: CheckCircle2,
    href: '/dashboard/accountant/reconciliation',
    color: '#FF6B00',
  },
]

interface GenerateResult {
  status: string
  created: number
  skipped: number
  byArea: Record<WorkflowAreaId, number>
  message: string
}

interface FindingsSummary {
  total: number
  byArea: Record<WorkflowAreaId, number>
  highValue: number
  avgConfidence: number
}

export default function AccountantWorkflowPage() {
  const searchParams = useSearchParams()
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [summary, setSummary] = useState<FindingsSummary>({
    total: 0,
    byArea: { sundries: 0, deductions: 0, fbt: 0, div7a: 0, documents: 0, reconciliation: 0 },
    highValue: 0,
    avgConfidence: 0,
  })

  // Resolve tenantId from URL param or first Xero connection
  useEffect(() => {
    const urlTenantId = searchParams.get('tenantId')
    if (urlTenantId) {
      setTenantId(urlTenantId)
      return
    }

    async function fetchTenant() {
      try {
        const response = await fetch('/api/xero/organizations')
        const data = await response.json()
        if (data.connections && data.connections.length > 0) {
          setTenantId(data.connections[0].tenant_id)
        }
      } catch {
        // No Xero connection available
      }
    }

    fetchTenant()
  }, [searchParams])

  // Fetch existing findings summary
  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/accountant/findings')
      if (!response.ok) return

      const data = await response.json()
      const findings = data.findings || []

      const byArea: Record<WorkflowAreaId, number> = {
        sundries: 0, deductions: 0, fbt: 0, div7a: 0, documents: 0, reconciliation: 0,
      }
      let highValue = 0
      let totalConfidence = 0

      for (const f of findings) {
        const area = f.workflowArea as WorkflowAreaId | undefined
        if (area && area in byArea) {
          byArea[area]++
        }
        if (f.estimatedBenefit > 50000) highValue++
        totalConfidence += f.confidence?.score ?? 0
      }

      setSummary({
        total: findings.length,
        byArea,
        highValue,
        avgConfidence: findings.length > 0 ? Math.round(totalConfidence / findings.length) : 0,
      })
    } catch {
      // Non-critical, summary stays at defaults
    }
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  async function handleGenerate() {
    if (!tenantId) return

    setGenerating(true)
    setGenerateError(null)
    setGenerateResult(null)

    try {
      const response = await fetch('/api/accountant/findings/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })

      const data = await response.json()

      if (!response.ok) {
        setGenerateError(data.error || 'Failed to generate findings')
        return
      }

      setGenerateResult(data)
      // Refresh summary after generation
      await fetchSummary()
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <header className="space-y-4">
        <h1 className="text-3xl font-light text-white/90">
          Accountant Workflow Intelligence
        </h1>
        <p className="text-base text-white/60 max-w-3xl">
          AI-powered tax intelligence integrated with your daily workflow.
          Review findings, validate recommendations, and generate client reports
          with confidence.
        </p>
      </header>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="p-6 rounded-2xl"
          style={{
            background: 'var(--void-elevated)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="text-[#FF0080]" size={20} />
            <span className="text-white/60 text-sm">Total Findings</span>
          </div>
          <div className="text-3xl font-light text-white/90">{summary.total}</div>
          <div className="text-xs text-white/40 mt-1">Across all areas</div>
        </div>

        <div
          className="p-6 rounded-2xl"
          style={{
            background: 'var(--void-elevated)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="text-[#00FF00]" size={20} />
            <span className="text-white/60 text-sm">High-Value Findings</span>
          </div>
          <div className="text-3xl font-light text-white/90">{summary.highValue}</div>
          <div className="text-xs text-white/40 mt-1">{'>'} $50,000 benefit</div>
        </div>

        <div
          className="p-6 rounded-2xl"
          style={{
            background: 'var(--void-elevated)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="text-[#00D9FF]" size={20} />
            <span className="text-white/60 text-sm">Avg. Confidence</span>
          </div>
          <div className="text-3xl font-light text-white/90">
            {summary.avgConfidence > 0 ? `${summary.avgConfidence}%` : '-'}
          </div>
          <div className="text-xs text-white/40 mt-1">
            {summary.avgConfidence > 0 ? 'Weighted confidence score' : 'No findings yet'}
          </div>
        </div>
      </div>

      {/* Generate from Audit */}
      <div
        className="p-6 rounded-2xl"
        style={{
          background: 'var(--void-elevated)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-light text-white/90 mb-2">
              Generate Findings from Audit
            </h3>
            <p className="text-sm text-white/60 max-w-xl">
              Transform forensic analysis results into actionable findings across all 6 workflow areas.
              Duplicates are automatically skipped, so you can re-run safely after new analyses.
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !tenantId}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: generating ? 'var(--glass-border)' : '#00D9FF',
              color: generating ? 'var(--text-secondary)' : '#000',
            }}
          >
            {generating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap size={16} />
                Generate from Audit
              </>
            )}
          </button>
        </div>

        {!tenantId && (
          <p className="mt-3 text-sm text-white/40">
            No Xero connection detected. Connect a Xero organisation first.
          </p>
        )}

        {generateError && (
          <div className="mt-4 p-3 rounded-xl text-sm text-[#F87171]" style={{ background: 'rgba(248, 113, 113, 0.1)' }}>
            {generateError}
          </div>
        )}

        {generateResult && (
          <div className="mt-4 p-4 rounded-xl text-sm" style={{ background: 'rgba(0, 217, 255, 0.05)', border: '1px solid rgba(0, 217, 255, 0.2)' }}>
            <p className="text-white/80 mb-2">{generateResult.message}</p>
            {generateResult.created > 0 && (
              <div className="flex flex-wrap gap-3 text-xs text-white/60">
                {(Object.entries(generateResult.byArea) as [string, number][])
                  .filter(([, count]) => count > 0)
                  .map(([area, count]) => (
                    <span key={area} className="px-2 py-1 rounded-lg" style={{ background: 'var(--glass-border)' }}>
                      {area}: {count}
                    </span>
                  ))}
                {generateResult.skipped > 0 && (
                  <span className="px-2 py-1 rounded-lg text-white/40" style={{ background: 'var(--glass-border)' }}>
                    {generateResult.skipped} skipped (duplicates)
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Workflow Areas Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-light text-white/90">Workflow Areas</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {WORKFLOW_AREAS.map((area) => {
            const Icon = area.icon
            const findingsCount = summary.byArea[area.id] ?? 0

            return (
              <Link
                key={area.id}
                href={area.href}
                className="group p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
                style={{
                  background: 'var(--void-elevated)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                {/* Icon and Title */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2 rounded-xl"
                      style={{
                        background: `${area.color}15`,
                        border: `1px solid ${area.color}30`,
                      }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-light text-white/90">
                      {area.title}
                    </h3>
                  </div>
                  <ArrowRight
                    className="text-white/30 group-hover:text-white/60 group-hover:translate-x-1 transition-all"
                    size={20}
                  />
                </div>

                {/* Description */}
                <p className="text-sm text-white/60 mb-4 min-h-[40px]">
                  {area.description}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-white/40">Findings:</span>{' '}
                    <span className="text-white/70 font-medium">
                      {findingsCount}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Getting Started */}
      <div
        className="p-6 rounded-2xl"
        style={{
          background: 'var(--void-elevated)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <h3 className="text-lg font-light text-white/90 mb-3">
          Getting Started
        </h3>
        <div className="space-y-2 text-sm text-white/60">
          <p>
            1. Run a forensic audit to analyse your Xero data across all workflow
            areas
          </p>
          <p>
            2. Click &quot;Generate from Audit&quot; above to create findings from forensic results
          </p>
          <p>
            3. Review findings in each area, starting with high-value items
          </p>
          <p>
            4. Validate recommendations and approve for client report inclusion
          </p>
        </div>
        <Link
          href="/dashboard/forensic-audit"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all"
          style={{
            background: 'var(--accent-primary)',
            color: '#000',
          }}
        >
          Run Forensic Audit
          <ArrowRight size={16} />
        </Link>
      </div>

      <TaxDisclaimer />
    </div>
  )
}
