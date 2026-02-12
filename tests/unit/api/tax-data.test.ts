/**
 * Tax Data API Route Tests
 *
 * Tests for:
 * - GET /api/tax-data/rates - Retrieve current tax rates
 * - POST /api/tax-data/refresh - Force refresh tax rates cache
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock getCurrentTaxRates for the rates route
const mockGetCurrentTaxRates = vi.fn()

vi.mock('@/lib/tax-data/cache-manager', () => ({
  getCurrentTaxRates: (...args: unknown[]) => mockGetCurrentTaxRates(...args),
  getCacheManager: vi.fn(() => ({
    clearCache: vi.fn().mockResolvedValue(undefined),
    getRates: vi.fn().mockResolvedValue({
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
      fuelTaxCreditOnRoad: 0.188,
      fuelTaxCreditOffRoad: 0.488,
      fuelTaxCreditQuarter: 'Q1',
      fetchedAt: '2026-02-12T00:00:00Z',
      sources: ['ato.gov.au'],
    }),
  })),
}))

// Mock requireAuth
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'test-user-id', email: 'test@example.com' },
      tenantId: 'tenant-123',
      supabase: null,
    })
  ),
  requireAuthOnly: vi.fn(() =>
    Promise.resolve({
      user: { id: 'test-user-id', email: 'test@example.com' },
      tenantId: '',
      supabase: null,
    })
  ),
  isErrorResponse: vi.fn((result: unknown) => result instanceof NextResponse),
}))

// Mock single-user-check
vi.mock('@/lib/auth/single-user-check', () => ({
  isSingleUserMode: vi.fn(() => true),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })
  ),
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}))

// ---------------------------------------------------------------------------
// GET /api/tax-data/rates Tests
// ---------------------------------------------------------------------------

describe('GET /api/tax-data/rates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentTaxRates.mockResolvedValue({
      instantWriteOffThreshold: 20000,
      homeOfficeRatePerHour: 0.67,
      rndOffsetRate: 0.435,
      rndOffsetRateSmallBusiness: 0.435,
      corporateTaxRateSmall: 0.25,
      corporateTaxRateStandard: 0.30,
      division7ABenchmarkRate: 0.0877,
      fetchedAt: '2026-02-12T00:00:00Z',
      cacheHit: true,
      cacheAge: 1200,
      sources: ['ato.gov.au'],
    })
  })

  it('returns tax rates with source metadata', async () => {
    const { GET } = await import('@/app/api/tax-data/rates/route')

    const req = new NextRequest('http://localhost:3000/api/tax-data/rates')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.instantWriteOffThreshold).toBe(20000)
    expect(data.data.rndOffsetRate).toBe(0.435)
    expect(data.data.corporateTaxRateSmall).toBe(0.25)
    expect(data.data.corporateTaxRateStandard).toBe(0.30)
    expect(data.data.division7ABenchmarkRate).toBe(0.0877)
    expect(data.data.fetchedAt).toBeDefined()
    expect(data.data.sources).toBeDefined()
  })

  it('sets Cache-Control header (public, 1hr)', async () => {
    const { GET } = await import('@/app/api/tax-data/rates/route')

    const req = new NextRequest('http://localhost:3000/api/tax-data/rates')
    const response = await GET(req)

    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=3600, stale-while-revalidate=300'
    )
  })

  it('includes cache metadata in response', async () => {
    const { GET } = await import('@/app/api/tax-data/rates/route')

    const req = new NextRequest('http://localhost:3000/api/tax-data/rates')
    const response = await GET(req)
    const data = await response.json()

    expect(data.data.cacheHit).toBe(true)
    expect(data.data.cacheAge).toBe(1200)
  })

  it('passes forceRefresh=true when refresh query param is present', async () => {
    const { GET } = await import('@/app/api/tax-data/rates/route')

    const req = new NextRequest('http://localhost:3000/api/tax-data/rates?refresh=true')
    await GET(req)

    expect(mockGetCurrentTaxRates).toHaveBeenCalledWith(true)
  })

  it('passes forceRefresh=false when no refresh query param', async () => {
    const { GET } = await import('@/app/api/tax-data/rates/route')

    const req = new NextRequest('http://localhost:3000/api/tax-data/rates')
    await GET(req)

    expect(mockGetCurrentTaxRates).toHaveBeenCalledWith(false)
  })

  it('requires auth for refresh requests', async () => {
    const { requireAuthOnly } = await import('@/lib/auth/require-auth')
    vi.mocked(requireAuthOnly).mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const { GET } = await import('@/app/api/tax-data/rates/route')

    const req = new NextRequest('http://localhost:3000/api/tax-data/rates?refresh=true')
    const response = await GET(req)

    expect(response.status).toBe(401)
  })

  it('does not require auth for non-refresh requests', async () => {
    const { GET } = await import('@/app/api/tax-data/rates/route')

    const req = new NextRequest('http://localhost:3000/api/tax-data/rates')
    const response = await GET(req)

    expect(response.status).toBe(200)
  })

  it('returns 500 when rate fetch fails', async () => {
    mockGetCurrentTaxRates.mockRejectedValue(new Error('Failed to connect to ATO website'))

    const { GET } = await import('@/app/api/tax-data/rates/route')

    const req = new NextRequest('http://localhost:3000/api/tax-data/rates')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Failed to fetch tax rates')
    expect(data.message).toBe('Failed to connect to ATO website')
  })

  it('returns correct data shape with all rate fields', async () => {
    const { GET } = await import('@/app/api/tax-data/rates/route')

    const req = new NextRequest('http://localhost:3000/api/tax-data/rates')
    const response = await GET(req)
    const data = await response.json()

    const expectedKeys = [
      'instantWriteOffThreshold',
      'homeOfficeRatePerHour',
      'rndOffsetRate',
      'rndOffsetRateSmallBusiness',
      'corporateTaxRateSmall',
      'corporateTaxRateStandard',
      'division7ABenchmarkRate',
      'fetchedAt',
      'cacheHit',
      'cacheAge',
      'sources',
    ]

    for (const key of expectedKeys) {
      expect(data.data).toHaveProperty(key)
    }
  })
})

// ---------------------------------------------------------------------------
// POST /api/tax-data/refresh Tests
// ---------------------------------------------------------------------------

describe('POST /api/tax-data/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('triggers cache refresh and returns updated rates', async () => {
    const { POST } = await import('@/app/api/tax-data/refresh/route')

    const req = new NextRequest('http://localhost:3000/api/tax-data/refresh', {
      method: 'POST',
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('Tax rates refreshed successfully')
    expect(data.data).toBeDefined()
    expect(data.data.instantWriteOffThreshold).toBe(20000)
  })

  it('requires authentication', async () => {
    const { requireAuth } = await import('@/lib/auth/require-auth')
    vi.mocked(requireAuth).mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const { POST } = await import('@/app/api/tax-data/refresh/route')

    const req = new NextRequest('http://localhost:3000/api/tax-data/refresh', {
      method: 'POST',
    })

    const response = await POST(req)
    expect(response.status).toBe(401)
  })

  it('returns refreshed rate data including FBT and super rates', async () => {
    const { POST } = await import('@/app/api/tax-data/refresh/route')

    const req = new NextRequest('http://localhost:3000/api/tax-data/refresh', {
      method: 'POST',
    })

    const response = await POST(req)
    const data = await response.json()

    expect(data.data.fbtRate).toBe(0.47)
    expect(data.data.fbtType1GrossUpRate).toBe(2.0802)
    expect(data.data.fbtType2GrossUpRate).toBe(1.8868)
    expect(data.data.superGuaranteeRate).toBe(0.12)
  })
})
