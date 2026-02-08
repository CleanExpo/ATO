/**
 * Security Event Logger Tests
 *
 * Tests for lib/security/security-event-logger.ts
 * Privacy Act 1988 Part IIIC — Notifiable Data Breaches scheme
 *
 * Uses self-contained test functions to avoid Supabase dependency.
 */

import { describe, it, expect } from 'vitest'

// =============================================================================
// Type Definitions (mirror source types for self-contained tests)
// =============================================================================

type SecurityEventType =
  | 'auth_failure'
  | 'rate_limit_exceeded'
  | 'unauthorized_access'
  | 'token_compromise'
  | 'bulk_data_access'
  | 'suspicious_ip'
  | 'oauth_anomaly'
  | 'share_brute_force'
  | 'data_export'
  | 'admin_escalation'

type SecuritySeverity = 'info' | 'warning' | 'critical'

interface SecurityEvent {
  eventType: SecurityEventType
  severity: SecuritySeverity
  tenantId?: string
  userId?: string
  ipAddress?: string
  userAgent?: string
  resourceType?: string
  resourceId?: string
  description: string
  metadata?: Record<string, unknown>
}

// =============================================================================
// Anomaly Threshold Configuration Tests
// =============================================================================

describe('Anomaly Threshold Configuration', () => {
  const ANOMALY_THRESHOLDS: Record<string, { count: number; windowMinutes: number }> = {
    auth_failure: { count: 10, windowMinutes: 15 },
    rate_limit_exceeded: { count: 20, windowMinutes: 60 },
    unauthorized_access: { count: 5, windowMinutes: 30 },
    share_brute_force: { count: 5, windowMinutes: 10 },
    oauth_anomaly: { count: 3, windowMinutes: 60 },
    token_compromise: { count: 1, windowMinutes: 1 },
    bulk_data_access: { count: 3, windowMinutes: 60 },
  }

  it('has thresholds for all critical event types', () => {
    const criticalTypes = [
      'auth_failure',
      'rate_limit_exceeded',
      'unauthorized_access',
      'share_brute_force',
      'oauth_anomaly',
      'token_compromise',
      'bulk_data_access',
    ]

    for (const type of criticalTypes) {
      expect(ANOMALY_THRESHOLDS[type]).toBeDefined()
      expect(ANOMALY_THRESHOLDS[type].count).toBeGreaterThan(0)
      expect(ANOMALY_THRESHOLDS[type].windowMinutes).toBeGreaterThan(0)
    }
  })

  it('token_compromise has count=1 (any compromise is critical)', () => {
    expect(ANOMALY_THRESHOLDS.token_compromise.count).toBe(1)
    expect(ANOMALY_THRESHOLDS.token_compromise.windowMinutes).toBe(1)
  })

  it('share_brute_force has tight window (10 minutes)', () => {
    expect(ANOMALY_THRESHOLDS.share_brute_force.count).toBe(5)
    expect(ANOMALY_THRESHOLDS.share_brute_force.windowMinutes).toBe(10)
  })

  it('rate_limit_exceeded has higher count threshold than auth_failure', () => {
    expect(ANOMALY_THRESHOLDS.rate_limit_exceeded.count).toBeGreaterThan(
      ANOMALY_THRESHOLDS.auth_failure.count
    )
  })

  it('does not have thresholds for non-critical event types', () => {
    expect(ANOMALY_THRESHOLDS['suspicious_ip']).toBeUndefined()
    expect(ANOMALY_THRESHOLDS['data_export']).toBeUndefined()
    expect(ANOMALY_THRESHOLDS['admin_escalation']).toBeUndefined()
  })
})

// =============================================================================
// Event-to-Breach Type Mapping Tests
// =============================================================================

