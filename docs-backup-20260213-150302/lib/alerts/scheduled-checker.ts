/**
 * Scheduled Alert Checker
 *
 * Runs periodically to check for deadline-based alerts that aren't
 * triggered by analysis (BAS due, tax return due, etc.)
 */

import { createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'
import { createLogger } from '@/lib/logger'

const log = createLogger('alerts:scheduled-checker')

type _AlertDefinition = Database['public']['Tables']['tax_alert_definitions']['Row']

/**
 * Calculate Australian Financial Year from date
 */
function getFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-12

  // FY runs July 1 - June 30
  // If month >= 7 (July onwards), FY is current year + 1
  // If month < 7 (Jan-June), FY is current year
  const fyYear = month >= 7 ? year + 1 : year

  return fyYear.toString()
}

/**
 * Calculate FY end date for a given FY
 */
function getFYEndDate(financialYear: string): Date {
  const year = parseInt(financialYear.replace(/\D/g, ''))
  return new Date(year, 5, 30) // June 30 of the year
}

/**
 * Check for BAS lodgment deadlines
 */
async function checkBASDeadlines(): Promise<void> {
  const supabase = await createServiceClient()

  // Get BAS deadline alert definition
  const { data: definition } = await supabase
    .from('tax_alert_definitions')
    .select('*')
    .eq('alert_type', 'bas_lodgment_due')
    .eq('is_active', true)
    .single()

  if (!definition) return

  const advanceNoticeDays = definition.advance_notice_days || 14

  // BAS quarters (approximate dates - actual dates vary by entity type)
  const today = new Date()
  const currentYear = today.getFullYear()

  const basQuarters = [
    { quarter: 'Q1 (Jul-Sep)', dueDate: new Date(currentYear, 9, 28) }, // Oct 28
    { quarter: 'Q2 (Oct-Dec)', dueDate: new Date(currentYear + 1, 1, 28) }, // Feb 28
    { quarter: 'Q3 (Jan-Mar)', dueDate: new Date(currentYear, 4, 28) }, // May 28
    { quarter: 'Q4 (Apr-Jun)', dueDate: new Date(currentYear, 7, 28) } // Aug 28
  ]

  // Find next upcoming BAS deadline
  const upcomingDeadline = basQuarters.find(q => {
    const daysUntil = Math.floor((q.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntil > 0 && daysUntil <= advanceNoticeDays
  })

  if (!upcomingDeadline) return

  // Get all users who haven't been alerted about this deadline
  const { data: users } = await supabase
    .from('tax_alert_preferences')
    .select('tenant_id, deadline_alerts')
    .eq('alerts_enabled', true)
    .eq('deadline_alerts', true)

  if (!users || users.length === 0) return

  const daysUntil = Math.floor((upcomingDeadline.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  for (const user of users) {
    // Check if alert already exists for this quarter
    const { data: existingAlert } = await supabase
      .from('tax_alerts')
      .select('id')
      .eq('tenant_id', user.tenant_id)
      .eq('alert_type', 'bas_lodgment_due')
      .gte('due_date', upcomingDeadline.dueDate.toISOString())
      .lte('due_date', new Date(upcomingDeadline.dueDate.getTime() + 86400000).toISOString()) // Within 24 hours
      .single()

    if (existingAlert) continue // Already alerted

    // Create alert
    await supabase.from('tax_alerts').insert({
      tenant_id: user.tenant_id,
      alert_definition_id: definition.id,
      alert_type: 'bas_lodgment_due',
      title: `BAS Lodgment Due: ${upcomingDeadline.quarter}`,
      message: `Your Business Activity Statement for ${upcomingDeadline.quarter} is due in ${daysUntil} day${daysUntil === 1 ? '' : 's'} on ${upcomingDeadline.dueDate.toLocaleDateString('en-AU')}.`,
      severity: daysUntil <= 7 ? 'critical' : 'warning',
      category: 'deadline',
      financial_year: getFinancialYear(upcomingDeadline.dueDate),
      due_date: upcomingDeadline.dueDate.toISOString(),
      status: 'unread',
      action_label: definition.action_label || 'Lodge BAS',
      email_sent: false,
      metadata: {
        quarter: upcomingDeadline.quarter,
        days_until_due: daysUntil
      }
    })

    log.info('Created BAS alert', { tenantId: user.tenant_id })
  }
}

/**
 * Check for tax return lodgment deadlines
 */
async function checkTaxReturnDeadlines(): Promise<void> {
  const supabase = await createServiceClient()

  // Get tax return deadline alert definition
  const { data: definition } = await supabase
    .from('tax_alert_definitions')
    .select('*')
    .eq('alert_type', 'tax_return_due')
    .eq('is_active', true)
    .single()

  if (!definition) return

  const advanceNoticeDays = definition.advance_notice_days || 30

  // Tax return deadline for companies: 15th day of 3rd month after FY end
  // For FY ending June 30, that's September 15 (if self-lodging)
  // With tax agent: May 15 of following year
  const today = new Date()
  const currentFY = getFinancialYear()
  const previousFY = (parseInt(currentFY) - 1).toString()

  // Check for previous FY tax return deadline (assuming tax agent extension)
  const fyEndDate = getFYEndDate(previousFY)
  const taxReturnDeadline = new Date(fyEndDate)
  taxReturnDeadline.setFullYear(taxReturnDeadline.getFullYear() + 1) // Next year
  taxReturnDeadline.setMonth(4) // May (0-indexed)
  taxReturnDeadline.setDate(15) // May 15

  const daysUntil = Math.floor((taxReturnDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  // Only alert if within advance notice period
  if (daysUntil <= 0 || daysUntil > advanceNoticeDays) return

  // Get all users who haven't been alerted
  const { data: users } = await supabase
    .from('tax_alert_preferences')
    .select('tenant_id, deadline_alerts')
    .eq('alerts_enabled', true)
    .eq('deadline_alerts', true)

  if (!users || users.length === 0) return

  for (const user of users) {
    // Check if alert already exists
    const { data: existingAlert } = await supabase
      .from('tax_alerts')
      .select('id')
      .eq('tenant_id', user.tenant_id)
      .eq('alert_type', 'tax_return_due')
      .eq('financial_year', previousFY)
      .single()

    if (existingAlert) continue // Already alerted

    // Create alert
    await supabase.from('tax_alerts').insert({
      tenant_id: user.tenant_id,
      alert_definition_id: definition.id,
      alert_type: 'tax_return_due',
      title: `Tax Return Lodgment Due: FY${previousFY}`,
      message: `Your company tax return for FY${previousFY} is due in ${daysUntil} day${daysUntil === 1 ? '' : 's'} on ${taxReturnDeadline.toLocaleDateString('en-AU')}. Lodge by the deadline to avoid late lodgment penalties.`,
      severity: daysUntil <= 14 ? 'critical' : 'warning',
      category: 'deadline',
      financial_year: previousFY,
      due_date: taxReturnDeadline.toISOString(),
      status: 'unread',
      action_label: definition.action_label || 'Lodge Tax Return',
      email_sent: false,
      metadata: {
        days_until_due: daysUntil
      }
    })

    log.info('Created tax return alert', { tenantId: user.tenant_id })
  }
}

/**
 * Check for FBT return lodgment deadlines
 */
async function checkFBTDeadlines(): Promise<void> {
  const supabase = await createServiceClient()

  // Get FBT deadline alert definition
  const { data: definition } = await supabase
    .from('tax_alert_definitions')
    .select('*')
    .eq('alert_type', 'fbt_return_due')
    .eq('is_active', true)
    .single()

  if (!definition) return

  const advanceNoticeDays = definition.advance_notice_days || 30

  // FBT year: April 1 - March 31
  // FBT return due: May 21 (or June 25 with tax agent)
  const today = new Date()
  const currentYear = today.getFullYear()

  // Determine current FBT year
  const month = today.getMonth() + 1
  const fbtYear = month >= 4 ? currentYear : currentYear - 1 // Apr onwards = current year

  // FBT return deadline: May 21
  const fbtDeadline = new Date(fbtYear + 1, 4, 21) // May 21 of following year

  const daysUntil = Math.floor((fbtDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  // Only alert if within advance notice period
  if (daysUntil <= 0 || daysUntil > advanceNoticeDays) return

  // Get all users who haven't been alerted
  const { data: users } = await supabase
    .from('tax_alert_preferences')
    .select('tenant_id, deadline_alerts')
    .eq('alerts_enabled', true)
    .eq('deadline_alerts', true)

  if (!users || users.length === 0) return

  for (const user of users) {
    // Check if alert already exists
    const { data: existingAlert } = await supabase
      .from('tax_alerts')
      .select('id')
      .eq('tenant_id', user.tenant_id)
      .eq('alert_type', 'fbt_return_due')
      .gte('due_date', fbtDeadline.toISOString())
      .lte('due_date', new Date(fbtDeadline.getTime() + 86400000).toISOString())
      .single()

    if (existingAlert) continue // Already alerted

    // Create alert
    await supabase.from('tax_alerts').insert({
      tenant_id: user.tenant_id,
      alert_definition_id: definition.id,
      alert_type: 'fbt_return_due',
      title: `FBT Return Lodgment Due: ${fbtYear}-${fbtYear + 1}`,
      message: `Fringe Benefits Tax (FBT) return is due in ${daysUntil} day${daysUntil === 1 ? '' : 's'} on ${fbtDeadline.toLocaleDateString('en-AU')} if you provided fringe benefits to employees.`,
      severity: daysUntil <= 14 ? 'warning' : 'info',
      category: 'deadline',
      financial_year: (fbtYear + 1).toString(),
      due_date: fbtDeadline.toISOString(),
      status: 'unread',
      action_label: definition.action_label || 'Lodge FBT Return',
      email_sent: false,
      metadata: {
        fbt_year: `${fbtYear}-${fbtYear + 1}`,
        days_until_due: daysUntil
      }
    })

    log.info('Created FBT alert', { tenantId: user.tenant_id })
  }
}

/**
 * Main scheduled checker function
 * Run this daily via cron job
 */
export async function runScheduledAlertChecks(): Promise<void> {
  log.info('Running scheduled alert checks')

  try {
    await checkBASDeadlines()
    await checkTaxReturnDeadlines()
    await checkFBTDeadlines()

    log.info('Scheduled alert checks complete')
  } catch (error) {
    console.error('Error in scheduled alert checks:', error)
    throw error
  }
}

/**
 * Clean up old dismissed/actioned alerts
 * Run this weekly via cron job
 */
export async function cleanupOldAlerts(): Promise<void> {
  log.info('Cleaning up old alerts')

  const supabase = await createServiceClient()

  // Delete dismissed alerts older than 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { error: dismissedError } = await supabase
    .from('tax_alerts')
    .delete()
    .eq('status', 'dismissed')
    .lt('updated_at', thirtyDaysAgo.toISOString())

  if (dismissedError) {
    console.error('Error cleaning up dismissed alerts:', dismissedError)
  }

  // Delete actioned alerts older than 90 days
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { error: actionedError } = await supabase
    .from('tax_alerts')
    .delete()
    .eq('status', 'actioned')
    .lt('updated_at', ninetyDaysAgo.toISOString())

  if (actionedError) {
    console.error('Error cleaning up actioned alerts:', actionedError)
  }

  log.info('Old alerts cleaned up')
}
