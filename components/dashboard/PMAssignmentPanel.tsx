/**
 * PM Assignment Panel
 *
 * Displays the dedicated Senior PM status for the current organization.
 * Shows PM context, compliance deadlines, analysis preferences,
 * and validation activity metrics.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  UserCheck,
  Shield,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  Minus,
  Settings2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  BarChart3,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { useOrganization } from '@/lib/context/OrganizationContext'

// ─── Types ───────────────────────────────────────────────────────────

interface PMAssignment {
  id: string
  organization_id: string
  status: 'active' | 'paused' | 'archived'
  pm_context: {
    client_profile: {
      entity_type?: string
      industry?: string
      annual_turnover_bracket?: string
      financial_year_end: string
      xero_connected: boolean
      accounting_platforms: string[]
    }
    analysis_preferences: {
      cadence: string
      priority_engines: string[]
      excluded_engines: string[]
      auto_reanalyse_on_sync: boolean
    }
    compliance_deadlines: ComplianceDeadline[]
    escalation_preference: string
    accountant_linked: boolean
    insights_summary: {
      top_opportunities: string[]
      risk_areas: string[]
      last_analysis_confidence: number
      trend: 'improving' | 'stable' | 'declining'
    }
  }
  last_validation_at?: string
  total_items_validated: number
  total_items_completed: number
  total_savings_identified: number
  created_at: string
  updated_at: string
}

interface ComplianceDeadline {
  id: string
  obligation: string
  due_date: string
  status: 'upcoming' | 'due_soon' | 'overdue' | 'completed'
  reminder_sent: boolean
  notes?: string
}

// ─── Helper Functions ────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function daysUntil(iso: string): number {
  const now = new Date()
  const target = new Date(iso)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function getEngineDisplayName(engine: string): string {
  const names: Record<string, string> = {
    deductions: 'Deductions',
    rnd: 'R&D Tax Incentive',
    div7a: 'Division 7A',
    losses: 'Loss Recovery',
    cgt: 'Capital Gains',
    fbt: 'Fringe Benefits',
    trust: 'Trust Analysis',
    payroll: 'Payroll Tax',
    psi: 'Personal Services',
    superannuation: 'Superannuation',
    fuel: 'Fuel Tax Credits',
  }
  return names[engine] || engine
}

// ─── Component ───────────────────────────────────────────────────────

export default function PMAssignmentPanel() {
  const { currentOrganization } = useOrganization()
  const [assignment, setAssignment] = useState<PMAssignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAssignment = useCallback(async () => {
    if (!currentOrganization?.id) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/pm-assignments/${currentOrganization.id}`)
      if (!res.ok) throw new Error('Failed to fetch PM assignment')
      const data = await res.json()
      setAssignment(data.assignment)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [currentOrganization?.id])

  useEffect(() => {
    fetchAssignment()
  }, [fetchAssignment])

  if (loading) {
    return (
      <GlassCard className="p-6 animate-pulse">
        <div className="h-6 w-48 bg-white/5 rounded mb-4" />
        <div className="h-4 w-64 bg-white/5 rounded mb-2" />
        <div className="h-4 w-40 bg-white/5 rounded" />
      </GlassCard>
    )
  }

  if (error || !assignment) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 text-amber-400">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm">PM assignment unavailable</span>
        </div>
      </GlassCard>
    )
  }

  const ctx = assignment.pm_context
  const deadlines = ctx.compliance_deadlines || []
  const upcomingDeadlines = deadlines
    .filter(d => d.status !== 'completed')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

  const TrendIcon = ctx.insights_summary.trend === 'improving'
    ? TrendingUp
    : ctx.insights_summary.trend === 'declining'
      ? TrendingDown
      : Minus

  const trendColor = ctx.insights_summary.trend === 'improving'
    ? 'text-emerald-400'
    : ctx.insights_summary.trend === 'declining'
      ? 'text-red-400'
      : 'text-gray-400'

  return (
    <div className="space-y-4">
      {/* Header */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <UserCheck className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Senior Project Manager</h3>
              <p className="text-xs text-gray-400">
                Assigned to {currentOrganization?.name || 'your organization'}
              </p>
            </div>
          </div>
          <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            assignment.status === 'active'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}>
            {assignment.status === 'active' ? 'Active' : 'Paused'}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px] uppercase tracking-wider text-gray-500">Validated</span>
            </div>
            <span className="text-lg font-semibold text-white">{assignment.total_items_validated}</span>
          </div>

          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] uppercase tracking-wider text-gray-500">Completed</span>
            </div>
            <span className="text-lg font-semibold text-white">{assignment.total_items_completed}</span>
          </div>

          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[10px] uppercase tracking-wider text-gray-500">Savings</span>
            </div>
            <span className="text-lg font-semibold text-white">
              {formatCurrency(assignment.total_savings_identified)}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <div className="flex items-center gap-2 mb-1">
              <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
              <span className="text-[10px] uppercase tracking-wider text-gray-500">Confidence</span>
            </div>
            <span className="text-lg font-semibold text-white">
              {ctx.insights_summary.last_analysis_confidence}%
            </span>
          </div>
        </div>

        {assignment.last_validation_at && (
          <p className="text-[10px] text-gray-500 mt-3">
            Last validation: {formatDate(assignment.last_validation_at)}
          </p>
        )}
      </GlassCard>

      {/* Compliance Deadlines */}
      {upcomingDeadlines.length > 0 && (
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="h-4 w-4 text-orange-400" />
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Upcoming Deadlines
            </h4>
          </div>
          <div className="space-y-2">
            {upcomingDeadlines.slice(0, 5).map((dl) => {
              const days = daysUntil(dl.due_date)
              const isUrgent = days <= 7
              const isDueSoon = days <= 14

              return (
                <div
                  key={dl.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    isUrgent
                      ? 'bg-red-500/5 border-red-500/20'
                      : isDueSoon
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-white/[0.02] border-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isUrgent ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                    )}
                    <span className="text-xs text-white">{dl.obligation}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-medium ${
                      isUrgent ? 'text-red-400' : isDueSoon ? 'text-amber-400' : 'text-gray-400'
                    }`}>
                      {days <= 0 ? 'OVERDUE' : `${days}d`}
                    </span>
                    <span className="text-[10px] text-gray-500">{formatDate(dl.due_date)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </GlassCard>
      )}

      {/* Analysis Preferences */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 className="h-4 w-4 text-blue-400" />
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
            Analysis Configuration
          </h4>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Cadence</span>
            <span className="text-xs text-white capitalize">
              {ctx.analysis_preferences.cadence.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Auto re-analyse on sync</span>
            <span className={`text-xs ${ctx.analysis_preferences.auto_reanalyse_on_sync ? 'text-emerald-400' : 'text-gray-500'}`}>
              {ctx.analysis_preferences.auto_reanalyse_on_sync ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Escalation</span>
            <span className="text-xs text-white capitalize">
              {ctx.escalation_preference.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Accountant linked</span>
            <span className={`text-xs ${ctx.accountant_linked ? 'text-emerald-400' : 'text-gray-500'}`}>
              {ctx.accountant_linked ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="pt-2 border-t border-white/[0.04]">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Priority Engines</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {ctx.analysis_preferences.priority_engines.map((engine) => (
                <span
                  key={engine}
                  className="px-2 py-0.5 text-[10px] rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20"
                >
                  {getEngineDisplayName(engine)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Risk Areas & Opportunities */}
      {(ctx.insights_summary.risk_areas.length > 0 || ctx.insights_summary.top_opportunities.length > 0) && (
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-emerald-400" />
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              PM Insights
            </h4>
          </div>

          {ctx.insights_summary.top_opportunities.length > 0 && (
            <div className="mb-3">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Opportunities</span>
              <div className="mt-1 space-y-1">
                {ctx.insights_summary.top_opportunities.map((opp, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-emerald-400">
                    <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                    <span>{opp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ctx.insights_summary.risk_areas.length > 0 && (
            <div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Risk Areas</span>
              <div className="mt-1 space-y-1">
                {ctx.insights_summary.risk_areas.map((risk, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-amber-400">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                    <span>{risk}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  )
}
