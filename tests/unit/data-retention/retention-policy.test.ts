/**
 * Tests for Data Retention Policy (lib/data-retention/retention-policy.ts)
 *
 * Validates ATO 5-year record-keeping requirements under s 262A ITAA 1936,
 * shorter retention for re-fetchable cache data, and regulatory retention periods.
 *
 * Covers: RETENTION_POLICIES, getExpiredRecordsCutoff, isWithinRetentionPeriod
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RETENTION_POLICIES,
  getExpiredRecordsCutoff,
  isWithinRetentionPeriod,
  type RetentionPolicy,
} from '@/lib/data-retention/retention-policy'

// =============================================================================
// RETENTION_POLICIES structure tests
// =============================================================================

describe('RETENTION_POLICIES', () => {
  it('should define policies for all expected tables', () => {
    const tableNames = RETENTION_POLICIES.map(p => p.table)
    expect(tableNames).toContain('historical_transactions_cache')
    expect(tableNames).toContain('shared_report_access_log')
    expect(tableNames).toContain('security_events')
    expect(tableNames).toContain('analysis_results')
    expect(tableNames).toContain('recommendations')
    expect(tableNames).toContain('data_breaches')
  })

  it('should have exactly 6 policies', () => {
    expect(RETENTION_POLICIES).toHaveLength(6)
  })

  it('should have valid retention days for every policy (positive integer)', () => {
    for (const policy of RETENTION_POLICIES) {
      expect(policy.retentionDays).toBeGreaterThan(0)
      expect(Number.isInteger(policy.retentionDays)).toBe(true)
    }
  })

  it('should have non-empty table names', () => {
    for (const policy of RETENTION_POLICIES) {
      expect(policy.table).toBeTruthy()
      expect(policy.table.length).toBeGreaterThan(0)
    }
  })

  it('should have valid date column names', () => {
    for (const policy of RETENTION_POLICIES) {
      expect(policy.dateColumn).toBeTruthy()
      expect(['created_at', 'accessed_at']).toContain(policy.dateColumn)
    }
  })

  it('should have non-empty descriptions', () => {
    for (const policy of RETENTION_POLICIES) {
      expect(policy.description).toBeTruthy()
      expect(policy.description.length).toBeGreaterThan(10)
    }
  })

  it('should have legislation references for ATO-mandated policies', () => {
    const atoMandated = RETENTION_POLICIES.filter(
      p => p.table === 'analysis_results' || p.table === 'recommendations'
    )
    for (const policy of atoMandated) {
      expect(policy.legislation).toBeDefined()
      expect(policy.legislation).toContain('ITAA 1936')
    }
  })

  it('should have legislation reference for data breach retention', () => {
    const breachPolicy = RETENTION_POLICIES.find(p => p.table === 'data_breaches')
    expect(breachPolicy).toBeDefined()
    expect(breachPolicy!.legislation).toContain('Privacy Act 1988')
  })

  it('should order policies from shortest to longest retention', () => {
    for (let i = 1; i < RETENTION_POLICIES.length; i++) {
      expect(RETENTION_POLICIES[i].retentionDays).toBeGreaterThanOrEqual(
        RETENTION_POLICIES[i - 1].retentionDays
      )
    }
  })

  // Specific retention period validations
  it('transaction cache should have 90-day retention (re-fetchable)', () => {
    const cache = RETENTION_POLICIES.find(p => p.table === 'historical_transactions_cache')
    expect(cache!.retentionDays).toBe(90)
  })

  it('access logs and security events should have 2-year (730-day) retention', () => {
    const accessLogs = RETENTION_POLICIES.find(p => p.table === 'shared_report_access_log')
    const securityEvents = RETENTION_POLICIES.find(p => p.table === 'security_events')
    expect(accessLogs!.retentionDays).toBe(730)
    expect(securityEvents!.retentionDays).toBe(730)
  })

  it('analysis results and recommendations should have 5-year (1825-day) retention (s 262A)', () => {
    const analysis = RETENTION_POLICIES.find(p => p.table === 'analysis_results')
    const recs = RETENTION_POLICIES.find(p => p.table === 'recommendations')
    expect(analysis!.retentionDays).toBe(1825)
    expect(recs!.retentionDays).toBe(1825)
  })

  it('data breaches should have 7-year (2555-day) retention', () => {
    const breaches = RETENTION_POLICIES.find(p => p.table === 'data_breaches')
    expect(breaches!.retentionDays).toBe(2555)
  })
})

// =============================================================================
// getExpiredRecordsCutoff tests
// =============================================================================

describe('getExpiredRecordsCutoff', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-12T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return a Date object', () => {
    const policy: RetentionPolicy = {
      table: 'test',
      retentionDays: 30,
      dateColumn: 'created_at',
      description: 'Test policy',
    }
    const cutoff = getExpiredRecordsCutoff(policy)
    expect(cutoff).toBeInstanceOf(Date)
  })

  it('should return cutoff 90 days ago for transaction cache', () => {
    const cachePolicy = RETENTION_POLICIES.find(p => p.table === 'historical_transactions_cache')!
    const cutoff = getExpiredRecordsCutoff(cachePolicy)
    // 2026-02-12 minus 90 days = 2025-11-14
    expect(cutoff.getFullYear()).toBe(2025)
    expect(cutoff.getMonth()).toBe(10) // November (0-indexed)
    expect(cutoff.getDate()).toBe(14)
  })

  it('should return cutoff 730 days ago for security events', () => {
    const secPolicy = RETENTION_POLICIES.find(p => p.table === 'security_events')!
    const cutoff = getExpiredRecordsCutoff(secPolicy)
    // 2026-02-12 minus 730 days = 2024-02-13 (2024 is leap year)
    expect(cutoff.getFullYear()).toBe(2024)
    expect(cutoff.getMonth()).toBe(1) // February
  })

  it('should return cutoff 1825 days ago for analysis results', () => {
    const analysisPolicy = RETENTION_POLICIES.find(p => p.table === 'analysis_results')!
    const cutoff = getExpiredRecordsCutoff(analysisPolicy)
    // 2026-02-12 minus 1825 days ~ 2021-02-12 (approximately 5 years)
    expect(cutoff.getFullYear()).toBe(2021)
  })

  it('should return cutoff 2555 days ago for data breaches', () => {
    const breachPolicy = RETENTION_POLICIES.find(p => p.table === 'data_breaches')!
    const cutoff = getExpiredRecordsCutoff(breachPolicy)
    // 2026-02-12 minus 2555 days ~ 2019-02-12 (approximately 7 years)
    expect(cutoff.getFullYear()).toBe(2019)
  })

  it('should return a date before now', () => {
    const policy: RetentionPolicy = {
      table: 'test',
      retentionDays: 1,
      dateColumn: 'created_at',
      description: 'Test policy',
    }
    const cutoff = getExpiredRecordsCutoff(policy)
    expect(cutoff.getTime()).toBeLessThan(Date.now())
  })

  it('should handle zero-day retention (edge case)', () => {
    const policy: RetentionPolicy = {
      table: 'ephemeral',
      retentionDays: 0,
      dateColumn: 'created_at',
      description: 'No retention',
    }
    const cutoff = getExpiredRecordsCutoff(policy)
    // 0-day retention = cutoff is now
    expect(cutoff.getTime()).toBe(new Date('2026-02-12T00:00:00.000Z').getTime())
  })
})

// =============================================================================
// isWithinRetentionPeriod tests
// =============================================================================

describe('isWithinRetentionPeriod', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-12T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const cachePolicy = RETENTION_POLICIES.find(p => p.table === 'historical_transactions_cache')!

  it('should return true for a record created today', () => {
    const today = new Date('2026-02-12T00:00:00.000Z')
    expect(isWithinRetentionPeriod(today, cachePolicy)).toBe(true)
  })

  it('should return true for a record within the retention window', () => {
    // 30 days ago is within 90-day retention
    const thirtyDaysAgo = new Date('2026-01-13T00:00:00.000Z')
    expect(isWithinRetentionPeriod(thirtyDaysAgo, cachePolicy)).toBe(true)
  })

  it('should return false for a record older than the retention window', () => {
    // 100 days ago is outside 90-day retention
    const hundredDaysAgo = new Date('2025-11-04T00:00:00.000Z')
    expect(isWithinRetentionPeriod(hundredDaysAgo, cachePolicy)).toBe(false)
  })

  it('should accept ISO string date format', () => {
    const recentIso = '2026-02-10T12:00:00.000Z'
    expect(isWithinRetentionPeriod(recentIso, cachePolicy)).toBe(true)
  })

  it('should accept Date object', () => {
    const recentDate = new Date('2026-02-10T12:00:00.000Z')
    expect(isWithinRetentionPeriod(recentDate, cachePolicy)).toBe(true)
  })

  it('should return false for very old record against short retention', () => {
    const fiveYearsAgo = new Date('2021-01-01T00:00:00.000Z')
    expect(isWithinRetentionPeriod(fiveYearsAgo, cachePolicy)).toBe(false)
  })

  it('should return true for old record within 5-year retention policy', () => {
    const analysisPolicy = RETENTION_POLICIES.find(p => p.table === 'analysis_results')!
    // 3 years ago is within 5-year retention
    const threeYearsAgo = new Date('2023-02-12T00:00:00.000Z')
    expect(isWithinRetentionPeriod(threeYearsAgo, analysisPolicy)).toBe(true)
  })

  it('should return false for record outside 5-year retention', () => {
    const analysisPolicy = RETENTION_POLICIES.find(p => p.table === 'analysis_results')!
    // 6 years ago exceeds 5-year retention
    const sixYearsAgo = new Date('2020-01-01T00:00:00.000Z')
    expect(isWithinRetentionPeriod(sixYearsAgo, analysisPolicy)).toBe(false)
  })

  it('should handle boundary: record at exact cutoff date', () => {
    // 90 days before 2026-02-12 = 2025-11-14
    const exactCutoff = new Date('2025-11-14T00:00:00.000Z')
    // The cutoff is calculated from the millisecond timestamp, so this should be right at the boundary
    // getExpiredRecordsCutoff: now - retentionDays * 24*60*60*1000
    // isWithinRetentionPeriod: date >= cutoff
    // Since both use Date.now() which is frozen, the record at exactly the cutoff should be retained
    expect(isWithinRetentionPeriod(exactCutoff, cachePolicy)).toBe(true)
  })

  it('should return false for record 1 millisecond before cutoff', () => {
    // cutoff for 90-day policy at 2026-02-12T00:00:00.000Z
    const cutoffMs = new Date('2026-02-12T00:00:00.000Z').getTime() - 90 * 24 * 60 * 60 * 1000
    const justBefore = new Date(cutoffMs - 1)
    expect(isWithinRetentionPeriod(justBefore, cachePolicy)).toBe(false)
  })
})
