/**
 * Share API Route Tests
 *
 * Tests for:
 * - POST /api/share/create - Create share links
 * - GET /api/share/list - List share links for a tenant
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

// Mock requireAuth and isErrorResponse directly to avoid NextRequest clone issues
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'test-user-id', email: 'test@example.com' },
      tenantId: 'tenant-123',
      supabase: null,
    })
  ),
  isErrorResponse: vi.fn((result: unknown) => result instanceof NextResponse),
}))

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  hash: vi.fn(() => Promise.resolve('$2a$12$hashedpassword')),
}))

// Mock share token generator
vi.mock('@/lib/share/token-generator', () => ({
  generateShareToken: vi.fn(() => 'test-share-token-abc123'),
  buildShareUrl: vi.fn((token: string) => `https://ato-ai.app/share/${token}`),
  calculateExpiryDate: vi.fn((days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString()
  }),
}))

// Mock shared-reports types
vi.mock('@/lib/types/shared-reports', () => ({
  getShareLinkStatus: vi.fn((share: { is_revoked: boolean; expires_at: string }) => {
    if (share.is_revoked) return 'revoked'
    if (new Date(share.expires_at) < new Date()) return 'expired'
    return 'active'
  }),
}))

// Chainable Supabase mock builder
function createChainableMock(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.insert = vi.fn(() => chain)
  chain.update = vi.fn(() => chain)
  chain.delete = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.gt = vi.fn(() => chain)
  chain.lt = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.is = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.single = vi.fn().mockResolvedValue(resolvedValue)
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue)
  chain.then = (resolve: (val: unknown) => void) =>
    Promise.resolve(resolvedValue).then(resolve)
  return chain
}

const mockServiceFrom = vi.fn()
const mockClientAuth = {
  getUser: vi.fn().mockResolvedValue({
    data: { user: { id: 'test-user-id', email: 'test@example.com' } },
    error: null,
  }),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: () => mockClientAuth.getUser(),
      },
      from: vi.fn(() => createChainableMock({ data: null, error: null })),
    })
  ),
  createServiceClient: vi.fn(() =>
    Promise.resolve({
      from: (...args: unknown[]) => mockServiceFrom(...args),
    })
  ),
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => createChainableMock({ data: null, error: null })),
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
// POST /api/share/create Tests
// ---------------------------------------------------------------------------

describe('POST /api/share/create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: DB insert succeeds
    mockServiceFrom.mockReturnValue(
      createChainableMock({
        data: { id: 'share-id-001' },
        error: null,
      })
    )
    // Re-enable auth
    mockClientAuth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null,
    })
  })

  it('creates a share link with valid input', async () => {
    const { POST } = await import('@/app/api/share/create/route')

    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant-123',
        reportType: 'full',
        title: 'Q4 Tax Analysis',
      }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.shareId).toBe('share-id-001')
    expect(data.token).toBe('test-share-token-abc123')
    expect(data.shareUrl).toContain('/share/')
    expect(data.expiresAt).toBeDefined()
    expect(data.isPasswordProtected).toBe(false)
  })

  it('validates tenantId is required', async () => {
    const { POST } = await import('@/app/api/share/create/route')

    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportType: 'full',
        title: 'Test',
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toContain('tenantId')
  })

  it('validates reportType is required and must be valid', async () => {
    const { POST } = await import('@/app/api/share/create/route')

    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant-123',
        reportType: 'invalid-type',
        title: 'Test',
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toContain('reportType')
  })

  it('validates title is required', async () => {
    const { POST } = await import('@/app/api/share/create/route')

    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant-123',
        reportType: 'full',
        // title missing
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toContain('title')
  })

  it('validates password minimum length', async () => {
    const { POST } = await import('@/app/api/share/create/route')

    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant-123',
        reportType: 'full',
        title: 'Test',
        password: 'ab',
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toContain('password')
  })

  it('sets isPasswordProtected to true when password is provided', async () => {
    const { POST } = await import('@/app/api/share/create/route')

    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant-123',
        reportType: 'rnd',
        title: 'R&D Report',
        password: 'securepassword123',
      }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.isPasswordProtected).toBe(true)
  })

  it('validates expiresInDays range (1 to 365)', async () => {
    const { POST } = await import('@/app/api/share/create/route')

    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant-123',
        reportType: 'full',
        title: 'Test',
        expiresInDays: 500,
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toContain('expiresInDays')
  })

  it('returns 500 when database insert fails', async () => {
    mockServiceFrom.mockReturnValue(
      createChainableMock({
        data: null,
        error: { message: 'insert failed' },
      })
    )

    const { POST } = await import('@/app/api/share/create/route')

    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant-123',
        reportType: 'full',
        title: 'Test',
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(500)
  })

  it('returns auth error when requireAuth fails', async () => {
    const { requireAuth } = await import('@/lib/auth/require-auth')
    vi.mocked(requireAuth).mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const { POST } = await import('@/app/api/share/create/route')

    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant-123',
        reportType: 'full',
        title: 'Test',
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// GET /api/share/list Tests
// ---------------------------------------------------------------------------

describe('GET /api/share/list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns share links for a tenant', async () => {
    const mockShares = [
      {
        id: 'share-1',
        token: 'token-1',
        title: 'Report A',
        report_type: 'full',
        is_revoked: false,
        created_at: '2026-01-01T00:00:00Z',
        expires_at: '2027-01-01T00:00:00Z',
        access_count: 3,
        last_accessed_at: '2026-02-01T00:00:00Z',
        password_hash: null,
      },
      {
        id: 'share-2',
        token: 'token-2',
        title: 'Report B',
        report_type: 'rnd',
        is_revoked: false,
        created_at: '2026-01-15T00:00:00Z',
        expires_at: '2027-01-15T00:00:00Z',
        access_count: 0,
        last_accessed_at: null,
        password_hash: '$2a$12$hash',
      },
    ]

    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockShares, error: null }),
        }),
      }),
    })

    const { GET } = await import('@/app/api/share/list/route')

    const req = new NextRequest('http://localhost:3000/api/share/list?tenantId=tenant-123')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.links).toHaveLength(2)
    expect(data.total).toBe(2)
    expect(data.links[0].title).toBe('Report A')
    expect(data.links[1].isPasswordProtected).toBe(true)
  })

  it('validates tenantId query parameter is required', async () => {
    const { GET } = await import('@/app/api/share/list/route')

    // requireAuth passes (returns tenantId from query, but tenantId is empty string
    // because it's the 'query' source), so the route's manual validation catches it
    const req = new NextRequest('http://localhost:3000/api/share/list')
    const response = await GET(req)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('tenantId')
  })

  it('returns 500 when database query fails', async () => {
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    })

    const { GET } = await import('@/app/api/share/list/route')

    const req = new NextRequest('http://localhost:3000/api/share/list?tenantId=tenant-123')
    const response = await GET(req)

    expect(response.status).toBe(500)
  })
})
