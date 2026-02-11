/**
 * @vitest-environment node
 *
 * Capital Gains Tax Engine Tests (Divisions 102-115, 152 ITAA 1997)
 *
 * Tests for lib/analysis/cgt-engine.ts covering:
 * - CGT event analysis and summary structure
 * - 50% CGT discount (Division 115) including company exclusion (s 115-25(1))
 * - Division 152 Small Business CGT Concessions
 *   - Net asset test ($6M threshold) with connected entity aggregation (Subdiv 152-15)
 *   - Cliff edge warning (within 10% of $6M)
 *   - 15-year exemption (Subdiv 152-B)
 *   - 50% active asset reduction (Subdiv 152-C)
 *   - Retirement exemption with $500K lifetime cap (Subdiv 152-D)
 *   - Rollover availability (Subdiv 152-E)
 * - Asset categorisation and loss quarantining
 *   - Collectable losses quarantined (s 108-10(1))
 *   - Personal use asset losses disregarded (s 108-20(1))
 * - Edge cases: zero gains, loss-only, missing dates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/tax-data/cache-manager', () => ({
  getCurrentTaxRates: vi.fn(),
}))

vi.mock('@/lib/utils/financial-year', () => ({
  getCurrentFinancialYear: vi.fn(() => 'FY2024-25'),
  checkAmendmentPeriod: vi.fn(() => undefined),
}))

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'
import { analyzeCGT } from '@/lib/analysis/cgt-engine'
import type { CGTAnalysisOptions } from '@/lib/analysis/cgt-engine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a chainable Supabase mock that resolves with the given value */
function createSupabaseChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.single = vi.fn().mockResolvedValue(resolvedValue)
  // The CGT engine does NOT call .single(); the chain ends after .order()
  // Supabase returns a thenable — mock the final result on the chain itself
  chain.then = (resolve: any) => resolve(resolvedValue)
  return chain
}

/** Return a mock Supabase client whose .from() yields the given rows */
function mockSupabaseWith(rows: any[], error: any = null) {
  const chain = createSupabaseChain({ data: rows, error })
  const fromFn = vi.fn(() => chain)
  const client = { from: fromFn }
  ;(createServiceClient as any).mockResolvedValue(client)
  return { client, chain }
}

/** Minimal tax rates mock */
function mockTaxRates() {
  ;(getCurrentTaxRates as any).mockResolvedValue({
    sources: { corporateTax: 'https://ato.gov.au/corporate-tax' },
    fetchedAt: new Date(),
  })
}

