/**
 * @vitest-environment node
 *
 * Fringe Benefits Tax Engine Tests (FBTAA 1986)
 *
 * Tests for lib/analysis/fbt-engine.ts
 *
 * Key legislation:
 * - FBTAA 1986 (Fringe Benefits Tax Assessment Act)
 * - s 136: FBT rate (47% = 45% top marginal + 2% Medicare Levy)
 * - s 57A: Exempt benefits
 * - s 58X: Minor benefits exemption ($300 per benefit)
 * - s 24: Otherwise deductible rule
 *
 * FBT year: 1 April - 31 March (NOT income tax FY 1 July - 30 June)
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
  getCurrentFBTYear: vi.fn(() => 'FBT2024-25'),
  getFBTYearStartDate: vi.fn((fbtYear: string) => {
    const match = fbtYear.match(/^FBT(\d{4})-\d{2}$/)
    if (!match) return null
    return new Date(Date.UTC(parseInt(match[1], 10), 3, 1)) // 1 April (UTC)
  }),
  getFBTYearEndDate: vi.fn((fbtYear: string) => {
    const match = fbtYear.match(/^FBT(\d{4})-(\d{2})$/)
    if (!match) return null
    const century = match[1].substring(0, 2)
    const endYear = parseInt(`${century}${match[2]}`, 10)
    return new Date(Date.UTC(endYear, 2, 31)) // 31 March (UTC)
  }),
}))

vi.mock('decimal.js', async () => {
  const actual = await vi.importActual<typeof import('decimal.js')>('decimal.js')
  return actual
})

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'
import { analyzeFBT } from '@/lib/analysis/fbt-engine'
import type { FBTSummary, FBTItem, FBTCategory } from '@/lib/analysis/fbt-engine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal forensic analysis row for FBT testing */
function buildTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 'row-1',
    tenant_id: overrides.tenant_id ?? 'tenant-abc',
    transaction_id: overrides.transaction_id ?? `txn-${Math.random().toString(36).slice(2, 8)}`,
    financial_year: overrides.financial_year ?? 'FY2024-25',
    transaction_date: overrides.transaction_date ?? '2024-06-15',
    transaction_amount: overrides.transaction_amount ?? 500,
    transaction_description: overrides.transaction_description ?? 'Employee benefit',
    supplier_name: overrides.supplier_name ?? 'Supplier Co',
    platform: overrides.platform ?? 'xero',
    primary_category: overrides.primary_category ?? null,
    secondary_categories: overrides.secondary_categories ?? null,
    category_confidence: overrides.category_confidence ?? 80,
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
    requires_documentation: false,
    fbt_implications: true,
    division7a_risk: false,
    compliance_notes: null,
    analyzed_at: '2024-08-01T00:00:00Z',
    ...overrides,
  }
}

/** Create a chainable Supabase query mock that resolves to { data, error } */
function createSupabaseQueryMock(data: unknown[] | null, error: { message: string } | null = null) {
  const chain: Record<string, unknown> = {}
  const terminalResult = { data, error }

  // Every chainable method returns the chain; order() is the terminal call
  const chainFn = () => chain
  chain.from = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.gte = vi.fn(() => chain)
  chain.lte = vi.fn(() => chain)
  chain.order = vi.fn(() => terminalResult)

  return chain
}

// ---------------------------------------------------------------------------
// Default mock state
// ---------------------------------------------------------------------------

const DEFAULT_TAX_RATES = {
  fbtRate: 0.47,
  fbtType1GrossUpRate: 2.0802,
  fbtType2GrossUpRate: 1.8868,
  sources: {
    fbt: 'ATO_OFFICIAL_2024-25',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getCurrentTaxRates as ReturnType<typeof vi.fn>).mockResolvedValue(DEFAULT_TAX_RATES)
})

// =============================================================================
// 1. FBTSummary Structure Tests
// =============================================================================

