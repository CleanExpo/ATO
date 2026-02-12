/**
 * Tests for Audit Logging System (lib/audit/logger.ts)
 *
 * Validates:
 * - logAdminAction() logs events to Supabase and returns true
 * - logAdminAction() handles DB errors gracefully (returns false, never throws)
 * - logAdminAction() handles exceptions gracefully
 * - getIpAddress() extracts rightmost IP from X-Forwarded-For (B-5 fix)
 * - getIpAddress() falls back to x-real-ip, cf-connecting-ip, or null
 * - getUserAgent() extracts user-agent header
 * - getAdminAuditHistory() returns records for an actor
 * - getResourceAuditHistory() returns records for a target
 * - getRecentAdminActions() returns recent records
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsert = vi.fn().mockReturnValue({ error: null })
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()

const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  select: mockSelect.mockReturnValue({
    eq: mockEq.mockReturnValue({
      order: mockOrder.mockReturnValue({
        limit: mockLimit.mockResolvedValue({ data: [], error: null }),
      }),
    }),
    order: mockOrder.mockReturnValue({
      limit: mockLimit.mockResolvedValue({ data: [], error: null }),
    }),
  }),
}))

const mockSupabase = { from: mockFrom }

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------

import {
  logAdminAction,
  getIpAddress,
  getUserAgent,
  getAdminAuditHistory,
  getResourceAuditHistory,
  getRecentAdminActions,
  type AuditLogEntry,
} from '@/lib/audit/logger'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('logAdminAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockReturnValue({ error: null })
  })

  const baseEntry: AuditLogEntry = {
    action: 'accountant_application_approved',
    actor_id: 'admin-1',
    actor_email: 'admin@test.com',
    target_id: 'app-123',
    target_type: 'accountant_application',
    details: { reason: 'verified' },
    ip_address: '1.2.3.4',
    user_agent: 'TestAgent/1.0',
  }

  it('logs an entry to Supabase and returns true', async () => {
    const result = await logAdminAction(baseEntry)

    expect(result).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('admin_audit_log')
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        action: 'accountant_application_approved',
        actor_id: 'admin-1',
        actor_email: 'admin@test.com',
        target_id: 'app-123',
        target_type: 'accountant_application',
      }),
    ])
  })

  it('uses null defaults for optional fields', async () => {
    const minimalEntry: AuditLogEntry = {
      action: 'dashboard_reset',
      actor_id: 'admin-2',
    }

    await logAdminAction(minimalEntry)

    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        actor_email: null,
        target_id: null,
        target_type: null,
        details: {},
        ip_address: null,
        user_agent: null,
      }),
    ])
  })

  it('returns false on Supabase insert error (never throws)', async () => {
    mockInsert.mockReturnValue({ error: { message: 'DB error' } })

    const result = await logAdminAction(baseEntry)

    expect(result).toBe(false)
  })

  it('returns false on exception (never throws)', async () => {
    mockFrom.mockImplementationOnce(() => {
      throw new Error('Connection lost')
    })

    const result = await logAdminAction(baseEntry)

    expect(result).toBe(false)
  })

  it('includes created_at timestamp in ISO format', async () => {
    await logAdminAction(baseEntry)

    const insertedRow = mockInsert.mock.calls[0][0][0]
    expect(insertedRow.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('getIpAddress', () => {
  it('extracts rightmost IP from X-Forwarded-For (B-5 fix)', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '10.0.0.1, 172.16.0.1, 203.0.113.50' },
    })

    expect(getIpAddress(req)).toBe('203.0.113.50')
  })

  it('returns single IP from X-Forwarded-For', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.50' },
    })

    expect(getIpAddress(req)).toBe('203.0.113.50')
  })

  it('trims whitespace around IPs', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': ' 10.0.0.1 , 203.0.113.50 ' },
    })

    expect(getIpAddress(req)).toBe('203.0.113.50')
  })

  it('falls back to x-real-ip when no x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '198.51.100.10' },
    })

    expect(getIpAddress(req)).toBe('198.51.100.10')
  })

  it('falls back to cf-connecting-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'cf-connecting-ip': '198.51.100.20' },
    })

    expect(getIpAddress(req)).toBe('198.51.100.20')
  })

  it('returns null when no IP headers present', () => {
    const req = new Request('http://localhost')

    expect(getIpAddress(req)).toBeNull()
  })

  it('prioritises X-Forwarded-For over x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '10.0.0.1, 203.0.113.1',
        'x-real-ip': '198.51.100.1',
      },
    })

    expect(getIpAddress(req)).toBe('203.0.113.1')
  })

  it('ignores empty X-Forwarded-For entries', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '10.0.0.1, , 203.0.113.50' },
    })

    expect(getIpAddress(req)).toBe('203.0.113.50')
  })
})

describe('getUserAgent', () => {
  it('returns user-agent header value', () => {
    const req = new Request('http://localhost', {
      headers: { 'user-agent': 'Mozilla/5.0' },
    })

    expect(getUserAgent(req)).toBe('Mozilla/5.0')
  })

  it('returns null when no user-agent header', () => {
    const req = new Request('http://localhost')

    expect(getUserAgent(req)).toBeNull()
  })
})

describe('getAdminAuditHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Rebuild the chained mock for select queries
    mockLimit.mockResolvedValue({ data: [{ id: 1 }], error: null })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockEq.mockReturnValue({ order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
    })
  })

  it('returns records for actor', async () => {
    const result = await getAdminAuditHistory('admin-1')

    expect(result).toEqual([{ id: 1 }])
    expect(mockFrom).toHaveBeenCalledWith('admin_audit_log')
    expect(mockEq).toHaveBeenCalledWith('actor_id', 'admin-1')
  })

  it('returns empty array on error', async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: 'err' } })

    const result = await getAdminAuditHistory('admin-1')

    expect(result).toEqual([])
  })

  it('returns empty array on exception', async () => {
    mockFrom.mockImplementationOnce(() => {
      throw new Error('DB gone')
    })

    const result = await getAdminAuditHistory('admin-1')

    expect(result).toEqual([])
  })

  it('uses default limit of 50', async () => {
    await getAdminAuditHistory('admin-1')

    expect(mockLimit).toHaveBeenCalledWith(50)
  })

  it('accepts custom limit', async () => {
    await getAdminAuditHistory('admin-1', 10)

    expect(mockLimit).toHaveBeenCalledWith(10)
  })
})

describe('getResourceAuditHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLimit.mockResolvedValue({ data: [{ id: 2 }], error: null })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockEq.mockReturnValue({ order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
    })
  })

  it('returns records for target resource', async () => {
    const result = await getResourceAuditHistory('target-1')

    expect(result).toEqual([{ id: 2 }])
    expect(mockEq).toHaveBeenCalledWith('target_id', 'target-1')
  })

  it('returns empty array on error', async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: 'err' } })

    const result = await getResourceAuditHistory('target-1')

    expect(result).toEqual([])
  })
})

describe('getRecentAdminActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLimit.mockResolvedValue({ data: [{ id: 3 }, { id: 4 }], error: null })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockSelect.mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
    })
  })

  it('returns recent actions', async () => {
    const result = await getRecentAdminActions()

    expect(result).toEqual([{ id: 3 }, { id: 4 }])
  })

  it('uses default limit of 100', async () => {
    await getRecentAdminActions()

    expect(mockLimit).toHaveBeenCalledWith(100)
  })

  it('accepts custom limit', async () => {
    await getRecentAdminActions(25)

    expect(mockLimit).toHaveBeenCalledWith(25)
  })

  it('returns empty array on exception', async () => {
    mockFrom.mockImplementationOnce(() => {
      throw new Error('kaboom')
    })

    const result = await getRecentAdminActions()

    expect(result).toEqual([])
  })
})
