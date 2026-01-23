'use client'

import { useEffect, useState } from 'react'

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

  const statusEmoji = {
    healthy: '✅',
    warning: '⚠️',
    error: '❌'
  }

  const severityColor = {
    low: 'text-blue-600',
    medium: 'text-yellow-600',
    high: 'text-orange-600',
    critical: 'text-red-600'
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Autonomous Agent Monitor</h1>
        <div className="text-center text-gray-500">Loading agent reports...</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🤖 Autonomous Agent Monitor</h1>
        <p className="text-gray-600">
          Real-time monitoring and recommendations from autonomous agents
        </p>
        <div className="text-sm text-gray-500 mt-2">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="font-bold text-red-800">Error fetching reports</div>
          <div className="text-red-600 text-sm">{error}</div>
        </div>
      )}

      {/* Critical Findings Alert */}
      {criticalFindings.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-red-800 mb-4">
            🚨 {criticalFindings.length} Critical Issue{criticalFindings.length !== 1 ? 's' : ''}
          </h2>
          <div className="space-y-3">
            {criticalFindings.map((finding, i) => (
              <div key={i} className="bg-white rounded p-3">
                <div className="font-bold text-red-700">{finding.type}</div>
                <div className="text-gray-700">{finding.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {Object.entries(latestReports).map(([agentId, report]) => (
          <div
            key={agentId}
            className={`border rounded-lg p-5 ${
              report.status === 'error'
                ? 'border-red-300 bg-red-50'
                : report.status === 'warning'
                ? 'border-yellow-300 bg-yellow-50'
                : 'border-green-300 bg-green-50'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg">{statusEmoji[report.status]} {agentId}</h3>
              <div className={`text-sm font-semibold px-2 py-1 rounded ${
                report.status === 'error'
                  ? 'bg-red-200 text-red-800'
                  : report.status === 'warning'
                  ? 'bg-yellow-200 text-yellow-800'
                  : 'bg-green-200 text-green-800'
              }`}>
                {report.status}
              </div>
            </div>

            <div className="text-sm text-gray-600 mb-3">
              {new Date(report.created_at).toLocaleString()}
            </div>

            <div className="flex gap-4 text-sm">
              <div>
                <div className="font-semibold">Findings</div>
                <div className="text-2xl font-bold">{report.findings.length}</div>
              </div>
              <div>
                <div className="font-semibold">Recommendations</div>
                <div className="text-2xl font-bold">{report.recommendations.length}</div>
              </div>
            </div>

            {report.findings.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-300">
                <div className="text-xs font-semibold mb-2">Recent Findings:</div>
                {report.findings.slice(0, 2).map((finding, i) => (
                  <div key={i} className={`text-xs mb-1 ${severityColor[finding.severity]}`}>
                    • [{finding.severity}] {finding.description}
                  </div>
                ))}
                {report.findings.length > 2 && (
                  <div className="text-xs text-gray-500">
                    + {report.findings.length - 2} more
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recommendations Queue */}
      {allRecommendations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">💡 Recommended Actions</h2>
          <div className="space-y-3">
            {allRecommendations.slice(0, 10).map((rec, i) => (
              <div
                key={i}
                className={`border-l-4 pl-4 py-2 ${
                  rec.priority === 'critical'
                    ? 'border-red-500 bg-red-50'
                    : rec.priority === 'high'
                    ? 'border-orange-500 bg-orange-50'
                    : rec.priority === 'medium'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-blue-500 bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-bold">{rec.action}</div>
                    <div className="text-sm text-gray-700 mt-1">{rec.reason}</div>
                    {rec.estimatedEffort && (
                      <div className="text-xs text-gray-500 mt-1">
                        ⏱️ Est. effort: {rec.estimatedEffort}
                      </div>
                    )}
                  </div>
                  <div className={`text-xs font-bold uppercase px-2 py-1 rounded ml-3 ${
                    rec.priority === 'critical'
                      ? 'bg-red-200 text-red-800'
                      : rec.priority === 'high'
                      ? 'bg-orange-200 text-orange-800'
                      : rec.priority === 'medium'
                      ? 'bg-yellow-200 text-yellow-800'
                      : 'bg-blue-200 text-blue-800'
                  }`}>
                    {rec.priority}
                  </div>
                </div>
              </div>
            ))}
            {allRecommendations.length > 10 && (
              <div className="text-sm text-gray-500 text-center pt-2">
                + {allRecommendations.length - 10} more recommendations
              </div>
            )}
          </div>
        </div>
      )}

      {/* No reports */}
      {Object.keys(latestReports).length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">🤖</div>
          <div className="text-xl font-bold mb-2">No Agent Reports Yet</div>
          <div className="text-gray-600 mb-4">
            Start the autonomous agent system to begin monitoring
          </div>
          <div className="bg-gray-800 text-white rounded px-4 py-2 inline-block font-mono text-sm">
            npm run agents:start
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-8 text-sm text-gray-500 text-center">
        Monitoring updates every 10 seconds • Run{' '}
        <code className="bg-gray-100 px-2 py-1 rounded">npm run agents:help</code> for CLI commands
      </div>
    </div>
  )
}
