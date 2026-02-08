/**
 * Loss Carry-Forward Optimization Engine (Division 36 & 165 ITAA 1997)
 *
 * Analyzes historical loss positions and optimizes utilization:
 * - Division 36: Company tax losses
 * - Division 165: Special rules for loss recoupment
 * - COT (Continuity of Ownership Test)
 * - SBT (Same Business Test)
 * - Loss utilization optimization
 * - Future tax value calculation
 */

import { createServiceClient, type SupabaseServiceClient } from '@/lib/supabase/server'
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'
import { checkAmendmentPeriod, type EntityTypeForAmendment } from '@/lib/utils/financial-year'
import Decimal from 'decimal.js'
import { createLogger } from '@/lib/logger'

const log = createLogger('analysis:loss')

// Fallback tax rates - s 23AA and s 23 ITAA 1997
const FALLBACK_CORPORATE_TAX_RATE_SMALL = 0.25 // 25% base rate entity
const FALLBACK_CORPORATE_TAX_RATE_STANDARD = 0.30 // 30% standard corporate rate

// Entity types for tax rate determination
export type EntityType = 'company' | 'trust' | 'partnership' | 'individual' | 'unknown'

/**
 * Loss type classification.
 * Capital losses can ONLY offset capital gains (s 102-5 ITAA 1997).
 * Revenue losses can offset assessable income (Division 36 ITAA 1997).
 */
export type LossType = 'revenue' | 'capital'

// COT/SBT thresholds
const _COT_OWNERSHIP_THRESHOLD = 0.50 // 50% ownership continuity required (reserved for future use)
const _SBT_LOOKBACK_YEARS = 3 // Look back 3 years to determine "same business" (reserved for future use)

/**
 * Determine the applicable corporate tax rate based on entity type.
 * s 23AA ITAA 1997 - Base rate entity (turnover < $50M): 25%
 * s 23 ITAA 1997 - Standard corporate rate: 30%
 * Trusts: tax benefit depends on beneficiary marginal rates (no fixed rate)
 */
/**
 * Determine the applicable corporate tax rate based on entity type.
 */
async function getApplicableTaxRate(
  entityType: EntityType = 'unknown',
  isBaseRateEntity: boolean = false
): Promise<{ rate: number; note: string; source: string }> {
  let rateSmall = FALLBACK_CORPORATE_TAX_RATE_SMALL
  let rateStandard = FALLBACK_CORPORATE_TAX_RATE_STANDARD
  let source = 'ATO_FALLBACK_DEFAULT'

  try {
    const liveRates = await getCurrentTaxRates()
    if (liveRates.corporateTaxRateSmall) rateSmall = liveRates.corporateTaxRateSmall
    if (liveRates.corporateTaxRateStandard) rateStandard = liveRates.corporateTaxRateStandard
    if (liveRates.sources.corporateTax) source = liveRates.sources.corporateTax
  } catch (err) {
    console.warn('Failed to fetch live corporate rates, using fallbacks', err)
  }

  switch (entityType) {
    case 'company':
      if (isBaseRateEntity) {
        return {
          rate: rateSmall,
          note: 'Base rate entity (turnover < $50M) - 25% rate per s 23AA ITAA 1997',
          source
        }
      }
      return {
        rate: rateStandard,
        note: 'Standard corporate rate - 30% per s 23 ITAA 1997',
        source
      }
    case 'trust':
      return {
        rate: rateStandard,
        note: 'Trust: tax benefit depends on beneficiary marginal rates. 30% used as conservative estimate. Professional review required.',
        source
      }
    case 'partnership':
      return {
        rate: rateStandard,
        note: 'Partnership: tax benefit depends on partner marginal rates. 30% used as conservative estimate.',
        source
      }
    case 'individual':
      return {
        rate: rateStandard,
        note: 'Individual: actual benefit depends on marginal tax rate. 30% used as conservative estimate.',
        source
      }
    case 'unknown':
    default:
      return {
        rate: rateStandard,
        note: 'Entity type unknown - defaulting to 30% standard corporate rate (conservative). Verify entity type for accurate calculation.',
        source
      }
  }
}

