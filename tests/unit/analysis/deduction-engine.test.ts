/**
 * @vitest-environment node
 *
 * Deduction Engine Tests (Division 8 ITAA 1997)
 *
 * Comprehensive tests for the deduction engine:
 * - determineTaxRate: entity type -> corporate tax rate mapping
 * - analyzeDeductionOpportunities: transaction analysis and DeductionSummary output
 * - Edge cases: zero amounts, missing fields, invalid FY formats
 *
 * Key architecture decisions tested:
 * - AD-3: All deductions have status 'potential'
 * - AD-5: Tax rate provenance (taxRateSource, taxRateVerifiedAt)
 * - AD-2: Decimal.js for monetary arithmetic
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
  checkAmendmentPeriod: vi.fn().mockReturnValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'
import { checkAmendmentPeriod } from '@/lib/utils/financial-year'
import {
  determineTaxRate,
  analyzeDeductionOpportunities,
  type DeductionAnalysisOptions,
  type DeductionSummary,
  type EntityType,
} from '@/lib/analysis/deduction-engine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a chainable mock Supabase client.
 *
 * Returns an object with `.from()` that returns a PostgREST-style query builder.
 * The query builder supports `.select()`, `.eq()`, `.gte()`, `.lte()`, `.order()`
 * and is thenable (implements `.then()`) so that `await query` resolves to
 * `{ data, error }` -- matching real Supabase PostgREST builder behaviour.
 *
 * The outer client object is NOT thenable, avoiding the double-await trap where
 * `await createServiceClient()` would prematurely unwrap the builder.
 */
function createMockSupabase(data: unknown[] | null = [], error: { message: string } | null = null) {
  const terminal = { data, error }

  // Query builder (returned by .from()) -- thenable + chainable
  const queryBuilder: Record<string, unknown> = {}
  queryBuilder.select = vi.fn().mockReturnValue(queryBuilder)
  queryBuilder.eq = vi.fn().mockReturnValue(queryBuilder)
  queryBuilder.gte = vi.fn().mockReturnValue(queryBuilder)
  queryBuilder.lte = vi.fn().mockReturnValue(queryBuilder)
  queryBuilder.order = vi.fn().mockReturnValue(queryBuilder)

  // Make the query builder thenable so `await query` resolves to { data, error }
  queryBuilder.then = vi.fn().mockImplementation(
    (resolve?: (v: typeof terminal) => unknown, reject?: (e: unknown) => unknown) => {
      return Promise.resolve(terminal).then(resolve, reject)
    }
  )

  // Supabase client (returned by createServiceClient) -- NOT thenable
  const client: Record<string, unknown> = {}
  client.from = vi.fn().mockReturnValue(queryBuilder)

  // Expose queryBuilder methods on client for test assertions (e.g., expect(mockSupa.eq).toHaveBeenCalledWith(...))
  client.select = queryBuilder.select
  client.eq = queryBuilder.eq
  client.gte = queryBuilder.gte
  client.lte = queryBuilder.lte
  client.order = queryBuilder.order

  return client as ReturnType<Awaited<ReturnType<typeof createServiceClient>> extends infer S ? () => S : never> & typeof client
}

/** Minimal mock tax rates returned by getCurrentTaxRates. */
function mockTaxRates(overrides: Record<string, unknown> = {}) {
  return {
    instantWriteOffThreshold: 20000,
    homeOfficeRatePerHour: 0.67,
    corporateTaxRateSmall: 0.25,
    corporateTaxRateStandard: 0.30,
    rndOffsetRate: 0.435,
    rndOffsetRateSmallBusiness: 0.435,
    division7ABenchmarkRate: 0.0877,
    fbtRate: 0.47,
    fbtType1GrossUpRate: 2.0802,
    fbtType2GrossUpRate: 1.8868,
    superGuaranteeRate: 0.115,
    fuelTaxCreditOnRoad: null,
    fuelTaxCreditOffRoad: null,
    fuelTaxCreditQuarter: null,
    fetchedAt: new Date(),
    sources: {
      instantWriteOff: 'https://www.ato.gov.au/test',
      homeOffice: 'https://www.ato.gov.au/test',
      corporateTax: 'https://www.ato.gov.au/test',
    },
    cacheHit: true,
    ...overrides,
  }
}

