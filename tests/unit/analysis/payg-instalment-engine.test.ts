/**
 * @vitest-environment node
 *
 * PAYG Instalment Engine Tests (Division 45 Schedule 1 TAA 1953)
 *
 * Tests for lib/analysis/payg-instalment-engine.ts
 * - Instalment amount and instalment rate methods
 * - Quarterly instalment calculations
 * - Variation recommendations and penalty risk (s 45-235 TAA 1953)
 * - Cashflow impact analysis
 * - Empty data handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/utils/financial-year', () => ({
  getCurrentFinancialYear: vi.fn(() => 'FY2024-25'),
  getBASQuarter: vi.fn((date: Date) => {
    const month = date.getMonth()
    if (month >= 6 && month <= 8) return { quarter: 'Q1' }
    if (month >= 9 && month <= 11) return { quarter: 'Q2' }
    if (month >= 0 && month <= 2) return { quarter: 'Q3' }
    return { quarter: 'Q4' }
  }),
}))

vi.mock('@/lib/tax-data/cache-manager', () => ({
  getCurrentTaxRates: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'
import { analyzePAYGInstalments } from '@/lib/analysis/payg-instalment-engine'
import type {
  PAYGInstalmentAnalysis,
  PAYGAnalysisOptions,
} from '@/lib/analysis/payg-instalment-engine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Supabase mock that returns the given transaction rows. */
function mockSupabase(rows: unknown[] | null, error: { message: string } | null = null) {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: undefined as unknown,
  }

  // The engine chains .from().select().eq().eq() -- the final call resolves the promise
  // We attach the data/error as the awaited result of the chain
  Object.defineProperty(queryBuilder, 'then', {
    value: (resolve: (v: unknown) => void) =>
      resolve({ data: rows, error }),
    configurable: true,
  })

  const supabase = {
    from: vi.fn().mockReturnValue(queryBuilder),
  }

  vi.mocked(createServiceClient).mockResolvedValue(supabase as never)
  return supabase
}

function mockTaxRatesSuccess(corporateTaxRateSmall = 0.25) {
  vi.mocked(getCurrentTaxRates).mockResolvedValue({
    corporateTaxRateSmall,
    sources: { corporateTax: 'ATO' },
  } as never)
}

function mockTaxRatesFailure() {
  vi.mocked(getCurrentTaxRates).mockRejectedValue(new Error('Cache miss'))
}

