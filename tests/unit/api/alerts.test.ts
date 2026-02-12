/**
 * Alerts API Route Tests
 *
 * Tests for GET /api/alerts.
 * Validates authentication, query parameter filtering,
 * unread count, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuthGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: () => mockAuthGetUser(),
      },
      from: (...args: unknown[]) => mockFrom(...args),
    })
  ),
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

// Mock requireAuth - resolves successfully by default
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'test-user-id', email: 'test@example.com' },
      tenantId: '',
      supabase: null,
    })
  ),
  isErrorResponse: vi.fn((result: unknown) => result instanceof NextResponse),
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

function setAuthenticatedUser(user = { id: 'test-user-id', email: 'test@example.com' }) {
  mockAuthGetUser.mockResolvedValue({
    data: { user },
    error: null,
  })
}

function setUnauthenticated() {
  mockAuthGetUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'no session' },
  })
}

const mockAlerts = [
  {
    id: 'alert-1',
    tenant_id: 'test-user-id',
    type: 'deadline',
    severity: 'critical',
    category: 'deadline',
    title: 'BAS Q2 Due',
    message: 'BAS for Q2 FY2025-26 is due on 28 February',
    status: 'unread',
    financial_year: '2025',
    triggered_at: '2026-02-01T00:00:00Z',
  },
  {
    id: 'alert-2',
    tenant_id: 'test-user-id',
    type: 'opportunity',
    severity: 'info',
    category: 'opportunity',
    title: 'R&D Offset Available',
    message: 'Unclaimed R&D offset of $43,500',
    status: 'read',
    financial_year: '2024',
    triggered_at: '2026-01-15T00:00:00Z',
  },
]

/**
 * Creates a thenable, chainable Supabase query mock.
 * The route builds queries like:
 *   query = supabase.from('...').select().eq().order().limit()
 *   query = query.eq(...)  // conditional filters
 *   const { data, error, count } = await query
 *
 * So every method must return the mock itself, and .then() resolves to the result.
 */