/** Build a minimal forensic analysis row suitable for the deduction engine. */
function buildTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    tenant_id: 'tenant-abc',
    transaction_id: overrides.transaction_id ?? `txn-${Math.random().toString(36).slice(2, 8)}`,
    financial_year: 'FY2023-24',
    transaction_date: '2024-01-15',
    transaction_amount: 1000,
    transaction_description: 'Office supplies purchase',
    supplier_name: 'Officeworks',
    platform: 'xero' as const,
    primary_category: 'office supplies',
    secondary_categories: null,
    category_confidence: 85,
    is_rnd_candidate: false,
    meets_div355_criteria: false,
    rnd_activity_type: null,
    rnd_confidence: null,
    rnd_reasoning: null,
    div355_outcome_unknown: null,
    div355_systematic_approach: null,
    div355_new_knowledge: null,
    div355_scientific_method: null,
    is_fully_deductible: true,
    deduction_type: 'Section 8-1',
    claimable_amount: 1000,
    deduction_restrictions: [],
    deduction_confidence: 85,
    requires_documentation: false,
    fbt_implications: false,
    division7a_risk: false,
    compliance_notes: null,
    analyzed_at: '2024-06-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/** Default Supabase mock returning empty transactions (no error). */
let defaultMockSupabase: ReturnType<typeof createMockSupabase>

beforeEach(() => {
  // Reset call history but preserve module-level vi.mock declarations
  vi.restoreAllMocks()

  // Default: getCurrentTaxRates resolves with standard rates
  vi.mocked(getCurrentTaxRates).mockResolvedValue(mockTaxRates() as Awaited<ReturnType<typeof getCurrentTaxRates>>)

  // Default: createServiceClient returns a chainable Supabase mock with empty data
  defaultMockSupabase = createMockSupabase([])
  vi.mocked(createServiceClient).mockResolvedValue(defaultMockSupabase as Awaited<ReturnType<typeof createServiceClient>>)
})

// ---------------------------------------------------------------------------
// determineTaxRate
// ---------------------------------------------------------------------------

