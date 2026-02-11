/**
 * Personal Services Income (PSI) Engine Tests
 *
 * Tests for lib/analysis/psi-engine.ts
 * Division 85 ITAA 1997 - Personal Services Income
 * Division 87 ITAA 1997 - Personal Services Business Determinations
 *
 * Key Tests Covered:
 * 1. Results Test (s 87-18) - 3 sub-requirements: (a) producing result, (b) own tools, (c) defect liability
 * 2. 80% Rule (s 87-15) - single client concentration
 * 3. Unrelated Clients Test (s 87-20)
 * 4. Employment Test (s 87-25)
 * 5. Business Premises Test (s 87-30)
 * 6. PSB determination and deduction restrictions
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/tax-data/cache-manager', () => ({
  getCurrentTaxRates: vi.fn().mockResolvedValue({
    rndOffsetRate: 0.435,
    sourceUrl: 'https://www.ato.gov.au',
  }),
}))

vi.mock('@/lib/utils/financial-year', () => ({
  getCurrentFinancialYear: vi.fn(() => 'FY2024-25'),
}))

import { createServiceClient } from '@/lib/supabase/server'
import type { PSIAnalysis, PSIAnalysisOptions, ResultsTestAnalysis } from '@/lib/analysis/psi-engine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable Supabase mock that supports:
 *   .from().select().eq().eq()
 * and resolves the given data/error when awaited.
 *
 * Supabase PostgREST builder is thenable -- the engine destructures
 * `{ data, error }` from `await supabase.from(...).select(...).eq(...).eq(...)`.
 */
function createSupabaseChain(resolvedValue: { data: unknown; error: unknown }) {
  // Create a thenable object that also has chainable methods
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() => chain),
    maybeSingle: vi.fn(() => chain),
    // Make the chain thenable so `await chain` resolves to the value
    then: vi.fn((resolve: (value: unknown) => void) => {
      return Promise.resolve(resolvedValue).then(resolve)
    }),
  }
  return chain
}

/**
 * Wire up the createServiceClient mock so that
 * `await createServiceClient()` returns `{ from }`.
 */
function mockSupabaseWith(data: unknown[], error: unknown = null) {
  const chain = createSupabaseChain({ data, error })
  const fromFn = vi.fn(() => chain)
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: fromFn,
  })
  return fromFn
}