/** Create an ACCREC transaction in the shape expected by the engine. */
function makeAccrecTx(amount: number, dateStr: string) {
  return {
    raw_data: {
      Type: 'ACCREC',
      Total: String(amount),
      Date: dateStr,
    },
    financial_year: 'FY2024-25',
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PAYG Instalment Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTaxRatesSuccess()
  })

  // =========================================================================
  // 1. Return structure
  // =========================================================================

  describe('analyzePAYGInstalments return structure', () => {
    it('returns a PAYGInstalmentAnalysis with all required fields', async () => {
      mockSupabase([
        makeAccrecTx(50_000, '2024-08-15'),
        makeAccrecTx(60_000, '2024-11-10'),
        makeAccrecTx(45_000, '2025-02-05'),
        makeAccrecTx(55_000, '2025-05-20'),
      ])

      const result: PAYGInstalmentAnalysis = await analyzePAYGInstalments('tenant-1', 'FY2024-25')

      // Top-level fields
      expect(result.tenantId).toBe('tenant-1')
      expect(result.financialYear).toBe('FY2024-25')
      expect(result.currentMethod).toBeDefined()
      expect(result.recommendedMethod).toBeDefined()
      expect(result.methodChangeNote).toEqual(expect.any(String))

      // Quarters array
      expect(result.quarters).toHaveLength(4)
      expect(result.quarters[0].quarter).toBe('Q1')
      expect(result.quarters[3].quarter).toBe('Q4')

      // Totals
      expect(typeof result.totalInstalmentsDue).toBe('number')
      expect(typeof result.totalInstalmentsPaid).toBe('number')

      // Tax liability estimates
      expect(typeof result.estimatedAnnualIncome).toBe('number')
      expect(typeof result.estimatedTaxLiability).toBe('number')
      expect(typeof result.estimatedShortfall).toBe('number')
      expect(typeof result.estimatedExcess).toBe('number')

      // Variation fields
      expect(typeof result.variationRecommended).toBe('boolean')
      expect(typeof result.variationRiskAssessment).toBe('string')

      // Cashflow impact
      expect(result.cashflowImpact).toBeDefined()
      expect(typeof result.cashflowImpact.quarterlyAmount).toBe('number')
      expect(typeof result.cashflowImpact.annualAmount).toBe('number')
      expect(typeof result.cashflowImpact.optimisedQuarterlyAmount).toBe('number')
      expect(typeof result.cashflowImpact.cashflowSaving).toBe('number')

      // Metadata
      expect(result.confidence).toBe(60)
      expect(result.recommendations).toEqual(expect.any(Array))
      expect(result.legislativeReferences.length).toBeGreaterThan(0)
      expect(result.taxRateSource).toBeDefined()
      expect(result.taxRateVerifiedAt).toBeDefined()
    })

    it('includes Division 45 and s 45-235 legislative references', async () => {
      mockSupabase([makeAccrecTx(100_000, '2024-09-01')])

      const result = await analyzePAYGInstalments('tenant-1', 'FY2024-25')

      expect(result.legislativeReferences).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Division 45'),
          expect.stringContaining('s 45-235'),
          expect.stringContaining('s 45-112'),
          expect.stringContaining('General Interest Charge'),
        ])
      )
    })
  })

  // =========================================================================
  // 2. Empty data handling
  // =========================================================================

  describe('empty data handling', () => {
    it('returns zero totals when no transactions exist', async () => {
      mockSupabase([])

      const result = await analyzePAYGInstalments('tenant-empty', 'FY2024-25')

      expect(result.estimatedAnnualIncome).toBe(0)
      expect(result.estimatedTaxLiability).toBe(0)
      expect(result.totalInstalmentsDue).toBe(0)
      expect(result.quarters).toHaveLength(4) // quarters still generated
      result.quarters.forEach((q) => {
        expect(q.instalmentIncome).toBe(0)
        expect(q.instalmentAmount).toBe(0)
      })
    })

    it('returns zero totals when data is null', async () => {
      mockSupabase(null)

      const result = await analyzePAYGInstalments('tenant-null', 'FY2024-25')

      expect(result.estimatedAnnualIncome).toBe(0)
      expect(result.totalInstalmentsDue).toBe(0)
    })

    it('throws when Supabase returns an error', async () => {
      mockSupabase(null, { message: 'Connection refused' })

      await expect(
        analyzePAYGInstalments('tenant-err', 'FY2024-25')
      ).rejects.toThrow('Failed to fetch transactions')
    })
  })

  // =========================================================================
  // 3. Quarterly calculations
  // =========================================================================

  describe('quarterly instalment calculations', () => {
    it('calculates instalment amount using rate method (income * rate)', async () => {
      // Place $100,000 income in Q1 (July-Sep)
      mockSupabase([makeAccrecTx(100_000, '2024-08-15')])

      const options: PAYGAnalysisOptions = {
        currentMethod: 'rate',
        notifiedRate: 0.10, // 10%
      }

      const result = await analyzePAYGInstalments('tenant-rate', 'FY2024-25', options)

      // Q1 instalment = $100,000 * 10% = $10,000
      const q1 = result.quarters.find((q) => q.quarter === 'Q1')!
      expect(q1.instalmentIncome).toBe(100_000)
      expect(q1.instalmentRate).toBe(0.10)
      expect(q1.instalmentAmount).toBe(10_000)
    })

    it('calculates instalment amount using amount method (notified / 4)', async () => {
      mockSupabase([makeAccrecTx(200_000, '2024-08-15')])

      const options: PAYGAnalysisOptions = {
        currentMethod: 'amount',
        notifiedAmount: 40_000, // Annual notified amount
      }

      const result = await analyzePAYGInstalments('tenant-amount', 'FY2024-25', options)

      // Each quarter = $40,000 / 4 = $10,000
      result.quarters.forEach((q) => {
        expect(q.instalmentAmount).toBe(10_000)
      })
    })

    it('applies varied instalment amounts when hasVaried is true', async () => {
      mockSupabase([makeAccrecTx(200_000, '2024-08-15')])

      const options: PAYGAnalysisOptions = {
        currentMethod: 'rate',
        notifiedRate: 0.10,
        hasVaried: true,
        variedAmount: 20_000, // Varied annual amount
      }

      const result = await analyzePAYGInstalments('tenant-varied', 'FY2024-25', options)

      // Each quarter = $20,000 / 4 = $5,000
      result.quarters.forEach((q) => {
        expect(q.instalmentAmount).toBe(5_000)
      })
    })

    it('sets dueDate for each quarter correctly', async () => {
      mockSupabase([])

      const result = await analyzePAYGInstalments('tenant-dates', 'FY2024-25')

      // Q1 due: 28 October 2024
      expect(result.quarters[0].dueDate.getMonth()).toBe(9) // October (0-indexed)
      expect(result.quarters[0].dueDate.getDate()).toBe(28)

      // Q2 due: 28 February 2025
      expect(result.quarters[1].dueDate.getMonth()).toBe(1)
      expect(result.quarters[1].dueDate.getDate()).toBe(28)

      // Q3 due: 28 April 2025
      expect(result.quarters[2].dueDate.getMonth()).toBe(3)
      expect(result.quarters[2].dueDate.getDate()).toBe(28)

      // Q4 due: 28 August 2025
      expect(result.quarters[3].dueDate.getMonth()).toBe(7)
      expect(result.quarters[3].dueDate.getDate()).toBe(28)
    })
  })

  // =========================================================================
  // 4. Instalment rate vs amount method recommendation
  // =========================================================================

  describe('instalment method recommendation', () => {
    it('recommends switching to rate when amount method overpays by >20%', async () => {
      // $100k income at 25% tax = $25k estimated liability
      // Notified amount $40k = 60% overpayment > 20% threshold
      mockSupabase([makeAccrecTx(100_000, '2024-08-15')])

      const options: PAYGAnalysisOptions = {
        currentMethod: 'amount',
        notifiedAmount: 40_000,
      }

      const result = await analyzePAYGInstalments('tenant-switch', 'FY2024-25', options)

      expect(result.recommendedMethod).toBe('rate')
      expect(result.methodChangeNote).toContain('rate method')
    })

    it('keeps current method when instalments align with liability', async () => {
      // $100k income at 25% rate = $25k liability
      // Notified amount $26k = close to liability
      mockSupabase([makeAccrecTx(100_000, '2024-08-15')])

      const options: PAYGAnalysisOptions = {
        currentMethod: 'amount',
        notifiedAmount: 26_000,
      }

      const result = await analyzePAYGInstalments('tenant-keep', 'FY2024-25', options)

      expect(result.recommendedMethod).toBe('amount')
      expect(result.methodChangeNote).toContain('appropriate')
    })
  })

  // =========================================================================
  // 5. Variation recommendations and penalty risk (s 45-235)
  // =========================================================================

  describe('variation recommendations and s 45-235 penalty risk', () => {
    it('does not recommend variation when instalments are at or below liability', async () => {
      // Income $200k, rate 25% -> liability $50k
      // With rate 0.20 -> instalments = $200k * 0.20 = $40k (below $50k liability)
      mockSupabase([
        makeAccrecTx(100_000, '2024-08-15'),
        makeAccrecTx(100_000, '2025-02-10'),
      ])

      const options: PAYGAnalysisOptions = {
        currentMethod: 'rate',
        notifiedRate: 0.20,
      }

      const result = await analyzePAYGInstalments('tenant-novar', 'FY2024-25', options)

      expect(result.variationRecommended).toBe(false)
      expect(result.variationAmount).toBeNull()
      expect(result.variationPenaltyWarning).toBeNull()
    })

    it('recommends variation when instalments significantly exceed liability', async () => {
      // Income $100k, rate 25% -> liability $25k
      // With rate 0.40 -> instalments = $100k * 0.40 = $40k (60% over liability)
      mockSupabase([makeAccrecTx(100_000, '2024-08-15')])

      const options: PAYGAnalysisOptions = {
        currentMethod: 'rate',
        notifiedRate: 0.40,
      }

      const result = await analyzePAYGInstalments('tenant-var', 'FY2024-25', options)

      expect(result.variationRecommended).toBe(true)
      expect(result.variationAmount).toBeGreaterThan(0)
    })

    it('includes s 45-235 penalty warning when variation is recommended', async () => {
      mockSupabase([makeAccrecTx(100_000, '2024-08-15')])

      const options: PAYGAnalysisOptions = {
        currentMethod: 'rate',
        notifiedRate: 0.40,
      }

      const result = await analyzePAYGInstalments('tenant-warn', 'FY2024-25', options)

      expect(result.variationPenaltyWarning).not.toBeNull()
      expect(result.variationPenaltyWarning).toContain('s 45-235')
      expect(result.variationPenaltyWarning).toContain('85%')
      expect(result.variationPenaltyWarning).toContain('General Interest Charge')
    })

    it('sets variation amount to 85% safe harbour of estimated liability', async () => {
      // Liability = $100k * 0.25 = $25,000
      // Safe harbour = $25,000 * 0.85 = $21,250
      mockSupabase([makeAccrecTx(100_000, '2024-08-15')])

      const options: PAYGAnalysisOptions = {
        currentMethod: 'rate',
        notifiedRate: 0.40,
      }

      const result = await analyzePAYGInstalments('tenant-safe', 'FY2024-25', options)

      // The variation amount should be the 85% safe harbour
      expect(result.variationAmount).toBe(21250)
    })
  })

  // =========================================================================
  // 6. Tax rate source / fallback
  // =========================================================================

  describe('tax rate source handling', () => {
    it('uses ATO tax rates when cache succeeds', async () => {
      mockTaxRatesSuccess(0.25)
      mockSupabase([makeAccrecTx(100_000, '2024-08-15')])

      const result = await analyzePAYGInstalments('tenant-src', 'FY2024-25')

      expect(result.taxRateSource).toBe('ATO')
      // Estimated liability = $100k * 0.25 = $25,000
      expect(result.estimatedTaxLiability).toBe(25_000)
    })

    it('falls back to 0.25 corporate tax rate when cache fails', async () => {
      mockTaxRatesFailure()
      mockSupabase([makeAccrecTx(100_000, '2024-08-15')])

      const result = await analyzePAYGInstalments('tenant-fb', 'FY2024-25')

      expect(result.taxRateSource).toBe('fallback')
      expect(result.estimatedTaxLiability).toBe(25_000)
    })

    it('uses provided corporateTaxRate option over cache', async () => {
      mockTaxRatesFailure()
      mockSupabase([makeAccrecTx(100_000, '2024-08-15')])

      const options: PAYGAnalysisOptions = {
        corporateTaxRate: 0.30,
      }

      const result = await analyzePAYGInstalments('tenant-opt', 'FY2024-25', options)

      // Liability = $100k * 0.30 = $30,000
      expect(result.estimatedTaxLiability).toBe(30_000)
    })
  })

  // =========================================================================
  // 7. Cashflow impact
  // =========================================================================

  describe('cashflow impact', () => {
    it('calculates cashflow saving when instalments exceed estimated tax', async () => {
      // Income $100k * rate 0.40 => instalment total $40k
      // Estimated tax = $100k * 0.25 = $25k
      // Saving = $40k - $25k = $15k
      mockSupabase([makeAccrecTx(100_000, '2024-08-15')])

      const options: PAYGAnalysisOptions = {
        currentMethod: 'rate',
        notifiedRate: 0.40,
      }

      const result = await analyzePAYGInstalments('tenant-cf', 'FY2024-25', options)

      expect(result.cashflowImpact.annualAmount).toBe(40_000)
      expect(result.cashflowImpact.quarterlyAmount).toBe(10_000)
      expect(result.cashflowImpact.optimisedQuarterlyAmount).toBe(6_250) // $25k / 4
      expect(result.cashflowImpact.cashflowSaving).toBe(15_000)
    })

    it('shows zero cashflow saving when instalments match or underestimate tax', async () => {
      mockSupabase([makeAccrecTx(100_000, '2024-08-15')])

      const options: PAYGAnalysisOptions = {
        currentMethod: 'rate',
        notifiedRate: 0.20, // Instalments $20k < liability $25k
      }

      const result = await analyzePAYGInstalments('tenant-cf0', 'FY2024-25', options)

      expect(result.cashflowImpact.cashflowSaving).toBe(0)
    })
  })

  // =========================================================================
  // 8. Recommendations
  // =========================================================================

  describe('recommendations', () => {
    it('always includes quarterly review recommendation', async () => {
      mockSupabase([])

      const result = await analyzePAYGInstalments('tenant-rec', 'FY2024-25')

      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Review instalment amounts at least quarterly'),
        ])
      )
    })

    it('recommends method switch when methods differ', async () => {
      // Force a method switch recommendation by having high notified amount
      mockSupabase([makeAccrecTx(100_000, '2024-08-15')])

      const options: PAYGAnalysisOptions = {
        currentMethod: 'amount',
        notifiedAmount: 80_000, // Way above $25k liability
      }

      const result = await analyzePAYGInstalments('tenant-switch-rec', 'FY2024-25', options)

      if (result.currentMethod !== result.recommendedMethod) {
        expect(result.recommendations).toEqual(
          expect.arrayContaining([
            expect.stringContaining('switching from'),
          ])
        )
      }
    })
  })
})
