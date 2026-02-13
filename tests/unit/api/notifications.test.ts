/**
 * Notifications API Route Tests
 *
 * Tests for:
 * - GET /api/notifications - List notifications with pagination
 * - POST /api/notifications - Create a notification
 * - PATCH /api/notifications/[id] - Mark notification as read
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuthGetUser = vi.fn()
const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: () => mockAuthGetUser(),
      },
      from: (...args: unknown[]) => mockFrom(...args),
      rpc: (...args: unknown[]) => mockRpc(...args),
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

// Mock requireAuth
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

const mockNotifications = [
  {
    id: 'notif-1',
    user_id: 'test-user-id',
    type: 'analysis_complete',
    title: 'Analysis Complete',
    message: 'AI analysis for DR Qld is complete.',
    read: false,
    created_at: '2026-02-12T00:00:00Z',
  },
  {
    id: 'notif-2',
    user_id: 'test-user-id',
    type: 'deadline_reminder',
    title: 'BAS Deadline Approaching',
    message: 'BAS Q2 due in 7 days.',
    read: true,
    created_at: '2026-02-10T00:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// GET /api/notifications Tests
// ---------------------------------------------------------------------------

describe('GET /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns notifications for authenticated user', async () => {
    setAuthenticatedUser()

    const queryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: mockNotifications,
        error: null,
        count: 2,
      }),
    }

    mockFrom.mockReturnValue(queryMock)
    mockRpc.mockResolvedValue({ data: 1, error: null })

    const { GET } = await import('@/app/api/notifications/route')

    const req = new NextRequest('http://localhost:3000/api/notifications')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.notifications).toHaveLength(2)
    expect(data.total).toBe(2)
    expect(data.unreadCount).toBe(1)
    expect(data.limit).toBe(20)
    expect(data.offset).toBe(0)
  })

  it('returns 401 for unauthenticated requests', async () => {
    setUnauthenticated()

    const { GET } = await import('@/app/api/notifications/route')

    const req = new NextRequest('http://localhost:3000/api/notifications')
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

    const { GET } = await import('@/app/api/notifications/route')

    const req = new NextRequest('http://localhost:3000/api/notifications')
    const response = await GET(req)

    expect(response.status).toBe(401)
  })

  it('supports pagination with limit and offset', async () => {
    setAuthenticatedUser()

    const rangeCalls: [number, number][] = []
    const queryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn((...args: unknown[]) => {
        rangeCalls.push([args[0] as number, args[1] as number])
        return Promise.resolve({
          data: [mockNotifications[1]],
          error: null,
          count: 2,
        })
      }),
    }

    mockFrom.mockReturnValue(queryMock)
    mockRpc.mockResolvedValue({ data: 0, error: null })

    const { GET } = await import('@/app/api/notifications/route')

    const req = new NextRequest('http://localhost:3000/api/notifications?limit=10&offset=5')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.limit).toBe(10)
    expect(data.offset).toBe(5)
    // range(5, 14) => offset 5, limit 10
    expect(rangeCalls[0]).toEqual([5, 14])
  })

  it('caps limit at 100', async () => {
    setAuthenticatedUser()

    const rangeCalls: [number, number][] = []
    const queryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn((...args: unknown[]) => {
        rangeCalls.push([args[0] as number, args[1] as number])
        return Promise.resolve({ data: [], error: null, count: 0 })
      }),
    }

    mockFrom.mockReturnValue(queryMock)
    mockRpc.mockResolvedValue({ data: 0, error: null })

    const { GET } = await import('@/app/api/notifications/route')

    const req = new NextRequest('http://localhost:3000/api/notifications?limit=500')
    const response = await GET(req)
    const data = await response.json()

    expect(data.limit).toBe(100)
    // range(0, 99) => offset 0, limit 100
    expect(rangeCalls[0]).toEqual([0, 99])
  })

  it('filters unread only when unreadOnly=true', async () => {
    setAuthenticatedUser()

    const eqCalls: [string, unknown][] = []
    // The notifications route chains: .select().eq().order().range()
    // then conditionally .eq('read', false), then awaits the result.
    // Every method must return the mock, and .then() resolves to the result.
    const queryResult = { data: [mockNotifications[0]], error: null, count: 1 }
    const queryMock: Record<string, unknown> = {}
    queryMock.select = vi.fn(() => queryMock)
    queryMock.eq = vi.fn((...args: unknown[]) => {
      eqCalls.push([args[0] as string, args[1]])
      return queryMock
    })
    queryMock.order = vi.fn(() => queryMock)
    queryMock.range = vi.fn(() => queryMock)
    queryMock.then = (resolve: (val: unknown) => void) =>
      Promise.resolve(queryResult).then(resolve)

    mockFrom.mockReturnValue(queryMock)
    mockRpc.mockResolvedValue({ data: 1, error: null })

    const { GET } = await import('@/app/api/notifications/route')

    const req = new NextRequest('http://localhost:3000/api/notifications?unreadOnly=true')
    const response = await GET(req)

    expect(response.status).toBe(200)
    expect(eqCalls.some(([field, value]) => field === 'read' && value === false)).toBe(true)
  })

  it('returns 500 when database query fails', async () => {
    setAuthenticatedUser()

    const queryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
        count: null,
      }),
    }

    mockFrom.mockReturnValue(queryMock)

    const { GET } = await import('@/app/api/notifications/route')

    const req = new NextRequest('http://localhost:3000/api/notifications')
    const response = await GET(req)

    expect(response.status).toBe(500)
  })

  it('returns empty notifications when none exist', async () => {
    setAuthenticatedUser()

    const queryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      }),
    }

    mockFrom.mockReturnValue(queryMock)
    mockRpc.mockResolvedValue({ data: 0, error: null })

    const { GET } = await import('@/app/api/notifications/route')

    const req = new NextRequest('http://localhost:3000/api/notifications')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.notifications).toEqual([])
    expect(data.total).toBe(0)
    expect(data.unreadCount).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// POST /api/notifications Tests
// ---------------------------------------------------------------------------

describe('POST /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a notification with valid input', async () => {
    setAuthenticatedUser()
    mockRpc.mockResolvedValue({ data: 'notif-new-id', error: null })

    const { POST } = await import('@/app/api/notifications/route')

    const req = new NextRequest('http://localhost:3000/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test-user-id',
        type: 'analysis_complete',
        title: 'Analysis Done',
        message: 'Your tax analysis is ready.',
      }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.notificationId).toBe('notif-new-id')
    expect(data.message).toBe('Notification created successfully')
  })

  it('returns 401 for unauthenticated requests', async () => {
    setUnauthenticated()

    const { POST } = await import('@/app/api/notifications/route')

    const req = new NextRequest('http://localhost:3000/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test-user-id',
        type: 'info',
        title: 'Test',
        message: 'Test message',
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(401)
  })

  it('validates required fields', async () => {
    setAuthenticatedUser()

    const { POST } = await import('@/app/api/notifications/route')

    const req = new NextRequest('http://localhost:3000/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'info',
        // Missing userId, title, message
      }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Missing required fields')
  })

  it('returns 500 when RPC create fails', async () => {
    setAuthenticatedUser()
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } })

    const { POST } = await import('@/app/api/notifications/route')

    const req = new NextRequest('http://localhost:3000/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test-user-id',
        type: 'info',
        title: 'Test',
        message: 'Test message',
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/notifications/[id] Tests
// ---------------------------------------------------------------------------

describe('PATCH /api/notifications/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks notification as read', async () => {
    setAuthenticatedUser()

    const mockUpdateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { ...mockNotifications[0], read: true, read_at: '2026-02-12T01:00:00Z' },
        error: null,
      }),
    }

    mockFrom.mockReturnValue(mockUpdateChain)

    const { PATCH } = await import('@/app/api/notifications/[id]/route')

    const req = new NextRequest('http://localhost:3000/api/notifications/notif-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    })

    const response = await PATCH(req, { params: Promise.resolve({ id: 'notif-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.notification.read).toBe(true)
    expect(data.message).toBe('Notification updated successfully')
  })

  it('returns 401 for unauthenticated requests', async () => {
    setUnauthenticated()

    const { PATCH } = await import('@/app/api/notifications/[id]/route')

    const req = new NextRequest('http://localhost:3000/api/notifications/notif-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    })

    const response = await PATCH(req, { params: Promise.resolve({ id: 'notif-1' }) })
    expect(response.status).toBe(401)
  })

  it('returns 400 when read field is not a boolean', async () => {
    setAuthenticatedUser()

    const { PATCH } = await import('@/app/api/notifications/[id]/route')

    const req = new NextRequest('http://localhost:3000/api/notifications/notif-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: 'yes' }),
    })

    const response = await PATCH(req, { params: Promise.resolve({ id: 'notif-1' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('read must be a boolean')
  })

  it('returns 500 when database update fails', async () => {
    setAuthenticatedUser()

    const mockUpdateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'constraint violation' },
      }),
    }

    mockFrom.mockReturnValue(mockUpdateChain)

    const { PATCH } = await import('@/app/api/notifications/[id]/route')

    const req = new NextRequest('http://localhost:3000/api/notifications/notif-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    })

    const response = await PATCH(req, { params: Promise.resolve({ id: 'notif-1' }) })
    expect(response.status).toBe(500)
  })
})
