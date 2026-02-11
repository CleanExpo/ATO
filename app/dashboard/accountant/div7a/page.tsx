/**
 * Division 7A Workflow Area
 *
 * Review private company loan and deemed dividend analysis.
 * Provides AI-powered suggestions with confidence scoring and legislation references.
 */

import Link from 'next/link'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import {
  ArrowLeft,
  Building2,
  AlertTriangle,
} from 'lucide-react'
import { WorkflowFindings } from '@/components/accountant/WorkflowFindings'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentFinancialYear } from '@/lib/utils/financial-year'

export const dynamic = 'force-dynamic'

export default async function Div7AWorkflowPage() {
  const currentFY = getCurrentFinancialYear()
  const findings = await fetchFindings('div7a')

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
        <span className="text-white/90">Division 7A</span>
      </div>

      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="p-3 rounded-xl"
            style={{
              background: '#00FF0015',
              border: '1px solid #00FF0030',
            }}
          >
            <Building2 className="w-6 h-6 text-[#00FF00]" />
          </div>
          <div>
            <h1 className="text-3xl font-light text-white/90">Division 7A</h1>
            <p className="text-sm text-white/60">
              Private company loan and deemed dividend analysis
            </p>
          </div>
        </div>
      </header>

      {/* Interactive Findings with filters + actions */}
      <WorkflowFindings initialFindings={findings} workflowArea="div7a" />

      {/* Help Section */}
      <div
        className="p-6 rounded-2xl"
        style={{
          background: 'var(--void-elevated)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <h3 className="text-lg font-light text-white/90 mb-3 flex items-center gap-2">
          <AlertTriangle className="text-[#00FF00]" size={20} />
          Division 7A Compliance Checklist
        </h3>
        <div className="space-y-3 text-sm text-white/60">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#00FF00]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#00FF00] text-xs font-medium">1</span>
            </div>
            <div>
              <strong className="text-white/80">Benchmark Interest Rate:</strong> {currentFY}
              rate is 8.77% p.a. (TD 2024/3)
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#00FF00]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#00FF00] text-xs font-medium">2</span>
            </div>
            <div>
              <strong className="text-white/80">Minimum Repayment:</strong> For 7-year loan,
              minimum yearly repayment is (principal × 8.77%) + interest accrued
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#00FF00]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#00FF00] text-xs font-medium">3</span>
            </div>
            <div>
              <strong className="text-white/80">Payment Timing:</strong> Interest must be paid
              before lodgment day (typically 30 June)
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#00FF00]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#00FF00] text-xs font-medium">4</span>
            </div>
            <div>
              <strong className="text-white/80">Deemed Dividend:</strong> Shortfall in interest
              or principal repayment results in deemed dividend (s 109N)
            </div>
          </div>
        </div>

        {/* Benchmark Rate */}
        <div className="mt-4 p-4 rounded-xl bg-[#00FF00]10 border border-[#00FF00]20">
          <div className="text-xs text-white/60 mb-1">{currentFY} Benchmark Rate</div>
          <div className="text-xl font-light text-[#00FF00]">8.77% p.a.</div>
          <div className="text-xs text-white/40 mt-1">
            Source: TD 2024/3 (Taxation Determination)
          </div>
        </div>
      </div>

      <TaxDisclaimer />
    </div>
  )
}

interface AccountantFindingRow {
  id: string; transaction_id: string; transaction_date: string; description: string; amount: number
  current_classification: string; suggested_classification: string; confidence_score: number
  confidence_level: string; confidence_factors: unknown[] | null; legislation_refs: unknown[] | null
  reasoning: string; financial_year: string; estimated_benefit: number; status: string
}

async function fetchFindings(workflowArea: string) {
  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('accountant_findings')
      .select('*')
      .eq('workflow_area', workflowArea)
      .order('created_at', { ascending: false })

    if (error || !data) return []

    return data.map((f: AccountantFindingRow) => ({
      id: f.id,
      transactionId: f.transaction_id,
      date: f.transaction_date,
      description: f.description,
      amount: f.amount,
      currentClassification: f.current_classification,
      suggestedClassification: f.suggested_classification,
      confidence: {
        score: f.confidence_score,
        level: f.confidence_level as 'High' | 'Medium' | 'Low',
        factors: (f.confidence_factors || []) as Array<{ factor: string; impact: 'positive' | 'negative'; weight: number }>,
      },
      legislationRefs: (f.legislation_refs || []) as Array<{ section: string; title: string; url: string }>,
      reasoning: f.reasoning,
      financialYear: f.financial_year,
      estimatedBenefit: f.estimated_benefit,
      status: f.status as 'pending' | 'approved' | 'rejected' | 'deferred',
    }))
  } catch {
    return []
  }
}
