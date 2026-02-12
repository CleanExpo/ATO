/**
 * Organizations API Route Tests
 *
 * Tests for GET and POST /api/organizations.
 * Validates authentication, input validation, and response shapes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

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

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
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

/**
 * Build a chainable mock for a specific table.
 * The mock records which table was called so we can
 * return different data for different tables.
 */
function setupFromMock(config: {
  accessRows?: { data: unknown[]; error: unknown } | null
  orgRows?: { data: unknown[]; error: unknown } | null
  insertResult?: { data: unknown; error: unknown } | null
  deleteResult?: { data: unknown; error: unknown } | null
  activityLogResult?: { data: unknown; error: unknown } | null
}) {
  mockFrom.mockImplementation((tableName: string) => {
    if (tableName === 'user_tenant_access') {
      if (config.accessRows) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(config.accessRows),
          }),
          insert: vi.fn().mockResolvedValue(config.insertResult ?? { data: null, error: null }),
        }
      }
    }
    if (tableName === 'organizations') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue(config.orgRows ?? { data: [], error: null }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(
              config.insertResult ?? { data: null, error: null }
            ),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(config.deleteResult ?? { data: null, error: null }),
        }),
      }
    }
    if (tableName === 'organization_activity_log') {
      return {
        insert: vi.fn().mockResolvedValue(
          config.activityLogResult ?? { data: null, error: null }
        ),
      }
    }
    // Fallback
    return {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  })
}

// ---------------------------------------------------------------------------
// GET /api/organizations Tests
// ---------------------------------------------------------------------------

describe('GET /api/organizations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns organizations for authenticated user', async () => {
    setAuthenticatedUser()
    setupFromMock({
      accessRows: {
        data: [
          { organization_id: 'org-1', tenant_id: 'tenant-1', role: 'owner' },
          { organization_id: 'org-2', tenant_id: 'tenant-2', role: 'admin' },
        ],
        error: null,
      },
      orgRows: {
        data: [
          {
            id: 'org-1',
            name: 'Disaster Recovery Qld',
            abn: '12345678901',
            industry: 'construction',
            business_size: 'small',
            xero_tenant_id: 'tenant-1',
            xero_connected_at: '2026-01-01T00:00:00Z',
            settings: {},
            subscription_tier: 'pro',
            subscription_status: 'active',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-15T00:00:00Z',
          },
          {
            id: 'org-2',
            name: 'CARSI',
            abn: null,
            industry: null,
            business_size: null,
            xero_tenant_id: 'tenant-2',
            xero_connected_at: null,
            settings: { financial_year_end: '06-30' },
            subscription_tier: 'free',
            subscription_status: 'active',
            created_at: '2026-01-10T00:00:00Z',
            updated_at: '2026-01-10T00:00:00Z',
          },
        ],
        error: null,
      },
    })

    const { GET } = await import('@/app/api/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/organizations')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.organizations).toHaveLength(2)
    expect(data.organizations[0].name).toBe('Disaster Recovery Qld')
    expect(data.organizations[0].role).toBe('owner')
    expect(data.organizations[1].role).toBe('admin')
  })

  it('returns 401 for unauthenticated requests', async () => {
    setUnauthenticated()

    const { GET } = await import('@/app/api/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/organizations')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns empty array when user has no organizations', async () => {
    setAuthenticatedUser()
    setupFromMock({
      accessRows: { data: [], error: null },
    })

    const { GET } = await import('@/app/api/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/organizations')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.organizations).toEqual([])
  })

  it('returns 500 when user_tenant_access query fails', async () => {
    setAuthenticatedUser()
    setupFromMock({
      accessRows: { data: [] as unknown[], error: { message: 'DB error' } },
    })

    const { GET } = await import('@/app/api/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/organizations')
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch organizations')
  })

  it('sets Cache-Control header on success response', async () => {
    setAuthenticatedUser()
    setupFromMock({
      accessRows: {
        data: [{ organization_id: 'org-1', tenant_id: 'tenant-1', role: 'owner' }],
        error: null,
      },
      orgRows: {
        data: [{
          id: 'org-1', name: 'Test Org', abn: null, industry: null,
          business_size: null, xero_tenant_id: null, xero_connected_at: null,
          settings: {}, subscription_tier: 'free', subscription_status: 'active',
          created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
        }],
        error: null,
      },
    })

    const { GET } = await import('@/app/api/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/organizations')
    const response = await GET(req)

    expect(response.headers.get('Cache-Control')).toBe(
      'private, max-age=300, stale-while-revalidate=60'
    )
  })

  it('transforms snake_case fields to camelCase in response', async () => {
    setAuthenticatedUser()
    setupFromMock({
      accessRows: {
        data: [{ organization_id: 'org-1', tenant_id: 'tenant-1', role: 'owner' }],
        error: null,
      },
      orgRows: {
        data: [{
          id: 'org-1', name: 'Test Org', abn: '12345678901',
          industry: 'tech', business_size: 'medium',
          xero_tenant_id: 'xt-1', xero_connected_at: '2026-01-01T00:00:00Z',
          settings: {}, subscription_tier: 'pro', subscription_status: 'active',
          created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-15T00:00:00Z',
        }],
        error: null,
      },
    })

    const { GET } = await import('@/app/api/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/organizations')
    const response = await GET(req)
    const data = await response.json()

    const org = data.organizations[0]
    // Verify camelCase transformation
    expect(org).toHaveProperty('businessSize', 'medium')
    expect(org).toHaveProperty('xeroTenantId', 'xt-1')
    expect(org).toHaveProperty('xeroConnectedAt', '2026-01-01T00:00:00Z')
    expect(org).toHaveProperty('subscriptionTier', 'pro')
    expect(org).toHaveProperty('subscriptionStatus', 'active')
    expect(org).toHaveProperty('createdAt')
    expect(org).toHaveProperty('updatedAt')
    // Should NOT have snake_case keys
    expect(org).not.toHaveProperty('business_size')
    expect(org).not.toHaveProperty('xero_tenant_id')
  })
})

