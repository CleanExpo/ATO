/**
 * Tax Calculations Unit Tests
 *
 * Tests for Australian tax calculation logic including:
 * - R&D Tax Incentive (Division 355)
 * - Division 7A benchmark interest
 * - Tax loss calculations
 */

import { describe, it, expect } from 'vitest'

// =============================================================================
// R&D Tax Incentive Tests (Division 355 ITAA 1997)
// =============================================================================

describe('R&D Tax Offset Calculation', () => {
  const RND_OFFSET_RATE = 0.435 // 43.5% for small business

  function calculateRndOffset(expenditure: number): number {
    return Math.round(expenditure * RND_OFFSET_RATE * 100) / 100
  }

  it('calculates 43.5% offset for eligible expenditure', () => {
    const result = calculateRndOffset(100000)
    expect(result).toBe(43500)
  })

  it('handles zero expenditure', () => {
    const result = calculateRndOffset(0)
    expect(result).toBe(0)
  })

  it('rounds to 2 decimal places', () => {
    const result = calculateRndOffset(100001)
    expect(result).toBe(43500.44) // 100001 * 0.435 = 43500.435
  })

  it('handles large amounts correctly', () => {
    const result = calculateRndOffset(1000000)
    expect(result).toBe(435000)
  })

  it('handles small amounts correctly', () => {
    const result = calculateRndOffset(100)
    expect(result).toBe(43.5)
  })

  it('handles decimal expenditure', () => {
    const result = calculateRndOffset(12345.67)
    expect(result).toBeCloseTo(5370.37, 2)
  })
})

// =============================================================================
// Division 7A Tests (ITAA 1936)
// =============================================================================

describe('Division 7A Benchmark Interest', () => {
  const DIV7A_BENCHMARK_RATE_2024_25 = 0.0877 // 8.77% for FY2024-25

  function calculateDiv7aInterest(
    loanAmount: number,
    rate: number = DIV7A_BENCHMARK_RATE_2024_25
  ): number {
    return Math.round(loanAmount * rate * 100) / 100
  }

  it('calculates benchmark interest at 8.77%', () => {
    const result = calculateDiv7aInterest(100000)
    expect(result).toBe(8770)
  })

  it('handles zero loan amount', () => {
    const result = calculateDiv7aInterest(0)
    expect(result).toBe(0)
  })

  it('calculates minimum yearly repayment (7-year loan)', () => {
    // For a 7-year unsecured loan, minimum repayment includes principal + interest
    const loanAmount = 100000
    const interest = calculateDiv7aInterest(loanAmount)
    const principalPortion = loanAmount / 7 // Simplified for test

    expect(interest).toBe(8770)
    expect(principalPortion).toBeCloseTo(14285.71, 2)
  })
})

// =============================================================================
// Tax Loss Calculation Tests (Subdivision 36-A ITAA 1997)
// =============================================================================

describe('Tax Loss Carry-Forward', () => {
  interface TaxLoss {
    financialYear: string
    revenueLoss: number
    capitalLoss: number
  }

  function calculateTotalLosses(losses: TaxLoss[]): {
    totalRevenueLosses: number
    totalCapitalLosses: number
  } {
    return losses.reduce(
      (acc, loss) => ({
        totalRevenueLosses: acc.totalRevenueLosses + loss.revenueLoss,
        totalCapitalLosses: acc.totalCapitalLosses + loss.capitalLoss
      }),
      { totalRevenueLosses: 0, totalCapitalLosses: 0 }
    )
  }

  it('aggregates revenue losses across years', () => {
    const losses: TaxLoss[] = [
      { financialYear: 'FY2022-23', revenueLoss: 50000, capitalLoss: 0 },
      { financialYear: 'FY2023-24', revenueLoss: 75000, capitalLoss: 0 }
    ]

    const result = calculateTotalLosses(losses)
    expect(result.totalRevenueLosses).toBe(125000)
  })

  it('separates capital and revenue losses', () => {
    const losses: TaxLoss[] = [
      { financialYear: 'FY2022-23', revenueLoss: 50000, capitalLoss: 10000 },
      { financialYear: 'FY2023-24', revenueLoss: 25000, capitalLoss: 15000 }
    ]

    const result = calculateTotalLosses(losses)
    expect(result.totalRevenueLosses).toBe(75000)
    expect(result.totalCapitalLosses).toBe(25000)
  })

  it('handles empty loss array', () => {
    const result = calculateTotalLosses([])
    expect(result.totalRevenueLosses).toBe(0)
    expect(result.totalCapitalLosses).toBe(0)
  })
})