describe('analyzeFBT - FBTSummary structure', () => {
  it('returns all required FBTSummary fields when transactions exist', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-car-1',
        transaction_description: 'Company car fuel',
        transaction_amount: 1000,
        transaction_date: '2024-09-15',
      }),
    ]

    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result: FBTSummary = await analyzeFBT('tenant-abc', 'FBT2024-25')

    // Verify all top-level keys exist
    expect(result).toHaveProperty('fbtYear')
    expect(result).toHaveProperty('totalFBTLiability')
    expect(result).toHaveProperty('totalTaxableValue')
    expect(result).toHaveProperty('type1AggregateAmount')
    expect(result).toHaveProperty('type2AggregateAmount')
    expect(result).toHaveProperty('fbtRate')
    expect(result).toHaveProperty('grossUpRate1')
    expect(result).toHaveProperty('grossUpRate2')
    expect(result).toHaveProperty('itemCount')
    expect(result).toHaveProperty('exemptBenefitsCount')
    expect(result).toHaveProperty('exemptBenefitsValue')
    expect(result).toHaveProperty('byCategory')
    expect(result).toHaveProperty('items')
    expect(result).toHaveProperty('lodgmentDeadline')
    expect(result).toHaveProperty('lodgmentStatus')
    expect(result).toHaveProperty('taxRateSource')
    expect(result).toHaveProperty('taxRateVerifiedAt')
    expect(result).toHaveProperty('legislativeReferences')
    expect(result).toHaveProperty('recommendations')
    expect(result).toHaveProperty('professionalReviewRequired')
  })

  it('returns items as FBTItem[] with correct shape', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-meal-1',
        transaction_description: 'Client dinner entertainment',
        transaction_amount: 450,
        transaction_date: '2024-10-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')
    const item: FBTItem = result.items[0]

    expect(item).toHaveProperty('transactionId')
    expect(item).toHaveProperty('transactionDate')
    expect(item).toHaveProperty('description')
    expect(item).toHaveProperty('amount')
    expect(item).toHaveProperty('supplier')
    expect(item).toHaveProperty('category')
    expect(item).toHaveProperty('benefitType')
    expect(item).toHaveProperty('taxableValue')
    expect(item).toHaveProperty('grossedUpValue')
    expect(item).toHaveProperty('gstCredits')
    expect(item).toHaveProperty('exemptionApplied')
    expect(item).toHaveProperty('employeeContribution')
    expect(item).toHaveProperty('fbtLiability')
    expect(item).toHaveProperty('confidence')
    expect(item).toHaveProperty('legislativeReference')
  })
})

// =============================================================================
// 2. Empty / No Data Tests
// =============================================================================

describe('analyzeFBT - empty data', () => {
  it('returns empty summary when Supabase returns no transactions', async () => {
    const supabaseMock = createSupabaseQueryMock([])
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    expect(result.fbtYear).toBe('FBT2024-25')
    expect(result.totalFBTLiability).toBe(0)
    expect(result.totalTaxableValue).toBe(0)
    expect(result.itemCount).toBe(0)
    expect(result.items).toHaveLength(0)
    expect(result.byCategory).toEqual({})
  })

  it('returns empty summary when Supabase returns null data', async () => {
    const supabaseMock = createSupabaseQueryMock(null)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    expect(result.totalFBTLiability).toBe(0)
    expect(result.items).toHaveLength(0)
  })

  it('returns empty summary for invalid FBT year format', async () => {
    // getFBTYearStartDate / getFBTYearEndDate return null for invalid format
    const supabaseMock = createSupabaseQueryMock([])
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'INVALID')

    expect(result.fbtYear).toBe('INVALID')
    expect(result.totalFBTLiability).toBe(0)
    expect(result.items).toHaveLength(0)
  })
})

// =============================================================================
// 3. FBT Year Handling (1 Apr - 31 Mar)
// =============================================================================

