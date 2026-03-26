/**
 * Compliance Calendar Updater
 *
 * Populates the compliance_calendar table with upcoming tax deadlines
 * for AU, NZ, and UK jurisdictions. Called by the weekly compliance CRON.
 *
 * Each jurisdiction has its own set of recurring deadlines tied to
 * entity types and financial year periods.
 */

import { createClient } from '@/lib/supabase/server'
import type { Jurisdiction, ComplianceDeadline } from '@/lib/types/jurisdiction'
import { getFinancialYearForJurisdiction } from '@/lib/utils/financial-year'
import { createLogger } from '@/lib/logger'

const log = createLogger('compliance:calendar-updater')

/**
 * Update compliance calendar for a jurisdiction's current financial year.
 * Inserts deadlines that don't already exist (idempotent).
 */
export async function updateComplianceCalendar(
  jurisdiction: Jurisdiction,
  referenceDate: Date = new Date()
): Promise<ComplianceDeadline[]> {
  const fy = getFinancialYearForJurisdiction(referenceDate, jurisdiction)
  const year = referenceDate.getFullYear()

  let deadlines: ComplianceDeadline[] = []

  switch (jurisdiction) {
    case 'AU':
      deadlines = generateAUDeadlines(fy, year)
      break
    case 'NZ':
      deadlines = generateNZDeadlines(fy, year)
      break
    case 'UK':
      deadlines = generateUKDeadlines(fy, year)
      break
  }

  // Insert only new deadlines (upsert on jurisdiction + deadline_name + due_date)
  try {
    const supabase = await createClient()

    for (const deadline of deadlines) {
      const { error } = await supabase
        .from('compliance_calendar')
        .upsert(
          {
            jurisdiction: deadline.jurisdiction,
            deadline_type: deadline.deadlineType,
            deadline_name: deadline.deadlineName,
            description: deadline.description,
            entity_types: deadline.entityTypes,
            due_date: deadline.dueDate,
            financial_year: deadline.financialYear,
            legislative_ref: deadline.legislativeRef,
            notification_sent: false,
          },
          { onConflict: 'jurisdiction,deadline_name,due_date', ignoreDuplicates: true }
        )

      if (error) {
        log.warn(`Calendar upsert failed for ${deadline.deadlineName}: ${error.message}`)
      }
    }

    log.info(`Updated ${jurisdiction} compliance calendar: ${deadlines.length} deadlines for ${fy}`)
  } catch (err) {
    log.error(`Calendar update error for ${jurisdiction}: ${String(err)}`)
  }

  return deadlines
}

// ─── AU Deadlines ────────────────────────────────────────────────────

function generateAUDeadlines(fy: string, year: number): ComplianceDeadline[] {
  // AU FY2025-26 = 1 July 2025 to 30 June 2026
  const fyStartYear = year
  const fyEndYear = year + 1

  return [
    {
      jurisdiction: 'AU', deadlineType: 'BAS', deadlineName: `BAS Q1 ${fy}`,
      description: 'Business Activity Statement — Quarter 1 (Jul-Sep)',
      entityTypes: ['company', 'trust', 'partnership'], dueDate: `${fyStartYear}-10-28`,
      financialYear: fy, legislativeRef: 'Taxation Administration Act 1953, Div 45', notificationSent: false,
    },
    {
      jurisdiction: 'AU', deadlineType: 'BAS', deadlineName: `BAS Q2 ${fy}`,
      description: 'Business Activity Statement — Quarter 2 (Oct-Dec)',
      entityTypes: ['company', 'trust', 'partnership'], dueDate: `${fyEndYear}-02-28`,
      financialYear: fy, legislativeRef: 'Taxation Administration Act 1953, Div 45', notificationSent: false,
    },
    {
      jurisdiction: 'AU', deadlineType: 'BAS', deadlineName: `BAS Q3 ${fy}`,
      description: 'Business Activity Statement — Quarter 3 (Jan-Mar)',
      entityTypes: ['company', 'trust', 'partnership'], dueDate: `${fyEndYear}-04-28`,
      financialYear: fy, legislativeRef: 'Taxation Administration Act 1953, Div 45', notificationSent: false,
    },
    {
      jurisdiction: 'AU', deadlineType: 'BAS', deadlineName: `BAS Q4 ${fy}`,
      description: 'Business Activity Statement — Quarter 4 (Apr-Jun)',
      entityTypes: ['company', 'trust', 'partnership'], dueDate: `${fyEndYear}-08-28`,
      financialYear: fy, legislativeRef: 'Taxation Administration Act 1953, Div 45', notificationSent: false,
    },
    {
      jurisdiction: 'AU', deadlineType: 'super', deadlineName: `SG Q1 ${fy}`,
      description: 'Superannuation Guarantee — Quarter 1',
      entityTypes: ['company', 'trust', 'partnership'], dueDate: `${fyStartYear}-10-28`,
      financialYear: fy, legislativeRef: 'Superannuation Guarantee (Administration) Act 1992, s 23', notificationSent: false,
    },
    {
      jurisdiction: 'AU', deadlineType: 'FBT', deadlineName: `FBT Return ${fy}`,
      description: 'Fringe Benefits Tax Return',
      entityTypes: ['company', 'trust', 'partnership'], dueDate: `${fyEndYear}-05-21`,
      financialYear: fy, legislativeRef: 'FBTAA 1986', notificationSent: false,
    },
    {
      jurisdiction: 'AU', deadlineType: 'income_tax', deadlineName: `Company Tax Return ${fy}`,
      description: 'Company income tax return — due date (if lodged by tax agent)',
      entityTypes: ['company'], dueDate: `${fyEndYear}-05-15`,
      financialYear: fy, legislativeRef: 'ITAA 1997', notificationSent: false,
    },
  ]
}

