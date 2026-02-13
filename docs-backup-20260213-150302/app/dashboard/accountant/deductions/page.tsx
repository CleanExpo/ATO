/**
 * Deductions (Section 8-1) Workflow Area
 *
 * Review general deduction eligibility analysis under Section 8-1 ITAA 1997.
 * Provides AI-powered suggestions with confidence scoring and legislation references.
 */

import Link from 'next/link'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import {
  ArrowLeft,
  Receipt,
  AlertTriangle,
} from 'lucide-react'
import { WorkflowFindings } from '@/components/accountant/WorkflowFindings'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DeductionsWorkflowPage() {
  const findings = await fetchFindings('deductions')

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
        <span className="text-white/90">Deductions (Section 8-1)</span>
      </div>

      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="p-3 rounded-xl"
            style={{
              background: '#FF008015',
              border: '1px solid #FF008030',
            }}
          >
            <Receipt className="w-6 h-6 text-[#FF0080]" />
          </div>
          <div>
            <h1 className="text-3xl font-light text-white/90">
              Deductions (Section 8-1)
            </h1>
            <p className="text-sm text-white/60">
              General deduction eligibility analysis
            </p>
          </div>
        </div>
      </header>

      {/* Interactive Findings with filters + actions */}
      <WorkflowFindings initialFindings={findings} workflowArea="deductions" />

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
          Section 8-1 Deductibility Tests
        </h3>
        <div className="space-y-3 text-sm text-white/60">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FF0080]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#FF0080] text-xs font-medium">1</span>
            </div>
            <div>
              <strong className="text-white/80">Incurred:</strong> Loss or outgoing must have
              been incurred (not merely contingent)
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FF0080]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#FF0080] text-xs font-medium">2</span>
            </div>
            <div>
              <strong className="text-white/80">Business Purpose:</strong> Incurred in carrying
              on a business for the purpose of gaining or producing assessable income
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FF0080]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#FF0080] text-xs font-medium">3</span>
            </div>
            <div>
              <strong className="text-white/80">Not Capital:</strong> Not of a capital, private,
              or domestic nature
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FF0080]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#FF0080] text-xs font-medium">4</span>
            </div>
            <div>
              <strong className="text-white/80">Not Prohibited:</strong> No specific provision
              denies or restricts the deduction
            </div>
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
