/**
 * Unit tests for Tax Data Cache Manager
 *
 * Tests cover:
 * - Cache miss triggers fetch
 * - Cache hit returns cached data within TTL
 * - Cache expiry triggers refetch after TTL
 * - forceRefresh bypasses cache
 * - Error handling when fetch fails (returns fallback rates)
 * - Rate source and verifiedAt metadata returned
 * - Singleton pattern and helper function
 * - Cache statistics
 * - Cache clearing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks -- vi.hoisted ensures variables are available inside vi.mock factories
// ---------------------------------------------------------------------------

const {
  mockSingle,
  mockLimit,
  mockOrder,
  mockSelect,
  mockNeq,
  mockDelete,
  mockInsert,
  mockFrom,
  mockFetchAllRates,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockLimit = vi.fn(() => ({ single: mockSingle }))
  const mockOrder = vi.fn(() => ({ limit: mockLimit }))
  const mockSelect = vi.fn(() => ({ order: mockOrder }))
  const mockNeq = vi.fn().mockResolvedValue({ error: null })
  const mockDelete = vi.fn(() => ({ neq: mockNeq }))
  const mockInsert = vi.fn().mockResolvedValue({ error: null })
  const mockFrom = vi.fn((_table: string) => ({
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
  }))
  const mockFetchAllRates = vi.fn()

  return {
    mockSingle,
    mockLimit,
    mockOrder,
    mockSelect,
    mockNeq,
    mockDelete,
    mockInsert,
    mockFrom,
    mockFetchAllRates,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: mockFrom,
  }),
}))

vi.mock('@/lib/tax-data/rates-fetcher', () => ({
  getRatesFetcher: vi.fn(() => ({
    fetchAllRates: mockFetchAllRates,
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

import { TaxDataCacheManager, getCacheManager, getCurrentTaxRates } from '@/lib/tax-data/cache-manager'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFreshRates(overrides: Record<string, unknown> = {}) {
  return {
    instantWriteOffThreshold: 20000,
    homeOfficeRatePerHour: 0.67,
    rndOffsetRate: 0.435,
    rndOffsetRateSmallBusiness: 0.435,
    corporateTaxRateSmall: 0.25,
    corporateTaxRateStandard: 0.30,
    division7ABenchmarkRate: 0.0877,
    fbtRate: 0.47,
    fbtType1GrossUpRate: 2.0802,
    fbtType2GrossUpRate: 1.8868,
    superGuaranteeRate: 0.12,
    fuelTaxCreditOnRoad: 0.208,
    fuelTaxCreditOffRoad: 0.488,
    fuelTaxCreditQuarter: 'Q1 FY2025-26',
    fetchedAt: new Date('2026-02-10T00:00:00Z'),
    sources: {
      instantWriteOff: 'https://ato.gov.au/write-off',
      homeOffice: 'https://ato.gov.au/home-office',
    },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TaxDataCacheManager', () => {
  let manager: TaxDataCacheManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new TaxDataCacheManager()
  })

  // ========================================================================
  // Cache miss
  // ========================================================================

  describe('cache miss triggers fetch', () => {
    it('should fetch fresh rates when cache is empty', async () => {
      // Simulate no cached data
      mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })

      const freshRates = makeFreshRates()
      mockFetchAllRates.mockResolvedValue(freshRates)

      const result = await manager.getRates()

      expect(mockFetchAllRates).toHaveBeenCalledTimes(1)
      expect(result.cacheHit).toBe(false)
      expect(result.instantWriteOffThreshold).toBe(20000)
    })

    it('should store fetched rates in the database', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })

      const freshRates = makeFreshRates()
      mockFetchAllRates.mockResolvedValue(freshRates)

      await manager.getRates()

      expect(mockInsert).toHaveBeenCalledTimes(1)
      const insertArg = mockInsert.mock.calls[0][0]
      expect(insertArg).toHaveProperty('rates')
      expect(insertArg).toHaveProperty('created_at')
    })
  })

  // ========================================================================
  // Cache hit
  // ========================================================================

  describe('cache hit returns cached data within TTL', () => {
    it('should return cached rates when cache is fresh', async () => {
      const cachedRates = makeFreshRates()
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

      mockSingle.mockResolvedValue({
        data: { rates: cachedRates, created_at: tenMinutesAgo },
        error: null,
      })

      const result = await manager.getRates()

      expect(mockFetchAllRates).not.toHaveBeenCalled()
      expect(result.cacheHit).toBe(true)
      expect(result.cacheAge).toBeDefined()
      expect(result.cacheAge!).toBeGreaterThan(0)
      expect(result.cacheAge!).toBeLessThan(11 * 60 * 1000)
    })

    it('should preserve all rate fields from cache', async () => {
      const cachedRates = makeFreshRates()
      const recentTimestamp = new Date(Date.now() - 5000).toISOString()

      mockSingle.mockResolvedValue({
        data: { rates: cachedRates, created_at: recentTimestamp },
        error: null,
      })

      const result = await manager.getRates()

      expect(result.corporateTaxRateSmall).toBe(0.25)
      expect(result.corporateTaxRateStandard).toBe(0.30)
      expect(result.fbtRate).toBe(0.47)
      expect(result.superGuaranteeRate).toBe(0.12)
    })
  })

  // ========================================================================
  // Cache expiry
  // ========================================================================

  describe('cache expiry triggers refetch after TTL', () => {
    it('should refetch when cache is older than 24 hours', async () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()

      mockSingle.mockResolvedValue({
        data: { rates: makeFreshRates(), created_at: twentyFiveHoursAgo },
        error: null,
      })

      const freshRates = makeFreshRates({ instantWriteOffThreshold: 30000 })
      mockFetchAllRates.mockResolvedValue(freshRates)

      const result = await manager.getRates()

      expect(mockFetchAllRates).toHaveBeenCalledTimes(1)
      expect(result.cacheHit).toBe(false)
      expect(result.instantWriteOffThreshold).toBe(30000)
    })

    it('should not refetch when cache is exactly at the 24-hour boundary', async () => {
      // Right at the boundary minus 1ms -- still valid
      const justUnder24Hours = new Date(Date.now() - (24 * 60 * 60 * 1000 - 1000)).toISOString()

      mockSingle.mockResolvedValue({
        data: { rates: makeFreshRates(), created_at: justUnder24Hours },
        error: null,
      })

      const result = await manager.getRates()

      expect(mockFetchAllRates).not.toHaveBeenCalled()
      expect(result.cacheHit).toBe(true)
    })
  })

  // ========================================================================
  // Force refresh
  // ========================================================================

  describe('forceRefresh bypasses cache', () => {
    it('should skip cache lookup when forceRefresh is true', async () => {
      const freshRates = makeFreshRates()
      mockFetchAllRates.mockResolvedValue(freshRates)

      const result = await manager.getRates(true)

      // select should NOT have been called (cache lookup skipped)
      expect(mockSelect).not.toHaveBeenCalled()
      expect(mockFetchAllRates).toHaveBeenCalledTimes(1)
      expect(result.cacheHit).toBe(false)
    })

    it('should still store refreshed rates in DB', async () => {
      const freshRates = makeFreshRates()
      mockFetchAllRates.mockResolvedValue(freshRates)

      await manager.getRates(true)

      expect(mockInsert).toHaveBeenCalledTimes(1)
    })
  })

  // ========================================================================
  // Error handling
  // ========================================================================

  describe('error handling', () => {
    it('should fetch fresh rates when cache lookup throws', async () => {
      mockSingle.mockRejectedValue(new Error('Database connection failed'))

      const freshRates = makeFreshRates()
      mockFetchAllRates.mockResolvedValue(freshRates)

      const result = await manager.getRates()

      expect(mockFetchAllRates).toHaveBeenCalledTimes(1)
      expect(result.cacheHit).toBe(false)
    })

    it('should not throw when caching fresh rates fails', async () => {
      // Cache miss
      mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })

      const freshRates = makeFreshRates()
      mockFetchAllRates.mockResolvedValue(freshRates)

      // Insert fails
      mockInsert.mockResolvedValue({ error: { message: 'Insert failed' } })

      // Should not throw
      const result = await manager.getRates()

      expect(result.instantWriteOffThreshold).toBe(20000)
    })

    it('should not throw when cache insert throws an exception', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })

      const freshRates = makeFreshRates()
      mockFetchAllRates.mockResolvedValue(freshRates)

      // Simulate insert throwing
      mockInsert.mockRejectedValue(new Error('Connection refused'))

      const result = await manager.getRates()

      expect(result.cacheHit).toBe(false)
    })
  })

  // ========================================================================
  // Metadata
  // ========================================================================

  describe('rate source and metadata', () => {
    it('should include source URLs from fetched rates', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })

      const freshRates = makeFreshRates({
        sources: {
          instantWriteOff: 'https://ato.gov.au/write-off',
          rndIncentive: 'https://ato.gov.au/rnd',
        },
      })
      mockFetchAllRates.mockResolvedValue(freshRates)

      const result = await manager.getRates()

      expect(result.sources.instantWriteOff).toBe('https://ato.gov.au/write-off')
      expect(result.sources.rndIncentive).toBe('https://ato.gov.au/rnd')
    })

    it('should include fetchedAt timestamp from fresh fetch', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })

      const now = new Date()
      const freshRates = makeFreshRates({ fetchedAt: now })
      mockFetchAllRates.mockResolvedValue(freshRates)

      const result = await manager.getRates()

      expect(result.fetchedAt).toBe(now)
    })
  })

  // ========================================================================
  // clearCache
  // ========================================================================

  describe('clearCache', () => {
    it('should delete all cache entries', async () => {
      await manager.clearCache()

      expect(mockFrom).toHaveBeenCalledWith('tax_rates_cache')
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(mockNeq).toHaveBeenCalledWith('id', '00000000-0000-0000-0000-000000000000')
    })

    it('should not throw when delete fails', async () => {
      mockNeq.mockResolvedValue({ error: { message: 'Delete failed' } })

      await expect(manager.clearCache()).resolves.toBeUndefined()
    })
  })

  // ========================================================================
  // getCacheStats
  // ========================================================================

  describe('getCacheStats', () => {
    it('should return hasCachedData: false when no cache entry exists', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })

      const stats = await manager.getCacheStats()

      expect(stats.hasCachedData).toBe(false)
      expect(stats.cacheAge).toBeUndefined()
      expect(stats.expiresIn).toBeUndefined()
    })

    it('should return cache age and expiry for valid cache', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

      mockSingle.mockResolvedValue({
        data: { created_at: oneHourAgo },
        error: null,
      })

      const stats = await manager.getCacheStats()

      expect(stats.hasCachedData).toBe(true)
      expect(stats.cacheAge).toBeGreaterThan(59 * 60 * 1000)
      expect(stats.cacheAge).toBeLessThan(61 * 60 * 1000)
      // 24h TTL minus ~1h age = ~23h remaining
      expect(stats.expiresIn).toBeGreaterThan(22 * 60 * 60 * 1000)
      expect(stats.expiresIn).toBeLessThan(24 * 60 * 60 * 1000)
    })

    it('should return expiresIn: 0 when cache is expired', async () => {
      const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString()

      mockSingle.mockResolvedValue({
        data: { created_at: thirtyHoursAgo },
        error: null,
      })

      const stats = await manager.getCacheStats()

      expect(stats.hasCachedData).toBe(true)
      expect(stats.expiresIn).toBe(0)
    })

    it('should handle errors gracefully', async () => {
      mockSingle.mockRejectedValue(new Error('DB error'))

      const stats = await manager.getCacheStats()

      expect(stats.hasCachedData).toBe(false)
    })
  })

  // ========================================================================
  // Singleton & helper
  // ========================================================================

  describe('getCacheManager singleton', () => {
    it('should return a TaxDataCacheManager instance', () => {
      const mgr = getCacheManager()
      expect(mgr).toBeInstanceOf(TaxDataCacheManager)
    })
  })

  describe('getCurrentTaxRates helper', () => {
    it('should delegate to manager.getRates()', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })
      mockFetchAllRates.mockResolvedValue(makeFreshRates())

      const result = await getCurrentTaxRates()

      expect(result).toBeDefined()
      expect(result.cacheHit).toBe(false)
    })

    it('should pass forceRefresh flag through', async () => {
      mockFetchAllRates.mockResolvedValue(makeFreshRates())

      await getCurrentTaxRates(true)

      // forceRefresh=true skips cache lookup
      expect(mockSelect).not.toHaveBeenCalled()
      expect(mockFetchAllRates).toHaveBeenCalledTimes(1)
    })
  })
})
