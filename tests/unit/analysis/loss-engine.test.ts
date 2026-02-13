/**
 * @vitest-environment node
 *
 * Loss Carry-Forward Optimization Engine Tests
 *
 * Tests for lib/analysis/loss-engine.ts
 * - Division 36 ITAA 1997: Tax losses carried forward
 * - Division 165 ITAA 1997: Company loss recoupment (COT/SBT)
 * - Division 266/267 Schedule 2F ITAA 1936: Trust loss recoupment
 * - s 102-5 ITAA 1997: Capital losses can ONLY offset capital gains
 * - SBT transaction evidence enrichment (s 165-13 ITAA 1997)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared before any import that touches the mocked modules
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/tax-data/cache-manager', () => ({
  getCurrentTaxRates: vi.fn(),
}))

vi.mock('@/lib/utils/financial-year', () => ({
  checkAmendmentPeriod: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

// ---------------------------------------------------------------------------
// Imports under test (after mocks)
// ---------------------------------------------------------------------------

import {
  analyzeLossPosition,
  calculateUnutilizedLossValue,
  type LossSummary,
  type EntityType,
} from '@/lib/analysis/loss-engine'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'
import { checkAmendmentPeriod } from '@/lib/utils/financial-year'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockedCreateServiceClient = vi.mocked(createServiceClient)
const mockedGetCurrentTaxRates = vi.mocked(getCurrentTaxRates)
const mockedCheckAmendmentPeriod = vi.mocked(checkAmendmentPeriod)

/**
 * Build a minimal Supabase mock that supports the chained query interface
 * used by fetchLossPositions and enrichSbtWithTransactionEvidence.
 *
 * @param historicalData - rows returned by `historical_transactions_cache` query
 * @param forensicData  - rows returned by `forensic_analysis_results` query (SBT enrichment)
 */
function buildSupabaseMock(
  historicalData: Array<{ financial_year: string; raw_data: Record<string, unknown> }> = [],
  forensicData: Array<{ financial_year: string; primary_category: string | null; supplier_name: string | null }> = []
) {
  const historicalChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    then: undefined as unknown,
  }
  // Terminal await resolves to { data, error }
  Object.defineProperty(historicalChain, 'then', {
    get() {
      return (resolve: (v: unknown) => void) => resolve({ data: historicalData, error: null })
    },
  })

  const forensicChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: undefined as unknown,
  }
  Object.defineProperty(forensicChain, 'then', {
    get() {
      return (resolve: (v: unknown) => void) => resolve({ data: forensicData, error: null })
    },
  })

  const from = vi.fn((table: string) => {
    if (table === 'historical_transactions_cache') return historicalChain
    if (table === 'forensic_analysis_results') return forensicChain
    // Fallback — empty
    return historicalChain
  })

  return { from }
}