function createThenableQueryMock(
  result: { data: unknown; error: unknown; count?: unknown },
  opts?: { onEq?: (field: string, value: unknown) => void; onLimit?: (n: number) => void }
) {
  const mock: Record<string, unknown> = {}
  mock.select = vi.fn(() => mock)
  mock.eq = vi.fn((...args: unknown[]) => {
    opts?.onEq?.(args[0] as string, args[1])
    return mock
  })
  mock.order = vi.fn(() => mock)
  mock.limit = vi.fn((...args: unknown[]) => {
    opts?.onLimit?.(args[0] as number)
    return mock
  })
  mock.then = (resolve: (val: unknown) => void) =>
    Promise.resolve(result).then(resolve)
  return mock
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns alerts for authenticated user', async () => {
    setAuthenticatedUser()

    const queryMock = createThenableQueryMock({
      data: mockAlerts,
      error: null,
      count: 2,
    })

    const unreadMock = createThenableQueryMock({ data: null, error: null, count: 1 })

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      return fromCallCount === 1 ? queryMock : unreadMock
    })

    const { GET } = await import('@/app/api/alerts/route')

    const req = new NextRequest('http://localhost:3000/api/alerts')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.alerts).toHaveLength(2)
    expect(data.total).toBe(2)
    expect(data.alerts[0].title).toBe('BAS Q2 Due')
  })

  it('returns 401 for unauthenticated requests', async () => {
    setUnauthenticated()

    const { GET } = await import('@/app/api/alerts/route')

    const req = new NextRequest('http://localhost:3000/api/alerts')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns auth error when requireAuth fails', async () => {
    const { requireAuth } = await import('@/lib/auth/require-auth')
    vi.mocked(requireAuth).mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const { GET } = await import('@/app/api/alerts/route')

    const req = new NextRequest('http://localhost:3000/api/alerts')
    const response = await GET(req)

    expect(response.status).toBe(401)
  })

  it('supports status filter query parameter', async () => {
    setAuthenticatedUser()

    const eqCalls: string[] = []
    const queryMock = createThenableQueryMock(
      { data: [mockAlerts[0]], error: null, count: 1 },
      { onEq: (field) => eqCalls.push(field) }
    )

    const unreadMock = createThenableQueryMock({ data: null, error: null, count: 1 })

    let callIdx = 0
    mockFrom.mockImplementation(() => {
      callIdx++
      return callIdx === 1 ? queryMock : unreadMock
    })

    const { GET } = await import('@/app/api/alerts/route')

    const req = new NextRequest('http://localhost:3000/api/alerts?status=unread')
    const response = await GET(req)

    expect(response.status).toBe(200)
    expect(eqCalls).toContain('status')
  })

  it('supports severity filter query parameter', async () => {
    setAuthenticatedUser()

    const eqCalls: [string, unknown][] = []
    const queryMock = createThenableQueryMock(
      { data: [mockAlerts[0]], error: null, count: 1 },
      { onEq: (field, value) => eqCalls.push([field, value]) }
    )

    const unreadMock = createThenableQueryMock({ data: null, error: null, count: 0 })

    let callIdx = 0
    mockFrom.mockImplementation(() => {
      callIdx++
      return callIdx === 1 ? queryMock : unreadMock
    })

    const { GET } = await import('@/app/api/alerts/route')

    const req = new NextRequest('http://localhost:3000/api/alerts?severity=critical')
    const response = await GET(req)

    expect(response.status).toBe(200)
    expect(eqCalls.some(([field, value]) => field === 'severity' && value === 'critical')).toBe(true)
  })

  it('limits results to max 100', async () => {
    setAuthenticatedUser()

    const limitCalls: number[] = []
    const queryMock = createThenableQueryMock(
      { data: [], error: null, count: 0 },
      { onLimit: (n) => limitCalls.push(n) }
    )

    const unreadMock = createThenableQueryMock({ data: null, error: null, count: 0 })

    let callIdx = 0
    mockFrom.mockImplementation(() => {
      callIdx++
      return callIdx === 1 ? queryMock : unreadMock
    })

    const { GET } = await import('@/app/api/alerts/route')

    const req = new NextRequest('http://localhost:3000/api/alerts?limit=500')
    await GET(req)

    // Should cap at 100
    expect(limitCalls[0]).toBe(100)
  })

  it('returns empty alerts array when none exist', async () => {
    setAuthenticatedUser()

    const queryMock = createThenableQueryMock({
      data: [],
      error: null,
      count: 0,
    })

    const unreadMock = createThenableQueryMock({ data: null, error: null, count: 0 })

    let callIdx = 0
    mockFrom.mockImplementation(() => {
      callIdx++
      return callIdx === 1 ? queryMock : unreadMock
    })

    const { GET } = await import('@/app/api/alerts/route')

    const req = new NextRequest('http://localhost:3000/api/alerts')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.alerts).toEqual([])
    expect(data.total).toBe(0)
    expect(data.unreadCount).toBe(0)
  })

  it('returns error when database query fails', async () => {
    setAuthenticatedUser()

    const queryMock = createThenableQueryMock({
      data: null,
      error: { message: 'DB error' },
      count: null,
    })

    mockFrom.mockReturnValue(queryMock)

    const { GET } = await import('@/app/api/alerts/route')

    const req = new NextRequest('http://localhost:3000/api/alerts')
    const response = await GET(req)

    expect(response.status).toBe(500)
  })

  it('returns unread count separately', async () => {
    setAuthenticatedUser()

    const queryMock = createThenableQueryMock({
      data: mockAlerts,
      error: null,
      count: 2,
    })

    const unreadMock = createThenableQueryMock({ data: null, error: null, count: 5 })

    let callIdx = 0
    mockFrom.mockImplementation(() => {
      callIdx++
      return callIdx === 1 ? queryMock : unreadMock
    })

    const { GET } = await import('@/app/api/alerts/route')

    const req = new NextRequest('http://localhost:3000/api/alerts')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.unreadCount).toBe(5)
  })
})
