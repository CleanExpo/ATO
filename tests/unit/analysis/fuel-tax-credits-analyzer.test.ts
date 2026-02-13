/**
 * @vitest-environment node
 *
 * Fuel Tax Credits Analyzer Tests
 *
 * Tests for lib/analysis/fuel-tax-credits-analyzer.ts
 * Fuel Tax Act 2006 - Fuel Tax Credits
 *
 * Covers:
 * - analyzeFuelTaxCredits returns FuelTaxCreditAnalysis structure
 * - Empty data handling
 * - Per-quarter rate lookup (rates change quarterly, not annually -- finding F-1)
 * - Fuel types: diesel, petrol, LPG
 * - Business use percentage calculation
 * - Off-road vs on-road: road user charge deduction for heavy vehicles (finding F-2)
 * - Eligibility criteria: valid tax invoice, GST registered, business use
 * - Ineligibility reasons
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

import {
  analyzeFuelTaxCredits,
  type FuelPurchase,
  type FuelTaxCreditAnalysis,
  type FuelTaxCreditCalculation,
} from '@/lib/analysis/fuel-tax-credits-analyzer'

// =============================================================================
// Helpers
// =============================================================================

function createFuelPurchase(overrides: Partial<FuelPurchase> = {}): FuelPurchase {
  return {
    transaction_id: 'tx-' + Math.random().toString(36).slice(2, 9),
    transaction_date: '2024-08-15', // Q1 FY2024-25
    supplier_name: 'BP Australia',
    total_amount: 200.0,
    fuel_litres: 100,
    fuel_type: 'diesel',
    business_use_percentage: 100,
    is_off_road_use: true,
    has_valid_tax_invoice: true,
    financial_year: 'FY2024-25',
    ...overrides,
  }
}

// =============================================================================
// analyzeFuelTaxCredits: Structure and Empty Data
// =============================================================================

describe('analyzeFuelTaxCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a valid FuelTaxCreditAnalysis structure for a single purchase', async () => {
    const purchases: FuelPurchase[] = [createFuelPurchase()]

    const results = await analyzeFuelTaxCredits(purchases)

    expect(results).toHaveLength(1)
    const analysis: FuelTaxCreditAnalysis = results[0]

    // Verify all top-level properties exist
    expect(analysis).toHaveProperty('tenant_id')
    expect(analysis).toHaveProperty('financial_year', 'FY2024-25')
    expect(analysis).toHaveProperty('total_fuel_purchases', 1)
    expect(analysis).toHaveProperty('total_fuel_expenditure', 200.0)
    expect(analysis).toHaveProperty('eligible_purchases')
    expect(analysis).toHaveProperty('ineligible_purchases')
    expect(analysis).toHaveProperty('fuel_breakdown_by_type')
    expect(analysis).toHaveProperty('calculations')
    expect(analysis).toHaveProperty('total_credits_claimable')
    expect(analysis).toHaveProperty('total_credits_by_quarter')
    expect(analysis).toHaveProperty('data_quality_score')
    expect(analysis).toHaveProperty('missing_data_flags')
    expect(analysis).toHaveProperty('recommendations')
    expect(analysis).toHaveProperty('professional_review_required')
    expect(analysis).toHaveProperty('compliance_summary')

    // Verify calculations array has one entry
    expect(analysis.calculations).toHaveLength(1)

    // Verify fuel breakdown has diesel entry
    expect(analysis.fuel_breakdown_by_type).toHaveLength(1)
    expect(analysis.fuel_breakdown_by_type[0].fuel_type).toBe('diesel')

    // Verify four quarters are present
    expect(analysis.total_credits_by_quarter).toHaveLength(4)
  })

  it('returns an empty array when no purchases are provided', async () => {
    const results = await analyzeFuelTaxCredits([])

    expect(results).toEqual([])
  })

  it('groups purchases by financial year into separate analyses', async () => {
    const purchases: FuelPurchase[] = [
      createFuelPurchase({ financial_year: 'FY2024-25', transaction_date: '2024-08-01' }),
      createFuelPurchase({ financial_year: 'FY2023-24', transaction_date: '2023-08-01' }),
    ]

    const results = await analyzeFuelTaxCredits(purchases)

    expect(results).toHaveLength(2)
    const fys = results.map(r => r.financial_year).sort()
    expect(fys).toEqual(['FY2023-24', 'FY2024-25'])
  })
})

// =============================================================================
// Per-Quarter Rate Lookup (Finding F-1)
// =============================================================================

describe('Per-quarter rate lookup (F-1: rates change quarterly)', () => {
  it('uses Q1 FY2024-25 diesel rate (0.4810) for Jul-Sep transactions', async () => {
    const purchase = createFuelPurchase({
      transaction_date: '2024-08-15', // August = Q1
      fuel_type: 'diesel',
      fuel_litres: 100,
      business_use_percentage: 100,
      is_off_road_use: true,
    })

    const results = await analyzeFuelTaxCredits([purchase])
    const calc = results[0].calculations[0]

    // Q1 FY2024-25 diesel rate is 0.4810 (off-road, no road user charge deduction)
    expect(calc.credit_rate_per_litre).toBe(0.481)
  })

  it('uses Q3 FY2024-25 diesel rate (0.4790) for Jan-Mar transactions', async () => {
    const purchase = createFuelPurchase({
      transaction_date: '2025-02-15', // February = Q3
      fuel_type: 'diesel',
      fuel_litres: 100,
      business_use_percentage: 100,
      is_off_road_use: true,
    })

    const results = await analyzeFuelTaxCredits([purchase])
    const calc = results[0].calculations[0]

    // Q3 FY2024-25 diesel rate is 0.4790
    expect(calc.credit_rate_per_litre).toBe(0.479)
  })

  it('applies different credit amounts for Q1 vs Q3 on the same litres', async () => {
    const q1Purchase = createFuelPurchase({
      transaction_id: 'tx-q1',
      transaction_date: '2024-07-15', // Q1
      fuel_type: 'diesel',
      fuel_litres: 1000,
      business_use_percentage: 100,
      is_off_road_use: true,
    })
    const q3Purchase = createFuelPurchase({
      transaction_id: 'tx-q3',
      transaction_date: '2025-01-15', // Q3
      fuel_type: 'diesel',
      fuel_litres: 1000,
      business_use_percentage: 100,
      is_off_road_use: true,
    })

    const results = await analyzeFuelTaxCredits([q1Purchase, q3Purchase])
    const calcs = results[0].calculations

    const q1Calc = calcs.find(c => c.fuel_purchase_id === 'tx-q1')!
    const q3Calc = calcs.find(c => c.fuel_purchase_id === 'tx-q3')!

    // Q1 rate (0.4810) > Q3 rate (0.4790), so Q1 credit should be higher
    expect(q1Calc.net_credit_claimable).toBeGreaterThan(q3Calc.net_credit_claimable)
    // Q1: 1000 * 0.481 = 481.00; Q3: 1000 * 0.479 = 479.00
    expect(q1Calc.net_credit_claimable).toBe(481)
    expect(q3Calc.net_credit_claimable).toBe(479)
  })
})

// =============================================================================
// Fuel Types: Diesel, Petrol, LPG
// =============================================================================

describe('Fuel type credit rates', () => {
  it('applies correct diesel credit rate for off-road use', async () => {
    const purchase = createFuelPurchase({
      fuel_type: 'diesel',
      fuel_litres: 100,
      transaction_date: '2024-08-15', // Q1 FY2024-25
      is_off_road_use: true,
      business_use_percentage: 100,
    })

    const results = await analyzeFuelTaxCredits([purchase])
    const calc = results[0].calculations[0]

    expect(calc.fuel_type).toBe('diesel')
    expect(calc.credit_rate_per_litre).toBe(0.481) // Q1 diesel rate
    expect(calc.is_eligible).toBe(true)
  })

  it('applies correct LPG credit rate (lower than diesel/petrol)', async () => {
    const purchase = createFuelPurchase({
      fuel_type: 'lpg',
      fuel_litres: 100,
      transaction_date: '2024-08-15', // Q1 FY2024-25
      is_off_road_use: true,
      business_use_percentage: 100,
    })

    const results = await analyzeFuelTaxCredits([purchase])
    const calc = results[0].calculations[0]

    expect(calc.fuel_type).toBe('lpg')
    expect(calc.credit_rate_per_litre).toBe(0.1985) // Q1 LPG rate
    expect(calc.is_eligible).toBe(true)
    // LPG credit per litre should be less than diesel
    expect(calc.credit_rate_per_litre).toBeLessThan(0.481)
  })

  it('marks unknown fuel type as ineligible', async () => {
    const purchase = createFuelPurchase({
      fuel_type: 'unknown',
      fuel_litres: 100,
      is_off_road_use: true,
      business_use_percentage: 100,
    })

    const results = await analyzeFuelTaxCredits([purchase])
    const calc = results[0].calculations[0]

    expect(calc.fuel_type).toBe('unknown')
    expect(calc.is_eligible).toBe(false)
    expect(calc.ineligibility_reasons).toContain(
      'Unknown fuel type (cannot determine credit rate)'
    )
    expect(calc.net_credit_claimable).toBe(0)
  })
})

// =============================================================================
// Business Use Percentage Calculation
// =============================================================================

describe('Business use percentage calculation', () => {
  it('calculates full credit at 100% business use', async () => {
    const purchase = createFuelPurchase({
      fuel_litres: 100,
      fuel_type: 'diesel',
      business_use_percentage: 100,
      is_off_road_use: true,
      transaction_date: '2024-08-15', // Q1
    })

    const results = await analyzeFuelTaxCredits([purchase])
    const calc = results[0].calculations[0]

    expect(calc.business_fuel_litres).toBe(100)
    // 100 litres * 0.481 = 48.10
    expect(calc.gross_credit).toBe(48.1)
    expect(calc.net_credit_claimable).toBe(48.1)
  })

  it('calculates proportional credit at 60% business use', async () => {
    const purchase = createFuelPurchase({
      fuel_litres: 100,
      fuel_type: 'diesel',
      business_use_percentage: 60,
      is_off_road_use: true,
      transaction_date: '2024-08-15', // Q1
    })

    const results = await analyzeFuelTaxCredits([purchase])
    const calc = results[0].calculations[0]

    expect(calc.business_fuel_litres).toBe(60) // 100 * 0.60
    // 60 litres * 0.481 = 28.86
    expect(calc.gross_credit).toBe(28.86)
    expect(calc.net_credit_claimable).toBe(28.86)
    expect(calc.confidence_level).toBe('medium') // <100% requires logbook
  })

  it('returns zero credit and marks ineligible at 0% business use', async () => {
    const purchase = createFuelPurchase({
      fuel_litres: 100,
      fuel_type: 'diesel',
      business_use_percentage: 0,
      is_off_road_use: true,
    })

    const results = await analyzeFuelTaxCredits([purchase])
    const calc = results[0].calculations[0]

    expect(calc.business_fuel_litres).toBe(0)
    expect(calc.is_eligible).toBe(false)
    expect(calc.ineligibility_reasons).toContain(
      'No business use claimed (personal use ineligible)'
    )
    expect(calc.net_credit_claimable).toBe(0)
  })
})

// =============================================================================
// Off-Road vs On-Road: Road User Charge Deduction (Finding F-2)
// =============================================================================

describe('Off-road vs on-road: road user charge (F-2)', () => {
  it('applies full credit rate for off-road diesel use (no road user charge)', async () => {
    const purchase = createFuelPurchase({
      fuel_type: 'diesel',
      fuel_litres: 100,
      is_off_road_use: true, // Mining, farming, machinery
      business_use_percentage: 100,
      transaction_date: '2024-08-15', // Q1
    })

    const results = await analyzeFuelTaxCredits([purchase])
    const calc = results[0].calculations[0]

    // Off-road: full diesel rate 0.4810 (no road user charge deduction)
    expect(calc.credit_rate_per_litre).toBe(0.481)
    expect(calc.net_credit_claimable).toBe(48.1) // 100 * 0.481
  })

  it('deducts road user charge for on-road heavy vehicle diesel (s 43-10)', async () => {
    const purchase = createFuelPurchase({
      fuel_type: 'diesel',
      fuel_litres: 100,
      is_off_road_use: false, // On public roads, heavy vehicle
      business_use_percentage: 100,
      transaction_date: '2024-08-15', // Q1
    })

    const results = await analyzeFuelTaxCredits([purchase])
    const calc = results[0].calculations[0]

    // On-road: diesel rate 0.4810 minus road user charge 0.2947 = 0.1863
    expect(calc.credit_rate_per_litre).toBeCloseTo(0.1863, 4)
    // Net credit: 100 * 0.1863 = 18.63
    expect(calc.net_credit_claimable).toBeCloseTo(18.63, 2)
    // On-road credit should be significantly less than off-road
    expect(calc.credit_rate_per_litre).toBeLessThan(0.481)
  })

  it('marks on-road petrol for light vehicles as ineligible', async () => {
    const purchase = createFuelPurchase({
      fuel_type: 'petrol',
      fuel_litres: 50,
      is_off_road_use: false, // Light vehicle on public roads
      business_use_percentage: 100,
    })

    const results = await analyzeFuelTaxCredits([purchase])
    const calc = results[0].calculations[0]

    expect(calc.is_eligible).toBe(false)
    expect(calc.ineligibility_reasons).toContain(
      'Petrol for light vehicles on public roads (< 4.5t GVM) is ineligible'
    )
    expect(calc.net_credit_claimable).toBe(0)
  })
})

// =============================================================================
// Eligibility Criteria
// =============================================================================

describe('Eligibility criteria', () => {
  it('marks purchase as eligible when all criteria are met', async () => {
    const purchase = createFuelPurchase({
      fuel_type: 'diesel',
      fuel_litres: 100,
      business_use_percentage: 100,
      is_off_road_use: true,
      has_valid_tax_invoice: true,
    })

    const results = await analyzeFuelTaxCredits([purchase])
    const calc = results[0].calculations[0]

    expect(calc.is_eligible).toBe(true)
    expect(calc.ineligibility_reasons).toHaveLength(0)
    expect(calc.net_credit_claimable).toBeGreaterThan(0)
    expect(calc.confidence_level).toBe('high')
    expect(calc.requires_verification).toBe(false)
  })

  it('marks ineligible when no valid tax invoice (Fuel Tax Act 2006)', async () => {
    const purchase = createFuelPurchase({
      fuel_type: 'diesel',
      fuel_litres: 100,
      business_use_percentage: 100,
      is_off_road_use: true,
      has_valid_tax_invoice: false,
    })

    const results = await analyzeFuelTaxCredits([purchase])
    const calc = results[0].calculations[0]

    expect(calc.is_eligible).toBe(false)
    expect(calc.ineligibility_reasons).toContain(
      'No valid tax invoice (required under Fuel Tax Act 2006)'
    )
    expect(calc.net_credit_claimable).toBe(0)
    expect(calc.requires_verification).toBe(true)
  })

  it('estimates litres from amount when fuel_litres is missing', async () => {
    const purchase = createFuelPurchase({
      fuel_type: 'diesel',
      fuel_litres: undefined, // Missing litre data
      total_amount: 200.0,
      business_use_percentage: 100,
      is_off_road_use: true,
      has_valid_tax_invoice: true,
    })

    const results = await analyzeFuelTaxCredits([purchase])
    const calc = results[0].calculations[0]

    // Estimates litres as total_amount / 2.0 = 100
    expect(calc.fuel_litres).toBe(100)
    expect(calc.confidence_level).toBe('low')
    expect(calc.requires_verification).toBe(true)
    expect(calc.ineligibility_reasons).toContain(
      'Fuel litres estimated from transaction amount (requires verification)'
    )
  })
})

// =============================================================================
// Ineligibility Reasons & Data Quality
// =============================================================================

describe('Ineligibility reasons and data quality', () => {
  it('accumulates multiple ineligibility reasons on a single purchase', async () => {
    const purchase = createFuelPurchase({
      fuel_type: 'petrol',
      fuel_litres: undefined, // Will estimate -- adds a reason
      business_use_percentage: 0, // Personal use -- adds a reason
      is_off_road_use: false, // On-road petrol -- adds a reason
      has_valid_tax_invoice: false, // No invoice -- adds a reason
    })

    const results = await analyzeFuelTaxCredits([purchase])
    const calc = results[0].calculations[0]

    expect(calc.is_eligible).toBe(false)
    expect(calc.ineligibility_reasons.length).toBeGreaterThanOrEqual(3)
    expect(calc.net_credit_claimable).toBe(0)
  })

  it('sets professional_review_required when credits exceed $10,000', async () => {
    // Create enough high-value off-road diesel purchases to exceed $10k in credits
    // 100,000 litres * 0.481 = $48,100 credit
    const purchases: FuelPurchase[] = [
      createFuelPurchase({
        fuel_type: 'diesel',
        fuel_litres: 100000,
        total_amount: 200000,
        business_use_percentage: 100,
        is_off_road_use: true,
        transaction_date: '2024-08-15',
      }),
    ]

    const results = await analyzeFuelTaxCredits(purchases)
    const analysis = results[0]

    expect(analysis.total_credits_claimable).toBeGreaterThan(10000)
    expect(analysis.professional_review_required).toBe(true)
  })

  it('flags low data quality when invoices and litres are missing', async () => {
    const purchases: FuelPurchase[] = [
      createFuelPurchase({
        has_valid_tax_invoice: false,
        fuel_litres: undefined,
        fuel_type: 'unknown',
      }),
    ]

    const results = await analyzeFuelTaxCredits(purchases)
    const analysis = results[0]

    // Data quality should be low (< 70)
    expect(analysis.data_quality_score).toBeLessThan(70)
    expect(analysis.missing_data_flags.length).toBeGreaterThan(0)
    expect(analysis.professional_review_required).toBe(true)
  })

  it('generates recommendation to claim on BAS when credits exist', async () => {
    const purchase = createFuelPurchase({
      fuel_type: 'diesel',
      fuel_litres: 500,
      is_off_road_use: true,
      business_use_percentage: 100,
    })

    const results = await analyzeFuelTaxCredits([purchase])
    const analysis = results[0]

    expect(analysis.total_credits_claimable).toBeGreaterThan(0)
    const basRecommendation = analysis.recommendations.find(r =>
      r.includes('BAS') && r.includes('7D')
    )
    expect(basRecommendation).toBeDefined()
  })
})
