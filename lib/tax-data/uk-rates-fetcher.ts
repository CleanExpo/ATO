/**
 * UK Tax Rates Fetcher
 *
 * Fetches current UK tax rates from gov.uk (HMRC).
 * Uses Brave Search to find pages, Jina AI to scrape content,
 * and caches results in Supabase with 24h TTL.
 *
 * Fallback rates are hardcoded for when API is unavailable.
 *
 * Legislative references:
 * - Income Tax Act 2007
 * - Value Added Tax Act 1994
 * - Corporation Tax Act 2010
 * - Social Security Contributions and Benefits Act 1992
 * - Taxation of Chargeable Gains Act 1992
 */

import { createClient } from '@/lib/supabase/server'
import { getBraveClient } from '@/lib/search/brave-client'
import { getJinaScraper } from '@/lib/scraping/jina-scraper'
import { createLogger } from '@/lib/logger'
import type { TaxBracket } from '@/lib/types/jurisdiction'

const log = createLogger('tax-data:uk-rates-fetcher')

// ─── Types ───────────────────────────────────────────────────────────

export interface UKTaxRates {
  // VAT (Value Added Tax Act 1994)
  vatStandardRate: number
  vatReducedRate: number
  vatRegistrationThreshold: number

  // Income Tax (Income Tax Act 2007)
  personalAllowance: number
  incomeTaxBrackets: TaxBracket[]

  // Corporation Tax (Corporation Tax Act 2010)
  corporationTaxMainRate: number
  corporationTaxSmallProfitsRate: number
  corporationTaxUpperLimit: number
  corporationTaxLowerLimit: number

  // National Insurance (Social Security Contributions and Benefits Act 1992)
  niClass1PrimaryRate: number
  niClass1SecondaryRate: number
  niClass2WeeklyRate: number
  niClass4LowerRate: number
  niClass4UpperRate: number
  employmentAllowance: number

  // Capital Gains Tax (Taxation of Chargeable Gains Act 1992)
  cgtBasicRate: number
  cgtHigherRate: number
  cgtResidentialBasicRate: number
  cgtResidentialHigherRate: number
  cgtAnnualExemption: number

  // Metadata
  fetchedAt: string
  source: string
}

// ─── Fallback Rates (2024-25 Tax Year) ──────────────────────────────

const FALLBACK_UK_RATES: UKTaxRates = {
  // VAT rates
  vatStandardRate: 20,
  vatReducedRate: 5,
  vatRegistrationThreshold: 90_000,

  // Income tax
  personalAllowance: 12_570,
  incomeTaxBrackets: [
    { min: 0, max: 12_570, rate: 0, label: 'Personal Allowance' },
    { min: 12_571, max: 50_270, rate: 20, label: 'Basic rate' },
    { min: 50_271, max: 125_140, rate: 40, label: 'Higher rate' },
    { min: 125_141, max: null, rate: 45, label: 'Additional rate' },
  ],

  // Corporation tax
  corporationTaxMainRate: 25,
  corporationTaxSmallProfitsRate: 19,
  corporationTaxUpperLimit: 250_000,
  corporationTaxLowerLimit: 50_000,

  // National Insurance
  niClass1PrimaryRate: 8,
  niClass1SecondaryRate: 13.8,
  niClass2WeeklyRate: 3.45,
  niClass4LowerRate: 6,
  niClass4UpperRate: 2,
  employmentAllowance: 5_000,

  // Capital Gains Tax
  cgtBasicRate: 10,
  cgtHigherRate: 20,
  cgtResidentialBasicRate: 18,
  cgtResidentialHigherRate: 24,
  cgtAnnualExemption: 3_000,

  // Metadata
  fetchedAt: new Date().toISOString(),
  source: 'fallback-hardcoded-2024-25',
}

// ─── Cache Configuration ─────────────────────────────────────────────

const CACHE_KEY = 'uk_tax_rates'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// ─── Fetcher Implementation ──────────────────────────────────────────

/**
 * Attempt to scrape a specific rate from gov.uk using Brave Search + Jina AI.
 *
 * @param searchQuery - Brave Search query scoped to gov.uk
 * @param parser - Function to extract the rate from scraped markdown
 * @returns Parsed value or null on failure
 */
