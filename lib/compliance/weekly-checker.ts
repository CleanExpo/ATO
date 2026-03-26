/**
 * Weekly Compliance Checker
 *
 * Orchestrates the weekly compliance check across all jurisdictions (AU, NZ, UK).
 * Called by the /api/compliance/cron endpoint every Monday at 3:00 AM UTC.
 *
 * For each jurisdiction:
 * 1. Fetch current tax rates from authority websites
 * 2. Compare against cached rates — detect changes
 * 3. Update compliance calendar with upcoming deadlines
 * 4. Send notifications for rate changes and upcoming deadlines
 */

import { getSupportedJurisdictions } from '@/lib/types/jurisdiction'
import type { Jurisdiction, RateChangeEvent, ComplianceDeadline } from '@/lib/types/jurisdiction'
import { detectRateChanges } from './rate-change-detector'
import { updateComplianceCalendar, getUpcomingDeadlines } from './calendar-updater'
import { createLogger } from '@/lib/logger'

const log = createLogger('compliance:weekly-checker')

export interface WeeklyCheckResult {
  jurisdiction: Jurisdiction
  rateChangesDetected: RateChangeEvent[]
  upcomingDeadlines: ComplianceDeadline[]
  calendarUpdated: boolean
  error?: string
}

export interface WeeklyCheckSummary {
  startedAt: string
  completedAt: string
  jurisdictions: WeeklyCheckResult[]
  totalRateChanges: number
  totalUpcomingDeadlines: number
  errors: string[]
}

/**
 * Run weekly compliance check across all supported jurisdictions.
 * Uses Promise.allSettled for fault isolation — one jurisdiction's
 * failure does not block the others.
 */
export async function runWeeklyComplianceCheck(): Promise<WeeklyCheckSummary> {
  const startedAt = new Date().toISOString()
  const jurisdictions = getSupportedJurisdictions()
  const errors: string[] = []

  log.info(`Starting weekly compliance check for ${jurisdictions.length} jurisdictions`)

  // Run all jurisdiction checks in parallel with fault isolation
  const results = await Promise.allSettled(
    jurisdictions.map((j) => checkJurisdiction(j))
  )

  const jurisdictionResults: WeeklyCheckResult[] = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    }

    const jurisdiction = jurisdictions[index]
    const errorMsg = `${jurisdiction} check failed: ${result.reason}`
    errors.push(errorMsg)
    log.error(errorMsg)

    return {
      jurisdiction,
      rateChangesDetected: [],
      upcomingDeadlines: [],
      calendarUpdated: false,
      error: String(result.reason),
    }
  })

  const summary: WeeklyCheckSummary = {
    startedAt,
    completedAt: new Date().toISOString(),
    jurisdictions: jurisdictionResults,
    totalRateChanges: jurisdictionResults.reduce(
      (sum, r) => sum + r.rateChangesDetected.length,
      0
    ),
    totalUpcomingDeadlines: jurisdictionResults.reduce(
      (sum, r) => sum + r.upcomingDeadlines.length,
      0
    ),
    errors,
  }

  log.info(
    `Weekly compliance check complete: ` +
    `${summary.totalRateChanges} rate changes, ` +
    `${summary.totalUpcomingDeadlines} upcoming deadlines, ` +
    `${summary.errors.length} errors`
  )

  return summary
}

/**
 * Check a single jurisdiction for rate changes and upcoming deadlines.
 */
async function checkJurisdiction(
  jurisdiction: Jurisdiction
): Promise<WeeklyCheckResult> {
  log.info(`Checking ${jurisdiction} compliance...`)

  // Step 1: Fetch current rates and detect changes
  let rateChanges: RateChangeEvent[] = []
  try {
    const currentRates = await fetchCurrentRatesForJurisdiction(jurisdiction)
    if (currentRates.size > 0) {
      rateChanges = await detectRateChanges(jurisdiction, currentRates)
    }
  } catch (err) {
    log.warn(`Rate fetch failed for ${jurisdiction}: ${String(err)}`)
  }

  // Step 2: Update compliance calendar
  let calendarUpdated = false
  try {
    await updateComplianceCalendar(jurisdiction)
    calendarUpdated = true
  } catch (err) {
    log.warn(`Calendar update failed for ${jurisdiction}: ${String(err)}`)
  }

  // Step 3: Get upcoming deadlines (next 30 days)
  const upcomingDeadlines = await getUpcomingDeadlines(jurisdiction, 30)

  return {
    jurisdiction,
    rateChangesDetected: rateChanges,
    upcomingDeadlines,
    calendarUpdated,
  }
}

/**
 * Fetch current rates for a jurisdiction.
 * Returns a Map of 'rate_type:rate_key' → numeric value.
 *
 * Dynamically imports the appropriate rate fetcher to avoid
 * loading all fetchers when only one jurisdiction is needed.
 */
async function fetchCurrentRatesForJurisdiction(
  jurisdiction: Jurisdiction
): Promise<Map<string, number>> {
  const rates = new Map<string, number>()

  try {
    switch (jurisdiction) {
      case 'AU': {
        // AU rates are fetched by existing lib/tax-data/rates-fetcher.ts
        // Import dynamically to avoid circular dependencies
        const { getCurrentTaxRates } = await import('@/lib/tax-data/cache-manager')
        const auRates = await getCurrentTaxRates()
        if (auRates) {
          for (const [key, value] of Object.entries(auRates)) {
            if (typeof value === 'number') {
              rates.set(`au_rate:${key}`, value)
            }
          }
        }
        break
      }

      case 'NZ': {
        try {
          const { fetchNZTaxRates } = await import('@/lib/tax-data/nz-rates-fetcher')
          const nzRates = await fetchNZTaxRates(true)
          rates.set('gst:standard_rate', nzRates.gstRate)
          rates.set('kiwisaver:employer_min', nzRates.kiwiSaverEmployerMin)
          rates.set('acc:earner_levy', nzRates.accEarnerLevy)
          rates.set('provisional_tax:threshold', nzRates.provisionalTaxThreshold)
          for (const bracket of nzRates.incomeTaxBrackets) {
            rates.set(`income_tax:bracket_${bracket.min}`, bracket.rate)
          }
        } catch {
          log.warn('NZ rate fetcher not yet available — using fallbacks')
        }
        break
      }

      case 'UK': {
        try {
          const { fetchUKTaxRates } = await import('@/lib/tax-data/uk-rates-fetcher')
          const ukRates = await fetchUKTaxRates(true)
          rates.set('vat:standard_rate', ukRates.vatStandardRate)
          rates.set('vat:reduced_rate', ukRates.vatReducedRate)
          rates.set('vat:registration_threshold', ukRates.vatRegistrationThreshold)
          rates.set('corporation_tax:main_rate', ukRates.corporationTaxMainRate)
          rates.set('corporation_tax:small_profits_rate', ukRates.corporationTaxSmallProfitsRate)
          rates.set('income_tax:personal_allowance', ukRates.personalAllowance)
          rates.set('ni:class1_primary', ukRates.niClass1PrimaryRate)
          rates.set('ni:class1_secondary', ukRates.niClass1SecondaryRate)
          rates.set('ni:employment_allowance', ukRates.employmentAllowance)
        } catch {
          log.warn('UK rate fetcher not yet available — using fallbacks')
        }
        break
      }
    }
  } catch (err) {
    log.error(`Failed to fetch rates for ${jurisdiction}: ${String(err)}`)
  }

  return rates
}