export interface LossPosition {
  financialYear: string
  openingLossBalance: number
  currentYearLoss: number // Loss incurred this year (if any)
  currentYearProfit: number // Profit this year (if any)
  lossesUtilized: number // Losses used to offset profit
  lossesExpired: number // Losses that expired (failed COT/SBT)
  closingLossBalance: number // Carried forward to next year
  taxableIncome: number // After loss utilisation
  amendmentPeriodWarning?: string // Warning if FY is outside amendment period
  /**
   * Loss type classification (s 102-5 ITAA 1997).
   * - 'revenue': Can offset assessable income (Division 36)
   * - 'capital': Can ONLY offset capital gains, never assessable income
   * Defaults to 'revenue' for backward compatibility.
   */
  lossType: LossType
}

export interface CotSbtAnalysis {
  cotSatisfied: boolean | 'unknown'
  cotConfidence: number
  cotNotes: string[]
  sbtRequired: boolean | 'unknown'
  sbtSatisfied: boolean | 'unknown'
  sbtConfidence: number
  sbtNotes: string[]
  isEligibleForCarryforward: boolean
  professionalReviewRequired: boolean
  riskLevel: 'low' | 'medium' | 'high'
}

export interface LossAnalysis {
  financialYear: string
  openingLossBalance: number
  currentYearLoss: number
  lossesUtilized: number
  closingLossBalance: number
  cotSbtAnalysis: CotSbtAnalysis
  isEligibleForCarryforward: boolean
  futureTaxValue: number // Value of carried forward losses at corporate rate
  /**
   * Loss type classification (s 102-5 ITAA 1997).
   * Capital losses can ONLY offset capital gains, never assessable income.
   */
  lossType: LossType
  optimization: {
    currentStrategy: string
    recommendedStrategy: string
    additionalBenefit: number
    reasoning: string
  }
  recommendations: string[]
}

export interface LossSummary {
  totalAvailableLosses: number
  totalUtilizedLosses: number
  totalExpiredLosses: number
  totalFutureTaxValue: number
  /** Revenue losses available to offset assessable income (Division 36 ITAA 1997) */
  revenueLosses: number
  /** Capital losses available to offset ONLY capital gains (s 102-5 ITAA 1997) */
  capitalLosses: number
  lossesByYear: Record<string, number>
  utilizationRate: number // Percentage of losses utilized
  averageRiskLevel: string
  optimizationOpportunities: LossAnalysis[]
  lossHistory: LossAnalysis[]
  taxRateSource: string
  taxRateVerifiedAt: string
}

/**
 * Analyze loss position across multiple years
 */
export async function analyzeLossPosition(
  tenantId: string,
  startYear?: string,
  endYear?: string,
  entityType: EntityType = 'unknown',
  isBaseRateEntity: boolean = false
): Promise<LossSummary> {
  const supabase = await createServiceClient()

  // Fetch P&L data from cache (would need to implement P&L fetching in historical-fetcher)
  // For now, we'll infer from transaction data
  const lossPositions = await fetchLossPositions(supabase, tenantId, startYear, endYear, entityType)

  if (lossPositions.length === 0) {
    return createEmptyLossSummary()
  }

  log.info('Analysing loss positions', { financialYears: lossPositions.length, entityType })

  // Determine applicable tax rate based on entity type
  const taxRateInfo = await getApplicableTaxRate(entityType, isBaseRateEntity)

  // Analyze each year's loss position
  const lossAnalyses: LossAnalysis[] = []

  for (let i = 0; i < lossPositions.length; i++) {
    const currentYear = lossPositions[i]
    const previousYears = lossPositions.slice(0, i)

    const analysis = analyzeSingleYearLoss(currentYear, previousYears, taxRateInfo)
    lossAnalyses.push(analysis)
  }

  // Calculate summary
  const summary = calculateLossSummary(lossAnalyses, taxRateInfo.source)

  return summary
}

