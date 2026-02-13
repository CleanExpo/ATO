/**
 * Data Retention API Route Tests
 *
 * Tests for:
 * - GET /api/admin/data-retention - Retention status
 * - POST /api/admin/data-retention - Trigger enforcement
 *
 * Validates authentication, rate limiting, and response shape.
 *
 * @see s 262A ITAA 1936 - ATO 5-year record-keeping requirement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

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

// Enable single-user mode so requireAuth is bypassed (returns fake user)
vi.mock('@/lib/auth/single-user-check', () => ({
  isSingleUserMode: vi.fn(() => true),
}))

// Mock requireAuth to return an AuthenticatedRequest (not a NextResponse)
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'single-user', email: undefined },
      tenantId: '',
      supabase: null,
    })
  ),
  isErrorResponse: vi.fn((result: unknown) => result instanceof NextResponse),
}))

// Mock rate limiting -- default: not rate-limited
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockApplyRateLimit = vi.fn((..._args: any[]): NextResponse | null => null)

vi.mock('@/lib/middleware/apply-rate-limit', () => ({
  applyRateLimit: (...args: any[]) => mockApplyRateLimit(...args),
  RATE_LIMITS: {
    auth: { limit: 5, windowSeconds: 60 },
    analysis: { limit: 10, windowSeconds: 60 },
    api: { limit: 100, windowSeconds: 60 },
  },
}))

// Mock retention enforcer
const mockGetRetentionStatus = vi.fn()
const mockEnforceRetentionPolicies = vi.fn()

vi.mock('@/lib/data-retention/retention-enforcer', () => ({
  getRetentionStatus: (...args: unknown[]) => mockGetRetentionStatus(...args),
  enforceRetentionPolicies: (...args: unknown[]) => mockEnforceRetentionPolicies(...args),
}))

// Mock retention policies
vi.mock('@/lib/data-retention/retention-policy', () => ({
  RETENTION_POLICIES: [
    {
      table: 'historical_transactions_cache',
      retentionDays: 1825,
      description: 'Financial transaction records',
      legislation: 's 262A ITAA 1936',
    },
    {
      table: 'analysis_results',
      retentionDays: 365,
      description: 'AI analysis results',
      legislation: null,
    },
    {
      table: 'audit_logs',
      retentionDays: 2555,
      description: 'Security audit trail',
      legislation: null,
    },
  ],
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

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

// ---------------------------------------------------------------------------
// GET /api/admin/data-retention Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/data-retention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null) // Not rate-limited

    mockGetRetentionStatus.mockResolvedValue([
      {
        table: 'historical_transactions_cache',
        totalRecords: 11006,
        oldestRecord: '2020-07-01T00:00:00Z',
        expiringIn30Days: 0,
      },
      {
        table: 'analysis_results',
        totalRecords: 450,
        oldestRecord: '2025-06-01T00:00:00Z',
        expiringIn30Days: 12,
      },
      {
        table: 'audit_logs',
        totalRecords: 5200,
        oldestRecord: '2024-01-01T00:00:00Z',
        expiringIn30Days: 0,
      },
    ])
  })

  it('returns retention status with enriched policy metadata', async () => {
    const { GET } = await import('@/app/api/admin/data-retention/route')

    const req = new NextRequest('http://localhost:3000/api/admin/data-retention')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.timestamp).toBeDefined()
    expect(data.policies).toHaveLength(3)

    // Verify enrichment with policy metadata
    const txnPolicy = data.policies.find(
      (p: { table: string }) => p.table === 'historical_transactions_cache'
    )
    expect(txnPolicy.retentionDays).toBe(1825) // 5 years
    expect(txnPolicy.legislation).toBe('s 262A ITAA 1936')
    expect(txnPolicy.totalRecords).toBe(11006)
  })

  it('returns 429 when rate limited', async () => {
    mockApplyRateLimit.mockReturnValue(
      NextResponse.json(
        { error: 'Too Many Requests', message: 'Rate limit exceeded.' },
        { status: 429 }
      )
    )

    const { GET } = await import('@/app/api/admin/data-retention/route')

    const req = new NextRequest('http://localhost:3000/api/admin/data-retention')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.error).toContain('Too Many Requests')
  })

  it('requires authentication (returns auth error when requireAuth fails)', async () => {
    const { requireAuth } = await import('@/lib/auth/require-auth')
    vi.mocked(requireAuth).mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const { GET } = await import('@/app/api/admin/data-retention/route')

    const req = new NextRequest('http://localhost:3000/api/admin/data-retention')
    const response = await GET(req)

    expect(response.status).toBe(401)
  })

  it('returns 500 when getRetentionStatus throws', async () => {
    mockGetRetentionStatus.mockRejectedValue(new Error('Database unavailable'))

    const { GET } = await import('@/app/api/admin/data-retention/route')

    const req = new NextRequest('http://localhost:3000/api/admin/data-retention')
    const response = await GET(req)

    expect(response.status).toBe(500)
  })

  it('returns timestamp in ISO 8601 format', async () => {
    const { GET } = await import('@/app/api/admin/data-retention/route')

    const req = new NextRequest('http://localhost:3000/api/admin/data-retention')
    const response = await GET(req)
    const data = await response.json()

    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp)
  })
})

// ---------------------------------------------------------------------------
// POST /api/admin/data-retention Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/data-retention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)

    mockEnforceRetentionPolicies.mockResolvedValue([
      { table: 'analysis_results', deletedCount: 12, duration: 450 },
      { table: 'historical_transactions_cache', deletedCount: 0, duration: 120 },
      { table: 'audit_logs', deletedCount: 0, duration: 80 },
    ])
  })

  it('triggers retention enforcement and returns results', async () => {
    const { POST } = await import('@/app/api/admin/data-retention/route')

    const req = new NextRequest('http://localhost:3000/api/admin/data-retention', {
      method: 'POST',
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.totalDeleted).toBe(12)
    expect(data.results).toHaveLength(3)
    expect(data.results[0].table).toBe('analysis_results')
    expect(data.results[0].deletedCount).toBe(12)
  })

  it('returns 429 when rate limited', async () => {
    mockApplyRateLimit.mockReturnValue(
      NextResponse.json(
        { error: 'Too Many Requests', message: 'Rate limit exceeded.' },
        { status: 429 }
      )
    )

    const { POST } = await import('@/app/api/admin/data-retention/route')

    const req = new NextRequest('http://localhost:3000/api/admin/data-retention', {
      method: 'POST',
    })

    const response = await POST(req)
    expect(response.status).toBe(429)
  })

  it('requires authentication', async () => {
    const { requireAuth } = await import('@/lib/auth/require-auth')
    vi.mocked(requireAuth).mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const { POST } = await import('@/app/api/admin/data-retention/route')

    const req = new NextRequest('http://localhost:3000/api/admin/data-retention', {
      method: 'POST',
    })

    const response = await POST(req)
    expect(response.status).toBe(401)
  })

  it('returns 500 when enforcement throws', async () => {
    mockEnforceRetentionPolicies.mockRejectedValue(
      new Error('Deletion failed: foreign key constraint')
    )

    const { POST } = await import('@/app/api/admin/data-retention/route')

    const req = new NextRequest('http://localhost:3000/api/admin/data-retention', {
      method: 'POST',
    })

    const response = await POST(req)
    expect(response.status).toBe(500)
  })

  it('calculates totalDeleted as sum of all table deletions', async () => {
    mockEnforceRetentionPolicies.mockResolvedValue([
      { table: 'analysis_results', deletedCount: 50, duration: 200 },
      { table: 'historical_transactions_cache', deletedCount: 100, duration: 500 },
      { table: 'audit_logs', deletedCount: 25, duration: 100 },
    ])

    const { POST } = await import('@/app/api/admin/data-retention/route')

    const req = new NextRequest('http://localhost:3000/api/admin/data-retention', {
      method: 'POST',
    })

    const response = await POST(req)
    const data = await response.json()

    expect(data.totalDeleted).toBe(175)
    expect(data.results).toHaveLength(3)
  })

  it('uses analysis rate limits for POST (destructive operation)', async () => {
    const { POST } = await import('@/app/api/admin/data-retention/route')

    const req = new NextRequest('http://localhost:3000/api/admin/data-retention', {
      method: 'POST',
    })

    await POST(req)

    // Verify applyRateLimit was called with analysis limits
    expect(mockApplyRateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.objectContaining({ limit: 10, windowSeconds: 60 }),
      'admin:data-retention:post'
    )
  })
})
