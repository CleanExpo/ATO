/**
 * Sundries Workflow Area
 *
 * Review miscellaneous transactions requiring classification.
 * Provides AI-powered suggestions with confidence scoring and legislation references.
 */

import Link from 'next/link'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import {
  ArrowLeft,
  FileText,
  ExternalLink,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react'
import { ConfidenceBadge } from '@/components/accountant/ConfidenceBadge'
import { LegislationLink } from '@/components/accountant/LegislationLink'
import { FindingCard } from '@/components/accountant/FindingCard'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Sample data structure (will be replaced with real API data)
interface SundriesFinding {
  id: string
  transactionId: string
  date: string
  description: string
  amount: number
  currentClassification: string
  suggestedClassification: string
  confidence: {
    score: number
    level: 'High' | 'Medium' | 'Low'
    factors: Array<{
      factor: string
      impact: 'positive' | 'negative'
      weight: number
    }>
  }
  legislationRefs: Array<{
    section: string
    title: string
    url: string
  }>
  reasoning: string
  financialYear: string
  estimatedBenefit: number
  status: 'pending' | 'approved' | 'rejected'
}

export default async function SundriesWorkflowPage() {
  const findings: SundriesFinding[] = await fetchFindings('sundries')

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-white/60">
        <Link
          href="/dashboard/accountant"
          className="hover:text-white/90 transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Accountant Workflow
        </Link>
        <span>/</span>
        <span className="text-white/90">Sundries</span>
      </div>

      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="p-3 rounded-xl"
            style={{
              background: '#00D9FF15',
              border: '1px solid #00D9FF30',
            }}
          >
            <FileText className="w-6 h-6 text-[#00D9FF]" />
          </div>
          <div>
            <h1 className="text-3xl font-light text-white/90">Sundries</h1>
            <p className="text-sm text-white/60">
              Miscellaneous transactions requiring classification
            </p>
          </div>
        </div>
      </header>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          className="p-4 rounded-2xl"
          style={{
            background: 'var(--void-elevated)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div className="text-xs text-white/60 mb-1">Total Findings</div>
          <div className="text-2xl font-light text-white/90">{findings.length}</div>
        </div>

        <div
          className="p-4 rounded-2xl"
          style={{
            background: 'var(--void-elevated)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div className="text-xs text-white/60 mb-1">Pending Review</div>
          <div className="text-2xl font-light text-white/90">
            {findings.filter((f) => f.status === 'pending').length}
          </div>
        </div>

        <div
          className="p-4 rounded-2xl"
          style={{
            background: 'var(--void-elevated)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div className="text-xs text-white/60 mb-1">Approved</div>
          <div className="text-2xl font-light text-white/90">
            {findings.filter((f) => f.status === 'approved').length}
          </div>
        </div>

        <div
          className="p-4 rounded-2xl"
          style={{
            background: 'var(--void-elevated)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div className="text-xs text-white/60 mb-1">Estimated Benefit</div>
          <div className="text-2xl font-light text-white/90">
            ${findings.reduce((sum, f) => sum + (f.estimatedBenefit || 0), 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          className="px-4 py-2 rounded-xl text-sm transition-all"
          style={{
            background: 'var(--accent-primary)',
            color: '#000',
          }}
        >
          All Findings
        </button>
        <button
          className="px-4 py-2 rounded-xl text-sm transition-all text-white/60 hover:text-white/90"
          style={{
            background: 'var(--void-elevated)',
            border: '1px solid var(--glass-border)',
          }}
        >
          High Confidence
        </button>
        <button
          className="px-4 py-2 rounded-xl text-sm transition-all text-white/60 hover:text-white/90"
          style={{
            background: 'var(--void-elevated)',
            border: '1px solid var(--glass-border)',
          }}
        >
          Pending Review
        </button>
        <button
          className="px-4 py-2 rounded-xl text-sm transition-all text-white/60 hover:text-white/90"
          style={{
            background: 'var(--void-elevated)',
            border: '1px solid var(--glass-border)',
          }}
        >
          High Value (&gt;$50K)
        </button>
      </div>

      {/* Findings List */}
      {findings.length === 0 ? (
        <div
          className="p-12 rounded-2xl text-center"
          style={{
            background: 'var(--void-elevated)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <FileText className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-light text-white/90 mb-2">
            No Sundries Findings Yet
          </h3>
          <p className="text-sm text-white/60 mb-6 max-w-md mx-auto">
            Run a forensic audit to analyze your Xero transactions and identify
            miscellaneous items requiring classification.
          </p>
          <Link
            href="/dashboard/forensic-audit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all"
            style={{
              background: 'var(--accent-primary)',
              color: '#000',
            }}
          >
            Run Forensic Audit
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {findings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              workflowArea="sundries"
            />
          ))}
        </div>
      )}

      {/* Help Section */}
      <div
        className="p-6 rounded-2xl"
        style={{
          background: 'var(--void-elevated)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <h3 className="text-lg font-light text-white/90 mb-3 flex items-center gap-2">
          <AlertTriangle className="text-[#FF0080]" size={20} />
          How to Review Sundries Findings
        </h3>
        <div className="space-y-3 text-sm text-white/60">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#00D9FF]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#00D9FF] text-xs font-medium">1</span>
            </div>
            <div>
              <strong className="text-white/80">Review the Transaction:</strong> Verify the
              description, amount, and date match your records
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#00D9FF]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#00D9FF] text-xs font-medium">2</span>
            </div>
            <div>
              <strong className="text-white/80">Check Confidence Score:</strong> Higher scores
              (80-100) indicate stronger AI analysis based on legislation and precedent
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#00D9FF]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#00D9FF] text-xs font-medium">3</span>
            </div>
            <div>
              <strong className="text-white/80">Validate Legislation:</strong> Click legislation
              references to verify they support the suggested classification
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#00D9FF]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#00D9FF] text-xs font-medium">4</span>
            </div>
            <div>
              <strong className="text-white/80">Make Your Decision:</strong> Approve for client
              report, reject if incorrect, or defer if more information needed
            </div>
          </div>
        </div>
      </div>

      <TaxDisclaimer />
    </div>
  )
}

async function fetchFindings(workflowArea: string): Promise<SundriesFinding[]> {
  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('accountant_findings')
      .select('*')
      .eq('workflow_area', workflowArea)
      .order('created_at', { ascending: false })

    if (error || !data) return []

    return data.map((f: any) => ({
      id: f.id,
      transactionId: f.transaction_id,
      date: f.transaction_date,
      description: f.description,
      amount: f.amount,
      currentClassification: f.current_classification,
      suggestedClassification: f.suggested_classification,
      confidence: {
        score: f.confidence_score,
        level: f.confidence_level,
        factors: f.confidence_factors || [],
      },
      legislationRefs: f.legislation_refs || [],
      reasoning: f.reasoning,
      financialYear: f.financial_year,
      estimatedBenefit: f.estimated_benefit,
      status: f.status,
    }))
  } catch {
    return []
  }
}