/**
 * Fetch loss positions from historical data
 * This would ideally pull from P&L reports stored in cache
 */
async function fetchLossPositions(
  supabase: SupabaseServiceClient,
  tenantId: string,
  startYear?: string,
  endYear?: string,
  entityType: EntityType = 'unknown'
): Promise<LossPosition[]> {
  // In a complete implementation, this would query historical_transactions_cache
  // and calculate profit/loss per year from transaction totals

  // For now, return placeholder structure
  // Real implementation would:
  // 1. Query all transactions per year
  // 2. Sum income transactions (ACCREC)
  // 3. Sum expense transactions (ACCPAY, BANK with negative amounts)
  // 4. Calculate profit/loss = income - expenses
  // 5. Track carry-forward from previous years

  let query = supabase
    .from('historical_transactions_cache')
    .select('financial_year, raw_data')
    .eq('tenant_id', tenantId)

  if (startYear) {
    query = query.gte('financial_year', startYear)
  }
  if (endYear) {
    query = query.lte('financial_year', endYear)
  }

  const { data, error } = await query

  if (error || !data) {
    console.error('Failed to fetch loss data:', error)
    return []
  }

  // Group by year and calculate P&L
  const yearMap = new Map<string, Record<string, unknown>[]>()
  data.forEach((record: { financial_year: string; raw_data: Record<string, unknown> }) => {
    const year = record.financial_year
    if (!yearMap.has(year)) {
      yearMap.set(year, [])
    }
    yearMap.get(year)!.push(record.raw_data)
  })

  const lossPositions: LossPosition[] = []
  let runningLossBalance = 0

  const sortedYears = Array.from(yearMap.keys()).sort()

  sortedYears.forEach((year) => {
    const transactions = yearMap.get(year) || []

    // Calculate income and expenses by transaction type
    // s 8-1 ITAA 1997 - General deductions; assessable income vs allowable deductions
    let income = 0
    let expenses = 0

    transactions.forEach((tx: Record<string, unknown>) => {
      const rawAmount = parseFloat(String(tx.Total)) || 0
      const absAmount = Math.abs(rawAmount)
      const type = tx.Type

      if (type === 'ACCREC') {
        // Accounts Receivable invoices → Revenue (positive)
        income += absAmount
      } else if (type === 'ACCREC-CREDIT') {
        // Accounts Receivable credit notes → Revenue reduction (negative)
        expenses += absAmount // Reduces net income effectively
      } else if (type === 'ACCPAY') {
        // Accounts Payable bills → Expenses
        expenses += absAmount
      } else if (type === 'ACCPAY-CREDIT') {
        // Accounts Payable credit notes → Expense reduction
        income += absAmount // Reduces net expenses effectively
      } else if (type === 'BANK') {
        // Bank transactions: classify by amount sign
        // Positive amounts (money in) → Revenue/income
        // Negative amounts (money out) → Expenses
        if (rawAmount > 0) {
          income += rawAmount
        } else if (rawAmount < 0) {
          expenses += Math.abs(rawAmount)
        }
      }
    })

    const netProfitLoss = income - expenses
    const currentYearProfit = netProfitLoss > 0 ? netProfitLoss : 0
    const currentYearLoss = netProfitLoss < 0 ? Math.abs(netProfitLoss) : 0

    // Calculate loss utilization
    const availableLosses = runningLossBalance + currentYearLoss
    const lossesUtilized = Math.min(availableLosses, currentYearProfit)
    const closingLossBalance = availableLosses - lossesUtilized
    const taxableIncome = currentYearProfit - lossesUtilized

    // Division 36 ITAA 1997 - Tax losses carried forward indefinitely if COT/SBT met
    // However, check amendment period for ability to amend prior returns
    // Uses shared checkAmendmentPeriod from financial-year utility
    const amendmentWarning = currentYearLoss > 0
      ? checkAmendmentPeriod(year, entityType as EntityTypeForAmendment)
      : undefined

    // Tax losses do not expire in Australia (Division 36 ITAA 1997) provided
    // COT/SBT tests are satisfied. lossesExpired remains 0 as expiry depends
    // on COT/SBT analysis which is performed separately.
    // Default lossType to 'revenue' - capital loss detection requires CGT event analysis
    lossPositions.push({
      financialYear: year,
      openingLossBalance: runningLossBalance,
      currentYearLoss,
      currentYearProfit,
      lossesUtilized,
      lossesExpired: 0, // Losses don't expire per Division 36; COT/SBT failure handled in analysis
      closingLossBalance,
      taxableIncome,
      amendmentPeriodWarning: amendmentWarning,
      lossType: 'revenue', // Default to revenue; CGT engine handles capital loss classification
    })

    runningLossBalance = closingLossBalance
  })

  return lossPositions
}

