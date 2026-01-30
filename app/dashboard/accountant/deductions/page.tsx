/**
 * Deductions (Section 8-1) Workflow Area
 *
 * Review general deduction eligibility analysis under Section 8-1 ITAA 1997.
 * Provides AI-powered suggestions with confidence scoring and legislation references.
 */

import Link from 'next/link'
import {
  ArrowLeft,
  Receipt,
  AlertTriangle,
} from 'lucide-react'
import { FindingCard } from '@/components/accountant/FindingCard'

export default async function DeductionsWorkflowPage() {
  // TODO: Fetch real data from API
  const findings: any[] = []

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

      {/* Findings List */}
      {findings.length === 0 ? (
        <div
          className="p-12 rounded-2xl text-center"
          style={{
            background: 'var(--void-elevated)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <Receipt className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-light text-white/90 mb-2">
            No Deduction Findings Yet
          </h3>
          <p className="text-sm text-white/60 mb-6 max-w-md mx-auto">
            Run a forensic audit to analyze expenses and identify deduction
            opportunities under Section 8-1 ITAA 1997.
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
              workflowArea="deductions"
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
    </div>
  )
}
