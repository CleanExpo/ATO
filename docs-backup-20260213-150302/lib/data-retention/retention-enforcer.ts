/**
 * Data Retention Enforcement
 *
 * Enforces retention policies by purging expired records from Supabase.
 * Uses the admin client (RLS bypass) since this is a system-level operation.
 *
 * Safety mechanisms:
 * - NEVER deletes from tables with retention > 5 years if records are younger than 5 years
 * - Logs every deletion operation with count and cutoff date
 * - Returns a full summary of actions taken for audit trail
 *
 * @module lib/data-retention/retention-enforcer
 */

import { createAdminClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/logger'
import {
  RETENTION_POLICIES,
  getExpiredRecordsCutoff,
  type RetentionPolicy,
} from './retention-policy'

const log = createLogger('data-retention:enforcer')

/** Minimum retention threshold (5 years in days) for the safety check */
const FIVE_YEAR_THRESHOLD_DAYS = 1825

/** Result of enforcing retention on a single table */
export interface RetentionEnforcementResult {
  table: string
  deletedCount: number
  cutoffDate: string
}

/** Status information for a single table's retention state */
export interface RetentionStatusEntry {
  table: string
  totalRecords: number
  oldestRecord: string | null
  expiringWithin30Days: number
}

/**
 * Enforce all retention policies by deleting expired records.
 *
 * For each configured policy:
 * 1. Calculates the cutoff date based on the retention period
 * 2. Applies a safety check for long-retention tables (>5 years)
 * 3. Deletes records older than the cutoff
 * 4. Logs the operation
 *
 * @returns Array of results showing what was deleted from each table
 */
export async function enforceRetentionPolicies(): Promise<RetentionEnforcementResult[]> {
  const supabase = createAdminClient()
  const results: RetentionEnforcementResult[] = []

  log.info('Starting retention policy enforcement', {
    policyCount: RETENTION_POLICIES.length,
  })

  for (const policy of RETENTION_POLICIES) {
    try {
      const result = await enforcePolicy(supabase, policy)
      results.push(result)
    } catch (error) {
      log.error(
        `Failed to enforce retention for table ${policy.table}`,
        error instanceof Error ? error : undefined,
        { table: policy.table }
      )
      // Continue with remaining policies even if one fails
      results.push({
        table: policy.table,
        deletedCount: 0,
        cutoffDate: getExpiredRecordsCutoff(policy).toISOString(),
      })
    }
  }

  log.info('Retention policy enforcement complete', {
    results: results.map((r) => `${r.table}: ${r.deletedCount} deleted`),
  })

  return results
}

/**
 * Enforce a single retention policy.
 *
 * Includes a SAFETY CHECK: for tables with retention > 5 years (e.g. data_breaches at 7 years),
 * we verify that we are NOT deleting records younger than 5 years. This prevents
 * accidental mass deletion if a policy is misconfigured.
 */
async function enforcePolicy(
  supabase: ReturnType<typeof createAdminClient>,
  policy: RetentionPolicy
): Promise<RetentionEnforcementResult> {
  const cutoff = getExpiredRecordsCutoff(policy)
  const cutoffIso = cutoff.toISOString()

  // SAFETY CHECK: For long-retention policies (>5 years), ensure we are not
  // deleting anything younger than 5 years. This guards against misconfiguration
  // that could wipe out records required by s 262A ITAA 1936.
  if (policy.retentionDays > FIVE_YEAR_THRESHOLD_DAYS) {
    const fiveYearsAgo = new Date()
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)

    if (cutoff > fiveYearsAgo) {
      log.warn(
        `Safety check: skipping ${policy.table} — cutoff date ${cutoffIso} is less than 5 years ago. ` +
          `This table has a ${policy.retentionDays}-day retention but the calculated cutoff would delete ` +
          `records younger than 5 years.`,
        { table: policy.table, cutoffDate: cutoffIso, retentionDays: policy.retentionDays }
      )
      return {
        table: policy.table,
        deletedCount: 0,
        cutoffDate: cutoffIso,
      }
    }
  }

  // Count records to be deleted (for logging/audit before we delete)
  const { count: expiredCount, error: countError } = await supabase
    .from(policy.table)
    .select('*', { count: 'exact', head: true })
    .lt(policy.dateColumn, cutoffIso)

  if (countError) {
    log.error(
      `Failed to count expired records in ${policy.table}`,
      undefined,
      { table: policy.table, error: countError.message }
    )
    throw new Error(`Count failed for ${policy.table}: ${countError.message}`)
  }

  const toDelete = expiredCount ?? 0

  if (toDelete === 0) {
    log.info(`No expired records in ${policy.table}`, {
      table: policy.table,
      cutoffDate: cutoffIso,
    })
    return {
      table: policy.table,
      deletedCount: 0,
      cutoffDate: cutoffIso,
    }
  }

  // Delete expired records
  const { error: deleteError } = await supabase
    .from(policy.table)
    .delete()
    .lt(policy.dateColumn, cutoffIso)

  if (deleteError) {
    log.error(
      `Failed to delete expired records from ${policy.table}`,
      undefined,
      { table: policy.table, error: deleteError.message }
    )
    throw new Error(`Delete failed for ${policy.table}: ${deleteError.message}`)
  }

  log.info(`Purged ${toDelete} expired records from ${policy.table}`, {
    table: policy.table,
    deletedCount: toDelete,
    cutoffDate: cutoffIso,
    retentionDays: policy.retentionDays,
    legislation: policy.legislation || 'N/A',
  })

  return {
    table: policy.table,
    deletedCount: toDelete,
    cutoffDate: cutoffIso,
  }
}

