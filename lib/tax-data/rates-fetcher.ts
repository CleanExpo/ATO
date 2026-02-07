/**
 * Tax Rates Fetcher
 *
 * Fetches current Australian tax rates from ATO.gov.au
 * Uses Brave Search to find pages, Jina AI to scrape content
 */

import { getBraveClient } from '../search/brave-client'
import { getJinaScraper } from '../scraping/jina-scraper'
import { createLogger } from '@/lib/logger'

const log = createLogger('tax-data:rates-fetcher')

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

  // FBT
  fbtRate: number | null // e.g. 0.47 for 47%
  fbtType1GrossUpRate: number | null // e.g. 2.0802
  fbtType2GrossUpRate: number | null // e.g. 1.8868

  // Superannuation Guarantee
  superGuaranteeRate: number | null // e.g. 0.115 for 11.5%

  // Fuel Tax Credits (current quarter rates per litre)
  fuelTaxCreditOnRoad: number | null
  fuelTaxCreditOffRoad: number | null
  fuelTaxCreditQuarter: string | null // e.g. 'Q1 FY2024-25'

  // Metadata
  fetchedAt: Date
  sources: {
    instantWriteOff?: string
    homeOffice?: string
    rndIncentive?: string
    corporateTax?: string
    division7A?: string
    fbt?: string
    superGuarantee?: string
    fuelTaxCredits?: string
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
    log.info('Fetching current tax rates from ATO.gov.au')

    const startTime = Date.now()

    // Fetch all rates in parallel for speed
    const [
      instantWriteOff,
      homeOffice,
      rndIncentive,
      corporateTax,
      division7A,
      fbt,
      superGuarantee,
      fuelTaxCredits,
    ] = await Promise.allSettled([
      this.fetchInstantWriteOffThreshold(),
      this.fetchHomeOfficeRate(),
      this.fetchRnDOffsetRate(),
      this.fetchCorporateTaxRates(),
      this.fetchDivision7ARate(),
      this.fetchFBTRates(),
      this.fetchSuperGuaranteeRate(),
      this.fetchFuelTaxCreditRates(),
    ])

    const duration = Date.now() - startTime

    log.info('Fetched tax rates', { durationMs: duration })

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

      // FBT rates
      fbtRate:
        fbt.status === 'fulfilled' ? fbt.value.fbtRate : null,
      fbtType1GrossUpRate:
        fbt.status === 'fulfilled' ? fbt.value.type1GrossUp : null,
      fbtType2GrossUpRate:
        fbt.status === 'fulfilled' ? fbt.value.type2GrossUp : null,

      // Super guarantee
      superGuaranteeRate:
        superGuarantee.status === 'fulfilled' ? superGuarantee.value.rate : null,

      // Fuel tax credits
      fuelTaxCreditOnRoad:
        fuelTaxCredits.status === 'fulfilled' ? fuelTaxCredits.value.onRoad : null,
      fuelTaxCreditOffRoad:
        fuelTaxCredits.status === 'fulfilled' ? fuelTaxCredits.value.offRoad : null,
      fuelTaxCreditQuarter:
        fuelTaxCredits.status === 'fulfilled' ? fuelTaxCredits.value.quarter : null,

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
        fbt:
          fbt.status === 'fulfilled' ? fbt.value.source ?? undefined : undefined,
        superGuarantee:
          superGuarantee.status === 'fulfilled' ? superGuarantee.value.source ?? undefined : undefined,
        fuelTaxCredits:
          fuelTaxCredits.status === 'fulfilled' ? fuelTaxCredits.value.source ?? undefined : undefined,
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
      log.debug('Fetching instant write-off threshold')

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
      log.debug('Fetching home office rate')

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
      log.debug('Fetching R&D offset rate')

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
      log.debug('Fetching corporate tax rates')

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
      log.debug('Fetching Division 7A rate')

      const url = await this.braveClient.findDivision7ARatesPage()
      if (!url) {
        console.warn('  Could not find Division 7A rates page')
        return { rate: null, source: null }
      }

      const rate = await this.jinaScraper.parseDivision7ARate(url)

      return { rate, source: url }
    } catch (error: unknown) {
      console.error('  Failed to fetch Division 7A rate:', error instanceof Error ? error.message : String(error))
      return { rate: null, source: null }
    }
  }

  /**
   * Fetch FBT rate and gross-up rates
   * FBT rate: 47% (FBTAA 1986 s 5B)
   * Gross-up rates derived from FBT rate
   */
  async fetchFBTRates(): Promise<{
    fbtRate: number | null
    type1GrossUp: number | null
    type2GrossUp: number | null
    source: string | null
  }> {
    try {
      log.debug('Fetching FBT rates')

      const url = await this.braveClient.findFBTRatesPage()
      if (!url) {
        console.warn('  Could not find FBT rates page')
        return { fbtRate: null, type1GrossUp: null, type2GrossUp: null, source: null }
      }

      const rates = await this.jinaScraper.parseFBTRates(url)

      return {
        fbtRate: rates?.fbtRate ?? null,
        type1GrossUp: rates?.type1GrossUp ?? null,
        type2GrossUp: rates?.type2GrossUp ?? null,
        source: url,
      }
    } catch (error: unknown) {
      console.error('  Failed to fetch FBT rates:', error instanceof Error ? error.message : String(error))
      return { fbtRate: null, type1GrossUp: null, type2GrossUp: null, source: null }
    }
  }

  /**
   * Fetch superannuation guarantee rate
   * SG rate changes annually (11.5% from 1 Jul 2024, 12% from 1 Jul 2025)
   */
  async fetchSuperGuaranteeRate(): Promise<{
    rate: number | null
    source: string | null
  }> {
    try {
      log.debug('Fetching super guarantee rate')

      const url = await this.braveClient.findSuperGuaranteeRatePage()
      if (!url) {
        console.warn('  Could not find super guarantee rate page')
        return { rate: null, source: null }
      }

      const rate = await this.jinaScraper.parseSuperGuaranteeRate(url)

      return { rate, source: url }
    } catch (error: unknown) {
      console.error('  Failed to fetch super guarantee rate:', error instanceof Error ? error.message : String(error))
      return { rate: null, source: null }
    }
  }

  /**
   * Fetch fuel tax credit rates (quarterly)
   * ATO updates rates each quarter aligned to excise indexation
   */
  async fetchFuelTaxCreditRates(): Promise<{
    onRoad: number | null
    offRoad: number | null
    quarter: string | null
    source: string | null
  }> {
    try {
      log.debug('Fetching fuel tax credit rates')

      const url = await this.braveClient.findFuelTaxCreditRatesPage()
      if (!url) {
        console.warn('  Could not find fuel tax credit rates page')
        return { onRoad: null, offRoad: null, quarter: null, source: null }
      }

      const rates = await this.jinaScraper.parseFuelTaxCreditRates(url)

      return {
        onRoad: rates?.onRoad ?? null,
        offRoad: rates?.offRoad ?? null,
        quarter: rates?.quarter ?? null,
        source: url,
      }
    } catch (error: unknown) {
      console.error('  Failed to fetch fuel tax credit rates:', error instanceof Error ? error.message : String(error))
      return { onRoad: null, offRoad: null, quarter: null, source: null }
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