// ─── NZ Deadlines ────────────────────────────────────────────────────

function generateNZDeadlines(fy: string, year: number): ComplianceDeadline[] {
  // NZ FY2025-26 = 1 April 2025 to 31 March 2026
  const fyStartYear = year
  const fyEndYear = year + 1

  return [
    {
      jurisdiction: 'NZ', deadlineType: 'GST', deadlineName: `GST Period 1 ${fy}`,
      description: 'GST return — two-monthly period (Apr-May)',
      entityTypes: ['company', 'partnership', 'sole_trader'], dueDate: `${fyStartYear}-06-28`,
      financialYear: fy, legislativeRef: 'Goods and Services Tax Act 1985 (NZ)', notificationSent: false,
    },
    {
      jurisdiction: 'NZ', deadlineType: 'GST', deadlineName: `GST Period 2 ${fy}`,
      description: 'GST return — two-monthly period (Jun-Jul)',
      entityTypes: ['company', 'partnership', 'sole_trader'], dueDate: `${fyStartYear}-08-28`,
      financialYear: fy, legislativeRef: 'Goods and Services Tax Act 1985 (NZ)', notificationSent: false,
    },
    {
      jurisdiction: 'NZ', deadlineType: 'provisional_tax', deadlineName: `Provisional Tax P1 ${fy}`,
      description: 'Provisional tax — first instalment (standard balance date)',
      entityTypes: ['company', 'partnership', 'sole_trader', 'trust'], dueDate: `${fyStartYear}-08-28`,
      financialYear: fy, legislativeRef: 'Tax Administration Act 1994 (NZ), Part 7', notificationSent: false,
    },
    {
      jurisdiction: 'NZ', deadlineType: 'provisional_tax', deadlineName: `Provisional Tax P2 ${fy}`,
      description: 'Provisional tax — second instalment',
      entityTypes: ['company', 'partnership', 'sole_trader', 'trust'], dueDate: `${fyEndYear}-01-15`,
      financialYear: fy, legislativeRef: 'Tax Administration Act 1994 (NZ), Part 7', notificationSent: false,
    },
    {
      jurisdiction: 'NZ', deadlineType: 'provisional_tax', deadlineName: `Provisional Tax P3 ${fy}`,
      description: 'Provisional tax — third instalment',
      entityTypes: ['company', 'partnership', 'sole_trader', 'trust'], dueDate: `${fyEndYear}-05-07`,
      financialYear: fy, legislativeRef: 'Tax Administration Act 1994 (NZ), Part 7', notificationSent: false,
    },
    {
      jurisdiction: 'NZ', deadlineType: 'income_tax', deadlineName: `Annual Return ${fy}`,
      description: 'Individual/company income tax return — agent extension',
      entityTypes: ['company', 'partnership', 'sole_trader', 'trust'], dueDate: `${fyEndYear}-03-31`,
      financialYear: fy, legislativeRef: 'Income Tax Act 2007 (NZ)', notificationSent: false,
    },
  ]
}

// ─── UK Deadlines ────────────────────────────────────────────────────

