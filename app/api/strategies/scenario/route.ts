/**
 * Scenario Modeling API
 *
 * What-if analysis for tax optimization strategies
 *
 * ARCH-034: Dynamic tax rates from getCurrentTaxRates()
 * ARCH-035: Passive income test for base rate entity (s 23AA ITAA 1997)
 * ARCH-006: Decimal.js for all monetary arithmetic
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { createValidationError } from '@/lib/api/errors'
import { z } from 'zod'
import { Decimal } from 'decimal.js'
import { isSingleUserMode } from '@/lib/auth/single-user-check'
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'
import type { ForensicAnalysisRow } from '@/lib/types/forensic-analysis'

export const dynamic = 'force-dynamic'

// Fallback rates when live rates are unavailable (FY2024-25)
const FALLBACK_CORPORATE_TAX_RATE = 0.25
const FALLBACK_STANDARD_TAX_RATE = 0.30
const FALLBACK_RND_OFFSET_RATE = 0.435

// Validation schema
const scenarioSchema = z.object({
  tenantId: z.string().uuid(),
  baseYear: z.string(), // e.g., "FY2023-24"
  passiveIncomePercentage: z.number().min(0).max(100).optional(), // Percentage of passive income for base rate entity test
  scenarios: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      changes: z.object({
        additionalRndClaim: z.number().optional(), // Additional R&D expenditure to claim
        deferredIncome: z.number().optional(), // Income to defer to next year
        acceleratedDeductions: z.number().optional(), // Bring forward deductions
        assetPurchases: z.number().optional(), // New asset purchases for instant write-off
        div7aLoanReduction: z.number().optional(), // Reduce Division 7A loans
        lossUtilization: z.number().optional(), // Use more tax losses
      }),
    })
  ),
})

type ScenarioInput = z.infer<typeof scenarioSchema>['scenarios'][number]

interface TaxRateConfig {
  corporateTaxRateSmall: Decimal
  corporateTaxRateStandard: Decimal
  rndOffsetRate: Decimal
  taxRateSource: string
  taxRateVerifiedAt: string
}

interface ScenarioResult {
  name: string
  description?: string
  taxableIncome: number
  taxPayable: number
  effectiveTaxRate: number
  rndOffset: number
  netTaxPosition: number // Tax payable minus R&D offset
  savingsVsBase: number
  changes: {
    incomeAdjustment: number
    deductionAdjustment: number
    rndOffsetAdjustment: number
  }
  warnings: string[]
  recommendations: string[]
}

export async function POST(request: NextRequest) {
  let tenantId: string
  let supabase

  if (isSingleUserMode()) {
    tenantId = request.nextUrl.searchParams.get('tenantId') || ''
    if (!tenantId) {
      return createValidationError('tenantId is required')
    }
    supabase = await createServiceClient()
  } else {
    const auth = await requireAuth(request)
    if (isErrorResponse(auth)) return auth
    tenantId = auth.tenantId
    supabase = auth.supabase
  }

  try {
    // Parse and validate request
    const body = await request.json()
    const validation = scenarioSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const { baseYear, scenarios, passiveIncomePercentage } = validation.data

    // Fetch dynamic tax rates
    const rateConfig = await fetchTaxRates(passiveIncomePercentage)

    // Get base year data
    const { data: baseYearResults, error } = await supabase
      .from('forensic_analysis_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('financial_year', baseYear)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!baseYearResults || baseYearResults.length === 0) {
      return NextResponse.json(
        { error: `No data found for ${baseYear}` },
        { status: 404 }
      )
    }

    // Calculate base scenario
    const baseScenario = calculateBaseScenario(baseYearResults, rateConfig, passiveIncomePercentage)

    // Calculate each scenario
    const scenarioResults: ScenarioResult[] = []

    for (const scenario of scenarios) {
      const result = calculateScenario(baseScenario, scenario, baseYearResults, rateConfig, passiveIncomePercentage)
      scenarioResults.push(result)
    }

    // Add comparison insights
    const bestScenario = scenarioResults.reduce((best, current) =>
      current.netTaxPosition < best.netTaxPosition ? current : best
    )

    return NextResponse.json({
      baseYear,
      taxRateSource: rateConfig.taxRateSource,
      taxRateVerifiedAt: rateConfig.taxRateVerifiedAt,
      baseScenario: {
        name: 'Current Position',
        ...baseScenario,
        savingsVsBase: 0,
        warnings: [],
        recommendations: [],
      },
      scenarios: scenarioResults,
      insights: {
        bestScenario: bestScenario.name,
        maxSavings: Math.max(...scenarioResults.map((s) => s.savingsVsBase)),
        scenarioComparison: scenarioResults.map((s) => ({
          name: s.name,
          netTaxPosition: s.netTaxPosition,
          savingsVsBase: s.savingsVsBase,
          effectiveTaxRate: s.effectiveTaxRate,
        })),
      },
    })
  } catch (error: unknown) {
    console.error('Failed to calculate scenarios:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Fetch dynamic tax rates from cache manager with fallback
 */
