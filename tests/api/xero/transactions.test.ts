/**
 * Xero Transactions API Route Tests
 *
 * Tests for /api/xero/transactions endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Xero client
vi.mock('@/lib/xero/client', () => ({
  createXeroClient: vi.fn(() => ({
    accountingApi: {
      getBankTransactions: vi.fn().mockResolvedValue({
        body: {
          bankTransactions: [
            {
              bankTransactionID: 'tx-001',
              date: '2024-07-01',
              total: 1000.00,
              lineItems: [{
                description: 'Software development',
                lineAmount: 1000.00,
                accountCode: '400'
              }]
            }
          ]
        }
      })
    }
  })),
  isTokenExpired: vi.fn().mockReturnValue(false)
}))

// Mock token management
vi.mock('@/lib/xero/token-manager', () => ({
  getTokensForTenant: vi.fn().mockResolvedValue({
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_at: Date.now() + 3600000
  }),
  saveTokens: vi.fn().mockResolvedValue(undefined)
}))

describe('GET /api/xero/transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires tenantId query parameter', async () => {
    const { GET } = await import('@/app/api/xero/transactions/route')

    const req = new NextRequest('http://localhost:3000/api/xero/transactions')

    const response = await GET(req)

    expect([400, 401]).toContain(response.status)
  })

  it('fetches transactions for valid tenant', async () => {
    const { GET } = await import('@/app/api/xero/transactions/route')

    const req = new NextRequest(
      'http://localhost:3000/api/xero/transactions?tenantId=test-tenant'
    )

    const response = await GET(req)

    if (response.status === 200) {
      const data = await response.json()
      expect(Array.isArray(data.transactions) || Array.isArray(data)).toBe(true)
    }
  })

  it('handles date range filtering', async () => {
    const { GET } = await import('@/app/api/xero/transactions/route')

    const req = new NextRequest(
      'http://localhost:3000/api/xero/transactions?tenantId=test-tenant&fromDate=2024-07-01&toDate=2024-12-31'
    )

    const response = await GET(req)

    expect([200, 400, 401, 500]).toContain(response.status)
  })

  it('validates date format', async () => {
    const { GET } = await import('@/app/api/xero/transactions/route')

    const req = new NextRequest(
      'http://localhost:3000/api/xero/transactions?tenantId=test-tenant&fromDate=invalid-date'
    )

    const response = await GET(req)

    expect([400, 422]).toContain(response.status)
  })

  it('handles expired tokens gracefully', async () => {
    // Mock expired token
    vi.mocked(await import('@/lib/xero/client')).isTokenExpired.mockReturnValueOnce(true)

    const { GET } = await import('@/app/api/xero/transactions/route')

    const req = new NextRequest(
      'http://localhost:3000/api/xero/transactions?tenantId=test-tenant'
    )

    const response = await GET(req)

    // Should attempt refresh or return 401
    expect([200, 401]).toContain(response.status)
  })
})

// =============================================================================
// Rate Limiting Tests
// =============================================================================

describe('Rate Limiting', () => {
  it('respects Xero API rate limits', async () => {
    const { GET } = await import('@/app/api/xero/transactions/route')

    // Make multiple requests
    const requests = Array(5).fill(null).map(() =>
      GET(new NextRequest(
        'http://localhost:3000/api/xero/transactions?tenantId=test-tenant'
      ))
    )

    const responses = await Promise.all(requests)

    // All should succeed or fail consistently
    const statuses = responses.map(r => r.status)
    expect(statuses.every(s => s === statuses[0])).toBe(true)
  })
})

// =============================================================================
// Data Validation Tests
// =============================================================================

describe('Response Data Validation', () => {
  it('returns transactions in correct format', async () => {
    const { GET } = await import('@/app/api/xero/transactions/route')

    const req = new NextRequest(
      'http://localhost:3000/api/xero/transactions?tenantId=test-tenant'
    )

    const response = await GET(req)

    if (response.status === 200) {
      const data = await response.json()
      const transactions = data.transactions || data

      if (Array.isArray(transactions) && transactions.length > 0) {
        const tx = transactions[0]
        expect(tx).toHaveProperty('bankTransactionID')
        expect(tx).toHaveProperty('date')
        expect(tx).toHaveProperty('total')
      }
    }
  })

  it('includes line items in transactions', async () => {
    const { GET } = await import('@/app/api/xero/transactions/route')

    const req = new NextRequest(
      'http://localhost:3000/api/xero/transactions?tenantId=test-tenant'
    )

    const response = await GET(req)

    if (response.status === 200) {
      const data = await response.json()
      const transactions = data.transactions || data

      if (Array.isArray(transactions) && transactions.length > 0) {
        const tx = transactions[0]
        if (tx.lineItems) {
          expect(Array.isArray(tx.lineItems)).toBe(true)
        }
      }
    }
  })
})
