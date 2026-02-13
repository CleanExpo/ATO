/**
 * Unit tests for Tax Rates Fetcher
 *
 * Tests cover:
 * - Returns TaxRates object with all expected fields
 * - Handles individual rate fetch failures gracefully (Promise.allSettled)
 * - Returns fallback null values when all fetches fail
 * - Rate provenance tracking (source URLs)
 * - Individual fetch methods (instant write-off, home office, R&D, etc.)
 * - Mock brave-client and jina-scraper
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindInstantWriteOffPage = vi.fn()
const mockFindHomeOfficeRatesPage = vi.fn()
const mockFindRnDIncentivePage = vi.fn()
const mockFindCorporateTaxRatesPage = vi.fn()
const mockFindDivision7ARatesPage = vi.fn()
const mockFindFBTRatesPage = vi.fn()
const mockFindSuperGuaranteeRatePage = vi.fn()
const mockFindFuelTaxCreditRatesPage = vi.fn()

vi.mock('@/lib/search/brave-client', () => ({
  getBraveClient: vi.fn(() => ({
    findInstantWriteOffPage: mockFindInstantWriteOffPage,
    findHomeOfficeRatesPage: mockFindHomeOfficeRatesPage,
    findRnDIncentivePage: mockFindRnDIncentivePage,
    findCorporateTaxRatesPage: mockFindCorporateTaxRatesPage,
    findDivision7ARatesPage: mockFindDivision7ARatesPage,
    findFBTRatesPage: mockFindFBTRatesPage,
    findSuperGuaranteeRatePage: mockFindSuperGuaranteeRatePage,
    findFuelTaxCreditRatesPage: mockFindFuelTaxCreditRatesPage,
  })),
}))

const mockParseInstantWriteOffThreshold = vi.fn()
const mockParseHomeOfficeRate = vi.fn()
const mockParseRnDOffsetRate = vi.fn()
const mockParseCorporateTaxRates = vi.fn()
const mockParseDivision7ARate = vi.fn()
const mockParseFBTRates = vi.fn()
const mockParseSuperGuaranteeRate = vi.fn()
const mockParseFuelTaxCreditRates = vi.fn()

vi.mock('@/lib/scraping/jina-scraper', () => ({
  getJinaScraper: vi.fn(() => ({
    parseInstantWriteOffThreshold: mockParseInstantWriteOffThreshold,
    parseHomeOfficeRate: mockParseHomeOfficeRate,
    parseRnDOffsetRate: mockParseRnDOffsetRate,
    parseCorporateTaxRates: mockParseCorporateTaxRates,
    parseDivision7ARate: mockParseDivision7ARate,
    parseFBTRates: mockParseFBTRates,
    parseSuperGuaranteeRate: mockParseSuperGuaranteeRate,
    parseFuelTaxCreditRates: mockParseFuelTaxCreditRates,
  })),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { TaxRatesFetcher, getRatesFetcher } from '@/lib/tax-data/rates-fetcher'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupAllSuccessful() {
  mockFindInstantWriteOffPage.mockResolvedValue('https://ato.gov.au/write-off')
  mockFindHomeOfficeRatesPage.mockResolvedValue('https://ato.gov.au/home-office')
  mockFindRnDIncentivePage.mockResolvedValue('https://ato.gov.au/rnd')
  mockFindCorporateTaxRatesPage.mockResolvedValue('https://ato.gov.au/corporate')
  mockFindDivision7ARatesPage.mockResolvedValue('https://ato.gov.au/div7a')
  mockFindFBTRatesPage.mockResolvedValue('https://ato.gov.au/fbt')
  mockFindSuperGuaranteeRatePage.mockResolvedValue('https://ato.gov.au/super')
  mockFindFuelTaxCreditRatesPage.mockResolvedValue('https://ato.gov.au/fuel')

  mockParseInstantWriteOffThreshold.mockResolvedValue(20000)
  mockParseHomeOfficeRate.mockResolvedValue(0.67)
  mockParseRnDOffsetRate.mockResolvedValue(0.435)
  mockParseCorporateTaxRates.mockResolvedValue({ smallBusiness: 0.25, standard: 0.30 })
  mockParseDivision7ARate.mockResolvedValue(0.0877)
  mockParseFBTRates.mockResolvedValue({ fbtRate: 0.47, type1GrossUp: 2.0802, type2GrossUp: 1.8868 })
  mockParseSuperGuaranteeRate.mockResolvedValue(0.12)
  mockParseFuelTaxCreditRates.mockResolvedValue({ onRoad: 0.208, offRoad: 0.488, quarter: 'Q1 FY2025-26' })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TaxRatesFetcher', () => {
  let fetcher: TaxRatesFetcher

  beforeEach(() => {
    vi.clearAllMocks()
    fetcher = new TaxRatesFetcher()
  })

  // ========================================================================
  // fetchAllRates -- happy path
  // ========================================================================

  describe('fetchAllRates -- all successful', () => {
    it('should return TaxRates with all expected fields populated', async () => {
      setupAllSuccessful()

      const rates = await fetcher.fetchAllRates()

      expect(rates.instantWriteOffThreshold).toBe(20000)
      expect(rates.homeOfficeRatePerHour).toBe(0.67)
      expect(rates.rndOffsetRate).toBe(0.435)
      expect(rates.rndOffsetRateSmallBusiness).toBe(0.435)
      expect(rates.corporateTaxRateSmall).toBe(0.25)
      expect(rates.corporateTaxRateStandard).toBe(0.30)
      expect(rates.division7ABenchmarkRate).toBe(0.0877)
      expect(rates.fbtRate).toBe(0.47)
      expect(rates.fbtType1GrossUpRate).toBe(2.0802)
      expect(rates.fbtType2GrossUpRate).toBe(1.8868)
      expect(rates.superGuaranteeRate).toBe(0.12)
      expect(rates.fuelTaxCreditOnRoad).toBe(0.208)
      expect(rates.fuelTaxCreditOffRoad).toBe(0.488)
      expect(rates.fuelTaxCreditQuarter).toBe('Q1 FY2025-26')
    })

    it('should include fetchedAt timestamp', async () => {
      setupAllSuccessful()

      const before = new Date()
      const rates = await fetcher.fetchAllRates()
      const after = new Date()

      expect(rates.fetchedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(rates.fetchedAt.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it('should include source URLs for all rates', async () => {
      setupAllSuccessful()

      const rates = await fetcher.fetchAllRates()

      expect(rates.sources.instantWriteOff).toBe('https://ato.gov.au/write-off')
      expect(rates.sources.homeOffice).toBe('https://ato.gov.au/home-office')
      expect(rates.sources.rndIncentive).toBe('https://ato.gov.au/rnd')
      expect(rates.sources.corporateTax).toBe('https://ato.gov.au/corporate')
      expect(rates.sources.division7A).toBe('https://ato.gov.au/div7a')
      expect(rates.sources.fbt).toBe('https://ato.gov.au/fbt')
      expect(rates.sources.superGuarantee).toBe('https://ato.gov.au/super')
      expect(rates.sources.fuelTaxCredits).toBe('https://ato.gov.au/fuel')
    })
  })

  // ========================================================================
  // Promise.allSettled -- partial failures
  // ========================================================================

  describe('handles individual rate fetch failures gracefully', () => {
    it('should return null for failed fetches but valid data for others', async () => {
      setupAllSuccessful()

      // Make R&D and FBT fail
      mockFindRnDIncentivePage.mockRejectedValue(new Error('Network error'))
      mockParseFBTRates.mockRejectedValue(new Error('Scrape failed'))

      const rates = await fetcher.fetchAllRates()

      // These should be null because they failed
      expect(rates.rndOffsetRate).toBeNull()
      expect(rates.rndOffsetRateSmallBusiness).toBeNull()
      expect(rates.fbtRate).toBeNull()
      expect(rates.fbtType1GrossUpRate).toBeNull()

      // These should still have values
      expect(rates.instantWriteOffThreshold).toBe(20000)
      expect(rates.homeOfficeRatePerHour).toBe(0.67)
      expect(rates.corporateTaxRateSmall).toBe(0.25)
    })

    it('should set sources to undefined for failed fetches', async () => {
      setupAllSuccessful()

      mockFindInstantWriteOffPage.mockRejectedValue(new Error('Timeout'))

      const rates = await fetcher.fetchAllRates()

      expect(rates.sources.instantWriteOff).toBeUndefined()
      expect(rates.sources.homeOffice).toBe('https://ato.gov.au/home-office')
    })
  })

  // ========================================================================
  // All fetches fail
  // ========================================================================

  describe('returns null values when all fetches fail', () => {
    it('should return all null rate values when every fetch rejects', async () => {
      mockFindInstantWriteOffPage.mockRejectedValue(new Error('fail'))
      mockFindHomeOfficeRatesPage.mockRejectedValue(new Error('fail'))
      mockFindRnDIncentivePage.mockRejectedValue(new Error('fail'))
      mockFindCorporateTaxRatesPage.mockRejectedValue(new Error('fail'))
      mockFindDivision7ARatesPage.mockRejectedValue(new Error('fail'))
      mockFindFBTRatesPage.mockRejectedValue(new Error('fail'))
      mockFindSuperGuaranteeRatePage.mockRejectedValue(new Error('fail'))
      mockFindFuelTaxCreditRatesPage.mockRejectedValue(new Error('fail'))

      const rates = await fetcher.fetchAllRates()

      expect(rates.instantWriteOffThreshold).toBeNull()
      expect(rates.homeOfficeRatePerHour).toBeNull()
      expect(rates.rndOffsetRate).toBeNull()
      expect(rates.corporateTaxRateSmall).toBeNull()
      expect(rates.division7ABenchmarkRate).toBeNull()
      expect(rates.fbtRate).toBeNull()
      expect(rates.superGuaranteeRate).toBeNull()
      expect(rates.fuelTaxCreditOnRoad).toBeNull()
      expect(rates.fuelTaxCreditOffRoad).toBeNull()
      expect(rates.fuelTaxCreditQuarter).toBeNull()
    })

    it('should still include fetchedAt even when all fetches fail', async () => {
      mockFindInstantWriteOffPage.mockRejectedValue(new Error('fail'))
      mockFindHomeOfficeRatesPage.mockRejectedValue(new Error('fail'))
      mockFindRnDIncentivePage.mockRejectedValue(new Error('fail'))
      mockFindCorporateTaxRatesPage.mockRejectedValue(new Error('fail'))
      mockFindDivision7ARatesPage.mockRejectedValue(new Error('fail'))
      mockFindFBTRatesPage.mockRejectedValue(new Error('fail'))
      mockFindSuperGuaranteeRatePage.mockRejectedValue(new Error('fail'))
      mockFindFuelTaxCreditRatesPage.mockRejectedValue(new Error('fail'))

      const rates = await fetcher.fetchAllRates()

      expect(rates.fetchedAt).toBeInstanceOf(Date)
    })
  })

  // ========================================================================
  // Individual fetch methods
  // ========================================================================

  describe('fetchInstantWriteOffThreshold', () => {
    it('should return amount and source on success', async () => {
      mockFindInstantWriteOffPage.mockResolvedValue('https://ato.gov.au/write-off')
      mockParseInstantWriteOffThreshold.mockResolvedValue(20000)

      const result = await fetcher.fetchInstantWriteOffThreshold()

      expect(result.amount).toBe(20000)
      expect(result.source).toBe('https://ato.gov.au/write-off')
    })

    it('should return nulls when Brave finds no page', async () => {
      mockFindInstantWriteOffPage.mockResolvedValue(null)

      const result = await fetcher.fetchInstantWriteOffThreshold()

      expect(result.amount).toBeNull()
      expect(result.source).toBeNull()
    })

    it('should return nulls on error', async () => {
      mockFindInstantWriteOffPage.mockRejectedValue(new Error('API down'))

      const result = await fetcher.fetchInstantWriteOffThreshold()

      expect(result.amount).toBeNull()
      expect(result.source).toBeNull()
    })
  })

  describe('fetchHomeOfficeRate', () => {
    it('should return rate and source on success', async () => {
      mockFindHomeOfficeRatesPage.mockResolvedValue('https://ato.gov.au/home-office')
      mockParseHomeOfficeRate.mockResolvedValue(0.67)

      const result = await fetcher.fetchHomeOfficeRate()

      expect(result.rate).toBe(0.67)
      expect(result.source).toBe('https://ato.gov.au/home-office')
    })

    it('should return nulls when no page found', async () => {
      mockFindHomeOfficeRatesPage.mockResolvedValue(null)

      const result = await fetcher.fetchHomeOfficeRate()

      expect(result.rate).toBeNull()
      expect(result.source).toBeNull()
    })
  })

  describe('fetchRnDOffsetRate', () => {
    it('should return rate, smallBusinessRate, and source', async () => {
      mockFindRnDIncentivePage.mockResolvedValue('https://ato.gov.au/rnd')
      mockParseRnDOffsetRate.mockResolvedValue(0.435)

      const result = await fetcher.fetchRnDOffsetRate()

      expect(result.rate).toBe(0.435)
      expect(result.smallBusinessRate).toBe(0.435) // same rate used for both currently
      expect(result.source).toBe('https://ato.gov.au/rnd')
    })
  })

  describe('fetchCorporateTaxRates', () => {
    it('should return smallBusiness and standard rates', async () => {
      mockFindCorporateTaxRatesPage.mockResolvedValue('https://ato.gov.au/corporate')
      mockParseCorporateTaxRates.mockResolvedValue({ smallBusiness: 0.25, standard: 0.30 })

      const result = await fetcher.fetchCorporateTaxRates()

      expect(result.smallBusiness).toBe(0.25)
      expect(result.standard).toBe(0.30)
      expect(result.source).toBe('https://ato.gov.au/corporate')
    })

    it('should return nulls when parser returns null', async () => {
      mockFindCorporateTaxRatesPage.mockResolvedValue('https://ato.gov.au/corporate')
      mockParseCorporateTaxRates.mockResolvedValue(null)

      const result = await fetcher.fetchCorporateTaxRates()

      expect(result.smallBusiness).toBeNull()
      expect(result.standard).toBeNull()
    })
  })

  describe('fetchDivision7ARate', () => {
    it('should return rate on success', async () => {
      mockFindDivision7ARatesPage.mockResolvedValue('https://ato.gov.au/div7a')
      mockParseDivision7ARate.mockResolvedValue(0.0877)

      const result = await fetcher.fetchDivision7ARate()

      expect(result.rate).toBe(0.0877)
      expect(result.source).toBe('https://ato.gov.au/div7a')
    })
  })

  describe('fetchFBTRates', () => {
    it('should return fbtRate, type1GrossUp, and type2GrossUp', async () => {
      mockFindFBTRatesPage.mockResolvedValue('https://ato.gov.au/fbt')
      mockParseFBTRates.mockResolvedValue({
        fbtRate: 0.47,
        type1GrossUp: 2.0802,
        type2GrossUp: 1.8868,
      })

      const result = await fetcher.fetchFBTRates()

      expect(result.fbtRate).toBe(0.47)
      expect(result.type1GrossUp).toBe(2.0802)
      expect(result.type2GrossUp).toBe(1.8868)
    })

    it('should return all nulls when page not found', async () => {
      mockFindFBTRatesPage.mockResolvedValue(null)

      const result = await fetcher.fetchFBTRates()

      expect(result.fbtRate).toBeNull()
      expect(result.type1GrossUp).toBeNull()
      expect(result.type2GrossUp).toBeNull()
      expect(result.source).toBeNull()
    })
  })

  describe('fetchSuperGuaranteeRate', () => {
    it('should return rate on success', async () => {
      mockFindSuperGuaranteeRatePage.mockResolvedValue('https://ato.gov.au/super')
      mockParseSuperGuaranteeRate.mockResolvedValue(0.12)

      const result = await fetcher.fetchSuperGuaranteeRate()

      expect(result.rate).toBe(0.12)
    })
  })

  describe('fetchFuelTaxCreditRates', () => {
    it('should return onRoad, offRoad, quarter, and source', async () => {
      mockFindFuelTaxCreditRatesPage.mockResolvedValue('https://ato.gov.au/fuel')
      mockParseFuelTaxCreditRates.mockResolvedValue({
        onRoad: 0.208,
        offRoad: 0.488,
        quarter: 'Q1 FY2025-26',
      })

      const result = await fetcher.fetchFuelTaxCreditRates()

      expect(result.onRoad).toBe(0.208)
      expect(result.offRoad).toBe(0.488)
      expect(result.quarter).toBe('Q1 FY2025-26')
      expect(result.source).toBe('https://ato.gov.au/fuel')
    })

    it('should return nulls when parser returns null', async () => {
      mockFindFuelTaxCreditRatesPage.mockResolvedValue('https://ato.gov.au/fuel')
      mockParseFuelTaxCreditRates.mockResolvedValue(null)

      const result = await fetcher.fetchFuelTaxCreditRates()

      expect(result.onRoad).toBeNull()
      expect(result.offRoad).toBeNull()
      expect(result.quarter).toBeNull()
    })
  })

  // ========================================================================
  // Singleton
  // ========================================================================

  describe('getRatesFetcher singleton', () => {
    it('should return a TaxRatesFetcher instance', () => {
      const instance = getRatesFetcher()
      expect(instance).toBeInstanceOf(TaxRatesFetcher)
    })
  })
})
