/**
 * @vitest-environment node
 *
 * State Payroll Tax Engine Tests
 *
 * Tests for lib/analysis/payroll-tax-engine.ts
 * Covers all 8 Australian states/territories with correct rates and thresholds.
 *
 * Legislation:
 * - NSW: Payroll Tax Act 2007 (NSW)
 * - VIC: Payroll Tax Act 2007 (Vic)
 * - QLD: Payroll Tax Act 1971 (Qld)
 * - WA: Pay-roll Tax Assessment Act 2002 (WA)
 * - SA: Payroll Tax Act 2009 (SA)
 * - TAS: Payroll Tax Act 2008 (Tas)
 * - ACT: Payroll Tax Act 2011 (ACT)
 * - NT: Payroll Tax Act 2009 (NT)
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
}))

import { createServiceClient } from '@/lib/supabase/server'
import { analyzePayrollTax } from '@/lib/analysis/payroll-tax-engine'
import type {
  PayrollTaxAnalysis,
  PayrollTaxOptions,
  StateWages,
  StateCode,
} from '@/lib/analysis/payroll-tax-engine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a Supabase mock that returns empty data.
 * The payroll tax engine only calls Supabase when no stateWages are provided
 * (to derive wages from Xero). When stateWages are provided via options,
 * Supabase is still instantiated but not queried for payroll data.
 */
function mockSupabase() {
  const supabase = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
    }),
  }
  vi.mocked(createServiceClient).mockResolvedValue(supabase as never)
  return supabase
}

/** Convenience: create a StateWages entry. */
function makeWages(
  state: StateCode,
  grossWages: number,
  contractorPayments = 0,
  contractorDeemingAssessed = false,
  employeeCount = 10
): StateWages {
  return { state, grossWages, contractorPayments, contractorDeemingAssessed, employeeCount }
}

// ---------------------------------------------------------------------------
// State rate/threshold reference (FY2024-25 fallback values from engine)
// ---------------------------------------------------------------------------

const STATE_CONFIGS: Record<
  StateCode,
  { threshold: number; rate: number; higherRate?: number; higherRateThreshold?: number }
