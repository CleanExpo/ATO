/**
 * Source Documents Workflow Area
 *
 * Review missing or insufficient documentation for tax claims.
 * Provides AI-powered analysis with confidence scoring and legislation references.
 */

import Link from 'next/link'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import {
  ArrowLeft,
  FileCheck,
  AlertTriangle,
} from 'lucide-react'
import { FindingCard } from '@/components/accountant/FindingCard'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DocumentsWorkflowPage() {
  const findings = await fetchFindings('documents')

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
        <span className="text-white/90">Source Documents</span>
      </div>

      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="p-3 rounded-xl"
            style={{
              background: '#FF00FF15',
              border: '1px solid #FF00FF30',
            }}
          >
            <FileCheck className="w-6 h-6 text-[#FF00FF]" />
          </div>
          <div>
            <h1 className="text-3xl font-light text-white/90">
              Source Documents
            </h1>
            <p className="text-sm text-white/60">
              Missing or insufficient documentation review
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
          <div className="text-xs text-white/60 mb-1">High Risk</div>
          <div className="text-2xl font-light text-white/90">
            {findings.filter((f) => f.confidence?.level === 'Low').length}
          </div>
        </div>

        <div
          className="p-4 rounded-2xl"
          style={{
            background: 'var(--void-elevated)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div className="text-xs text-white/60 mb-1">At Risk Amount</div>
          <div className="text-2xl font-light text-white/90">
            ${findings.reduce((sum, f) => sum + (f.amount || 0), 0).toLocaleString()}
          </div>
        </div>
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
          <FileCheck className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-light text-white/90 mb-2">
            No Documentation Issues Yet
          </h3>
          <p className="text-sm text-white/60 mb-6 max-w-md mx-auto">
            Run a forensic audit to analyze documentation quality and identify
            missing or insufficient source documents.
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
              workflowArea="documents"
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
          <AlertTriangle className="text-[#FF00FF]" size={20} />
          ATO Documentation Requirements
        </h3>
        <div className="space-y-3 text-sm text-white/60">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FF00FF]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#FF00FF] text-xs font-medium">1</span>
            </div>
            <div>
              <strong className="text-white/80">Tax Invoices:</strong> Required for GST credits
              - must contain supplier ABN, description, GST amount (or &apos;inc GST&apos;)
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FF00FF]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#FF00FF] text-xs font-medium">2</span>
            </div>
            <div>
              <strong className="text-white/80">Receipts:</strong> Required for income tax
              deductions - must show date, supplier, description, amount
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FF00FF]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#FF00FF] text-xs font-medium">3</span>
            </div>
            <div>
              <strong className="text-white/80">Supporting Evidence:</strong> Contracts,
              agreements, bank statements may be required for large or unusual claims
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FF00FF]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#FF00FF] text-xs font-medium">4</span>
            </div>
            <div>
              <strong className="text-white/80">Record Keeping:</strong> 5-year retention period
              from date of lodgment (7 years for capital assets)
            </div>
          </div>
        </div>

        {/* Risk Warning */}
        <div className="mt-4 p-4 rounded-xl bg-[#FF0080]10 border border-[#FF0080]20">
          <div className="text-xs text-[#FF0080] font-medium mb-1">⚠️ ATO Audit Risk</div>
          <div className="text-xs text-white/60">
            Missing source documents can result in claims being disallowed during ATO review,
            plus penalties and interest. Ensure all material claims are properly documented.
          </div>
        </div>
      </div>

      <TaxDisclaimer />
    </div>
  )
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