/**
 * Get retention status for all policy-covered tables.
 *
 * For each table, returns:
 * - Total record count
 * - Oldest record date (null if table is empty)
 * - Count of records expiring within the next 30 days
 *
 * Useful for an admin dashboard to monitor data lifecycle.
 *
 * @returns Array of status entries for each retention-managed table
 */
export async function getRetentionStatus(): Promise<RetentionStatusEntry[]> {
  const supabase = createAdminClient()
  const results: RetentionStatusEntry[] = []

  for (const policy of RETENTION_POLICIES) {
    try {
      const entry = await getTableStatus(supabase, policy)
      results.push(entry)
    } catch (error) {
      log.error(
        `Failed to get retention status for ${policy.table}`,
        error instanceof Error ? error : undefined,
        { table: policy.table }
      )
      results.push({
        table: policy.table,
        totalRecords: 0,
        oldestRecord: null,
        expiringWithin30Days: 0,
      })
    }
  }

  return results
}

/**
 * Get retention status for a single table.
 */
async function getTableStatus(
  supabase: ReturnType<typeof createAdminClient>,
  policy: RetentionPolicy
): Promise<RetentionStatusEntry> {
  // Total record count
  const { count: totalCount, error: countError } = await supabase
    .from(policy.table)
    .select('*', { count: 'exact', head: true })

  if (countError) {
    throw new Error(`Count failed for ${policy.table}: ${countError.message}`)
  }

  // Oldest record
  const { data: oldestData, error: oldestError } = await supabase
    .from(policy.table)
    .select(policy.dateColumn)
    .order(policy.dateColumn, { ascending: true })
    .limit(1)

  if (oldestError) {
    throw new Error(`Oldest record query failed for ${policy.table}: ${oldestError.message}`)
  }

  const oldestRecord =
    oldestData && oldestData.length > 0
      ? (oldestData[0] as unknown as Record<string, string>)[policy.dateColumn] ?? null
      : null

  // Records expiring within the next 30 days
  // These are records that are currently within retention but will expire in <= 30 days
  const cutoff = getExpiredRecordsCutoff(policy)
  const cutoffPlus30 = new Date(cutoff.getTime() + 30 * 24 * 60 * 60 * 1000)

  const { count: expiringCount, error: expiringError } = await supabase
    .from(policy.table)
    .select('*', { count: 'exact', head: true })
    .gte(policy.dateColumn, cutoff.toISOString())
    .lt(policy.dateColumn, cutoffPlus30.toISOString())

  if (expiringError) {
    throw new Error(`Expiring count failed for ${policy.table}: ${expiringError.message}`)
  }

  return {
    table: policy.table,
    totalRecords: totalCount ?? 0,
    oldestRecord,
    expiringWithin30Days: expiringCount ?? 0,
  }
}
