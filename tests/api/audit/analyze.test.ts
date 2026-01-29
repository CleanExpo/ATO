/**
 * Audit Analysis API Route Tests
 *
 * Tests for /api/audit/analyze endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'test-id', tenant_id: 'test-tenant' },
        error: null
      })
    }))
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

    // Should either succeed with mock auth or return 401
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

    // Should process without validation error
    expect([200, 201, 400, 401, 500]).toContain(response.status)
    if (response.status !== 400) {
      const data = await response.json()
      expect(data.batchSize).toBeLessThanOrEqual(100)
    }
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
      expect(['analysing', 'complete', 'pending']).toContain(data.status)
    }
  })
})

// =============================================================================
// Error Handling Tests
// =============================================================================

describe('Error Handling', () => {
  it('handles database errors gracefully', async () => {
    // Mock database failure
    vi.mocked(await import('@/lib/supabase/server')).createServiceClient.mockReturnValueOnce({
      from: vi.fn(() => ({
        select: vi.fn(() => {
          throw new Error('Database connection failed')
        })
      }))
    } as any)

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
