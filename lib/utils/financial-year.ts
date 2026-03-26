/**
 * Financial Year Utilities
 *
 * Multi-jurisdiction financial year calculations for AU, NZ, and UK.
 * Used across all tax engines to avoid hardcoded FY strings.
 *
 * Australian Financial Year: 1 July - 30 June
 *   Format: 'FY2024-25' = 1 July 2024 to 30 June 2025
 *
 * New Zealand Financial Year (Standard Balance Date): 1 April - 31 March
 *   Format: 'NZ2024-25' = 1 April 2024 to 31 March 2025
 *
 * UK Tax Year: 6 April - 5 April
 *   Format: 'UK2025-26' = 6 April 2025 to 5 April 2026
 *
 * FBT Year (AU): 1 April - 31 March
 *   Format: 'FBT2024-25' = 1 April 2024 to 31 March 2025
 *
 * Amendment Periods (Taxation Administration Act 1953, s 170):
 *   - Individuals/small businesses: 2 years from date of assessment
 *   - Companies/trusts/other: 4 years from date of assessment
 */

import type { Jurisdiction } from '@/lib/types/jurisdiction'

export type EntityTypeForAmendment =
  | 'company'
  | 'trust'
  | 'partnership'
  | 'individual'
  | 'smsf'
  | 'non_profit'
  | 'foreign_company'
  | 'unknown'

/**
 * Determine the current Australian Financial Year from the system date.
 *
 * AU FY runs 1 July - 30 June.
 * - On 15 March 2026 -> 'FY2025-26' (started 1 July 2025)
 * - On 1 July 2025 -> 'FY2025-26' (first day of new FY)
 * - On 30 June 2025 -> 'FY2024-25' (last day of old FY)
 *
 * @param referenceDate - Date to calculate FY for (defaults to now)
 * @returns Financial year string in 'FY2024-25' format
 */
export function getCurrentFinancialYear(referenceDate: Date = new Date()): string {
  const month = referenceDate.getMonth() // 0-indexed (0=Jan, 6=Jul)
  const year = referenceDate.getFullYear()

  // If July onwards (month >= 6), FY starts this calendar year
  // If Jan-June (month < 6), FY started previous calendar year
  const fyStartYear = month >= 6 ? year : year - 1
  const fyEndYear = fyStartYear + 1
  const fyEndShort = String(fyEndYear).slice(-2)

  return `FY${fyStartYear}-${fyEndShort}`
}

/**
 * Determine the FBT year (1 April - 31 March) from a date.
 *
 * - On 15 March 2026 -> 'FBT2025-26' (started 1 April 2025)
 * - On 1 April 2026 -> 'FBT2026-27' (first day of new FBT year)
 * - On 31 March 2026 -> 'FBT2025-26' (last day of old FBT year)
 *
 * @param referenceDate - Date to calculate FBT year for (defaults to now)
 * @returns FBT year string in 'FBT2024-25' format
 */
export function getCurrentFBTYear(referenceDate: Date = new Date()): string {
  const month = referenceDate.getMonth() // 0-indexed (0=Jan, 3=Apr)
  const year = referenceDate.getFullYear()

  // If April onwards (month >= 3), FBT year starts this calendar year
  // If Jan-March (month < 3), FBT year started previous calendar year
  const fbtStartYear = month >= 3 ? year : year - 1
  const fbtEndYear = fbtStartYear + 1
  const fbtEndShort = String(fbtEndYear).slice(-2)

  return `FBT${fbtStartYear}-${fbtEndShort}`
}

/**
 * Get the financial year for a specific transaction date.
 *
 * @param transactionDate - The date of the transaction
 * @returns Financial year string in 'FY2024-25' format
 */
export function getFinancialYearForDate(transactionDate: Date): string {
  return getCurrentFinancialYear(transactionDate)
}

/**
 * Get the FBT year for a specific transaction date.
 *
 * @param transactionDate - The date of the transaction
 * @returns FBT year string in 'FBT2024-25' format
 */
export function getFBTYearForDate(transactionDate: Date): string {
  return getCurrentFBTYear(transactionDate)
}

/**
 * Get the prior financial year.
 * e.g., 'FY2023-24' -> 'FY2022-23'
 *
 * @param financialYear - FY string in 'FY2024-25' format
 * @returns Prior FY string, or null if format invalid
 */
export function getPriorFinancialYear(financialYear: string): string | null {
  const match = financialYear.match(/^FY(\d{4})-(\d{2})$/)
  if (!match) return null

  const startYearNum = parseInt(match[1], 10)
  const endYearNum = parseInt(match[2], 10)

  const priorStart = startYearNum - 1
  const priorEnd = endYearNum - 1

  const priorEndStr = priorEnd.toString().padStart(2, '0')

  return `FY${priorStart}-${priorEndStr}`
}