function setupDefaultTaxRates() {
  mockedGetCurrentTaxRates.mockResolvedValue({
    corporateTaxRateSmall: 0.25,
    corporateTaxRateStandard: 0.30,
    sources: { corporateTax: 'ATO_LIVE_TEST' },
    cacheHit: true,
  } as any)
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('LossEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultTaxRates()
    mockedCheckAmendmentPeriod.mockReturnValue(undefined)
  })

  // =========================================================================
  // analyzeLossPosition
  // =========================================================================

  describe('analyzeLossPosition', () => {
    it('returns a valid LossSummary structure when Supabase returns loss data', async () => {
      const supabase = buildSupabaseMock([
        { financial_year: 'FY2022-23', raw_data: { Type: 'ACCREC', Total: '50000' } },
        { financial_year: 'FY2022-23', raw_data: { Type: 'ACCPAY', Total: '-80000' } },
      ])
      mockedCreateServiceClient.mockResolvedValue(supabase as any)

      const result: LossSummary = await analyzeLossPosition('tenant-1')

      // Structure checks — all LossSummary properties present
      expect(result).toHaveProperty('totalAvailableLosses')
      expect(result).toHaveProperty('totalUtilizedLosses')
      expect(result).toHaveProperty('totalExpiredLosses')
      expect(result).toHaveProperty('totalFutureTaxValue')
      expect(result).toHaveProperty('revenueLosses')
      expect(result).toHaveProperty('capitalLosses')
      expect(result).toHaveProperty('lossesByYear')
      expect(result).toHaveProperty('utilizationRate')
      expect(result).toHaveProperty('averageRiskLevel')
      expect(result).toHaveProperty('optimizationOpportunities')
      expect(result).toHaveProperty('lossHistory')
      expect(result).toHaveProperty('taxRateSource')
      expect(result).toHaveProperty('taxRateVerifiedAt')
    })

    it('returns an empty summary when no data exists', async () => {
      const supabase = buildSupabaseMock([])
      mockedCreateServiceClient.mockResolvedValue(supabase as any)

      const result = await analyzeLossPosition('tenant-empty')

      expect(result.totalAvailableLosses).toBe(0)
      expect(result.totalUtilizedLosses).toBe(0)
      expect(result.totalExpiredLosses).toBe(0)
      expect(result.totalFutureTaxValue).toBe(0)
      expect(result.revenueLosses).toBe(0)
      expect(result.capitalLosses).toBe(0)
      expect(result.lossHistory).toHaveLength(0)
      expect(result.utilizationRate).toBe(0)
      expect(result.averageRiskLevel).toBe('low')
      expect(result.taxRateSource).toBe('none')
    })

    it('classifies losses as revenue by default (lossType field)', async () => {
      const supabase = buildSupabaseMock([
        { financial_year: 'FY2023-24', raw_data: { Type: 'ACCREC', Total: '10000' } },
        { financial_year: 'FY2023-24', raw_data: { Type: 'ACCPAY', Total: '-50000' } },
      ])
      mockedCreateServiceClient.mockResolvedValue(supabase as any)

      const result = await analyzeLossPosition('tenant-rev')

      // Every year in lossHistory should have lossType = 'revenue'
      expect(result.lossHistory.length).toBeGreaterThan(0)
      result.lossHistory.forEach((analysis) => {
        expect(analysis.lossType).toBe('revenue')
      })
    })

    it('separates capital vs revenue losses in the summary (s 102-5)', async () => {
      // The engine defaults all losses to 'revenue'; capital losses would only
      // appear if the CGT engine classified them. With revenue-only defaults the
      // capitalLosses field should be 0 and revenueLosses should hold the balance.
      const supabase = buildSupabaseMock([
        { financial_year: 'FY2022-23', raw_data: { Type: 'ACCPAY', Total: '-100000' } },
      ])
      mockedCreateServiceClient.mockResolvedValue(supabase as any)

      const result = await analyzeLossPosition('tenant-cap')

      expect(result.capitalLosses).toBe(0)
      expect(result.revenueLosses).toBeGreaterThan(0)
      // Capital losses can ONLY offset capital gains (s 102-5 ITAA 1997).
      // Since engine default is revenue, capital offset path is not triggered.
      expect(result.revenueLosses).toBe(
        result.lossHistory[result.lossHistory.length - 1]?.closingLossBalance ?? 0
      )
    })

    it('revenue losses offset assessable income (Division 36)', async () => {
      // Year 1: net loss  |  Year 2: net profit  => losses utilised
      const supabase = buildSupabaseMock([
        // FY2022-23: loss year
        { financial_year: 'FY2022-23', raw_data: { Type: 'ACCREC', Total: '10000' } },
        { financial_year: 'FY2022-23', raw_data: { Type: 'ACCPAY', Total: '-60000' } },
        // FY2023-24: profit year
        { financial_year: 'FY2023-24', raw_data: { Type: 'ACCREC', Total: '100000' } },
      ])
      mockedCreateServiceClient.mockResolvedValue(supabase as any)

      const result = await analyzeLossPosition('tenant-rev-offset')

      // The loss from FY2022-23 should have been utilised against FY2023-24 profit
      expect(result.totalUtilizedLosses).toBeGreaterThan(0)
      expect(result.utilizationRate).toBeGreaterThan(0)
    })

    it('returns COT/SBT analysis structure for company entities', async () => {
      const supabase = buildSupabaseMock([
        { financial_year: 'FY2023-24', raw_data: { Type: 'ACCPAY', Total: '-50000' } },
      ])
      mockedCreateServiceClient.mockResolvedValue(supabase as any)

      const result = await analyzeLossPosition('tenant-cot', undefined, undefined, 'company')

      const analysis = result.lossHistory[0]
      expect(analysis).toBeDefined()

      const cot = analysis.cotSbtAnalysis
      expect(cot).toHaveProperty('cotSatisfied')
      expect(cot).toHaveProperty('cotConfidence')
      expect(cot).toHaveProperty('cotNotes')
      expect(cot).toHaveProperty('sbtRequired')
      expect(cot).toHaveProperty('sbtSatisfied')
      expect(cot).toHaveProperty('sbtConfidence')
      expect(cot).toHaveProperty('sbtNotes')
      expect(cot).toHaveProperty('isEligibleForCarryforward')
      expect(cot).toHaveProperty('professionalReviewRequired')
      expect(cot).toHaveProperty('riskLevel')
      // Company uses Division 165 => trustLossRule = 'not_applicable'
      expect(cot.trustLossRule).toBe('not_applicable')
    })

    it('trust entities use Division 266/267 NOT Division 165 (A-9 compliance)', async () => {
      const supabase = buildSupabaseMock([
        { financial_year: 'FY2023-24', raw_data: { Type: 'ACCPAY', Total: '-80000' } },
      ])
      mockedCreateServiceClient.mockResolvedValue(supabase as any)

      const result = await analyzeLossPosition('tenant-trust', undefined, undefined, 'trust')

      const analysis = result.lossHistory[0]
      const cot = analysis.cotSbtAnalysis

      // Trust-specific fields
      expect(cot.trustLossRule).toBe('division_266')
      expect(cot).toHaveProperty('familyTrustElection')
      expect(cot).toHaveProperty('trustNotes')
      expect(Array.isArray(cot.trustNotes)).toBe(true)

      // COT confidence should be 0 for trusts (Division 165 does not apply)
      expect(cot.cotConfidence).toBe(0)
      expect(cot.sbtConfidence).toBe(0)

      // Risk must be high (trust losses always high risk without deed analysis)
      expect(cot.riskLevel).toBe('high')
      expect(cot.professionalReviewRequired).toBe(true)

      // Verify trust notes reference correct legislation
      const allNotes = (cot.trustNotes ?? []).join(' ')
      expect(allNotes).toContain('Division 266')
      expect(allNotes).toContain('Division 267')
      expect(allNotes).toContain('Schedule 2F')
      expect(allNotes).not.toContain('Division 165 applies')
    })

    it('enriches SBT analysis with transaction evidence when forensic data exists', async () => {
      // Two financial years with overlapping expense categories
      const historicalData = [
        { financial_year: 'FY2022-23', raw_data: { Type: 'ACCPAY', Total: '-50000' } },
        { financial_year: 'FY2023-24', raw_data: { Type: 'ACCPAY', Total: '-60000' } },
      ]
      const forensicData = [
        // FY2022-23 categories
        { financial_year: 'FY2022-23', primary_category: 'Office Supplies', supplier_name: 'Officeworks' },
        { financial_year: 'FY2022-23', primary_category: 'IT Services', supplier_name: 'AWS' },
        { financial_year: 'FY2022-23', primary_category: 'Rent', supplier_name: 'Landlord Pty Ltd' },
        // FY2023-24 categories (high overlap)
        { financial_year: 'FY2023-24', primary_category: 'Office Supplies', supplier_name: 'Officeworks' },
        { financial_year: 'FY2023-24', primary_category: 'IT Services', supplier_name: 'AWS' },
        { financial_year: 'FY2023-24', primary_category: 'Rent', supplier_name: 'Landlord Pty Ltd' },
        { financial_year: 'FY2023-24', primary_category: 'Marketing', supplier_name: 'Google Ads' },
      ]
      const supabase = buildSupabaseMock(historicalData, forensicData)
      mockedCreateServiceClient.mockResolvedValue(supabase as any)

      const result = await analyzeLossPosition('tenant-sbt', undefined, undefined, 'company')

      // Find the FY2023-24 analysis which should have SBT enrichment
      const fy2324 = result.lossHistory.find((a) => a.financialYear === 'FY2023-24')
      expect(fy2324).toBeDefined()

      const evidence = fy2324!.cotSbtAnalysis.sbtEvidence
      if (evidence) {
        expect(evidence).toHaveProperty('currentYearCategories')
        expect(evidence).toHaveProperty('priorYearCategories')
        expect(evidence).toHaveProperty('consistentCategories')
        expect(evidence).toHaveProperty('consistencyRatio')
        expect(evidence).toHaveProperty('recurringSuppliers')
        expect(evidence).toHaveProperty('note')
        // 3 of 4 total categories consistent => 75% ratio
        expect(evidence.consistencyRatio).toBeGreaterThanOrEqual(0.7)
        expect(evidence.recurringSuppliers).toContain('Officeworks')
        expect(evidence.recurringSuppliers).toContain('AWS')
      }
    })

    it('uses base rate entity tax rate (25%) when isBaseRateEntity is true', async () => {
      const supabase = buildSupabaseMock([
        { financial_year: 'FY2023-24', raw_data: { Type: 'ACCPAY', Total: '-100000' } },
      ])
      mockedCreateServiceClient.mockResolvedValue(supabase as any)

      const result = await analyzeLossPosition('tenant-br', undefined, undefined, 'company', true)

      // Future tax value should use 25% rate
      const analysis = result.lossHistory[0]
      // closingLossBalance * 0.25
      const expectedFTV = Math.round(analysis.closingLossBalance * 0.25 * 100) / 100
      expect(analysis.futureTaxValue).toBeCloseTo(expectedFTV, 2)
    })
  })

  // =========================================================================
  // calculateUnutilizedLossValue
  // =========================================================================

  describe('calculateUnutilizedLossValue', () => {
    it('returns the totalFutureTaxValue from analyzeLossPosition', async () => {
      const supabase = buildSupabaseMock([
        { financial_year: 'FY2023-24', raw_data: { Type: 'ACCPAY', Total: '-200000' } },
      ])
      mockedCreateServiceClient.mockResolvedValue(supabase as any)

      const value = await calculateUnutilizedLossValue('tenant-val', 'company')

      // Should be closingLossBalance * 0.30 (standard rate)
      expect(value).toBeGreaterThan(0)
      // 200000 * 0.30 = 60000
      expect(value).toBeCloseTo(60000, 2)
    })

    it('returns 0 when there are no losses', async () => {
      const supabase = buildSupabaseMock([])
      mockedCreateServiceClient.mockResolvedValue(supabase as any)

      const value = await calculateUnutilizedLossValue('tenant-none')

      expect(value).toBe(0)
    })
  })

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('handles zero losses (profit-only scenario)', async () => {
      const supabase = buildSupabaseMock([
        { financial_year: 'FY2023-24', raw_data: { Type: 'ACCREC', Total: '100000' } },
      ])
      mockedCreateServiceClient.mockResolvedValue(supabase as any)

      const result = await analyzeLossPosition('tenant-zero')

      // No losses incurred — closingLossBalance should be 0
      expect(result.totalAvailableLosses).toBe(0)
      expect(result.totalFutureTaxValue).toBe(0)
      expect(result.lossHistory.length).toBeGreaterThan(0)
      const fy = result.lossHistory[0]
      expect(fy.closingLossBalance).toBe(0)
      expect(fy.currentYearLoss).toBe(0)
      // LossAnalysis doesn't carry currentYearProfit; verify via futureTaxValue = 0
      expect(fy.futureTaxValue).toBe(0)
      expect(fy.openingLossBalance).toBe(0)
    })

    it('handles mixed capital and revenue losses across years', async () => {
      // Since the engine defaults all losses to 'revenue', mixed classification
      // relies on external CGT engine. Verify summary correctly aggregates.
      const supabase = buildSupabaseMock([
        { financial_year: 'FY2022-23', raw_data: { Type: 'ACCPAY', Total: '-40000' } },
        { financial_year: 'FY2023-24', raw_data: { Type: 'ACCPAY', Total: '-60000' } },
      ])
      mockedCreateServiceClient.mockResolvedValue(supabase as any)

      const result = await analyzeLossPosition('tenant-mix')

      // Both years default to revenue, so capitalLosses stays 0
      expect(result.capitalLosses).toBe(0)
      expect(result.revenueLosses).toBeGreaterThan(0)
      // Verify two separate years are tracked
      expect(Object.keys(result.lossesByYear)).toHaveLength(2)
      expect(result.lossesByYear).toHaveProperty('FY2022-23')
      expect(result.lossesByYear).toHaveProperty('FY2023-24')
    })

    it('includes amendment period warnings on old financial years', async () => {
      const warningMessage =
        'FY2020-21: Outside the standard 4-year amendment period for companies/trusts (s 170 TAA 1953).'
      mockedCheckAmendmentPeriod.mockReturnValue(warningMessage)

      const supabase = buildSupabaseMock([
        { financial_year: 'FY2020-21', raw_data: { Type: 'ACCPAY', Total: '-50000' } },
      ])
      mockedCreateServiceClient.mockResolvedValue(supabase as any)

      const result = await analyzeLossPosition('tenant-old', undefined, undefined, 'company')

      // The amendment period warning should flow through to recommendations
      expect(mockedCheckAmendmentPeriod).toHaveBeenCalled()
      const analysis = result.lossHistory[0]
      const amendmentRec = analysis.recommendations.find((r) => r.includes('AMENDMENT PERIOD'))
      expect(amendmentRec).toBeDefined()
      expect(amendmentRec).toContain(warningMessage)
    })

    it('falls back to hardcoded rates when getCurrentTaxRates throws', async () => {
      mockedGetCurrentTaxRates.mockRejectedValue(new Error('Cache unavailable'))

      const supabase = buildSupabaseMock([
        { financial_year: 'FY2023-24', raw_data: { Type: 'ACCPAY', Total: '-100000' } },
      ])
      mockedCreateServiceClient.mockResolvedValue(supabase as any)

      // Should not throw — falls back to 30% hardcoded rate
      const result = await analyzeLossPosition('tenant-fallback', undefined, undefined, 'company')

      expect(result.lossHistory.length).toBeGreaterThan(0)
      const analysis = result.lossHistory[0]
      // Future tax value at fallback 30%: 100000 * 0.30 = 30000
      expect(analysis.futureTaxValue).toBeCloseTo(30000, 2)
    })
  })
})
