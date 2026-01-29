/**
 * Tax Rates Fetcher
 *
 * Fetches current Australian tax rates from ATO.gov.au
 * Uses Brave Search to find pages, Jina AI to scrape content
 */

import { getBraveClient } from '../search/brave-client'
import { getJinaScraper } from '../scraping/jina-scraper'

export interface TaxRates {
  // Deduction rates
  instantWriteOffThreshold: number | null
  homeOfficeRatePerHour: number | null

  // R&D Tax Incentive
  rndOffsetRate: number | null
  rndOffsetRateSmallBusiness: number | null

  // Corporate tax rates
  corporateTaxRateSmall: number | null
  corporateTaxRateStandard: number | null

  // Division 7A
  division7ABenchmarkRate: number | null

  // Metadata
  fetchedAt: Date
  sources: {
    instantWriteOff?: string
    homeOffice?: string
    rndIncentive?: string
    corporateTax?: string
    division7A?: string
  }
}

export class TaxRatesFetcher {
  private braveClient = getBraveClient()
  private jinaScraper = getJinaScraper()

  /**
   * Fetch all current tax rates from ATO.gov.au
   *
   * This is the main entry point - fetches all rates in parallel
   */
  async fetchAllRates(): Promise<TaxRates> {
    console.log('🔍 Fetching current tax rates from ATO.gov.au...')

    const startTime = Date.now()

    // Fetch all rates in parallel for speed
    const [
      instantWriteOff,
      homeOffice,
      rndIncentive,
      corporateTax,
      division7A,
    ] = await Promise.allSettled([
      this.fetchInstantWriteOffThreshold(),
      this.fetchHomeOfficeRate(),
      this.fetchRnDOffsetRate(),
      this.fetchCorporateTaxRates(),
      this.fetchDivision7ARate(),
    ])

    const duration = Date.now() - startTime

    console.log(`✅ Fetched tax rates in ${duration}ms`)

    return {
      // Extract values from settled promises
      instantWriteOffThreshold:
        instantWriteOff.status === 'fulfilled' ? instantWriteOff.value.amount : null,
      homeOfficeRatePerHour:
        homeOffice.status === 'fulfilled' ? homeOffice.value.rate : null,
      rndOffsetRate:
        rndIncentive.status === 'fulfilled' ? rndIncentive.value.rate : null,
      rndOffsetRateSmallBusiness:
        rndIncentive.status === 'fulfilled' ? rndIncentive.value.smallBusinessRate : null,
      corporateTaxRateSmall:
        corporateTax.status === 'fulfilled' ? corporateTax.value.smallBusiness : null,
      corporateTaxRateStandard:
        corporateTax.status === 'fulfilled' ? corporateTax.value.standard : null,
      division7ABenchmarkRate:
        division7A.status === 'fulfilled' ? division7A.value.rate : null,

      fetchedAt: new Date(),
      sources: {
        instantWriteOff:
          instantWriteOff.status === 'fulfilled' ? instantWriteOff.value.source ?? undefined : undefined,
        homeOffice:
          homeOffice.status === 'fulfilled' ? homeOffice.value.source ?? undefined : undefined,
        rndIncentive:
          rndIncentive.status === 'fulfilled' ? rndIncentive.value.source ?? undefined : undefined,
        corporateTax:
          corporateTax.status === 'fulfilled' ? corporateTax.value.source ?? undefined : undefined,
        division7A:
          division7A.status === 'fulfilled' ? division7A.value.source ?? undefined : undefined,
      },
    }
  }

  /**
   * Fetch instant asset write-off threshold
   */
  async fetchInstantWriteOffThreshold(): Promise<{
    amount: number | null
    source: string | null
  }> {
    try {
      console.log('  → Fetching instant write-off threshold...')

      const url = await this.braveClient.findInstantWriteOffPage()
      if (!url) {
        console.warn('  ⚠️  Could not find instant write-off page')
        return { amount: null, source: null }
      }

      const amount = await this.jinaScraper.parseInstantWriteOffThreshold(url)

      return { amount, source: url }
    } catch (error: unknown) {
      console.error('  ❌ Failed to fetch instant write-off:', error instanceof Error ? error.message : String(error))
      return { amount: null, source: null }
    }
  }

