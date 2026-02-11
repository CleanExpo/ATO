/**
 * @vitest-environment node
 *
 * Cash Flow Forecast Engine Tests
 *
 * Tests for lib/analysis/cashflow-forecast-engine.ts
 * Projects future tax obligations and cash flow requirements based on
 * historical data and current tax position.
 *
 * DISCLAIMER: Projections are estimates only, not financial advice.
 * Does not constitute advice under Corporations Act 2001.
 * See ASIC RG 234 for disclosure requirements for forward-looking statements.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateCashFlowForecast } from '@/lib/analysis/cashflow-forecast-engine'
import type { CashFlowForecast, ForecastOptions } from '@/lib/analysis/cashflow-forecast-engine'

// =============================================================================
// Mocks
// =============================================================================

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/tax-data/cache-manager', () => ({
  getCurrentTaxRates: vi.fn().mockResolvedValue({
    corporateTaxRateSmall: 0.25,
    sources: { corporateTax: 'ATO' },
  }),
}))

import { createServiceClient } from '@/lib/supabase/server'
const mockCreateServiceClient = vi.mocked(createServiceClient)

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build a mock Supabase client that returns the given transactions
 * from historical_transactions_cache with ordering and limit support.
 */
function buildMockSupabase(transactions: unknown[] | null, error: unknown = null) {
  const mockResult = { data: transactions, error }
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockResult),
          }),
        }),
      }),
    }),
  }
}

/**
 * Build a Xero-style raw transaction object.
 */
function buildTransaction(overrides: {
  Type?: string
  Total?: string | number
  Description?: string
  Date?: string
}) {
  return {
    Type: overrides.Type ?? 'ACCPAY',
    Total: overrides.Total ?? '100.00',
    Description: overrides.Description ?? '',
    Date: overrides.Date ?? '2025-01-15',
    ...overrides,
  }
}

/**
 * Wrap raw transactions in the historical_transactions_cache row format.
 */
function wrapInCacheRow(rawTransactions: unknown[], financialYear = 'FY2024-25') {
  return [{ raw_data: rawTransactions, financial_year: financialYear }]
}

// =============================================================================
// Tests
// =============================================================================

