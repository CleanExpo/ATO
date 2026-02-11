/**
 * Data Retention Policy Definitions
 *
 * Enforces ATO 5-year record-keeping requirements under s 262A ITAA 1936
 * while allowing shorter retention for re-fetchable cache data.
 *
 * Retention periods:
 * - Transaction cache: 90 days (raw cache, re-fetchable from Xero)
 * - Analysis results / recommendations: 5 years (ATO statutory minimum)
 * - Share access logs: 2 years
 * - Security events: 2 years
 * - Data breaches: 7 years (regulatory requirement)
 *
 * @module lib/data-retention/retention-policy
 */

/**
 * Defines a retention policy for a specific database table.
 */
export interface RetentionPolicy {
  /** Supabase table name */
  table: string
  /** Number of days to retain records */
  retentionDays: number
  /** Column name containing the record creation/event date */
  dateColumn: string
  /** Human-readable description of the policy rationale */
  description: string
  /** Relevant legislation reference, if applicable */
  legislation?: string
}

/**
 * All retention policies enforced by the system.
 *
 * Ordered from shortest to longest retention period.
 */
export const RETENTION_POLICIES: RetentionPolicy[] = [
  {
    table: 'historical_transactions_cache',
    retentionDays: 90,
    dateColumn: 'created_at',
    description:
      'Raw transaction cache from Xero. Short retention as data is re-fetchable from the accounting provider on demand.',
  },
  {
    table: 'shared_report_access_log',
    retentionDays: 730, // 2 years
    dateColumn: 'accessed_at',
    description:
      'Access logs for shared report links. Retained for security audit trail purposes.',
  },
  {
    table: 'security_events',
    retentionDays: 730, // 2 years
    dateColumn: 'created_at',
    description:
      'Security event records including authentication failures, rate limit breaches, and anomaly detections.',
  },
  {
    table: 'analysis_results',
    retentionDays: 1825, // 5 years
    dateColumn: 'created_at',
    description:
      'AI forensic analysis results. Must be retained for the ATO statutory minimum of 5 years from creation.',
    legislation: 's 262A ITAA 1936',
  },
  {
    table: 'recommendations',
    retentionDays: 1825, // 5 years
    dateColumn: 'created_at',
    description:
      'Tax recommendations generated from analysis. Must be retained for the ATO statutory minimum of 5 years.',
    legislation: 's 262A ITAA 1936',
  },
  {
    table: 'data_breaches',
    retentionDays: 2555, // 7 years
    dateColumn: 'created_at',
    description:
      'Data breach records under the Notifiable Data Breaches scheme. Retained for 7 years per regulatory requirement.',
    legislation: 'Part IIIC Privacy Act 1988',
  },
]

/**
 * Returns the cutoff date before which records are eligible for purging
 * under the given retention policy.
 *
 * @param policy - The retention policy to calculate the cutoff for
 * @returns Date object representing the earliest date records should be kept
 */
export function getExpiredRecordsCutoff(policy: RetentionPolicy): Date {
  const now = new Date()
  const cutoff = new Date(now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000)
  return cutoff
}

/**
 * Checks whether a given record date falls within the retention window
 * of the specified policy.
 *
 * @param recordDate - The date of the record (Date object or ISO string)
 * @param policy - The retention policy to check against
 * @returns true if the record is within the retention period (should be kept)
 */
export function isWithinRetentionPeriod(
  recordDate: Date | string,
  policy: RetentionPolicy
): boolean {
  const date = typeof recordDate === 'string' ? new Date(recordDate) : recordDate
  const cutoff = getExpiredRecordsCutoff(policy)
  return date >= cutoff
}