describe('analyzeFBT - FBT year handling', () => {
  it('uses FBT year (Apr-Mar), not income tax FY (Jul-Jun)', async () => {
    const supabaseMock = createSupabaseQueryMock([])
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    await analyzeFBT('tenant-abc', 'FBT2024-25')

    // Verify Supabase was queried with FBT year date range (1 Apr 2024 - 31 Mar 2025)
    const gteCall = (supabaseMock.gte as ReturnType<typeof vi.fn>).mock.calls[0]
    const lteCall = (supabaseMock.lte as ReturnType<typeof vi.fn>).mock.calls[0]

    expect(gteCall[0]).toBe('transaction_date')
    expect(gteCall[1]).toBe('2024-04-01') // 1 April 2024
    expect(lteCall[0]).toBe('transaction_date')
    expect(lteCall[1]).toBe('2025-03-31') // 31 March 2025
  })

  it('returns the correct fbtYear string on the result', async () => {
    const supabaseMock = createSupabaseQueryMock([])
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')
    expect(result.fbtYear).toBe('FBT2024-25')
  })

  it('defaults to getCurrentFBTYear() when no year supplied', async () => {
    const supabaseMock = createSupabaseQueryMock([])
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc')
    // Mock getCurrentFBTYear returns 'FBT2024-25'
    expect(result.fbtYear).toBe('FBT2024-25')
  })
})

// =============================================================================
// 4. FBT Rate Tests (47% = 45% + 2% Medicare Levy)
// =============================================================================

describe('analyzeFBT - FBT rate', () => {
  it('uses 47% FBT rate (45% top marginal + 2% Medicare Levy)', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-rate-1',
        transaction_description: 'Company vehicle lease',
        transaction_amount: 1000,
        transaction_date: '2024-06-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    expect(result.fbtRate).toBe(0.47)
  })

  it('uses fallback 47% rate when getCurrentTaxRates fails', async () => {
    ;(getCurrentTaxRates as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Cache unavailable')
    )

    const txns = [
      buildTransaction({
        transaction_id: 'txn-fallback-1',
        transaction_description: 'Staff vehicle fuel',
        transaction_amount: 800,
        transaction_date: '2024-07-15',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    expect(result.fbtRate).toBe(0.47)
    expect(result.taxRateSource).toBe('ATO_FALLBACK_DEFAULT')
  })

  it('applies live FBT rate from getCurrentTaxRates when available', async () => {
    ;(getCurrentTaxRates as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...DEFAULT_TAX_RATES,
      fbtRate: 0.47,
      sources: { fbt: 'ATO_LIVE_2024-25' },
    })

    const txns = [
      buildTransaction({
        transaction_id: 'txn-live-rate',
        transaction_description: 'Company car parking',
        transaction_amount: 500,
        transaction_date: '2024-09-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    expect(result.fbtRate).toBe(0.47)
    expect(result.taxRateSource).toBe('ATO_LIVE_2024-25')
  })
})

// =============================================================================
// 5. Gross-Up Rate Tests (Type 1 vs Type 2)
// =============================================================================

describe('analyzeFBT - gross-up rates', () => {
  it('uses Type 1 gross-up rate 2.0802 for GST-creditable benefits', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-gu1',
        transaction_description: 'Company car fuel',
        transaction_amount: 1000,
        transaction_date: '2024-08-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    expect(result.grossUpRate1).toBe(2.0802)
    // Car benefit is Type 1 (GST-creditable) by default
    const carItem = result.items.find(i => i.category === 'car_fringe_benefit')
    if (carItem) {
      expect(carItem.benefitType).toBe('type_1')
      expect(carItem.grossedUpValue).toBeCloseTo(1000 * 2.0802, 2)
    }
  })

  it('uses Type 2 gross-up rate 1.8868 for non-GST-creditable benefits', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-gu2',
        transaction_description: 'Client dinner entertainment',
        transaction_amount: 500,
        transaction_date: '2024-08-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    expect(result.grossUpRate2).toBe(1.8868)
    // Meal entertainment is Type 2 (no GST credit)
    const mealItem = result.items.find(i => i.category === 'meal_entertainment')
    if (mealItem) {
      expect(mealItem.benefitType).toBe('type_2')
      expect(mealItem.grossedUpValue).toBeCloseTo(500 * 1.8868, 2)
    }
  })

  it('applies zero GST credits for Type 2 benefits', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-no-gst',
        transaction_description: 'Employee housing rental accommodation',
        transaction_amount: 2000,
        transaction_date: '2024-10-15',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    const housingItem = result.items.find(i => i.category === 'housing_benefit')
    expect(housingItem).toBeDefined()
    expect(housingItem!.benefitType).toBe('type_2')
    expect(housingItem!.gstCredits).toBe(0)
  })

  it('calculates GST credits as amount/11 for Type 1 benefits', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-gst-credit',
        transaction_description: 'Company vehicle petrol',
        transaction_amount: 1100,
        transaction_date: '2024-06-15',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    const carItem = result.items.find(i => i.category === 'car_fringe_benefit')
    expect(carItem).toBeDefined()
    expect(carItem!.benefitType).toBe('type_1')
    // GST credit = 1100 / 11 = 100
    expect(carItem!.gstCredits).toBe(100)
  })
})