/**
 * Analyze a single year's loss position
 */
function analyzeSingleYearLoss(
  currentYear: LossPosition,
  previousYears: LossPosition[],
  taxRateInfo: { rate: number; note: string; source: string } = {
    rate: FALLBACK_CORPORATE_TAX_RATE_STANDARD,
    note: 'Default 30% rate',
    source: 'ATO_FALLBACK_DEFAULT'
  }
): LossAnalysis {
  // Perform COT/SBT analysis
  const cotSbtAnalysis = analyzeCotSbt(currentYear, previousYears)

  // Calculate future tax value of carried forward losses using Decimal for precision
  // s 23AA / s 23 ITAA 1997 - Rate depends on entity type
  const futureTaxValue = new Decimal(currentYear.closingLossBalance)
    .times(new Decimal(taxRateInfo.rate))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber()

  // Optimise loss utilisation
  const optimization = optimizeLossUtilization(currentYear, cotSbtAnalysis, taxRateInfo)

  // Generate recommendations
  const recommendations = generateLossRecommendations(currentYear, cotSbtAnalysis, optimization, taxRateInfo)

  return {
    financialYear: currentYear.financialYear,
    openingLossBalance: currentYear.openingLossBalance,
    currentYearLoss: currentYear.currentYearLoss,
    lossesUtilized: currentYear.lossesUtilized,
    closingLossBalance: currentYear.closingLossBalance,
    cotSbtAnalysis,
    isEligibleForCarryforward: cotSbtAnalysis.isEligibleForCarryforward,
    futureTaxValue,
    lossType: currentYear.lossType,
    optimization,
    recommendations,
  }
}

/**
 * Analyze Continuity of Ownership Test (COT) and Same Business Test (SBT)
 */
