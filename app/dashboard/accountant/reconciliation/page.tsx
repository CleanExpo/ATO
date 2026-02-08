/**
 * Reconciliation Workflow Area
 *
 * Review account balance and general ledger reconciliation issues.
 * Provides AI-powered analysis with confidence scoring and suggestions.
 */

import Link from 'next/link'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { FindingCard } from '@/components/accountant/FindingCard'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ReconciliationWorkflowPage() {
  const findings = await fetchFindings('reconciliation')

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
        <span className="text-white/90">Reconciliation</span>
      </div>

      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="p-3 rounded-xl"
            style={{
              background: '#FF6B0015',
              border: '1px solid #FF6B0030',
            }}
          >
            <CheckCircle2 className="w-6 h-6 text-[#FF6B00]" />
          </div>
          <div>
            <h1 className="text-3xl font-light text-white/90">Reconciliation</h1>
            <p className="text-sm text-white/60">
              Account balance and GL reconciliation issues
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
          <div className="text-xs text-white/60 mb-1">Critical Issues</div>
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
          <div className="text-xs text-white/60 mb-1">Total Variance</div>
          <div className="text-2xl font-light text-white/90">
            ${findings.reduce((sum, f) => sum + Math.abs(f.amount || 0), 0).toLocaleString()}
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
          <CheckCircle2 className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-light text-white/90 mb-2">
            No Reconciliation Issues Yet
          </h3>
          <p className="text-sm text-white/60 mb-6 max-w-md mx-auto">
            Run a forensic audit to analyze account reconciliations and identify
            discrepancies or unusual balances.
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
              workflowArea="reconciliation"
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
          <AlertTriangle className="text-[#FF6B00]" size={20} />
          Common Reconciliation Red Flags
        </h3>
        <div className="space-y-3 text-sm text-white/60">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FF6B00]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#FF6B00] text-xs font-medium">1</span>
            </div>
            <div>
              <strong className="text-white/80">Bank Account Variances:</strong> Unreconciled
              differences between bank statement and GL indicate missing or duplicate transactions
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FF6B00]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#FF6B00] text-xs font-medium">2</span>
            </div>
            <div>
              <strong className="text-white/80">Aged Suspense Items:</strong> Long-outstanding
              suspense account balances suggest unresolved classification issues
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FF6B00]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#FF6B00] text-xs font-medium">3</span>
            </div>
            <div>
              <strong className="text-white/80">Control Account Mismatches:</strong> Debtors/
              creditors control vs subsidiary ledger differences indicate data integrity issues
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FF6B00]30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#FF6B00] text-xs font-medium">4</span>
            </div>
            <div>
              <strong className="text-white/80">Unusual Balances:</strong> Debit balances in
              liability accounts or credit balances in asset accounts require investigation
            </div>
          </div>
        </div>

        {/* Best Practice */}
        <div className="mt-4 p-4 rounded-xl bg-[#00FF00]10 border border-[#00FF00]20">
          <div className="text-xs text-[#00FF00] font-medium mb-1">✓ Best Practice</div>
          <div className="text-xs text-white/60">
            All material account reconciliations should be completed monthly, reviewed by a
            supervisor, and signed off before month-end close. This reduces year-end audit time
            and identifies errors early.
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
