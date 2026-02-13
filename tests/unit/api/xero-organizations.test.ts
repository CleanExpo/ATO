/**
 * Xero Organizations API Route Tests
 *
 * Tests for GET /api/xero/organizations.
 * Validates single-user mode, multi-user auth, database queries,
 * and response shape.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockIsSingleUserMode = vi.fn()

vi.mock('@/lib/auth/single-user-check', () => ({
  isSingleUserMode: (...args: unknown[]) => mockIsSingleUserMode(...args),
}))

// Mock requireAuth
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuthOnly: vi.fn(() =>
    Promise.resolve({
      user: { id: 'test-user-id', email: 'test@example.com' },
      tenantId: '',
      supabase: null,
    })
  ),
  isErrorResponse: vi.fn((result: unknown) => result instanceof NextResponse),
}))

// Chainable Supabase mock builder
function createChainableMock(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.insert = vi.fn(() => chain)
  chain.update = vi.fn(() => chain)
  chain.delete = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.is = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.single = vi.fn().mockResolvedValue(resolvedValue)
  chain.then = (resolve: (val: unknown) => void) =>
    Promise.resolve(resolvedValue).then(resolve)
  return chain
}

const mockAdminFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  })),
  createServiceClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => createChainableMock({ data: null, error: null })),
    })
  ),
}))

// Mock error helpers
vi.mock('@/lib/api/errors', () => ({
  createErrorResponse: vi.fn((_error: unknown, _context: unknown, status = 500) =>
    NextResponse.json({ error: 'Internal error' }, { status })
  ),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockConnections = [
  {
    tenant_id: 'xero-tenant-1',
    tenant_name: 'DR Qld Pty Ltd',
    organisation_name: 'Disaster Recovery Qld',
    organisation_type: 'COMPANY',
    country_code: 'AU',
    base_currency: 'AUD',
    is_demo_company: false,
    connected_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  },
  {
    tenant_id: 'xero-tenant-2',
    tenant_name: 'CARSI',
    organisation_name: 'CARSI Pty Ltd',
    organisation_type: 'COMPANY',
    country_code: 'AU',
    base_currency: 'AUD',
    is_demo_company: false,
    connected_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-20T00:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/xero/organizations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all connections in single-user mode', async () => {
    mockIsSingleUserMode.mockReturnValue(true)
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'xero_connections') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockConnections,
              error: null,
            }),
          }),
        }
      }
      return createChainableMock({ data: null, error: null })
    })

    const { GET } = await import('@/app/api/xero/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/xero/organizations')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.connections).toHaveLength(2)
    expect(data.connections[0].tenant_name).toBe('DR Qld Pty Ltd')
    expect(data.connections[1].tenant_name).toBe('CARSI')
  })

  it('requires auth in multi-user mode', async () => {
    mockIsSingleUserMode.mockReturnValue(false)

    const { requireAuthOnly } = await import('@/lib/auth/require-auth')
    vi.mocked(requireAuthOnly).mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const { GET } = await import('@/app/api/xero/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/xero/organizations')
    const response = await GET(req)

    expect(response.status).toBe(401)
  })

  it('returns only connections the user has access to in multi-user mode', async () => {
    mockIsSingleUserMode.mockReturnValue(false)

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'user_tenant_access') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ tenant_id: 'xero-tenant-1' }],
              error: null,
            }),
          }),
        }
      }
      if (table === 'xero_connections') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [mockConnections[0]],
                error: null,
              }),
            }),
          }),
        }
      }
      return createChainableMock({ data: null, error: null })
    })

    const { GET } = await import('@/app/api/xero/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/xero/organizations')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.connections).toHaveLength(1)
    expect(data.connections[0].tenant_id).toBe('xero-tenant-1')
  })

  it('returns empty array when user has no tenant access', async () => {
    mockIsSingleUserMode.mockReturnValue(false)

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'user_tenant_access') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }
      }
      return createChainableMock({ data: null, error: null })
    })

    const { GET } = await import('@/app/api/xero/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/xero/organizations')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.connections).toEqual([])
  })

  it('returns empty array when no connections exist', async () => {
    mockIsSingleUserMode.mockReturnValue(true)

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'xero_connections') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }
      }
      return createChainableMock({ data: null, error: null })
    })

    const { GET } = await import('@/app/api/xero/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/xero/organizations')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.connections).toEqual([])
  })

  it('handles database error in single-user mode', async () => {
    mockIsSingleUserMode.mockReturnValue(true)

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'xero_connections') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'relation does not exist' },
            }),
          }),
        }
      }
      return createChainableMock({ data: null, error: null })
    })

    const { GET } = await import('@/app/api/xero/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/xero/organizations')
    const response = await GET(req)

    expect(response.status).toBe(500)
  })

  it('handles database error when fetching user connections', async () => {
    mockIsSingleUserMode.mockReturnValue(false)

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'user_tenant_access') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ tenant_id: 'xero-tenant-1' }],
              error: null,
            }),
          }),
        }
      }
      if (table === 'xero_connections') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'connection timeout' },
              }),
            }),
          }),
        }
      }
      return createChainableMock({ data: null, error: null })
    })

    const { GET } = await import('@/app/api/xero/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/xero/organizations')
    const response = await GET(req)

    expect(response.status).toBe(500)
  })

  it('handles thrown exceptions gracefully', async () => {
    mockIsSingleUserMode.mockReturnValue(true)

    mockAdminFrom.mockImplementation(() => {
      throw new Error('Unexpected failure')
    })

    const { GET } = await import('@/app/api/xero/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/xero/organizations')
    const response = await GET(req)

    expect(response.status).toBe(500)
  })

  it('returns null for connections field when data is null but no error', async () => {
    mockIsSingleUserMode.mockReturnValue(true)

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'xero_connections') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }
      }
      return createChainableMock({ data: null, error: null })
    })

    const { GET } = await import('@/app/api/xero/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/xero/organizations')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    // Route returns `connections || []`
    expect(data.connections).toEqual([])
  })
})
