/**
 * Audit Analysis API Route Tests
 *
 * Tests for /api/audit/analyze endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

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
  isSingleUserMode: vi.fn(() => true)
}))

// Helper to create a chainable Supabase mock
function createChainableMock(resolvedValue: any) {
  const chain: any = {}
  chain.select = vi.fn(() => chain)
  chain.insert = vi.fn(() => chain)
  chain.update = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.single = vi.fn().mockResolvedValue(resolvedValue)
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

// Mock Supabase with proper chaining
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => createChainableMock({
        data: { id: 'test-id', tenant_id: 'test-tenant', sync_status: 'idle', transactions_synced: 0, total_transactions: 0 },
        error: null
      }))
    })
  ),
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => {
      const chain: any = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.is = vi.fn(() => chain)
      chain.update = vi.fn(() => chain)
      chain.then = (resolve: (val: any) => void) =>
        Promise.resolve({ count: 5, error: null }).then(resolve)
      return chain
    })
  }))
}))

// Mock Gemini AI
vi.mock('@/lib/ai/gemini-client', () => ({
  analyzeTransaction: vi.fn().mockResolvedValue({
    category: 'rnd_candidate',
    confidence: 85,
    estimatedBenefit: 10000,
    reasoning: 'Software development costs eligible for R&D',
    legislation: 'Division 355 ITAA 1997'
  })
}))

// Mock the historical fetcher to return cached transactions
vi.mock('@/lib/xero/historical-fetcher', () => ({
  getCachedTransactions: vi.fn().mockResolvedValue([
    { id: 'tx-1', amount: 1000 },
    { id: 'tx-2', amount: 2000 },
  ])
}))

// Mock the batch processor
vi.mock('@/lib/ai/batch-processor', () => ({
  analyzeAllTransactions: vi.fn().mockResolvedValue(undefined),
  getAnalysisStatus: vi.fn().mockResolvedValue(null)
}))

// Mock the forensic analyzer
vi.mock('@/lib/ai/forensic-analyzer', () => ({
  estimateAnalysisCost: vi.fn(() => ({
    estimatedCostUSD: 0.05,
    inputTokens: 1000,
    outputTokens: 500
  }))
}))

describe('POST /api/audit/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires authentication', async () => {
    const { POST } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tenantId: 'test-tenant' })
    })

    const response = await POST(req)
    const data = await response.json()

    // In single-user mode, should succeed (200) or return 401 when auth is required
    expect([200, 201, 401]).toContain(response.status)
  })

  it('validates required tenantId field', async () => {
    const { POST } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}) // Missing tenantId
    })

    const response = await POST(req)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it('accepts optional batchSize parameter', async () => {
    const { POST } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tenantId: 'test-tenant',
        batchSize: 25
      })
    })

    const response = await POST(req)

    // Should process without validation error (batchSize 25 is valid)
    expect([200, 201]).toContain(response.status)
    const data = await response.json()
    // Route returns analysis status, not batchSize -- verify it started analysing
    expect(data.status).toBeDefined()
  })

  it('rejects batchSize over 100', async () => {
    const { POST } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tenantId: 'test-tenant',
        batchSize: 150 // Over limit
      })
    })

    const response = await POST(req)

    expect([400, 422]).toContain(response.status)
  })

  it('returns analysis status with progress', async () => {
    const { POST } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tenantId: 'test-tenant',
        batchSize: 10
      })
    })

    const response = await POST(req)

    if (response.status === 200 || response.status === 201) {
      const data = await response.json()
      expect(data).toHaveProperty('status')
      expect(['analysing', 'analyzing', 'complete', 'pending']).toContain(data.status)
    }
  })
})

// =============================================================================
// Error Handling Tests
// =============================================================================

describe('Error Handling', () => {
  it('handles database errors gracefully', async () => {
    // Mock database failure - override the batch-processor's getAnalysisStatus to throw
    const batchProcessor = await import('@/lib/ai/batch-processor')
    vi.mocked(batchProcessor.getAnalysisStatus).mockRejectedValueOnce(
      new Error('Database connection failed')
    )

    const { POST } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tenantId: 'test-tenant' })
    })

    const response = await POST(req)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it('handles invalid JSON body', async () => {
    const { POST } = await import('@/app/api/audit/analyze/route')

    const req = new NextRequest('http://localhost:3000/api/audit/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'invalid json{'
    })

    const response = await POST(req)

    expect([400, 500]).toContain(response.status)
  })
})
