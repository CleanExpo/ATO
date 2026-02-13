/**
 * Rate Stamp Utility
 *
 * Captures tax rate version metadata at analysis time.
 * Enables detection of stale analyses when ATO rates change.
 */

import { getCurrentTaxRates, type CachedTaxRates } from './cache-manager'
import { createLogger } from '@/lib/logger'

const log = createLogger('tax-data:rate-stamp')

export interface RateStamp {
  /** Source URL or label of the tax rates used */
  taxRateSource: string
  /** ISO timestamp of when this analysis verified the rates */
  taxRateVerifiedAt: string
  /** Rate version hash — changes when any rate value changes */
  taxRateVersion: string | null
  /** ISO timestamp of when rates were actually fetched from ATO (may be older than verifiedAt if cached) */
  taxRatesFetchedAt: string | null
}

/**
 * Create a rate stamp from the current cached rates.
 * Call this at analysis time to capture which rates were used.
 */
export async function createRateStamp(
  sourceOverride?: string
): Promise<RateStamp> {
  try {
    const rates = await getCurrentTaxRates()
    return {
      taxRateSource: sourceOverride || extractBestSource(rates) || 'ATO_CACHED',
      taxRateVerifiedAt: new Date().toISOString(),
      taxRateVersion: rates.rateVersion ?? null,
      taxRatesFetchedAt: rates.ratesFetchedAt ?? null,
    }
  } catch (err) {
    log.warn('Failed to create rate stamp — rates unavailable', err)
    return {
      taxRateSource: sourceOverride || 'ATO_FALLBACK',
      taxRateVerifiedAt: new Date().toISOString(),
      taxRateVersion: null,
      taxRatesFetchedAt: null,
    }
  }
}

/**
 * Check if an analysis was done with a different rate version than current.
 * Returns null if comparison not possible (missing version info).
 */
export async function isAnalysisStale(
  analysisRateVersion: string | null
): Promise<boolean | null> {
  if (!analysisRateVersion) return null

  try {
    const rates = await getCurrentTaxRates()
    if (!rates.rateVersion) return null
    return rates.rateVersion !== analysisRateVersion
  } catch {
    return null
  }
}

function extractBestSource(rates: CachedTaxRates): string | undefined {
  const sources = rates.sources
  // Return the first available source URL
  return sources.corporateTax
    || sources.instantWriteOff
    || sources.rndIncentive
    || sources.division7A
    || sources.fbt
    || sources.superGuarantee
}
