/**
 * PAYG Instalment Engine (Division 45 Schedule 1 TAA 1953)
 *
 * Calculates and optimises Pay As You Go (PAYG) instalment obligations.
 * Supports both instalment amount and instalment rate methods.
 *
 * Key Rules:
 * - Quarterly instalments due 28 days after quarter end (28 Oct, 28 Feb, 28 Apr, 28 Aug)
 * - Annual instalment option for small businesses
 * - Varied instalments allowed but penalty risk if variation is < 85% of actual liability (s 45-235)
 * - GIC (General Interest Charge) applies to shortfalls (~10%+ p.a.)
 *
 * Legislation:
 * - Division 45 Schedule 1 TAA 1953
 * - Section 45-235: Penalty for excessive variation
 * - Section 45-112: GDP-adjusted instalments
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentFinancialYear, getBASQuarter } from '@/lib/utils/financial-year'
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'
import Decimal from 'decimal.js'

// PAYG constants
const VARIATION_SAFE_HARBOUR = 0.85 // 85% of actual liability is the safe harbour
const GIC_RATE_APPROX = 0.1126 // ~11.26% p.a. (GIC rate changes quarterly, this is approximate)
const SMALL_BUSINESS_TURNOVER = 10_000_000 // $10M for annual instalment option

/**
 * PAYG instalment method.
 */
export type InstalmentMethod = 'amount' | 'rate'

/**
 * Single quarter instalment calculation.
 */
export interface QuarterlyInstalment {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  financialYear: string
  periodStart: Date
  periodEnd: Date
  dueDate: Date

  // Instalment calculation
  instalmentIncome: number // Instalment income for the quarter
  instalmentRate: number // Rate applied (e.g., 0.08 = 8%)
  instalmentAmount: number // Amount payable
  gdpAdjustment: number // GDP adjustment factor (s 45-112)

  // Variation analysis
  recommendedVariation: number | null // Suggested varied amount (if beneficial)
  variationRisk: 'none' | 'low' | 'medium' | 'high' // Risk of penalty from variation
  variationPenaltyEstimate: number // Estimated GIC if variation is too aggressive

  // Status
  isPaid: boolean
  isOverdue: boolean
  daysUntilDue: number
}

/**
 * Annual instalment summary.
 */
export interface AnnualInstalmentSummary {
  financialYear: string
  totalInstalmentsPaid: number
  estimatedTaxLiability: number
  shortfall: number // Underpayment
  excess: number // Overpayment (potential refund)
  effectiveTaxRate: number
}

/**
 * PAYG instalment analysis result.
 */
export interface PAYGInstalmentAnalysis {
  tenantId: string
  financialYear: string

  // Method
  currentMethod: InstalmentMethod
  recommendedMethod: InstalmentMethod
  methodChangeNote: string

  // Quarterly breakdown
  quarters: QuarterlyInstalment[]
  totalInstalmentsDue: number
  totalInstalmentsPaid: number

  // Tax liability estimate
  estimatedAnnualIncome: number
  estimatedTaxLiability: number
  estimatedShortfall: number
  estimatedExcess: number

  // Variation analysis
  variationRecommended: boolean
  variationAmount: number | null
  variationRiskAssessment: string
  /** Penalty risk warning for excessive variation (s 45-235 TAA 1953) */
  variationPenaltyWarning: string | null

  // Cashflow impact
  cashflowImpact: {
    quarterlyAmount: number
    annualAmount: number
    optimisedQuarterlyAmount: number
    cashflowSaving: number
  }

  // Metadata
  confidence: number
  recommendations: string[]
  legislativeReferences: string[]
  taxRateSource: string
  taxRateVerifiedAt: string
}

/**
 * Options for PAYG instalment analysis.
 */
export interface PAYGAnalysisOptions {
  /** Current instalment method */
  currentMethod?: InstalmentMethod
  /** ATO-notified instalment rate (e.g., 0.08 for 8%) */
  notifiedRate?: number
  /** ATO-notified instalment amount */
  notifiedAmount?: number
  /** Whether the entity has varied instalments this FY */
  hasVaried?: boolean
  /** Current varied amount (if applicable) */
  variedAmount?: number
  /** Annual turnover for method eligibility */
  annualTurnover?: number
  /** Corporate tax rate */
  corporateTaxRate?: number
  /** Prior year tax liability */
  priorYearTaxLiability?: number
}

/**
 * Analyze PAYG instalment position for a tenant.
 */
