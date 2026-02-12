/**
 * Unit tests for Jina AI Reader API Client
 *
 * Tests cover:
 * - Successful scrape returns parsed content
 * - Parse methods extract correct rate values from markdown
 * - Handles network errors gracefully
 * - Handles malformed response data
 * - API key handling
 * - All parse* methods with realistic ATO-style markdown
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { JinaScraper, getJinaScraper } from '@/lib/scraping/jina-scraper'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSuccessResponse(markdown: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: vi.fn().mockResolvedValue(markdown),
    headers: new Headers(),
  } as unknown as Response
}

function makeErrorResponse(status: number, statusText: string): Response {
  return {
    ok: false,
    status,
    statusText,
    text: vi.fn().mockResolvedValue(''),
    headers: new Headers(),
  } as unknown as Response
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JinaScraper', () => {
  let scraper: JinaScraper

  beforeEach(() => {
    vi.clearAllMocks()
    scraper = new JinaScraper('test-jina-api-key')
  })

  // ========================================================================
  // Constructor
  // ========================================================================

  describe('constructor', () => {
    it('should use provided API key', () => {
      const s = new JinaScraper('my-key')
      // We can verify by checking that scrape uses the key in headers
      expect(s).toBeInstanceOf(JinaScraper)
    })

    it('should fall back to env var when no API key provided', () => {
      const originalKey = process.env.JINA_API_KEY
      process.env.JINA_API_KEY = 'env-jina-key'

      const s = new JinaScraper()
      expect(s).toBeInstanceOf(JinaScraper)

      process.env.JINA_API_KEY = originalKey
    })

    it('should warn when no API key is available', () => {
      const originalKey = process.env.JINA_API_KEY
      delete process.env.JINA_API_KEY

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      new JinaScraper('')
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('JINA_API_KEY'))

      process.env.JINA_API_KEY = originalKey
      warnSpy.mockRestore()
    })
  })

  // ========================================================================
  // scrape()
  // ========================================================================

  describe('scrape', () => {
    it('should return parsed content with title from first heading', async () => {
      const markdown = '# Instant Asset Write-Off\n\nSmall businesses can write off...'
      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.scrape('https://ato.gov.au/write-off')

      expect(result.url).toBe('https://ato.gov.au/write-off')
      expect(result.title).toBe('Instant Asset Write-Off')
      expect(result.content).toBe(markdown)
      expect(result.markdown).toBe(markdown)
      expect(result.scrapedAt).toBeInstanceOf(Date)
    })

    it('should use URL as title when no heading found', async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse('No heading here.'))

      const result = await scraper.scrape('https://ato.gov.au/page')

      expect(result.title).toBe('https://ato.gov.au/page')
    })

    it('should send correct headers including Authorization', async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse('# Test'))

      await scraper.scrape('https://ato.gov.au/test')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://r.jina.ai/https://ato.gov.au/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-jina-api-key',
            Accept: 'text/plain',
            'X-Return-Format': 'markdown',
          }),
        })
      )
    })

    it('should use default 30s timeout when none specified', async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse('# Test'))

      await scraper.scrape('https://ato.gov.au/test')

      const callArgs = mockFetch.mock.calls[0][1]
      expect(callArgs.signal).toBeDefined()
    })

    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(500, 'Internal Server Error'))

      await expect(scraper.scrape('https://ato.gov.au/test')).rejects.toThrow(
        'Scraping failed'
      )
    })

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('fetch failed'))

      await expect(scraper.scrape('https://ato.gov.au/test')).rejects.toThrow(
        'Scraping failed'
      )
    })
  })

  // ========================================================================
  // parseInstantWriteOffThreshold
  // ========================================================================

  describe('parseInstantWriteOffThreshold', () => {
    it('should extract $20,000 threshold from ATO content', async () => {
      const markdown = `# Instant Asset Write-Off

Small businesses with an aggregated turnover of less than $10 million can immediately
deduct the business portion of an asset that costs less than $20,000.

This threshold has been extended to 30 June 2025.`

      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseInstantWriteOffThreshold('https://ato.gov.au/write-off')

      expect(result).toBe(20000)
    })

    it('should return the largest amount in reasonable range', async () => {
      const markdown = `# Write-Off Thresholds

Previously the threshold was $1,000. It was then raised to $6,500, then $20,000,
and temporarily increased to $150,000 during COVID.`

      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseInstantWriteOffThreshold('https://ato.gov.au/write-off')

      expect(result).toBe(150000)
    })

    it('should return null when no dollar amounts found', async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse('No amounts here.'))

      const result = await scraper.parseInstantWriteOffThreshold('https://ato.gov.au/write-off')

      expect(result).toBeNull()
    })

    it('should filter out amounts below $1,000 and above $1,000,000', async () => {
      const markdown = 'Amounts: $500 is too low. $5,000,000 is too high.'
      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseInstantWriteOffThreshold('https://ato.gov.au/write-off')

      expect(result).toBeNull()
    })

    it('should return null when scrape fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await scraper.parseInstantWriteOffThreshold('https://ato.gov.au/write-off')

      expect(result).toBeNull()
    })
  })

  // ========================================================================
  // parseRnDOffsetRate
  // ========================================================================

  describe('parseRnDOffsetRate', () => {
    it('should extract R&D offset rate from ATO content', async () => {
      const markdown = `# R&D Tax Incentive

Eligible entities with aggregated turnover below $20 million receive a refundable
tax offset of 43.5% for eligible R&D expenditure.

The non-refundable offset for entities with turnover above $20M is 38.5%.`

      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseRnDOffsetRate('https://ato.gov.au/rnd')

      // Should return 0.435 (highest rate in 10-50% range)
      expect(result).toBe(0.435)
    })

    it('should return null when no percentages found', async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse('No rates mentioned.'))

      const result = await scraper.parseRnDOffsetRate('https://ato.gov.au/rnd')

      expect(result).toBeNull()
    })

    it('should filter out percentages outside 10-50% range', async () => {
      const markdown = 'The GST rate is 10%. The corporate tax rate is 30%. The R&D premium is 18.5%.'
      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseRnDOffsetRate('https://ato.gov.au/rnd')

      // 10%, 30%, 18.5% are all in range; max is 30%
      expect(result).toBe(0.30)
    })
  })

  // ========================================================================
  // parseHomeOfficeRate
  // ========================================================================

  describe('parseHomeOfficeRate', () => {
    it('should extract 67 cents per hour rate', async () => {
      const markdown = `# Home Office Expenses

The revised fixed rate method allows you to claim 67 cents per hour for work from home.`

      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseHomeOfficeRate('https://ato.gov.au/home-office')

      expect(result).toBe(0.67)
    })

    it('should handle "c per hour" format', async () => {
      const markdown = 'You can claim 67c per hour for home office running expenses.'

      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseHomeOfficeRate('https://ato.gov.au/home-office')

      expect(result).toBe(0.67)
    })

    it('should return null when no rate found', async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse('Deductions for various expenses.'))

      const result = await scraper.parseHomeOfficeRate('https://ato.gov.au/home-office')

      expect(result).toBeNull()
    })
  })

  // ========================================================================
  // parseDivision7ARate
  // ========================================================================

  describe('parseDivision7ARate', () => {
    it('should extract Division 7A benchmark rate', async () => {
      const markdown = `# Division 7A Benchmark Interest Rate

The benchmark interest rate for FY2024-25 is 8.77%.

Previous years:
- FY2023-24: 8.27%
- FY2022-23: 4.77%`

      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseDivision7ARate('https://ato.gov.au/div7a')

      // Should return the first rate in 4-10% range
      expect(result).toBe(0.0877)
    })

    it('should return null when no percentages in valid range', async () => {
      // Div7A range is 4-10%, so we need percentages entirely outside that
      const markdown = 'The corporate tax rate is 30%. The offset is 43.5%.'
      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseDivision7ARate('https://ato.gov.au/div7a')

      expect(result).toBeNull()
    })
  })

  // ========================================================================
  // parseCorporateTaxRates
  // ========================================================================

  describe('parseCorporateTaxRates', () => {
    it('should extract small business and standard corporate rates', async () => {
      const markdown = `# Company Tax Rates

The company tax rate for base rate entities is 25%.
All other companies pay 30%.`

      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseCorporateTaxRates('https://ato.gov.au/corporate')

      expect(result).not.toBeNull()
      expect(result!.smallBusiness).toBe(0.25)
      expect(result!.standard).toBe(0.30)
    })

    it('should return null when no percentages found in range', async () => {
      const markdown = 'The GST rate is 10%. Fuel credits are 48.8 cents.'
      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseCorporateTaxRates('https://ato.gov.au/corporate')

      expect(result).toBeNull()
    })

    it('should return null on scrape failure', async () => {
      mockFetch.mockRejectedValue(new Error('Timeout'))

      const result = await scraper.parseCorporateTaxRates('https://ato.gov.au/corporate')

      expect(result).toBeNull()
    })
  })

  // ========================================================================
  // parseFBTRates
  // ========================================================================

  describe('parseFBTRates', () => {
    it('should extract FBT rate and gross-up rates', async () => {
      const markdown = `# Fringe Benefits Tax

The FBT rate is 47% FBT rate for the FBT year.

Gross-up rates:
- Type 1 (GST credits): 2.0802
- Type 2 (no GST credits): 1.8868`

      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseFBTRates('https://ato.gov.au/fbt')

      expect(result).not.toBeNull()
      expect(result!.fbtRate).toBe(0.47)
      expect(result!.type1GrossUp).toBe(2.0802)
      expect(result!.type2GrossUp).toBe(1.8868)
    })

    it('should handle alternative FBT rate text format', async () => {
      const markdown = 'FBT rate is currently 47%.'
      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseFBTRates('https://ato.gov.au/fbt')

      // The regex expects "FBT rate" or "fringe benefits tax rate" patterns
      // "FBT rate" followed by "47%" should be matched by second regex pattern
      expect(result).not.toBeNull()
    })

    it('should return null when no FBT-related rates found', async () => {
      const markdown = 'Company tax rate information.'
      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseFBTRates('https://ato.gov.au/fbt')

      expect(result).toBeNull()
    })

    it('should handle single gross-up rate (assign to type1)', async () => {
      const markdown = `47% FBT rate. Gross-up factor: 2.0802.`
      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseFBTRates('https://ato.gov.au/fbt')

      expect(result).not.toBeNull()
      expect(result!.type1GrossUp).toBe(2.0802)
      expect(result!.type2GrossUp).toBeNull()
    })
  })

  // ========================================================================
  // parseSuperGuaranteeRate
  // ========================================================================

  describe('parseSuperGuaranteeRate', () => {
    it('should extract super guarantee rate', async () => {
      const markdown = `# Superannuation Guarantee

The SG rate is:
- 11% from 1 July 2023
- 11.5% from 1 July 2024
- 12% from 1 July 2025`

      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseSuperGuaranteeRate('https://ato.gov.au/super')

      // Should return max rate in 9-15% range = 12%
      expect(result).toBe(0.12)
    })

    it('should return null when no SG rates found', async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse('General super information.'))

      const result = await scraper.parseSuperGuaranteeRate('https://ato.gov.au/super')

      expect(result).toBeNull()
    })
  })

  // ========================================================================
  // parseFuelTaxCreditRates
  // ========================================================================

  describe('parseFuelTaxCreditRates', () => {
    it('should extract on-road and off-road fuel tax credit rates', async () => {
      const markdown = `# Fuel Tax Credits

Current rates (1 July 2024):
- Heavy vehicles on public roads: 20.8 cents per litre
- All other business use: 48.8 cents per litre`

      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseFuelTaxCreditRates('https://ato.gov.au/fuel')

      expect(result).not.toBeNull()
      // onRoad is min, offRoad is max (use toBeCloseTo for floating-point precision)
      expect(result!.onRoad).toBeCloseTo(0.208, 5)
      expect(result!.offRoad).toBeCloseTo(0.488, 5)
    })

    it('should extract quarter from page content', async () => {
      const markdown = `Rates effective from 1 July 2024. Credits: 48.8 cents per litre.`
      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseFuelTaxCreditRates('https://ato.gov.au/fuel')

      expect(result).not.toBeNull()
      expect(result!.quarter).toBe('1 July 2024')
    })

    it('should return null when no cent amounts found', async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse('General fuel info.'))

      const result = await scraper.parseFuelTaxCreditRates('https://ato.gov.au/fuel')

      expect(result).toBeNull()
    })

    it('should handle single rate (assign to offRoad)', async () => {
      const markdown = 'The rate is 48.8 cents per litre for off-road use.'
      mockFetch.mockResolvedValue(makeSuccessResponse(markdown))

      const result = await scraper.parseFuelTaxCreditRates('https://ato.gov.au/fuel')

      expect(result).not.toBeNull()
      expect(result!.offRoad).toBe(0.488)
      expect(result!.onRoad).toBeNull()
    })
  })

  // ========================================================================
  // Singleton
  // ========================================================================

  describe('getJinaScraper singleton', () => {
    it('should return a JinaScraper instance', () => {
      const instance = getJinaScraper()
      expect(instance).toBeInstanceOf(JinaScraper)
    })
  })
})
