/**
 * Breach Detection & Assessment (P2-8: NDB Compliance)
 *
 * Analyses security events to detect potential data breaches and
 * manages the 30-day assessment workflow required by the Privacy Act 1988
 * NDB scheme (Part IIIC).
 *
 * Key responsibilities:
 * - Query breach register for pending assessments
 * - Check for overdue assessment deadlines (s 26WH(2))
 * - Provide breach status summary for admin dashboard
 *
 * @see lib/security/security-event-logger.ts — event logging
 * @see supabase/migrations/20260208_ndb_security_events.sql — schema
 */

import { createServiceClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/logger'

const log = createLogger('security:breach-detector')

export interface BreachRecord {
  id: string
  discoveryDate: string
  estimatedBreachDate: string | null
  assessmentDeadline: string
  breachType: string
  affectedTenantIds: string[]
  affectedRecordCount: number | null
  affectedDataTypes: string[]
  title: string
  description: string
  rootCause: string | null
  assessmentStatus: string
  seriousHarmLikely: boolean | null
  assessmentNotes: string | null
  oaicNotified: boolean
  oaicNotificationDate: string | null
  individualsNotified: boolean
  remediationActions: string | null
  remediatedAt: string | null
  detectedBy: string
  createdAt: string
}

export interface BreachSummary {
  totalBreaches: number
  openBreaches: number
  overdueAssessments: number
  notifiableBreaches: number
  remediatedBreaches: number
  recentBreaches: BreachRecord[]
  overdueBreachIds: string[]
}

export interface SecurityEventSummary {
  last24Hours: {
    total: number
    critical: number
    warning: number
    info: number
  }
  last7Days: {
    total: number
    byType: Record<string, number>
  }
  topIps: Array<{ ip: string; count: number }>
}

/**
 * Get a summary of all breaches in the register.
 * Used by admin dashboard to display NDB compliance status.
 */
export async function getBreachSummary(): Promise<BreachSummary> {
  try {
    const supabase = await createServiceClient()

    const { data: breaches, error } = await supabase
      .from('data_breaches')
      .select('*')
      .order('created_at', { ascending: false })

    if (error || !breaches) {
      log.error('Failed to fetch breach register', { error: error?.message })
      return createEmptyBreachSummary()
    }

    const now = new Date()
    const openStatuses = ['detected', 'assessing']
    const openBreaches = breaches.filter(b => openStatuses.includes(b.assessment_status))
    const overdueBreaches = openBreaches.filter(b =>
      new Date(b.assessment_deadline) <= now
    )
    const notifiableBreaches = breaches.filter(b => b.assessment_status === 'notifiable')
    const remediatedBreaches = breaches.filter(b => b.assessment_status === 'remediated')

    return {
      totalBreaches: breaches.length,
      openBreaches: openBreaches.length,
      overdueAssessments: overdueBreaches.length,
      notifiableBreaches: notifiableBreaches.length,
      remediatedBreaches: remediatedBreaches.length,
      recentBreaches: breaches.slice(0, 10).map(mapBreachRow),
      overdueBreachIds: overdueBreaches.map(b => b.id),
    }
  } catch (err) {
    log.error('Exception fetching breach summary', { error: err })
    return createEmptyBreachSummary()
  }
}

/**
 * Get all breaches that are approaching or past their 30-day assessment deadline.
 * Returns breaches due within 7 days.
 */
export async function getOverdueAssessments(): Promise<BreachRecord[]> {
  try {
    const supabase = await createServiceClient()

    const { data, error } = await supabase.rpc('get_overdue_breach_assessments')

    if (error || !data) {
      log.error('Failed to fetch overdue assessments', { error: error?.message })
      return []
    }

    return (data as Record<string, unknown>[]).map(mapBreachRow)
  } catch (err) {
    log.error('Exception fetching overdue assessments', { error: err })
    return []
  }
}

/**
 * Get a summary of security events for monitoring dashboard.
 */
export async function getSecurityEventSummary(): Promise<SecurityEventSummary> {
  try {
    const supabase = await createServiceClient()
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Last 24 hours breakdown
    const { data: events24h, error: err24h } = await supabase
      .from('security_events')
      .select('severity')
      .gte('created_at', last24h)

    // Last 7 days by type
    const { data: events7d, error: err7d } = await supabase
      .from('security_events')
      .select('event_type')
      .gte('created_at', last7d)

    // Top IPs in last 24 hours (potential attackers)
    const { data: ipEvents, error: errIp } = await supabase
      .from('security_events')
      .select('ip_address')
      .gte('created_at', last24h)
      .not('ip_address', 'is', null)

    if (err24h || err7d || errIp) {
      log.error('Failed to fetch security event summary', {
        err24h: err24h?.message,
        err7d: err7d?.message,
        errIp: errIp?.message,
      })
    }

    // Count severities
    const sevCounts = { total: 0, critical: 0, warning: 0, info: 0 }
    for (const e of (events24h || [])) {
      sevCounts.total++
      const sev = e.severity as string
      if (sev === 'critical') sevCounts.critical++
      else if (sev === 'warning') sevCounts.warning++
      else sevCounts.info++
    }

    // Count by type
    const byType: Record<string, number> = {}
    for (const e of (events7d || [])) {
      const t = e.event_type as string
      byType[t] = (byType[t] || 0) + 1
    }

    // Top IPs
    const ipCounts: Record<string, number> = {}
    for (const e of (ipEvents || [])) {
      const ip = e.ip_address as string
      if (ip) ipCounts[ip] = (ipCounts[ip] || 0) + 1
    }
    const topIps = Object.entries(ipCounts)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      last24Hours: sevCounts,
      last7Days: {
        total: (events7d || []).length,
        byType,
      },
      topIps,
    }
  } catch (err) {
    log.error('Exception fetching security event summary', { error: err })
    return {
      last24Hours: { total: 0, critical: 0, warning: 0, info: 0 },
      last7Days: { total: 0, byType: {} },
      topIps: [],
    }
  }
}