export async function analyzePAYGInstalments(
  tenantId: string,
  financialYear?: string,
  options?: PAYGAnalysisOptions
): Promise<PAYGInstalmentAnalysis> {
  const fy = financialYear || getCurrentFinancialYear()
  const supabase = await createServiceClient()

  // Fetch income data to estimate instalment income per quarter
  const { data: transactions, error } = await supabase
    .from('historical_transactions_cache')
    .select('raw_data, financial_year')
    .eq('tenant_id', tenantId)
    .eq('financial_year', fy)

  if (error) {
    console.error('Failed to fetch transactions for PAYG analysis:', error)
    throw new Error(`Failed to fetch transactions: ${error.message}`)
  }

  // Get tax rates
  let corporateTaxRate = options?.corporateTaxRate ?? 0.25
  let taxRateSource = 'fallback'
  try {
    const rates = await getCurrentTaxRates()
    if (rates.corporateTaxRateSmall) corporateTaxRate = rates.corporateTaxRateSmall
    taxRateSource = rates.sources.corporateTax || 'ATO'
  } catch {
    // Use fallback
  }

  // Parse transactions into quarterly income
  const quarterlyIncome = calculateQuarterlyIncome(transactions || [], fy)

  // Determine method
  const currentMethod = options?.currentMethod ?? 'rate'
  const notifiedRate = options?.notifiedRate ?? corporateTaxRate
  const notifiedAmount = options?.notifiedAmount ?? 0

  // Calculate quarterly instalments
  const now = new Date()
  const quarters = calculateQuarterlyInstalments(
    fy, quarterlyIncome, currentMethod, notifiedRate, notifiedAmount, now, options
  )

  // Estimate annual position
  const totalInstalmentsDue = quarters.reduce((sum, q) => sum + q.instalmentAmount, 0)
  const totalInstalmentsPaid = quarters.filter(q => q.isPaid).reduce((sum, q) => sum + q.instalmentAmount, 0)

  const estimatedAnnualIncome = Object.values(quarterlyIncome).reduce((sum, v) => sum + v, 0)
  const estimatedTaxLiability = new Decimal(estimatedAnnualIncome)
    .times(new Decimal(corporateTaxRate))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber()

  const estimatedShortfall = Math.max(0, estimatedTaxLiability - totalInstalmentsDue)
  const estimatedExcess = Math.max(0, totalInstalmentsDue - estimatedTaxLiability)

  // Variation analysis
  const variationAnalysis = analyzeVariation(
    totalInstalmentsDue, estimatedTaxLiability, options
  )

  // Method recommendation
  const { recommendedMethod, methodChangeNote } = recommendMethod(
    currentMethod, estimatedAnnualIncome, totalInstalmentsDue, estimatedTaxLiability, options
  )

  // Cashflow impact
  const cashflowImpact = calculateCashflowImpact(quarters, estimatedTaxLiability)

  // Recommendations
  const recommendations = generatePAYGRecommendations(
    quarters, variationAnalysis, estimatedShortfall, estimatedExcess, currentMethod, recommendedMethod
  )

  return {
    tenantId,
    financialYear: fy,
    currentMethod,
    recommendedMethod,
    methodChangeNote,
    quarters,
    totalInstalmentsDue,
    totalInstalmentsPaid,
    estimatedAnnualIncome,
    estimatedTaxLiability,
    estimatedShortfall,
    estimatedExcess,
    variationRecommended: variationAnalysis.recommended,
    variationAmount: variationAnalysis.amount,
    variationRiskAssessment: variationAnalysis.riskAssessment,
    variationPenaltyWarning: variationAnalysis.penaltyWarning,
    cashflowImpact,
    confidence: 60, // Moderate - depends on income estimates
    recommendations,
    legislativeReferences: [
      'Division 45 Schedule 1 TAA 1953 - PAYG instalments',
      's 45-112 TAA 1953 - GDP-adjusted instalments',
      's 45-235 TAA 1953 - Penalty for excessive variation',
      's 8AAB TAA 1953 - General Interest Charge',
    ],
    taxRateSource,
    taxRateVerifiedAt: new Date().toISOString(),
  }
}

/**
 * Calculate income per BAS quarter from transaction data.
 */
function calculateQuarterlyIncome(
  transactions: any[],
  _fy: string
): Record<string, number> {
  const income: Record<string, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }

  const rawTxs = transactions.flatMap((t: any) => {
    const raw = t.raw_data
    return Array.isArray(raw) ? raw : [raw]
  })

  rawTxs.forEach((tx: any) => {
    if (tx.Type !== 'ACCREC' && !(tx.Type === 'BANK' && parseFloat(tx.Total) > 0)) return
    const amount = Math.abs(parseFloat(tx.Total) || 0)
    const dateStr = tx.Date || tx.DateString
    if (!dateStr) return

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return

    const { quarter } = getBASQuarter(date)
    income[quarter] = (income[quarter] || 0) + amount
  })

  return income
}