function analyzeCotSbt(currentYear: LossPosition, _previousYears: LossPosition[]): CotSbtAnalysis {
  // In a complete implementation, this would:
  // 1. Check shareholder registry for ownership changes
  // 2. Verify 50%+ continuity of ownership
  // 3. If COT fails, check if SBT is satisfied

  // Division 165 ITAA 1997 - COT requires share register verification
  // Division 166 ITAA 1997 - SBT applies if COT fails
  const hasLossesToCarryForward = currentYear.closingLossBalance > 0

  if (!hasLossesToCarryForward) {
    return {
      cotSatisfied: true,
      cotConfidence: 100,
      cotNotes: ['No losses to carry forward - COT not applicable'],
      sbtRequired: false,
      sbtSatisfied: true,
      sbtConfidence: 100,
      sbtNotes: [],
      isEligibleForCarryforward: true,
      professionalReviewRequired: false,
      riskLevel: 'low',
    }
  }

  // COT cannot be determined without share register data
  // s 165-12 ITAA 1997 - Continuity of ownership test requires
  // verification that majority ownership (50%+) has not changed
  const cotSatisfied: boolean | 'unknown' = 'unknown'
  const cotConfidence = 50 // Reflects genuine uncertainty without ownership data
  const cotNotes = [
    'Continuity of Ownership Test requires share register verification. Professional review required.',
    's 165-12 ITAA 1997 - COT requires 50%+ continuity of ownership throughout the ownership test period',
    'Share register data not available - COT status cannot be determined automatically',
    'Verify shareholding has not changed since loss was incurred',
    'Review share register for any transfers, new issues, or redemptions',
  ]

  // SBT status also unknown without business activity comparison data
  // s 165-13 ITAA 1997 - Same Business Test (SBT) applies as fallback if COT fails
  const sbtRequired: boolean | 'unknown' = 'unknown' // Cannot determine if COT is unknown
  const sbtSatisfied: boolean | 'unknown' = 'unknown'
  const sbtConfidence = 50 // No business activity data to compare across years
  const sbtNotes = [
    'Same Business Test requires comparison of business activities across financial years. Professional review required.',
    's 165-13 ITAA 1997 - SBT requires the company to carry on the same business throughout the test period',
    'No industry code or business activity data available for automated comparison',
    'New business activities or significant changes may cause SBT failure',
  ]

  // Without confirmed COT or SBT, eligibility is assumed but flagged for review
  // Division 36 ITAA 1997 - Tax losses carried forward indefinitely if COT/SBT met
  const isEligibleForCarryforward = true // Assumed eligible, but must be verified

  // Risk level is always medium or high when COT/SBT is unknown
  const riskLevel: 'low' | 'medium' | 'high' = 'medium'

  return {
    cotSatisfied,
    cotConfidence,
    cotNotes,
    sbtRequired,
    sbtSatisfied,
    sbtConfidence,
    sbtNotes,
    isEligibleForCarryforward,
    professionalReviewRequired: true, // Always required when losses exist and COT/SBT unknown
    riskLevel,
  }
}

/**
 * Optimize loss utilization strategy
 */
function optimizeLossUtilization(
  currentYear: LossPosition,
  cotSbtAnalysis: CotSbtAnalysis,
  taxRateInfo: { rate: number; note: string; source: string } = {
    rate: FALLBACK_CORPORATE_TAX_RATE_STANDARD,
    note: 'Default 30% rate',
    source: 'ATO_FALLBACK_DEFAULT'
  }
): {
  currentStrategy: string
  recommendedStrategy: string
  additionalBenefit: number
  reasoning: string
} {
  const hasProfit = currentYear.currentYearProfit > 0
  const hasLosses = currentYear.openingLossBalance > 0 || currentYear.currentYearLoss > 0

  // Current strategy: automatic utilisation
  const currentStrategy = hasProfit && hasLosses ? 'Automatic loss offset against current year profit' : 'No loss utilisation (no profit)'

  // Recommended strategy
  let recommendedStrategy = currentStrategy
  let additionalBenefit = 0
  let reasoning = 'Current strategy is optimal'

  if (hasProfit && hasLosses && cotSbtAnalysis.isEligibleForCarryforward) {
    // Check if deferring loss utilisation would be beneficial
    // (e.g., if expecting higher tax rate in future, or if R&D offset available)

    // Recommend full utilisation using entity-appropriate tax rate
    recommendedStrategy = 'Utilise all available losses against current year profit'
    additionalBenefit = new Decimal(currentYear.lossesUtilized)
      .times(new Decimal(taxRateInfo.rate))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber()
    reasoning = `Save $${additionalBenefit.toFixed(2)} in tax by offsetting losses against profit (${taxRateInfo.note})`
  } else if (hasLosses && !cotSbtAnalysis.isEligibleForCarryforward) {
    recommendedStrategy = 'Losses may not be eligible for carry-forward - verify COT/SBT compliance'
    additionalBenefit = 0
    reasoning = 'Risk of losing carry-forward losses due to COT/SBT failure'
  }

  return {
    currentStrategy,
    recommendedStrategy,
    additionalBenefit,
    reasoning,
  }
}

/**
 * Generate recommendations for loss management
 */