// =============================================================================
// Corporate Tax Rate Tests
// =============================================================================

describe('Corporate Tax Rate', () => {
  const SMALL_BUSINESS_RATE = 0.25 // 25%
  const STANDARD_RATE = 0.30 // 30%
  const TURNOVER_THRESHOLD = 50_000_000 // $50M

  function getCorporateTaxRate(aggregatedTurnover: number): number {
    return aggregatedTurnover < TURNOVER_THRESHOLD
      ? SMALL_BUSINESS_RATE
      : STANDARD_RATE
  }

  function calculateTax(taxableIncome: number, turnover: number): number {
    const rate = getCorporateTaxRate(turnover)
    return Math.round(taxableIncome * rate * 100) / 100
  }

  it('applies 25% rate for small business', () => {
    const result = calculateTax(100000, 10_000_000)
    expect(result).toBe(25000)
  })

  it('applies 30% rate for large business', () => {
    const result = calculateTax(100000, 100_000_000)
    expect(result).toBe(30000)
  })

  it('uses small business rate at threshold boundary', () => {
    // Just under $50M
    const rate = getCorporateTaxRate(49_999_999)
    expect(rate).toBe(0.25)
  })

  it('uses standard rate at threshold', () => {
    // Exactly $50M
    const rate = getCorporateTaxRate(50_000_000)
    expect(rate).toBe(0.30)
  })
})

// =============================================================================
// Instant Asset Write-Off Tests (s 328-180)
// =============================================================================

describe('Instant Asset Write-Off', () => {
  const THRESHOLD_2024_25 = 20_000 // $20,000 for FY2024-25

  function isEligibleForInstantWriteOff(
    assetCost: number,
    threshold: number = THRESHOLD_2024_25
  ): boolean {
    return assetCost < threshold
  }

  function calculateWriteOff(
    assetCost: number,
    threshold: number = THRESHOLD_2024_25
  ): number {
    return isEligibleForInstantWriteOff(assetCost, threshold) ? assetCost : 0
  }

  it('allows write-off under threshold', () => {
    expect(isEligibleForInstantWriteOff(19999)).toBe(true)
    expect(calculateWriteOff(19999)).toBe(19999)
  })

  it('rejects write-off at threshold', () => {
    expect(isEligibleForInstantWriteOff(20000)).toBe(false)
    expect(calculateWriteOff(20000)).toBe(0)
  })

  it('rejects write-off over threshold', () => {
    expect(isEligibleForInstantWriteOff(25000)).toBe(false)
    expect(calculateWriteOff(25000)).toBe(0)
  })
})

// =============================================================================
// Financial Year Validation Tests
// =============================================================================

describe('Financial Year Validation', () => {
  function isValidFinancialYear(fy: string): boolean {
    return /^FY\d{4}-\d{2}$/.test(fy)
  }

  function parseFinancialYear(fy: string): {
    startYear: number
    endYear: number
  } | null {
    if (!isValidFinancialYear(fy)) return null

    const match = fy.match(/^FY(\d{4})-(\d{2})$/)
    if (!match) return null

    return {
      startYear: parseInt(match[1], 10),
      endYear: 2000 + parseInt(match[2], 10)
    }
  }

  it('validates correct FY format', () => {
    expect(isValidFinancialYear('FY2024-25')).toBe(true)
    expect(isValidFinancialYear('FY2023-24')).toBe(true)
  })

  it('rejects invalid FY formats', () => {
    expect(isValidFinancialYear('2024-25')).toBe(false)
    expect(isValidFinancialYear('FY202425')).toBe(false)
    expect(isValidFinancialYear('FY2024/25')).toBe(false)
    expect(isValidFinancialYear('')).toBe(false)
  })

  it('parses FY into years', () => {
    const result = parseFinancialYear('FY2024-25')
    expect(result).toEqual({ startYear: 2024, endYear: 2025 })
  })

  it('returns null for invalid FY', () => {
    expect(parseFinancialYear('invalid')).toBeNull()
  })
})