/**
 * Calculate the end date of a financial year from its FY string.
 * e.g., 'FY2020-21' -> 30 June 2021
 *
 * @param financialYear - FY string in 'FY2024-25' or '2024-25' format
 * @returns End date (30 June) or null if format invalid
 */
export function getFYEndDate(financialYear: string): Date | null {
  const match = financialYear.match(/(\d{4})-(\d{2,4})/)
  if (!match) return null

  const startYearStr = match[1]
  const endYearStr = match[2]

  let endYear: number
  if (endYearStr.length === 2) {
    const century = startYearStr.substring(0, 2)
    endYear = parseInt(`${century}${endYearStr}`, 10)
  } else {
    endYear = parseInt(endYearStr, 10)
  }

  // Australian FY ends 30 June
  return new Date(endYear, 5, 30) // Month is 0-indexed (5 = June)
}

/**
 * Calculate the start date of a financial year from its FY string.
 * e.g., 'FY2024-25' -> 1 July 2024
 *
 * @param financialYear - FY string in 'FY2024-25' format
 * @returns Start date (1 July) or null if format invalid
 */
export function getFYStartDate(financialYear: string): Date | null {
  const match = financialYear.match(/^FY(\d{4})-\d{2}$/)
  if (!match) return null

  const startYear = parseInt(match[1], 10)
  return new Date(startYear, 6, 1) // Month is 0-indexed (6 = July)
}

/**
 * Get the FBT year start date (1 April).
 * e.g., 'FBT2024-25' -> 1 April 2024
 */
export function getFBTYearStartDate(fbtYear: string): Date | null {
  const match = fbtYear.match(/^FBT(\d{4})-\d{2}$/)
  if (!match) return null

  const startYear = parseInt(match[1], 10)
  return new Date(startYear, 3, 1) // 0-indexed (3 = April)
}

/**
 * Get the FBT year end date (31 March).
 * e.g., 'FBT2024-25' -> 31 March 2025
 */
export function getFBTYearEndDate(fbtYear: string): Date | null {
  const match = fbtYear.match(/^FBT(\d{4})-(\d{2})$/)
  if (!match) return null

  const startYearStr = match[1]
  const endYearStr = match[2]

  const century = startYearStr.substring(0, 2)
  const endYear = parseInt(`${century}${endYearStr}`, 10)

  return new Date(endYear, 2, 31) // 0-indexed (2 = March)
}

/**
 * Check if a financial year is outside the amendment period.
 *
 * Taxation Administration Act 1953, s 170:
 * - Individuals/small businesses: 2 years from date of assessment
 * - Companies/trusts/other: 4 years from date of assessment
 *
 * Assessment is typically issued shortly after the return due date.
 * We use FY end date as a conservative approximation.
 *
 * @param financialYear - FY string in 'FY2024-25' format
 * @param entityType - Entity type for amendment period determination
 * @param referenceDate - Date to check against (defaults to now)
 * @returns Warning string if outside amendment period, undefined otherwise
 */
export function checkAmendmentPeriod(
  financialYear: string,
  entityType: EntityTypeForAmendment = 'unknown',
  referenceDate: Date = new Date()
): string | undefined {
  const fyEndDate = getFYEndDate(financialYear)
  if (!fyEndDate) return undefined

  // Determine amendment period length based on entity type
  // Individuals/small business: 2 years (s 170(2) TAA 1953)
  // Companies/trusts/partnerships/SMSF/foreign: 4 years (s 170(1) TAA 1953)
  // Non-profits: 4 years (same as companies)
  let amendmentYears: number
  switch (entityType) {
    case 'individual':
      amendmentYears = 2
      break
    case 'company':
    case 'trust':
    case 'partnership':
    case 'smsf':
    case 'non_profit':
    case 'foreign_company':
      amendmentYears = 4
      break
    case 'unknown':
    default:
      amendmentYears = 4 // Conservative: use longer period when unknown
      break
  }

  const amendmentExpiryDate = new Date(fyEndDate)
  amendmentExpiryDate.setFullYear(amendmentExpiryDate.getFullYear() + amendmentYears)

  if (referenceDate > amendmentExpiryDate) {
    const expiryStr = amendmentExpiryDate.toISOString().split('T')[0]
    return (
      `Loss from ${financialYear} may be outside the ${amendmentYears}-year amendment period ` +
      `(expired approx. ${expiryStr}). Verify ability to amend with tax agent. ` +
      `Taxation Administration Act 1953, s 170.`
    )
  }

  return undefined
}