  /**
   * Fetch home office deduction rate (cents per hour)
   */
  async fetchHomeOfficeRate(): Promise<{
    rate: number | null
    source: string | null
  }> {
    try {
      console.log('  → Fetching home office rate...')

      const url = await this.braveClient.findHomeOfficeRatesPage()
      if (!url) {
        console.warn('  ⚠️  Could not find home office rates page')
        return { rate: null, source: null }
      }

      const rate = await this.jinaScraper.parseHomeOfficeRate(url)

      return { rate, source: url }
    } catch (error: unknown) {
      console.error('  ❌ Failed to fetch home office rate:', error instanceof Error ? error.message : String(error))
      return { rate: null, source: null }
    }
  }

  /**
   * Fetch R&D tax incentive offset rates
   */
  async fetchRnDOffsetRate(): Promise<{
    rate: number | null
    smallBusinessRate: number | null
    source: string | null
  }> {
    try {
      console.log('  → Fetching R&D offset rate...')

      const url = await this.braveClient.findRnDIncentivePage()
      if (!url) {
        console.warn('  ⚠️  Could not find R&D incentive page')
        return { rate: null, smallBusinessRate: null, source: null }
      }

      const rate = await this.jinaScraper.parseRnDOffsetRate(url)

      // For now, use same rate for small business
      // In reality, there are two rates: 18.5% and 43.5%
      return { rate, smallBusinessRate: rate, source: url }
    } catch (error: unknown) {
      console.error('  ❌ Failed to fetch R&D offset rate:', error instanceof Error ? error.message : String(error))
      return { rate: null, smallBusinessRate: null, source: null }
    }
  }

  /**
   * Fetch corporate tax rates
   */
  async fetchCorporateTaxRates(): Promise<{
    smallBusiness: number | null
    standard: number | null
    source: string | null
  }> {
    try {
      console.log('  → Fetching corporate tax rates...')

      const url = await this.braveClient.findCorporateTaxRatesPage()
      if (!url) {
        console.warn('  ⚠️  Could not find corporate tax rates page')
        return { smallBusiness: null, standard: null, source: null }
      }

      const rates = await this.jinaScraper.parseCorporateTaxRates(url)

      return {
        smallBusiness: rates?.smallBusiness || null,
        standard: rates?.standard || null,
        source: url,
      }
    } catch (error: unknown) {
      console.error('  ❌ Failed to fetch corporate tax rates:', error instanceof Error ? error.message : String(error))
      return { smallBusiness: null, standard: null, source: null }
    }
  }

  /**
   * Fetch Division 7A benchmark interest rate
   */
  async fetchDivision7ARate(): Promise<{
    rate: number | null
    source: string | null
  }> {
    try {
      console.log('  → Fetching Division 7A rate...')

      const url = await this.braveClient.findDivision7ARatesPage()
      if (!url) {
        console.warn('  ⚠️  Could not find Division 7A rates page')
        return { rate: null, source: null }
      }

      const rate = await this.jinaScraper.parseDivision7ARate(url)

      return { rate, source: url }
    } catch (error: unknown) {
      console.error('  ❌ Failed to fetch Division 7A rate:', error instanceof Error ? error.message : String(error))
      return { rate: null, source: null }
    }
  }
}

// Singleton instance
let ratesFetcher: TaxRatesFetcher | null = null

/**
 * Get or create tax rates fetcher instance
 */
export function getRatesFetcher(): TaxRatesFetcher {
  if (!ratesFetcher) {
    ratesFetcher = new TaxRatesFetcher()
  }
  return ratesFetcher
}
