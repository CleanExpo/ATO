/**
 * NZ Tax Rates Fetcher
 *
 * Fetches current New Zealand tax rates from ird.govt.nz
 * Uses Brave Search to find pages, Jina AI to scrape content,
 * and Supabase for 24h cache with TTL.
 *
 * Key Legislation:
 * - Income Tax Act 2007 (NZ)
 * - Goods and Services Tax Act 1985 (NZ)
 * - KiwiSaver Act 2006
 * - Tax Administration Act 1994 (NZ)
 */

import { createClient } from '@/lib/supabase/server'
import { getBraveClient } from '@/lib/search/brave-client'
import { getJinaScraper } from '@/lib/scraping/jina-scraper'
import { createLogger } from '@/lib/logger'
import type { TaxBracket } from '@/lib/types/jurisdiction'

const log = createLogger('tax-data:nz-rates-fetcher')

// ─── Cache Configuration ──────────────────────────────────────────────

const CACHE_KEY = 'nz_tax_rates'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// ─── Types ────────────────────────────────────────────────────────────

export interface NZTaxRates {
  /** GST standard rate (15%) */
  gstRate: number
  /** Progressive income tax brackets */
  incomeTaxBrackets: TaxBracket[]
  /** Independent Earner Tax Credit weekly amount ($10/week) */
  ietcWeeklyAmount: number
  /** Minimum employer KiwiSaver contribution rate (3%) */
  kiwiSaverEmployerMin: number
  /** Available employee KiwiSaver contribution rates */
  kiwiSaverEmployeeRates: number[]
  /** Provisional tax threshold — RIT exceeds this amount */
  provisionalTaxThreshold: number
  /** ACC earner levy rate (approximate) */
  accEarnerLevy: number
  /** ISO timestamp when rates were fetched */
  fetchedAt: string
  /** Source URL or description */
  source: string
}

// ─── Fallback Rates ───────────────────────────────────────────────────
// Hardcoded fallback rates for when the API/scraping is unavailable.
// These reflect the 2025–26 NZ income year.

const FALLBACK_NZ_RATES: NZTaxRates = {
  gstRate: 15,
  incomeTaxBrackets: [
    { min: 0, max: 14_000, rate: 10.5, label: '10.5% on $0 – $14,000' },
    { min: 14_001, max: 48_000, rate: 17.5, label: '17.5% on $14,001 – $48,000' },
    { min: 48_001, max: 70_000, rate: 30, label: '30% on $48,001 – $70,000' },
    { min: 70_001, max: 180_000, rate: 33, label: '33% on $70,001 – $180,000' },
    { min: 180_001, max: null, rate: 39, label: '39% on $180,001+' },
  ],
  ietcWeeklyAmount: 10,
  kiwiSaverEmployerMin: 3,
  kiwiSaverEmployeeRates: [3, 4, 6, 8, 10],
  provisionalTaxThreshold: 5_000,
  accEarnerLevy: 1.60,
  fetchedAt: new Date().toISOString(),
  source: 'fallback — ird.govt.nz rates as at 2025-04-01',
}

// ─── Fetcher Implementation ───────────────────────────────────────────

/**
 * Fetch current NZ tax rates.
 *
 * Resolution order:
 * 1. Supabase cache (if < 24h old and forceRefresh is false)
 * 2. Brave Search → Jina AI scrape from ird.govt.nz
 * 3. Hardcoded fallback rates
 *
 * @param forceRefresh - Skip cache and re-scrape from source
 * @returns NZTaxRates object
 */
