import { Agent, AgentReport } from '../types'

interface Deadline {
  name: string
  date: Date
  obligation: string
  frequency: 'monthly' | 'quarterly' | 'annually'
  entity_types: string[]
}

/**
 * Compliance Calendar Monitor
 *
 * Tracks key ATO compliance deadlines and alerts when obligations
 * are due within 7 or 14 days or are overdue. Covers BAS, PAYG,
 * superannuation guarantee, FBT, and income tax lodgement dates.
 */
export class ComplianceCalendarAgent extends Agent {
  constructor(tenantId: string) {
    super('compliance-calendar', tenantId)
  }

  async execute(): Promise<AgentReport> {
    const startTime = Date.now()

    try {
      const now = new Date()
      const deadlines = this.getUpcomingDeadlines(now)

      const findings = []
      const recommendations = []

      const overdue: Deadline[] = []
      const dueSoon7: Deadline[] = []
      const dueSoon14: Deadline[] = []

      for (const deadline of deadlines) {
        const daysUntil = this.daysUntil(now, deadline.date)

        if (daysUntil < 0) {
          overdue.push(deadline)
        } else if (daysUntil <= 7) {
          dueSoon7.push(deadline)
        } else if (daysUntil <= 14) {
          dueSoon14.push(deadline)
        }
      }

      // Check 1: Overdue obligations
      if (overdue.length > 0) {
        for (const deadline of overdue) {
          const daysLate = Math.abs(this.daysUntil(now, deadline.date))
          findings.push(
            this.createFinding(
              'overdue-obligation',
              daysLate > 14 ? 'critical' : 'high',
              `${deadline.name} was due ${daysLate} day(s) ago (${this.formatDate(deadline.date)})`,
              {
                obligation: deadline.obligation,
                dueDate: deadline.date.toISOString(),
                daysLate,
                frequency: deadline.frequency
              }
            )
          )
        }

        recommendations.push(
          this.createRecommendation(
            'critical',
            `Lodge ${overdue.length} overdue obligation(s) immediately`,
            'Late lodgement attracts failure-to-lodge (FTL) penalties and general interest charge (GIC)',
            '1 day'
          )
        )
      }

      // Check 2: Due within 7 days
      if (dueSoon7.length > 0) {
        for (const deadline of dueSoon7) {
          const daysLeft = this.daysUntil(now, deadline.date)
          findings.push(
            this.createFinding(
              'deadline-imminent',
              'high',
              `${deadline.name} due in ${daysLeft} day(s) (${this.formatDate(deadline.date)})`,
              {
                obligation: deadline.obligation,
                dueDate: deadline.date.toISOString(),
                daysUntil: daysLeft,
                frequency: deadline.frequency
              }
            )
          )
        }

        recommendations.push(
          this.createRecommendation(
            'high',
            `Prepare ${dueSoon7.length} obligation(s) due within 7 days`,
            'Imminent deadlines require immediate attention to avoid penalties',
            '2 days'
          )
        )
      }

      // Check 3: Due within 14 days
      if (dueSoon14.length > 0) {
        for (const deadline of dueSoon14) {
          const daysLeft = this.daysUntil(now, deadline.date)
          findings.push(
            this.createFinding(
              'deadline-approaching',
              'medium',
              `${deadline.name} due in ${daysLeft} day(s) (${this.formatDate(deadline.date)})`,
              {
                obligation: deadline.obligation,
                dueDate: deadline.date.toISOString(),
                daysUntil: daysLeft,
                frequency: deadline.frequency
              }
            )
          )
        }

        recommendations.push(
          this.createRecommendation(
            'medium',
            `Plan for ${dueSoon14.length} obligation(s) due within 14 days`,
            'Upcoming deadlines should be scheduled for preparation',
            '1 week'
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
        dataPointsAnalyzed: deadlines.length,
        overdueCount: overdue.length,
        dueSoon7Count: dueSoon7.length,
        dueSoon14Count: dueSoon14.length,
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
            `Failed to check compliance calendar: ${errorMessage}`,
            { error: errorStack }
          )
        ],
        [
          this.createRecommendation(
            'critical',
            'Debug compliance calendar monitor',
            'Monitor agent failed to execute properly',
            '1 hour'
          )
        ]
      )
    }
  }

