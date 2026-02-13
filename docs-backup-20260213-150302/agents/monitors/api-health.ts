import { Agent, AgentReport } from '../types'

interface EndpointTest {
  endpoint: string
  status: number
  duration: number
  healthy: boolean
  error?: string
}

export class APIHealthAgent extends Agent {
  private endpoints = [
    `/api/audit/analysis-status/${this.tenantId}`,
    `/api/audit/recommendations?tenantId=${this.tenantId}`,
    `/api/audit/opportunities-by-year?tenantId=${this.tenantId}`,
    `/api/audit/sync-status/${this.tenantId}`
  ]

  constructor(tenantId: string) {
    super('api-health', tenantId)
  }

  async execute(): Promise<AgentReport> {
    const startTime = Date.now()

    try {
      // Test all endpoints in parallel
      const results = await Promise.all(
        this.endpoints.map(endpoint => this.testEndpoint(endpoint))
      )

      const findings = []
      const recommendations = []

      // Analyze results
      const unhealthy = results.filter(r => !r.healthy)
      const slow = results.filter(r => r.healthy && r.duration > 1000) // >1s is slow

      // Check 1: Failed endpoints
      if (unhealthy.length > 0) {
        unhealthy.forEach(result => {
          findings.push(
            this.createFinding(
              'endpoint-failure',
              result.status >= 500 ? 'critical' : 'high',
              `${result.endpoint} returned ${result.status}`,
              {
                endpoint: result.endpoint,
                status: result.status,
                error: result.error
              }
            )
          )
        })

        recommendations.push(
          this.createRecommendation(
            'critical',
            `Fix ${unhealthy.length} failing API endpoint(s)`,
            'API endpoints are returning errors',
            '1 hour'
          )
        )
      }

      // Check 2: Slow endpoints
      if (slow.length > 0) {
        findings.push(
          this.createFinding(
            'slow-endpoints',
            'medium',
            `${slow.length} endpoint(s) responding slowly (>1s)`,
            {
              slowEndpoints: slow.map(s => ({
                endpoint: s.endpoint,
                duration: s.duration
              }))
            }
          )
        )

        recommendations.push(
          this.createRecommendation(
            'medium',
            'Optimize slow API endpoints',
            'Response times above 1 second impact user experience',
            '2 hours'
          )
        )
      }

      // Check 3: All endpoints down
      if (unhealthy.length === this.endpoints.length) {
        findings.push(
          this.createFinding(
            'total-failure',
            'critical',
            'All API endpoints are down',
            { endpointsCount: this.endpoints.length }
          )
        )

        recommendations.push(
          this.createRecommendation(
            'critical',
            'Restart dev server or check database connection',
            'Complete API failure indicates server or database issue',
            '30 minutes'
          )
        )
      }

      // Calculate average response time
      const avgResponseTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length

      const executionTime = Date.now() - startTime

      // Determine overall status
      let status: 'healthy' | 'warning' | 'error' = 'healthy'
      if (findings.some(f => f.severity === 'critical')) {
        status = 'error'
      } else if (findings.some(f => f.severity === 'high' || f.severity === 'medium')) {
        status = 'warning'
      }

      return this.createReport(status, findings, recommendations, {
        executionTime,
        dataPointsAnalyzed: results.length,
        avgResponseTime: Math.round(avgResponseTime),
        healthyEndpoints: results.filter(r => r.healthy).length,
        totalEndpoints: results.length,
        lastRun: new Date()
      })

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined

      return this.createReport(
        'error',
        [
          this.createFinding(
            'agent-error',
            'critical',
            `Failed to test API endpoints: ${errorMessage}`,
            { error: errorStack }
          )
        ],
        [
          this.createRecommendation(
            'critical',
            'Debug API health agent',
            'Agent failed to execute properly',
            '1 hour'
          )
        ]
      )
    }
  }

  private async testEndpoint(endpoint: string): Promise<EndpointTest> {
    const start = Date.now()

    try {
      const response = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const duration = Date.now() - start

      return {
        endpoint,
        status: response.status,
        duration,
        healthy: response.ok && duration < 2000
      }

    } catch (error: unknown) {
      const duration = Date.now() - start
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      return {
        endpoint,
        status: 0,
        duration,
        healthy: false,
        error: errorMessage
      }
    }
  }
}
