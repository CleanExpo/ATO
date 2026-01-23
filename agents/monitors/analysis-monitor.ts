import { Agent, AgentReport } from '../types'

interface AnalysisStatus {
  status: string
  progress: number
  transactionsAnalyzed: number
  totalTransactions: number
  estimatedCostUSD: number
  errorMessage?: string
  eta?: string
  message: string
  isComplete: boolean
  isError: boolean
  isAnalyzing: boolean
}

export class AnalysisMonitorAgent extends Agent {
  private previousProgress: number = 0
  private stalls: number = 0
  private MAX_STALLS = 3 // Flag if progress doesn't change for 3 checks

  constructor(tenantId: string) {
    super('analysis-monitor', tenantId)
  }

  async execute(): Promise<AgentReport> {
    const startTime = Date.now()

    try {
      // Poll analysis status API
      const response = await fetch(
        `http://localhost:3000/api/audit/analysis-status/${this.tenantId}`
      )

      if (!response.ok) {
        return this.createReport(
          'error',
          [
            this.createFinding(
              'api-error',
              'critical',
              `Analysis status API returned ${response.status}`,
              { statusCode: response.status }
            )
          ],
          [
            this.createRecommendation(
              'critical',
              'Investigate analysis status API failure',
              'API endpoint is not responding correctly',
              '30 minutes'
            )
          ]
        )
      }

      const data: AnalysisStatus = await response.json()

      // Analyze the status
      const findings = []
      const recommendations = []

      // Check 1: Is analysis stalled?
      if (data.isAnalyzing && data.progress === this.previousProgress) {
        this.stalls++
        if (this.stalls >= this.MAX_STALLS) {
          findings.push(
            this.createFinding(
              'analysis-stalled',
              'high',
              `Analysis progress has not changed in ${this.stalls * 5} minutes (stuck at ${data.progress.toFixed(2)}%)`,
              {
                progress: data.progress,
                transactionsAnalyzed: data.transactionsAnalyzed,
                stallCount: this.stalls
              }
            )
          )
          recommendations.push(
            this.createRecommendation(
              'high',
              'Restart AI analysis process',
              'Analysis appears to be stalled - may need restart or debugging',
              '1 hour'
            )
          )
        }
      } else {
        this.stalls = 0 // Reset stalls if progress changed
      }

      this.previousProgress = data.progress

      // Check 2: Error state
      if (data.isError) {
        findings.push(
          this.createFinding(
            'analysis-error',
            'critical',
            `Analysis is in error state: ${data.errorMessage || 'Unknown error'}`,
            { errorMessage: data.errorMessage }
          )
        )
        recommendations.push(
          this.createRecommendation(
            'critical',
            'Fix analysis error and restart',
            'Analysis has encountered an error and needs attention',
            '2 hours'
          )
        )
      }

      // Check 3: Cost anomaly
      if (data.estimatedCostUSD > 10) {
        findings.push(
          this.createFinding(
            'high-cost',
            'medium',
            `Analysis cost is higher than expected: $${data.estimatedCostUSD.toFixed(2)}`,
            { estimatedCost: data.estimatedCostUSD }
          )
        )
        recommendations.push(
          this.createRecommendation(
            'medium',
            'Review AI API usage and costs',
            'Cost is higher than typical - verify API rate limits and pricing',
            '30 minutes'
          )
        )
      }

      // Check 4: Completion
      if (data.isComplete) {
        findings.push(
          this.createFinding(
            'analysis-complete',
            'low',
            `Analysis completed: ${data.transactionsAnalyzed} transactions analyzed`,
            {
              totalTransactions: data.totalTransactions,
              finalCost: data.estimatedCostUSD
            }
          )
        )
        recommendations.push(
          this.createRecommendation(
            'medium',
            'Generate final reports and validate results',
            'Analysis is complete - ready for reporting',
            '1 hour'
          )
        )
      }

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
        analysisProgress: data.progress,
        transactionsAnalyzed: data.transactionsAnalyzed,
        totalTransactions: data.totalTransactions,
        isAnalyzing: data.isAnalyzing,
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
            `Failed to check analysis status: ${errorMessage}`,
            { error: errorStack }
          )
        ],
        [
          this.createRecommendation(
            'critical',
            'Debug analysis monitor agent',
            'Agent failed to execute properly',
            '1 hour'
          )
        ]
      )
    }
  }
}