async function scrapeRate<T>(
  searchQuery: string,
  parser: (markdown: string) => T | null
): Promise<{ value: T; source: string } | null> {
  try {
    const brave = getBraveClient()
    const jina = getJinaScraper()

    const searchResults = await brave.search(searchQuery, {
      count: 3,
    })

    if (!searchResults.results || searchResults.results.length === 0) {
      log.warn('No Brave results for query', { query: searchQuery })
      return null
    }

    // Try each result until we get a successful parse
    for (const result of searchResults.results) {
      try {
        const scraped = await jina.scrape(result.url)
        if (!scraped?.markdown) continue

        const parsed = parser(scraped.markdown)
        if (parsed !== null) {
          return { value: parsed, source: result.url }
        }
      } catch (scrapeErr) {
        log.debug('Failed to scrape result', {
          url: result.url,
          error: scrapeErr instanceof Error ? scrapeErr.message : String(scrapeErr),
        })
        continue
      }
    }

    return null
  } catch (error) {
    log.error('scrapeRate failed', {
      query: searchQuery,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Parse a percentage value from scraped markdown content.
 * Looks for patterns like "20%", "20 per cent", "20 percent".
 */
function parsePercentage(content: string, keyword: string): number | null {
  // Look for pattern: keyword ... N% or keyword ... N per cent
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(
    `${escapedKeyword}[^\\d]{0,80}?(\\d+(?:\\.\\d+)?)\\s*(?:%|per\\s*cent|percent)`,
    'i'
  )
  const match = content.match(regex)
  if (match) {
    return parseFloat(match[1])
  }
  return null
}

/**
 * Parse a GBP currency value from scraped markdown content.
 * Looks for patterns like "GBP 12,570", "12,570", "12570".
 */
function parseCurrency(content: string, keyword: string): number | null {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(
    `${escapedKeyword}[^\\d]{0,80}?(?:\\u00a3|GBP\\s*)?([\\d,]+(?:\\.\\d{1,2})?)`,
    'i'
  )
  const match = content.match(regex)
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''))
  }
  return null
}

// ─── Cache Layer ─────────────────────────────────────────────────────

async function getCachedRates(): Promise<UKTaxRates | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('tax_rates_cache')
      .select('*')
      .eq('cache_key', CACHE_KEY)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null

    const createdAt = new Date(data.created_at).getTime()
    const age = Date.now() - createdAt

    if (age > CACHE_TTL_MS) {
      log.debug('UK tax rates cache expired', { ageMs: age })
      return null
    }

    log.info('UK tax rates cache hit', { ageMs: age })
    return data.rates as unknown as UKTaxRates
  } catch {
    return null
  }
}