function generateLossRecommendations(
  currentYear: LossPosition,
  cotSbtAnalysis: CotSbtAnalysis,
  optimization: { currentStrategy: string; recommendedStrategy: string; additionalBenefit: number; reasoning: string },
  taxRateInfo: { rate: number; note: string; source: string } = {
    rate: FALLBACK_CORPORATE_TAX_RATE_STANDARD,
    note: 'Default 30% rate',
    source: 'ATO_FALLBACK_DEFAULT'
  }
): string[] {
  const recommendations: string[] = []

  // Loss carry-forward eligibility
  if (!cotSbtAnalysis.isEligibleForCarryforward) {
    recommendations.push('❌ Losses may not be eligible for carry-forward due to COT/SBT failure')
    recommendations.push('🔴 URGENT: Review ownership changes and business continuity')
    recommendations.push('Consider whether losses should be written off in tax return')
  } else if (cotSbtAnalysis.riskLevel === 'high') {
    recommendations.push('⚠️ HIGH RISK: Loss carry-forward eligibility uncertain')
    recommendations.push('Obtain professional advice on COT/SBT compliance')
  } else if (cotSbtAnalysis.riskLevel === 'medium') {
    recommendations.push('⚠️ MEDIUM RISK: Verify COT/SBT compliance')
    recommendations.push('Review shareholder register for ownership continuity')
  }

  // Loss utilisation
  if (currentYear.closingLossBalance > 0) {
    const futureValue = new Decimal(currentYear.closingLossBalance)
      .times(new Decimal(taxRateInfo.rate))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber()
    const ratePercent = Math.round(taxRateInfo.rate * 100)
    recommendations.push(`Carried forward losses: $${currentYear.closingLossBalance.toFixed(2)}`)
    recommendations.push(`Future tax value: $${futureValue.toFixed(2)} (at ${ratePercent}% rate - ${taxRateInfo.note})`)
    recommendations.push('Plan to utilise losses against future profits')
  }

  if (currentYear.lossesUtilized > 0) {
    const taxSaved = new Decimal(currentYear.lossesUtilized)
      .times(new Decimal(taxRateInfo.rate))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber()
    recommendations.push(`Utilised $${currentYear.lossesUtilized.toFixed(2)} in losses this year`)
    recommendations.push(`Tax saved: $${taxSaved.toFixed(2)}`)
  }

  // COT/SBT specific recommendations
  if (cotSbtAnalysis.cotSatisfied === 'unknown') {
    recommendations.push('⚠️ COT status unknown - share register verification required (s 165-12 ITAA 1997)')
    recommendations.push('Professional review required to confirm continuity of ownership')
  } else if (cotSbtAnalysis.cotSatisfied) {
    recommendations.push('✅ COT satisfied - ownership continuity maintained')
  } else {
    recommendations.push('❌ COT not satisfied - check SBT compliance')
  }

  if (cotSbtAnalysis.sbtSatisfied === 'unknown') {
    recommendations.push('⚠️ SBT status unknown - business activity comparison required (s 165-13 ITAA 1997)')
  } else if (cotSbtAnalysis.sbtRequired === true) {
    if (cotSbtAnalysis.sbtSatisfied) {
      recommendations.push('✅ SBT satisfied - same business maintained')
    } else {
      recommendations.push('❌ SBT not satisfied - losses may be forfeited')
    }
  }

  // Professional review flag
  if (cotSbtAnalysis.professionalReviewRequired) {
    recommendations.push('🔴 PROFESSIONAL REVIEW REQUIRED: Loss carry-forward eligibility must be verified by a qualified tax agent')
  }

  // Amendment period warning - Taxation Administration Act 1953, s 170
  if (currentYear.amendmentPeriodWarning) {
    recommendations.push(`⚠️ AMENDMENT PERIOD: ${currentYear.amendmentPeriodWarning}`)
  }

  // Optimisation recommendations
  if (optimization.additionalBenefit > 0) {
    recommendations.push(`${optimization.recommendedStrategy}`)
    recommendations.push(`Potential benefit: $${optimization.additionalBenefit.toFixed(2)}`)
  }

  // Documentation
  recommendations.push('Maintain loss schedule in Company Tax Return (Schedule 5)')
  recommendations.push('Retain shareholder register and share transaction records')
  recommendations.push('Document business activities year-over-year for SBT compliance')

  return recommendations
}