describe('CashFlowForecastEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // 1. Basic structure tests
  // ---------------------------------------------------------------------------

  describe('generateCashFlowForecast - return structure', () => {
    it('returns a valid CashFlowForecast structure with all required fields', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '50000', Date: '2025-01-15' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-20000', Date: '2025-02-10' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await generateCashFlowForecast('tenant-123', 'FY2024-25')

      // Verify top-level structure
      expect(result).toHaveProperty('tenantId', 'tenant-123')
      expect(result).toHaveProperty('financialYear', 'FY2024-25')
      expect(result).toHaveProperty('forecastHorizon')
      expect(result).toHaveProperty('periods')
      expect(result).toHaveProperty('totalProjectedIncome')
      expect(result).toHaveProperty('totalProjectedExpenses')
      expect(result).toHaveProperty('totalTaxObligations')
      expect(result).toHaveProperty('recommendedCashReserve')
      expect(result).toHaveProperty('keyDates')
      expect(result).toHaveProperty('assumptions')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('disclaimer')
      expect(result).toHaveProperty('recommendations')
      expect(result).toHaveProperty('taxRateSource')
      expect(result).toHaveProperty('taxRateVerifiedAt')

      // Verify types
      expect(typeof result.forecastHorizon).toBe('number')
      expect(Array.isArray(result.periods)).toBe(true)
      expect(Array.isArray(result.keyDates)).toBe(true)
      expect(Array.isArray(result.assumptions)).toBe(true)
      expect(Array.isArray(result.recommendations)).toBe(true)
      expect(typeof result.totalProjectedIncome).toBe('number')
      expect(typeof result.totalProjectedExpenses).toBe('number')
      expect(typeof result.totalTaxObligations).toBe('number')
      expect(typeof result.recommendedCashReserve).toBe('number')
    })

    it('returns forecast with empty periods list and zero totals for empty transaction data', async () => {
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase([]) as never)

      const result = await generateCashFlowForecast('tenant-empty', 'FY2024-25')

      expect(result.tenantId).toBe('tenant-empty')
      expect(result.financialYear).toBe('FY2024-25')
      // Even with no transactions, periods are generated (12 months default)
      expect(result.periods.length).toBe(12)
      // With no historical data, projected income should be 0 for each month
      expect(result.totalProjectedIncome).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Monthly forecast generation with tax obligations
  // ---------------------------------------------------------------------------

  describe('monthly forecast generation', () => {
    it('generates 12 monthly periods by default', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '120000', Date: '2025-01-15' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await generateCashFlowForecast('tenant-months', 'FY2024-25')

      expect(result.forecastHorizon).toBe(12)
      expect(result.periods.length).toBe(12)
    })

    it('respects custom horizon months option', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '60000', Date: '2025-01-15' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const options: ForecastOptions = { horizonMonths: 6 }
      const result = await generateCashFlowForecast('tenant-6m', 'FY2024-25', options)

      expect(result.forecastHorizon).toBe(6)
      expect(result.periods.length).toBe(6)
    })

    it('calculates each period with opening/closing cash positions and net cashflow', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '120000', Date: '2025-01-15' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const options: ForecastOptions = {
        openingBalance: 50000,
        projectedTurnover: 240000,
        horizonMonths: 3,
      }
      const result = await generateCashFlowForecast('tenant-cashpos', 'FY2024-25', options)

      // First period should start with the opening balance
      expect(result.periods[0].openingCashPosition).toBe(50000)

      // Each period's closing = opening + netCashflow
      for (const period of result.periods) {
        const expectedClosing = period.openingCashPosition + period.netCashflow
        expect(period.closingCashPosition).toBeCloseTo(expectedClosing, 2)
      }

      // Second period's opening should equal first period's closing
      if (result.periods.length >= 2) {
        expect(result.periods[1].openingCashPosition).toBeCloseTo(
          result.periods[0].closingCashPosition, 2
        )
      }
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Tax obligation types
  // ---------------------------------------------------------------------------

  describe('tax obligation types', () => {
    it('calculates income_tax provision based on projected income and corporate tax rate', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '120000', Date: '2025-01-15' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const options: ForecastOptions = {
        projectedTurnover: 240000,
        corporateTaxRate: 0.25,
      }
      const result = await generateCashFlowForecast('tenant-tax', 'FY2024-25', options)

      // Monthly income = 240000 / 12 = 20000
      // Income tax provision = 20000 * 0.25 = 5000 per month
      for (const period of result.periods) {
        expect(period.incomeTaxProvision).toBeCloseTo(5000, 2)
      }
    })

    it('calculates GST payable when GST registered', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '120000', Date: '2025-01-15' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const options: ForecastOptions = {
        projectedTurnover: 120000,
        isGSTRegistered: true,
      }
      const result = await generateCashFlowForecast('tenant-gst', 'FY2024-25', options)

      // Monthly income = 120000 / 12 = 10000
      // GST = 10000 * 0.1 = 1000 per month (simplified as 1/11 approximation in code)
      for (const period of result.periods) {
        expect(period.gstPayable).toBeGreaterThan(0)
      }
    })

    it('sets GST to zero when not GST registered', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '120000', Date: '2025-01-15' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const options: ForecastOptions = {
        projectedTurnover: 120000,
        isGSTRegistered: false,
      }
      const result = await generateCashFlowForecast('tenant-no-gst', 'FY2024-25', options)

      for (const period of result.periods) {
        expect(period.gstPayable).toBe(0)
      }
    })

    it('calculates PAYG instalments only in quarter-end months', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '120000', Date: '2025-01-15' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const options: ForecastOptions = {
        projectedTurnover: 240000,
      }
      const result = await generateCashFlowForecast('tenant-payg', 'FY2024-25', options)

      // PAYG should only be non-zero for quarter-end months (Sep, Dec, Mar, Jun)
      const quarterEndMonths = [8, 11, 2, 5] // 0-indexed month numbers
      for (const period of result.periods) {
        const monthIndex = period.periodStart.getMonth()
        if (quarterEndMonths.includes(monthIndex)) {
          // Quarter-end month -- PAYG may be non-zero
          // (it depends on the rate and income, but at least it should not be NaN)
          expect(typeof period.paygInstalment).toBe('number')
          expect(isNaN(period.paygInstalment)).toBe(false)
        } else {
          // Non-quarter-end month -- PAYG should be zero
          expect(period.paygInstalment).toBe(0)
        }
      }
    })

    it('calculates FBT instalments when estimated FBT liability is provided', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '120000', Date: '2025-01-15' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const options: ForecastOptions = {
        projectedTurnover: 240000,
        estimatedFBTLiability: 12000, // Annual FBT
      }
      const result = await generateCashFlowForecast('tenant-fbt', 'FY2024-25', options)

      // FBT = 12000 / 4 / 3 = 1000 per month
      for (const period of result.periods) {
        expect(period.fbtInstalment).toBeCloseTo(1000, 2)
      }
    })

    it('calculates super guarantee based on monthly payroll and SG rate (s 19 SGAA 1992)', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '120000', Date: '2025-01-15' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const options: ForecastOptions = {
        projectedTurnover: 240000,
        monthlyPayroll: 20000,
      }
      const result = await generateCashFlowForecast('tenant-super', 'FY2024-25', options)

      // SG rate is 11.5% for FY2024-25 or 12% from FY2025-26
      // Monthly payroll $20k -> super = $20k * rate
      for (const period of result.periods) {
        expect(period.superGuarantee).toBeGreaterThan(0)
        // Should be either 20000 * 0.115 = 2300 or 20000 * 0.12 = 2400
        expect(period.superGuarantee).toBeGreaterThanOrEqual(2300)
        expect(period.superGuarantee).toBeLessThanOrEqual(2400)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Peak tax month identification
  // ---------------------------------------------------------------------------

  describe('peak tax month identification', () => {
    it('identifies months with highest total tax obligations', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '120000', Date: '2025-01-15' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const options: ForecastOptions = {
        projectedTurnover: 240000,
        isGSTRegistered: true,
        monthlyPayroll: 15000,
      }
      const result = await generateCashFlowForecast('tenant-peak', 'FY2024-25', options)

      // Quarter-end months should have higher obligations (PAYG + GST + super + FBT)
      const quarterEndPeriods = result.periods.filter(p => {
        const month = p.periodStart.getMonth()
        return [8, 11, 2, 5].includes(month) // Sep, Dec, Mar, Jun
      })
      const nonQuarterEndPeriods = result.periods.filter(p => {
        const month = p.periodStart.getMonth()
        return ![8, 11, 2, 5].includes(month)
      })

      if (quarterEndPeriods.length > 0 && nonQuarterEndPeriods.length > 0) {
        const maxQuarterEnd = Math.max(...quarterEndPeriods.map(p => p.totalTaxObligations))
        const avgNonQuarterEnd = nonQuarterEndPeriods.reduce(
          (sum, p) => sum + p.totalTaxObligations, 0
        ) / nonQuarterEndPeriods.length

        // Quarter-end months should have higher obligations due to PAYG
        expect(maxQuarterEnd).toBeGreaterThan(avgNonQuarterEnd)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Cash flow risk month identification
  // ---------------------------------------------------------------------------

  describe('cash flow risk month identification', () => {
    it('generates alerts when projected cash position goes negative', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '5000', Date: '2025-01-15' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      // Very low opening balance + high obligations = likely negative cash
      const options: ForecastOptions = {
        openingBalance: 100,
        projectedTurnover: 12000, // Only $1k/month income
        isGSTRegistered: true,
        monthlyPayroll: 5000,
        estimatedFBTLiability: 10000,
      }
      const result = await generateCashFlowForecast('tenant-negative', 'FY2024-25', options)

      // Should have at least one period with negative closing position
      const negativePeriods = result.periods.filter(p => p.closingCashPosition < 0)
      expect(negativePeriods.length).toBeGreaterThan(0)

      // Negative periods should have alert messages
      for (const period of negativePeriods) {
        const negativeAlert = period.alerts.find(a => a.includes('negative cash position'))
        expect(negativeAlert).toBeDefined()
      }

      // Recommendations should warn about negative cash months
      const negativeRec = result.recommendations.find(r =>
        r.includes('negative cash position')
      )
      expect(negativeRec).toBeDefined()
    })

    it('recommends cash reserve equal to 3 months of tax obligations', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '120000', Date: '2025-01-15' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const options: ForecastOptions = {
        projectedTurnover: 240000,
        isGSTRegistered: true,
        monthlyPayroll: 10000,
      }
      const result = await generateCashFlowForecast('tenant-reserve', 'FY2024-25', options)

      // Recommended reserve should be 3 months of average tax obligations
      const avgMonthlyTax = result.totalTaxObligations / result.forecastHorizon
      const expectedReserve = avgMonthlyTax * 3

      expect(result.recommendedCashReserve).toBeCloseTo(expectedReserve, 0)
      expect(result.recommendedCashReserve).toBeGreaterThan(0)
    })
  })

  // ---------------------------------------------------------------------------
  // 6. Assumptions list
  // ---------------------------------------------------------------------------

  describe('assumptions list', () => {
    it('includes projected turnover assumption when provided', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '50000', Date: '2025-01-15' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const options: ForecastOptions = {
        projectedTurnover: 500000,
      }
      const result = await generateCashFlowForecast('tenant-assumptions', 'FY2024-25', options)

      const turnoverAssumption = result.assumptions.find(a =>
        a.includes('Projected annual turnover')
      )
      expect(turnoverAssumption).toBeDefined()
      expect(turnoverAssumption).toContain('500,000')
    })

    it('includes historical average assumption when no turnover provided', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '50000', Date: '2025-01-15' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await generateCashFlowForecast('tenant-hist', 'FY2024-25')

      const histAssumption = result.assumptions.find(a =>
        a.includes('historical monthly averages')
      )
      expect(histAssumption).toBeDefined()
    })

    it('includes corporate tax rate, expense ratio, and consistency assumptions', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '50000', Date: '2025-01-15' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await generateCashFlowForecast('tenant-std-assumptions', 'FY2024-25')

      // Corporate tax rate
      const taxRateAssumption = result.assumptions.find(a =>
        a.includes('Corporate tax rate')
      )
      expect(taxRateAssumption).toBeDefined()

      // 70% expense ratio
      const expenseAssumption = result.assumptions.find(a =>
        a.includes('70%')
      )
      expect(expenseAssumption).toBeDefined()

      // Consistent performance
      const consistencyAssumption = result.assumptions.find(a =>
        a.includes('consistent business performance')
      )
      expect(consistencyAssumption).toBeDefined()

      // No extraordinary items
      const extraordinaryAssumption = result.assumptions.find(a =>
        a.includes('extraordinary items')
      )
      expect(extraordinaryAssumption).toBeDefined()
    })

    it('includes disclaimer stating projections are estimates only and not financial advice', async () => {
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase([]) as never)

      const result = await generateCashFlowForecast('tenant-disclaimer', 'FY2024-25')

      expect(result.disclaimer).toContain('ESTIMATES ONLY')
      expect(result.disclaimer).toContain('does not constitute financial advice')
      expect(result.disclaimer).toContain('Corporations Act 2001')
      expect(result.disclaimer).toContain('ASIC RG 234')
    })

    it('throws an error when Supabase query fails', async () => {
      mockCreateServiceClient.mockResolvedValue(
        buildMockSupabase(null, { message: 'Connection timeout' }) as never
      )

      await expect(
        generateCashFlowForecast('tenant-error', 'FY2024-25')
      ).rejects.toThrow('Failed to fetch transactions')
    })
  })
})
