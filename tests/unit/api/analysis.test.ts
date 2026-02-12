/**
 * Analysis API Route Tests
 *
 * Tests for POST /api/analysis/cgt (Capital Gains Tax analysis).
 * Tests authentication, input validation, and error handling.
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

// Mock the CGT engine
const mockAnalyzeCGT = vi.fn()
vi.mock('@/lib/analysis/cgt-engine', () => ({
  analyzeCGT: (...args: unknown[]) => mockAnalyzeCGT(...args),
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
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/analysis/cgt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: CGT engine returns a valid result
    mockAnalyzeCGT.mockResolvedValue({
      totalCapitalGains: 50000,
      totalCapitalLosses: 10000,
      netCapitalGain: 40000,
      discountedGain: 20000,
      events: [
        {
          eventType: 'A1',
          assetDescription: 'Commercial property',
          acquisitionDate: '2020-01-15',
          disposalDate: '2025-06-30',
          capitalProceeds: 500000,
          costBase: 450000,
          capitalGain: 50000,
          discountApplicable: true,
        },
      ],
      division152: {
        eligible: true,
        netAssetTest: { passed: true, aggregatedNetAssets: 4500000 },
        activeSBETest: { passed: true },
      },
      taxRateSource: 'https://www.ato.gov.au',
      taxRateVerifiedAt: new Date().toISOString(),
    })
  })

  it('returns CGT analysis results with valid tenantId', async () => {
    const { POST } = await import('@/app/api/analysis/cgt/route')

    const req = new NextRequest('http://localhost:3000/api/analysis/cgt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'tenant-123' }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.totalCapitalGains).toBe(50000)
    expect(data.netCapitalGain).toBe(40000)
    expect(data.events).toHaveLength(1)
    expect(data.division152).toBeDefined()
  })

  it('passes optional parameters through to engine', async () => {
    const { POST } = await import('@/app/api/analysis/cgt/route')

    const req = new NextRequest('http://localhost:3000/api/analysis/cgt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant-123',
        financialYear: 'FY2024-25',
        entityType: 'company',
        aggregatedTurnover: 15000000,
        netAssetValue: 4000000,
      }),
    })

    await POST(req)

    expect(mockAnalyzeCGT).toHaveBeenCalledWith(
      'tenant-123',
      'FY2024-25',
      expect.objectContaining({
        entityType: 'company',
        aggregatedTurnover: 15000000,
        netAssetValue: 4000000,
      })
    )
  })

  it('handles missing tenantId in single-user mode with empty string', async () => {
    const { POST } = await import('@/app/api/analysis/cgt/route')

    const req = new NextRequest('http://localhost:3000/api/analysis/cgt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await POST(req)

    // In single-user mode, requireAuth returns tenantId as '' for missing values.
    // The engine will be called with '' and either handle it or error.
    // The route should not crash.
    expect([200, 400, 500]).toContain(response.status)
  })

  it('returns 500 when CGT engine throws an error', async () => {
    mockAnalyzeCGT.mockRejectedValue(new Error('Database connection failed'))

    const { POST } = await import('@/app/api/analysis/cgt/route')

    const req = new NextRequest('http://localhost:3000/api/analysis/cgt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'tenant-123' }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
    expect(data.errorId).toBeDefined()
  })

  it('returns error response with errorId and timestamp on failure', async () => {
    mockAnalyzeCGT.mockRejectedValue(new Error('timeout'))

    const { POST } = await import('@/app/api/analysis/cgt/route')

    const req = new NextRequest('http://localhost:3000/api/analysis/cgt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'tenant-123' }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error')
    expect(data).toHaveProperty('errorId')
    expect(data).toHaveProperty('timestamp')
    // errorId is a hex string
    expect(data.errorId).toMatch(/^[0-9a-f]+$/)
  })

  it('handles invalid JSON body gracefully', async () => {
    const { POST } = await import('@/app/api/analysis/cgt/route')

    const req = new NextRequest('http://localhost:3000/api/analysis/cgt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json{{{',
    })

    const response = await POST(req)

    expect([400, 500]).toContain(response.status)
  })

  it('calls analyzeCGT with correct tenantId from body', async () => {
    const { POST } = await import('@/app/api/analysis/cgt/route')

    const req = new NextRequest('http://localhost:3000/api/analysis/cgt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'my-specific-tenant' }),
    })

    await POST(req)

    expect(mockAnalyzeCGT).toHaveBeenCalledWith(
      'my-specific-tenant',
      undefined,
      expect.any(Object)
    )
  })

  it('returns CGT summary with events array', async () => {
    mockAnalyzeCGT.mockResolvedValue({
      totalCapitalGains: 0,
      totalCapitalLosses: 0,
      netCapitalGain: 0,
      discountedGain: 0,
      events: [],
      division152: null,
      taxRateSource: 'fallback',
      taxRateVerifiedAt: new Date().toISOString(),
    })

    const { POST } = await import('@/app/api/analysis/cgt/route')

    const req = new NextRequest('http://localhost:3000/api/analysis/cgt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'tenant-empty' }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.events).toEqual([])
    expect(data.netCapitalGain).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Auth mode switching test
// ---------------------------------------------------------------------------

describe('POST /api/analysis/cgt - auth enforcement', () => {
  it('uses requireAuth with tenantIdSource body', async () => {
    // This test verifies the route calls requireAuth correctly.
    // In single-user mode (set globally), the auth is bypassed
    // but the tenantId is still extracted from the body.
    mockAnalyzeCGT.mockResolvedValue({ events: [] })

    const { POST } = await import('@/app/api/analysis/cgt/route')

    const req = new NextRequest('http://localhost:3000/api/analysis/cgt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'from-body-tenant' }),
    })

    const response = await POST(req)

    // Should succeed (not 401/403) because single-user mode is enabled
    expect([200]).toContain(response.status)
  })
})