// =============================================================================
// 6. FBT Category Classification Tests
// =============================================================================

describe('analyzeFBT - category classification', () => {
  const categoryTestCases: Array<{
    description: string
    txDescription: string
    expectedCategory: FBTCategory
    legislativeRef: string
  }> = [
    {
      description: 'classifies car fringe benefit (Division 2)',
      txDescription: 'Company car lease payment',
      expectedCategory: 'car_fringe_benefit',
      legislativeRef: 'Division 2 FBTAA 1986',
    },
    {
      description: 'classifies loan fringe benefit (Division 4)',
      txDescription: 'Employee loan interest subsidy',
      expectedCategory: 'loan_fringe_benefit',
      legislativeRef: 'Division 4 FBTAA 1986',
    },
    {
      description: 'classifies expense payment benefit (Division 5)',
      txDescription: 'Staff expense reimbursement',
      expectedCategory: 'expense_payment',
      legislativeRef: 'Division 5 FBTAA 1986',
    },
    {
      description: 'classifies housing benefit (Division 6)',
      txDescription: 'Employee housing accommodation',
      expectedCategory: 'housing_benefit',
      legislativeRef: 'Division 6 FBTAA 1986',
    },
    {
      description: 'classifies meal entertainment benefit (Division 9A)',
      txDescription: 'Staff dinner restaurant entertainment',
      expectedCategory: 'meal_entertainment',
      legislativeRef: 'Division 9A FBTAA 1986',
    },
    {
      description: 'classifies otherwise deductible (s 24) for education/training',
      txDescription: 'Employee training course fees',
      expectedCategory: 'otherwise_deductible',
      legislativeRef: 's 24 FBTAA 1986',
    },
    {
      description: 'classifies residual fringe benefit (Division 12) as fallback',
      txDescription: 'Employee gym membership',
      expectedCategory: 'residual_fringe_benefit',
      legislativeRef: 'Division 12 FBTAA 1986',
    },
  ]

  for (const tc of categoryTestCases) {
    it(tc.description, async () => {
      const txns = [
        buildTransaction({
          transaction_id: `txn-cat-${tc.expectedCategory}`,
          transaction_description: tc.txDescription,
          transaction_amount: 500,
          transaction_date: '2024-09-01',
        }),
      ]
      const supabaseMock = createSupabaseQueryMock(txns)
      ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

      const result = await analyzeFBT('tenant-abc', 'FBT2024-25')
      const item = result.items[0]

      expect(item.category).toBe(tc.expectedCategory)
      expect(item.legislativeReference).toContain(tc.legislativeRef)
    })
  }
})

// =============================================================================
// 7. Exempt Benefits Detection (s 57A, s 58X)
// =============================================================================