function generateUKDeadlines(fy: string, year: number): ComplianceDeadline[] {
  // UK Tax Year 2025-26 = 6 April 2025 to 5 April 2026
  const fyStartYear = year
  const fyEndYear = year + 1

  return [
    {
      jurisdiction: 'UK', deadlineType: 'VAT', deadlineName: `VAT Q1 ${fy}`,
      description: 'VAT return — Quarter 1 (Apr-Jun)',
      entityTypes: ['limited_company', 'llp', 'sole_trader', 'partnership'], dueDate: `${fyStartYear}-08-07`,
      financialYear: fy, legislativeRef: 'Value Added Tax Act 1994', notificationSent: false,
    },
    {
      jurisdiction: 'UK', deadlineType: 'VAT', deadlineName: `VAT Q2 ${fy}`,
      description: 'VAT return — Quarter 2 (Jul-Sep)',
      entityTypes: ['limited_company', 'llp', 'sole_trader', 'partnership'], dueDate: `${fyStartYear}-11-07`,
      financialYear: fy, legislativeRef: 'Value Added Tax Act 1994', notificationSent: false,
    },
    {
      jurisdiction: 'UK', deadlineType: 'VAT', deadlineName: `VAT Q3 ${fy}`,
      description: 'VAT return — Quarter 3 (Oct-Dec)',
      entityTypes: ['limited_company', 'llp', 'sole_trader', 'partnership'], dueDate: `${fyEndYear}-02-07`,
      financialYear: fy, legislativeRef: 'Value Added Tax Act 1994', notificationSent: false,
    },
    {
      jurisdiction: 'UK', deadlineType: 'VAT', deadlineName: `VAT Q4 ${fy}`,
      description: 'VAT return — Quarter 4 (Jan-Mar)',
      entityTypes: ['limited_company', 'llp', 'sole_trader', 'partnership'], dueDate: `${fyEndYear}-05-07`,
      financialYear: fy, legislativeRef: 'Value Added Tax Act 1994', notificationSent: false,
    },
    {
      jurisdiction: 'UK', deadlineType: 'corporation_tax', deadlineName: `Corporation Tax ${fy}`,
      description: 'Corporation tax payment — 9 months + 1 day after year-end',
      entityTypes: ['limited_company', 'llp', 'cic', 'plc'], dueDate: `${fyEndYear}-01-01`,
      financialYear: fy, legislativeRef: 'Corporation Tax Act 2010', notificationSent: false,
    },
    {
      jurisdiction: 'UK', deadlineType: 'self_assessment', deadlineName: `Self-Assessment Online ${fy}`,
      description: 'Self-assessment tax return — online filing deadline',
      entityTypes: ['sole_trader', 'partnership'], dueDate: `${fyEndYear}-01-31`,
      financialYear: fy, legislativeRef: 'Taxes Management Act 1970', notificationSent: false,
    },
    {
      jurisdiction: 'UK', deadlineType: 'PAYE', deadlineName: `PAYE P60 ${fy}`,
      description: 'P60 certificates issued to employees',
      entityTypes: ['limited_company', 'llp'], dueDate: `${fyEndYear}-05-31`,
      financialYear: fy, legislativeRef: 'Income Tax (PAYE) Regulations 2003', notificationSent: false,
    },
  ]
}

/**
 * Get upcoming deadlines within a specified number of days.
 */
export async function getUpcomingDeadlines(
  jurisdiction: Jurisdiction | null,
  withinDays: number = 30
): Promise<ComplianceDeadline[]> {
  try {
    const supabase = await createClient()
    const now = new Date()
    const futureDate = new Date(now)
    futureDate.setDate(futureDate.getDate() + withinDays)

    let query = supabase
      .from('compliance_calendar')
      .select('*')
      .gte('due_date', now.toISOString().split('T')[0])
      .lte('due_date', futureDate.toISOString().split('T')[0])
      .order('due_date', { ascending: true })

    if (jurisdiction) {
      query = query.eq('jurisdiction', jurisdiction)
    }

    const { data, error } = await query

    if (error || !data) return []

    return data.map((row) => ({
      jurisdiction: row.jurisdiction as Jurisdiction,
      deadlineType: row.deadline_type,
      deadlineName: row.deadline_name,
      description: row.description,
      entityTypes: row.entity_types || [],
      dueDate: row.due_date,
      financialYear: row.financial_year,
      legislativeRef: row.legislative_ref,
      notificationSent: row.notification_sent,
    }))
  } catch {
    return []
  }
}
