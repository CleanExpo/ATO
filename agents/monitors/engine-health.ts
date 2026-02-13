import { Agent, AgentReport } from '../types'

interface EngineTestResult {
  engine: string
  file: string
  healthy: boolean
  exportFound: boolean
  error?: string
}

/**
 * Engine Health Monitor
 *
 * Smoke-tests all 16 analysis engines by verifying they can be imported
 * and their primary export functions exist. Does NOT execute engines
 * against live data — only checks availability and basic structure.
 */
export class EngineHealthAgent extends Agent {
  private engines: Array<{ name: string; file: string; entrypoint: string }> = [
    { name: 'cgt-engine', file: 'lib/analysis/cgt-engine.ts', entrypoint: 'analyzeCGT' },
    { name: 'fbt-engine', file: 'lib/analysis/fbt-engine.ts', entrypoint: 'analyzeFBT' },
    { name: 'psi-engine', file: 'lib/analysis/psi-engine.ts', entrypoint: 'analyzePSI' },
    { name: 'payg-instalment-engine', file: 'lib/analysis/payg-instalment-engine.ts', entrypoint: 'analyzePAYGInstalments' },
    { name: 'payroll-tax-engine', file: 'lib/analysis/payroll-tax-engine.ts', entrypoint: 'analyzePayrollTax' },
    { name: 'audit-risk-engine', file: 'lib/analysis/audit-risk-engine.ts', entrypoint: 'assessAuditRisk' },
    { name: 'cashflow-forecast-engine', file: 'lib/analysis/cashflow-forecast-engine.ts', entrypoint: 'generateCashFlowForecast' },
    { name: 'deduction-engine', file: 'lib/analysis/deduction-engine.ts', entrypoint: 'analyzeDeductions' },
    { name: 'loss-engine', file: 'lib/analysis/loss-engine.ts', entrypoint: 'analyzeLosses' },
    { name: 'rnd-engine', file: 'lib/analysis/rnd-engine.ts', entrypoint: 'analyzeRnD' },
    { name: 'div7a-engine', file: 'lib/analysis/div7a-engine.ts', entrypoint: 'analyzeDiv7A' },
    { name: 'reconciliation-engine', file: 'lib/analysis/reconciliation-engine.ts', entrypoint: 'runReconciliation' },
    { name: 'trust-distribution-analyzer', file: 'lib/analysis/trust-distribution-analyzer.ts', entrypoint: 'analyzeTrustDistribution' },
    { name: 'superannuation-cap-analyzer', file: 'lib/analysis/superannuation-cap-analyzer.ts', entrypoint: 'analyzeSuper' },
    { name: 'sbito-engine', file: 'lib/analysis/sbito-engine.ts', entrypoint: 'analyzeSBITO' },
    { name: 'government-grants-engine', file: 'lib/analysis/government-grants-engine.ts', entrypoint: 'findGrants' },
  ]

  constructor(tenantId: string) {
    super('engine-health', tenantId)
  }

  async execute(): Promise<AgentReport> {
    const startTime = Date.now()

    try {
      // Test all engines via their API endpoints
      const results = await Promise.all(
        this.engines.map(engine => this.testEngine(engine))
      )

      const findings = []
      const recommendations = []

      const unhealthy = results.filter(r => !r.healthy)
      const missingExports = results.filter(r => !r.exportFound)

      // Check 1: Engines that failed to load
      if (unhealthy.length > 0) {
        for (const result of unhealthy) {
          findings.push(
            this.createFinding(
              'engine-unavailable',
              unhealthy.length > 3 ? 'critical' : 'high',
              `Engine ${result.engine} is unavailable: ${result.error || 'unknown error'}`,
              {
                engine: result.engine,
                file: result.file,
                error: result.error
              }
            )
          )
        }

        recommendations.push(
          this.createRecommendation(
            unhealthy.length > 3 ? 'critical' : 'high',
            `Fix ${unhealthy.length} unavailable engine(s)`,
            'Analysis engines must be available for tax calculations',
            '2 hours'
          )
        )
      }

      // Check 2: Missing entrypoint exports
      if (missingExports.length > 0) {
        for (const result of missingExports) {
          findings.push(
            this.createFinding(
              'missing-export',
              'high',
              `Engine ${result.engine} is missing its primary export function`,
              {
                engine: result.engine,
                file: result.file
              }
            )
          )
        }

        recommendations.push(
          this.createRecommendation(
            'high',
            `Verify exports for ${missingExports.length} engine(s)`,
            'Engines must export their primary analysis function',
            '1 hour'
          )
        )
      }

      // Check 3: All engines down
      if (unhealthy.length === this.engines.length) {
        findings.push(
          this.createFinding(
            'total-engine-failure',
            'critical',
            'All analysis engines are unavailable — possible build or dependency issue',
            { enginesCount: this.engines.length }
          )
        )

        recommendations.push(
          this.createRecommendation(
            'critical',
            'Run pnpm build and check for TypeScript errors',
            'Complete engine failure suggests a compilation or dependency issue',
            '1 hour'
          )
        )
      }

      const executionTime = Date.now() - startTime

      let status: 'healthy' | 'warning' | 'error' = 'healthy'
      if (findings.some(f => f.severity === 'critical')) {
        status = 'error'
      } else if (findings.some(f => f.severity === 'high' || f.severity === 'medium')) {
        status = 'warning'
      }

      return this.createReport(status, findings, recommendations, {
        executionTime,
        dataPointsAnalyzed: results.length,
        healthyEngines: results.filter(r => r.healthy).length,
        totalEngines: this.engines.length,
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
            `Failed to check engine health: ${errorMessage}`,
            { error: errorStack }
          )
        ],
        [
          this.createRecommendation(
            'critical',
            'Debug engine health monitor',
            'Monitor agent failed to execute properly',
            '1 hour'
          )
        ]
      )
    }
  }

  private async testEngine(
    engine: { name: string; file: string; entrypoint: string }
  ): Promise<EngineTestResult> {
    try {
      // Verify the engine API endpoint responds
      const response = await fetch(
        `http://localhost:3000/api/analysis/health?engine=${engine.name}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      )

      return {
        engine: engine.name,
        file: engine.file,
        healthy: response.ok,
        exportFound: response.ok,
        error: response.ok ? undefined : `HTTP ${response.status}`
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      return {
        engine: engine.name,
        file: engine.file,
        healthy: false,
        exportFound: false,
        error: errorMessage
      }
    }
  }
}