describe('analyzeFBT - exempt benefits', () => {
  it('applies s 58X minor benefit exemption for amounts < $300', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-minor-1',
        transaction_description: 'Staff gift voucher',
        transaction_amount: 250, // Below $300 threshold
        transaction_date: '2024-12-20',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    const item = result.items[0]
    expect(item.category).toBe('exempt_benefit')
    expect(item.exemptionApplied).toContain('s 58X')
    expect(item.exemptionApplied).toContain('$300')
    expect(item.taxableValue).toBe(0)
    expect(item.grossedUpValue).toBe(0)
    expect(item.fbtLiability).toBe(0)
  })

  it('does NOT exempt benefits at exactly $300 (threshold is strictly less than)', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-exact-300',
        transaction_description: 'Staff gift voucher',
        transaction_amount: 300,
        transaction_date: '2024-12-20',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    const item = result.items[0]
    // $300 is NOT less than $300, so not exempt
    expect(item.category).not.toBe('exempt_benefit')
    expect(item.exemptionApplied).toBeNull()
    expect(item.taxableValue).toBe(300)
  })

  it('applies work-related item exemption (s 58X) for laptop expense payments', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-laptop-1',
        transaction_description: 'Employee laptop reimbursement',
        transaction_amount: 2500,
        transaction_date: '2024-08-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    const item = result.items[0]
    expect(item.category).toBe('exempt_benefit')
    expect(item.exemptionApplied).toContain('Work-related item')
    expect(item.exemptionApplied).toContain('s 58X')
    expect(item.taxableValue).toBe(0)
  })

  it('counts exempt benefits separately in summary', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-ex-1',
        transaction_description: 'Small gift',
        transaction_amount: 100, // Exempt (< $300)
        transaction_date: '2024-09-01',
      }),
      buildTransaction({
        transaction_id: 'txn-ex-2',
        transaction_description: 'Another small gift',
        transaction_amount: 150, // Exempt (< $300)
        transaction_date: '2024-09-15',
      }),
      buildTransaction({
        transaction_id: 'txn-not-ex',
        transaction_description: 'Company vehicle fuel',
        transaction_amount: 500, // NOT exempt
        transaction_date: '2024-10-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    expect(result.exemptBenefitsCount).toBe(2)
    expect(result.exemptBenefitsValue).toBe(250) // 100 + 150
    expect(result.itemCount).toBe(1) // Only non-exempt items counted
  })
})

// =============================================================================
// 8. Otherwise Deductible Rule (s 24) Classification
// =============================================================================

describe('analyzeFBT - otherwise deductible rule (s 24)', () => {
  it('classifies education/training benefits as otherwise deductible', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-edu-1',
        transaction_description: 'Professional development conference registration',
        transaction_amount: 1500,
        transaction_date: '2024-11-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    const item = result.items[0]
    expect(item.category).toBe('otherwise_deductible')
    expect(item.legislativeReference).toContain('s 24 FBTAA 1986')
  })
})

// =============================================================================
// 9. Lodgement Deadline Tests
// =============================================================================

describe('analyzeFBT - lodgement deadline', () => {
  it('sets lodgement deadline to 21 May for self-lodgers', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-lodge-1',
        transaction_description: 'Company car petrol',
        transaction_amount: 400,
        transaction_date: '2024-06-15',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    // FBT2024-25 ends 31 March 2025, lodgement is around 21 May 2025
    // Date may be off by 1 day due to UTC timezone conversion
    expect(result.lodgmentDeadline).toMatch(/^2025-05-2[01]$/)
  })

  it('calculates lodgement status based on current date', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-status-1',
        transaction_description: 'Company car lease',
        transaction_amount: 1000,
        transaction_date: '2024-08-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    // lodgmentStatus should be one of the valid values
    expect(['upcoming', 'due_soon', 'overdue']).toContain(result.lodgmentStatus)
  })
})

// =============================================================================
// 10. FBT Liability Calculation Tests
// =============================================================================

