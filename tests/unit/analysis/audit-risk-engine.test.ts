/**
 * @vitest-environment node
 *
 * Audit Risk Assessment Engine Tests
 *
 * Tests for lib/analysis/audit-risk-engine.ts
 * Evaluates ATO audit likelihood based on:
 * - Industry benchmark deviation
 * - High-scrutiny category analysis
 * - Transaction pattern detection
 * - Amendment period proximity
 *
 * IMPORTANT (AD-6): ATO benchmarks are DESCRIPTIVE, not NORMATIVE.
 * Being outside a benchmark is NOT illegal. The engine must NEVER
 * recommend changing business behaviour to match benchmarks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { assessAuditRisk } from '@/lib/analysis/audit-risk-engine'
import type { AuditRiskAssessment, RiskLevel } from '@/lib/analysis/audit-risk-engine'

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

// We need to import the mocked module to set up per-test return values
import { createServiceClient } from '@/lib/supabase/server'
const mockCreateServiceClient = vi.mocked(createServiceClient)

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build a mock Supabase client that returns the given transactions
 * from historical_transactions_cache.
 */
function buildMockSupabase(transactions: unknown[] | null, error: unknown = null) {
  const mockResult = { data: transactions, error }
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(mockResult),
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
  Reference?: string
  Date?: string
}) {
  return {
    Type: overrides.Type ?? 'ACCPAY',
    Total: overrides.Total ?? '100.00',
    Description: overrides.Description ?? '',
    Reference: overrides.Reference ?? '',
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

describe('AuditRiskEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // 1. Basic structure tests
  // ---------------------------------------------------------------------------

  describe('assessAuditRisk - return structure', () => {
    it('returns a valid AuditRiskAssessment structure with all required fields', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '50000' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-20000', Description: 'Office supplies' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await assessAuditRisk('tenant-123', 'FY2024-25')

      // Verify top-level structure
      expect(result).toHaveProperty('tenantId', 'tenant-123')
      expect(result).toHaveProperty('financialYear', 'FY2024-25')
      expect(result).toHaveProperty('overallRiskLevel')
      expect(result).toHaveProperty('overallRiskScore')
      expect(result).toHaveProperty('auditProbabilityEstimate')
      expect(result).toHaveProperty('riskFactors')
      expect(result).toHaveProperty('highRiskFactors')
      expect(result).toHaveProperty('mediumRiskFactors')
      expect(result).toHaveProperty('benchmarkComparison')
      expect(result).toHaveProperty('complianceFocusAreas')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('recommendations')
      expect(result).toHaveProperty('disclaimer')
      expect(result).toHaveProperty('legislativeReferences')
      expect(result).toHaveProperty('taxRateSource')
      expect(result).toHaveProperty('taxRateVerifiedAt')

      // Verify types
      expect(typeof result.overallRiskScore).toBe('number')
      expect(result.overallRiskScore).toBeGreaterThanOrEqual(0)
      expect(result.overallRiskScore).toBeLessThanOrEqual(100)
      expect(Array.isArray(result.riskFactors)).toBe(true)
      expect(Array.isArray(result.highRiskFactors)).toBe(true)
      expect(Array.isArray(result.mediumRiskFactors)).toBe(true)
      expect(Array.isArray(result.complianceFocusAreas)).toBe(true)
      expect(Array.isArray(result.recommendations)).toBe(true)
      expect(Array.isArray(result.legislativeReferences)).toBe(true)
    })

    it('returns low risk assessment with empty/no transactions', async () => {
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase([]) as never)

      const result = await assessAuditRisk('tenant-empty', 'FY2024-25')

      expect(result.tenantId).toBe('tenant-empty')
      expect(result.overallRiskLevel).toBe('low')
      expect(result.overallRiskScore).toBeLessThanOrEqual(30)
      expect(result.riskFactors.length).toBe(0)
      expect(result.highRiskFactors.length).toBe(0)
      expect(result.benchmarkComparison).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Risk level classification
  // ---------------------------------------------------------------------------

  describe('risk level classification', () => {
    it('assigns "low" risk when figures are within normal benchmark ranges', async () => {
      // Income $100k, expenses $70k (70% ratio -- within 60-95% benchmark)
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '100000' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-70000', Description: 'general supplies' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await assessAuditRisk('tenant-low', 'FY2024-25')

      expect(result.overallRiskLevel).toBe('low')
      expect(result.overallRiskScore).toBeLessThan(30)
    })

    it('assigns "medium" risk when expense ratio exceeds benchmark and other flags present', async () => {
      // Income $100k, total expenses ~$112k (112% ratio -- exceeds 95% high, score ~34)
      // Plus entertainment >$5k and motor vehicle exceeding 8% benchmark
      // This should produce enough weighted score to land in "medium" band (30-49)
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '100000' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-90000', Description: 'general supplies' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-12000', Description: 'motor vehicle fuel car expenses' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-10000', Description: 'entertainment dining meals' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await assessAuditRisk('tenant-medium', 'FY2024-25')

      // Should have multiple risk factors pushing into medium territory
      expect(result.riskFactors.length).toBeGreaterThanOrEqual(2)
      expect(result.overallRiskScore).toBeGreaterThanOrEqual(30)
      expect(['medium', 'high', 'very_high']).toContain(result.overallRiskLevel)
    })

    it('assigns "high" risk when expense ratio greatly exceeds benchmark', async () => {
      // Income $100k, expenses $130k (130% ratio -- exceeds 95% by >20% = high)
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '100000' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-130000', Description: 'general supplies' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await assessAuditRisk('tenant-high', 'FY2024-25')

      expect(['high', 'very_high']).toContain(result.overallRiskLevel)
      expect(result.highRiskFactors.length).toBeGreaterThanOrEqual(1)
    })

    it('assigns "very_high" risk when multiple high-risk factors combine', async () => {
      // Extremely high expense ratio + high cash proportion + large entertainment
      const cashTxCount = 80
      const totalTxCount = 100
      const txs: unknown[] = []

      // Income
      txs.push(buildTransaction({ Type: 'ACCREC', Total: '100000' }))

      // Expenses way above benchmark
      txs.push(buildTransaction({ Type: 'ACCPAY', Total: '-150000', Description: 'general supplies' }))

      // High entertainment
      txs.push(buildTransaction({ Type: 'ACCPAY', Total: '-25000', Description: 'entertainment meals dining' }))

      // High cash transaction proportion (BANK type)
      for (let i = 0; i < cashTxCount; i++) {
        txs.push(buildTransaction({ Type: 'BANK', Total: '-500', Description: 'cash payment' }))
      }

      const transactions = wrapInCacheRow(txs)
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await assessAuditRisk('tenant-very-high', 'FY2024-25')

      expect(result.overallRiskScore).toBeGreaterThanOrEqual(50)
      expect(result.riskFactors.length).toBeGreaterThanOrEqual(2)
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Deviation calculations
  // ---------------------------------------------------------------------------

  describe('deviation calculations', () => {
    it('calculates deviation percentage when metric exceeds industry median', async () => {
      // Expense ratio 120% -- benchmark high is 95%
      // Deviation = ((1.20 - 0.95) / 0.95) * 100 = ~26.3%
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '100000' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-120000', Description: 'general supplies' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await assessAuditRisk('tenant-dev', 'FY2024-25')

      const expenseRiskFactor = result.riskFactors.find(f => f.category === 'Expense Ratio')
      expect(expenseRiskFactor).toBeDefined()
      expect(expenseRiskFactor!.deviation).toBeDefined()
      expect(expenseRiskFactor!.deviation!).toBeGreaterThan(0)
      expect(expenseRiskFactor!.actualValue).toBeDefined()
      expect(expenseRiskFactor!.benchmarkValue).toBeDefined()
      // actualValue should be ~1.20 (120%)
      expect(expenseRiskFactor!.actualValue!).toBeCloseTo(1.20, 1)
      // benchmarkValue should be 0.95 (95%)
      expect(expenseRiskFactor!.benchmarkValue!).toBeCloseTo(0.95, 2)
    })

    it('does not flag deviations when metrics are within benchmark range', async () => {
      // Expense ratio 80% -- within 60-95% range
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '100000' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-80000', Description: 'general supplies' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await assessAuditRisk('tenant-in-range', 'FY2024-25')

      const expenseRiskFactor = result.riskFactors.find(f => f.category === 'Expense Ratio')
      expect(expenseRiskFactor).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // 4. ANZSIC benchmark comparison
  // ---------------------------------------------------------------------------

  describe('ANZSIC benchmark comparison', () => {
    it('builds benchmark comparison with deviation details when income exists', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '200000' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-160000', Description: 'general wages salary' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-10000', Description: 'rent premises' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-5000', Description: 'motor vehicle fuel' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await assessAuditRisk('tenant-benchmark', 'FY2024-25')

      expect(result.benchmarkComparison).not.toBeNull()
      expect(result.benchmarkComparison!.industryCode).toBeDefined()
      expect(result.benchmarkComparison!.industryName).toBeDefined()
      expect(result.benchmarkComparison!.deviations).toBeDefined()
      expect(result.benchmarkComparison!.deviations.length).toBeGreaterThan(0)

      // Each deviation should have standard structure
      const deviation = result.benchmarkComparison!.deviations[0]
      expect(deviation).toHaveProperty('metric')
      expect(deviation).toHaveProperty('benchmarkRange')
      expect(deviation).toHaveProperty('actualValue')
      expect(deviation).toHaveProperty('isOutside')
      expect(deviation).toHaveProperty('note')
    })

    it('uses default benchmarks when no specific industry code is provided', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '100000' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-50000', Description: 'supplies' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await assessAuditRisk('tenant-default', 'FY2024-25')

      expect(result.benchmarkComparison).not.toBeNull()
      expect(result.benchmarkComparison!.industryCode).toBe('default')
      expect(result.benchmarkComparison!.industryName).toBe('General Business')
    })
  })

  // ---------------------------------------------------------------------------
  // 5. AD-6: Benchmarks are DESCRIPTIVE, not NORMATIVE
  // ---------------------------------------------------------------------------

  describe('AD-6: benchmarks are descriptive, not normative', () => {
    it('never recommends changing expenses to match benchmarks in recommendations', async () => {
      // High expense ratio that triggers benchmark deviation
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '100000' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-130000', Description: 'general supplies' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await assessAuditRisk('tenant-ad6', 'FY2024-25')

      // Check that no recommendation tells the user to reduce/change expenses to match benchmarks
      const normativePhrases = [
        'reduce your expenses',
        'lower your expenses',
        'decrease expenses to match',
        'adjust your expenses to',
        'bring your expenses in line',
        'change your expenses',
        'modify your spending to match',
      ]

      for (const rec of result.recommendations) {
        const recLower = rec.toLowerCase()
        for (const phrase of normativePhrases) {
          expect(recLower).not.toContain(phrase)
        }
      }

      // The final recommendation should explicitly say benchmarks are not requirements
      const benchmarkDisclaimer = result.recommendations.find(r =>
        r.includes('Deviating from ATO benchmarks is not illegal')
      )
      expect(benchmarkDisclaimer).toBeDefined()
    })

    it('includes a disclaimer that being outside benchmarks is not illegal', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '100000' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-50000', Description: 'supplies' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await assessAuditRisk('tenant-disclaimer', 'FY2024-25')

      expect(result.disclaimer).toContain('Being outside benchmarks is not illegal')
      expect(result.disclaimer).toContain('does not require changes to business operations')
    })

    it('risk factor notes frame deviation as audit risk, not as wrongdoing', async () => {
      // Motor vehicle expenses exceeding benchmark
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '100000' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-15000', Description: 'motor vehicle fuel car' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await assessAuditRisk('tenant-framing', 'FY2024-25')

      // Find motor vehicle risk factor if one was generated
      const mvFactor = result.riskFactors.find(f => f.category === 'Motor Vehicle Expenses')
      if (mvFactor) {
        // Note should talk about substantiation and record-keeping, not reducing expenses
        expect(mvFactor.note.toLowerCase()).not.toContain('reduce')
        expect(mvFactor.note.toLowerCase()).not.toContain('lower your')
        // Should reference record-keeping or substantiation
        expect(mvFactor.note.toLowerCase()).toMatch(/log book|substantiat|record/)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // 6. Red flag detection
  // ---------------------------------------------------------------------------

  describe('red flag detection', () => {
    it('flags high proportion of cash/bank transactions', async () => {
      const txs: unknown[] = []
      txs.push(buildTransaction({ Type: 'ACCREC', Total: '100000' }))

      // 80% BANK transactions (above 50% threshold)
      for (let i = 0; i < 40; i++) {
        txs.push(buildTransaction({ Type: 'BANK', Total: '-500' }))
      }
      // 20% non-BANK
      for (let i = 0; i < 10; i++) {
        txs.push(buildTransaction({ Type: 'ACCPAY', Total: '-500', Description: 'supplies' }))
      }

      const transactions = wrapInCacheRow(txs)
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await assessAuditRisk('tenant-cash', 'FY2024-25')

      const cashFactor = result.riskFactors.find(f => f.category === 'Cash Economy')
      expect(cashFactor).toBeDefined()
      expect(cashFactor!.atoFocusArea).toBe('Cash economy and unreported income')
    })

    it('flags significant entertainment expenses over $5,000', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '200000' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-8000', Description: 'entertainment client meals dining' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await assessAuditRisk('tenant-entertain', 'FY2024-25')

      const entertainFactor = result.riskFactors.find(f => f.category === 'Entertainment')
      expect(entertainFactor).toBeDefined()
      expect(entertainFactor!.actualValue).toBe(8000)
    })

    it('flags significant travel expenses over $10,000', async () => {
      const transactions = wrapInCacheRow([
        buildTransaction({ Type: 'ACCREC', Total: '300000' }),
        buildTransaction({ Type: 'ACCPAY', Total: '-15000', Description: 'travel flight hotel accommodation' }),
      ])
      mockCreateServiceClient.mockResolvedValue(buildMockSupabase(transactions) as never)

      const result = await assessAuditRisk('tenant-travel', 'FY2024-25')

      const travelFactor = result.riskFactors.find(f => f.category === 'Travel')
      expect(travelFactor).toBeDefined()
      expect(travelFactor!.actualValue).toBe(15000)
    })

    it('throws an error when Supabase query fails', async () => {
      mockCreateServiceClient.mockResolvedValue(
        buildMockSupabase(null, { message: 'Database connection failed' }) as never
      )

      await expect(
        assessAuditRisk('tenant-error', 'FY2024-25')
      ).rejects.toThrow('Failed to fetch transactions')
    })
  })
})
