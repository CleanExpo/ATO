/**
 * Security Event Logger (P2-8: NDB Compliance)
 *
 * Logs security-relevant events to the `security_events` table for
 * breach detection and Privacy Act 1988 NDB scheme compliance.
 *
 * Events are logged non-blocking (failures never break the calling operation).
 * Anomaly detection thresholds trigger automatic breach assessment.
 *
 * @see supabase/migrations/20260208_ndb_security_events.sql
 * @see Privacy Act 1988 Part IIIC — Notifiable Data Breaches scheme
 */

import { createServiceClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/logger'

const log = createLogger('security:events')

export type SecurityEventType =
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

export type SecuritySeverity = 'info' | 'warning' | 'critical'

export interface SecurityEvent {
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

/**
 * Anomaly detection thresholds.
 * When exceeded within the time window, severity is automatically escalated
 * and breach detection is triggered.
 */
const ANOMALY_THRESHOLDS: Record<string, { count: number; windowMinutes: number }> = {
  auth_failure: { count: 10, windowMinutes: 15 },
  rate_limit_exceeded: { count: 20, windowMinutes: 60 },
  unauthorized_access: { count: 5, windowMinutes: 30 },
  share_brute_force: { count: 5, windowMinutes: 10 },
  oauth_anomaly: { count: 3, windowMinutes: 60 },
  token_compromise: { count: 1, windowMinutes: 1 },  // Any token compromise is critical
  bulk_data_access: { count: 3, windowMinutes: 60 },
}

/**
 * Log a security event.
 *
 * Non-blocking: failures are logged but never throw to the caller.
 * Critical events and anomaly threshold breaches are flagged for breach assessment.
 *
 * @returns true if logged successfully, false on failure
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<boolean> {
  try {
    const supabase = await createServiceClient()

    const { error } = await supabase.from('security_events').insert({
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
    })

    if (error) {
      console.error('[SECURITY] Failed to log security event:', error.message)
      return false
    }

    // Structured log for real-time monitoring
    log.warn('Security event recorded', {
      type: event.eventType,
      severity: event.severity,
      ip: event.ipAddress,
      tenant: event.tenantId,
      description: event.description,
    })

    // Check anomaly thresholds (non-blocking)
    checkAnomalyThreshold(event).catch(err =>
      console.error('[SECURITY] Anomaly check failed:', err)
    )

    return true
  } catch (err) {
    console.error('[SECURITY] Exception logging security event:', err)
    return false
  }
}

/**
 * Check if the event type has exceeded its anomaly threshold.
 * If exceeded, escalates to a potential data breach record.
 */
async function checkAnomalyThreshold(event: SecurityEvent): Promise<void> {
  const threshold = ANOMALY_THRESHOLDS[event.eventType]
  if (!threshold) return

  try {
    const supabase = await createServiceClient()

    const { data, error } = await supabase.rpc('count_security_events', {
      p_event_type: event.eventType,
      p_window_minutes: threshold.windowMinutes,
      p_ip_address: event.ipAddress || null,
      p_tenant_id: event.tenantId || null,
    })

    if (error || data === null || data === undefined) return

    const count = typeof data === 'number' ? data : 0

    if (count >= threshold.count) {
      log.error('ANOMALY THRESHOLD EXCEEDED', {
        type: event.eventType,
        count,
        threshold: threshold.count,
        windowMinutes: threshold.windowMinutes,
        ip: event.ipAddress,
        tenant: event.tenantId,
      })

      // Auto-create a potential breach record for assessment
      await createPotentialBreach(supabase, event, count, threshold)
    }
  } catch (err) {
    // Non-blocking — anomaly check failure should not disrupt operations
    console.error('[SECURITY] Anomaly threshold check error:', err)
  }
}

/**
 * Create a potential data breach record when anomaly thresholds are exceeded.
 * Assessment status starts as 'detected' — must be assessed within 30 days
 * per s 26WH(2) Privacy Act 1988.
 */
async function createPotentialBreach(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  event: SecurityEvent,
  eventCount: number,
  threshold: { count: number; windowMinutes: number }
): Promise<void> {
  // Check if there's already an open breach for this event type + IP in the last hour
  // to avoid creating duplicate breach records for the same incident
  const { data: existing } = await supabase
    .from('data_breaches')
    .select('id')
    .eq('breach_type', mapEventToBreachType(event.eventType))
    .in('assessment_status', ['detected', 'assessing'])
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .limit(1)

  if (existing && existing.length > 0) {
    log.info('Potential breach already recorded for this incident pattern', {
      existingBreachId: existing[0].id,
    })
    return
  }

  const { error } = await supabase.from('data_breaches').insert({
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
  })

  if (error) {
    console.error('[SECURITY] Failed to create potential breach record:', error.message)
  } else {
    log.error('POTENTIAL DATA BREACH RECORDED — 30-day assessment required (s 26WH Privacy Act 1988)', {
      eventType: event.eventType,
      eventCount,
      ip: event.ipAddress,
    })
  }
}

/** Map security event type to breach type classification */
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

/** Map event type to likely affected data types for breach record */
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

// --- Convenience functions for common security events ---

/** Log a failed authentication attempt */
export async function logAuthFailure(
  ipAddress: string | null,
  userId?: string,
  reason?: string
): Promise<void> {
  await logSecurityEvent({
    eventType: 'auth_failure',
    severity: 'warning',
    userId,
    ipAddress: ipAddress || undefined,
    description: reason || 'Authentication failed',
    metadata: { reason },
  })
}

/** Log a rate limit breach */
export async function logRateLimitExceeded(
  ipAddress: string | null,
  endpoint: string,
  limit: number
): Promise<void> {
  await logSecurityEvent({
    eventType: 'rate_limit_exceeded',
    severity: 'warning',
    ipAddress: ipAddress || undefined,
    resourceType: 'endpoint',
    resourceId: endpoint,
    description: `Rate limit (${limit}) exceeded on ${endpoint}`,
    metadata: { endpoint, limit },
  })
}

/** Log a share link brute force attempt */
export async function logShareBruteForce(
  ipAddress: string | null,
  shareToken: string
): Promise<void> {
  await logSecurityEvent({
    eventType: 'share_brute_force',
    severity: 'warning',
    ipAddress: ipAddress || undefined,
    resourceType: 'share_link',
    resourceId: shareToken,
    description: `Share link password brute force attempt on token ${shareToken.substring(0, 8)}...`,
  })
}

/** Log an unauthorized access attempt */
export async function logUnauthorizedAccess(
  ipAddress: string | null,
  resourceType: string,
  resourceId: string,
  userId?: string
): Promise<void> {
  await logSecurityEvent({
    eventType: 'unauthorized_access',
    severity: 'critical',
    userId,
    ipAddress: ipAddress || undefined,
    resourceType,
    resourceId,
    description: `Unauthorized access attempt to ${resourceType}/${resourceId}`,
  })
}

/** Log a bulk data access event (potential exfiltration) */
export async function logBulkDataAccess(
  tenantId: string,
  userId: string,
  recordCount: number,
  resourceType: string
): Promise<void> {
  await logSecurityEvent({
    eventType: 'bulk_data_access',
    severity: recordCount > 1000 ? 'critical' : 'warning',
    tenantId,
    userId,
    resourceType,
    description: `Bulk data access: ${recordCount} ${resourceType} records accessed`,
    metadata: { recordCount },
  })
}

/** Log a data export event */
export async function logDataExport(
  tenantId: string,
  userId: string,
  exportType: string,
  recordCount: number
): Promise<void> {
  await logSecurityEvent({
    eventType: 'data_export',
    severity: 'info',
    tenantId,
    userId,
    resourceType: 'export',
    resourceId: exportType,
    description: `Data export: ${recordCount} records exported as ${exportType}`,
    metadata: { exportType, recordCount },
  })
}
