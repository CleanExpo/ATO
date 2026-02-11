'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { MobileNav } from '@/components/ui/MobileNav'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'

interface Finding {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  details?: unknown
  timestamp: string
}

interface Recommendation {
  priority: 'low' | 'medium' | 'high' | 'critical'
  action: string
  reason: string
  estimatedEffort?: string
}

interface AgentReport {
  id: string
  agent_id: string
  status: 'healthy' | 'warning' | 'error'
  findings: Finding[]
  recommendations: Recommendation[]
  metadata?: unknown
  created_at: string
}

export default function AgentMonitorPage() {
  const [reports, setReports] = useState<AgentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    // Fetch reports immediately
    fetchReports()

    // Then poll every 10 seconds
    const interval = setInterval(() => {
      fetchReports()
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  async function fetchReports() {
    try {
      const response = await fetch('/api/agents/reports?limit=50')

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const data = await response.json()
      setReports(data.reports || [])
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Failed to fetch agent reports:', err)
    } finally {
      setLoading(false)
    }
  }

  // Get latest report for each agent
  const latestReports = reports.reduce((acc, report) => {
    if (!acc[report.agent_id] || new Date(report.created_at) > new Date(acc[report.agent_id].created_at)) {
      acc[report.agent_id] = report
    }
    return acc
  }, {} as Record<string, AgentReport>)

  // Collect all critical findings
  const criticalFindings = Object.values(latestReports)
    .flatMap(r => r.findings.filter(f => f.severity === 'critical'))

  // Collect all recommendations sorted by priority
  const allRecommendations = Object.values(latestReports)
    .flatMap(r => r.recommendations)
    .sort((a, b) => {
      const priority = { critical: 0, high: 1, medium: 2, low: 3 }
      return priority[a.priority] - priority[b.priority]
    })

  const StatusIcon = ({ status }: { status: 'healthy' | 'warning' | 'error' }) => {
    if (status === 'healthy') return <CheckCircle2 className="w-5 h-5 text-emerald-400 inline-block" />
    if (status === 'warning') return <AlertTriangle className="w-5 h-5 text-amber-400 inline-block" />
    return <XCircle className="w-5 h-5 text-red-400 inline-block" />
  }

  const severityStyles: Record<string, string> = {
    low: 'color: var(--accent-primary)',
    medium: 'color: var(--color-warning)',
    high: 'color: #FF8800',
    critical: 'color: var(--color-error)'
  }

  const statusCardStyles: Record<string, { bg: string; border: string }> = {
    error: { bg: 'rgba(255, 68, 68, 0.06)', border: 'rgba(255, 68, 68, 0.2)' },
    warning: { bg: 'rgba(255, 184, 0, 0.06)', border: 'rgba(255, 184, 0, 0.2)' },
    healthy: { bg: 'rgba(0, 255, 136, 0.06)', border: 'rgba(0, 255, 136, 0.2)' }
  }

  const priorityStyles: Record<string, { bg: string; text: string; border: string }> = {
    critical: { bg: 'rgba(255, 68, 68, 0.1)', text: '#FF4444', border: '#FF4444' },
    high: { bg: 'rgba(255, 136, 0, 0.1)', text: '#FF8800', border: '#FF8800' },
    medium: { bg: 'rgba(255, 184, 0, 0.1)', text: '#FFB800', border: '#FFB800' },
    low: { bg: 'rgba(0, 245, 255, 0.1)', text: '#00F5FF', border: '#00F5FF' }
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-6">Autonomous Agent Monitor</h1>
        <div className="text-center text-[var(--text-muted)]">Loading agent reports...</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Autonomous Agent Monitor</h1>
        <p className="text-[var(--text-secondary)]">
          Real-time monitoring and recommendations from autonomous agents
        </p>
        <div className="text-sm text-[var(--text-muted)] mt-2">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      {error && (
        <div className="glass-card p-4 mb-6" style={{ background: 'rgba(255, 68, 68, 0.06)', border: '0.5px solid rgba(255, 68, 68, 0.2)' }}>
          <div className="font-bold" style={{ color: 'var(--color-error)' }}>Error fetching reports</div>
          <div className="text-sm text-[var(--text-secondary)]">{error}</div>
        </div>
      )}

      {/* Critical Findings Alert */}
      {criticalFindings.length > 0 && (
        <div className="glass-card p-6 mb-6" style={{ background: 'rgba(255, 68, 68, 0.08)', border: '0.5px solid rgba(255, 68, 68, 0.3)' }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-error)' }}>
            {criticalFindings.length} Critical Issue{criticalFindings.length !== 1 ? 's' : ''}
          </h2>
          <div className="space-y-3">
            {criticalFindings.map((finding, i) => (
              <div key={i} className="glass-card p-3">
                <div className="font-bold" style={{ color: 'var(--color-error)' }}>{finding.type}</div>
                <div className="text-[var(--text-secondary)]">{finding.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {Object.entries(latestReports).map(([agentId, report]) => {
          const cardStyle = statusCardStyles[report.status]
          return (
            <div
              key={agentId}
              className="glass-card p-5"
              style={{ background: cardStyle.bg, border: `0.5px solid ${cardStyle.border}` }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg text-[var(--text-primary)] flex items-center gap-2"><StatusIcon status={report.status} /> {agentId}</h3>
                <div
                  className="text-xs font-semibold px-2 py-1 rounded-sm uppercase tracking-wider"
                  style={{
                    background: statusCardStyles[report.status].bg,
                    color: report.status === 'error' ? '#FF4444' : report.status === 'warning' ? '#FFB800' : '#00FF88',
                    border: `0.5px solid ${statusCardStyles[report.status].border}`
                  }}
                >
                  {report.status}
                </div>
              </div>

              <div className="text-sm text-[var(--text-muted)] mb-3">
                {new Date(report.created_at).toLocaleString()}
              </div>

              <div className="flex gap-4 text-sm">
                <div>
                  <div className="font-semibold text-[var(--text-secondary)]">Findings</div>
                  <div className="text-2xl font-bold text-[var(--text-primary)]">{report.findings.length}</div>
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-secondary)]">Recommendations</div>
                  <div className="text-2xl font-bold text-[var(--text-primary)]">{report.recommendations.length}</div>
                </div>
              </div>

              {report.findings.length > 0 && (
                <div className="mt-3 pt-3" style={{ borderTop: '0.5px solid var(--border-light)' }}>
                  <div className="text-xs font-semibold text-[var(--text-muted)] mb-2">Recent Findings:</div>
                  {report.findings.slice(0, 2).map((finding, i) => (
                    <div key={i} className="text-xs mb-1" style={{ [severityStyles[finding.severity].split(':')[0]]: severityStyles[finding.severity].split(':')[1]?.trim() }}>
                      • [{finding.severity}] {finding.description}
                    </div>
                  ))}
                  {report.findings.length > 2 && (
                    <div className="text-xs text-[var(--text-muted)]">
                      + {report.findings.length - 2} more
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Recommendations Queue */}
      {allRecommendations.length > 0 && (
        <div className="glass-card p-6 mb-8">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Recommended Actions</h2>
          <div className="space-y-3">
            {allRecommendations.slice(0, 10).map((rec, i) => {
              const pStyle = priorityStyles[rec.priority]
              return (
                <div
                  key={i}
                  className="pl-4 py-3 pr-4 rounded-sm"
                  style={{ background: pStyle.bg, borderLeft: `2px solid ${pStyle.border}` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-bold text-[var(--text-primary)]">{rec.action}</div>
                      <div className="text-sm text-[var(--text-secondary)] mt-1">{rec.reason}</div>
                      {rec.estimatedEffort && (
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          Est. effort: {rec.estimatedEffort}
                        </div>
                      )}
                    </div>
                    <div
                      className="text-xs font-bold uppercase px-2 py-1 rounded-sm ml-3"
                      style={{ background: pStyle.bg, color: pStyle.text, border: `0.5px solid ${pStyle.border}` }}
                    >
                      {rec.priority}
                    </div>
                  </div>
                </div>
              )
            })}
            {allRecommendations.length > 10 && (
              <div className="text-sm text-[var(--text-muted)] text-center pt-2">
                + {allRecommendations.length - 10} more recommendations
              </div>
            )}
          </div>
        </div>
      )}

      {/* No reports */}
      {Object.keys(latestReports).length === 0 && (
        <div className="glass-card p-8 text-center">
          <div className="text-6xl mb-4">🤖</div>
          <div className="text-xl font-bold text-[var(--text-primary)] mb-2">No Agent Reports Yet</div>
          <div className="text-[var(--text-secondary)] mb-4">
            Start the autonomous agent system to begin monitoring
          </div>
          <div className="rounded-sm px-4 py-2 inline-block font-mono text-sm" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '0.5px solid rgba(255, 255, 255, 0.1)', color: 'var(--accent-primary)' }}>
            npm run agents:start
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-8 text-sm text-[var(--text-muted)] text-center">
        Monitoring updates every 10 seconds •{' '}
        <code className="px-2 py-1 rounded-sm" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--accent-primary)' }}>npm run agents:help</code> for CLI commands
      </div>

      <TaxDisclaimer />

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  )
}
