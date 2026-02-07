/**
 * Scenario Modeling API
 *
 * What-if analysis for tax optimization strategies
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { createValidationError } from '@/lib/api/errors'
import { z } from 'zod'
import Decimal from 'decimal.js'
import { isSingleUserMode } from '@/lib/auth/single-user-check'

// Tax rates for FY2024-25
const CORPORATE_TAX_RATE = 0.25 // 25% for base rate entities
const STANDARD_TAX_RATE = 0.30 // 30% standard rate
const RND_OFFSET_RATE = 0.435 // 43.5% for companies with turnover < $20M

// Validation schema
const scenarioSchema = z.object({
  tenantId: z.string().uuid(),
  baseYear: z.string(), // e.g., "FY2023-24"
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

    const { baseYear, scenarios } = validation.data

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
    const baseScenario = calculateBaseScenario(baseYearResults)

    // Calculate each scenario
    const scenarioResults: ScenarioResult[] = []

    for (const scenario of scenarios) {
      const result = calculateScenario(baseScenario, scenario, baseYearResults)
      scenarioResults.push(result)
    }

    // Add comparison insights
    const bestScenario = scenarioResults.reduce((best, current) =>
      current.netTaxPosition < best.netTaxPosition ? current : best
    )

    return NextResponse.json({
      baseYear,
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
 * Calculate base scenario from actual data
 */
function calculateBaseScenario(results: any[]) {
  const totalIncome = results.reduce((sum, r) => {
    // Positive amounts are income
    return r.transaction_amount > 0 ? sum + r.transaction_amount : sum
  }, 0)

  const totalExpenses = results.reduce((sum, r) => {
    // Negative amounts are expenses
    return r.transaction_amount < 0 ? sum + Math.abs(r.transaction_amount) : sum
  }, 0)

  const rndCandidates = results.filter((r) => r.is_rnd_candidate)
  const rndExpenditure = rndCandidates.reduce(
    (sum, r) => sum + Math.abs(r.transaction_amount || 0),
    0
  )

  const taxableIncome = totalIncome - totalExpenses
  const rndOffset = rndExpenditure * RND_OFFSET_RATE

  // Determine tax rate (simplified - assumes base rate entity)
  const taxRate = taxableIncome < 50_000_000 ? CORPORATE_TAX_RATE : STANDARD_TAX_RATE
  const taxPayable = Math.max(0, taxableIncome * taxRate)

  const netTaxPosition = taxPayable - rndOffset
  const effectiveTaxRate = taxableIncome > 0 ? (netTaxPosition / taxableIncome) * 100 : 0

  return {
    taxableIncome,
    taxPayable,
    effectiveTaxRate,
    rndOffset,
    netTaxPosition: Math.max(0, netTaxPosition),
    changes: {
      incomeAdjustment: 0,
      deductionAdjustment: 0,
      rndOffsetAdjustment: 0,
    },
  }
}

/**
 * Calculate scenario with changes
 */
function calculateScenario(
  base: ReturnType<typeof calculateBaseScenario>,
  scenario: any,
  results: any[]
): ScenarioResult {
  const changes = scenario.changes
  const warnings: string[] = []
  const recommendations: string[] = []

  // Apply changes
  let incomeAdjustment = -(changes.deferredIncome || 0) // Reduce income
  let deductionAdjustment =
    (changes.acceleratedDeductions || 0) + (changes.assetPurchases || 0) // Increase deductions
  const rndOffsetAdjustment = (changes.additionalRndClaim || 0) * RND_OFFSET_RATE

  // Apply Division 7A loan reduction (reduces deemed dividends)
  if (changes.div7aLoanReduction) {
    // Loan reduction may reduce deemed dividend income
    const deemedDividendReduction = changes.div7aLoanReduction * 0.1 // Estimate
    incomeAdjustment -= deemedDividendReduction
    warnings.push(
      'Division 7A loan reduction may require actual cash payment to company.'
    )
  }

  // Apply loss utilization
  if (changes.lossUtilization) {
    deductionAdjustment += changes.lossUtilization
    warnings.push('Ensure loss continuity tests (COT or SBT) are satisfied.')
  }

  // Calculate new position
  const newTaxableIncome = base.taxableIncome + incomeAdjustment - deductionAdjustment
  const newRndOffset = base.rndOffset + rndOffsetAdjustment

  const taxRate =
    newTaxableIncome < 50_000_000 ? CORPORATE_TAX_RATE : STANDARD_TAX_RATE
  const newTaxPayable = Math.max(0, newTaxableIncome * taxRate)

  const newNetTaxPosition = Math.max(0, newTaxPayable - newRndOffset)
  const savingsVsBase = base.netTaxPosition - newNetTaxPosition

  const effectiveTaxRate =
    newTaxableIncome > 0 ? (newNetTaxPosition / newTaxableIncome) * 100 : 0

  // Generate warnings
  if (changes.deferredIncome && changes.deferredIncome > base.taxableIncome * 0.2) {
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
  if (savingsVsBase > 10000) {
    recommendations.push(
      `This scenario could save $${savingsVsBase.toLocaleString()} in tax. Consider implementing before year-end.`
    )
  }

  if (newNetTaxPosition === 0 && newRndOffset > newTaxPayable) {
    const refund = newRndOffset - newTaxPayable
    recommendations.push(
      `Potential R&D tax refund of $${refund.toLocaleString()}. Ensure all eligible expenditure is claimed.`
    )
  }

  return {
    name: scenario.name,
    description: scenario.description,
    taxableIncome: newTaxableIncome,
    taxPayable: newTaxPayable,
    effectiveTaxRate,
    rndOffset: newRndOffset,
    netTaxPosition: newNetTaxPosition,
    savingsVsBase,
    changes: {
      incomeAdjustment,
      deductionAdjustment,
      rndOffsetAdjustment,
    },
    warnings,
    recommendations,
  }
}
