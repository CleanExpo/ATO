/**
 * Capital Gains Tax Engine (Divisions 102-115, 152 ITAA 1997)
 *
 * Analyses asset disposals to calculate CGT liability and identify
 * Division 152 Small Business CGT Concessions.
 *
 * Key Legislation:
 * - Division 102 ITAA 1997: CGT events (A1 disposal, C2 cancellation, etc.)
 * - Division 110 ITAA 1997: Cost base and reduced cost base
 * - Division 115 ITAA 1997: 50% CGT discount (assets held 12+ months)
 * - Division 152 ITAA 1997: Small business CGT concessions
 *   - Subdiv 152-A: Basic conditions (turnover < $2M or net assets < $6M)
 *   - Subdiv 152-B: 15-year exemption (continuous ownership 15+ years)
 *   - Subdiv 152-C: 50% active asset reduction
 *   - Subdiv 152-D: Retirement exemption ($500K lifetime cap)
 *   - Subdiv 152-E: Rollover (replacement asset within 2 years)
 *
 * IMPORTANT: Capital losses can ONLY offset capital gains (s 102-5 ITAA 1997).
 * Capital losses NEVER reduce assessable income. This engine enforces that rule.
 */

import { createServiceClient } from '@/lib/supabase/server'
import type { ForensicAnalysisRow } from '@/lib/types/forensic-analysis'

/** Extended forensic row with optional CGT-specific fields */
interface CGTForensicRow extends ForensicAnalysisRow {
  acquisition_date?: string
}
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'
import { getCurrentFinancialYear, checkAmendmentPeriod } from '@/lib/utils/financial-year'
import Decimal from 'decimal.js'

// CGT discount rate (Division 115 ITAA 1997)
const FALLBACK_CGT_DISCOUNT_RATE = 0.50 // 50% discount for 12+ month assets

// Division 152 thresholds
const DIV152_TURNOVER_THRESHOLD = 2_000_000 // $2M aggregated turnover
const DIV152_NET_ASSET_THRESHOLD = 6_000_000 // $6M net asset value
const DIV152_15_YEAR_THRESHOLD = 15 // 15 years continuous ownership
const DIV152_RETIREMENT_LIFETIME_CAP = 500_000 // $500K lifetime cap
const DIV152_ROLLOVER_REPLACEMENT_YEARS = 2 // 2 years to acquire replacement asset
const ACTIVE_ASSET_MIN_PERCENTAGE = 80 // 80% active asset use required

// CGT event types (Division 102 ITAA 1997)
export type CGTEventType =
  | 'A1'  // Disposal of a CGT asset
  | 'C2'  // Cancellation, surrender, or similar ending
  | 'D1'  // Creating contractual or other rights
  | 'E1'  // Creating a trust over a CGT asset
  | 'H2'  // Receipt for event relating to a CGT asset
  | 'K6'  // Pre-CGT shares or interests
  | 'other'

export interface CGTEvent {
  transactionId: string
  eventType: CGTEventType
  assetDescription: string
  acquisitionDate: string
  disposalDate: string
  costBase: number
  reducedCostBase: number
  capitalProceeds: number
  capitalGain: number
  capitalLoss: number
  holdingPeriodMonths: number
  eligibleForDiscount: boolean // 12+ months and individual/trust/super fund
  discountedGain: number // After 50% discount if eligible
  financialYear: string
  confidence: number
  classification: 'capital' | 'revenue' | 'uncertain'
  classificationReasoning: string
  amendmentPeriodWarning?: string
}

export interface Div152Analysis {
  // Basic conditions (Subdiv 152-A)
  basicConditionsMet: boolean
  turnoverTest: {
    met: boolean
    aggregatedTurnover: number | null
    threshold: number
    note: string
  }
  netAssetTest: {
    met: boolean
    netAssetValue: number | null
    threshold: number
    note: string
  }
  activeAssetTest: {
    met: boolean
    activePercentage: number | null
    threshold: number
    note: string
  }

  // Individual concessions
  fifteenYearExemption: {
    eligible: boolean
    yearsHeld: number
    threshold: number
    exemptAmount: number
    note: string
  }
  fiftyPercentReduction: {
    eligible: boolean
    originalGain: number
    reducedGain: number
    note: string
  }
  retirementExemption: {
    eligible: boolean
    amountExempt: number
    lifetimeCap: number
    remainingCap: number | null // null = unknown prior usage
    note: string
  }
  rollover: {
    available: boolean
    rolloverAmount: number
    replacementDeadline: string
    note: string
  }

  // Total concession
  totalConcessionAmount: number
  professionalReviewRequired: boolean
  recommendations: string[]
}

