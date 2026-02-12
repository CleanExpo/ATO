/**
 * Recommendations API Route Tests
 *
 * Tests for GET /api/audit/recommendations.
 * Validates tenantId requirement, priority/taxArea filtering,
 * caching, and response shape.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next/server's after() which requires a request scope
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    after: vi.fn((fn: () => void) => { /* no-op in tests */ }),
  }
})

// Enable single-user mode so requireAuth is bypassed
vi.mock('@/lib/auth/single-user-check', () => ({
  isSingleUserMode: vi.fn(() => true),
}))

// Mock recommendation engine
const mockGenerateRecommendations = vi.fn()
const mockGetByPriority = vi.fn()
const mockGetByTaxArea = vi.fn()

vi.mock('@/lib/recommendations/recommendation-engine', () => ({
  generateRecommendations: (...args: unknown[]) => mockGenerateRecommendations(...args),
  getRecommendationsByPriority: (...args: unknown[]) => mockGetByPriority(...args),
  getRecommendationsByTaxArea: (...args: unknown[]) => mockGetByTaxArea(...args),
}))

// Mock cache manager -- pass through to the compute function
vi.mock('@/lib/cache/cache-manager', () => {
  const cacheManagerInstance = {
    getOrCompute: vi.fn(async (_key: string, computeFn: () => Promise<unknown>) => {
      return computeFn()
    }),
  }
  return {
    default: cacheManagerInstance,
    CacheKeys: {
      recommendations: (tenantId: string, priority?: string, taxArea?: string) =>
        `recs:${tenantId}:${priority || ''}:${taxArea || ''}`,
    },
    CacheTTL: {
      recommendations: 1800,
    },
  }
})

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

// Mock Supabase (needed by require-auth internals)
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
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/audit/recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: generateRecommendations returns a full summary
    mockGenerateRecommendations.mockResolvedValue({
      totalRecommendations: 15,
      totalEstimatedBenefit: 125000,
      totalAdjustedBenefit: 100000,
      totalNetBenefit: 95000,
      byTaxArea: { rnd: 5, deductions: 6, losses: 2, div7a: 2 },
      byPriority: { critical: 3, high: 5, medium: 4, low: 3 },
      byYear: { 'FY2023-24': 8, 'FY2024-25': 7 },
      byAmendmentWindow: { within: 12, expired: 3 },
      criticalRecommendations: [
        { id: 'rec-1', priority: 'critical', description: 'R&D offset unclaimed', estimatedBenefit: 43500 },
      ],
      recommendations: [],
    })

    mockGetByPriority.mockResolvedValue([
      { id: 'rec-1', priority: 'critical', description: 'R&D offset unclaimed', estimatedBenefit: 43500 },
      { id: 'rec-2', priority: 'critical', description: 'Div 7A shortfall', estimatedBenefit: 4716 },
    ])

    mockGetByTaxArea.mockResolvedValue([
      { id: 'rec-3', taxArea: 'rnd', description: 'R&D eligible activity', estimatedBenefit: 30000 },
    ])
  })

  it('returns full recommendations summary for tenant', async () => {
    const { GET } = await import('@/app/api/audit/recommendations/route')

    const req = new NextRequest('http://localhost:3000/api/audit/recommendations?tenantId=tenant-123')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.summary).toBeDefined()
    expect(data.summary.totalRecommendations).toBe(15)
    expect(data.summary.totalEstimatedBenefit).toBe(125000)
    expect(data.summary.byTaxArea).toBeDefined()
    expect(data.summary.byPriority).toBeDefined()
    expect(data.criticalRecommendations).toBeDefined()
    expect(data.recommendations).toBeDefined()
  })

  it('returns 400 when tenantId is missing', async () => {
    const { GET } = await import('@/app/api/audit/recommendations/route')

    const req = new NextRequest('http://localhost:3000/api/audit/recommendations')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('tenantId')
  })

  it('supports priority filtering', async () => {
    const { GET } = await import('@/app/api/audit/recommendations/route')

    const req = new NextRequest(
      'http://localhost:3000/api/audit/recommendations?tenantId=tenant-123&priority=critical'
    )
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.filter).toEqual({ priority: 'critical' })
    expect(data.count).toBe(2)
    expect(data.recommendations).toHaveLength(2)
    expect(mockGetByPriority).toHaveBeenCalledWith('tenant-123', 'critical')
  })

  it('returns 400 for invalid priority value', async () => {
    const { GET } = await import('@/app/api/audit/recommendations/route')

    const req = new NextRequest(
      'http://localhost:3000/api/audit/recommendations?tenantId=tenant-123&priority=urgent'
    )
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid priority')
  })

  it('supports taxArea filtering', async () => {
    const { GET } = await import('@/app/api/audit/recommendations/route')

    const req = new NextRequest(
      'http://localhost:3000/api/audit/recommendations?tenantId=tenant-123&taxArea=rnd'
    )
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.filter).toEqual({ taxArea: 'rnd' })
    expect(data.count).toBe(1)
    expect(data.recommendations).toHaveLength(1)
    expect(mockGetByTaxArea).toHaveBeenCalledWith('tenant-123', 'rnd')
  })

  it('returns 400 for invalid taxArea value', async () => {
    const { GET } = await import('@/app/api/audit/recommendations/route')

    const req = new NextRequest(
      'http://localhost:3000/api/audit/recommendations?tenantId=tenant-123&taxArea=payroll'
    )
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid taxArea')
  })

  it('sets Cache-Control header on all responses', async () => {
    const { GET } = await import('@/app/api/audit/recommendations/route')

    // Full summary
    const req1 = new NextRequest(
      'http://localhost:3000/api/audit/recommendations?tenantId=tenant-123'
    )
    const response1 = await GET(req1)
    expect(response1.headers.get('Cache-Control')).toBe(
      'private, max-age=300, stale-while-revalidate=60'
    )

    // Priority filter
    const req2 = new NextRequest(
      'http://localhost:3000/api/audit/recommendations?tenantId=tenant-123&priority=high'
    )
    const response2 = await GET(req2)
    expect(response2.headers.get('Cache-Control')).toBe(
      'private, max-age=300, stale-while-revalidate=60'
    )
  })

  it('returns 500 when recommendation engine throws', async () => {
    mockGenerateRecommendations.mockRejectedValue(
      new Error('Failed to query transactions')
    )

    const { GET } = await import('@/app/api/audit/recommendations/route')

    const req = new NextRequest(
      'http://localhost:3000/api/audit/recommendations?tenantId=tenant-123'
    )
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
  })

  it('passes startYear and endYear to generateRecommendations', async () => {
    const { GET } = await import('@/app/api/audit/recommendations/route')

    const req = new NextRequest(
      'http://localhost:3000/api/audit/recommendations?tenantId=tenant-123&startYear=FY2022-23&endYear=FY2024-25'
    )
    await GET(req)

    expect(mockGenerateRecommendations).toHaveBeenCalledWith(
      'tenant-123',
      'FY2022-23',
      'FY2024-25'
    )
  })
})