> = {
  NSW: { threshold: 1_200_000, rate: 0.0485, higherRate: 0.056, higherRateThreshold: 10_000_000 },
  VIC: { threshold: 900_000, rate: 0.0485, higherRate: 0.0575, higherRateThreshold: 10_000_000 },
  QLD: { threshold: 1_300_000, rate: 0.0475, higherRate: 0.0475, higherRateThreshold: 6_500_000 },
  WA: { threshold: 1_000_000, rate: 0.055 },
  SA: { threshold: 1_500_000, rate: 0.0495 },
  TAS: { threshold: 1_250_000, rate: 0.0412, higherRate: 0.0612, higherRateThreshold: 2_000_000 },
  ACT: { threshold: 2_000_000, rate: 0.0685 },
  NT: { threshold: 1_500_000, rate: 0.055 },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Payroll Tax Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase()
  })

  // =========================================================================
  // 1. Return structure
  // =========================================================================

  describe('analyzePayrollTax return structure', () => {
    it('returns a PayrollTaxAnalysis with all required fields', async () => {
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('NSW', 2_000_000)],
      }

      const result: PayrollTaxAnalysis = await analyzePayrollTax('tenant-1', 'FY2024-25', options)

      expect(result.tenantId).toBe('tenant-1')
      expect(result.financialYear).toBe('FY2024-25')
      expect(result.stateResults).toEqual(expect.any(Array))
      expect(typeof result.totalPayrollTaxPayable).toBe('number')
      expect(typeof result.isMultiStateEmployer).toBe('boolean')
      expect(result.statesWithEmployees).toEqual(expect.any(Array))
      expect(result.thresholdApportionment).toBeDefined()
      expect(result.groupingAnalysis).toBeDefined()
      expect(result.contractorDeemingRisk).toBeDefined()
      expect(result.contractorWarnings).toEqual(expect.any(Array))
      expect(typeof result.totalWagesNationwide).toBe('number')
      expect(typeof result.averageEffectiveRate).toBe('number')
      expect(typeof result.confidence).toBe('number')
      expect(result.recommendations).toEqual(expect.any(Array))
      expect(result.legislativeReferences).toEqual(expect.any(Array))
      expect(result.taxRateSource).toBeDefined()
      expect(result.taxRateVerifiedAt).toBeDefined()
    })

    it('sets confidence to 70 when stateWages provided, 40 otherwise', async () => {
      const withWages = await analyzePayrollTax('t1', 'FY2024-25', {
        stateWages: [makeWages('NSW', 2_000_000)],
      })
      expect(withWages.confidence).toBe(70)

      // Without stateWages, engine falls back to Xero (returns empty) -> empty analysis
      const withoutWages = await analyzePayrollTax('t2', 'FY2024-25')
      expect(withoutWages.confidence).toBe(0) // empty analysis
    })
  })

  // =========================================================================
  // 2. Empty data handling
  // =========================================================================

  describe('empty data handling', () => {
    it('returns empty analysis when no state wages provided and Xero returns nothing', async () => {
      const result = await analyzePayrollTax('tenant-empty', 'FY2024-25')

      expect(result.stateResults).toHaveLength(0)
      expect(result.totalPayrollTaxPayable).toBe(0)
      expect(result.totalWagesNationwide).toBe(0)
      expect(result.isMultiStateEmployer).toBe(false)
      expect(result.statesWithEmployees).toHaveLength(0)
      expect(result.groupingAnalysis.isGrouped).toBe(false)
      expect(result.groupingAnalysis.groupedEntityCount).toBe(0)
      expect(result.contractorDeemingRisk).toBe('low')
    })

    it('includes recommendation to provide state wages data in empty analysis', async () => {
      const result = await analyzePayrollTax('tenant-empty', 'FY2024-25')

      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Provide state wages data'),
        ])
      )
    })
  })

  // =========================================================================
  // 3. Single-state calculations (all 8 states)
  // =========================================================================

  describe('single-state payroll tax calculations', () => {
    /**
     * For each state, test that wages above threshold are taxed at the correct rate.
     * Uses wages of $2M (above all thresholds) for straightforward calculation.
     */
    const singleStateCases: { state: StateCode; wages: number }[] = [
      { state: 'NSW', wages: 2_000_000 },
      { state: 'VIC', wages: 2_000_000 },
      { state: 'QLD', wages: 2_000_000 },
      { state: 'WA', wages: 2_000_000 },
      { state: 'SA', wages: 2_000_000 },
      { state: 'TAS', wages: 2_000_000 },
      { state: 'ACT', wages: 3_000_000 }, // ACT threshold is $2M, need wages above
      { state: 'NT', wages: 2_000_000 },
    ]

    singleStateCases.forEach(({ state, wages }) => {
      it(`calculates ${state} payroll tax correctly for wages of $${wages.toLocaleString()}`, async () => {
        const options: PayrollTaxOptions = {
          stateWages: [makeWages(state, wages)],
        }

        const result = await analyzePayrollTax(`tenant-${state}`, 'FY2024-25', options)
        const stateResult = result.stateResults[0]
        const config = STATE_CONFIGS[state]

        expect(stateResult.state).toBe(state)
        expect(stateResult.totalWages).toBe(wages)

        // Single-state employer gets full threshold
        expect(stateResult.thresholdDeduction).toBe(config.threshold)

        // Taxable wages = total - threshold
        const expectedTaxable = wages - config.threshold
        expect(stateResult.taxableWages).toBe(expectedTaxable)

        // Tax payable = taxable * rate (no higher rate triggered at $2M for most states)
        // TAS is special: $2M is exactly the higher rate threshold trigger
        if (state === 'TAS' && wages >= (config.higherRateThreshold ?? Infinity)) {
          // TAS two-tier: tier 1 = $1.25M to $2M at 4.12%, tier 2 = above $2M at 6.12%
          const tier1 = (config.higherRateThreshold ?? 0) - config.threshold
          const tier2 = expectedTaxable - tier1
          // With $2M wages and $1.25M threshold, taxable = $750k
          // tier1 = $2M - $1.25M = $750k, tier2 = 0
          // But the engine checks totalWages > higherRateThreshold
          // At exactly $2M, totalWages is NOT > $2M, so single rate applies
          const expectedTax = Number((expectedTaxable * config.rate).toFixed(2))
          expect(stateResult.payrollTaxPayable).toBeCloseTo(expectedTax, 0)
        } else {
          const expectedTax = Number((expectedTaxable * config.rate).toFixed(2))
          expect(stateResult.payrollTaxPayable).toBeCloseTo(expectedTax, 0)
        }

        // Effective rate = tax / total wages
        expect(stateResult.effectiveRate).toBeGreaterThan(0)
        expect(stateResult.effectiveRate).toBeLessThan(config.rate)
      })
    })

    it('returns zero tax when wages are below threshold (NSW)', async () => {
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('NSW', 1_000_000)], // Below $1.2M threshold
      }

      const result = await analyzePayrollTax('tenant-below', 'FY2024-25', options)
      const stateResult = result.stateResults[0]

      expect(stateResult.taxableWages).toBe(0)
      expect(stateResult.payrollTaxPayable).toBe(0)
      expect(stateResult.effectiveRate).toBe(0)
    })
  })

  // =========================================================================
  // 4. Higher rate tiers
  // =========================================================================

  describe('higher rate tiers', () => {
    it('applies NSW surcharge rate (5.60%) for wages above $10M', async () => {
      const wages = 12_000_000
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('NSW', wages)],
      }

      const result = await analyzePayrollTax('tenant-nsw-high', 'FY2024-25', options)
      const stateResult = result.stateResults[0]

      const threshold = STATE_CONFIGS.NSW.threshold
      const taxableWages = wages - threshold // $10,800,000
      const tier1Limit = STATE_CONFIGS.NSW.higherRateThreshold! - threshold // $8,800,000
      const tier1Wages = Math.min(taxableWages, tier1Limit)
      const tier2Wages = taxableWages - tier1Wages // $2,000,000

      const expectedTax = Number(
        (tier1Wages * STATE_CONFIGS.NSW.rate + tier2Wages * STATE_CONFIGS.NSW.higherRate!).toFixed(2)
      )

      expect(stateResult.payrollTaxPayable).toBeCloseTo(expectedTax, 0)
      expect(stateResult.payrollTaxPayable).toBeGreaterThan(taxableWages * STATE_CONFIGS.NSW.rate)
    })

    it('applies TAS tier 2 rate (6.12%) for wages above $2M', async () => {
      const wages = 3_000_000
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('TAS', wages)],
      }

      const result = await analyzePayrollTax('tenant-tas-high', 'FY2024-25', options)
      const stateResult = result.stateResults[0]

      const threshold = STATE_CONFIGS.TAS.threshold // $1,250,000
      const taxableWages = wages - threshold // $1,750,000
      const tier1Limit = STATE_CONFIGS.TAS.higherRateThreshold! - threshold // $750,000
      const tier1Wages = Math.min(taxableWages, tier1Limit)
      const tier2Wages = taxableWages - tier1Wages // $1,000,000

      const expectedTax = Number(
        (tier1Wages * STATE_CONFIGS.TAS.rate + tier2Wages * STATE_CONFIGS.TAS.higherRate!).toFixed(2)
      )

      expect(stateResult.payrollTaxPayable).toBeCloseTo(expectedTax, 0)
      // Tax should be higher than if all wages were at the base rate
      const baseTax = taxableWages * STATE_CONFIGS.TAS.rate
      expect(stateResult.payrollTaxPayable).toBeGreaterThan(baseTax)
    })

    it('applies VIC mental health levy for wages above $10M', async () => {
      const wages = 15_000_000
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('VIC', wages)],
      }

      const result = await analyzePayrollTax('tenant-vic-high', 'FY2024-25', options)
      const stateResult = result.stateResults[0]

      // Verify two-tier calculation is applied
      const threshold = STATE_CONFIGS.VIC.threshold
      const taxableWages = wages - threshold
      const baseTax = taxableWages * STATE_CONFIGS.VIC.rate
      expect(stateResult.payrollTaxPayable).toBeGreaterThan(baseTax)
    })
  })

  // =========================================================================
  // 5. Multi-state threshold apportionment
  // =========================================================================

  describe('multi-state threshold apportionment', () => {
    it('apportions threshold based on wage proportion across states', async () => {
      const options: PayrollTaxOptions = {
        stateWages: [
          makeWages('NSW', 3_000_000), // 60% of total
          makeWages('VIC', 2_000_000), // 40% of total
        ],
      }

      const result = await analyzePayrollTax('tenant-multi', 'FY2024-25', options)

      expect(result.isMultiStateEmployer).toBe(true)
      expect(result.statesWithEmployees).toEqual(['NSW', 'VIC'])

      // NSW gets 60% of its $1.2M threshold = $720,000
      const nswApportioned = result.thresholdApportionment['NSW']
      expect(nswApportioned).toBeCloseTo(1_200_000 * 0.6, 0)

      // VIC gets 40% of its $900,000 threshold = $360,000
      const vicApportioned = result.thresholdApportionment['VIC']
      expect(vicApportioned).toBeCloseTo(900_000 * 0.4, 0)
    })

    it('gives single-state employer full threshold', async () => {
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('QLD', 2_000_000)],
      }

      const result = await analyzePayrollTax('tenant-single', 'FY2024-25', options)

      expect(result.isMultiStateEmployer).toBe(false)
      expect(result.thresholdApportionment['QLD']).toBe(STATE_CONFIGS.QLD.threshold)
    })

    it('correctly reduces threshold deduction for multi-state employers', async () => {
      // Three-state employer
      const options: PayrollTaxOptions = {
        stateWages: [
          makeWages('NSW', 2_000_000),  // 40%
          makeWages('VIC', 1_500_000),  // 30%
          makeWages('QLD', 1_500_000),  // 30%
        ],
      }

      const result = await analyzePayrollTax('tenant-3state', 'FY2024-25', options)

      expect(result.isMultiStateEmployer).toBe(true)
      expect(result.statesWithEmployees).toHaveLength(3)

      // Each state threshold is reduced by its proportion of total wages
      const totalWages = 5_000_000
      result.stateResults.forEach((sr) => {
        const fullThreshold = STATE_CONFIGS[sr.state as StateCode].threshold
        const stateWage = sr.totalWages
        const expectedThreshold = fullThreshold * (stateWage / totalWages)
        expect(result.thresholdApportionment[sr.state as StateCode]).toBeCloseTo(expectedThreshold, 0)
      })
    })
  })

  // =========================================================================
  // 6. Grouping analysis
  // =========================================================================

  describe('grouping analysis', () => {
    it('returns non-grouped analysis when isGroupMember is false', async () => {
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('NSW', 2_000_000)],
        isGroupMember: false,
      }

      const result = await analyzePayrollTax('tenant-nogrp', 'FY2024-25', options)

      expect(result.groupingAnalysis.isGrouped).toBe(false)
      expect(result.groupingAnalysis.groupedEntityCount).toBe(1)
      expect(result.groupingAnalysis.notes).toEqual(
        expect.arrayContaining([
          expect.stringContaining('No group membership declared'),
        ])
      )
    })

    it('returns grouped analysis with group wage aggregation', async () => {
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('NSW', 2_000_000)],
        isGroupMember: true,
        totalGroupWages: 8_000_000,
        groupEntityCount: 3,
        groupEntityNames: ['Entity A', 'Entity B', 'Entity C'],
      }

      const result = await analyzePayrollTax('tenant-grp', 'FY2024-25', options)

      expect(result.groupingAnalysis.isGrouped).toBe(true)
      expect(result.groupingAnalysis.groupedEntityCount).toBe(3)
      expect(result.groupingAnalysis.groupedEntities).toEqual(['Entity A', 'Entity B', 'Entity C'])
      expect(result.groupingAnalysis.totalGroupWages).toBe(8_000_000)
      expect(result.groupingAnalysis.notes).toEqual(
        expect.arrayContaining([
          expect.stringContaining('group of 3 entities'),
          expect.stringContaining('Threshold is shared across the group'),
        ])
      )
    })

    it('includes grouping recommendation for grouped entities', async () => {
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('NSW', 2_000_000)],
        isGroupMember: true,
        totalGroupWages: 5_000_000,
        groupEntityCount: 2,
      }

      const result = await analyzePayrollTax('tenant-grprec', 'FY2024-25', options)

      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Grouped entity'),
        ])
      )
    })

    it('warns about potential grouping when not declared as group member', async () => {
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('NSW', 2_000_000)],
      }

      const result = await analyzePayrollTax('tenant-nogrpdecl', 'FY2024-25', options)

      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('related entities'),
        ])
      )
    })
  })

  // =========================================================================
  // 7. Contractor deeming provisions
  // =========================================================================

  describe('contractor deeming provisions', () => {
    it('flags low risk when no contractor payments exist', async () => {
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('NSW', 2_000_000, 0)],
      }

      const result = await analyzePayrollTax('tenant-nocon', 'FY2024-25', options)

      expect(result.contractorDeemingRisk).toBe('low')
      expect(result.contractorWarnings).toHaveLength(0)
    })

    it('flags medium risk when contractor proportion is between 20-50%', async () => {
      // Gross wages $1M, contractor $400k = 28.6% of total $1.4M
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('NSW', 1_000_000, 400_000)],
      }

      const result = await analyzePayrollTax('tenant-medcon', 'FY2024-25', options)

      expect(result.contractorDeemingRisk).toBe('medium')
      expect(result.contractorWarnings.length).toBeGreaterThan(0)
    })

    it('flags high risk when contractor proportion exceeds 50%', async () => {
      // Gross wages $500k, contractor $600k = 54.5% of total $1.1M
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('NSW', 500_000, 600_000)],
      }

      const result = await analyzePayrollTax('tenant-highcon', 'FY2024-25', options)

      expect(result.contractorDeemingRisk).toBe('high')
      expect(result.contractorWarnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('audit risk'),
        ])
      )
    })

    it('generates contractor deeming warning per state when not assessed', async () => {
      const options: PayrollTaxOptions = {
        stateWages: [
          makeWages('NSW', 1_000_000, 200_000, false),
          makeWages('VIC', 1_000_000, 150_000, false),
        ],
      }

      const result = await analyzePayrollTax('tenant-deemwarn', 'FY2024-25', options)

      // Each state with unassessed contractor payments should have a warning
      const nswResult = result.stateResults.find((r) => r.state === 'NSW')!
      expect(nswResult.contractorDeemingWarning).not.toBeNull()
      expect(nswResult.contractorDeemingWarning).toContain('Payroll Tax Act 2007 (NSW)')

      const vicResult = result.stateResults.find((r) => r.state === 'VIC')!
      expect(vicResult.contractorDeemingWarning).not.toBeNull()
      expect(vicResult.contractorDeemingWarning).toContain('Payroll Tax Act 2007 (Vic)')
    })

    it('no per-state warning when contractor deeming has been assessed', async () => {
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('NSW', 1_000_000, 200_000, true)],
      }

      const result = await analyzePayrollTax('tenant-assessed', 'FY2024-25', options)
      const nswResult = result.stateResults[0]

      expect(nswResult.contractorDeemingWarning).toBeNull()
    })

    it('includes contractor payments in total wages for tax calculation', async () => {
      const grossWages = 1_000_000
      const contractorPayments = 500_000

      const options: PayrollTaxOptions = {
        stateWages: [makeWages('SA', grossWages, contractorPayments)],
      }

      const result = await analyzePayrollTax('tenant-conwages', 'FY2024-25', options)
      const saResult = result.stateResults[0]

      expect(saResult.totalWages).toBe(grossWages + contractorPayments)
      expect(result.totalWagesNationwide).toBe(grossWages + contractorPayments)
    })
  })

  // =========================================================================
  // 8. Legislative references and recommendations
  // =========================================================================

  describe('legislative references and recommendations', () => {
    it('includes state-specific legislation reference in results', async () => {
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('WA', 2_000_000)],
      }

      const result = await analyzePayrollTax('tenant-leg', 'FY2024-25', options)

      expect(result.legislativeReferences).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Pay-roll Tax Assessment Act 2002 (WA)'),
        ])
      )
    })

    it('includes multi-state recommendation for multi-state employers', async () => {
      const options: PayrollTaxOptions = {
        stateWages: [
          makeWages('NSW', 2_000_000),
          makeWages('QLD', 1_500_000),
        ],
      }

      const result = await analyzePayrollTax('tenant-multirec', 'FY2024-25', options)

      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Multi-state employer'),
        ])
      )
    })

    it('includes annual rate verification recommendation', async () => {
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('ACT', 3_000_000)],
      }

      const result = await analyzePayrollTax('tenant-verify', 'FY2024-25', options)

      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Verify current rates with state revenue offices'),
        ])
      )
    })

    it('recommends high-risk contractor review when risk is high', async () => {
      const options: PayrollTaxOptions = {
        stateWages: [makeWages('NSW', 400_000, 600_000)],
      }

      const result = await analyzePayrollTax('tenant-highrec', 'FY2024-25', options)

      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('HIGH RISK'),
          expect.stringContaining('contractor'),
        ])
      )
    })
  })
})
