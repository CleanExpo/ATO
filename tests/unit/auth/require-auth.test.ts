/**
 * Tests for Authentication & Tenant Authorization Helper
 * (lib/auth/require-auth.ts)
 *
 * Validates:
 * - requireAuth() returns user + tenantId for authenticated requests
 * - requireAuth() returns fake user in SINGLE_USER_MODE
 * - requireAuth() returns 401/403 for unauthenticated or unauthorised requests
 * - tenantId extraction from query, body, or params
 * - skipTenantValidation option
 * - requireAuthOnly() returns user for authenticated requests
 * - requireAuthOnly() returns fake user in SINGLE_USER_MODE
 * - isErrorResponse() type guard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

const mockIsSingleUserMode = vi.fn(() => false)

vi.mock('@/lib/auth/single-user-check', () => ({
  isSingleUserMode: () => mockIsSingleUserMode(),
}))

const mockAuthMiddleware = vi.fn()

vi.mock('@/lib/auth/middleware', () => ({
  authMiddleware: (...args: unknown[]) => mockAuthMiddleware(...args),
}))

const mockRequireTenantAccess = vi.fn()
const mockCreateForbiddenResponse = vi.fn((msg: string) =>
  NextResponse.json({ error: msg }, { status: 403 })
)

vi.mock('@/lib/auth/tenant-guard', () => ({
  requireTenantAccess: (...args: unknown[]) => mockRequireTenantAccess(...args),
  createForbiddenResponse: (msg: string) => mockCreateForbiddenResponse(msg),
}))

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are set up
// ---------------------------------------------------------------------------

import {
  requireAuth,
  requireAuthOnly,
  isErrorResponse,
  type AuthenticatedRequest,
} from '@/lib/auth/require-auth'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  url: string,
  options?: { method?: string; body?: Record<string, unknown> }
): NextRequest {
  const init: Record<string, unknown> = { method: options?.method ?? 'GET' }
  if (options?.body) {
    init.method = 'POST'
    init.body = JSON.stringify(options.body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any)
}

const fakeSupabase = { from: vi.fn() } as unknown

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsSingleUserMode.mockReturnValue(false)
  })

  // -- Single-user mode --

  it('returns fake user in SINGLE_USER_MODE with tenantId from query', async () => {
    mockIsSingleUserMode.mockReturnValue(true)
    const req = makeRequest('http://localhost:3000/api/test?tenantId=tenant-abc')

    const result = await requireAuth(req)

    expect(result).not.toBeInstanceOf(NextResponse)
    const auth = result as AuthenticatedRequest
    expect(auth.user.id).toBe('single-user')
    expect(auth.user.email).toBeUndefined()
    expect(auth.tenantId).toBe('tenant-abc')
    expect(auth.supabase).toBeNull()
  })

  it('returns empty tenantId in SINGLE_USER_MODE when no tenantId in query', async () => {
    mockIsSingleUserMode.mockReturnValue(true)
    const req = makeRequest('http://localhost:3000/api/test')

    const result = await requireAuth(req)

    const auth = result as AuthenticatedRequest
    expect(auth.tenantId).toBe('')
  })

  it('extracts tenantId from body in SINGLE_USER_MODE', async () => {
    mockIsSingleUserMode.mockReturnValue(true)
    const req = makeRequest('http://localhost:3000/api/test', {
      body: { tenantId: 'body-tenant' },
    })

    const result = await requireAuth(req, { tenantIdSource: 'body' })

    const auth = result as AuthenticatedRequest
    expect(auth.tenantId).toBe('body-tenant')
  })

  it('handles body parse failure gracefully in SINGLE_USER_MODE', async () => {
    mockIsSingleUserMode.mockReturnValue(true)
    // GET request with no body — clone().json() will throw
    const req = makeRequest('http://localhost:3000/api/test')

    const result = await requireAuth(req, { tenantIdSource: 'body' })

    const auth = result as AuthenticatedRequest
    expect(auth.tenantId).toBe('')
  })

  // -- Authenticated mode --

  it('returns authenticated user with tenantId from query', async () => {
    mockAuthMiddleware.mockResolvedValue({
      user: { id: 'user-1', email: 'user@test.com' },
      supabase: fakeSupabase,
    })
    mockRequireTenantAccess.mockResolvedValue(true)

    const req = makeRequest('http://localhost:3000/api/test?tenantId=t-123')
    const result = await requireAuth(req)

    expect(result).not.toBeInstanceOf(NextResponse)
    const auth = result as AuthenticatedRequest
    expect(auth.user.id).toBe('user-1')
    expect(auth.user.email).toBe('user@test.com')
    expect(auth.tenantId).toBe('t-123')
  })

  it('returns 401 when authMiddleware rejects', async () => {
    mockAuthMiddleware.mockResolvedValue(
      NextResponse.json({ error: 'Auth required' }, { status: 401 })
    )

    const req = makeRequest('http://localhost:3000/api/test?tenantId=t-123')
    const result = await requireAuth(req)

    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(401)
  })

  it('returns 403 when tenantId is missing and validation not skipped', async () => {
    mockAuthMiddleware.mockResolvedValue({
      user: { id: 'user-1', email: 'u@t.com' },
      supabase: fakeSupabase,
    })

    const req = makeRequest('http://localhost:3000/api/test') // no tenantId
    const result = await requireAuth(req)

    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
    expect(mockCreateForbiddenResponse).toHaveBeenCalledWith('tenantId is required')
  })

  it('returns 403 when tenant access is denied', async () => {
    mockAuthMiddleware.mockResolvedValue({
      user: { id: 'user-1', email: 'u@t.com' },
      supabase: fakeSupabase,
    })
    mockRequireTenantAccess.mockResolvedValue(
      NextResponse.json({ error: 'denied' }, { status: 403 })
    )

    const req = makeRequest('http://localhost:3000/api/test?tenantId=other-tenant')
    const result = await requireAuth(req)

    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
  })

  it('skips tenant validation when skipTenantValidation is true', async () => {
    mockAuthMiddleware.mockResolvedValue({
      user: { id: 'user-1', email: 'u@t.com' },
      supabase: fakeSupabase,
    })

    const req = makeRequest('http://localhost:3000/api/test')
    const result = await requireAuth(req, { skipTenantValidation: true })

    expect(result).not.toBeInstanceOf(NextResponse)
    const auth = result as AuthenticatedRequest
    expect(auth.tenantId).toBe('')
    expect(mockRequireTenantAccess).not.toHaveBeenCalled()
  })

  it('extracts tenantId from body in authenticated mode', async () => {
    mockAuthMiddleware.mockResolvedValue({
      user: { id: 'user-1', email: 'u@t.com' },
      supabase: fakeSupabase,
    })
    mockRequireTenantAccess.mockResolvedValue(true)

    const req = makeRequest('http://localhost:3000/api/test', {
      body: { tenantId: 'body-t' },
    })
    const result = await requireAuth(req, { tenantIdSource: 'body' })

    const auth = result as AuthenticatedRequest
    expect(auth.tenantId).toBe('body-t')
  })

  it('uses custom tenantIdParam name', async () => {
    mockAuthMiddleware.mockResolvedValue({
      user: { id: 'user-1', email: 'u@t.com' },
      supabase: fakeSupabase,
    })
    mockRequireTenantAccess.mockResolvedValue(true)

    const req = makeRequest('http://localhost:3000/api/test?orgId=custom-org')
    const result = await requireAuth(req, {
      tenantIdParam: 'orgId',
    })

    const auth = result as AuthenticatedRequest
    expect(auth.tenantId).toBe('custom-org')
  })

  it('handles body parse failure gracefully in authenticated mode', async () => {
    mockAuthMiddleware.mockResolvedValue({
      user: { id: 'user-1', email: 'u@t.com' },
      supabase: fakeSupabase,
    })

    const req = makeRequest('http://localhost:3000/api/test')
    // tenantIdSource body but no body on GET request
    const result = await requireAuth(req, {
      tenantIdSource: 'body',
      skipTenantValidation: true,
    })

    const auth = result as AuthenticatedRequest
    expect(auth.tenantId).toBe('')
  })
})

describe('requireAuthOnly', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsSingleUserMode.mockReturnValue(false)
  })

  it('returns fake user in SINGLE_USER_MODE', async () => {
    mockIsSingleUserMode.mockReturnValue(true)
    const req = makeRequest('http://localhost:3000/api/test')

    const result = await requireAuthOnly(req)

    expect(result).not.toBeInstanceOf(NextResponse)
    expect((result as { user: { id: string } }).user.id).toBe('single-user')
  })

  it('delegates to authMiddleware in normal mode', async () => {
    mockAuthMiddleware.mockResolvedValue({
      user: { id: 'user-1', email: 'u@t.com' },
      supabase: fakeSupabase,
    })

    const req = makeRequest('http://localhost:3000/api/test')
    const result = await requireAuthOnly(req)

    expect(mockAuthMiddleware).toHaveBeenCalledWith(req)
    expect(result).not.toBeInstanceOf(NextResponse)
  })

  it('returns 401 when not authenticated', async () => {
    mockAuthMiddleware.mockResolvedValue(
      NextResponse.json({ error: 'Auth required' }, { status: 401 })
    )

    const req = makeRequest('http://localhost:3000/api/test')
    const result = await requireAuthOnly(req)

    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(401)
  })
})

describe('isErrorResponse', () => {
  it('returns true for NextResponse', () => {
    const resp = NextResponse.json({ error: 'x' }, { status: 401 })
    expect(isErrorResponse(resp)).toBe(true)
  })

  it('returns false for AuthenticatedRequest', () => {
    const auth: AuthenticatedRequest = {
      user: { id: 'u', email: undefined },
      tenantId: 't',
      supabase: null as unknown as AuthenticatedRequest['supabase'],
    }
    expect(isErrorResponse(auth)).toBe(false)
  })

  it('returns false for AuthResult-like object', () => {
    const auth = {
      user: { id: 'u', email: 'e@t.com' },
      supabase: {},
    }
    expect(isErrorResponse(auth as unknown as AuthenticatedRequest)).toBe(false)
  })
})
