/**
 * Accountant Workflow Hub
 *
 * Main landing page for accountant-facing tax intelligence system.
 * Provides quick access to 6 workflow areas with smart notifications.
 */

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
} from 'lucide-react'

interface WorkflowArea {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  findingsCount: number
  highValueFindings: number
  color: string
}

const WORKFLOW_AREAS: WorkflowArea[] = [
  {
    id: 'sundries',
    title: 'Sundries',
    description: 'Miscellaneous transactions requiring classification',
    icon: FileText,
    href: '/dashboard/accountant/sundries',
    findingsCount: 0,
    highValueFindings: 0,
    color: '#00D9FF', // Cyan
  },
  {
    id: 'deductions',
    title: 'Deductions (Section 8-1)',
    description: 'General deduction eligibility analysis',
    icon: Receipt,
    href: '/dashboard/accountant/deductions',
    findingsCount: 0,
    highValueFindings: 0,
    color: '#FF0080', // Magenta
  },
  {
    id: 'fbt',
    title: 'Fringe Benefits Tax',
    description: 'FBT liability analysis and optimization',
    icon: Car,
    href: '/dashboard/accountant/fbt',
    findingsCount: 0,
    highValueFindings: 0,
    color: '#FFFF00', // Yellow
  },
  {
    id: 'div7a',
    title: 'Division 7A',
    description: 'Private company loan and deemed dividend analysis',
    icon: Building2,
    href: '/dashboard/accountant/div7a',
    findingsCount: 0,
    highValueFindings: 0,
    color: '#00FF00', // Green
  },
  {
    id: 'documents',
    title: 'Source Documents',
    description: 'Missing or insufficient documentation review',
    icon: FileCheck,
    href: '/dashboard/accountant/documents',
    findingsCount: 0,
    highValueFindings: 0,
    color: '#FF00FF', // Violet
  },
  {
    id: 'reconciliation',
    title: 'Reconciliation',
    description: 'Account balance and GL reconciliation issues',
    icon: CheckCircle2,
    href: '/dashboard/accountant/reconciliation',
    findingsCount: 0,
    highValueFindings: 0,
    color: '#FF6B00', // Orange
  },
]

export default async function AccountantWorkflowPage() {
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
          <div className="text-3xl font-light text-white/90">0</div>
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
          <div className="text-3xl font-light text-white/90">0</div>
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
          <div className="text-3xl font-light text-white/90">-</div>
          <div className="text-xs text-white/40 mt-1">No findings yet</div>
        </div>
      </div>

      {/* Workflow Areas Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-light text-white/90">Workflow Areas</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {WORKFLOW_AREAS.map((area) => {
            const Icon = area.icon

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
                      {area.findingsCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/40">High-Value:</span>{' '}
                    <span className="text-white/70 font-medium">
                      {area.highValueFindings}
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
            1. Run a forensic audit to analyze your Xero data across all workflow
            areas
          </p>
          <p>
            2. Review findings in each area, starting with high-value items
          </p>
          <p>
            3. Validate recommendations and approve for client report inclusion
          </p>
          <p>
            4. Generate professional client reports with your commentary
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