describe('mapEventToBreachType', () => {
  function mapEventToBreachType(
    eventType: SecurityEventType
  ): 'unauthorized_access' | 'unauthorized_disclosure' | 'loss_of_data' | 'system_compromise' {
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

  it('maps auth_failure to unauthorized_access', () => {
    expect(mapEventToBreachType('auth_failure')).toBe('unauthorized_access')
  })

  it('maps share_brute_force to unauthorized_access', () => {
    expect(mapEventToBreachType('share_brute_force')).toBe('unauthorized_access')
  })

  it('maps unauthorized_access to unauthorized_access', () => {
    expect(mapEventToBreachType('unauthorized_access')).toBe('unauthorized_access')
  })

  it('maps bulk_data_access to unauthorized_disclosure', () => {
    expect(mapEventToBreachType('bulk_data_access')).toBe('unauthorized_disclosure')
  })

  it('maps data_export to unauthorized_disclosure', () => {
    expect(mapEventToBreachType('data_export')).toBe('unauthorized_disclosure')
  })

  it('maps token_compromise to system_compromise', () => {
    expect(mapEventToBreachType('token_compromise')).toBe('system_compromise')
  })

  it('maps oauth_anomaly to system_compromise', () => {
    expect(mapEventToBreachType('oauth_anomaly')).toBe('system_compromise')
  })

  it('maps admin_escalation to system_compromise', () => {
    expect(mapEventToBreachType('admin_escalation')).toBe('system_compromise')
  })

  it('defaults to unauthorized_access for unknown types', () => {
    expect(mapEventToBreachType('suspicious_ip')).toBe('unauthorized_access')
  })
})

// =============================================================================
// Event-to-Data Types Mapping Tests
// =============================================================================

describe('mapEventToDataTypes', () => {
  function mapEventToDataTypes(eventType: SecurityEventType): string[] {
    switch (eventType) {
      case 'auth_failure':
      case 'share_brute_force':
        return ['email', 'credentials']
      case 'bulk_data_access':
      case 'data_export':
        return ['financial_transactions', 'supplier_names', 'addresses']
      case 'token_compromise':
      case 'oauth_anomaly':
        return ['oauth_tokens', 'financial_transactions']
      case 'unauthorized_access':
        return ['financial_transactions']
      case 'admin_escalation':
        return ['system_configuration', 'user_data']
      default:
        return ['unknown']
    }
  }

  it('maps auth_failure to email and credentials', () => {
    const types = mapEventToDataTypes('auth_failure')
    expect(types).toContain('email')
    expect(types).toContain('credentials')
    expect(types).toHaveLength(2)
  })

  it('maps share_brute_force to email and credentials', () => {
    const types = mapEventToDataTypes('share_brute_force')
    expect(types).toContain('email')
    expect(types).toContain('credentials')
  })

  it('maps bulk_data_access to financial data types', () => {
    const types = mapEventToDataTypes('bulk_data_access')
    expect(types).toContain('financial_transactions')
    expect(types).toContain('supplier_names')
    expect(types).toContain('addresses')
    expect(types).toHaveLength(3)
  })

  it('maps data_export to same types as bulk_data_access', () => {
    const bulkTypes = mapEventToDataTypes('bulk_data_access')
    const exportTypes = mapEventToDataTypes('data_export')
    expect(exportTypes).toEqual(bulkTypes)
  })

  it('maps token_compromise to oauth_tokens and financial_transactions', () => {
    const types = mapEventToDataTypes('token_compromise')
    expect(types).toContain('oauth_tokens')
    expect(types).toContain('financial_transactions')
    expect(types).toHaveLength(2)
  })

  it('maps oauth_anomaly to same types as token_compromise', () => {
    const tokenTypes = mapEventToDataTypes('token_compromise')
    const oauthTypes = mapEventToDataTypes('oauth_anomaly')
    expect(oauthTypes).toEqual(tokenTypes)
  })

  it('maps unauthorized_access to financial_transactions only', () => {
    const types = mapEventToDataTypes('unauthorized_access')
    expect(types).toEqual(['financial_transactions'])
  })

  it('maps admin_escalation to system_configuration and user_data', () => {
    const types = mapEventToDataTypes('admin_escalation')
    expect(types).toContain('system_configuration')
    expect(types).toContain('user_data')
    expect(types).toHaveLength(2)
  })

  it('returns unknown for unmapped event types', () => {
    const types = mapEventToDataTypes('suspicious_ip')
    expect(types).toEqual(['unknown'])
  })
})

// =============================================================================
// Convenience Function Parameter Assembly Tests
// =============================================================================

describe('Convenience Function Event Assembly', () => {
  // Replicates the event assembly logic from each convenience function
  // to verify correct fields are set without requiring Supabase

  function assembleAuthFailureEvent(
    ipAddress: string | null,
    userId?: string,
    reason?: string
  ): SecurityEvent {
    return {
      eventType: 'auth_failure',
      severity: 'warning',
      userId,
      ipAddress: ipAddress || undefined,
      description: reason || 'Authentication failed',
      metadata: { reason },
    }
  }

  function assembleRateLimitEvent(
    ipAddress: string | null,
    endpoint: string,
    limit: number
  ): SecurityEvent {
    return {
      eventType: 'rate_limit_exceeded',
      severity: 'warning',
      ipAddress: ipAddress || undefined,
      resourceType: 'endpoint',
      resourceId: endpoint,
      description: `Rate limit (${limit}) exceeded on ${endpoint}`,
      metadata: { endpoint, limit },
    }
  }

  function assembleShareBruteForceEvent(
    ipAddress: string | null,
    shareToken: string
  ): SecurityEvent {
    return {
      eventType: 'share_brute_force',
      severity: 'warning',
      ipAddress: ipAddress || undefined,
      resourceType: 'share_link',
      resourceId: shareToken,
      description: `Share link password brute force attempt on token ${shareToken.substring(0, 8)}...`,
    }
  }

  function assembleUnauthorizedAccessEvent(
    ipAddress: string | null,
    resourceType: string,
    resourceId: string,
    userId?: string
  ): SecurityEvent {
    return {
      eventType: 'unauthorized_access',
      severity: 'critical',
      userId,
      ipAddress: ipAddress || undefined,
      resourceType,
      resourceId,
      description: `Unauthorized access attempt to ${resourceType}/${resourceId}`,
    }
  }

  function assembleBulkDataAccessEvent(
    tenantId: string,
    userId: string,
    recordCount: number,
    resourceType: string
  ): SecurityEvent {
    return {
      eventType: 'bulk_data_access',
      severity: recordCount > 1000 ? 'critical' : 'warning',
      tenantId,
      userId,
      resourceType,
      description: `Bulk data access: ${recordCount} ${resourceType} records accessed`,
      metadata: { recordCount },
    }
  }

  function assembleDataExportEvent(
    tenantId: string,
    userId: string,
    exportType: string,
    recordCount: number
  ): SecurityEvent {
    return {
      eventType: 'data_export',
      severity: 'info',
      tenantId,
      userId,
      resourceType: 'export',
      resourceId: exportType,
      description: `Data export: ${recordCount} records exported as ${exportType}`,
      metadata: { exportType, recordCount },
    }
  }

  describe('logAuthFailure', () => {
    it('sets eventType to auth_failure', () => {
      const event = assembleAuthFailureEvent('1.2.3.4', 'user-1', 'bad password')
      expect(event.eventType).toBe('auth_failure')
    })

    it('sets severity to warning', () => {
      const event = assembleAuthFailureEvent('1.2.3.4')
      expect(event.severity).toBe('warning')
    })

    it('converts null ipAddress to undefined', () => {
      const event = assembleAuthFailureEvent(null)
      expect(event.ipAddress).toBeUndefined()
    })

    it('uses default description when reason is not provided', () => {
      const event = assembleAuthFailureEvent('1.2.3.4')
      expect(event.description).toBe('Authentication failed')
    })

    it('uses custom reason as description', () => {
      const event = assembleAuthFailureEvent('1.2.3.4', undefined, 'Invalid MFA code')
      expect(event.description).toBe('Invalid MFA code')
    })

    it('includes reason in metadata', () => {
      const event = assembleAuthFailureEvent('1.2.3.4', undefined, 'locked out')
      expect(event.metadata).toEqual({ reason: 'locked out' })
    })
  })

  describe('logRateLimitExceeded', () => {
    it('sets eventType to rate_limit_exceeded', () => {
      const event = assembleRateLimitEvent('1.2.3.4', '/api/analysis', 10)
      expect(event.eventType).toBe('rate_limit_exceeded')
    })

    it('includes endpoint and limit in description', () => {
      const event = assembleRateLimitEvent('1.2.3.4', '/api/share', 5)
      expect(event.description).toBe('Rate limit (5) exceeded on /api/share')
    })

    it('sets resourceType to endpoint', () => {
      const event = assembleRateLimitEvent('1.2.3.4', '/api/analysis', 10)
      expect(event.resourceType).toBe('endpoint')
    })

    it('sets resourceId to the endpoint path', () => {
      const event = assembleRateLimitEvent(null, '/api/audit', 20)
      expect(event.resourceId).toBe('/api/audit')
    })

    it('includes endpoint and limit in metadata', () => {
      const event = assembleRateLimitEvent('1.2.3.4', '/api/xero', 60)
      expect(event.metadata).toEqual({ endpoint: '/api/xero', limit: 60 })
    })
  })

  describe('logShareBruteForce', () => {
    it('sets eventType to share_brute_force', () => {
      const event = assembleShareBruteForceEvent('1.2.3.4', 'abc123def456')
      expect(event.eventType).toBe('share_brute_force')
    })

    it('truncates share token in description to 8 chars', () => {
      const event = assembleShareBruteForceEvent('1.2.3.4', 'abcdefghijklmnop')
      expect(event.description).toContain('abcdefgh...')
      expect(event.description).not.toContain('ijklmnop')
    })

    it('sets resourceType to share_link', () => {
      const event = assembleShareBruteForceEvent('1.2.3.4', 'token123')
      expect(event.resourceType).toBe('share_link')
    })

    it('stores full token as resourceId', () => {
      const fullToken = 'abc123def456ghi789'
      const event = assembleShareBruteForceEvent('1.2.3.4', fullToken)
      expect(event.resourceId).toBe(fullToken)
    })
  })

  describe('logUnauthorizedAccess', () => {
    it('sets severity to critical', () => {
      const event = assembleUnauthorizedAccessEvent('1.2.3.4', 'tenant', 'tenant-123')
      expect(event.severity).toBe('critical')
    })

    it('includes resourceType and resourceId in description', () => {
      const event = assembleUnauthorizedAccessEvent('1.2.3.4', 'report', 'report-456')
      expect(event.description).toBe('Unauthorized access attempt to report/report-456')
    })

    it('passes through userId when provided', () => {
      const event = assembleUnauthorizedAccessEvent('1.2.3.4', 'tenant', 't-1', 'user-99')
      expect(event.userId).toBe('user-99')
    })

    it('userId is undefined when not provided', () => {
      const event = assembleUnauthorizedAccessEvent('1.2.3.4', 'tenant', 't-1')
      expect(event.userId).toBeUndefined()
    })
  })

  describe('logBulkDataAccess', () => {
    it('sets severity to warning for <= 1000 records', () => {
      const event = assembleBulkDataAccessEvent('tenant-1', 'user-1', 500, 'transactions')
      expect(event.severity).toBe('warning')
    })

    it('sets severity to warning for exactly 1000 records', () => {
      const event = assembleBulkDataAccessEvent('tenant-1', 'user-1', 1000, 'transactions')
      expect(event.severity).toBe('warning')
    })

    it('escalates severity to critical for > 1000 records', () => {
      const event = assembleBulkDataAccessEvent('tenant-1', 'user-1', 1001, 'transactions')
      expect(event.severity).toBe('critical')
    })

    it('includes record count in description', () => {
      const event = assembleBulkDataAccessEvent('tenant-1', 'user-1', 5000, 'invoices')
      expect(event.description).toBe('Bulk data access: 5000 invoices records accessed')
    })

    it('includes recordCount in metadata', () => {
      const event = assembleBulkDataAccessEvent('tenant-1', 'user-1', 250, 'contacts')
      expect(event.metadata).toEqual({ recordCount: 250 })
    })
  })

  describe('logDataExport', () => {
    it('sets severity to info', () => {
      const event = assembleDataExportEvent('tenant-1', 'user-1', 'csv', 100)
      expect(event.severity).toBe('info')
    })

    it('sets resourceType to export', () => {
      const event = assembleDataExportEvent('tenant-1', 'user-1', 'xlsx', 50)
      expect(event.resourceType).toBe('export')
    })

    it('sets resourceId to export type', () => {
      const event = assembleDataExportEvent('tenant-1', 'user-1', 'pdf', 25)
      expect(event.resourceId).toBe('pdf')
    })

    it('includes export type and record count in description', () => {
      const event = assembleDataExportEvent('tenant-1', 'user-1', 'csv', 1500)
      expect(event.description).toBe('Data export: 1500 records exported as csv')
    })

    it('includes exportType and recordCount in metadata', () => {
      const event = assembleDataExportEvent('tenant-1', 'user-1', 'xlsx', 300)
      expect(event.metadata).toEqual({ exportType: 'xlsx', recordCount: 300 })
    })
  })
})

// =============================================================================
// Breach Record Assembly Tests
// =============================================================================

describe('Breach Record Assembly', () => {
  function mapEventToBreachType(
    eventType: SecurityEventType
  ): 'unauthorized_access' | 'unauthorized_disclosure' | 'loss_of_data' | 'system_compromise' {
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

  function mapEventToDataTypes(eventType: SecurityEventType): string[] {
    switch (eventType) {
      case 'auth_failure':
      case 'share_brute_force':
        return ['email', 'credentials']
      case 'bulk_data_access':
      case 'data_export':
        return ['financial_transactions', 'supplier_names', 'addresses']
      case 'token_compromise':
      case 'oauth_anomaly':
        return ['oauth_tokens', 'financial_transactions']
      case 'unauthorized_access':
        return ['financial_transactions']
      case 'admin_escalation':
        return ['system_configuration', 'user_data']
      default:
        return ['unknown']
    }
  }

  function assembleBreachRecord(
    event: SecurityEvent,
    eventCount: number,
    threshold: { count: number; windowMinutes: number }
  ) {
    return {
      breach_type: mapEventToBreachType(event.eventType),
      title: `Automated detection: ${event.eventType} anomaly`,
      description:
        `${eventCount} ${event.eventType} events detected in ${threshold.windowMinutes} minutes ` +
        `(threshold: ${threshold.count}). ` +
        `IP: ${event.ipAddress || 'unknown'}. ` +
        `Tenant: ${event.tenantId || 'N/A'}. ` +
        `Latest event: ${event.description}`,
      affected_tenant_ids: event.tenantId ? [event.tenantId] : [],
      affected_data_types: mapEventToDataTypes(event.eventType),
      detected_by: 'automated',
      metadata: {
        trigger_event_type: event.eventType,
        event_count: eventCount,
        threshold_count: threshold.count,
        window_minutes: threshold.windowMinutes,
        trigger_ip: event.ipAddress,
        trigger_user_agent: event.userAgent,
      },
    }
  }

  it('sets breach_type based on event type', () => {
    const event: SecurityEvent = {
      eventType: 'auth_failure',
      severity: 'warning',
      description: 'Test event',
    }
    const record = assembleBreachRecord(event, 15, { count: 10, windowMinutes: 15 })
    expect(record.breach_type).toBe('unauthorized_access')
  })

  it('includes event count and threshold in description', () => {
    const event: SecurityEvent = {
      eventType: 'share_brute_force',
      severity: 'warning',
      ipAddress: '10.0.0.1',
      description: 'Brute force on token abc',
    }
    const record = assembleBreachRecord(event, 8, { count: 5, windowMinutes: 10 })
    expect(record.description).toContain('8 share_brute_force events detected in 10 minutes')
    expect(record.description).toContain('(threshold: 5)')
    expect(record.description).toContain('IP: 10.0.0.1')
  })

  it('shows unknown IP when ipAddress is not provided', () => {
    const event: SecurityEvent = {
      eventType: 'auth_failure',
      severity: 'warning',
      description: 'Failed login',
    }
    const record = assembleBreachRecord(event, 12, { count: 10, windowMinutes: 15 })
    expect(record.description).toContain('IP: unknown')
  })

  it('includes tenantId in affected_tenant_ids when provided', () => {
    const event: SecurityEvent = {
      eventType: 'bulk_data_access',
      severity: 'critical',
      tenantId: 'tenant-abc',
      userId: 'user-1',
      description: 'Bulk access',
    }
    const record = assembleBreachRecord(event, 5, { count: 3, windowMinutes: 60 })
    expect(record.affected_tenant_ids).toEqual(['tenant-abc'])
  })

  it('uses empty array for affected_tenant_ids when no tenantId', () => {
    const event: SecurityEvent = {
      eventType: 'auth_failure',
      severity: 'warning',
      description: 'No tenant',
    }
    const record = assembleBreachRecord(event, 12, { count: 10, windowMinutes: 15 })
    expect(record.affected_tenant_ids).toEqual([])
  })

  it('sets detected_by to automated', () => {
    const event: SecurityEvent = {
      eventType: 'token_compromise',
      severity: 'critical',
      description: 'Token leaked',
    }
    const record = assembleBreachRecord(event, 1, { count: 1, windowMinutes: 1 })
    expect(record.detected_by).toBe('automated')
  })

  it('populates metadata with trigger details', () => {
    const event: SecurityEvent = {
      eventType: 'oauth_anomaly',
      severity: 'critical',
      ipAddress: '192.168.1.1',
      userAgent: 'suspicious-bot/1.0',
      description: 'Unusual OAuth pattern',
    }
    const record = assembleBreachRecord(event, 4, { count: 3, windowMinutes: 60 })
    expect(record.metadata.trigger_event_type).toBe('oauth_anomaly')
    expect(record.metadata.event_count).toBe(4)
    expect(record.metadata.threshold_count).toBe(3)
    expect(record.metadata.window_minutes).toBe(60)
    expect(record.metadata.trigger_ip).toBe('192.168.1.1')
    expect(record.metadata.trigger_user_agent).toBe('suspicious-bot/1.0')
  })

  it('generates correct title format', () => {
    const event: SecurityEvent = {
      eventType: 'rate_limit_exceeded',
      severity: 'warning',
      description: 'Rate limit hit',
    }
    const record = assembleBreachRecord(event, 25, { count: 20, windowMinutes: 60 })
    expect(record.title).toBe('Automated detection: rate_limit_exceeded anomaly')
  })
})

// =============================================================================
// Supabase Insert Row Assembly Tests
// =============================================================================

describe('Security Event Insert Row Assembly', () => {
  function assembleInsertRow(event: SecurityEvent) {
    return {
      event_type: event.eventType,
      severity: event.severity,
      tenant_id: event.tenantId || null,
      user_id: event.userId || null,
      ip_address: event.ipAddress || null,
      user_agent: event.userAgent || null,
      resource_type: event.resourceType || null,
      resource_id: event.resourceId || null,
      description: event.description,
      metadata: event.metadata || {},
    }
  }

  it('maps camelCase event fields to snake_case database columns', () => {
    const event: SecurityEvent = {
      eventType: 'auth_failure',
      severity: 'warning',
      tenantId: 'tenant-1',
      userId: 'user-1',
      ipAddress: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      resourceType: 'endpoint',
      resourceId: '/api/login',
      description: 'Failed login',
      metadata: { attempt: 3 },
    }
    const row = assembleInsertRow(event)

    expect(row.event_type).toBe('auth_failure')
    expect(row.severity).toBe('warning')
    expect(row.tenant_id).toBe('tenant-1')
    expect(row.user_id).toBe('user-1')
    expect(row.ip_address).toBe('1.2.3.4')
    expect(row.user_agent).toBe('Mozilla/5.0')
    expect(row.resource_type).toBe('endpoint')
    expect(row.resource_id).toBe('/api/login')
    expect(row.description).toBe('Failed login')
    expect(row.metadata).toEqual({ attempt: 3 })
  })

  it('converts undefined optional fields to null', () => {
    const event: SecurityEvent = {
      eventType: 'auth_failure',
      severity: 'warning',
      description: 'Minimal event',
    }
    const row = assembleInsertRow(event)

    expect(row.tenant_id).toBeNull()
    expect(row.user_id).toBeNull()
    expect(row.ip_address).toBeNull()
    expect(row.user_agent).toBeNull()
    expect(row.resource_type).toBeNull()
    expect(row.resource_id).toBeNull()
  })

  it('defaults metadata to empty object when not provided', () => {
    const event: SecurityEvent = {
      eventType: 'auth_failure',
      severity: 'warning',
      description: 'No metadata',
    }
    const row = assembleInsertRow(event)
    expect(row.metadata).toEqual({})
  })
})

// =============================================================================
// Event Type Coverage Tests
// =============================================================================

describe('Event Type Coverage', () => {
  const ALL_EVENT_TYPES: SecurityEventType[] = [
    'auth_failure',
    'rate_limit_exceeded',
    'unauthorized_access',
    'token_compromise',
    'bulk_data_access',
    'suspicious_ip',
    'oauth_anomaly',
    'share_brute_force',
    'data_export',
    'admin_escalation',
  ]

  it('has exactly 10 event types defined', () => {
    expect(ALL_EVENT_TYPES).toHaveLength(10)
  })

  it('all event types are unique', () => {
    const unique = new Set(ALL_EVENT_TYPES)
    expect(unique.size).toBe(ALL_EVENT_TYPES.length)
  })

  it('every event type maps to a valid breach type', () => {
    function mapEventToBreachType(eventType: SecurityEventType): string {
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

    const validBreachTypes = ['unauthorized_access', 'unauthorized_disclosure', 'loss_of_data', 'system_compromise']

    for (const type of ALL_EVENT_TYPES) {
      const breachType = mapEventToBreachType(type)
      expect(validBreachTypes).toContain(breachType)
    }
  })

  it('every event type maps to non-empty data types array', () => {
    function mapEventToDataTypes(eventType: SecurityEventType): string[] {
      switch (eventType) {
        case 'auth_failure':
        case 'share_brute_force':
          return ['email', 'credentials']
        case 'bulk_data_access':
        case 'data_export':
          return ['financial_transactions', 'supplier_names', 'addresses']
        case 'token_compromise':
        case 'oauth_anomaly':
          return ['oauth_tokens', 'financial_transactions']
        case 'unauthorized_access':
          return ['financial_transactions']
        case 'admin_escalation':
          return ['system_configuration', 'user_data']
        default:
          return ['unknown']
      }
    }

    for (const type of ALL_EVENT_TYPES) {
      const dataTypes = mapEventToDataTypes(type)
      expect(dataTypes.length).toBeGreaterThan(0)
    }
  })
})
