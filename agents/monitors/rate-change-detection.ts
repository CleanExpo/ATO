import { Agent, AgentReport } from '../types'

interface RateConfig {
  name: string
  category: string
  currentValue: number | string
  file: string
  lastKnownChangeDate?: string
  checkUrl?: string
}

/**
 * Rate Change Detection Monitor
 *
 * Monitors for changes to ATO tax rates, thresholds, and legislative
 * parameters that are hardcoded in the analysis engines. Checks cache
 * freshness and flags rates that may need updating based on known
 * annual change dates (1 July, 1 April for FBT).
 */
export class RateChangeDetectionAgent extends Agent {
  private trackedRates: RateConfig[] = [
    // CGT
    {
      name: 'CGT Discount Rate (Individual)',
      category: 'cgt',
      currentValue: 0.50,
      file: 'lib/analysis/cgt-engine.ts',
      lastKnownChangeDate: '1999-09-21'
    },
    // FBT
    {
      name: 'FBT Rate',
      category: 'fbt',
      currentValue: 0.47,
      file: 'lib/analysis/fbt-engine.ts',
      lastKnownChangeDate: '2024-04-01'
    },
    {
      name: 'Type 1 Gross-Up Rate',
      category: 'fbt',
      currentValue: 2.0802,
      file: 'lib/analysis/fbt-engine.ts',
      lastKnownChangeDate: '2024-04-01'
    },
    {
      name: 'Type 2 Gross-Up Rate',
      category: 'fbt',
      currentValue: 1.8868,
      file: 'lib/analysis/fbt-engine.ts',
      lastKnownChangeDate: '2024-04-01'
    },
    // Company Tax
    {
      name: 'Base Rate Entity Tax Rate',
      category: 'company',
      currentValue: 0.25,
      file: 'lib/analysis/loss-engine.ts',
      lastKnownChangeDate: '2021-07-01'
    },
    {
      name: 'Standard Company Tax Rate',
      category: 'company',
      currentValue: 0.30,
      file: 'lib/analysis/loss-engine.ts',
      lastKnownChangeDate: '2001-07-01'
    },
    // Superannuation
    {
      name: 'SG Rate',
      category: 'super',
      currentValue: 0.115,
      file: 'lib/analysis/superannuation-cap-analyzer.ts',
      lastKnownChangeDate: '2024-07-01'
    },
    {
      name: 'Concessional Contributions Cap',
      category: 'super',
      currentValue: 30000,
      file: 'lib/analysis/superannuation-cap-analyzer.ts',
      lastKnownChangeDate: '2024-07-01'
    },
    {
      name: 'Non-Concessional Contributions Cap',
      category: 'super',
      currentValue: 120000,
      file: 'lib/analysis/superannuation-cap-analyzer.ts',
      lastKnownChangeDate: '2024-07-01'
    },
    // Deductions
    {
      name: 'Instant Asset Write-Off Threshold',
      category: 'deductions',
      currentValue: 20000,
      file: 'lib/analysis/deduction-engine.ts',
      lastKnownChangeDate: '2024-07-01'
    },
    {
      name: 'Home Office Rate (per hour)',
      category: 'deductions',
      currentValue: 0.67,
      file: 'lib/analysis/deduction-engine.ts',
      lastKnownChangeDate: '2022-07-01'
    },
    // R&D
    {
      name: 'R&D Tax Offset Rate (<$20M turnover)',
      category: 'rnd',
      currentValue: 0.435,
      file: 'lib/analysis/rnd-engine.ts',
      lastKnownChangeDate: '2021-07-01'
    },
    // Div 7A
    {
      name: 'Div 7A Benchmark Interest Rate',
      category: 'div7a',
      currentValue: '8.27%',
      file: 'lib/analysis/div7a-engine.ts',
      lastKnownChangeDate: '2024-07-01'
    },
    // PAYG
    {
      name: 'GIC Base Rate Component',
      category: 'payg',
      currentValue: '7%',
      file: 'lib/analysis/payg-instalment-engine.ts'
    },
    // Payroll Tax — VIC
    {
      name: 'VIC Payroll Tax Rate',
      category: 'payroll',
      currentValue: 0.0485,
      file: 'lib/analysis/payroll-tax-engine.ts',
      lastKnownChangeDate: '2024-07-01'
    },
    // Payroll Tax — NSW
    {
      name: 'NSW Payroll Tax Rate',
      category: 'payroll',
      currentValue: 0.0545,
      file: 'lib/analysis/payroll-tax-engine.ts',
      lastKnownChangeDate: '2024-07-01'
    },
  ]

  constructor(tenantId: string) {
    super('rate-change-detection', tenantId)
  }

