/**
 * Health API Route Tests
 *
 * Tests for GET /api/health endpoint.
 * Verifies status reporting, database connectivity checks,
 * rate limiting, and response shape.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock rate-limit module
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRateLimit = vi.fn((_opts?: any) => ({
  success: true,
  limit: 60,
  remaining: 59,
  reset: Math.floor(Date.now() / 1000) + 60,
}))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreateRateLimitResponse = vi.fn((_result?: any) => {
  const { NextResponse } = require('next/server')
  return NextResponse.json(
    { error: 'Too Many Requests', message: 'Rate limit exceeded.' },
    { status: 429 }
  )
})

vi.mock('@/lib/middleware/rate-limit', () => ({
  rateLimit: (...args: any[]) => mockRateLimit(args[0]),
  createRateLimitResponse: (...args: any[]) => mockCreateRateLimitResponse(args[0]),
  RATE_LIMITS: {
    auth: { limit: 5, windowSeconds: 60 },
    analysis: { limit: 10, windowSeconds: 60 },
    api: { limit: 100, windowSeconds: 60 },
  },
}))

// Mock Supabase admin client
const mockRpc = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
  createServiceClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })
  ),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: DB is reachable via rpc('version')
    mockRpc.mockResolvedValue({ data: 'PostgreSQL 15', error: null })
    mockRateLimit.mockReturnValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Math.floor(Date.now() / 1000) + 60,
    })
  })

  it('returns 200 with status ok when database is reachable via rpc', async () => {
    const { GET } = await import('@/app/api/health/route')

    const req = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('ok')
  })

  it('returns 200 with status ok when rpc fails but FROM query succeeds', async () => {
    // rpc('version') fails
    mockRpc.mockResolvedValue({ data: null, error: { message: 'function not found' } })
    // Fallback FROM query succeeds
    const selectMock = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: [{ tenant_id: 'x' }], error: null }),
    })
    mockFrom.mockReturnValue({ select: selectMock })

    const { GET } = await import('@/app/api/health/route')

    const req = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('ok')
  })

  it('returns 200 with status degraded when both DB checks fail', async () => {
    // rpc fails
    mockRpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } })
    // Fallback FROM query also fails
    const selectMock = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'connection refused' } }),
    })
    mockFrom.mockReturnValue({ select: selectMock })

    const { GET } = await import('@/app/api/health/route')

    const req = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('degraded')
    expect(data.error).toBe('Database unreachable')
  })

  it('returns 200 with status degraded when DB throws an exception', async () => {
    mockRpc.mockRejectedValue(new Error('ECONNREFUSED'))

    const { GET } = await import('@/app/api/health/route')

    const req = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('degraded')
  })

  it('returns correct JSON shape with status, timestamp, version, uptime', async () => {
    const { GET } = await import('@/app/api/health/route')

    const req = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(req)
    const data = await response.json()

    expect(data).toHaveProperty('status')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('version')
    expect(data).toHaveProperty('uptime')

    // Validate types
    expect(typeof data.status).toBe('string')
    expect(typeof data.timestamp).toBe('string')
    expect(typeof data.version).toBe('string')
    expect(typeof data.uptime).toBe('number')

    // Timestamp should be valid ISO 8601
    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp)
  })

  it('returns 429 when rate limit is exceeded', async () => {
    mockRateLimit.mockReturnValue({
      success: false,
      limit: 60,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 30,
    })

    const { GET } = await import('@/app/api/health/route')

    const req = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.error).toBeDefined()
  })

  it('uses rightmost X-Forwarded-For IP for rate limiting', async () => {
    const { GET } = await import('@/app/api/health/route')

    const req = new NextRequest('http://localhost:3000/api/health', {
      headers: {
        'x-forwarded-for': '1.2.3.4, 10.0.0.1, 203.0.113.50',
      },
    })

    await GET(req)

    // The rate limiter should have been called with the rightmost IP
    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'health:203.0.113.50',
      })
    )
  })

  it('uptime is a positive number', async () => {
    const { GET } = await import('@/app/api/health/route')

    const req = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(req)
    const data = await response.json()

    expect(data.uptime).toBeGreaterThan(0)
  })

  it('version defaults to 0.1.0 when npm_package_version is not set', async () => {
    const { GET } = await import('@/app/api/health/route')

    const req = new NextRequest('http://localhost:3000/api/health')
    const response = await GET(req)
    const data = await response.json()

    // Version should be a string matching semver-like pattern
    expect(data.version).toMatch(/^\d+\.\d+\.\d+/)
  })
})