/** Create a forensic analysis row shaped for CGT disposal */
function makeDisposalRow(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'row-1',
    tenant_id: overrides.tenant_id ?? 'tenant-1',
    transaction_id: overrides.transaction_id ?? 'tx-1',
    financial_year: overrides.financial_year ?? 'FY2024-25',
    transaction_date: overrides.transaction_date ?? '2024-12-01',
    transaction_amount: overrides.transaction_amount ?? 100000,
    transaction_description: overrides.transaction_description ?? 'Disposal of investment property',
    supplier_name: overrides.supplier_name ?? null,
    platform: overrides.platform ?? 'xero',
    primary_category: overrides.primary_category ?? 'Asset Disposal',
    secondary_categories: overrides.secondary_categories ?? null,
    category_confidence: overrides.category_confidence ?? 85,
    is_rnd_candidate: false,
    meets_div355_criteria: false,
    rnd_activity_type: null,
    rnd_confidence: null,
    rnd_reasoning: null,
    div355_outcome_unknown: null,
    div355_systematic_approach: null,
    div355_new_knowledge: null,
    div355_scientific_method: null,
    is_fully_deductible: false,
    deduction_type: null,
    claimable_amount: null,
    deduction_restrictions: null,
    deduction_confidence: null,
    requires_documentation: true,
    fbt_implications: false,
    division7a_risk: false,
    compliance_notes: null,
    analyzed_at: '2024-12-15T00:00:00Z',
    acquisition_date: overrides.acquisition_date ?? '2022-06-01',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CGT Engine — analyzeCGT', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTaxRates()
  })

  // =========================================================================
  // 1. Basic structure and empty data
  // =========================================================================

  describe('CGTSummary structure', () => {
    it('should return a valid CGTSummary with all required fields', async () => {
      const row = makeDisposalRow()
      mockSupabaseWith([row])

      const result = await analyzeCGT('tenant-1', 'FY2024-25')

      expect(result).toHaveProperty('financialYear', 'FY2024-25')
      expect(result).toHaveProperty('totalCGTEvents')
      expect(result).toHaveProperty('totalCapitalGains')
      expect(result).toHaveProperty('totalCapitalLosses')
      expect(result).toHaveProperty('priorYearCapitalLosses')
      expect(result).toHaveProperty('netCapitalGain')
      expect(result).toHaveProperty('discountApplied')
      expect(result).toHaveProperty('div152Concessions')
      expect(result).toHaveProperty('taxableCapitalGain')
      expect(result).toHaveProperty('events')
      expect(result).toHaveProperty('div152Analysis')
      expect(result).toHaveProperty('capitalLossCarriedForward')
      expect(result).toHaveProperty('collectableGains')
      expect(result).toHaveProperty('collectableLosses')
      expect(result).toHaveProperty('collectableLossesApplied')
      expect(result).toHaveProperty('collectableLossesCarriedForward')
      expect(result).toHaveProperty('personalUseLossesDisregarded')
      expect(result).toHaveProperty('taxRateSource')
      expect(result).toHaveProperty('taxRateVerifiedAt')
      expect(result).toHaveProperty('legislativeReferences')
      expect(result).toHaveProperty('recommendations')
      expect(result).toHaveProperty('professionalReviewRequired')
    })

    it('should return empty summary when no transactions exist', async () => {
      mockSupabaseWith([])

      const result = await analyzeCGT('tenant-1', 'FY2024-25')

      expect(result.totalCGTEvents).toBe(0)
      expect(result.totalCapitalGains).toBe(0)
      expect(result.totalCapitalLosses).toBe(0)
      expect(result.netCapitalGain).toBe(0)
      expect(result.taxableCapitalGain).toBe(0)
      expect(result.events).toHaveLength(0)
      expect(result.div152Analysis).toBeNull()
      expect(result.professionalReviewRequired).toBe(false)
    })

    it('should return empty summary when transactions have no asset-related categories', async () => {
      const nonAssetRow = makeDisposalRow({
        primary_category: 'Office Supplies',
        transaction_description: 'Purchased printer paper',
      })
      mockSupabaseWith([nonAssetRow])

      const result = await analyzeCGT('tenant-1', 'FY2024-25')

      expect(result.totalCGTEvents).toBe(0)
      expect(result.events).toHaveLength(0)
    })
  })

  // =========================================================================
  // 2. CGT Discount (Division 115 ITAA 1997)
  // =========================================================================

  describe('CGT discount — Division 115', () => {
    it('should apply 50% discount for individual holding asset 12+ months', async () => {
      // Acquisition: 2022-06-01, Disposal: 2024-12-01 => ~30 months
      const row = makeDisposalRow({
        transaction_amount: 200000,
        acquisition_date: '2022-06-01',
        transaction_date: '2024-12-01',
      })
      mockSupabaseWith([row])

      const result = await analyzeCGT('tenant-1', 'FY2024-25', {
        entityType: 'individual',
      })

      expect(result.totalCapitalGains).toBe(200000)
      expect(result.discountApplied).toBeGreaterThan(0)
      // The discount should be approximately 50% of the net gain
      expect(result.events[0].eligibleForDiscount).toBe(true)
      expect(result.events[0].discountedGain).toBe(100000)
    })

    it('should NOT apply discount for asset held less than 12 months', async () => {
      // Acquisition: 2024-06-01, Disposal: 2024-12-01 => ~6 months
      const row = makeDisposalRow({
        transaction_amount: 200000,
        acquisition_date: '2024-06-01',
        transaction_date: '2024-12-01',
      })
      mockSupabaseWith([row])

      const result = await analyzeCGT('tenant-1', 'FY2024-25', {
        entityType: 'individual',
      })

      expect(result.events[0].eligibleForDiscount).toBe(false)
      expect(result.events[0].discountedGain).toBe(200000) // No discount
    })

    it('should NOT allow companies to access CGT discount (s 115-25(1))', async () => {
      const row = makeDisposalRow({
        transaction_amount: 200000,
        acquisition_date: '2020-01-01',
        transaction_date: '2024-12-01',
      })
      mockSupabaseWith([row])

      const result = await analyzeCGT('tenant-1', 'FY2024-25', {
        entityType: 'company',
      })

      // Even though held for many years, company gets no discount
      expect(result.events[0].eligibleForDiscount).toBe(false)
      expect(result.events[0].discountedGain).toBe(200000)
      expect(result.discountApplied).toBe(0)
    })

    it('should apply discount for trusts holding assets 12+ months', async () => {
      const row = makeDisposalRow({
        transaction_amount: 100000,
        acquisition_date: '2022-01-01',
        transaction_date: '2024-12-01',
      })
      mockSupabaseWith([row])

      const result = await analyzeCGT('tenant-1', 'FY2024-25', {
        entityType: 'trust',
      })

      expect(result.events[0].eligibleForDiscount).toBe(true)
      expect(result.events[0].discountedGain).toBe(50000)
    })

    it('should apply discount for super funds holding assets 12+ months', async () => {
      const row = makeDisposalRow({
        transaction_amount: 80000,
        acquisition_date: '2023-01-01',
        transaction_date: '2024-12-01',
      })
      mockSupabaseWith([row])

      const result = await analyzeCGT('tenant-1', 'FY2024-25', {
        entityType: 'super_fund',
      })

      expect(result.events[0].eligibleForDiscount).toBe(true)
    })
  })

  // =========================================================================
  // 3. Division 152 — Small Business CGT Concessions
  // =========================================================================

  describe('Division 152 — Small Business CGT Concessions', () => {
    const baseDiv152Options: CGTAnalysisOptions = {
      entityType: 'individual',
      aggregatedTurnover: 1_500_000,
      netAssetValue: 3_000_000,
      activeAssetPercentage: 90,
      yearsOfOwnership: 20,
      priorRetirementExemptionUsed: 0,
    }

    it('should return null div152Analysis when net gain is zero', async () => {
      // Capital loss produces 0 net gain => Division 152 not applicable
      const row = makeDisposalRow({ transaction_amount: -50000 })
      mockSupabaseWith([row])

      const result = await analyzeCGT('tenant-1', 'FY2024-25', baseDiv152Options)

      expect(result.div152Analysis).toBeNull()
    })

    // ----- Net asset test ($6M threshold) -----

    describe('Net asset test ($6M threshold)', () => {
      it('should pass net asset test when below $6M', async () => {
        const row = makeDisposalRow({ transaction_amount: 100000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          ...baseDiv152Options,
          netAssetValue: 4_000_000,
        })

        expect(result.div152Analysis).not.toBeNull()
        expect(result.div152Analysis!.netAssetTest.met).toBe(true)
        expect(result.div152Analysis!.netAssetTest.threshold).toBe(6_000_000)
      })

      it('should fail net asset test when at or above $6M', async () => {
        const row = makeDisposalRow({ transaction_amount: 100000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          ...baseDiv152Options,
          netAssetValue: 6_000_000,
          aggregatedTurnover: 3_000_000, // Also fail turnover
        })

        expect(result.div152Analysis).not.toBeNull()
        expect(result.div152Analysis!.netAssetTest.met).toBe(false)
      })
    })

    // ----- Connected entity aggregation (Subdivision 152-15) -----

    describe('Connected entity aggregation (Subdivision 152-15)', () => {
      it('should aggregate connected entity assets for net asset test', async () => {
        const row = makeDisposalRow({ transaction_amount: 100000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          ...baseDiv152Options,
          netAssetValue: 3_000_000,
          connectedEntities: [
            { name: 'Family Trust', netAssetValue: 2_000_000, relationship: 'connected_entity' },
            { name: 'Spouse Business', netAssetValue: 500_000, relationship: 'affiliate' },
          ],
        })

        const netAssetTest = result.div152Analysis!.netAssetTest
        expect(netAssetTest.connectedEntityAssets).toBe(2_500_000)
        expect(netAssetTest.aggregatedNetAssets).toBe(5_500_000) // 3M + 2.5M
        expect(netAssetTest.met).toBe(true) // 5.5M < 6M
      })

      it('should fail when aggregated assets (own + connected) exceed $6M', async () => {
        const row = makeDisposalRow({ transaction_amount: 100000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          ...baseDiv152Options,
          netAssetValue: 4_000_000,
          connectedEntities: [
            { name: 'Family Trust', netAssetValue: 3_000_000, relationship: 'connected_entity' },
          ],
          aggregatedTurnover: 3_000_000, // Fail turnover too
        })

        const netAssetTest = result.div152Analysis!.netAssetTest
        expect(netAssetTest.aggregatedNetAssets).toBe(7_000_000)
        expect(netAssetTest.met).toBe(false)
      })

      it('should include breakdown of connected entity contributions', async () => {
        const row = makeDisposalRow({ transaction_amount: 100000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          ...baseDiv152Options,
          connectedEntities: [
            { name: 'Trust A', netAssetValue: 1_000_000, relationship: 'connected_entity' },
            { name: 'Trust B', netAssetValue: 500_000, relationship: 'affiliate' },
          ],
        })

        const breakdown = result.div152Analysis!.netAssetTest.breakdown
        expect(breakdown).toBeDefined()
        expect(breakdown).toHaveLength(2)
        expect(breakdown![0]).toEqual({ name: 'Trust A', value: 1_000_000, relationship: 'connected_entity' })
        expect(breakdown![1]).toEqual({ name: 'Trust B', value: 500_000, relationship: 'affiliate' })
      })
    })

    // ----- Cliff edge warning -----

    describe('Cliff edge warning (within 10% of $6M)', () => {
      it('should trigger cliff edge warning when aggregated assets are between $5.4M and $6M', async () => {
        const row = makeDisposalRow({ transaction_amount: 100000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          ...baseDiv152Options,
          netAssetValue: 5_500_000, // $5.5M — within 10% of $6M
        })

        expect(result.div152Analysis!.netAssetTest.cliffEdgeWarning).toBe(true)
        expect(result.div152Analysis!.netAssetTest.note).toContain('CLIFF EDGE WARNING')
      })

      it('should NOT trigger cliff edge warning when well below threshold', async () => {
        const row = makeDisposalRow({ transaction_amount: 100000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          ...baseDiv152Options,
          netAssetValue: 3_000_000,
        })

        expect(result.div152Analysis!.netAssetTest.cliffEdgeWarning).toBe(false)
      })

      it('should NOT trigger cliff edge warning when above threshold (test already failed)', async () => {
        const row = makeDisposalRow({ transaction_amount: 100000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          ...baseDiv152Options,
          netAssetValue: 6_500_000,
          aggregatedTurnover: 3_000_000,
        })

        expect(result.div152Analysis!.netAssetTest.cliffEdgeWarning).toBe(false)
      })
    })

    // ----- 15-year exemption (Subdiv 152-B) -----

    describe('15-year exemption (Subdiv 152-B)', () => {
      it('should grant 15-year exemption when held 15+ years and basic conditions met', async () => {
        const row = makeDisposalRow({ transaction_amount: 100000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          ...baseDiv152Options,
          yearsOfOwnership: 16,
        })

        const div152 = result.div152Analysis!
        expect(div152.fifteenYearExemption.eligible).toBe(true)
        expect(div152.fifteenYearExemption.exemptAmount).toBeGreaterThan(0)
        expect(div152.fifteenYearExemption.threshold).toBe(15)
      })

      it('should NOT grant 15-year exemption when held less than 15 years', async () => {
        const row = makeDisposalRow({ transaction_amount: 100000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          ...baseDiv152Options,
          yearsOfOwnership: 10,
        })

        expect(result.div152Analysis!.fifteenYearExemption.eligible).toBe(false)
        expect(result.div152Analysis!.fifteenYearExemption.exemptAmount).toBe(0)
      })
    })

    // ----- 50% active asset reduction (Subdiv 152-C) -----

    describe('50% active asset reduction (Subdiv 152-C)', () => {
      it('should offer 50% reduction when basic conditions met', async () => {
        const row = makeDisposalRow({ transaction_amount: 100000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          ...baseDiv152Options,
          yearsOfOwnership: 5, // Not 15-year eligible
        })

        const reduction = result.div152Analysis!.fiftyPercentReduction
        expect(reduction.eligible).toBe(true)
        expect(reduction.reducedGain).toBeLessThan(reduction.originalGain)
      })

      it('should NOT offer reduction when basic conditions not met', async () => {
        const row = makeDisposalRow({ transaction_amount: 100000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          entityType: 'individual',
          aggregatedTurnover: 3_000_000, // Over $2M
          netAssetValue: 7_000_000, // Over $6M
          activeAssetPercentage: 90,
          yearsOfOwnership: 5,
        })

        expect(result.div152Analysis!.fiftyPercentReduction.eligible).toBe(false)
      })
    })

    // ----- Retirement exemption (Subdiv 152-D) -----

    describe('Retirement exemption ($500K cap — Subdiv 152-D)', () => {
      it('should cap retirement exemption at $500K lifetime limit', async () => {
        const row = makeDisposalRow({ transaction_amount: 800000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          ...baseDiv152Options,
          yearsOfOwnership: 5,
          priorRetirementExemptionUsed: 0,
        })

        const retirement = result.div152Analysis!.retirementExemption
        expect(retirement.eligible).toBe(true)
        expect(retirement.lifetimeCap).toBe(500_000)
        expect(retirement.amountExempt).toBeLessThanOrEqual(500_000)
      })

      it('should reduce available exemption by prior usage', async () => {
        const row = makeDisposalRow({ transaction_amount: 100000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          ...baseDiv152Options,
          yearsOfOwnership: 5,
          priorRetirementExemptionUsed: 400_000,
        })

        const retirement = result.div152Analysis!.retirementExemption
        expect(retirement.remainingCap).toBe(100_000) // 500K - 400K
      })

      it('should be ineligible when lifetime cap fully exhausted', async () => {
        const row = makeDisposalRow({ transaction_amount: 100000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          ...baseDiv152Options,
          yearsOfOwnership: 5,
          priorRetirementExemptionUsed: 500_000,
        })

        const retirement = result.div152Analysis!.retirementExemption
        expect(retirement.remainingCap).toBe(0)
        expect(retirement.eligible).toBe(false)
      })
    })

    // ----- Rollover (Subdiv 152-E) -----

    describe('Rollover availability (Subdiv 152-E)', () => {
      it('should offer rollover when basic conditions met', async () => {
        const row = makeDisposalRow({ transaction_amount: 100000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          ...baseDiv152Options,
          yearsOfOwnership: 5,
        })

        const rollover = result.div152Analysis!.rollover
        expect(rollover.available).toBe(true)
        expect(rollover.rolloverAmount).toBeGreaterThan(0)
        expect(rollover.replacementDeadline).toContain('2 years')
      })

      it('should NOT offer rollover when basic conditions not met', async () => {
        const row = makeDisposalRow({ transaction_amount: 100000 })
        mockSupabaseWith([row])

        const result = await analyzeCGT('tenant-1', 'FY2024-25', {
          entityType: 'individual',
          aggregatedTurnover: 3_000_000,
          netAssetValue: 7_000_000,
          activeAssetPercentage: 90,
          yearsOfOwnership: 5,
        })

        expect(result.div152Analysis!.rollover.available).toBe(false)
      })
    })
  })

  // =========================================================================
  // 4. Asset categorisation and loss quarantining
  // =========================================================================

  describe('Asset categorisation — loss quarantining', () => {
    it('should quarantine collectable losses (s 108-10(1))', async () => {
      const collectableGain = makeDisposalRow({
        transaction_id: 'tx-gain',
        transaction_amount: 30000,
        transaction_description: 'Sale of artwork painting',
        primary_category: 'Asset Disposal',
      })
      const collectableLoss = makeDisposalRow({
        transaction_id: 'tx-loss',
        transaction_amount: -50000,
        transaction_description: 'Sale of antique furniture collectable',
        primary_category: 'Asset Disposal',
      })
      mockSupabaseWith([collectableGain, collectableLoss])

      const result = await analyzeCGT('tenant-1', 'FY2024-25', {
        entityType: 'individual',
      })

      // Collectable losses (50000) applied against collectable gains (30000)
      expect(result.collectableGains).toBe(30000)
      expect(result.collectableLosses).toBe(50000)
      expect(result.collectableLossesApplied).toBe(30000) // min(50000, 30000)
      // Excess 20000 carried forward, NOT applied against other gains
      expect(result.collectableLossesCarriedForward).toBe(20000)
    })

    it('should completely disregard personal use asset losses (s 108-20(1))', async () => {
      const personalUseLoss = makeDisposalRow({
        transaction_id: 'tx-boat',
        transaction_amount: -25000,
        transaction_description: 'Sale of boat yacht',
        primary_category: 'Asset Disposal',
      })
      const otherGain = makeDisposalRow({
        transaction_id: 'tx-property',
        transaction_amount: 100000,
        transaction_description: 'Sale of investment asset disposal',
        primary_category: 'Asset Disposal',
      })
      mockSupabaseWith([personalUseLoss, otherGain])

      const result = await analyzeCGT('tenant-1', 'FY2024-25', {
        entityType: 'individual',
      })

      // Personal use loss is disregarded entirely
      expect(result.personalUseLossesDisregarded).toBe(25000)
      // The other gain is not reduced by personal use loss
      expect(result.totalCapitalGains).toBe(100000)
    })

    it('should classify collectable assets by keyword (jewellery, stamps, wine, etc.)', async () => {
      const jewelleryRow = makeDisposalRow({
        transaction_id: 'tx-jewellery',
        transaction_amount: 15000,
        transaction_description: 'Sale of jewellery diamond ring',
        primary_category: 'Asset Disposal',
      })
      mockSupabaseWith([jewelleryRow])

      const result = await analyzeCGT('tenant-1', 'FY2024-25', {
        entityType: 'individual',
      })

      expect(result.events[0].assetCategory).toBe('collectable')
      expect(result.events[0].assetCategoryNote).toContain('s 108-10')
    })

    it('should classify personal use assets by keyword (boat, furniture, caravan, etc.)', async () => {
      const caravanRow = makeDisposalRow({
        transaction_id: 'tx-caravan',
        transaction_amount: -8000,
        transaction_description: 'Sale of caravan',
        primary_category: 'Asset Disposal',
      })
      mockSupabaseWith([caravanRow])

      const result = await analyzeCGT('tenant-1', 'FY2024-25', {
        entityType: 'individual',
      })

      expect(result.events[0].assetCategory).toBe('personal_use')
      expect(result.events[0].assetCategoryNote).toContain('s 108-20')
    })

    it('should classify standard investment assets as "other" (no quarantining)', async () => {
      const propertyRow = makeDisposalRow({
        transaction_id: 'tx-property',
        transaction_amount: 200000,
        transaction_description: 'Disposal of commercial premises',
        primary_category: 'Asset Disposal',
      })
      mockSupabaseWith([propertyRow])

      const result = await analyzeCGT('tenant-1', 'FY2024-25', {
        entityType: 'individual',
      })

      expect(result.events[0].assetCategory).toBe('other')
    })
  })

  // =========================================================================
  // 5. Edge cases
  // =========================================================================

  describe('Edge cases', () => {
    it('should handle zero capital gains gracefully', async () => {
      const row = makeDisposalRow({ transaction_amount: 0 })
      mockSupabaseWith([row])

      const result = await analyzeCGT('tenant-1', 'FY2024-25')

      expect(result.totalCapitalGains).toBe(0)
      expect(result.totalCapitalLosses).toBe(0)
      expect(result.netCapitalGain).toBe(0)
      expect(result.taxableCapitalGain).toBe(0)
    })

    it('should handle capital loss only scenarios', async () => {
      const lossRow = makeDisposalRow({
        transaction_amount: -75000,
        transaction_description: 'Disposal of investment shares at loss',
      })
      mockSupabaseWith([lossRow])

      const result = await analyzeCGT('tenant-1', 'FY2024-25', {
        entityType: 'individual',
      })

      expect(result.totalCapitalGains).toBe(0)
      expect(result.totalCapitalLosses).toBe(75000)
      expect(result.netCapitalGain).toBe(0)
      expect(result.taxableCapitalGain).toBe(0)
      // Loss should be carried forward
      expect(result.capitalLossCarriedForward).toBe(75000)
      // Division 152 not applicable (no net gain)
      expect(result.div152Analysis).toBeNull()
    })

    it('should handle missing acquisition date (no CGT discount)', async () => {
      const row = makeDisposalRow({
        acquisition_date: undefined,
        transaction_amount: 100000,
      })
      mockSupabaseWith([row])

      const result = await analyzeCGT('tenant-1', 'FY2024-25', {
        entityType: 'individual',
      })

      // Without acquisition date, holding period = 0, no discount
      expect(result.events[0].acquisitionDate).toBe('unknown')
      expect(result.events[0].holdingPeriodMonths).toBe(0)
      expect(result.events[0].eligibleForDiscount).toBe(false)
    })

    it('should handle missing disposal date', async () => {
      const row = makeDisposalRow({
        transaction_date: undefined,
        transaction_amount: 50000,
        transaction_description: 'Asset disposal',
      })
      mockSupabaseWith([row])

      const result = await analyzeCGT('tenant-1', 'FY2024-25', {
        entityType: 'individual',
      })

      // Should still create an event, holding period 0 (unknown)
      expect(result.events[0].holdingPeriodMonths).toBe(0)
      expect(result.events[0].disposalDate).toBe('')
    })

    it('should throw error when Supabase query fails', async () => {
      mockSupabaseWith(null as any, { message: 'Database connection failed' })

      await expect(
        analyzeCGT('tenant-1', 'FY2024-25')
      ).rejects.toThrow('Failed to fetch transactions for CGT analysis')
    })

    it('should flag professional review for gains exceeding $50,000', async () => {
      const row = makeDisposalRow({ transaction_amount: 60000 })
      mockSupabaseWith([row])

      const result = await analyzeCGT('tenant-1', 'FY2024-25', {
        entityType: 'individual',
      })

      expect(result.professionalReviewRequired).toBe(true)
    })

    it('should apply prior year capital losses to reduce net gain', async () => {
      const row = makeDisposalRow({ transaction_amount: 100000 })
      mockSupabaseWith([row])

      const result = await analyzeCGT('tenant-1', 'FY2024-25', {
        entityType: 'company', // No discount
        priorYearCapitalLosses: 30000,
      })

      expect(result.priorYearCapitalLosses).toBe(30000)
      // Net gain = 100000 - 30000 = 70000 (no discount for company)
      expect(result.netCapitalGain).toBe(70000)
    })

    it('should include legislative references in the summary', async () => {
      const row = makeDisposalRow({ transaction_amount: 50000 })
      mockSupabaseWith([row])

      const result = await analyzeCGT('tenant-1', 'FY2024-25')

      expect(result.legislativeReferences).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Division 102'),
          expect.stringContaining('Division 115'),
          expect.stringContaining('Division 152'),
          expect.stringContaining('s 108-10'),
          expect.stringContaining('s 108-20'),
          expect.stringContaining('s 102-5'),
        ])
      )
    })
  })
})
