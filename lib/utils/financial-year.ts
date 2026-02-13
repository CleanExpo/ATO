/**
 * Financial Year Utilities
 *
 * Shared utilities for Australian Financial Year and FBT year calculations.
 * Used across all tax engines to avoid hardcoded FY strings.
 *
 * Australian Financial Year: 1 July - 30 June
 *   Format: 'FY2024-25' = 1 July 2024 to 30 June 2025
 *
 * FBT Year: 1 April - 31 March
 *   Format: 'FBT2024-25' = 1 April 2024 to 31 March 2025
 *
 * Amendment Periods (Taxation Administration Act 1953, s 170):
 *   - Individuals/small businesses: 2 years from date of assessment
 *   - Companies/trusts/other: 4 years from date of assessment
 */

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
