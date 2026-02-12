/**
 * Audit Analyze API Route Tests
 *
 * Tests for:
 * - POST /api/audit/analyze - Start AI forensic analysis
 * - GET /api/audit/analyze - Check analysis status
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

// Enable single-user mode so requireAuth is bypassed
vi.mock('@/lib/auth/single-user-check', () => ({
  isSingleUserMode: vi.fn(() => true),
}))

// Mock batch-processor
const mockAnalyzeAllTransactions = vi.fn()
const mockGetAnalysisStatus = vi.fn()

vi.mock('@/lib/ai/batch-processor', () => ({
  analyzeAllTransactions: (...args: unknown[]) => mockAnalyzeAllTransactions(...args),
  getAnalysisStatus: (...args: unknown[]) => mockGetAnalysisStatus(...args),
}))

// Mock forensic-analyzer
vi.mock('@/lib/ai/forensic-analyzer', () => ({
  estimateAnalysisCost: vi.fn((count: number) => ({
    inputTokens: count * 100,
    outputTokens: count * 50,
    estimatedCostUSD: count * 0.0001,
  })),
}))

// Mock validation middleware
vi.mock('@/lib/api/validation-middleware', () => ({
  validateRequestBody: vi.fn(async (req: Request, _schema: unknown) => {
    try {
      const body = await req.json()
      return { success: true, data: body }
    } catch {
      return {
        success: false,
        response: NextResponse.json({ error: 'Invalid request body' }, { status: 400 }),
      }
    }
  }),
  validateRequestQuery: vi.fn((req: Request, _schema: unknown) => {
    const url = new URL(req.url)
    const tenantId = url.searchParams.get('tenantId')
    if (!tenantId) {
      return {
        success: false,
        response: NextResponse.json({ error: 'tenantId is required' }, { status: 400 }),
      }
    }
    return { success: true, data: { tenantId } }
  }),
}))

// Mock validation schemas
vi.mock('@/lib/validation/schemas', () => ({
  analyzeRequestSchema: {},
  tenantIdQuerySchema: {},
}))

// Mock retry utility
vi.mock('@/lib/api/retry', () => ({
  retry: vi.fn((fn: () => Promise<unknown>) => fn()),
}))

// Mock distributed rate limiting
const mockApplyDistributedRateLimit = vi.fn()

vi.mock('@/lib/middleware/apply-rate-limit', () => ({
  applyDistributedRateLimit: (...args: unknown[]) => mockApplyDistributedRateLimit(...args),
  DISTRIBUTED_RATE_LIMITS: {
    analysis: { limit: 10, windowSeconds: 60 },
    api: { limit: 100, windowSeconds: 60 },
  },
}))

// Mock Supabase (used by getCachedTransactionCount)
const mockSupabaseSelect = vi.fn()

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
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 100, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
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

// Mock error helpers
vi.mock('@/lib/api/errors', () => ({
  createErrorResponse: vi.fn((_error: unknown, _context: unknown, status = 500) =>
    NextResponse.json(
      { error: 'Internal error', errorId: 'abc123', timestamp: new Date().toISOString() },
      { status }
    )
  ),
  createValidationError: vi.fn((message: string) =>
    NextResponse.json({ error: message }, { status: 400 })
  ),
}))

// ---------------------------------------------------------------------------
// POST /api/audit/analyze Tests
// ---------------------------------------------------------------------------

describe('POST /api/audit/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyDistributedRateLimit.mockResolvedValue(null) // Not rate-limited
    mockGetAnalysisStatus.mockResolvedValue(null) // No existing analysis
  })

  it('starts analysis and returns status with cost estimate', async () => {
    const { POST } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'tenant-123' }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('analyzing')
    expect(data.progress).toBe(0)
    expect(data.totalTransactions).toBeDefined()
    expect(data.estimatedCostUSD).toBeDefined()
    expect(data.pollUrl).toContain('/api/audit/analysis-status/')
  })

  it('returns 400 when no cached transactions exist', async () => {
    // Override admin client to return 0 count
    const { createAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createAdminClient).mockReturnValueOnce({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      })),
    } as any)

    const { POST } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'tenant-123' }),
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  it('returns already-in-progress status when analysis is running', async () => {
    mockGetAnalysisStatus.mockResolvedValue({
      status: 'analyzing',
      progress: 45,
      transactionsAnalyzed: 45,
      totalTransactions: 100,
      estimatedCostUSD: 0.01,
    })

    const { POST } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'tenant-123' }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('analyzing')
    expect(data.progress).toBe(45)
    expect(data.message).toBe('Analysis already in progress')
  })

  it('is rate limited', async () => {
    mockApplyDistributedRateLimit.mockResolvedValue(
      NextResponse.json(
        { error: 'Too Many Requests', message: 'Rate limit exceeded.' },
        { status: 429 }
      )
    )

    const { POST } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'tenant-123' }),
    })

    const response = await POST(req)
    expect(response.status).toBe(429)
  })

  it('handles invalid JSON body gracefully', async () => {
    const { validateRequestBody } = await import('@/lib/api/validation-middleware')
    vi.mocked(validateRequestBody).mockResolvedValueOnce({
      success: false,
      response: NextResponse.json({ error: 'Invalid request body' }, { status: 400 }),
    } as any)

    const { POST } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{',
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  it('returns cost breakdown in response', async () => {
    const { POST } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'tenant-123' }),
    })

    const response = await POST(req)
    const data = await response.json()

    if (data.costBreakdown) {
      expect(data.costBreakdown).toHaveProperty('inputTokens')
      expect(data.costBreakdown).toHaveProperty('outputTokens')
      expect(data.costBreakdown).toHaveProperty('totalCost')
    }
  })
})

// ---------------------------------------------------------------------------
// GET /api/audit/analyze Tests
// ---------------------------------------------------------------------------

describe('GET /api/audit/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyDistributedRateLimit.mockResolvedValue(null)
  })

  it('returns idle status when no analysis has been started', async () => {
    mockGetAnalysisStatus.mockResolvedValue(null)

    const { GET } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze?tenantId=tenant-123')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('idle')
    expect(data.message).toBe('No analysis has been started yet')
  })

  it('returns current analysis status', async () => {
    mockGetAnalysisStatus.mockResolvedValue({
      status: 'complete',
      progress: 100,
      transactionsAnalyzed: 100,
      totalTransactions: 100,
      estimatedCostUSD: 0.01,
      errorMessage: null,
    })

    const { GET } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze?tenantId=tenant-123')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('complete')
    expect(data.progress).toBe(100)
    expect(data.message).toBe('AI analysis complete')
  })

  it('returns 400 when tenantId is missing', async () => {
    const { GET } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze')
    const response = await GET(req)

    expect(response.status).toBe(400)
  })

  it('returns 500 when status check throws', async () => {
    mockGetAnalysisStatus.mockRejectedValue(new Error('Database unavailable'))

    const { GET } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze?tenantId=tenant-123')
    const response = await GET(req)

    expect(response.status).toBe(500)
  })
})
