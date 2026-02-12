/**
 * Unit tests for Brave Search API Client
 *
 * Tests cover:
 * - Search methods return relevant URLs
 * - Handles API errors
 * - Handles missing API key
 * - Rate-specific search methods (R&D, Div7A, corporate, etc.)
 * - Query construction with site restriction
 * - Freshness filter
 * - Result parsing
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

import { BraveSearchClient, getBraveClient } from '@/lib/search/brave-client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSearchResponse(results: Array<{ title: string; url: string; description: string }>) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      web: {
        results: results.map((r) => ({
          title: r.title,
          url: r.url,
          description: r.description,
          age: '2 days ago',
          language: 'en',
          family_friendly: true,
        })),
        total: results.length,
      },
    }),
  } as unknown as Response
}

function makeErrorResponse(status: number, statusText: string) {
  return {
    ok: false,
    status,
    statusText,
    json: vi.fn().mockResolvedValue({}),
  } as unknown as Response
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BraveSearchClient', () => {
  let client: BraveSearchClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new BraveSearchClient('test-brave-api-key')
  })

  // ========================================================================
  // Constructor
  // ========================================================================

  describe('constructor', () => {
    it('should accept an API key', () => {
      const c = new BraveSearchClient('my-key')
      expect(c).toBeInstanceOf(BraveSearchClient)
    })

    it('should fall back to BRAVE_API_KEY env var', () => {
      const original = process.env.BRAVE_API_KEY
      process.env.BRAVE_API_KEY = 'env-brave-key'

      const c = new BraveSearchClient()
      expect(c).toBeInstanceOf(BraveSearchClient)

      process.env.BRAVE_API_KEY = original
    })

    it('should throw when no API key is available', () => {
      const original = process.env.BRAVE_API_KEY
      delete process.env.BRAVE_API_KEY

      expect(() => new BraveSearchClient('')).toThrow('BRAVE_API_KEY is required')

      process.env.BRAVE_API_KEY = original
    })
  })

  // ========================================================================
  // search()
  // ========================================================================

  describe('search', () => {
    it('should return parsed search results', async () => {
      mockFetch.mockResolvedValue(
        makeSearchResponse([
          {
            title: 'Instant Asset Write-Off',
            url: 'https://ato.gov.au/write-off',
            description: 'Details about write-off thresholds.',
          },
        ])
      )

      const result = await client.search('instant asset write-off')

      expect(result.query).toBe('instant asset write-off')
      expect(result.results).toHaveLength(1)
      expect(result.results[0].title).toBe('Instant Asset Write-Off')
      expect(result.results[0].url).toBe('https://ato.gov.au/write-off')
      expect(result.results[0].description).toBe('Details about write-off thresholds.')
    })

    it('should send correct headers with subscription token', async () => {
      mockFetch.mockResolvedValue(makeSearchResponse([]))

      await client.search('test query')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.search.brave.com/res/v1/web/search'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Subscription-Token': 'test-brave-api-key',
            Accept: 'application/json',
          }),
        })
      )
    })

    it('should include site restriction in query when site option is provided', async () => {
      mockFetch.mockResolvedValue(makeSearchResponse([]))

      await client.search('tax rates', { site: 'ato.gov.au' })

      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('site%3Aato.gov.au')
    })

    it('should include freshness parameter when specified', async () => {
      mockFetch.mockResolvedValue(makeSearchResponse([]))

      await client.search('tax rates', { freshness: 'pm' })

      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('freshness=pm')
    })

    it('should set Australian locale parameters', async () => {
      mockFetch.mockResolvedValue(makeSearchResponse([]))

      await client.search('test')

      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('country=AU')
      expect(url).toContain('ui_lang=en-AU')
      expect(url).toContain('search_lang=en')
    })

    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(401, 'Unauthorized'))

      await expect(client.search('test')).rejects.toThrow('Failed to search')
    })

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('fetch failed'))

      await expect(client.search('test')).rejects.toThrow('Failed to search')
    })

    it('should handle empty web results gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ web: null }),
      })

      const result = await client.search('nonexistent query')

      expect(result.results).toHaveLength(0)
    })

    it('should handle missing optional fields in results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          web: {
            results: [{ title: 'Test', url: 'https://example.com' }],
            total: 1,
          },
        }),
      })

      const result = await client.search('test')

      expect(result.results[0].description).toBe('')
      expect(result.results[0].age).toBeUndefined()
    })
  })

  // ========================================================================
  // searchATO()
  // ========================================================================

  describe('searchATO', () => {
    it('should return the first result URL', async () => {
      mockFetch.mockResolvedValue(
        makeSearchResponse([
          {
            title: 'ATO Result',
            url: 'https://ato.gov.au/result-page',
            description: 'Result',
          },
        ])
      )

      const url = await client.searchATO('corporate tax rates')

      expect(url).toBe('https://ato.gov.au/result-page')
    })

    it('should restrict search to ato.gov.au', async () => {
      mockFetch.mockResolvedValue(makeSearchResponse([]))

      await client.searchATO('test')

      const fetchUrl = mockFetch.mock.calls[0][0] as string
      expect(fetchUrl).toContain('site%3Aato.gov.au')
    })

    it('should use past month freshness', async () => {
      mockFetch.mockResolvedValue(makeSearchResponse([]))

      await client.searchATO('test')

      const fetchUrl = mockFetch.mock.calls[0][0] as string
      expect(fetchUrl).toContain('freshness=pm')
    })

    it('should return null when no results found', async () => {
      mockFetch.mockResolvedValue(makeSearchResponse([]))

      const url = await client.searchATO('nonexistent topic')

      expect(url).toBeNull()
    })

    it('should return null on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const url = await client.searchATO('test')

      expect(url).toBeNull()
    })
  })

  // ========================================================================
  // Rate-specific search methods
  // ========================================================================

  describe('rate-specific search methods', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(
        makeSearchResponse([
          {
            title: 'ATO Page',
            url: 'https://ato.gov.au/rates-page',
            description: 'Tax rates',
          },
        ])
      )
    })

    it('findInstantWriteOffPage should search for write-off threshold', async () => {
      const url = await client.findInstantWriteOffPage()

      expect(url).toBe('https://ato.gov.au/rates-page')
      const fetchUrl = mockFetch.mock.calls[0][0] as string
      expect(fetchUrl).toContain('instant')
    })

    it('findRnDIncentivePage should search for R&D incentive', async () => {
      const url = await client.findRnDIncentivePage()

      expect(url).toBe('https://ato.gov.au/rates-page')
      const fetchUrl = mockFetch.mock.calls[0][0] as string
      expect(fetchUrl).toContain('incentive')
    })

    it('findHomeOfficeRatesPage should search for home office rates', async () => {
      const url = await client.findHomeOfficeRatesPage()

      expect(url).toBe('https://ato.gov.au/rates-page')
      const fetchUrl = mockFetch.mock.calls[0][0] as string
      expect(fetchUrl).toContain('home')
    })

    it('findDivision7ARatesPage should search for Division 7A rates', async () => {
      const url = await client.findDivision7ARatesPage()

      expect(url).toBe('https://ato.gov.au/rates-page')
      const fetchUrl = mockFetch.mock.calls[0][0] as string
      expect(fetchUrl).toContain('Division')
    })

    it('findCorporateTaxRatesPage should search for corporate tax rates', async () => {
      const url = await client.findCorporateTaxRatesPage()

      expect(url).toBe('https://ato.gov.au/rates-page')
      const fetchUrl = mockFetch.mock.calls[0][0] as string
      expect(fetchUrl).toContain('company')
    })

    it('findFBTRatesPage should search for FBT rates', async () => {
      const url = await client.findFBTRatesPage()

      expect(url).toBe('https://ato.gov.au/rates-page')
      const fetchUrl = mockFetch.mock.calls[0][0] as string
      expect(fetchUrl).toContain('fringe')
    })

    it('findSuperGuaranteeRatePage should search for super guarantee rate', async () => {
      const url = await client.findSuperGuaranteeRatePage()

      expect(url).toBe('https://ato.gov.au/rates-page')
      const fetchUrl = mockFetch.mock.calls[0][0] as string
      expect(fetchUrl).toContain('super')
    })

    it('findFuelTaxCreditRatesPage should search for fuel tax credit rates', async () => {
      const url = await client.findFuelTaxCreditRatesPage()

      expect(url).toBe('https://ato.gov.au/rates-page')
      const fetchUrl = mockFetch.mock.calls[0][0] as string
      expect(fetchUrl).toContain('fuel')
    })
  })

  // ========================================================================
  // Singleton
  // ========================================================================

  describe('getBraveClient singleton', () => {
    it('should return a BraveSearchClient instance', () => {
      // Set env key so constructor does not throw
      const original = process.env.BRAVE_API_KEY
      process.env.BRAVE_API_KEY = 'singleton-test-key'

      const instance = getBraveClient()
      expect(instance).toBeInstanceOf(BraveSearchClient)

      process.env.BRAVE_API_KEY = original
    })
  })
})