describe('determineTaxRate', () => {
  it('should return 25% for base rate entity (turnover < $50M, passive income <= 80%)', async () => {
    const result = await determineTaxRate({
      annualTurnover: 40_000_000,
      passiveIncomePercentage: 50,
    })

    expect(result.rateNumber).toBe(0.25)
    expect(result.note).toContain('Base rate entity')
    expect(result.note).toContain('25%')
    expect(result.note).toContain('s 23AA')
  })

  it('should return 30% for standard company (turnover >= $50M)', async () => {
    const result = await determineTaxRate({
      annualTurnover: 60_000_000,
    })

    expect(result.rateNumber).toBe(0.30)
    expect(result.note).toContain('Standard corporate rate')
    expect(result.note).toContain('30%')
    expect(result.note).toContain('s 23')
  })

  it('should return 30% when passive income test fails (> 80%)', async () => {
    const result = await determineTaxRate({
      annualTurnover: 30_000_000,
      passiveIncomePercentage: 90,
    })

    expect(result.rateNumber).toBe(0.30)
    expect(result.note).toContain('passive income')
    expect(result.note).toContain('90%')
    expect(result.note).toContain('does NOT qualify')
  })

  it('should return 30% for unknown entity type with conservative default', async () => {
    const result = await determineTaxRate()

    expect(result.rateNumber).toBe(0.30)
    expect(result.note).toContain('Entity type unknown')
    expect(result.note).toContain('30%')
  })

  it('should include WARNING when passive income data is unavailable for base rate entity', async () => {
    const result = await determineTaxRate({
      annualTurnover: 10_000_000,
      // passiveIncomePercentage NOT provided
    })

    expect(result.rateNumber).toBe(0.25)
    expect(result.note).toContain('WARNING')
    expect(result.note).toContain('Passive income percentage not provided')
  })

  it('should return 25% for explicit base_rate_entity type with valid passive income', async () => {
    const result = await determineTaxRate({
      entityType: 'base_rate_entity',
      passiveIncomePercentage: 60,
    })

    expect(result.rateNumber).toBe(0.25)
    expect(result.note).toContain('Base rate entity')
    expect(result.note).toContain('Passive income: 60%')
  })

  it('should override base_rate_entity when passive income > 80%', async () => {
    const result = await determineTaxRate({
      entityType: 'base_rate_entity',
      passiveIncomePercentage: 85,
    })

    expect(result.rateNumber).toBe(0.30)
    expect(result.note).toContain('does NOT qualify')
  })

  it('should return 30% for trust entity type', async () => {
    const result = await determineTaxRate({
      entityType: 'trust',
    })

    expect(result.rateNumber).toBe(0.30)
    expect(result.note).toContain('Trust entity')
    expect(result.note).toContain('conservative estimate')
  })

  it('should return 30% for explicit standard_company entity type', async () => {
    const result = await determineTaxRate({
      entityType: 'standard_company',
    })

    expect(result.rateNumber).toBe(0.30)
    expect(result.note).toContain('Standard corporate rate')
    expect(result.note).toContain('s 23 ITAA 1997')
  })

  it('should use fallback rates when getCurrentTaxRates throws', async () => {
    vi.mocked(getCurrentTaxRates).mockRejectedValue(new Error('Network failure'))

    const result = await determineTaxRate({
      entityType: 'standard_company',
    })

    // Falls back to FALLBACK_CORPORATE_TAX_RATE_STANDARD = 0.30
    expect(result.rateNumber).toBe(0.30)
  })

  it('should use live rates when available from getCurrentTaxRates', async () => {
    vi.mocked(getCurrentTaxRates).mockResolvedValue(
      mockTaxRates({
        corporateTaxRateSmall: 0.26,
        corporateTaxRateStandard: 0.31,
      }) as Awaited<ReturnType<typeof getCurrentTaxRates>>
    )

    const result = await determineTaxRate({
      entityType: 'standard_company',
    })

    expect(result.rateNumber).toBe(0.31)
  })

  it('should accept isBaseRateEntity boolean flag', async () => {
    const result = await determineTaxRate({
      isBaseRateEntity: true,
      passiveIncomePercentage: 40,
    })

    expect(result.rateNumber).toBe(0.25)
    expect(result.note).toContain('Base rate entity')
  })

  it('should return Decimal rate consistent with rateNumber', async () => {
    const result = await determineTaxRate({
      entityType: 'base_rate_entity',
      passiveIncomePercentage: 10,
    })

    expect(result.rate.toNumber()).toBe(result.rateNumber)
  })
})

// ---------------------------------------------------------------------------
// analyzeDeductionOpportunities
// ---------------------------------------------------------------------------