/**
 * Calculate quarterly instalments.
 */
function calculateQuarterlyInstalments(
  fy: string,
  quarterlyIncome: Record<string, number>,
  method: InstalmentMethod,
  notifiedRate: number,
  notifiedAmount: number,
  now: Date,
  options?: PAYGAnalysisOptions
): QuarterlyInstalment[] {
  // Parse FY to get dates
  const fyMatch = fy.match(/^FY(\d{4})-(\d{2})$/)
  if (!fyMatch) return []

  const startYear = parseInt(fyMatch[1], 10)

  // Define quarters
  const quarterDefs = [
    { quarter: 'Q1' as const, startMonth: 6, startYear, endMonth: 8, dueMonth: 9, dueDay: 28 },
    { quarter: 'Q2' as const, startMonth: 9, startYear, endMonth: 11, dueMonth: 1, dueDay: 28, dueYearOffset: 1 },
    { quarter: 'Q3' as const, startMonth: 0, startYear: startYear + 1, endMonth: 2, dueMonth: 3, dueDay: 28 },
    { quarter: 'Q4' as const, startMonth: 3, startYear: startYear + 1, endMonth: 5, dueMonth: 7, dueDay: 28 },
  ]

  return quarterDefs.map((qd) => {
    const periodStart = new Date(qd.startYear, qd.startMonth, 1)
    const periodEnd = new Date(
      qd.endMonth === 8 || qd.endMonth === 2 || qd.endMonth === 5
        ? (qd.endMonth === 8 ? qd.startYear : qd.startYear + 1)
        : qd.startYear,
      qd.endMonth,
      qd.endMonth === 8 ? 30 : qd.endMonth === 11 ? 31 : qd.endMonth === 2 ? 31 : 30
    )
    const dueYear = qd.dueYearOffset ? qd.startYear + qd.dueYearOffset : (qd.quarter === 'Q3' || qd.quarter === 'Q4' ? startYear + 1 : startYear)
    const dueDate = new Date(dueYear, qd.dueMonth, qd.dueDay)

    const instalmentIncome = quarterlyIncome[qd.quarter] || 0
    let instalmentAmount: number

    if (method === 'rate') {
      instalmentAmount = new Decimal(instalmentIncome)
        .times(new Decimal(notifiedRate))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber()
    } else {
      instalmentAmount = notifiedAmount / 4 // Divide annual amount by 4 quarters
    }

    // Apply variation if specified
    if (options?.hasVaried && options.variedAmount !== undefined) {
      instalmentAmount = options.variedAmount / 4
    }

    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const isOverdue = daysUntilDue < 0
    const isPaid = isOverdue // Assume past quarters are paid (conservative)

    return {
      quarter: qd.quarter,
      financialYear: fy,
      periodStart,
      periodEnd,
      dueDate,
      instalmentIncome,
      instalmentRate: notifiedRate,
      instalmentAmount,
      gdpAdjustment: 1.0, // GDP adjustment applied by ATO to notified amounts
      recommendedVariation: null,
      variationRisk: 'none' as const,
      variationPenaltyEstimate: 0,
      isPaid,
      isOverdue,
      daysUntilDue,
    }
  })
}

/**
 * Analyze whether variation is beneficial and assess penalty risk.
 */
function analyzeVariation(
  totalInstalmentsDue: number,
  estimatedTaxLiability: number,
  options?: PAYGAnalysisOptions
): {
  recommended: boolean
  amount: number | null
  riskAssessment: string
  penaltyWarning: string | null
} {
  // If instalments significantly exceed likely liability, variation may be beneficial
  const overpayment = totalInstalmentsDue - estimatedTaxLiability

  if (overpayment <= 0) {
    return {
      recommended: false,
      amount: null,
      riskAssessment: 'Instalments are at or below estimated liability. No variation needed.',
      penaltyWarning: null,
    }
  }

  // Calculate safe harbour amount (85% of actual liability)
  const safeHarbourAmount = new Decimal(estimatedTaxLiability)
    .times(new Decimal(VARIATION_SAFE_HARBOUR))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber()

  // Penalty risk if varied below 85% of actual
  const penaltyWarning = estimatedTaxLiability > 0
    ? `WARNING: If varied amount is less than 85% of actual tax liability ($${safeHarbourAmount.toLocaleString()}), ` +
      `General Interest Charge applies at ~${(GIC_RATE_APPROX * 100).toFixed(2)}% p.a. on the shortfall (s 45-235 TAA 1953).`
    : null

  return {
    recommended: overpayment > totalInstalmentsDue * 0.1, // Recommend if >10% overpayment
    amount: safeHarbourAmount,
    riskAssessment: `Instalments exceed estimated liability by $${overpayment.toLocaleString()}. ` +
      `Safe harbour variation: $${safeHarbourAmount.toLocaleString()} (85% of estimated liability).`,
    penaltyWarning,
  }
}