/**
 * Update a breach assessment status (admin action).
 */
export async function updateBreachAssessment(
  breachId: string,
  update: {
    assessmentStatus?: string
    seriousHarmLikely?: boolean
    assessmentNotes?: string
    rootCause?: string
    remediationActions?: string
    oaicNotified?: boolean
    oaicReferenceId?: string
    individualsNotified?: boolean
    notificationMethod?: string
  }
): Promise<boolean> {
  try {
    const supabase = await createServiceClient()

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (update.assessmentStatus !== undefined) updateData.assessment_status = update.assessmentStatus
    if (update.seriousHarmLikely !== undefined) updateData.serious_harm_likely = update.seriousHarmLikely
    if (update.assessmentNotes !== undefined) updateData.assessment_notes = update.assessmentNotes
    if (update.rootCause !== undefined) updateData.root_cause = update.rootCause
    if (update.remediationActions !== undefined) {
      updateData.remediation_actions = update.remediationActions
      if (update.assessmentStatus === 'remediated') {
        updateData.remediated_at = new Date().toISOString()
      }
    }
    if (update.oaicNotified) {
      updateData.oaic_notified = true
      updateData.oaic_notification_date = new Date().toISOString()
      if (update.oaicReferenceId) updateData.oaic_reference_id = update.oaicReferenceId
    }
    if (update.individualsNotified) {
      updateData.individuals_notified = true
      updateData.individuals_notification_date = new Date().toISOString()
      if (update.notificationMethod) updateData.notification_method = update.notificationMethod
    }

    const { error } = await supabase
      .from('data_breaches')
      .update(updateData)
      .eq('id', breachId)

    if (error) {
      log.error('Failed to update breach assessment', { breachId, error: error.message })
      return false
    }

    log.info('Breach assessment updated', { breachId, status: update.assessmentStatus })
    return true
  } catch (err) {
    log.error('Exception updating breach assessment', { breachId, error: err })
    return false
  }
}

/** Map database row to BreachRecord */
function mapBreachRow(row: Record<string, unknown>): BreachRecord {
  return {
    id: row.id as string,
    discoveryDate: row.discovery_date as string,
    estimatedBreachDate: row.estimated_breach_date as string | null,
    assessmentDeadline: row.assessment_deadline as string,
    breachType: row.breach_type as string,
    affectedTenantIds: (row.affected_tenant_ids || []) as string[],
    affectedRecordCount: row.affected_record_count as number | null,
    affectedDataTypes: (row.affected_data_types || []) as string[],
    title: row.title as string,
    description: row.description as string,
    rootCause: row.root_cause as string | null,
    assessmentStatus: row.assessment_status as string,
    seriousHarmLikely: row.serious_harm_likely as boolean | null,
    assessmentNotes: row.assessment_notes as string | null,
    oaicNotified: row.oaic_notified as boolean,
    oaicNotificationDate: row.oaic_notification_date as string | null,
    individualsNotified: row.individuals_notified as boolean,
    remediationActions: row.remediation_actions as string | null,
    remediatedAt: row.remediated_at as string | null,
    detectedBy: row.detected_by as string,
    createdAt: row.created_at as string,
  }
}

function createEmptyBreachSummary(): BreachSummary {
  return {
    totalBreaches: 0,
    openBreaches: 0,
    overdueAssessments: 0,
    notifiableBreaches: 0,
    remediatedBreaches: 0,
    recentBreaches: [],
    overdueBreachIds: [],
  }
}