export async function fetchNZTaxRates(forceRefresh = false): Promise<NZTaxRates> {
  // 1. Try cache
  if (!forceRefresh) {
    const cached = await getCachedRates()
    if (cached) {
      log.info('NZ tax rates served from cache', { fetchedAt: cached.fetchedAt })
      return cached
    }
  }

  // 2. Try live scrape
  try {
    log.info('Fetching NZ tax rates from ird.govt.nz')
    const liveRates = await scrapeNZRates()
    await cacheRates(liveRates)
    return liveRates
  } catch (error: unknown) {
    log.warn('Live NZ rate scrape failed, using fallback', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // 3. Fallback
  return { ...FALLBACK_NZ_RATES, fetchedAt: new Date().toISOString() }
}

// ─── Scraping Logic ───────────────────────────────────────────────────

async function scrapeNZRates(): Promise<NZTaxRates> {
  const braveClient = getBraveClient()
  const jinaScraper = getJinaScraper()

  // Search for NZ individual income tax rates page
  const searchResults = await braveClient.search(
    'site:ird.govt.nz income tax rates individuals 2025',
    { count: 5 }
  )

  let incomeTaxBrackets = FALLBACK_NZ_RATES.incomeTaxBrackets
  let gstRate = FALLBACK_NZ_RATES.gstRate
  let sourceUrl = 'https://www.ird.govt.nz/income-tax/income-tax-for-individuals/tax-codes-and-tax-rates-for-individuals/tax-rates-for-individuals'

  if (searchResults.results.length > 0) {
    // Prefer the official IRD tax rates page
    const irdResult = searchResults.results.find(
      (r) => r.url.includes('ird.govt.nz') && r.url.includes('tax-rates')
    ) || searchResults.results[0]

    sourceUrl = irdResult.url

    try {
      const scraped = await jinaScraper.scrape(sourceUrl)
      const parsed = parseIncomeTaxBrackets(scraped.markdown)
      if (parsed.length > 0) {
        incomeTaxBrackets = parsed
      }

      const parsedGST = parseGSTRate(scraped.markdown)
      if (parsedGST !== null) {
        gstRate = parsedGST
      }
    } catch (scrapeError: unknown) {
      log.warn('Failed to parse NZ income tax brackets from scraped content', {
        error: scrapeError instanceof Error ? scrapeError.message : String(scrapeError),
      })
    }
  }

  return {
    gstRate,
    incomeTaxBrackets,
    ietcWeeklyAmount: 10,
    kiwiSaverEmployerMin: 3,
    kiwiSaverEmployeeRates: [3, 4, 6, 8, 10],
    provisionalTaxThreshold: 5_000,
    accEarnerLevy: 1.60,
    fetchedAt: new Date().toISOString(),
    source: sourceUrl,
  }
}

/**
 * Parse NZ income tax brackets from scraped markdown content.
 * Looks for patterns like "10.5% on $0 - $14,000" or tabular bracket data.
 */
function parseIncomeTaxBrackets(markdown: string): TaxBracket[] {
  const brackets: TaxBracket[] = []

  // Pattern: rate% ... $min ... $max (handles NZ IRD page formats)
  const bracketPatterns = [
    // "10.5 cents" or "10.5%" followed by range
    /(\d+\.?\d*)\s*(?:cents|%|percent)[^$]*\$?([\d,]+)\s*(?:to|-|–|—)\s*\$?([\d,]+)/gi,
    // "Up to $14,000" ... "10.5%"
    /up\s+to\s+\$?([\d,]+)[^%]*?(\d+\.?\d*)\s*%/gi,
    // "$70,001 - $180,000" ... "33%"
    /\$?([\d,]+)\s*(?:to|-|–|—)\s*\$?([\d,]+)[^%]*?(\d+\.?\d*)\s*%/gi,
  ]

  for (const pattern of bracketPatterns) {
    let match
    while ((match = pattern.exec(markdown)) !== null) {
      // The capture groups vary by pattern but we extract what we can
      const nums = match.slice(1).map((s) => {
        const cleaned = s.replace(/,/g, '')
        return parseFloat(cleaned)
      }).filter((n) => !isNaN(n))

      if (nums.length >= 2) {
        // Heuristic: if the first number looks like a rate (< 100), it's rate + range
        // Otherwise it's range + rate
        if (nums[0] < 100 && nums.length >= 3) {
          brackets.push({
            min: nums[1],
            max: nums[2],
            rate: nums[0],
          })
        }
      }
    }
  }

  // De-duplicate and sort by min
  const seen = new Set<string>()
  const unique = brackets.filter((b) => {
    const key = `${b.min}-${b.max}-${b.rate}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => a.min - b.min)

  return unique
}

/**
 * Parse GST rate from scraped markdown content.
 */
function parseGSTRate(markdown: string): number | null {
  // Look for "GST" near "15%"
  const gstMatch = markdown.match(/GST[^%]*?(\d+\.?\d*)\s*%/i)
  if (gstMatch) {
    const rate = parseFloat(gstMatch[1])
    if (rate > 0 && rate <= 100) return rate
  }
  return null
}

// ─── Cache Layer ──────────────────────────────────────────────────────

async function getCachedRates(): Promise<NZTaxRates | null> {
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

    const cacheAge = Date.now() - new Date(data.created_at).getTime()
    if (cacheAge > CACHE_TTL_MS) {
      log.debug('NZ tax rates cache expired', {
        ageHours: Math.round(cacheAge / 1000 / 60 / 60),
      })
      return null
    }

    return data.rates as NZTaxRates
  } catch {
    return null
  }
}

async function cacheRates(rates: NZTaxRates): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from('tax_rates_cache').upsert(
      {
        cache_key: CACHE_KEY,
        rates,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'cache_key' }
    )
    log.info('NZ tax rates cached successfully')
  } catch (error: unknown) {
    log.warn('Failed to cache NZ tax rates', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
