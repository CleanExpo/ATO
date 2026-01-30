/**
 * Fringe Benefits Tax (FBT) Workflow Area
 *
 * Review FBT liability analysis and optimization opportunities.
 * Provides AI-powered suggestions with confidence scoring and legislation references.
 */

import Link from 'next/link'
import {
  ArrowLeft,
  Car,
  AlertTriangle,
} from 'lucide-react'
import { FindingCard } from '@/components/accountant/FindingCard'

export default async function FBTWorkflowPage() {
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
          <div className="text-xs text-white/60 mb-1">Estimated Savings</div>
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
          <Car className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-light text-white/90 mb-2">
            No FBT Findings Yet
          </h3>
          <p className="text-sm text-white/60 mb-6 max-w-md mx-auto">
            Run a forensic audit to analyze fringe benefits and identify FBT
            optimization opportunities.
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
              workflowArea="fbt"
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
    </div>
  )
}