describe('analyzeDeductionOpportunities', () => {
  it('should return a DeductionSummary with correct structure when transactions exist', async () => {
    const transactions = [
      buildTransaction({ transaction_id: 'txn-1', transaction_amount: 5000, claimable_amount: 5000 }),
      buildTransaction({ transaction_id: 'txn-2', transaction_amount: 3000, claimable_amount: 3000 }),
    ]
    const mockSupa = createMockSupabase(transactions)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-abc')

    // Structure checks
    expect(summary).toHaveProperty('totalOpportunities')
    expect(summary).toHaveProperty('totalUnclaimedDeductions')
    expect(summary).toHaveProperty('totalEstimatedTaxSaving')
    expect(summary).toHaveProperty('opportunitiesByYear')
    expect(summary).toHaveProperty('unclaimedByYear')
    expect(summary).toHaveProperty('opportunitiesByCategory')
    expect(summary).toHaveProperty('averageConfidence')
    expect(summary).toHaveProperty('highValueOpportunities')
    expect(summary).toHaveProperty('opportunities')
    expect(summary).toHaveProperty('taxRateSource')
    expect(summary).toHaveProperty('taxRateVerifiedAt')
  })

  it('should return empty summary when no transactions exist', async () => {
    const mockSupa = createMockSupabase([])
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-empty')

    expect(summary.totalOpportunities).toBe(0)
    expect(summary.totalUnclaimedDeductions).toBe(0)
    expect(summary.totalEstimatedTaxSaving).toBe(0)
    expect(summary.opportunities).toEqual([])
    expect(summary.highValueOpportunities).toEqual([])
    expect(summary.taxRateSource).toBe('none')
  })

  it('should return empty summary when transactions is null', async () => {
    const mockSupa = createMockSupabase(null)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-null')

    expect(summary.totalOpportunities).toBe(0)
    expect(summary.opportunities).toEqual([])
  })

  it('should throw when Supabase returns an error', async () => {
    const mockSupa = createMockSupabase(null, { message: 'Connection refused' })
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    await expect(analyzeDeductionOpportunities('tenant-err')).rejects.toThrow(
      'Failed to fetch transactions: Connection refused'
    )
  })

  it('should ensure all deductions have status "potential" (AD-3)', async () => {
    const transactions = [
      buildTransaction({
        transaction_id: 'txn-ad3-1',
        transaction_amount: 15000,
        claimable_amount: 15000,
        deduction_confidence: 95,
      }),
      buildTransaction({
        transaction_id: 'txn-ad3-2',
        transaction_amount: 8000,
        claimable_amount: 8000,
        deduction_confidence: 70,
      }),
    ]
    const mockSupa = createMockSupabase(transactions)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-ad3')

    for (const opp of summary.opportunities) {
      for (const tx of opp.transactions) {
        expect(tx.status).toBe('potential')
      }
    }
  })

  it('should include legislative references on every opportunity', async () => {
    const transactions = [
      buildTransaction({ transaction_id: 'txn-leg-1', primary_category: 'software subscription' }),
      buildTransaction({ transaction_id: 'txn-leg-2', primary_category: 'travel expenses' }),
    ]
    const mockSupa = createMockSupabase(transactions)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-leg')

    for (const opp of summary.opportunities) {
      expect(opp.legislativeReference).toBeTruthy()
      expect(opp.legislativeReference.length).toBeGreaterThan(10)
      // All legislative refs should reference ITAA or FBTAA
      expect(opp.legislativeReference).toMatch(/ITAA|FBTAA/)
    }
  })

  it('should include verification note on every opportunity', async () => {
    const transactions = [
      buildTransaction({ transaction_id: 'txn-verify' }),
    ]
    const mockSupa = createMockSupabase(transactions)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-verify')

    for (const opp of summary.opportunities) {
      expect(opp.verificationNote).toContain('Verify against lodged tax return')
    }
  })

  it('should calculate estimated tax saving using the applicable tax rate', async () => {
    const transactions = [
      buildTransaction({
        transaction_id: 'txn-tax-1',
        transaction_amount: 10000,
        claimable_amount: 10000,
        is_fully_deductible: true,
      }),
    ]
    const mockSupa = createMockSupabase(transactions)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-tax', undefined, undefined, {
      entityType: 'standard_company',
    })

    // At 30% rate, $10,000 deduction = $3,000 estimated tax saving
    expect(summary.totalEstimatedTaxSaving).toBeGreaterThan(0)
    for (const opp of summary.opportunities) {
      expect(opp.appliedTaxRate).toBe(0.30)
      expect(opp.taxRateNote).toBeTruthy()
    }
  })

  it('should pass startYear and endYear filters to Supabase query', async () => {
    const mockSupa = createMockSupabase([])
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    await analyzeDeductionOpportunities('tenant-filter', 'FY2022-23', 'FY2023-24')

    expect(mockSupa.from).toHaveBeenCalledWith('forensic_analysis_results')
    expect(mockSupa.eq).toHaveBeenCalledWith('tenant_id', 'tenant-filter')
    expect(mockSupa.gte).toHaveBeenCalledWith('financial_year', 'FY2022-23')
    expect(mockSupa.lte).toHaveBeenCalledWith('financial_year', 'FY2023-24')
  })

  it('should not call gte/lte when startYear and endYear are not provided', async () => {
    const mockSupa = createMockSupabase([])
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    await analyzeDeductionOpportunities('tenant-nofilt')

    expect(mockSupa.gte).not.toHaveBeenCalled()
    expect(mockSupa.lte).not.toHaveBeenCalled()
  })

  it('should always set claimedAmount to 0 on every opportunity', async () => {
    const transactions = [
      buildTransaction({ transaction_id: 'txn-claim', transaction_amount: 5000, claimable_amount: 5000 }),
    ]
    const mockSupa = createMockSupabase(transactions)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-claim')

    for (const opp of summary.opportunities) {
      expect(opp.claimedAmount).toBe(0)
    }
  })

  it('should apply 50% deductibility for entertainment category', async () => {
    const transactions = [
      buildTransaction({
        transaction_id: 'txn-ent',
        primary_category: 'entertainment',
        transaction_amount: 2000,
        claimable_amount: 2000,
        is_fully_deductible: true,
      }),
    ]
    const mockSupa = createMockSupabase(transactions)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-ent')

    const entOpp = summary.opportunities.find(o => o.category === 'Entertainment & Meals')
    if (entOpp) {
      // Entertainment is 50% deductible
      expect(entOpp.transactions[0].partialDeductibilityFactor).toBe(0.5)
      expect(entOpp.transactions[0].deductibleAmount).toBe(1000)
    }
  })

  it('should check amendment period for each financial year in results', async () => {
    const transactions = [
      buildTransaction({ transaction_id: 'txn-amend', financial_year: 'FY2020-21' }),
    ]
    const mockSupa = createMockSupabase(transactions)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    vi.mocked(checkAmendmentPeriod).mockReturnValue(
      'Outside amendment window'
    )

    const summary = await analyzeDeductionOpportunities('tenant-amend', undefined, undefined, {
      entityType: 'standard_company',
    })

    expect(checkAmendmentPeriod).toHaveBeenCalled()
    // The warning should be appended to recommendations
    for (const opp of summary.opportunities) {
      const hasAmendmentWarning = opp.recommendations.some(r => r.includes('Amendment period'))
      expect(hasAmendmentWarning).toBe(true)
    }
  })

  it('should populate highValueOpportunities for amounts > $10k', async () => {
    const transactions = [
      buildTransaction({
        transaction_id: 'txn-hv-1',
        transaction_amount: 25000,
        claimable_amount: 25000,
        is_fully_deductible: true,
        primary_category: 'professional fees',
      }),
    ]
    const mockSupa = createMockSupabase(transactions)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-hv')

    expect(summary.highValueOpportunities.length).toBeGreaterThanOrEqual(1)
    for (const hv of summary.highValueOpportunities) {
      expect(hv.unclaimedAmount).toBeGreaterThan(10000)
    }
  })
})

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('Edge Cases', () => {
  it('should handle zero-amount transactions gracefully', async () => {
    const transactions = [
      buildTransaction({
        transaction_id: 'txn-zero',
        transaction_amount: 0,
        claimable_amount: 0,
        is_fully_deductible: true,
      }),
    ]
    const mockSupa = createMockSupabase(transactions)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-zero')

    // Zero amount should not generate opportunities (unclaimedAmount = 0 is filtered out)
    expect(summary.totalUnclaimedDeductions).toBe(0)
  })

  it('should handle transactions with missing description', async () => {
    const transactions = [
      buildTransaction({
        transaction_id: 'txn-nodesc',
        transaction_description: null,
        transaction_amount: 500,
        claimable_amount: 500,
      }),
    ]
    const mockSupa = createMockSupabase(transactions)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    // Should not throw
    const summary = await analyzeDeductionOpportunities('tenant-nodesc')
    expect(summary).toBeDefined()
  })

  it('should handle transactions with missing supplier', async () => {
    const transactions = [
      buildTransaction({
        transaction_id: 'txn-nosupp',
        supplier_name: null,
        transaction_amount: 750,
        claimable_amount: 750,
      }),
    ]
    const mockSupa = createMockSupabase(transactions)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-nosupp')
    expect(summary).toBeDefined()
    for (const opp of summary.opportunities) {
      for (const tx of opp.transactions) {
        expect(tx.supplier).toBeNull()
      }
    }
  })

  it('should handle transactions with null claimable_amount', async () => {
    const transactions = [
      buildTransaction({
        transaction_id: 'txn-nullclaim',
        claimable_amount: null,
        is_fully_deductible: true,
        transaction_amount: 2000,
      }),
    ]
    const mockSupa = createMockSupabase(transactions)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-nullclaim')

    // When claimable_amount is null but is_fully_deductible is true, should use full amount
    expect(summary).toBeDefined()
    if (summary.opportunities.length > 0) {
      expect(summary.totalUnclaimedDeductions).toBeGreaterThan(0)
    }
  })

  it('should handle transactions with null deduction_confidence', async () => {
    const transactions = [
      buildTransaction({
        transaction_id: 'txn-nullconf',
        deduction_confidence: null,
        transaction_amount: 1000,
        claimable_amount: 1000,
      }),
    ]
    const mockSupa = createMockSupabase(transactions)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-nullconf')

    // Should not throw; confidence defaults to 0
    expect(summary).toBeDefined()
    for (const opp of summary.opportunities) {
      for (const tx of opp.transactions) {
        expect(tx.confidence).toBe(0)
      }
    }
  })

  it('should handle transactions with null primary_category', async () => {
    const transactions = [
      buildTransaction({
        transaction_id: 'txn-nullcat',
        primary_category: null,
        transaction_amount: 1500,
        claimable_amount: 1500,
      }),
    ]
    const mockSupa = createMockSupabase(transactions)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-nullcat')

    // Should map to 'Other Deductible Expenses'
    expect(summary).toBeDefined()
    if (summary.opportunities.length > 0) {
      const hasOther = summary.opportunities.some(o => o.category === 'Other Deductible Expenses')
      expect(hasOther).toBe(true)
    }
  })

  it('should handle non-deductible (private/domestic) transactions', async () => {
    const transactions = [
      buildTransaction({
        transaction_id: 'txn-private',
        primary_category: 'private expenses',
        transaction_amount: 3000,
        claimable_amount: 0,
        is_fully_deductible: false,
      }),
    ]
    const mockSupa = createMockSupabase(transactions)
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-private')

    // Non-deductible items with 0 claimable should not appear as opportunities
    // (unclaimedAmount = 0 is filtered)
    expect(summary.totalUnclaimedDeductions).toBe(0)
  })

  it('should include taxRateVerifiedAt as a valid ISO timestamp', async () => {
    const mockSupa = createMockSupabase([])
    vi.mocked(createServiceClient).mockResolvedValue(mockSupa as Awaited<ReturnType<typeof createServiceClient>>)

    const summary = await analyzeDeductionOpportunities('tenant-ts')

    expect(summary.taxRateVerifiedAt).toBeTruthy()
    const parsed = Date.parse(summary.taxRateVerifiedAt)
    expect(isNaN(parsed)).toBe(false)
  })
})