  async execute(): Promise<AgentReport> {
    const startTime = Date.now()

    try {
      const now = new Date()
      const findings = []
      const recommendations = []

      // Check 1: Rates near known annual change dates
      const ratesNearChangeDate = this.checkAnnualChangeDates(now)
      if (ratesNearChangeDate.length > 0) {
        for (const rate of ratesNearChangeDate) {
          findings.push(
            this.createFinding(
              'rate-change-window',
              'high',
              `${rate.name} may have changed — annual change date approaching or passed`,
              {
                rate: rate.name,
                currentValue: rate.currentValue,
                file: rate.file,
                lastKnownChangeDate: rate.lastKnownChangeDate,
                category: rate.category
              }
            )
          )
        }

        recommendations.push(
          this.createRecommendation(
            'high',
            `Verify ${ratesNearChangeDate.length} rate(s) against current ATO publications`,
            'Annual rate changes typically take effect 1 July (or 1 April for FBT)',
            '2 hours'
          )
        )
      }

      // Check 2: Stale rates (last known change > 18 months ago)
      const staleRates = this.checkStaleRates(now)
      if (staleRates.length > 0) {
        findings.push(
          this.createFinding(
            'stale-rates',
            'medium',
            `${staleRates.length} rate(s) have not been verified in over 18 months`,
            {
              staleRates: staleRates.map(r => ({
                name: r.name,
                lastKnownChangeDate: r.lastKnownChangeDate,
                file: r.file
              }))
            }
          )
        )

        recommendations.push(
          this.createRecommendation(
            'medium',
            'Schedule bulk rate verification against ATO website',
            'Rates should be verified at least annually to ensure accuracy',
            '4 hours'
          )
        )
      }

      // Check 3: Cache freshness — check if rate_stamps table has recent entries
      const cacheFreshness = await this.checkCacheFreshness()
      if (!cacheFreshness.fresh) {
        findings.push(
          this.createFinding(
            'stale-cache',
            cacheFreshness.ageInDays > 30 ? 'high' : 'medium',
            `Rate cache is ${cacheFreshness.ageInDays} day(s) old`,
            {
              lastCacheUpdate: cacheFreshness.lastUpdate,
              ageInDays: cacheFreshness.ageInDays
            }
          )
        )

        recommendations.push(
          this.createRecommendation(
            cacheFreshness.ageInDays > 30 ? 'high' : 'medium',
            'Refresh rate cache from ATO sources',
            'Stale cache may contain outdated rates',
            '1 hour'
          )
        )
      }

      // Check 4: FY rollover check (July 1)
      if (this.isNearFYRollover(now)) {
        findings.push(
          this.createFinding(
            'fy-rollover',
            'high',
            'New financial year approaching — many rates change on 1 July',
            {
              currentDate: now.toISOString(),
              nextFYStart: this.getNextFYStart(now).toISOString(),
              categoriesAffected: ['super', 'company', 'deductions', 'payroll', 'div7a']
            }
          )
        )

        recommendations.push(
          this.createRecommendation(
            'high',
            'Prepare FY rollover rate update checklist',
            'SG rate, contribution caps, payroll tax thresholds, and Div 7A rate typically change 1 July',
            '1 day'
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
        dataPointsAnalyzed: this.trackedRates.length,
        ratesNearChangeDate: ratesNearChangeDate.length,
        staleRates: staleRates.length,
        cacheFresh: cacheFreshness.fresh,
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
            `Failed to check rate changes: ${errorMessage}`,
            { error: errorStack }
          )
        ],
        [
          this.createRecommendation(
            'critical',
            'Debug rate change detection monitor',
            'Monitor agent failed to execute properly',
            '1 hour'
          )
        ]
      )
    }
  }

  /**
   * Check for rates whose annual change date is within 30 days
   */
  private checkAnnualChangeDates(now: Date): RateConfig[] {
    const flagged: RateConfig[] = []

    for (const rate of this.trackedRates) {
      if (!rate.lastKnownChangeDate) continue

      const changeDate = new Date(rate.lastKnownChangeDate)
      const changeMonth = changeDate.getMonth()
      const changeDay = changeDate.getDate()

      // Build this year's change date
      const thisYearChange = new Date(now.getFullYear(), changeMonth, changeDay)

      const daysUntil = Math.floor(
        (thisYearChange.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      )

      // Flag if within 30 days before or 14 days after the annual change date
      if (daysUntil >= -14 && daysUntil <= 30) {
        flagged.push(rate)
      }
    }

    return flagged
  }

  /**
   * Find rates not verified in over 18 months
   */
  private checkStaleRates(now: Date): RateConfig[] {
    const eighteenMonthsMs = 18 * 30 * 24 * 60 * 60 * 1000

    return this.trackedRates.filter(rate => {
      if (!rate.lastKnownChangeDate) return true // Unknown = stale
      const changeDate = new Date(rate.lastKnownChangeDate)
      return (now.getTime() - changeDate.getTime()) > eighteenMonthsMs
    })
  }

  /**
   * Check if rate_stamps cache has been updated recently
   */
  private async checkCacheFreshness(): Promise<{
    fresh: boolean
    ageInDays: number
    lastUpdate?: string
  }> {
    try {
      const response = await fetch(
        `http://localhost:3000/api/analysis/rate-stamps/latest`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      )

      if (!response.ok) {
        return { fresh: false, ageInDays: 999 }
      }

      const data = await response.json()
      const lastUpdate = data.lastUpdate ? new Date(data.lastUpdate) : null

      if (!lastUpdate) {
        return { fresh: false, ageInDays: 999 }
      }

      const ageInDays = Math.floor(
        (Date.now() - lastUpdate.getTime()) / (24 * 60 * 60 * 1000)
      )

      return {
        fresh: ageInDays <= 7,
        ageInDays,
        lastUpdate: lastUpdate.toISOString()
      }

    } catch {
      // API not reachable — treat as stale
      return { fresh: false, ageInDays: 999 }
    }
  }

  /**
   * Check if we're within 30 days of the FY boundary (1 July)
   */
  private isNearFYRollover(now: Date): boolean {
    const year = now.getFullYear()
    const julyFirst = new Date(year, 6, 1) // 1 July this year

    const daysUntil = Math.floor(
      (julyFirst.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    )

    // Flag 30 days before and 7 days after
    return daysUntil >= -7 && daysUntil <= 30
  }

  private getNextFYStart(now: Date): Date {
    const year = now.getFullYear()
    const julyFirst = new Date(year, 6, 1)
    return now >= julyFirst ? new Date(year + 1, 6, 1) : julyFirst
  }
}