/**
 * Calculate overall loss summary
 */
/**
 * Calculate overall loss summary
 */
function calculateLossSummary(
  lossAnalyses: LossAnalysis[],
  taxRateSource: string = 'none'
): LossSummary {
  let totalAvailableLosses = 0
  let totalUtilizedLosses = 0
  let totalExpiredLosses = 0
  let totalFutureTaxValue = 0
  let revenueLosses = 0
  let capitalLosses = 0

  const lossesByYear: Record<string, number> = {}
  const riskLevels: string[] = []

  lossAnalyses.forEach((analysis) => {
    totalAvailableLosses += analysis.openingLossBalance + analysis.currentYearLoss
    totalUtilizedLosses += analysis.lossesUtilized
    totalFutureTaxValue += analysis.futureTaxValue

    lossesByYear[analysis.financialYear] = analysis.closingLossBalance

    if (!analysis.isEligibleForCarryforward) {
      totalExpiredLosses += analysis.closingLossBalance
    }

    // Separate capital vs revenue losses (s 102-5 ITAA 1997)
    if (analysis.lossType === 'capital') {
      capitalLosses += analysis.closingLossBalance
    } else {
      revenueLosses += analysis.closingLossBalance
    }

    riskLevels.push(analysis.cotSbtAnalysis.riskLevel)
  })

  const utilizationRate = totalAvailableLosses > 0 ? (totalUtilizedLosses / totalAvailableLosses) * 100 : 0

  // Calculate average risk level
  const highRiskCount = riskLevels.filter((r) => r === 'high').length
  const mediumRiskCount = riskLevels.filter((r) => r === 'medium').length
  let averageRiskLevel = 'low'
  if (highRiskCount > 0) {
    averageRiskLevel = 'high'
  } else if (mediumRiskCount > riskLevels.length * 0.3) {
    averageRiskLevel = 'medium'
  }

  // Identify optimization opportunities (unused losses with low risk)
  const optimizationOpportunities = lossAnalyses.filter((analysis) => {
    return (
      analysis.closingLossBalance > 0 &&
      analysis.isEligibleForCarryforward &&
      analysis.cotSbtAnalysis.riskLevel === 'low' &&
      analysis.optimization.additionalBenefit > 0
    )
  })

  return {
    totalAvailableLosses,
    totalUtilizedLosses,
    totalExpiredLosses,
    totalFutureTaxValue,
    revenueLosses,
    capitalLosses,
    lossesByYear,
    utilizationRate: Math.round(utilizationRate * 10) / 10,
    averageRiskLevel,
    optimizationOpportunities,
    lossHistory: lossAnalyses,
    taxRateSource,
    taxRateVerifiedAt: new Date().toISOString(),
  }
}

/**
 * Create empty summary when no data available
 */
function createEmptyLossSummary(): LossSummary {
  return {
    totalAvailableLosses: 0,
    totalUtilizedLosses: 0,
    totalExpiredLosses: 0,
    totalFutureTaxValue: 0,
    revenueLosses: 0,
    capitalLosses: 0,
    lossesByYear: {},
    utilizationRate: 0,
    averageRiskLevel: 'low',
    optimizationOpportunities: [],
    lossHistory: [],
    taxRateSource: 'none',
    taxRateVerifiedAt: new Date().toISOString(),
  }
}

/**
 * Calculate tax value of unutilized losses
 */
export async function calculateUnutilizedLossValue(
  tenantId: string,
  entityType: EntityType = 'unknown',
  isBaseRateEntity: boolean = false
): Promise<number> {
  const summary = await analyzeLossPosition(tenantId, undefined, undefined, entityType, isBaseRateEntity)
  return summary.totalFutureTaxValue
}