/**
 * Determine the BAS quarter for a given date.
 *
 * BAS Quarters (aligned to income tax FY):
 * Q1: 1 July - 30 September
 * Q2: 1 October - 31 December
 * Q3: 1 January - 31 March
 * Q4: 1 April - 30 June
 *
 * @param date - The date to determine the quarter for
 * @returns Object with quarter label, period dates, and financial year
 */
export function getBASQuarter(date: Date): {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  periodStart: Date
  periodEnd: Date
  financialYear: string
  dueDate: Date
} {
  const month = date.getMonth() // 0-indexed
  const year = date.getFullYear()

  let quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  let periodStart: Date
  let periodEnd: Date
  let dueDate: Date

  if (month >= 6 && month <= 8) {
    // July - September = Q1
    quarter = 'Q1'
    periodStart = new Date(year, 6, 1)
    periodEnd = new Date(year, 8, 30)
    dueDate = new Date(year, 9, 28) // 28 October
  } else if (month >= 9 && month <= 11) {
    // October - December = Q2
    quarter = 'Q2'
    periodStart = new Date(year, 9, 1)
    periodEnd = new Date(year, 11, 31)
    dueDate = new Date(year + 1, 1, 28) // 28 February
  } else if (month >= 0 && month <= 2) {
    // January - March = Q3
    quarter = 'Q3'
    periodStart = new Date(year, 0, 1)
    periodEnd = new Date(year, 2, 31)
    dueDate = new Date(year, 3, 28) // 28 April
  } else {
    // April - June = Q4
    quarter = 'Q4'
    periodStart = new Date(year, 3, 1)
    periodEnd = new Date(year, 5, 30)
    dueDate = new Date(year, 7, 28) // 28 August
  }

  const financialYear = getCurrentFinancialYear(date)

  return { quarter, periodStart, periodEnd, financialYear, dueDate }
}

// ─── Multi-Jurisdiction Financial Year Support ──────────────────────

/**
 * Get the current financial year for any supported jurisdiction.
 *
 * AU: 1 July - 30 June → 'FY2025-26' (1 July 2025 to 30 June 2026)
 * NZ: 1 April - 31 March → 'NZ2025-26' (1 April 2025 to 31 March 2026)
 * UK: 6 April - 5 April → 'UK2025-26' (6 April 2025 to 5 April 2026)
 *
 * @param referenceDate - Date to calculate FY for (defaults to now)
 * @param jurisdiction - 'AU' | 'NZ' | 'UK' (defaults to 'AU')
 * @returns Financial year string with jurisdiction prefix
 */
export function getFinancialYearForJurisdiction(
  referenceDate: Date = new Date(),
  jurisdiction: Jurisdiction = 'AU'
): string {
  const month = referenceDate.getMonth() // 0-indexed
  const day = referenceDate.getDate()
  const year = referenceDate.getFullYear()

  let fyStartYear: number
  let prefix: string

  switch (jurisdiction) {
    case 'AU':
      // AU: FY starts 1 July (month 6)
      fyStartYear = month >= 6 ? year : year - 1
      prefix = 'FY'
      break

    case 'NZ':
      // NZ: Standard balance date starts 1 April (month 3)
      fyStartYear = month >= 3 ? year : year - 1
      prefix = 'NZ'
      break

    case 'UK':
      // UK: Tax year starts 6 April (month 3, day 6)
      if (month > 3 || (month === 3 && day >= 6)) {
        fyStartYear = year
      } else {
        fyStartYear = year - 1
      }
      prefix = 'UK'
      break

    default:
      fyStartYear = month >= 6 ? year : year - 1
      prefix = 'FY'
  }

  const fyEndYear = fyStartYear + 1
  const fyEndShort = String(fyEndYear).slice(-2)
  return `${prefix}${fyStartYear}-${fyEndShort}`
}

/**
 * Get the financial year start date for any jurisdiction.
 *
 * @param fyString - Financial year string (e.g. 'FY2025-26', 'NZ2025-26', 'UK2025-26')
 * @param jurisdiction - Jurisdiction to determine start date rules
 * @returns Start date or null if format invalid
 */
export function getJurisdictionFYStartDate(
  fyString: string,
  jurisdiction: Jurisdiction = 'AU'
): Date | null {
  const match = fyString.match(/^[A-Z]{2}(\d{4})-\d{2}$/)
  if (!match) return null

  const startYear = parseInt(match[1], 10)

  switch (jurisdiction) {
    case 'AU':
      return new Date(startYear, 6, 1) // 1 July
    case 'NZ':
      return new Date(startYear, 3, 1) // 1 April
    case 'UK':
      return new Date(startYear, 3, 6) // 6 April
    default:
      return new Date(startYear, 6, 1) // Default to AU
  }
}

/**
 * Get the financial year end date for any jurisdiction.
 *
 * @param fyString - Financial year string
 * @param jurisdiction - Jurisdiction to determine end date rules
 * @returns End date or null if format invalid
 */