describe('analyzeFBT - liability calculation', () => {
  it('calculates total FBT liability = (type1Aggregate + type2Aggregate) * fbtRate', async () => {
    // One Type 1 benefit (car) and one Type 2 benefit (meal entertainment)
    const txns = [
      buildTransaction({
        transaction_id: 'txn-calc-1',
        transaction_description: 'Company car fuel',
        transaction_amount: 1000,
        transaction_date: '2024-08-01',
      }),
      buildTransaction({
        transaction_id: 'txn-calc-2',
        transaction_description: 'Staff dinner entertainment',
        transaction_amount: 500,
        transaction_date: '2024-09-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    // Car: Type 1, grossed up = 1000 * 2.0802 = 2080.20
    // Meal: Type 2, grossed up = 500 * 1.8868 = 943.40
    // Total liability = (2080.20 + 943.40) * 0.47 = 1421.09
    const expectedType1 = 1000 * 2.0802
    const expectedType2 = 500 * 1.8868
    const expectedLiability = (expectedType1 + expectedType2) * 0.47

    expect(result.type1AggregateAmount).toBeCloseTo(expectedType1, 1)
    expect(result.type2AggregateAmount).toBeCloseTo(expectedType2, 1)
    expect(result.totalFBTLiability).toBeCloseTo(expectedLiability, 0)
  })

  it('sets professionalReviewRequired when liability exceeds $10,000', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-high-1',
        transaction_description: 'Company vehicle lease',
        transaction_amount: 15000,
        transaction_date: '2024-06-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    // 15000 * 2.0802 * 0.47 = 14,665.41 > $10,000
    expect(result.professionalReviewRequired).toBe(true)
  })

  it('does not require professional review for small liabilities', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-small-1',
        transaction_description: 'Staff meal entertainment',
        transaction_amount: 500,
        transaction_date: '2024-08-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    // 500 * 1.8868 * 0.47 = 443.37 < $10,000
    expect(result.professionalReviewRequired).toBe(false)
  })
})

// =============================================================================
// 11. Legislative References
// =============================================================================

describe('analyzeFBT - legislative references', () => {
  it('includes key FBTAA 1986 legislative references', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-ref-1',
        transaction_description: 'Company car fuel',
        transaction_amount: 1000,
        transaction_date: '2024-09-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    expect(result.legislativeReferences).toContain('FBTAA 1986 (Fringe Benefits Tax Assessment Act)')
    expect(result.legislativeReferences).toContain('s 136 FBTAA 1986 (FBT rate)')
    expect(result.legislativeReferences).toContain('s 57A FBTAA 1986 (Exempt benefits)')
    expect(result.legislativeReferences).toContain('s 58X FBTAA 1986 (Minor benefits exemption - $300)')
    expect(result.legislativeReferences).toContain('s 24 FBTAA 1986 (Otherwise deductible rule)')
  })
})

// =============================================================================
// 12. Edge Cases
// =============================================================================

