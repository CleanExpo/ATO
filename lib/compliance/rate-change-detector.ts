/**
 * Rate Change Detector
 *
 * Compares current tax rates against cached values to detect changes.
 * Writes detected changes to the rate_change_log table for notification.
 *
 * Used by the weekly compliance CRON job.
 */

import { createClient } from '@/lib/supabase/server'
import type { Jurisdiction, RateChangeEvent } from '@/lib/types/jurisdiction'
import { createLogger } from '@/lib/logger'

const log = createLogger('compliance:rate-change-detector')

export interface RateComparison {
  rateType: string
  rateKey: string
  currentValue: number
  cachedValue: number | null
}

/**
 * Compare new rates against cached rates and detect changes.
 *
 * @param jurisdiction - 'AU' | 'NZ' | 'UK'
 * @param newRates - Map of rate_type:rate_key → current value
 * @returns Array of detected changes
 */
export async function detectRateChanges(
  jurisdiction: Jurisdiction,
  newRates: Map<string, number>
): Promise<RateChangeEvent[]> {
  const changes: RateChangeEvent[] = []

  try {
    const supabase = await createClient()

    // Fetch current cached rates for this jurisdiction
    const { data: cachedRates, error } = await supabase
      .from('jurisdiction_tax_rates')
      .select('rate_type, rate_key, rate_value')
      .eq('jurisdiction', jurisdiction)
      .is('effective_to', null)

    if (error) {
      log.error(`Failed to fetch cached rates for ${jurisdiction}:`, error)
      return changes
    }

    // Build lookup map of cached rates
    const cachedMap = new Map<string, number>()
    for (const row of cachedRates || []) {
      cachedMap.set(`${row.rate_type}:${row.rate_key}`, Number(row.rate_value))
    }

    // Compare each new rate against cached
    for (const [compositeKey, newValue] of newRates) {
      const cachedValue = cachedMap.get(compositeKey)

      if (cachedValue !== undefined && cachedValue !== newValue) {
        const [rateType, rateKey] = compositeKey.split(':')
        const change: RateChangeEvent = {
          jurisdiction,
          rateType,
          rateKey,
          oldValue: cachedValue,
          newValue,
          changeDetectedAt: new Date().toISOString(),
          notificationSent: false,
        }
        changes.push(change)

        log.info(
          `Rate change detected: ${jurisdiction} ${rateType}:${rateKey} ` +
          `${cachedValue} → ${newValue}`
        )
      }
    }

    // Write changes to rate_change_log
    if (changes.length > 0) {
      const { error: insertError } = await supabase
        .from('rate_change_log')
        .insert(
          changes.map((c) => ({
            jurisdiction: c.jurisdiction,
            rate_type: c.rateType,
            rate_key: c.rateKey,
            old_value: c.oldValue,
            new_value: c.newValue,
            change_detected_at: c.changeDetectedAt,
            notification_sent: false,
          }))
        )

      if (insertError) {
        log.error('Failed to insert rate changes:', insertError)
      }
    }
  } catch (err) {
    log.error(`Rate change detection error: ${String(err)}`)
  }

  return changes
}

/**
 * Get recent rate changes that haven't been notified yet.
 */
export async function getUnnotifiedRateChanges(
  jurisdiction?: Jurisdiction
): Promise<RateChangeEvent[]> {
  try {
    const supabase = await createClient()
    let query = supabase
      .from('rate_change_log')
      .select('*')
      .eq('notification_sent', false)
      .order('change_detected_at', { ascending: false })

    if (jurisdiction) {
      query = query.eq('jurisdiction', jurisdiction)
    }

    const { data, error } = await query

    if (error || !data) return []

    return data.map((row) => ({
      jurisdiction: row.jurisdiction as Jurisdiction,
      rateType: row.rate_type,
      rateKey: row.rate_key,
      oldValue: Number(row.old_value),
      newValue: Number(row.new_value),
      changeDetectedAt: row.change_detected_at,
      notificationSent: row.notification_sent,
    }))
  } catch {
    return []
  }
}

/**
 * Mark rate changes as notified.
 */
export async function markRateChangesNotified(
  changeIds: string[]
): Promise<void> {
  if (changeIds.length === 0) return

  try {
    const supabase = await createClient()
    await supabase
      .from('rate_change_log')
      .update({ notification_sent: true })
      .in('id', changeIds)
  } catch (err) {
    log.error(`Failed to mark rate changes as notified: ${String(err)}`)
  }
}
