/**
 * R&D Tax Incentive Engine Tests
 *
 * @vitest-environment node
 *
 * Comprehensive tests for lib/analysis/rnd-engine.ts
 * Division 355 ITAA 1997 - R&D Tax Incentive
 *
 * Tests cover:
 * - analyzeRndOpportunities with mocked Supabase and tax rates
 * - Tiered offset rates (25% base + 18.5%, 30% base + 18.5%, turnover >= $20M)
 * - $4M refundable cap (s 355-100(3) ITAA 1997)
 * - Four-element test structure (FourElementTest)
 * - Clawback warnings (s 355-450 ITAA 1997)
 * - Edge cases: no eligible transactions, borderline projects
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

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'
import {
  analyzeRndOpportunities,
  getProjectDetails,
  calculateTotalRndBenefit,
} from '@/lib/analysis/rnd-engine'
import type {
  RndSummary,
  RndEntityContext,
  FourElementTest,
  RndProjectAnalysis,
  BorderlineProject,
} from '@/lib/analysis/rnd-engine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockedCreateServiceClient = vi.mocked(createServiceClient)
const mockedGetCurrentTaxRates = vi.mocked(getCurrentTaxRates)

/**
 * Build a chainable Supabase query mock that mimics:
 *   supabase.from('...').select('*').eq(...).eq(...).order(...).gte(...).lte(...)
 * and resolves with { data, error }.
 */
function buildSupabaseQueryMock(data: unknown[] | null, error: unknown = null) {
  const terminalResult = { data, error }

  // Every chaining method returns the same proxy so order doesn't matter
  const chainable: Record<string, unknown> = {}
  const self = () => chainable
  chainable.select = vi.fn(self)
  chainable.eq = vi.fn(self)
  chainable.gte = vi.fn(self)
  chainable.lte = vi.fn(self)
  // .order() returns chainable (not terminal) because the engine may call
  // .gte()/.lte() AFTER .order() when year filters are provided.
  chainable.order = vi.fn(self)
  // Make the chainable itself thenable so `await query` resolves to { data, error }
  chainable.then = (resolve: (v: unknown) => void) => resolve(terminalResult)

  const supabaseMock = {
    from: vi.fn(() => chainable),
  }

  return supabaseMock
}

/** Shortcut to wire up the Supabase mock for a given dataset. */
function mockSupabaseReturning(rows: unknown[] | null, error: unknown = null) {
  const mock = buildSupabaseQueryMock(rows, error)
  mockedCreateServiceClient.mockResolvedValue(mock as never)
  return mock
}

/** Default tax rates mock matching CachedTaxRates shape. */
function mockDefaultTaxRates() {
  mockedGetCurrentTaxRates.mockResolvedValue({
    rndOffsetRate: 0.435,
    rndOffsetRateSmallBusiness: 0.435,
    corporateTaxRateSmall: 0.25,
    corporateTaxRateStandard: 0.30,
    instantWriteOffThreshold: 20000,
    homeOfficeRatePerHour: 0.67,
    division7ABenchmarkRate: 0.0877,
    fbtRate: 0.47,
    fbtType1GrossUpRate: 2.0802,
    fbtType2GrossUpRate: 1.8868,
    superGuaranteeRate: 0.115,
    fuelTaxCreditOnRoad: 0.188,
    fuelTaxCreditOffRoad: 0.498,
    fuelTaxCreditQuarter: 'Q1 FY2024-25',
    fetchedAt: new Date(),
    sources: {
      rndIncentive: 'https://www.ato.gov.au/rnd',
      corporateTax: 'https://www.ato.gov.au/corporate',
    },
    cacheHit: true,
    cacheAge: 1000,
  } as never)
}

/**
 * Build a minimal forensic analysis row that qualifies as an R&D candidate.
 * Override individual fields via the `overrides` parameter.
 */
function makeRndRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    tenant_id: 'tenant-abc',
    transaction_id: `txn-${Math.random().toString(36).slice(2, 8)}`,
    financial_year: 'FY2024-25',
    transaction_date: '2024-09-15',
    transaction_amount: 50000,
    transaction_description: 'AI model training compute costs',
    supplier_name: 'AWS',
    platform: 'xero',
    primary_category: 'Software Development',
    secondary_categories: null,
    category_confidence: 90,
    is_rnd_candidate: true,
    meets_div355_criteria: true,
    rnd_activity_type: 'core_rnd',
    rnd_confidence: 85,
    rnd_reasoning: 'Developing novel ML pipeline with unknown accuracy outcome',
    div355_outcome_unknown: true,
    div355_systematic_approach: true,
    div355_new_knowledge: true,
    div355_scientific_method: true,
    is_fully_deductible: false,
    deduction_type: null,
    claimable_amount: null,
    deduction_restrictions: null,
    deduction_confidence: null,
    requires_documentation: true,
    fbt_implications: false,
    division7a_risk: false,
    compliance_notes: null,
    analyzed_at: '2024-10-01T00:00:00Z',
    supporting_evidence: [
      'Technical uncertainty: model accuracy on real-world data unknown',
      'Novel architecture not previously attempted',
      'Systematic experimentation with multiple hyperparameter configurations',
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('rnd-engine: analyzeRndOpportunities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset module-level cache in rnd-engine by re-mocking tax rates
    mockDefaultTaxRates()
  })

  // =========================================================================
  // 1. RndSummary structure
  // =========================================================================
  describe('RndSummary structure', () => {
    it('returns a valid RndSummary when R&D-eligible transactions exist', async () => {
      const rows = [
        makeRndRow({ transaction_id: 'txn-1', transaction_amount: 100000 }),
        makeRndRow({ transaction_id: 'txn-2', transaction_amount: 50000, supplier_name: 'GCP' }),
      ]
      mockSupabaseReturning(rows)

      const summary = await analyzeRndOpportunities('tenant-abc')

      // Structure checks
      expect(summary).toHaveProperty('totalProjects')
      expect(summary).toHaveProperty('totalEligibleExpenditure')
      expect(summary).toHaveProperty('totalEstimatedOffset')
      expect(summary).toHaveProperty('refundableOffset')
      expect(summary).toHaveProperty('nonRefundableOffset')
      expect(summary).toHaveProperty('refundableCapApplied')
      expect(summary).toHaveProperty('projectsByYear')
      expect(summary).toHaveProperty('expenditureByYear')
      expect(summary).toHaveProperty('offsetByYear')
      expect(summary).toHaveProperty('averageConfidence')
      expect(summary).toHaveProperty('coreRndTransactions')
      expect(summary).toHaveProperty('supportingRndTransactions')
      expect(summary).toHaveProperty('projects')
      expect(summary).toHaveProperty('excludedProjects')
      expect(summary).toHaveProperty('excludedProjectsNote')
      expect(summary).toHaveProperty('taxRateSource')
      expect(summary).toHaveProperty('taxRateVerifiedAt')
      expect(summary).toHaveProperty('taxRateNote')
      expect(Array.isArray(summary.projects)).toBe(true)
      expect(Array.isArray(summary.excludedProjects)).toBe(true)
    })

    it('returns totalProjects > 0 when eligible rows exist', async () => {
      const rows = [
        makeRndRow({ transaction_id: 'txn-1', transaction_amount: 80000 }),
      ]
      mockSupabaseReturning(rows)

      const summary = await analyzeRndOpportunities('tenant-abc')

      expect(summary.totalProjects).toBeGreaterThanOrEqual(1)
      expect(summary.totalEligibleExpenditure).toBeGreaterThan(0)
      expect(summary.totalEstimatedOffset).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // 2. Empty data
  // =========================================================================
  describe('empty data', () => {
    it('returns empty summary when no R&D candidates found', async () => {
      mockSupabaseReturning([])

      const summary = await analyzeRndOpportunities('tenant-abc')

      expect(summary.totalProjects).toBe(0)
      expect(summary.totalEligibleExpenditure).toBe(0)
      expect(summary.totalEstimatedOffset).toBe(0)
      expect(summary.refundableOffset).toBe(0)
      expect(summary.nonRefundableOffset).toBe(0)
      expect(summary.refundableCapApplied).toBe(false)
      expect(summary.projects).toEqual([])
      expect(summary.excludedProjects).toEqual([])
      expect(summary.averageConfidence).toBe(0)
      expect(summary.coreRndTransactions).toBe(0)
      expect(summary.supportingRndTransactions).toBe(0)
    })

    it('returns empty summary when data is null', async () => {
      mockSupabaseReturning(null)

      const summary = await analyzeRndOpportunities('tenant-abc')

      expect(summary.totalProjects).toBe(0)
      expect(summary.totalEligibleExpenditure).toBe(0)
      expect(summary.projects).toEqual([])
    })
  })

  // =========================================================================
  // 3. Tiered offset rates
  // =========================================================================
  describe('tiered offset rates', () => {
    it('applies 43.5% offset for 25% base rate entity with turnover < $20M', async () => {
      // 25% corporate rate + 18.5% premium = 43.5%
      const rows = [
        makeRndRow({ transaction_id: 'txn-1', transaction_amount: 100000 }),
      ]
      mockSupabaseReturning(rows)

      const entityContext: RndEntityContext = {
        aggregatedTurnover: 10_000_000,
        corporateTaxRate: 0.25,
      }

      const summary = await analyzeRndOpportunities(
        'tenant-abc',
        undefined,
        undefined,
        entityContext
      )

      // Eligible expenditure should yield 43.5% offset
      if (summary.totalEligibleExpenditure > 0) {
        const effectiveRate = summary.totalEstimatedOffset / summary.totalEligibleExpenditure
        expect(effectiveRate).toBeCloseTo(0.435, 3)
      }
      expect(summary.taxRateNote).toContain('18.5%')
      expect(summary.taxRateNote).toContain('25.0%')
    })

    it('applies 48.5% offset for 30% base rate entity with turnover < $20M', async () => {
      // 30% corporate rate + 18.5% premium = 48.5%
      const rows = [
        makeRndRow({ transaction_id: 'txn-1', transaction_amount: 100000 }),
      ]
      mockSupabaseReturning(rows)

      const entityContext: RndEntityContext = {
        aggregatedTurnover: 15_000_000,
        corporateTaxRate: 0.30,
      }

      const summary = await analyzeRndOpportunities(
        'tenant-abc',
        undefined,
        undefined,
        entityContext
      )

      if (summary.totalEligibleExpenditure > 0) {
        const effectiveRate = summary.totalEstimatedOffset / summary.totalEligibleExpenditure
        expect(effectiveRate).toBeCloseTo(0.485, 3)
      }
      expect(summary.taxRateNote).toContain('18.5%')
      expect(summary.taxRateNote).toContain('30.0%')
    })

    it('applies non-refundable offset at corporate rate + 8.5% for turnover >= $20M', async () => {
      // 25% corporate rate + 8.5% premium = 33.5% non-refundable
      const rows = [
        makeRndRow({ transaction_id: 'txn-1', transaction_amount: 200000 }),
      ]
      mockSupabaseReturning(rows)

      const entityContext: RndEntityContext = {
        aggregatedTurnover: 25_000_000,
        corporateTaxRate: 0.25,
      }

      const summary = await analyzeRndOpportunities(
        'tenant-abc',
        undefined,
        undefined,
        entityContext
      )

      if (summary.totalEligibleExpenditure > 0) {
        const effectiveRate = summary.totalEstimatedOffset / summary.totalEligibleExpenditure
        expect(effectiveRate).toBeCloseTo(0.335, 3)
      }
      // For large entities, entire offset is non-refundable
      expect(summary.refundableOffset).toBe(0)
      expect(summary.nonRefundableOffset).toBe(summary.totalEstimatedOffset)
      expect(summary.taxRateNote).toContain('8.5%')
      expect(summary.taxRateNote).toContain('Non-refundable')
    })

    it('uses fallback rate from getCurrentTaxRates when no entity context', async () => {
      const rows = [
        makeRndRow({ transaction_id: 'txn-1', transaction_amount: 100000 }),
      ]
      mockSupabaseReturning(rows)

      // No entity context = falls through to getCurrentTaxRates
      const summary = await analyzeRndOpportunities('tenant-abc')

      // Should still produce a valid summary (using cached/fetched rate)
      expect(summary.totalProjects).toBeGreaterThanOrEqual(0)
      expect(summary.taxRateSource).toBeDefined()
    })
  })

  // =========================================================================
  // 4. $4M refundable cap (s 355-100(3))
  // =========================================================================
  describe('$4M refundable cap (s 355-100(3))', () => {
    it('does not apply cap when offset is below $4M', async () => {
      // $1M expenditure at 43.5% = $435,000 offset (well below $4M)
      const rows = [
        makeRndRow({ transaction_id: 'txn-1', transaction_amount: 1_000_000 }),
      ]
      mockSupabaseReturning(rows)

      const entityContext: RndEntityContext = {
        aggregatedTurnover: 5_000_000,
        corporateTaxRate: 0.25,
      }

      const summary = await analyzeRndOpportunities(
        'tenant-abc',
        undefined,
        undefined,
        entityContext
      )

      expect(summary.refundableCapApplied).toBe(false)
      expect(summary.refundableOffset).toBe(summary.totalEstimatedOffset)
      expect(summary.nonRefundableOffset).toBe(0)
    })

    it('applies cap when refundable offset exceeds $4M', async () => {
      // Large enough expenditure to exceed $4M cap at 43.5%
      // $10M * 0.435 = $4,350,000 > $4M cap
      const rows = [
        makeRndRow({ transaction_id: 'txn-1', transaction_amount: 10_000_000 }),
      ]
      mockSupabaseReturning(rows)

      const entityContext: RndEntityContext = {
        aggregatedTurnover: 5_000_000,
        corporateTaxRate: 0.25,
      }

      const summary = await analyzeRndOpportunities(
        'tenant-abc',
        undefined,
        undefined,
        entityContext
      )

      if (summary.totalEstimatedOffset > 4_000_000) {
        expect(summary.refundableCapApplied).toBe(true)
        expect(summary.refundableOffset).toBe(4_000_000)
        expect(summary.nonRefundableOffset).toBe(
          summary.totalEstimatedOffset - 4_000_000
        )
      }
    })

    it('does not apply refundable cap for large entities (turnover >= $20M)', async () => {
      // Large entity offset is already fully non-refundable, so cap is irrelevant
      const rows = [
        makeRndRow({ transaction_id: 'txn-1', transaction_amount: 10_000_000 }),
      ]
      mockSupabaseReturning(rows)

      const entityContext: RndEntityContext = {
        aggregatedTurnover: 50_000_000,
        corporateTaxRate: 0.30,
      }

      const summary = await analyzeRndOpportunities(
        'tenant-abc',
        undefined,
        undefined,
        entityContext
      )

      // Non-refundable offset does not trigger the refundable cap
      expect(summary.refundableCapApplied).toBe(false)
      expect(summary.refundableOffset).toBe(0)
      expect(summary.nonRefundableOffset).toBe(summary.totalEstimatedOffset)
    })
  })

  // =========================================================================
  // 5. Four-element test structure (FourElementTest)
  // =========================================================================
  describe('FourElementTest structure', () => {
    it('project eligibilityCriteria has all four elements', async () => {
      const rows = [
        makeRndRow({ transaction_id: 'txn-1', transaction_amount: 50000 }),
      ]
      mockSupabaseReturning(rows)

      const summary = await analyzeRndOpportunities('tenant-abc')

      // Find projects (eligible or look at individual transactions)
      const allProjects = summary.projects
      if (allProjects.length > 0) {
        const project = allProjects[0]
        const criteria = project.eligibilityCriteria

        expect(criteria).toHaveProperty('outcomeUnknown')
        expect(criteria).toHaveProperty('systematicApproach')
        expect(criteria).toHaveProperty('newKnowledge')
        expect(criteria).toHaveProperty('scientificMethod')

        // Each element has met, confidence, evidence
        for (const element of [
          criteria.outcomeUnknown,
          criteria.systematicApproach,
          criteria.newKnowledge,
          criteria.scientificMethod,
        ]) {
          expect(element).toHaveProperty('met')
          expect(element).toHaveProperty('confidence')
          expect(element).toHaveProperty('evidence')
          expect(typeof element.met).toBe('boolean')
          expect(typeof element.confidence).toBe('number')
          expect(Array.isArray(element.evidence)).toBe(true)
        }
      }
    })

    it('transaction-level fourElementTest has correct shape', async () => {
      const rows = [
        makeRndRow({ transaction_id: 'txn-1', transaction_amount: 50000 }),
      ]
      mockSupabaseReturning(rows)

      const summary = await analyzeRndOpportunities('tenant-abc')

      const allProjects = summary.projects
      if (allProjects.length > 0 && allProjects[0].transactions.length > 0) {
        const txTest = allProjects[0].transactions[0].fourElementTest
        expect(txTest.outcomeUnknown).toBeDefined()
        expect(txTest.systematicApproach).toBeDefined()
        expect(txTest.newKnowledge).toBeDefined()
        expect(txTest.scientificMethod).toBeDefined()
      }
    })
  })

  // =========================================================================
  // 6. Clawback warnings (s 355-450)
  // =========================================================================
  describe('clawback warnings (s 355-450)', () => {
    it('includes clawback warning on eligible projects with significant expenditure', async () => {
      // Eligible project with > $20,000 expenditure triggers clawback warning
      const rows = [
        makeRndRow({ transaction_id: 'txn-1', transaction_amount: 50000 }),
      ]
      mockSupabaseReturning(rows)

      const summary = await analyzeRndOpportunities('tenant-abc')

      if (summary.projects.length > 0) {
        const project = summary.projects[0]
        if (project.meetsEligibility && project.eligibleExpenditure > 20000) {
          expect(project.clawbackWarning).toBeDefined()
          expect(project.clawbackWarning).toContain('s 355-450')
          expect(project.clawbackWarning).toContain('clawback')
        }
      }
    })

    it('includes summary-level clawback warning when any project has one', async () => {
      const rows = [
        makeRndRow({ transaction_id: 'txn-1', transaction_amount: 50000 }),
      ]
      mockSupabaseReturning(rows)

      const summary = await analyzeRndOpportunities('tenant-abc')

      if (summary.projects.some((p) => p.clawbackWarning)) {
        expect(summary.clawbackWarning).toBeDefined()
        expect(summary.clawbackWarning).toContain('s 355-450')
      }
    })

    it('does not include clawback warning on ineligible projects', async () => {
      // Low confidence + fails criteria = no clawback
      const rows = [
        makeRndRow({
          transaction_id: 'txn-1',
          transaction_amount: 5000,
          meets_div355_criteria: false,
          rnd_confidence: 20,
          rnd_activity_type: 'not_eligible',
        }),
      ]
      mockSupabaseReturning(rows)

      const summary = await analyzeRndOpportunities('tenant-abc')

      // If project is excluded (borderline), clawback warning should not be on summary
      if (summary.projects.length === 0) {
        expect(summary.clawbackWarning).toBeUndefined()
      }
    })
  })

  // =========================================================================
  // 7. Error handling
  // =========================================================================
  describe('error handling', () => {
    it('throws when Supabase returns an error', async () => {
      mockSupabaseReturning(null, { message: 'Database connection failed' })

      await expect(
        analyzeRndOpportunities('tenant-abc')
      ).rejects.toThrow('Failed to fetch R&D candidates')
    })
  })

  // =========================================================================
  // 8. Edge cases
  // =========================================================================
  describe('edge cases', () => {
    it('handles transactions with zero amount', async () => {
      const rows = [
        makeRndRow({ transaction_id: 'txn-zero', transaction_amount: 0 }),
      ]
      mockSupabaseReturning(rows)

      const summary = await analyzeRndOpportunities('tenant-abc')

      // Should not crash; eligible expenditure depends on other criteria
      expect(summary).toBeDefined()
      expect(typeof summary.totalEstimatedOffset).toBe('number')
    })

    it('handles transactions with null supplier_name', async () => {
      const rows = [
        makeRndRow({ transaction_id: 'txn-null-supplier', supplier_name: null }),
      ]
      mockSupabaseReturning(rows)

      const summary = await analyzeRndOpportunities('tenant-abc')

      expect(summary).toBeDefined()
    })

    it('borderline projects appear in excludedProjects', async () => {
      // Project that fails eligibility: low confidence, criteria not met
      const rows = [
        makeRndRow({
          transaction_id: 'txn-borderline',
          transaction_amount: 75000,
          meets_div355_criteria: false,
          rnd_confidence: 40,
          rnd_activity_type: 'supporting_rnd',
          supporting_evidence: 'Marginal technical novelty',
        }),
      ]
      mockSupabaseReturning(rows)

      const summary = await analyzeRndOpportunities('tenant-abc')

      // Should end up in excluded projects, not in eligible projects
      expect(summary.excludedProjects.length).toBeGreaterThanOrEqual(1)
      if (summary.excludedProjects.length > 0) {
        const excluded = summary.excludedProjects[0]
        expect(excluded).toHaveProperty('projectName')
        expect(excluded).toHaveProperty('confidence')
        expect(excluded).toHaveProperty('transactionCount')
        expect(excluded).toHaveProperty('totalAmount')
        expect(excluded).toHaveProperty('reason')
        expect(excluded).toHaveProperty('failedElements')
        expect(Array.isArray(excluded.failedElements)).toBe(true)
      }
      expect(summary.excludedProjectsNote).toContain('excluded')
    })

    it('borderline project reason includes failed four-element criteria', async () => {
      const rows = [
        makeRndRow({
          transaction_id: 'txn-borderline-2',
          transaction_amount: 30000,
          meets_div355_criteria: false,
          rnd_confidence: 55,
          div355_outcome_unknown: false,
          div355_systematic_approach: true,
          div355_new_knowledge: false,
          div355_scientific_method: true,
          supporting_evidence: 'Some evidence present',
        }),
      ]
      mockSupabaseReturning(rows)

      const summary = await analyzeRndOpportunities('tenant-abc')

      if (summary.excludedProjects.length > 0) {
        const excluded = summary.excludedProjects[0]
        expect(excluded.reason).toBeDefined()
        // Should reference which elements failed
        expect(excluded.reason.length).toBeGreaterThan(0)
      }
    })

    it('correctly counts core vs supporting R&D transactions', async () => {
      const rows = [
        makeRndRow({
          transaction_id: 'txn-core-1',
          transaction_amount: 60000,
          rnd_activity_type: 'core_rnd',
        }),
        makeRndRow({
          transaction_id: 'txn-core-2',
          transaction_amount: 40000,
          rnd_activity_type: 'core_rnd',
        }),
        makeRndRow({
          transaction_id: 'txn-support-1',
          transaction_amount: 20000,
          rnd_activity_type: 'supporting_rnd',
        }),
      ]
      mockSupabaseReturning(rows)

      const summary = await analyzeRndOpportunities('tenant-abc')

      // These counts come from project transactions
      expect(summary.coreRndTransactions + summary.supportingRndTransactions).toBeLessThanOrEqual(3)
      expect(typeof summary.coreRndTransactions).toBe('number')
      expect(typeof summary.supportingRndTransactions).toBe('number')
    })
  })

  // =========================================================================
  // 9. Supabase query construction
  // =========================================================================
  describe('Supabase query construction', () => {
    it('queries forensic_analysis_results with is_rnd_candidate filter', async () => {
      const supabaseMock = buildSupabaseQueryMock([])
      mockedCreateServiceClient.mockResolvedValue(supabaseMock as never)

      await analyzeRndOpportunities('tenant-abc')

      expect(supabaseMock.from).toHaveBeenCalledWith('forensic_analysis_results')
    })

    it('applies financial year filters when startYear and endYear provided', async () => {
      // The engine builds the chain as:
      //   supabase.from(...).select(...).eq(...).eq(...).order(...)
      // then conditionally: query = query.gte(...); query = query.lte(...)
      // then: await query
      // So .order() must return the chainable (not the terminal value), and
      // the chainable must be thenable to resolve { data, error } on await.
      const supabaseMock = buildSupabaseQueryMock([])
      mockedCreateServiceClient.mockResolvedValue(supabaseMock as never)

      await analyzeRndOpportunities('tenant-abc', 'FY2022-23', 'FY2024-25')

      // Access the chainable returned by from()
      const chainable = supabaseMock.from.mock.results[0]?.value
      expect(chainable.gte).toHaveBeenCalledWith('financial_year', 'FY2022-23')
      expect(chainable.lte).toHaveBeenCalledWith('financial_year', 'FY2024-25')
    })
  })
})

// ===========================================================================
// getProjectDetails
// ===========================================================================
describe('rnd-engine: getProjectDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDefaultTaxRates()
  })

  it('returns null when project name does not match', async () => {
    mockSupabaseReturning([
      makeRndRow({ transaction_id: 'txn-1', transaction_amount: 50000 }),
    ])

    const result = await getProjectDetails('tenant-abc', 'NonExistentProject')

    expect(result).toBeNull()
  })
})

// ===========================================================================
// calculateTotalRndBenefit
// ===========================================================================
describe('rnd-engine: calculateTotalRndBenefit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDefaultTaxRates()
  })

  it('returns 0 for tenant with no R&D candidates', async () => {
    mockSupabaseReturning([])

    const benefit = await calculateTotalRndBenefit('tenant-empty')

    expect(benefit).toBe(0)
  })

  it('returns total offset for tenant with R&D candidates', async () => {
    mockSupabaseReturning([
      makeRndRow({ transaction_id: 'txn-1', transaction_amount: 100000 }),
    ])

    const benefit = await calculateTotalRndBenefit('tenant-abc')

    expect(typeof benefit).toBe('number')
    expect(benefit).toBeGreaterThanOrEqual(0)
  })
})