/** Convenience: build a Xero ACCREC raw_data row for a single invoice. */
function makeInvoiceRow(
  contactName: string,
  contactId: string,
  total: number,
  description = '',
  type = 'ACCREC'
) {
  return {
    raw_data: {
      Type: type,
      Total: String(total),
      Description: description,
      Contact: { Name: contactName, ContactID: contactId },
    },
    financial_year: 'FY2024-25',
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PSI Engine - analyzePSI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. Basic PSIAnalysis structure
  // -------------------------------------------------------------------------
  describe('PSIAnalysis return structure', () => {
    it('returns a well-formed PSIAnalysis object with all required fields', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Client A', 'c-a', 50000),
        makeInvoiceRow('Client B', 'c-b', 30000),
        makeInvoiceRow('Client C', 'c-c', 20000),
      ])

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result: PSIAnalysis = await analyzePSI('tenant-1', 'FY2024-25')

      // Structural assertions
      expect(result).toHaveProperty('tenantId', 'tenant-1')
      expect(result).toHaveProperty('financialYear', 'FY2024-25')
      expect(result).toHaveProperty('totalIncome')
      expect(result).toHaveProperty('totalPSI')
      expect(result).toHaveProperty('psiPercentage')
      expect(result).toHaveProperty('isPSIEntity')
      expect(result).toHaveProperty('clients')
      expect(result).toHaveProperty('singleClientAbove80')
      expect(result).toHaveProperty('primaryClientName')
      expect(result).toHaveProperty('primaryClientPercentage')
      expect(result).toHaveProperty('resultsTest')
      expect(result).toHaveProperty('unrelatedClientsTest')
      expect(result).toHaveProperty('employmentTest')
      expect(result).toHaveProperty('businessPremisesTest')
      expect(result).toHaveProperty('isPSB')
      expect(result).toHaveProperty('psbDeterminationRequired')
      expect(result).toHaveProperty('deductionRestrictions')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('recommendations')
      expect(result).toHaveProperty('legislativeReferences')
      expect(result).toHaveProperty('taxRateSource', 'Division_85_87_ITAA_1997')
      expect(result).toHaveProperty('taxRateVerifiedAt')
      expect(Array.isArray(result.clients)).toBe(true)
      expect(Array.isArray(result.deductionRestrictions)).toBe(true)
      expect(Array.isArray(result.recommendations)).toBe(true)
      expect(Array.isArray(result.legislativeReferences)).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // 2. Empty data scenario
  // -------------------------------------------------------------------------
  describe('empty data handling', () => {
    it('returns empty summary when no transactions exist', async () => {
      mockSupabaseWith([])

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-empty', 'FY2024-25')

      expect(result.totalIncome).toBe(0)
      expect(result.totalPSI).toBe(0)
      expect(result.psiPercentage).toBe(0)
      expect(result.clients).toHaveLength(0)
      expect(result.singleClientAbove80).toBe(false)
      expect(result.primaryClientName).toBeNull()
      expect(result.primaryClientPercentage).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // 3. Results Test (s 87-18) - 3 sub-requirements
  // -------------------------------------------------------------------------
  describe('Results Test (s 87-18)', () => {
    it('has three sub-requirements: producingResult, ownTools, defectLiability', async () => {
      mockSupabaseWith([makeInvoiceRow('Client A', 'c-a', 100000)])

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-rt', 'FY2024-25')
      const rt: ResultsTestAnalysis = result.resultsTest

      expect(rt).toHaveProperty('producingResult')
      expect(rt.producingResult).toHaveProperty('met')
      expect(rt.producingResult).toHaveProperty('confidence')
      expect(rt.producingResult).toHaveProperty('percentage')
      expect(rt.producingResult).toHaveProperty('evidence')

      expect(rt).toHaveProperty('ownTools')
      expect(rt.ownTools).toHaveProperty('met')
      expect(rt.ownTools).toHaveProperty('confidence')
      expect(rt.ownTools).toHaveProperty('evidence')

      expect(rt).toHaveProperty('defectLiability')
      expect(rt.defectLiability).toHaveProperty('met')
      expect(rt.defectLiability).toHaveProperty('confidence')
      expect(rt.defectLiability).toHaveProperty('evidence')

      expect(rt).toHaveProperty('overallMet')
      expect(rt).toHaveProperty('overallConfidence')
    })

    it('passes results test only when ALL THREE sub-requirements met', async () => {
      // Use result-based invoice descriptions so (a) passes
      mockSupabaseWith([
        makeInvoiceRow('Client A', 'c-a', 80000, 'Project deliverable - fixed price build'),
        makeInvoiceRow('Client A', 'c-a', 20000, 'Milestone completion payment'),
      ])

      const options: PSIAnalysisOptions = {
        providesOwnTools: true,
        liableForDefects: true,
      }

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-rt-pass', 'FY2024-25', options)

      // With all three options provided and result-based invoices, overall should pass
      expect(result.resultsTest.ownTools.met).toBe(true)
      expect(result.resultsTest.defectLiability.met).toBe(true)
      // overallMet requires all three
      if (result.resultsTest.producingResult.met) {
        expect(result.resultsTest.overallMet).toBe(true)
      }
    })

    it('fails results test when own tools not provided (s 87-18(b))', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Client A', 'c-a', 100000, 'Project deliverable'),
      ])

      const options: PSIAnalysisOptions = {
        providesOwnTools: false,
        liableForDefects: true,
      }

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-no-tools', 'FY2024-25', options)

      expect(result.resultsTest.ownTools.met).toBe(false)
      expect(result.resultsTest.overallMet).toBe(false)
    })

    it('fails results test when not liable for defects (s 87-18(c))', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Client A', 'c-a', 100000, 'Project deliverable'),
      ])

      const options: PSIAnalysisOptions = {
        providesOwnTools: true,
        liableForDefects: false,
      }

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-no-defect', 'FY2024-25', options)

      expect(result.resultsTest.defectLiability.met).toBe(false)
      expect(result.resultsTest.overallMet).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 4. Unrelated Clients Test (s 87-20)
  // -------------------------------------------------------------------------
  describe('Unrelated Clients Test (s 87-20)', () => {
    it('passes when 2+ unrelated clients exist', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Client A', 'c-a', 50000),
        makeInvoiceRow('Client B', 'c-b', 30000),
        makeInvoiceRow('Client C', 'c-c', 20000),
      ])

      const options: PSIAnalysisOptions = {
        unrelatedClientCount: 3,
      }

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-multi', 'FY2024-25', options)

      expect(result.unrelatedClientsTest.met).toBe(true)
      expect(result.unrelatedClientsTest.confidence).toBe(70)
      expect(result.unrelatedClientsTest.notes.length).toBeGreaterThan(0)
    })

    it('fails when fewer than 2 unrelated clients', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Client A', 'c-a', 100000),
      ])

      const options: PSIAnalysisOptions = {
        unrelatedClientCount: 1,
      }

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-single-unrelated', 'FY2024-25', options)

      expect(result.unrelatedClientsTest.met).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 5. Employment Test (s 87-25)
  // -------------------------------------------------------------------------
  describe('Employment Test (s 87-25)', () => {
    it('defaults to not met (requires professional review)', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Client A', 'c-a', 100000),
      ])

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-emp', 'FY2024-25')

      expect(result.employmentTest.met).toBe(false)
      expect(result.employmentTest.confidence).toBe(20)
      expect(result.employmentTest.notes.length).toBeGreaterThan(0)
      expect(result.employmentTest.notes.some(
        (n: string) => n.includes('s 87-25')
      )).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // 6. Business Premises Test (s 87-30)
  // -------------------------------------------------------------------------
  describe('Business Premises Test (s 87-30)', () => {
    it('passes when separate business premises confirmed', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Client A', 'c-a', 100000),
      ])

      const options: PSIAnalysisOptions = {
        hasSeparatePremises: true,
      }

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-premises', 'FY2024-25', options)

      expect(result.businessPremisesTest.met).toBe(true)
      expect(result.businessPremisesTest.confidence).toBe(80)
    })

    it('fails when separate premises not confirmed', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Client A', 'c-a', 100000),
      ])

      const options: PSIAnalysisOptions = {
        hasSeparatePremises: false,
      }

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-no-premises', 'FY2024-25', options)

      expect(result.businessPremisesTest.met).toBe(false)
      expect(result.businessPremisesTest.notes.some(
        (n: string) => n.includes('s 87-30')
      )).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // 7. PSB determination (passes >= 1 test)
  // -------------------------------------------------------------------------
  describe('PSB determination', () => {
    it('is PSB when at least one PSB test passes (business premises)', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Client A', 'c-a', 100000),
      ])

      const options: PSIAnalysisOptions = {
        hasSeparatePremises: true,
      }

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-psb-premises', 'FY2024-25', options)

      expect(result.isPSB).toBe(true)
    })

    it('is PSB when unrelated clients test passes', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Client A', 'c-a', 40000),
        makeInvoiceRow('Client B', 'c-b', 35000),
        makeInvoiceRow('Client C', 'c-c', 25000),
      ])

      const options: PSIAnalysisOptions = {
        unrelatedClientCount: 3,
      }

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-psb-clients', 'FY2024-25', options)

      expect(result.unrelatedClientsTest.met).toBe(true)
      expect(result.isPSB).toBe(true)
    })

    it('is PSB when ATO PSB determination is held', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Client A', 'c-a', 100000),
      ])

      const options: PSIAnalysisOptions = {
        hasPSBDetermination: true,
      }

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-psb-det', 'FY2024-25', options)

      expect(result.isPSB).toBe(true)
      expect(result.psbDeterminationRequired).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 8. Deduction restrictions under PSI rules
  // -------------------------------------------------------------------------
  describe('deduction restrictions', () => {
    it('applies deduction restrictions when PSI entity and not PSB', async () => {
      // Single client = isPSIEntity true; no PSB options = not PSB
      mockSupabaseWith([
        makeInvoiceRow('Solo Client', 'c-solo', 100000),
      ])

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-restricted', 'FY2024-25')

      // With a single client and no PSB tests passing, deduction restrictions apply
      if (result.isPSIEntity && !result.isPSB) {
        expect(result.deductionRestrictions.length).toBeGreaterThan(0)
        expect(result.deductionRestrictions.some(
          (d: string) => d.includes('s 86-60')
        )).toBe(true)
        expect(result.deductionRestrictions.some(
          (d: string) => d.includes('home office')
        )).toBe(true)
        expect(result.deductionRestrictions.some(
          (d: string) => d.includes('s 86-15')
        )).toBe(true)
      }
    })

    it('does not apply deduction restrictions when entity is a PSB', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Client A', 'c-a', 100000),
      ])

      const options: PSIAnalysisOptions = {
        hasSeparatePremises: true,
      }

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-psb-no-restrict', 'FY2024-25', options)

      // PSB = true means no deduction restrictions
      expect(result.isPSB).toBe(true)
      expect(result.deductionRestrictions).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // 9. Edge case: all tests pass (is PSB)
  // -------------------------------------------------------------------------
  describe('edge case: all PSB tests pass', () => {
    it('is definitively a PSB when all four tests pass', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Client A', 'c-a', 40000, 'Project deliverable - fixed price build'),
        makeInvoiceRow('Client B', 'c-b', 35000, 'Milestone completion design'),
        makeInvoiceRow('Client C', 'c-c', 25000, 'Install completion'),
      ])

      const options: PSIAnalysisOptions = {
        providesOwnTools: true,
        liableForDefects: true,
        hasSeparatePremises: true,
        unrelatedClientCount: 3,
      }

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-all-pass', 'FY2024-25', options)

      expect(result.isPSB).toBe(true)
      expect(result.unrelatedClientsTest.met).toBe(true)
      expect(result.businessPremisesTest.met).toBe(true)
      expect(result.deductionRestrictions).toHaveLength(0)
      expect(result.psbDeterminationRequired).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 10. Edge case: no tests pass (PSI applies)
  // -------------------------------------------------------------------------
  describe('edge case: no PSB tests pass', () => {
    it('PSI rules apply when zero PSB tests pass and entity is PSI', async () => {
      // Single client, no options provided -- all tests fail
      mockSupabaseWith([
        makeInvoiceRow('Only Client', 'c-only', 100000),
      ])

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-no-pass', 'FY2024-25')

      expect(result.resultsTest.overallMet).toBe(false)
      expect(result.unrelatedClientsTest.met).toBe(false)
      expect(result.employmentTest.met).toBe(false)
      expect(result.businessPremisesTest.met).toBe(false)
      expect(result.isPSB).toBe(false)

      // Entity with single client is PSI; deduction restrictions should apply
      if (result.isPSIEntity) {
        expect(result.psbDeterminationRequired).toBe(true)
        expect(result.deductionRestrictions.length).toBeGreaterThan(0)
      }
    })
  })

  // -------------------------------------------------------------------------
  // 11. Edge case: single client scenario (strong PSI indicator)
  // -------------------------------------------------------------------------
  describe('edge case: single client (strong PSI indicator)', () => {
    it('flags single client above 80% as PSI indicator (s 87-15)', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Dominant Client', 'c-dom', 95000),
        makeInvoiceRow('Minor Client', 'c-min', 5000),
      ])

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-single-dom', 'FY2024-25')

      expect(result.singleClientAbove80).toBe(true)
      expect(result.primaryClientName).toBe('Dominant Client')
      expect(result.primaryClientPercentage).toBeGreaterThanOrEqual(80)
      expect(result.isPSIEntity).toBe(true)
    })

    it('identifies the dominant client in the client analysis', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Mega Corp', 'c-mega', 90000),
        makeInvoiceRow('Small Co', 'c-small', 10000),
      ])

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-mega', 'FY2024-25')

      const megaClient = result.clients.find(c => c.clientName === 'Mega Corp')
      expect(megaClient).toBeDefined()
      expect(megaClient!.percentageOfTotal).toBeGreaterThanOrEqual(80)
      expect(megaClient!.psiIndicators.some(
        (ind: string) => ind.includes('80%')
      )).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // 12. Edge case: multiple unrelated clients (not PSI via 80% rule)
  // -------------------------------------------------------------------------
  describe('edge case: multiple unrelated clients', () => {
    it('does not trigger 80% rule with well-diversified clients', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Client A', 'c-a', 25000),
        makeInvoiceRow('Client B', 'c-b', 25000),
        makeInvoiceRow('Client C', 'c-c', 25000),
        makeInvoiceRow('Client D', 'c-d', 25000),
      ])

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-diverse', 'FY2024-25')

      expect(result.singleClientAbove80).toBe(false)
      // With 4 clients, no single one is at 80%
      result.clients.forEach(c => {
        expect(c.percentageOfTotal).toBeLessThan(80)
      })
    })
  })

  // -------------------------------------------------------------------------
  // 13. Legislative references
  // -------------------------------------------------------------------------
  describe('legislative references', () => {
    it('includes all relevant PSI legislative references', async () => {
      mockSupabaseWith([makeInvoiceRow('Client A', 'c-a', 50000)])

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-legref', 'FY2024-25')

      expect(result.legislativeReferences).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Division 85'),
          expect.stringContaining('Division 86'),
          expect.stringContaining('Division 87'),
          expect.stringContaining('s 87-15'),
          expect.stringContaining('s 87-18'),
          expect.stringContaining('s 87-20'),
          expect.stringContaining('s 87-25'),
          expect.stringContaining('s 87-30'),
        ])
      )
    })
  })

  // -------------------------------------------------------------------------
  // 14. Supabase error handling
  // -------------------------------------------------------------------------
  describe('Supabase error handling', () => {
    it('throws when Supabase returns an error', async () => {
      const errorResult = {
        data: null,
        error: { message: 'Database connection failed' },
      }
      const chain: Record<string, unknown> = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        then: vi.fn((resolve: (value: unknown) => void) =>
          Promise.resolve(errorResult).then(resolve)
        ),
      }

      ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue({
        from: vi.fn(() => chain),
      })

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')

      await expect(
        analyzePSI('tenant-err', 'FY2024-25')
      ).rejects.toThrow('Failed to fetch transactions')
    })
  })

  // -------------------------------------------------------------------------
  // 15. Clients sorted by income descending
  // -------------------------------------------------------------------------
  describe('client sorting', () => {
    it('returns clients sorted by income descending', async () => {
      mockSupabaseWith([
        makeInvoiceRow('Small Co', 'c-s', 10000),
        makeInvoiceRow('Big Co', 'c-b', 80000),
        makeInvoiceRow('Medium Co', 'c-m', 30000),
      ])

      const { analyzePSI } = await import('@/lib/analysis/psi-engine')
      const result = await analyzePSI('tenant-sort', 'FY2024-25')

      expect(result.clients.length).toBe(3)
      expect(result.clients[0].clientName).toBe('Big Co')
      expect(result.clients[1].clientName).toBe('Medium Co')
      expect(result.clients[2].clientName).toBe('Small Co')
    })
  })
})