/**
 * Recommend instalment method.
 */
function recommendMethod(
  currentMethod: InstalmentMethod,
  estimatedIncome: number,
  totalInstalments: number,
  estimatedTax: number,
  options?: PAYGAnalysisOptions
): { recommendedMethod: InstalmentMethod; methodChangeNote: string } {
  const turnover = options?.annualTurnover ?? estimatedIncome

  // Rate method is better for volatile income (closer to actual liability)
  // Amount method is simpler for stable income
  if (currentMethod === 'amount' && totalInstalments > estimatedTax * 1.2) {
    return {
      recommendedMethod: 'rate',
      methodChangeNote: 'Consider switching to rate method. Your notified amount appears to exceed your likely tax liability by >20%.',
    }
  }

  if (currentMethod === 'rate' && turnover < SMALL_BUSINESS_TURNOVER) {
    return {
      recommendedMethod: currentMethod,
      methodChangeNote: 'Rate method is appropriate for your income level. Annual instalment option also available for turnover < $10M.',
    }
  }

  return {
    recommendedMethod: currentMethod,
    methodChangeNote: `Current ${currentMethod} method appears appropriate. No change recommended.`,
  }
}

/**
 * Calculate cashflow impact of instalments.
 */
function calculateCashflowImpact(
  quarters: QuarterlyInstalment[],
  estimatedTax: number
): {
  quarterlyAmount: number
  annualAmount: number
  optimisedQuarterlyAmount: number
  cashflowSaving: number
} {
  const annualAmount = quarters.reduce((sum, q) => sum + q.instalmentAmount, 0)
  const quarterlyAmount = annualAmount / 4
  const optimisedQuarterlyAmount = estimatedTax / 4

  return {
    quarterlyAmount,
    annualAmount,
    optimisedQuarterlyAmount,
    cashflowSaving: Math.max(0, annualAmount - estimatedTax),
  }
}

/**
 * Generate recommendations.
 */
function generatePAYGRecommendations(
  quarters: QuarterlyInstalment[],
  variationAnalysis: { recommended: boolean; amount: number | null; penaltyWarning: string | null },
  shortfall: number,
  excess: number,
  currentMethod: InstalmentMethod,
  recommendedMethod: InstalmentMethod
): string[] {
  const recommendations: string[] = []

  // Overdue quarters
  const overdueQuarters = quarters.filter(q => q.isOverdue && !q.isPaid)
  if (overdueQuarters.length > 0) {
    recommendations.push(
      `URGENT: ${overdueQuarters.length} quarter(s) are overdue. GIC applies from due date at ~${(GIC_RATE_APPROX * 100).toFixed(2)}% p.a.`
    )
  }

  // Upcoming deadlines
  const upcomingQuarters = quarters.filter(q => !q.isOverdue && q.daysUntilDue <= 30)
  if (upcomingQuarters.length > 0) {
    upcomingQuarters.forEach(q => {
      recommendations.push(
        `${q.quarter} instalment of $${q.instalmentAmount.toLocaleString()} due in ${q.daysUntilDue} days (${q.dueDate.toISOString().split('T')[0]}).`
      )
    })
  }

  // Variation
  if (variationAnalysis.recommended && variationAnalysis.amount !== null) {
    recommendations.push(
      `Consider varying instalments to $${variationAnalysis.amount.toLocaleString()} annually to improve cashflow.`
    )
  }
  if (variationAnalysis.penaltyWarning) {
    recommendations.push(variationAnalysis.penaltyWarning)
  }

  // Shortfall/excess
  if (shortfall > 1000) {
    recommendations.push(
      `Estimated shortfall of $${shortfall.toLocaleString()} at year end. Consider increasing instalment to avoid end-of-year bill.`
    )
  }
  if (excess > 1000) {
    recommendations.push(
      `Estimated overpayment of $${excess.toLocaleString()}. This will be credited in your tax return.`
    )
  }

  // Method change
  if (currentMethod !== recommendedMethod) {
    recommendations.push(
      `Consider switching from ${currentMethod} method to ${recommendedMethod} method for better alignment with actual income.`
    )
  }

  recommendations.push(
    'Review instalment amounts at least quarterly to ensure alignment with actual business performance.'
  )

  return recommendations
}