// ---------------------------------------------------------------------------
// POST /api/organizations Tests
// ---------------------------------------------------------------------------

describe('POST /api/organizations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an organization with valid input', async () => {
    setAuthenticatedUser()
    setupFromMock({
      insertResult: {
        data: {
          id: 'new-org-id',
          name: 'New Corp Pty Ltd',
          abn: '98765432101',
          industry: 'finance',
          business_size: 'small',
          xero_tenant_id: null,
          xero_connected_at: null,
          settings: {},
          subscription_tier: 'free',
          subscription_status: 'active',
          created_at: '2026-02-12T00:00:00Z',
          updated_at: '2026-02-12T00:00:00Z',
        },
        error: null,
      },
    })

    const { POST } = await import('@/app/api/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Corp Pty Ltd',
        abn: '98765432101',
        industry: 'finance',
        businessSize: 'small',
      }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.organization).toBeDefined()
    expect(data.organization.name).toBe('New Corp Pty Ltd')
    expect(data.organization.id).toBe('new-org-id')
  })

  it('returns 401 for unauthenticated requests', async () => {
    setUnauthenticated()

    const { POST } = await import('@/app/api/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Org' }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('validates that name is required', async () => {
    setAuthenticatedUser()

    const { POST } = await import('@/app/api/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // name missing
        industry: 'tech',
      }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.details).toBeDefined()
  })

  it('validates ABN must be 11 digits', async () => {
    setAuthenticatedUser()

    const { POST } = await import('@/app/api/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Org',
        abn: '123', // Too short
      }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
  })

  it('validates businessSize enum', async () => {
    setAuthenticatedUser()

    const { POST } = await import('@/app/api/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Org',
        businessSize: 'enormous', // Not a valid enum value
      }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
  })

  it('returns 500 when organization insert fails', async () => {
    setAuthenticatedUser()
    setupFromMock({
      insertResult: {
        data: null,
        error: { message: 'unique constraint violation' },
      },
    })

    const { POST } = await import('@/app/api/organizations/route')

    const req = new NextRequest('http://localhost:3000/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Duplicate Org' }),
    })

    const response = await POST(req)
    expect(response.status).toBe(500)
  })
})
