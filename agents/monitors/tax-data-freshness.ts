import { Agent, AgentReport } from '../types'

interface TaxRates {
  instantWriteoff?: number
  rndOffsetRate?: number
  homeOfficeRate?: number
  corporateTaxRate?: number
  lastUpdated?: Date
}

export class TaxDataFreshnessAgent extends Agent {
  // Hardcoded values from the codebase that we need to check
  private hardcodedValues: TaxRates = {
    instantWriteoff: 20000,      // From deduction-engine.ts
    rndOffsetRate: 0.435,        // From rnd-engine.ts (43.5%)
    homeOfficeRate: 0.67,        // From deduction-engine.ts (67c/hour)
    corporateTaxRate: 0.30       // From loss-engine.ts (30%)
  }

  constructor(tenantId: string) {
    super('tax-data-freshness', tenantId)
  }

  async execute(): Promise<AgentReport> {
    const startTime = Date.now()

    try {
      // Fetch current tax rates from ATO using Jina AI
      const currentRates = await this.fetchATORates()

      const findings = []
      const recommendations = []

      // Compare instant write-off threshold
      if (currentRates.instantWriteoff &&
          currentRates.instantWriteoff !== this.hardcodedValues.instantWriteoff) {
        findings.push(
          this.createFinding(
            'outdated-threshold',
            'high',
            `Instant asset write-off threshold is outdated`,
            {
              hardcodedValue: this.hardcodedValues.instantWriteoff,
              currentValue: currentRates.instantWriteoff,
              file: 'lib/analysis/deduction-engine.ts'
            }
          )
        )

        recommendations.push(
          this.createRecommendation(
            'high',
            `Update INSTANT_WRITEOFF_THRESHOLD to $${currentRates.instantWriteoff}`,
            'Outdated threshold will result in incorrect tax calculations',
            '30 minutes'
          )
        )
      }

      // Compare R&D offset rate
      if (currentRates.rndOffsetRate &&
          Math.abs(currentRates.rndOffsetRate - this.hardcodedValues.rndOffsetRate!) > 0.001) {
        findings.push(
          this.createFinding(
            'outdated-rnd-rate',
            'high',
            `R&D tax offset rate may be outdated`,
            {
              hardcodedValue: this.hardcodedValues.rndOffsetRate,
              currentValue: currentRates.rndOffsetRate,
              file: 'lib/analysis/rnd-engine.ts'
            }
          )
        )

        recommendations.push(
          this.createRecommendation(
            'high',
            `Update RND_OFFSET_RATE to ${(currentRates.rndOffsetRate * 100).toFixed(1)}%`,
            'Incorrect R&D offset rate affects benefit calculations',
            '30 minutes'
          )
        )
      }

      // Compare home office rate
      if (currentRates.homeOfficeRate &&
          Math.abs(currentRates.homeOfficeRate - this.hardcodedValues.homeOfficeRate!) > 0.01) {
        findings.push(
          this.createFinding(
            'outdated-home-office-rate',
            'medium',
            `Home office rate may be outdated`,
            {
              hardcodedValue: this.hardcodedValues.homeOfficeRate,
              currentValue: currentRates.homeOfficeRate,
              file: 'lib/analysis/deduction-engine.ts'
            }
          )
        )

        recommendations.push(
          this.createRecommendation(
            'medium',
            `Update HOME_OFFICE_RATE_PER_HOUR to $${currentRates.homeOfficeRate}`,
            'Outdated rate affects home office deduction calculations',
            '15 minutes'
          )
        )
      }

      // Recommend Brave Search integration if data couldn't be fetched
      if (!currentRates.instantWriteoff && !currentRates.rndOffsetRate) {
        findings.push(
          this.createFinding(
            'no-live-data',
            'medium',
            'Unable to fetch current ATO tax data',
            { attemptedSource: 'Jina AI + ato.gov.au' }
          )
        )

        recommendations.push(
          this.createRecommendation(
            'high',
            'Implement Brave Search API integration for tax data',
            'Automate tax rate updates to stay current',
            '4 hours'
          )
        )
      }

      // Check data age
      const dataAge = currentRates.lastUpdated
        ? Date.now() - currentRates.lastUpdated.getTime()
        : null

      if (dataAge && dataAge > 30 * 24 * 60 * 60 * 1000) {
        // >30 days old
        findings.push(
          this.createFinding(
            'stale-data',
            'medium',
            'Tax data is more than 30 days old',
            {
              lastUpdated: currentRates.lastUpdated,
              ageInDays: Math.floor(dataAge / (24 * 60 * 60 * 1000))
            }
          )
        )

        recommendations.push(
          this.createRecommendation(
            'medium',
            'Refresh tax data from ATO website',
            'Tax rates may have changed since last update',
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
        ratesChecked: Object.keys(this.hardcodedValues).length,
        outdatedCount: findings.filter(f => f.type.includes('outdated')).length,
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
            `Failed to check tax data freshness: ${errorMessage}`,
            { error: errorStack }
          )
        ],
        [
          this.createRecommendation(
            'critical',
            'Debug tax data freshness agent',
            'Agent failed to execute properly',
            '1 hour'
          )
        ]
      )
    }
  }

  private async fetchATORates(): Promise<TaxRates> {
    try {
      // Use Jina AI to scrape ATO website
      const response = await fetch(
        'https://r.jina.ai/https://www.ato.gov.au/business/depreciation-and-capital-expenses-and-allowances/simpler-depreciation-for-small-business/instant-asset-write-off',
        {
          headers: {
            'Authorization': 'Bearer jina_c016fb6c12c1444c98737d7e9f70966eNpogql_hauwHSi3Ta2KPptcvhXLc'
          }
        }
      )

      if (!response.ok) {
        console.warn(`Failed to fetch ATO data: ${response.status}`)
        return {}
      }

      const markdown = await response.text()

      // Parse markdown to extract rates
      const rates: TaxRates = {
        lastUpdated: new Date()
      }

      // Look for instant write-off threshold
      const writeoffMatch = markdown.match(/\$(\d{1,3}(?:,\d{3})*)/g)
      if (writeoffMatch) {
        // Find the highest value mentioned (likely the threshold)
        const amounts = writeoffMatch
          .map(m => parseInt(m.replace(/[$,]/g, '')))
          .filter(n => n > 1000) // Filter out small amounts

        if (amounts.length > 0) {
          rates.instantWriteoff = Math.max(...amounts)
        }
      }

      // Note: R&D and home office rates would need separate ATO pages
      // For now, we'll just check instant write-off

      return rates

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.warn(`Error fetching ATO rates:`, errorMessage)
      return {}
    }
  }
}