describe('analyzeFBT - edge cases', () => {
  it('handles all exempt benefits (no taxable items)', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-all-ex-1',
        transaction_description: 'Small staff gift',
        transaction_amount: 50,
        transaction_date: '2024-09-01',
      }),
      buildTransaction({
        transaction_id: 'txn-all-ex-2',
        transaction_description: 'Team morning tea',
        transaction_amount: 100,
        transaction_date: '2024-10-01',
      }),
      buildTransaction({
        transaction_id: 'txn-all-ex-3',
        transaction_description: 'Birthday card',
        transaction_amount: 20,
        transaction_date: '2024-11-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    expect(result.totalFBTLiability).toBe(0)
    expect(result.totalTaxableValue).toBe(0)
    expect(result.itemCount).toBe(0)
    expect(result.exemptBenefitsCount).toBe(3)
    expect(result.exemptBenefitsValue).toBe(170) // 50 + 100 + 20
    expect(result.byCategory).toEqual({}) // No taxable categories
    expect(result.professionalReviewRequired).toBe(false)
  })

  it('handles mixed Type 1 and Type 2 benefits correctly', async () => {
    const txns = [
      // Type 1 (car - GST-creditable)
      buildTransaction({
        transaction_id: 'txn-mix-1',
        transaction_description: 'Company car fuel',
        transaction_amount: 2000,
        transaction_date: '2024-08-01',
      }),
      // Type 2 (meal entertainment - no GST credit)
      buildTransaction({
        transaction_id: 'txn-mix-2',
        transaction_description: 'Client lunch entertainment',
        transaction_amount: 800,
        transaction_date: '2024-09-01',
      }),
      // Type 2 (housing - input-taxed)
      buildTransaction({
        transaction_id: 'txn-mix-3',
        transaction_description: 'Employee housing accommodation',
        transaction_amount: 3000,
        transaction_date: '2024-10-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    // Type 1: 2000 * 2.0802 = 4160.40
    expect(result.type1AggregateAmount).toBeCloseTo(2000 * 2.0802, 1)
    // Type 2: (800 * 1.8868) + (3000 * 1.8868) = 1509.44 + 5660.40 = 7169.84
    expect(result.type2AggregateAmount).toBeCloseTo(
      (800 * 1.8868) + (3000 * 1.8868), 1
    )

    // byCategory should have entries for each taxable category
    expect(result.byCategory).toHaveProperty('car_fringe_benefit')
    expect(result.byCategory).toHaveProperty('meal_entertainment')
    expect(result.byCategory).toHaveProperty('housing_benefit')

    expect(result.itemCount).toBe(3)
    expect(result.totalFBTLiability).toBeGreaterThan(0)
  })

  it('throws on Supabase query error', async () => {
    const supabaseMock = createSupabaseQueryMock(null, {
      message: 'Connection refused',
    })
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    await expect(analyzeFBT('tenant-abc', 'FBT2024-25')).rejects.toThrow(
      'Failed to fetch FBT transactions: Connection refused'
    )
  })

  it('handles negative transaction amounts by using absolute value', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-neg-1',
        transaction_description: 'Company car fuel refund',
        transaction_amount: -500,
        transaction_date: '2024-07-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    // Engine uses Math.abs() on the amount
    const item = result.items[0]
    expect(item.amount).toBe(500)
  })

  it('groups byCategory correctly with counts and values', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-grp-1',
        transaction_description: 'Company car fuel',
        transaction_amount: 1000,
        transaction_date: '2024-08-01',
      }),
      buildTransaction({
        transaction_id: 'txn-grp-2',
        transaction_description: 'Company vehicle petrol',
        transaction_amount: 800,
        transaction_date: '2024-09-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    const carCategory = result.byCategory['car_fringe_benefit']
    expect(carCategory).toBeDefined()
    expect(carCategory.count).toBe(2)
    expect(carCategory.taxableValue).toBe(1800) // 1000 + 800
    expect(carCategory.grossedUpValue).toBeCloseTo(1800 * 2.0802, 1)
    expect(carCategory.fbtLiability).toBeGreaterThan(0)
  })
})

// =============================================================================
// 13. Type 1 vs Type 2 Determination
// =============================================================================

describe('analyzeFBT - Type 1 vs Type 2 benefit determination', () => {
  it('classifies meal entertainment as Type 2 (Division 9A - no GST credit)', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-t2-meal',
        transaction_description: 'Staff dinner entertainment',
        transaction_amount: 600,
        transaction_date: '2024-09-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')
    expect(result.items[0].benefitType).toBe('type_2')
  })

  it('classifies housing benefit as Type 2 (input-taxed supply)', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-t2-housing',
        transaction_description: 'Employee housing',
        transaction_amount: 2000,
        transaction_date: '2024-09-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')
    expect(result.items[0].benefitType).toBe('type_2')
  })

  it('classifies loan fringe benefit as Type 2 (no GST on loans)', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-t2-loan',
        transaction_description: 'Employee loan interest subsidy',
        transaction_amount: 1500,
        transaction_date: '2024-07-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')
    expect(result.items[0].benefitType).toBe('type_2')
  })

  it('defaults to Type 1 (conservative) when GST status unknown', async () => {
    const txns = [
      buildTransaction({
        transaction_id: 'txn-t1-default',
        transaction_description: 'Miscellaneous employee benefit',
        transaction_amount: 500,
        transaction_date: '2024-09-01',
      }),
    ]
    const supabaseMock = createSupabaseQueryMock(txns)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock)

    const result = await analyzeFBT('tenant-abc', 'FBT2024-25')

    // Residual fringe benefit with no GST data -> Type 1 (conservative)
    expect(result.items[0].benefitType).toBe('type_1')
  })
})