  /**
   * Generate upcoming ATO deadlines for the current financial year.
   * Australian FY runs 1 July to 30 June.
   */
  private getUpcomingDeadlines(now: Date): Deadline[] {
    const year = now.getFullYear()
    const month = now.getMonth() // 0-indexed

    // Determine current FY: if Jul-Dec use year/year+1, else year-1/year
    const fyStart = month >= 6 ? year : year - 1
    const fyEnd = fyStart + 1

    const deadlines: Deadline[] = [
      // BAS — Quarterly lodgement (28th of month following quarter end)
      {
        name: 'Q1 BAS (Jul-Sep)',
        date: new Date(fyStart, 9, 28), // 28 Oct
        obligation: 'Business Activity Statement',
        frequency: 'quarterly',
        entity_types: ['company', 'trust', 'partnership', 'sole_trader']
      },
      {
        name: 'Q2 BAS (Oct-Dec)',
        date: new Date(fyStart, 1, 28) > new Date(fyStart, 11, 31)
          ? new Date(fyEnd, 1, 28) // 28 Feb next year
          : new Date(fyEnd, 1, 28),
        obligation: 'Business Activity Statement',
        frequency: 'quarterly',
        entity_types: ['company', 'trust', 'partnership', 'sole_trader']
      },
      {
        name: 'Q3 BAS (Jan-Mar)',
        date: new Date(fyEnd, 3, 28), // 28 Apr
        obligation: 'Business Activity Statement',
        frequency: 'quarterly',
        entity_types: ['company', 'trust', 'partnership', 'sole_trader']
      },
      {
        name: 'Q4 BAS (Apr-Jun)',
        date: new Date(fyEnd, 7, 28), // 28 Aug
        obligation: 'Business Activity Statement',
        frequency: 'quarterly',
        entity_types: ['company', 'trust', 'partnership', 'sole_trader']
      },

      // Superannuation Guarantee — 28 days after quarter end
      {
        name: 'Q1 Super Guarantee (Jul-Sep)',
        date: new Date(fyStart, 9, 28), // 28 Oct
        obligation: 'Superannuation Guarantee',
        frequency: 'quarterly',
        entity_types: ['company', 'trust', 'partnership', 'sole_trader']
      },
      {
        name: 'Q2 Super Guarantee (Oct-Dec)',
        date: new Date(fyEnd, 0, 28), // 28 Jan
        obligation: 'Superannuation Guarantee',
        frequency: 'quarterly',
        entity_types: ['company', 'trust', 'partnership', 'sole_trader']
      },
      {
        name: 'Q3 Super Guarantee (Jan-Mar)',
        date: new Date(fyEnd, 3, 28), // 28 Apr
        obligation: 'Superannuation Guarantee',
        frequency: 'quarterly',
        entity_types: ['company', 'trust', 'partnership', 'sole_trader']
      },
      {
        name: 'Q4 Super Guarantee (Apr-Jun)',
        date: new Date(fyEnd, 6, 28), // 28 Jul
        obligation: 'Superannuation Guarantee',
        frequency: 'quarterly',
        entity_types: ['company', 'trust', 'partnership', 'sole_trader']
      },

      // FBT — Annual return due 21 May (FBT year is Apr-Mar)
      {
        name: 'FBT Return',
        date: new Date(fyEnd, 4, 21), // 21 May
        obligation: 'Fringe Benefits Tax Return',
        frequency: 'annually',
        entity_types: ['company', 'trust']
      },

      // Income Tax — Company return due 28 Feb (for non-tax-agent lodged)
      {
        name: 'Company Income Tax Return',
        date: new Date(fyEnd, 1, 28), // 28 Feb
        obligation: 'Income Tax Return (Company)',
        frequency: 'annually',
        entity_types: ['company']
      },

      // Individual tax return — 31 Oct (self-lodged)
      {
        name: 'Individual Income Tax Return',
        date: new Date(fyStart, 9, 31), // 31 Oct
        obligation: 'Income Tax Return (Individual)',
        frequency: 'annually',
        entity_types: ['individual', 'sole_trader']
      },

      // Trust/Partnership tax return — 28 Feb (for non-tax-agent lodged)
      {
        name: 'Trust/Partnership Income Tax Return',
        date: new Date(fyEnd, 1, 28), // 28 Feb
        obligation: 'Income Tax Return (Trust/Partnership)',
        frequency: 'annually',
        entity_types: ['trust', 'partnership']
      },

      // PAYG Instalment — same dates as BAS quarters
      {
        name: 'Q1 PAYG Instalment',
        date: new Date(fyStart, 9, 28), // 28 Oct
        obligation: 'PAYG Instalment',
        frequency: 'quarterly',
        entity_types: ['company', 'trust', 'individual']
      },
      {
        name: 'Q2 PAYG Instalment',
        date: new Date(fyEnd, 1, 28), // 28 Feb
        obligation: 'PAYG Instalment',
        frequency: 'quarterly',
        entity_types: ['company', 'trust', 'individual']
      },
      {
        name: 'Q3 PAYG Instalment',
        date: new Date(fyEnd, 3, 28), // 28 Apr
        obligation: 'PAYG Instalment',
        frequency: 'quarterly',
        entity_types: ['company', 'trust', 'individual']
      },
      {
        name: 'Q4 PAYG Instalment',
        date: new Date(fyEnd, 6, 28), // 28 Jul (with final BAS)
        obligation: 'PAYG Instalment',
        frequency: 'quarterly',
        entity_types: ['company', 'trust', 'individual']
      },
    ]

    // Return deadlines within a 60-day window (past 30 to future 30)
    const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const windowEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    return deadlines.filter(d => d.date >= windowStart && d.date <= windowEnd)
  }

  private daysUntil(from: Date, to: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000
    return Math.floor((to.getTime() - from.getTime()) / msPerDay)
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }
}
