/**
 * Tests for Financial Year Utilities
 *
 * Covers: getCurrentFinancialYear, getCurrentFBTYear, getPriorFinancialYear,
 * getFYEndDate, getFYStartDate, getFBTYearStartDate, getFBTYearEndDate,
 * checkAmendmentPeriod, getBASQuarter
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import {
  getCurrentFinancialYear,
  getCurrentFBTYear,
  getFinancialYearForDate,
  getFBTYearForDate,
  getPriorFinancialYear,
  getFYEndDate,
  getFYStartDate,
  getFBTYearStartDate,
  getFBTYearEndDate,
  checkAmendmentPeriod,
  getBASQuarter,
} from '@/lib/utils/financial-year'

// ---- getCurrentFinancialYear ----

describe('getCurrentFinancialYear', () => {
  it('returns correct FY for date in July (start of new FY)', () => {
    expect(getCurrentFinancialYear(new Date(2025, 6, 1))).toBe('FY2025-26')
  })

  it('returns correct FY for date in June (end of FY)', () => {
    expect(getCurrentFinancialYear(new Date(2025, 5, 30))).toBe('FY2024-25')
  })

  it('returns correct FY for date in January', () => {
    expect(getCurrentFinancialYear(new Date(2026, 0, 15))).toBe('FY2025-26')
  })

  it('returns correct FY for date in December', () => {
    expect(getCurrentFinancialYear(new Date(2025, 11, 31))).toBe('FY2025-26')
  })

  it('handles boundary: 1 July exactly', () => {
    expect(getCurrentFinancialYear(new Date(2024, 6, 1))).toBe('FY2024-25')
  })

  it('handles boundary: 30 June exactly', () => {
    expect(getCurrentFinancialYear(new Date(2025, 5, 30))).toBe('FY2024-25')
  })

  it('defaults to current date when no argument', () => {
    const result = getCurrentFinancialYear()
    expect(result).toMatch(/^FY\d{4}-\d{2}$/)
  })
})

// ---- getCurrentFBTYear ----

describe('getCurrentFBTYear', () => {
  it('returns correct FBT year for date in April (start of new FBT year)', () => {
    expect(getCurrentFBTYear(new Date(2025, 3, 1))).toBe('FBT2025-26')
  })

  it('returns correct FBT year for date in March (end of FBT year)', () => {
    expect(getCurrentFBTYear(new Date(2026, 2, 31))).toBe('FBT2025-26')
  })

  it('returns correct FBT year for January', () => {
    expect(getCurrentFBTYear(new Date(2026, 0, 15))).toBe('FBT2025-26')
  })

  it('returns correct FBT year for December', () => {
    expect(getCurrentFBTYear(new Date(2025, 11, 25))).toBe('FBT2025-26')
  })

  it('handles boundary: 1 April exactly', () => {
    expect(getCurrentFBTYear(new Date(2026, 3, 1))).toBe('FBT2026-27')
  })

  it('handles boundary: 31 March exactly', () => {
    expect(getCurrentFBTYear(new Date(2026, 2, 31))).toBe('FBT2025-26')
  })
})

// ---- getFinancialYearForDate / getFBTYearForDate ----

describe('getFinancialYearForDate', () => {
  it('delegates to getCurrentFinancialYear', () => {
    expect(getFinancialYearForDate(new Date(2025, 6, 1))).toBe('FY2025-26')
  })
})

describe('getFBTYearForDate', () => {
  it('delegates to getCurrentFBTYear', () => {
    expect(getFBTYearForDate(new Date(2025, 3, 1))).toBe('FBT2025-26')
  })
})

// ---- getPriorFinancialYear ----

describe('getPriorFinancialYear', () => {
  it('returns previous FY', () => {
    expect(getPriorFinancialYear('FY2024-25')).toBe('FY2023-24')
  })

  it('returns previous FY across decade boundary', () => {
    expect(getPriorFinancialYear('FY2020-21')).toBe('FY2019-20')
  })

  it('returns previous FY across century boundary', () => {
    expect(getPriorFinancialYear('FY2000-01')).toBe('FY1999-00')
  })

  it('returns null for invalid format', () => {
    expect(getPriorFinancialYear('invalid')).toBeNull()
    expect(getPriorFinancialYear('2024-25')).toBeNull()
    expect(getPriorFinancialYear('')).toBeNull()
  })
})

// ---- getFYEndDate ----

describe('getFYEndDate', () => {
  it('returns 30 June for FY2024-25', () => {
    const date = getFYEndDate('FY2024-25')
    expect(date).not.toBeNull()
    expect(date!.getFullYear()).toBe(2025)
    expect(date!.getMonth()).toBe(5) // June
    expect(date!.getDate()).toBe(30)
  })

  it('returns 30 June for FY2020-21', () => {
    const date = getFYEndDate('FY2020-21')
    expect(date).not.toBeNull()
    expect(date!.getFullYear()).toBe(2021)
    expect(date!.getMonth()).toBe(5)
    expect(date!.getDate()).toBe(30)
  })

  it('parses format without FY prefix', () => {
    const date = getFYEndDate('2024-25')
    expect(date).not.toBeNull()
    expect(date!.getFullYear()).toBe(2025)
  })

  it('returns null for invalid format', () => {
    expect(getFYEndDate('invalid')).toBeNull()
    expect(getFYEndDate('')).toBeNull()
  })
})

// ---- getFYStartDate ----

describe('getFYStartDate', () => {
  it('returns 1 July for FY2024-25', () => {
    const date = getFYStartDate('FY2024-25')
    expect(date).not.toBeNull()
    expect(date!.getFullYear()).toBe(2024)
    expect(date!.getMonth()).toBe(6) // July
    expect(date!.getDate()).toBe(1)
  })

  it('returns null for invalid format', () => {
    expect(getFYStartDate('invalid')).toBeNull()
    expect(getFYStartDate('2024-25')).toBeNull()
  })
})

// ---- getFBTYearStartDate / getFBTYearEndDate ----

describe('getFBTYearStartDate', () => {
  it('returns 1 April for FBT2024-25', () => {
    const date = getFBTYearStartDate('FBT2024-25')
    expect(date).not.toBeNull()
    expect(date!.getFullYear()).toBe(2024)
    expect(date!.getMonth()).toBe(3) // April
    expect(date!.getDate()).toBe(1)
  })

  it('returns null for invalid format', () => {
    expect(getFBTYearStartDate('invalid')).toBeNull()
    expect(getFBTYearStartDate('FY2024-25')).toBeNull()
  })
})

describe('getFBTYearEndDate', () => {
  it('returns 31 March for FBT2024-25', () => {
    const date = getFBTYearEndDate('FBT2024-25')
    expect(date).not.toBeNull()
    expect(date!.getFullYear()).toBe(2025)
    expect(date!.getMonth()).toBe(2) // March
    expect(date!.getDate()).toBe(31)
  })

  it('returns null for invalid format', () => {
    expect(getFBTYearEndDate('invalid')).toBeNull()
  })
})

// ---- checkAmendmentPeriod ----

describe('checkAmendmentPeriod', () => {
  it('returns undefined when within amendment period (company, 4 years)', () => {
    // FY2023-24 ends 30 June 2024. Company = 4 years. Ref date = Jan 2026.
    const result = checkAmendmentPeriod('FY2023-24', 'company', new Date(2026, 0, 1))
    expect(result).toBeUndefined()
  })

  it('returns warning when outside amendment period (individual, 2 years)', () => {
    // FY2022-23 ends 30 June 2023. Individual = 2 years. Expiry = 30 June 2025.
    const result = checkAmendmentPeriod('FY2022-23', 'individual', new Date(2026, 0, 1))
    expect(result).toBeDefined()
    expect(result).toContain('amendment period')
    expect(result).toContain('s 170')
  })

  it('returns warning when outside amendment period (company, 4 years)', () => {
    // FY2020-21 ends 30 June 2021. Company = 4 years. Expiry = 30 June 2025.
    const result = checkAmendmentPeriod('FY2020-21', 'company', new Date(2026, 0, 1))
    expect(result).toBeDefined()
    expect(result).toContain('amendment period')
  })

  it('uses 4 years for unknown entity type (conservative)', () => {
    // FY2021-22 ends 30 June 2022. Unknown = 4 years. Expiry = 30 June 2026.
    const result = checkAmendmentPeriod('FY2021-22', 'unknown', new Date(2025, 11, 1))
    expect(result).toBeUndefined() // Still within period
  })

  it('returns undefined for invalid FY format', () => {
    const result = checkAmendmentPeriod('invalid', 'company')
    expect(result).toBeUndefined()
  })

  it('handles trust entity type (4 years)', () => {
    // FY2020-21 ends 30 June 2021. Trust = 4 years. Expiry = 30 June 2025.
    const result = checkAmendmentPeriod('FY2020-21', 'trust', new Date(2025, 7, 1))
    expect(result).toBeDefined()
  })

  it('handles partnership entity type (4 years)', () => {
    const result = checkAmendmentPeriod('FY2023-24', 'partnership', new Date(2026, 0, 1))
    expect(result).toBeUndefined()
  })
})

// ---- getBASQuarter ----

describe('getBASQuarter', () => {
  it('returns Q1 for July', () => {
    const result = getBASQuarter(new Date(2025, 6, 15))
    expect(result.quarter).toBe('Q1')
    expect(result.financialYear).toBe('FY2025-26')
  })

  it('returns Q1 for September', () => {
    const result = getBASQuarter(new Date(2025, 8, 30))
    expect(result.quarter).toBe('Q1')
  })

  it('returns Q2 for October', () => {
    const result = getBASQuarter(new Date(2025, 9, 1))
    expect(result.quarter).toBe('Q2')
    expect(result.financialYear).toBe('FY2025-26')
  })

  it('returns Q2 for December', () => {
    const result = getBASQuarter(new Date(2025, 11, 31))
    expect(result.quarter).toBe('Q2')
  })

  it('returns Q3 for January', () => {
    const result = getBASQuarter(new Date(2026, 0, 15))
    expect(result.quarter).toBe('Q3')
    expect(result.financialYear).toBe('FY2025-26')
  })

  it('returns Q3 for March', () => {
    const result = getBASQuarter(new Date(2026, 2, 31))
    expect(result.quarter).toBe('Q3')
  })

  it('returns Q4 for April', () => {
    const result = getBASQuarter(new Date(2026, 3, 1))
    expect(result.quarter).toBe('Q4')
    expect(result.financialYear).toBe('FY2025-26')
  })

  it('returns Q4 for June', () => {
    const result = getBASQuarter(new Date(2026, 5, 30))
    expect(result.quarter).toBe('Q4')
  })

  it('includes period start and end dates', () => {
    const result = getBASQuarter(new Date(2025, 6, 15))
    expect(result.periodStart).toBeInstanceOf(Date)
    expect(result.periodEnd).toBeInstanceOf(Date)
    expect(result.dueDate).toBeInstanceOf(Date)
  })

  it('Q1 due date is 28 October', () => {
    const result = getBASQuarter(new Date(2025, 6, 15))
    expect(result.dueDate.getMonth()).toBe(9) // October
    expect(result.dueDate.getDate()).toBe(28)
  })

  it('Q2 due date is 28 February', () => {
    const result = getBASQuarter(new Date(2025, 9, 15))
    expect(result.dueDate.getMonth()).toBe(1) // February
    expect(result.dueDate.getDate()).toBe(28)
  })

  it('Q3 due date is 28 April', () => {
    const result = getBASQuarter(new Date(2026, 0, 15))
    expect(result.dueDate.getMonth()).toBe(3) // April
    expect(result.dueDate.getDate()).toBe(28)
  })

  it('Q4 due date is 28 August', () => {
    const result = getBASQuarter(new Date(2026, 3, 15))
    expect(result.dueDate.getMonth()).toBe(7) // August
    expect(result.dueDate.getDate()).toBe(28)
  })
})