export function getJurisdictionFYEndDate(
  fyString: string,
  jurisdiction: Jurisdiction = 'AU'
): Date | null {
  const match = fyString.match(/^[A-Z]{2}(\d{4})-(\d{2})$/)
  if (!match) return null

  const century = match[1].substring(0, 2)
  const endYear = parseInt(`${century}${match[2]}`, 10)

  switch (jurisdiction) {
    case 'AU':
      return new Date(endYear, 5, 30) // 30 June
    case 'NZ':
      return new Date(endYear, 2, 31) // 31 March
    case 'UK':
      return new Date(endYear, 3, 5) // 5 April
    default:
      return new Date(endYear, 5, 30) // Default to AU
  }
}

/**
 * Get the NZ GST return period dates.
 *
 * NZ GST returns can be: monthly, two-monthly, or six-monthly.
 * Two-monthly is the default for most businesses.
 *
 * Two-monthly periods:
 *   Jan-Feb, Mar-Apr, May-Jun, Jul-Aug, Sep-Oct, Nov-Dec
 *   Due: 28th of the month following the period end
 *
 * @param date - Date to determine the period for
 * @param frequency - 'monthly' | 'two-monthly' | 'six-monthly'
 */
export function getNZGSTPeriod(
  date: Date,
  frequency: 'monthly' | 'two-monthly' | 'six-monthly' = 'two-monthly'
): { periodStart: Date; periodEnd: Date; dueDate: Date; label: string } {
  const month = date.getMonth()
  const year = date.getFullYear()

  if (frequency === 'monthly') {
    const periodStart = new Date(year, month, 1)
    const periodEnd = new Date(year, month + 1, 0) // Last day of month
    const dueDate = new Date(year, month + 1, 28) // 28th of next month
    return {
      periodStart,
      periodEnd,
      dueDate,
      label: `${periodStart.toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' })}`,
    }
  }

  if (frequency === 'six-monthly') {
    const halfStart = month < 6 ? 0 : 6
    const periodStart = new Date(year, halfStart, 1)
    const periodEnd = new Date(year, halfStart + 6, 0)
    const dueDate = new Date(year, halfStart + 6, 28)
    return {
      periodStart,
      periodEnd,
      dueDate,
      label: halfStart === 0 ? `Jan-Jun ${year}` : `Jul-Dec ${year}`,
    }
  }

  // Two-monthly (default)
  const biMonthStart = Math.floor(month / 2) * 2
  const periodStart = new Date(year, biMonthStart, 1)
  const periodEnd = new Date(year, biMonthStart + 2, 0)
  const dueDate = new Date(year, biMonthStart + 2, 28)
  const startLabel = periodStart.toLocaleDateString('en-NZ', { month: 'short' })
  const endLabel = periodEnd.toLocaleDateString('en-NZ', { month: 'short' })
  return {
    periodStart,
    periodEnd,
    dueDate,
    label: `${startLabel}-${endLabel} ${year}`,
  }
}

/**
 * Get UK VAT quarter dates.
 *
 * Standard VAT quarters:
 *   Q1: Jan-Mar, due 7 May
 *   Q2: Apr-Jun, due 7 Aug
 *   Q3: Jul-Sep, due 7 Nov
 *   Q4: Oct-Dec, due 7 Feb
 *
 * Making Tax Digital: returns due 1 month + 7 days after period end
 */
export function getUKVATQuarter(date: Date): {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  periodStart: Date
  periodEnd: Date
  dueDate: Date
  label: string
} {
  const month = date.getMonth()
  const year = date.getFullYear()

  let quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  let periodStart: Date
  let periodEnd: Date
  let dueDate: Date

  if (month >= 0 && month <= 2) {
    quarter = 'Q1'
    periodStart = new Date(year, 0, 1)
    periodEnd = new Date(year, 2, 31)
    dueDate = new Date(year, 4, 7)
  } else if (month >= 3 && month <= 5) {
    quarter = 'Q2'
    periodStart = new Date(year, 3, 1)
    periodEnd = new Date(year, 5, 30)
    dueDate = new Date(year, 7, 7)
  } else if (month >= 6 && month <= 8) {
    quarter = 'Q3'
    periodStart = new Date(year, 6, 1)
    periodEnd = new Date(year, 8, 30)
    dueDate = new Date(year, 10, 7)
  } else {
    quarter = 'Q4'
    periodStart = new Date(year, 9, 1)
    periodEnd = new Date(year, 11, 31)
    dueDate = new Date(year + 1, 1, 7)
  }

  return {
    quarter,
    periodStart,
    periodEnd,
    dueDate,
    label: `VAT ${quarter} ${year}`,
  }
}