async function fetchTaxRates(passiveIncomePercentage?: number): Promise<TaxRateConfig> {
  try {
    const rates = await getCurrentTaxRates()

    // Passive income test: if >80% passive income, entity pays standard rate (30%) not base rate (25%)
    // per s 23AA ITAA 1997
    const useStandardRateForSmall = passiveIncomePercentage !== undefined && passiveIncomePercentage > 80

    const corporateTaxRateSmall = useStandardRateForSmall
      ? new Decimal(rates.corporateTaxRateStandard ?? FALLBACK_STANDARD_TAX_RATE)
      : new Decimal(rates.corporateTaxRateSmall ?? FALLBACK_CORPORATE_TAX_RATE)

    return {
      corporateTaxRateSmall,
      corporateTaxRateStandard: new Decimal(rates.corporateTaxRateStandard ?? FALLBACK_STANDARD_TAX_RATE),
      rndOffsetRate: new Decimal(rates.rndOffsetRateSmallBusiness ?? rates.rndOffsetRate ?? FALLBACK_RND_OFFSET_RATE),
      taxRateSource: rates.sources?.corporateTax || (rates.cacheHit ? 'cached' : 'fallback_FY2024-25'),
      taxRateVerifiedAt: rates.fetchedAt ? new Date(rates.fetchedAt).toISOString() : new Date().toISOString(),
    }
  } catch (error) {
    console.warn('Failed to fetch live tax rates, using fallback:', error)
    return {
      corporateTaxRateSmall: new Decimal(
        passiveIncomePercentage !== undefined && passiveIncomePercentage > 80
          ? FALLBACK_STANDARD_TAX_RATE
          : FALLBACK_CORPORATE_TAX_RATE
      ),
      corporateTaxRateStandard: new Decimal(FALLBACK_STANDARD_TAX_RATE),
      rndOffsetRate: new Decimal(FALLBACK_RND_OFFSET_RATE),
      taxRateSource: 'fallback_FY2024-25',
      taxRateVerifiedAt: new Date().toISOString(),
    }
  }
}

/**
 * Determine the applicable corporate tax rate using Decimal.js
 *
 * Base rate entity requires BOTH:
 * 1. Aggregated turnover < $50M
 * 2. No more than 80% passive income (s 23AA ITAA 1997)
 *
 * The passive income test is pre-applied in fetchTaxRates(), so corporateTaxRateSmall
 * already reflects the correct rate based on passive income percentage.
 */
function getTaxRate(taxableIncome: Decimal, rateConfig: TaxRateConfig): Decimal {
  const threshold = new Decimal(50_000_000)
  return taxableIncome.lt(threshold)
    ? rateConfig.corporateTaxRateSmall
    : rateConfig.corporateTaxRateStandard
}

/**
 * Calculate base scenario from actual data using Decimal.js
 */