export interface CGTSummary {
  financialYear: string
  totalCGTEvents: number
  totalCapitalGains: number
  totalCapitalLosses: number
  priorYearCapitalLosses: number // Carried forward from prior years
  netCapitalGain: number // Gains - losses (capital losses only offset capital gains)
  discountApplied: number
  div152Concessions: number
  taxableCapitalGain: number
  events: CGTEvent[]
  div152Analysis: Div152Analysis | null
  capitalLossCarriedForward: number // Unapplied capital losses for future years

  // Provenance
  taxRateSource: string
  taxRateVerifiedAt: string
  legislativeReferences: string[]
  recommendations: string[]
  professionalReviewRequired: boolean
}

export interface CGTAnalysisOptions {
  entityType?: 'individual' | 'company' | 'trust' | 'super_fund' | 'unknown'
  aggregatedTurnover?: number
  netAssetValue?: number
  activeAssetPercentage?: number
  yearsOfOwnership?: number
  priorRetirementExemptionUsed?: number
  priorYearCapitalLosses?: number
}

/**
 * Analyse CGT position for a tenant
 */
export async function analyzeCGT(
  tenantId: string,
  financialYear?: string,
  options?: CGTAnalysisOptions
): Promise<CGTSummary> {
  const supabase = await createServiceClient()
  const targetFY = financialYear || getCurrentFinancialYear()

  // Fetch asset disposal transactions from forensic analysis
  const { data: transactions, error } = await supabase
    .from('forensic_analysis_results')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('financial_year', targetFY)
    .order('transaction_date', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch transactions for CGT analysis: ${error.message}`)
  }

  if (!transactions || transactions.length === 0) {
    return createEmptyCGTSummary(targetFY)
  }

  // Filter for asset disposal transactions (capital in nature)
  const assetTransactions = transactions.filter((tx: CGTForensicRow) => {
    const category = (tx.primary_category || '').toLowerCase()
    const description = (tx.transaction_description || '').toLowerCase()
    return (
      category.includes('asset') ||
      category.includes('capital') ||
      category.includes('disposal') ||
      category.includes('sale of') ||
      description.includes('asset sale') ||
      description.includes('disposal') ||
      description.includes('capital gain') ||
      description.includes('capital loss')
    )
  })

  if (assetTransactions.length === 0) {
    return createEmptyCGTSummary(targetFY)
  }

  // Get CGT discount rate
  const cgtDiscountRate = FALLBACK_CGT_DISCOUNT_RATE
  let rateSource = 'ATO_FALLBACK_DEFAULT'
  try {
    const rates = await getCurrentTaxRates()
    if (rates.sources.corporateTax) rateSource = rates.sources.corporateTax
  } catch (err) {
    console.warn('Failed to fetch live rates for CGT engine', err)
  }

  const entityType = options?.entityType ?? 'unknown'

  // Companies do NOT get the 50% CGT discount (s 115-10 ITAA 1997)
  const eligibleForDiscount = entityType !== 'company'

  // Build CGT events
  const events: CGTEvent[] = assetTransactions.map((tx: CGTForensicRow) => {
    const amount = Math.abs(parseFloat(String(tx.transaction_amount)) || 0)
    const isGain = parseFloat(String(tx.transaction_amount)) > 0
    const description = tx.transaction_description || ''

    // Estimate holding period from description or default to unknown
    const holdingPeriodMonths = estimateHoldingPeriod(tx)
    const canDiscount = eligibleForDiscount && holdingPeriodMonths >= 12

    const capitalGain = isGain ? amount : 0
    const capitalLoss = !isGain ? amount : 0
    const discountedGain = canDiscount
      ? new Decimal(capitalGain).times(1 - cgtDiscountRate).toDecimalPlaces(2).toNumber()
      : capitalGain

    const amendmentWarning = checkAmendmentPeriod(targetFY, entityType === 'individual' ? 'individual' : 'company')

    return {
      transactionId: tx.transaction_id,
      eventType: classifyCGTEvent(tx) as CGTEventType,
      assetDescription: description,
      acquisitionDate: tx.acquisition_date || 'unknown',
      disposalDate: tx.transaction_date || '',
      costBase: 0, // Would need asset register data
      reducedCostBase: 0,
      capitalProceeds: isGain ? amount : 0,
      capitalGain,
      capitalLoss,
      holdingPeriodMonths,
      eligibleForDiscount: canDiscount,
      discountedGain,
      financialYear: targetFY,
      confidence: tx.category_confidence || 50,
      classification: isGain ? 'capital' : 'capital',
      classificationReasoning: 'Classified as capital based on asset disposal pattern in transaction data',
      amendmentPeriodWarning: amendmentWarning,
    }
  })

  // Calculate totals
  const totalCapitalGains = events.reduce((sum, e) => sum + e.capitalGain, 0)
  const totalCapitalLosses = events.reduce((sum, e) => sum + e.capitalLoss, 0)
  const priorYearCapitalLosses = options?.priorYearCapitalLosses ?? 0

  // Capital losses offset capital gains ONLY (s 102-5 ITAA 1997)
  const totalAvailableLosses = totalCapitalLosses + priorYearCapitalLosses
  const lossesApplied = Math.min(totalAvailableLosses, totalCapitalGains)
  const netCapitalGainBeforeDiscount = Math.max(0, totalCapitalGains - lossesApplied)
  const capitalLossCarriedForward = totalAvailableLosses - lossesApplied

  // Apply 50% discount to net gain
  const discountAmount = eligibleForDiscount
    ? new Decimal(netCapitalGainBeforeDiscount).times(cgtDiscountRate).toDecimalPlaces(2).toNumber()
    : 0
  const netCapitalGainAfterDiscount = netCapitalGainBeforeDiscount - discountAmount

  // Analyse Division 152 concessions
  const div152 = analyzeDivision152(
    netCapitalGainAfterDiscount,
    events,
    options
  )

  const taxableCapitalGain = Math.max(0, netCapitalGainAfterDiscount - (div152?.totalConcessionAmount || 0))

  const recommendations = generateCGTRecommendations(
    events, totalCapitalGains, totalCapitalLosses, taxableCapitalGain, div152
  )

  return {
    financialYear: targetFY,
    totalCGTEvents: events.length,
    totalCapitalGains,
    totalCapitalLosses,
    priorYearCapitalLosses,
    netCapitalGain: netCapitalGainBeforeDiscount,
    discountApplied: discountAmount,
    div152Concessions: div152?.totalConcessionAmount || 0,
    taxableCapitalGain,
    events,
    div152Analysis: div152,
    capitalLossCarriedForward,
    taxRateSource: rateSource,
    taxRateVerifiedAt: new Date().toISOString(),
    legislativeReferences: [
      'Division 102 ITAA 1997 (CGT events)',
      'Division 110 ITAA 1997 (Cost base)',
      'Division 115 ITAA 1997 (50% CGT discount)',
      'Division 152 ITAA 1997 (Small business CGT concessions)',
      's 102-5 ITAA 1997 (Capital losses only offset capital gains)',
    ],
    recommendations,
    professionalReviewRequired: totalCapitalGains > 50000 || div152 !== null,
  }
}

/**
 * Analyse Division 152 Small Business CGT Concessions
 */
function analyzeDivision152(
  netGain: number,
  events: CGTEvent[],
  options?: CGTAnalysisOptions
): Div152Analysis | null {
  if (netGain <= 0) return null

  const turnover = options?.aggregatedTurnover
  const netAssets = options?.netAssetValue
  const activePercentage = options?.activeAssetPercentage
  const yearsOwned = options?.yearsOfOwnership ?? 0
  const priorRetirementUsed = options?.priorRetirementExemptionUsed

  // Basic conditions (Subdiv 152-A)
  const turnoverTest = {
    met: turnover !== undefined ? turnover < DIV152_TURNOVER_THRESHOLD : false,
    aggregatedTurnover: turnover ?? null,
    threshold: DIV152_TURNOVER_THRESHOLD,
    note: turnover !== undefined
      ? (turnover < DIV152_TURNOVER_THRESHOLD
        ? `Turnover $${turnover.toLocaleString('en-AU')} < $${DIV152_TURNOVER_THRESHOLD.toLocaleString('en-AU')} threshold - test satisfied`
        : `Turnover $${turnover.toLocaleString('en-AU')} >= $${DIV152_TURNOVER_THRESHOLD.toLocaleString('en-AU')} threshold - test failed`)
      : 'Aggregated turnover not provided. Cannot assess Subdiv 152-A turnover test.',
  }

  const netAssetTest = {
    met: netAssets !== undefined ? netAssets < DIV152_NET_ASSET_THRESHOLD : false,
    netAssetValue: netAssets ?? null,
    threshold: DIV152_NET_ASSET_THRESHOLD,
    note: netAssets !== undefined
      ? (netAssets < DIV152_NET_ASSET_THRESHOLD
        ? `Net assets $${netAssets.toLocaleString('en-AU')} < $${DIV152_NET_ASSET_THRESHOLD.toLocaleString('en-AU')} threshold - test satisfied`
        : `Net assets $${netAssets.toLocaleString('en-AU')} >= $${DIV152_NET_ASSET_THRESHOLD.toLocaleString('en-AU')} threshold - test failed`)
      : 'Net asset value not provided. Cannot assess Subdiv 152-A net asset test.',
  }

  const activeAssetTest = {
    met: activePercentage !== undefined ? activePercentage >= ACTIVE_ASSET_MIN_PERCENTAGE : false,
    activePercentage: activePercentage ?? null,
    threshold: ACTIVE_ASSET_MIN_PERCENTAGE,
    note: activePercentage !== undefined
      ? (activePercentage >= ACTIVE_ASSET_MIN_PERCENTAGE
        ? `Active asset use ${activePercentage}% >= ${ACTIVE_ASSET_MIN_PERCENTAGE}% threshold - test satisfied`
        : `Active asset use ${activePercentage}% < ${ACTIVE_ASSET_MIN_PERCENTAGE}% threshold - test failed`)
      : 'Active asset percentage not provided. Cannot assess active asset test.',
  }

  // Basic conditions require: (turnover OR net asset test) AND active asset test
  const basicConditionsMet = (turnoverTest.met || netAssetTest.met) && activeAssetTest.met

  // 15-year exemption (Subdiv 152-B)
  const fifteenYearExemption = {
    eligible: basicConditionsMet && yearsOwned >= DIV152_15_YEAR_THRESHOLD,
    yearsHeld: yearsOwned,
    threshold: DIV152_15_YEAR_THRESHOLD,
    exemptAmount: (basicConditionsMet && yearsOwned >= DIV152_15_YEAR_THRESHOLD) ? netGain : 0,
    note: yearsOwned >= DIV152_15_YEAR_THRESHOLD
      ? `Asset held ${yearsOwned} years >= ${DIV152_15_YEAR_THRESHOLD} years - 15-year exemption available (Subdiv 152-B)`
      : `Asset held ${yearsOwned} years < ${DIV152_15_YEAR_THRESHOLD} years - 15-year exemption not available`,
  }

  // 50% active asset reduction (Subdiv 152-C)
  const reductionAmount = basicConditionsMet
    ? new Decimal(netGain).times(0.5).toDecimalPlaces(2).toNumber()
    : 0
  const fiftyPercentReduction = {
    eligible: basicConditionsMet,
    originalGain: netGain,
    reducedGain: basicConditionsMet ? netGain - reductionAmount : netGain,
    note: basicConditionsMet
      ? `50% active asset reduction available - gain reduced by $${reductionAmount.toFixed(2)} (Subdiv 152-C)`
      : 'Basic conditions not met - 50% reduction not available',
  }

  // Retirement exemption (Subdiv 152-D)
  const remainingCap = priorRetirementUsed !== undefined
    ? Math.max(0, DIV152_RETIREMENT_LIFETIME_CAP - priorRetirementUsed)
    : null
  const retirementExemptAmount = basicConditionsMet
    ? Math.min(netGain, remainingCap ?? DIV152_RETIREMENT_LIFETIME_CAP)
    : 0
  const retirementExemption = {
    eligible: basicConditionsMet && (remainingCap === null || remainingCap > 0),
    amountExempt: retirementExemptAmount,
    lifetimeCap: DIV152_RETIREMENT_LIFETIME_CAP,
    remainingCap,
    note: basicConditionsMet
      ? `Retirement exemption available up to $${retirementExemptAmount.toFixed(2)} (Subdiv 152-D). ${remainingCap !== null ? `Remaining lifetime cap: $${remainingCap.toFixed(2)}` : 'Prior usage unknown - verify lifetime cap.'}`
      : 'Basic conditions not met - retirement exemption not available',
  }

  // Rollover (Subdiv 152-E)
  const rollover = {
    available: basicConditionsMet,
    rolloverAmount: basicConditionsMet ? netGain : 0,
    replacementDeadline: basicConditionsMet
      ? `${DIV152_ROLLOVER_REPLACEMENT_YEARS} years from disposal date`
      : 'N/A',
    note: basicConditionsMet
      ? `Small business rollover available - acquire replacement active asset within ${DIV152_ROLLOVER_REPLACEMENT_YEARS} years (Subdiv 152-E)`
      : 'Basic conditions not met - rollover not available',
  }

  // Calculate total concession (use the most beneficial combination)
  // 15-year exemption is the best (total exemption), otherwise combine 50% + retirement
  let totalConcessionAmount = 0
  if (fifteenYearExemption.eligible) {
    totalConcessionAmount = fifteenYearExemption.exemptAmount
  } else if (basicConditionsMet) {
    // 50% reduction + retirement exemption on the remaining amount
    const afterReduction = fiftyPercentReduction.reducedGain
    const retirementOnRemainder = Math.min(afterReduction, retirementExemptAmount)
    totalConcessionAmount = reductionAmount + retirementOnRemainder
  }

  const recommendations: string[] = []
  if (!basicConditionsMet) {
    if (turnover === undefined && netAssets === undefined) {
      recommendations.push('Provide aggregated turnover or net asset value to assess Division 152 eligibility')
    }
    if (activePercentage === undefined) {
      recommendations.push('Provide active asset use percentage to assess Division 152 eligibility')
    }
  }
  if (basicConditionsMet) {
    recommendations.push('Division 152 concessions available - professional review recommended to optimise concession selection')
    if (fifteenYearExemption.eligible) {
      recommendations.push('15-year exemption provides total exemption - this is the most beneficial concession')
    } else {
      recommendations.push('Consider combining 50% reduction with retirement exemption or rollover')
    }
  }

  return {
    basicConditionsMet,
    turnoverTest,
    netAssetTest,
    activeAssetTest,
    fifteenYearExemption,
    fiftyPercentReduction,
    retirementExemption,
    rollover,
    totalConcessionAmount,
    professionalReviewRequired: true, // Division 152 always requires professional review
    recommendations,
  }
}

/**
 * Classify CGT event type from transaction data
 */
function classifyCGTEvent(tx: CGTForensicRow): CGTEventType {
  const description = (tx.transaction_description || '').toLowerCase()

  if (description.includes('disposal') || description.includes('sale of') || description.includes('sold')) {
    return 'A1'
  }
  if (description.includes('cancel') || description.includes('surrender')) {
    return 'C2'
  }
  if (description.includes('right') || description.includes('contract')) {
    return 'D1'
  }
  return 'other'
}

/**
 * Estimate holding period in months from transaction data
 */
function estimateHoldingPeriod(tx: CGTForensicRow): number {
  if (tx.acquisition_date && tx.transaction_date) {
    const acquisition = new Date(tx.acquisition_date)
    const disposal = new Date(tx.transaction_date)
    const diffMs = disposal.getTime() - acquisition.getTime()
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44)))
  }
  return 0 // Unknown - conservative (no discount)
}

/**
 * Generate CGT recommendations
 */
function generateCGTRecommendations(
  events: CGTEvent[],
  totalGains: number,
  totalLosses: number,
  taxableGain: number,
  div152: Div152Analysis | null
): string[] {
  const recommendations: string[] = []

  if (events.length === 0) {
    recommendations.push('No CGT events identified in this financial year')
    return recommendations
  }

  if (totalGains > 0) {
    recommendations.push(`Total capital gains: $${totalGains.toFixed(2)} across ${events.length} CGT events`)
  }
  if (totalLosses > 0) {
    recommendations.push(`Capital losses: $${totalLosses.toFixed(2)} (can only offset capital gains - s 102-5 ITAA 1997)`)
  }

  if (taxableGain > 0) {
    recommendations.push(`Taxable capital gain after concessions: $${taxableGain.toFixed(2)}`)
    recommendations.push('Include in assessable income via the company tax return or individual return')
  }

  if (div152?.basicConditionsMet) {
    recommendations.push('Division 152 Small Business CGT Concessions are available')
  }

  const uncertainEvents = events.filter(e => e.confidence < 60)
  if (uncertainEvents.length > 0) {
    recommendations.push(`${uncertainEvents.length} CGT event(s) have low confidence - professional review required`)
  }

  recommendations.push('Maintain asset register with acquisition dates, cost bases, and disposal proceeds')
  recommendations.push('Retain records for 5 years from date of CGT event')

  if (taxableGain > 50000) {
    recommendations.push('High-value CGT event - professional review strongly recommended')
  }

  return recommendations
}

/**
 * Create empty CGT summary
 */
function createEmptyCGTSummary(financialYear: string): CGTSummary {
  return {
    financialYear,
    totalCGTEvents: 0,
    totalCapitalGains: 0,
    totalCapitalLosses: 0,
    priorYearCapitalLosses: 0,
    netCapitalGain: 0,
    discountApplied: 0,
    div152Concessions: 0,
    taxableCapitalGain: 0,
    events: [],
    div152Analysis: null,
    capitalLossCarriedForward: 0,
    taxRateSource: 'none',
    taxRateVerifiedAt: new Date().toISOString(),
    legislativeReferences: [],
    recommendations: ['No CGT events found. Connect Xero and run analysis first.'],
    professionalReviewRequired: false,
  }
}
