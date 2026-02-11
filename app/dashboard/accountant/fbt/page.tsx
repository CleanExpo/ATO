/**
 * Fringe Benefits Tax (FBT) Workflow Area
 *
 * Review FBT liability analysis and optimization opportunities.
 * Provides AI-powered suggestions with confidence scoring and legislation references.
 */

import Link from 'next/link'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import {
  ArrowLeft,
  Car,
  AlertTriangle,
} from 'lucide-react'
import { WorkflowFindings } from '@/components/accountant/WorkflowFindings'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function FBTWorkflowPage() {
  const findings = await fetchFindings('fbt')

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
        <span className="text-white/90">Fringe Benefits Tax</span>
      </div>

      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="p-3 rounded-xl"
            style={{
              background: '#FFFF0015',
              border: '1px solid #FFFF0030',
            }}
          >
            <Car className="w-6 h-6 text-[#FFFF00]" />
          </div>
          <div>
            <h1 className="text-3xl font-light text-white/90">
              Fringe Benefits Tax
            </h1>
            <p className="text-sm text-white/60">
              FBT liability analysis and optimization
            </p>
          </div>
        </div>
      </header>

      {/* Interactive Findings with filters + actions */}
      <WorkflowFindings initialFindings={findings} workflowArea="fbt" />

      {/* Help Section */}
      <div
        className="p-6 rounded-2xl"
        style={{
          background: 'var(--void-elevated)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <h3 className="text-lg font-light text-white/90 mb-3 flex items-center gap-2">
          <AlertTriangle className="text-[#FFFF00]" size={20} />
          Common FBT Optimization Strategies
        </h3>
        <div className="space-y-3 text-sm text-white/60">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FFFF00]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#FFFF00] text-xs font-medium">1</span>
            </div>
            <div>
              <strong className="text-white/80">Car Fringe Benefits:</strong> Consider statutory
              vs operating cost method to minimize taxable value
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FFFF00]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#FFFF00] text-xs font-medium">2</span>
            </div>
            <div>
              <strong className="text-white/80">Employee Contributions:</strong> Post-tax
              employee contributions reduce taxable value dollar-for-dollar
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FFFF00]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#FFFF00] text-xs font-medium">3</span>
            </div>
            <div>
              <strong className="text-white/80">Minor Benefits Exemption:</strong> Benefits
              &lt;$300 with less than quarterly frequency may be exempt
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FFFF00]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#FFFF00] text-xs font-medium">4</span>
            </div>
            <div>
              <strong className="text-white/80">Otherwise Deductible:</strong> Reduce taxable
              value by amount that would have been tax-deductible to employee
            </div>
          </div>
        </div>

        {/* FBT Rate */}
        <div className="mt-4 p-4 rounded-xl bg-[#FFFF00]10 border border-[#FFFF00]20">
          <div className="text-xs text-white/60 mb-1">FY2024-25 FBT Rate</div>
          <div className="text-xl font-light text-[#FFFF00]">47%</div>
          <div className="text-xs text-white/40 mt-1">
            Grossed-up Type 1: 2.0802 | Type 2: 1.8868
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