async function setCachedRates(rates: UKTaxRates): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase
      .from('tax_rates_cache')
      .upsert({
        cache_key: CACHE_KEY,
        rates: rates as unknown as Record<string, unknown>,
        created_at: new Date().toISOString(),
      })
  } catch (error) {
    log.warn('Failed to cache UK tax rates', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

// ─── Main Fetcher ────────────────────────────────────────────────────

/**
 * Fetch current UK tax rates from gov.uk.
 *
 * Strategy:
 * 1. Check Supabase cache (24h TTL)
 * 2. If stale/missing, scrape gov.uk via Brave Search + Jina AI
 * 3. If scraping fails, fall back to hardcoded 2024-25 rates
 *
 * @param forceRefresh - Skip cache and fetch fresh rates
 * @returns Current UK tax rates
 */
export async function fetchUKTaxRates(forceRefresh?: boolean): Promise<UKTaxRates> {
  // Check cache first
  if (!forceRefresh) {
    const cached = await getCachedRates()
    if (cached) return cached
  }

  log.info('Fetching fresh UK tax rates from gov.uk')
  const startTime = Date.now()

  // Scrape rates in parallel
  const [
    vatResult,
    vatThresholdResult,
    personalAllowanceResult,
    corpTaxMainResult,
    corpTaxSmallResult,
    niClass1Result,
    niClass4Result,
    cgtBasicResult,
    cgtAnnualExemptionResult,
  ] = await Promise.allSettled([
    scrapeRate(
      'site:gov.uk UK VAT rates standard rate 2024',
      (md) => parsePercentage(md, 'standard rate')
    ),
    scrapeRate(
      'site:gov.uk VAT registration threshold 2024',
      (md) => parseCurrency(md, 'registration threshold')
    ),
    scrapeRate(
      'site:gov.uk income tax personal allowance 2024-25',
      (md) => parseCurrency(md, 'Personal Allowance')
    ),
    scrapeRate(
      'site:gov.uk corporation tax main rate 2024',
      (md) => parsePercentage(md, 'main rate')
    ),
    scrapeRate(
      'site:gov.uk corporation tax small profits rate 2024',
      (md) => parsePercentage(md, 'small profits rate')
    ),
    scrapeRate(
      'site:gov.uk national insurance rates employees 2024-25',
      (md) => parsePercentage(md, 'Class 1')
    ),
    scrapeRate(
      'site:gov.uk national insurance self-employed Class 4 2024-25',
      (md) => parsePercentage(md, 'Class 4')
    ),
    scrapeRate(
      'site:gov.uk capital gains tax rates 2024-25',
      (md) => parsePercentage(md, 'basic rate')
    ),
    scrapeRate(
      'site:gov.uk capital gains tax annual exempt amount 2024-25',
      (md) => parseCurrency(md, 'annual exempt')
    ),
  ])

  const duration = Date.now() - startTime
  log.info('UK tax rates scrape complete', { durationMs: duration })

  // Build rates object, falling back to hardcoded values for any that failed
  const sources: string[] = []

  function extractValue<T>(
    result: PromiseSettledResult<{ value: T; source: string } | null>,
    fallback: T
  ): T {
    if (result.status === 'fulfilled' && result.value !== null) {
      sources.push(result.value.source)
      return result.value.value
    }
    return fallback
  }

  const vatStdRate = extractValue(vatResult, FALLBACK_UK_RATES.vatStandardRate)
  const vatThreshold = extractValue(vatThresholdResult, FALLBACK_UK_RATES.vatRegistrationThreshold)
  const personalAllowance = extractValue(personalAllowanceResult, FALLBACK_UK_RATES.personalAllowance)
  const corpMainRate = extractValue(corpTaxMainResult, FALLBACK_UK_RATES.corporationTaxMainRate)
  const corpSmallRate = extractValue(corpTaxSmallResult, FALLBACK_UK_RATES.corporationTaxSmallProfitsRate)

  const rates: UKTaxRates = {
    vatStandardRate: vatStdRate,
    vatReducedRate: FALLBACK_UK_RATES.vatReducedRate, // Rarely changes
    vatRegistrationThreshold: vatThreshold,

    personalAllowance,
    incomeTaxBrackets: [
      { min: 0, max: personalAllowance, rate: 0, label: 'Personal Allowance' },
      { min: personalAllowance + 1, max: 50_270, rate: 20, label: 'Basic rate' },
      { min: 50_271, max: 125_140, rate: 40, label: 'Higher rate' },
      { min: 125_141, max: null, rate: 45, label: 'Additional rate' },
    ],

    corporationTaxMainRate: corpMainRate,
    corporationTaxSmallProfitsRate: corpSmallRate,
    corporationTaxUpperLimit: FALLBACK_UK_RATES.corporationTaxUpperLimit,
    corporationTaxLowerLimit: FALLBACK_UK_RATES.corporationTaxLowerLimit,

    niClass1PrimaryRate: extractValue(niClass1Result, FALLBACK_UK_RATES.niClass1PrimaryRate),
    niClass1SecondaryRate: FALLBACK_UK_RATES.niClass1SecondaryRate,
    niClass2WeeklyRate: FALLBACK_UK_RATES.niClass2WeeklyRate,
    niClass4LowerRate: extractValue(niClass4Result, FALLBACK_UK_RATES.niClass4LowerRate),
    niClass4UpperRate: FALLBACK_UK_RATES.niClass4UpperRate,
    employmentAllowance: FALLBACK_UK_RATES.employmentAllowance,

    cgtBasicRate: extractValue(cgtBasicResult, FALLBACK_UK_RATES.cgtBasicRate),
    cgtHigherRate: FALLBACK_UK_RATES.cgtHigherRate,
    cgtResidentialBasicRate: FALLBACK_UK_RATES.cgtResidentialBasicRate,
    cgtResidentialHigherRate: FALLBACK_UK_RATES.cgtResidentialHigherRate,
    cgtAnnualExemption: extractValue(cgtAnnualExemptionResult, FALLBACK_UK_RATES.cgtAnnualExemption),

    fetchedAt: new Date().toISOString(),
    source: sources.length > 0
      ? `gov.uk (${sources.length} rates scraped live)`
      : 'fallback-hardcoded-2024-25',
  }

  // Cache the rates
  await setCachedRates(rates)

  return rates
}

/**
 * Get the fallback UK tax rates (no network calls).
 * Useful for testing and offline scenarios.
 */
export function getFallbackUKRates(): UKTaxRates {
  return { ...FALLBACK_UK_RATES, fetchedAt: new Date().toISOString() }
}
