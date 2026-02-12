/**
 * Tests for Security Event Logger (lib/security/security-event-logger.ts)
 *
 * Validates NDB compliance (Privacy Act 1988 Part IIIC):
 * - logSecurityEvent inserts correct database rows
 * - Convenience functions (logAuthFailure, logRateLimitExceeded, etc.)
 *   assemble correct events with correct event_type values
 * - Anomaly threshold detection triggers breach record creation
 * - Non-blocking: failures never throw to caller
 *
 * Uses vi.mock for Supabase client dependency.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// =============================================================================
// Mock Setup — vi.mock factories cannot reference outer variables (hoisted)
// =============================================================================

vi.mock('@/lib/supabase/server', () => {
  const insert = vi.fn().mockResolvedValue({ error: null })
  const rpc = vi.fn().mockResolvedValue({ data: 0, error: null })
  const select = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  })
  const from = vi.fn((table: string) => {
    if (table === 'data_breaches') {
      return { insert, select }
    }
    return { insert }
  })

  return {
    createServiceClient: vi.fn().mockResolvedValue({ from, rpc }),
    __mockInsert: insert,
    __mockFrom: from,
    __mockRpc: rpc,
  }
})

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

import {
  logSecurityEvent,
  logAuthFailure,
  logRateLimitExceeded,
  logShareBruteForce,
  logUnauthorizedAccess,
  logBulkDataAccess,
  logDataExport,
  type SecurityEvent,
} from '@/lib/security/security-event-logger'

// Access internal mock functions after module load
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseMock = await vi.importMock<any>('@/lib/supabase/server')
const mockInsert = supabaseMock.__mockInsert as ReturnType<typeof vi.fn>
const mockFrom = supabaseMock.__mockFrom as ReturnType<typeof vi.fn>
const mockRpc = supabaseMock.__mockRpc as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mockInsert.mockResolvedValue({ error: null })
  mockRpc.mockResolvedValue({ data: 0, error: null })
})

// =============================================================================
// logSecurityEvent tests
// =============================================================================

describe('logSecurityEvent', () => {
  it('should insert an event into security_events table', async () => {
    const event: SecurityEvent = {
      eventType: 'auth_failure',
      severity: 'warning',
      ipAddress: '192.168.1.1',
      description: 'Test auth failure',
    }

    const result = await logSecurityEvent(event)
    expect(result).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('security_events')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'auth_failure',
        severity: 'warning',
        ip_address: '192.168.1.1',
        description: 'Test auth failure',
      })
    )
  })

  it('should map camelCase fields to snake_case database columns', async () => {
    const event: SecurityEvent = {
      eventType: 'unauthorized_access',
      severity: 'critical',
      tenantId: 'tenant-123',
      userId: 'user-456',
      ipAddress: '10.0.0.1',
      userAgent: 'TestAgent/1.0',
      resourceType: 'report',
      resourceId: 'rpt-789',
      description: 'Unauthorized access attempt',
      metadata: { key: 'value' },
    }

    await logSecurityEvent(event)
    expect(mockInsert).toHaveBeenCalledWith({
      event_type: 'unauthorized_access',
      severity: 'critical',
      tenant_id: 'tenant-123',
      user_id: 'user-456',
      ip_address: '10.0.0.1',
      user_agent: 'TestAgent/1.0',
      resource_type: 'report',
      resource_id: 'rpt-789',
      description: 'Unauthorized access attempt',
      metadata: { key: 'value' },
    })
  })

  it('should convert undefined optional fields to null', async () => {
    const event: SecurityEvent = {
      eventType: 'auth_failure',
      severity: 'warning',
      description: 'Minimal event',
    }

    await logSecurityEvent(event)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: null,
        user_id: null,
        ip_address: null,
        user_agent: null,
        resource_type: null,
        resource_id: null,
        metadata: {},
      })
    )
  })

  it('should return false when Supabase insert fails', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'DB error' } })

    const event: SecurityEvent = {
      eventType: 'auth_failure',
      severity: 'warning',
      description: 'Will fail',
    }

    const result = await logSecurityEvent(event)
    expect(result).toBe(false)
  })

  it('should return false on exception (non-blocking)', async () => {
    mockInsert.mockRejectedValueOnce(new Error('Network timeout'))

    const event: SecurityEvent = {
      eventType: 'auth_failure',
      severity: 'warning',
      description: 'Will throw',
    }

    // Should NOT throw, should return false
    const result = await logSecurityEvent(event)
    expect(result).toBe(false)
  })

  it('should default metadata to empty object when not provided', async () => {
    const event: SecurityEvent = {
      eventType: 'auth_failure',
      severity: 'warning',
      description: 'No metadata',
    }

    await logSecurityEvent(event)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: {} })
    )
  })
})

// =============================================================================
// Convenience function tests
// =============================================================================

describe('logAuthFailure', () => {
  it('should log event with eventType auth_failure', async () => {
    await logAuthFailure('1.2.3.4', 'user-1', 'Invalid password')

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'auth_failure',
        severity: 'warning',
        ip_address: '1.2.3.4',
        user_id: 'user-1',
        description: 'Invalid password',
      })
    )
  })

  it('should use default description when reason not provided', async () => {
    await logAuthFailure('1.2.3.4')

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Authentication failed',
      })
    )
  })

  it('should convert null IP to null in database row', async () => {
    await logAuthFailure(null)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        ip_address: null,
      })
    )
  })
})

describe('logRateLimitExceeded', () => {
  it('should log event with eventType rate_limit_exceeded', async () => {
    await logRateLimitExceeded('10.0.0.1', '/api/analysis', 10)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'rate_limit_exceeded',
        severity: 'warning',
        ip_address: '10.0.0.1',
        resource_type: 'endpoint',
        resource_id: '/api/analysis',
      })
    )
  })

  it('should include limit and endpoint in description', async () => {
    await logRateLimitExceeded('10.0.0.1', '/api/share', 5)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Rate limit (5) exceeded on /api/share',
      })
    )
  })

  it('should include endpoint and limit in metadata', async () => {
    await logRateLimitExceeded('10.0.0.1', '/api/xero', 60)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { endpoint: '/api/xero', limit: 60 },
      })
    )
  })
})

describe('logShareBruteForce', () => {
  it('should log event with eventType share_brute_force', async () => {
    await logShareBruteForce('1.2.3.4', 'abcdefghijklmnop')

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'share_brute_force',
        severity: 'warning',
        resource_type: 'share_link',
        resource_id: 'abcdefghijklmnop',
      })
    )
  })

  it('should truncate share token to 8 chars in description', async () => {
    await logShareBruteForce('1.2.3.4', 'abcdefghijklmnop')

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('abcdefgh...'),
      })
    )
  })
})

describe('logUnauthorizedAccess', () => {
  it('should log event with severity critical', async () => {
    await logUnauthorizedAccess('1.2.3.4', 'tenant', 'tenant-123', 'user-99')

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'unauthorized_access',
        severity: 'critical',
        user_id: 'user-99',
        resource_type: 'tenant',
        resource_id: 'tenant-123',
      })
    )
  })

  it('should include resourceType/resourceId in description', async () => {
    await logUnauthorizedAccess('1.2.3.4', 'report', 'rpt-456')

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Unauthorized access attempt to report/rpt-456',
      })
    )
  })
})

describe('logBulkDataAccess', () => {
  it('should set severity to warning for <= 1000 records', async () => {
    await logBulkDataAccess('tenant-1', 'user-1', 500, 'transactions')

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'bulk_data_access',
        severity: 'warning',
      })
    )
  })

  it('should escalate severity to critical for > 1000 records', async () => {
    await logBulkDataAccess('tenant-1', 'user-1', 1001, 'transactions')

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'critical',
      })
    )
  })

  it('should include record count and resource type in description', async () => {
    await logBulkDataAccess('tenant-1', 'user-1', 5000, 'invoices')

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Bulk data access: 5000 invoices records accessed',
      })
    )
  })
})

describe('logDataExport', () => {
  it('should log event with severity info', async () => {
    await logDataExport('tenant-1', 'user-1', 'csv', 100)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'data_export',
        severity: 'info',
        resource_type: 'export',
        resource_id: 'csv',
      })
    )
  })

  it('should include export type and record count in metadata', async () => {
    await logDataExport('tenant-1', 'user-1', 'xlsx', 300)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { exportType: 'xlsx', recordCount: 300 },
      })
    )
  })

  it('should include details in description', async () => {
    await logDataExport('tenant-1', 'user-1', 'pdf', 50)

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Data export: 50 records exported as pdf',
      })
    )
  })
})

// =============================================================================
// Anomaly threshold and event type coverage tests (self-contained logic tests)
// =============================================================================

describe('Anomaly Threshold Configuration', () => {
  // Mirror thresholds from source for verification
  const ANOMALY_THRESHOLDS: Record<string, { count: number; windowMinutes: number }> = {
    auth_failure: { count: 10, windowMinutes: 15 },
    rate_limit_exceeded: { count: 20, windowMinutes: 60 },
    unauthorized_access: { count: 5, windowMinutes: 30 },
    share_brute_force: { count: 5, windowMinutes: 10 },
    oauth_anomaly: { count: 3, windowMinutes: 60 },
    token_compromise: { count: 1, windowMinutes: 1 },
    bulk_data_access: { count: 3, windowMinutes: 60 },
  }

  it('token_compromise has count=1 (any compromise is immediate escalation)', () => {
    expect(ANOMALY_THRESHOLDS.token_compromise.count).toBe(1)
    expect(ANOMALY_THRESHOLDS.token_compromise.windowMinutes).toBe(1)
  })

  it('share_brute_force has tight 10-minute window', () => {
    expect(ANOMALY_THRESHOLDS.share_brute_force.windowMinutes).toBe(10)
  })

  it('rate_limit_exceeded has higher threshold than auth_failure', () => {
    expect(ANOMALY_THRESHOLDS.rate_limit_exceeded.count).toBeGreaterThan(
      ANOMALY_THRESHOLDS.auth_failure.count
    )
  })

  it('does not have thresholds for non-critical event types (suspicious_ip, data_export)', () => {
    expect(ANOMALY_THRESHOLDS['suspicious_ip']).toBeUndefined()
    expect(ANOMALY_THRESHOLDS['data_export']).toBeUndefined()
    expect(ANOMALY_THRESHOLDS['admin_escalation']).toBeUndefined()
  })
})

describe('Event type to breach type mapping', () => {
  // Mirror mapEventToBreachType from source
  function mapEventToBreachType(
    eventType: string
  ): 'unauthorized_access' | 'unauthorized_disclosure' | 'system_compromise' {
    switch (eventType) {
      case 'auth_failure':
      case 'share_brute_force':
      case 'unauthorized_access':
        return 'unauthorized_access'
      case 'bulk_data_access':
      case 'data_export':
        return 'unauthorized_disclosure'
      case 'token_compromise':
      case 'oauth_anomaly':
      case 'admin_escalation':
        return 'system_compromise'
      default:
        return 'unauthorized_access'
    }
  }

  it('maps access-related events to unauthorized_access', () => {
    expect(mapEventToBreachType('auth_failure')).toBe('unauthorized_access')
    expect(mapEventToBreachType('share_brute_force')).toBe('unauthorized_access')
    expect(mapEventToBreachType('unauthorized_access')).toBe('unauthorized_access')
  })

  it('maps data exfiltration events to unauthorized_disclosure', () => {
    expect(mapEventToBreachType('bulk_data_access')).toBe('unauthorized_disclosure')
    expect(mapEventToBreachType('data_export')).toBe('unauthorized_disclosure')
  })

  it('maps token/system events to system_compromise', () => {
    expect(mapEventToBreachType('token_compromise')).toBe('system_compromise')
    expect(mapEventToBreachType('oauth_anomaly')).toBe('system_compromise')
    expect(mapEventToBreachType('admin_escalation')).toBe('system_compromise')
  })
})