function calculateBaseScenario(
  results: ForensicAnalysisRow[],
  rateConfig: TaxRateConfig,
  passiveIncomePercentage?: number,
) {
  let totalIncome = new Decimal(0)
  for (const r of results) {
    const amount = new Decimal(r.transaction_amount ?? 0)
    if (amount.gt(0)) {
      totalIncome = totalIncome.plus(amount)
    }
  }

  let totalExpenses = new Decimal(0)
  for (const r of results) {
    const amount = new Decimal(r.transaction_amount ?? 0)
    if (amount.lt(0)) {
      totalExpenses = totalExpenses.plus(amount.abs())
    }
  }

  const rndCandidates = results.filter((r) => r.is_rnd_candidate)
  let rndExpenditure = new Decimal(0)
  for (const r of rndCandidates) {
    rndExpenditure = rndExpenditure.plus(new Decimal(r.transaction_amount || 0).abs())
  }

  const taxableIncome = totalIncome.minus(totalExpenses)
  const rndOffset = rndExpenditure.times(rateConfig.rndOffsetRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  // Determine tax rate
  const taxRate = getTaxRate(taxableIncome, rateConfig)
  const taxPayable = Decimal.max(new Decimal(0), taxableIncome.times(taxRate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  const netTaxPosition = taxPayable.minus(rndOffset)
  const effectiveTaxRate = taxableIncome.gt(0)
    ? netTaxPosition.div(taxableIncome).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
    : 0

  const warnings: string[] = []
  if (passiveIncomePercentage !== undefined && passiveIncomePercentage > 80) {
    warnings.push(
      `Passive income percentage (${passiveIncomePercentage}%) exceeds 80% — entity does not qualify as base rate entity (s 23AA ITAA 1997). Standard 30% corporate rate applied.`
    )
  }

  return {
    taxableIncome: taxableIncome.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    taxPayable: taxPayable.toNumber(),
    effectiveTaxRate,
    rndOffset: rndOffset.toNumber(),
    netTaxPosition: Decimal.max(new Decimal(0), netTaxPosition).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    changes: {
      incomeAdjustment: 0,
      deductionAdjustment: 0,
      rndOffsetAdjustment: 0,
    },
    warnings,
  }
}

/**
 * Calculate scenario with changes using Decimal.js
 */
function calculateScenario(
  base: ReturnType<typeof calculateBaseScenario>,
  scenario: ScenarioInput,
  _results: ForensicAnalysisRow[],
  rateConfig: TaxRateConfig,
  passiveIncomePercentage?: number,
): ScenarioResult {
  const changes = scenario.changes
  const warnings: string[] = [...base.warnings]
  const recommendations: string[] = []

  // Apply changes using Decimal
  let incomeAdjustment = new Decimal(changes.deferredIncome || 0).neg() // Reduce income
  let deductionAdjustment = new Decimal(changes.acceleratedDeductions || 0)
    .plus(new Decimal(changes.assetPurchases || 0)) // Increase deductions
  const rndOffsetAdjustment = new Decimal(changes.additionalRndClaim || 0)
    .times(rateConfig.rndOffsetRate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  // Apply Division 7A loan reduction (reduces deemed dividends)
  if (changes.div7aLoanReduction) {
    // Loan reduction may reduce deemed dividend income
    const deemedDividendReduction = new Decimal(changes.div7aLoanReduction).times(new Decimal('0.1'))
    incomeAdjustment = incomeAdjustment.minus(deemedDividendReduction)
    warnings.push(
      'Division 7A loan reduction may require actual cash payment to company.'
    )
  }

  // Apply loss utilization
  if (changes.lossUtilization) {
    deductionAdjustment = deductionAdjustment.plus(new Decimal(changes.lossUtilization))
    warnings.push('Ensure loss continuity tests (COT or SBT) are satisfied.')
  }

  // Calculate new position
  const baseTaxableIncome = new Decimal(base.taxableIncome)
  const baseRndOffset = new Decimal(base.rndOffset)
  const baseNetTaxPosition = new Decimal(base.netTaxPosition)

  const newTaxableIncome = baseTaxableIncome.plus(incomeAdjustment).minus(deductionAdjustment)
  const newRndOffset = baseRndOffset.plus(rndOffsetAdjustment)

  const taxRate = getTaxRate(newTaxableIncome, rateConfig)
  const newTaxPayable = Decimal.max(new Decimal(0), newTaxableIncome.times(taxRate))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  const newNetTaxPosition = Decimal.max(new Decimal(0), newTaxPayable.minus(newRndOffset))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  const savingsVsBase = baseNetTaxPosition.minus(newNetTaxPosition)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  const effectiveTaxRate = newTaxableIncome.gt(0)
    ? newNetTaxPosition.div(newTaxableIncome).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
    : 0

  // Generate warnings
  if (changes.deferredIncome && new Decimal(changes.deferredIncome).gt(baseTaxableIncome.times(new Decimal('0.2')))) {
    warnings.push(
      'Deferring >20% of income may trigger ATO scrutiny. Ensure deferrals are genuine.'
    )
  }

  if (changes.additionalRndClaim) {
    warnings.push(
      'Additional R&D claims must be supported by comprehensive documentation and compliance with Division 355.'
    )
    recommendations.push(
      'Consider advance finding from AusIndustry before lodging larger R&D claims.'
    )
  }

  if (changes.assetPurchases) {
    recommendations.push(
      'Ensure assets are purchased and installed ready for use before June 30 to claim instant write-off.'
    )
  }

  // Generate recommendations
  const savingsNum = savingsVsBase.toNumber()
  if (savingsNum > 10000) {
    recommendations.push(
      `This scenario could save $${savingsNum.toLocaleString()} in tax. Consider implementing before year-end.`
    )
  }

  if (newNetTaxPosition.eq(0) && newRndOffset.gt(newTaxPayable)) {
    const refund = newRndOffset.minus(newTaxPayable).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
    recommendations.push(
      `Potential R&D tax refund of $${refund.toLocaleString()}. Ensure all eligible expenditure is claimed.`
    )
  }

  return {
    name: scenario.name,
    description: scenario.description,
    taxableIncome: newTaxableIncome.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    taxPayable: newTaxPayable.toNumber(),
    effectiveTaxRate,
    rndOffset: newRndOffset.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    netTaxPosition: newNetTaxPosition.toNumber(),
    savingsVsBase: savingsNum,
    changes: {
      incomeAdjustment: incomeAdjustment.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      deductionAdjustment: deductionAdjustment.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      rndOffsetAdjustment: rndOffsetAdjustment.toNumber(),
    },
    warnings,
    recommendations,
  }
}
