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
 *   - Subdiv 152-15: Net asset test includes connected entities and affiliates
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

/**
 * Asset category for loss quarantining (s 108-10, s 108-20 ITAA 1997).
 * - 'collectable': Losses can ONLY offset collectable gains (s 108-10(1))
 * - 'personal_use': Losses are COMPLETELY DISREGARDED (s 108-20(1))
 * - 'other': Standard capital asset — losses offset any capital gains
 */
export type CGTAssetCategory = 'collectable' | 'personal_use' | 'other'

/** Keywords indicating collectable assets (s 108-10(2) ITAA 1997) */
const COLLECTABLE_KEYWORDS = [
  'artwork', 'painting', 'sculpture', 'print', 'lithograph',
  'jewellery', 'jewelry', 'gemstone', 'diamond', 'gold bar',
  'antique', 'coin', 'medallion', 'medal', 'numismatic',
  'rare book', 'manuscript', 'folio', 'first edition',
  'stamp', 'philatelic',
  'wine', 'spirits', 'vintage wine',
  'collectible', 'collectable', 'memorabilia',
] as const

/** Keywords indicating personal use assets (s 108-20(2) ITAA 1997) */
const PERSONAL_USE_KEYWORDS = [
  'boat', 'yacht', 'jet ski', 'watercraft',
  'furniture', 'electrical', 'appliance', 'whitegoods',
  'caravan', 'camper', 'trailer',
  'sporting equipment', 'gym equipment', 'fitness',
  'household', 'personal use', 'domestic',
  'musical instrument',
] as const

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
  /** Asset category for loss quarantining (s 108-10, s 108-20 ITAA 1997) */
  assetCategory: CGTAssetCategory
  /** Explanation of asset category classification */
  assetCategoryNote: string
  /**
   * s 112-30 ITAA 1997: Warning when a prior CGT event on the same asset
   * may have modified the cost base of this event.
   */
  priorEventWarning?: string
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
    /** Entity's own net asset value (before connected entity aggregation) */
    netAssetValue: number | null
    /** Total net assets of connected entities and affiliates (Subdivision 152-15) */
    connectedEntityAssets: number
    /** Aggregated total: own + connected entity assets */
    aggregatedNetAssets: number | null
    threshold: number
    /** True when aggregated value is within 10% of threshold ($5.4M-$6M) — cliff edge risk */
    cliffEdgeWarning: boolean
    note: string
    /** Breakdown of connected entity contributions to the net asset test */
    breakdown?: Array<{ name: string; value: number; relationship: string }>
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
  capitalLossCarriedForward: number // Unapplied capital losses for future years (non-collectable)

  // Loss quarantining (s 108-10, s 108-20 ITAA 1997)
  /** Capital gains from collectable assets only */
  collectableGains: number
  /** Capital losses from collectable assets only */
  collectableLosses: number
  /** Collectable losses applied against collectable gains this year */
  collectableLossesApplied: number
  /** Excess collectable losses carried forward (can only offset future collectable gains) */
  collectableLossesCarriedForward: number
  /** Personal use asset losses completely disregarded under s 108-20(1) */
  personalUseLossesDisregarded: number

  // Provenance
  taxRateSource: string
  taxRateVerifiedAt: string
  legislativeReferences: string[]
  recommendations: string[]
  professionalReviewRequired: boolean
}

/** Connected entity or affiliate for Division 152-15 net asset aggregation */
export interface ConnectedEntity {
  name: string
  netAssetValue: number
  relationship: 'connected_entity' | 'affiliate'
}

export interface CGTAnalysisOptions {
  entityType?: 'individual' | 'company' | 'trust' | 'super_fund' | 'smsf' | 'non_profit' | 'foreign_company' | 'unknown'
  aggregatedTurnover?: number
  netAssetValue?: number
  activeAssetPercentage?: number
  yearsOfOwnership?: number
  priorRetirementExemptionUsed?: number
  priorYearCapitalLosses?: number
  /**
   * Connected entities and affiliates for Subdivision 152-15 ITAA 1997
   * net asset aggregation. Their net asset values are aggregated with the
   * entity's own netAssetValue for the $6M threshold test.
   */
  connectedEntities?: ConnectedEntity[]
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

  // CGT discount rules (s 115-10, s 115-100 ITAA 1997):
  // - Companies and foreign companies: NO CGT discount
  // - SMSFs: 1/3 discount (33.33%) instead of 50%
  // - Individuals, trusts: 50% discount
  // - Non-profits: treated as trusts (50% discount if eligible)
  const eligibleForDiscount = entityType !== 'company' && entityType !== 'foreign_company'
  const cgtDiscountRate = entityType === 'smsf' || entityType === 'super_fund' ? (1 / 3) : 0.5

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

    const amendmentEntityType = entityType === 'individual' ? 'individual' as const
      : entityType === 'smsf' || entityType === 'super_fund' ? 'smsf' as const
      : entityType === 'non_profit' ? 'non_profit' as const
      : entityType === 'foreign_company' ? 'foreign_company' as const
      : 'company' as const
    const amendmentWarning = checkAmendmentPeriod(targetFY, amendmentEntityType)

    // Classify asset category for loss quarantining (s 108-10, s 108-20)
    const { category: assetCategory, note: assetCategoryNote } = classifyAssetCategory(tx)

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
      assetCategory,
      assetCategoryNote,
    }
  })

  // s 112-30 ITAA 1997: Flag CGT events where prior events on same asset may modify cost base
  adjustCostBaseForPriorEvents(events)

  // Calculate totals with loss quarantining (s 108-10, s 108-20 ITAA 1997)
  const totalCapitalGains = events.reduce((sum, e) => sum + e.capitalGain, 0)
  const totalCapitalLosses = events.reduce((sum, e) => sum + e.capitalLoss, 0)
  const priorYearCapitalLosses = options?.priorYearCapitalLosses ?? 0

  // Step 1: Separate gains and losses by asset category
  const collectableGains = events
    .filter(e => e.assetCategory === 'collectable')
    .reduce((sum, e) => sum + e.capitalGain, 0)
  const collectableLosses = events
    .filter(e => e.assetCategory === 'collectable')
    .reduce((sum, e) => sum + e.capitalLoss, 0)

  // Personal use asset losses are COMPLETELY DISREGARDED (s 108-20(1))
  const personalUseLossesDisregarded = events
    .filter(e => e.assetCategory === 'personal_use')
    .reduce((sum, e) => sum + e.capitalLoss, 0)

  // Other (non-quarantined) gains and losses
  const otherGains = events
    .filter(e => e.assetCategory === 'other')
    .reduce((sum, e) => sum + e.capitalGain, 0)
  const otherLosses = events
    .filter(e => e.assetCategory === 'other')
    .reduce((sum, e) => sum + e.capitalLoss, 0)
  // Personal use gains are included (only losses are disregarded)
  const personalUseGains = events
    .filter(e => e.assetCategory === 'personal_use')
    .reduce((sum, e) => sum + e.capitalGain, 0)

  // Step 2: Apply collectable losses against collectable gains ONLY (s 108-10(1))
  const collectableLossesApplied = Math.min(collectableLosses, collectableGains)
  const collectableLossesCarriedForward = collectableLosses - collectableLossesApplied
  const netCollectableGain = Math.max(0, collectableGains - collectableLossesApplied)

  // Step 3: Apply other losses (+ prior year) against all non-collectable-quarantined gains
  // Other losses CAN offset collectable gains (only collectable LOSSES are quarantined)
  const nonQuarantinedGains = netCollectableGain + otherGains + personalUseGains
  const availableOtherLosses = otherLosses + priorYearCapitalLosses
  const otherLossesApplied = Math.min(availableOtherLosses, nonQuarantinedGains)
  const capitalLossCarriedForward = availableOtherLosses - otherLossesApplied

  // Step 4: Net capital gain = all gains minus applied losses (excluding disregarded personal use losses)
  const netCapitalGainBeforeDiscount = Math.max(0, nonQuarantinedGains - otherLossesApplied)

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
    events, totalCapitalGains, totalCapitalLosses, taxableCapitalGain, div152,
    collectableLossesCarriedForward, personalUseLossesDisregarded
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
    collectableGains,
    collectableLosses,
    collectableLossesApplied,
    collectableLossesCarriedForward,
    personalUseLossesDisregarded,
    taxRateSource: rateSource,
    taxRateVerifiedAt: new Date().toISOString(),
    legislativeReferences: [
      'Division 102 ITAA 1997 (CGT events)',
      'Division 110 ITAA 1997 (Cost base)',
      's 112-30 ITAA 1997 (Prior CGT events modify cost base of subsequent events)',
      's 108-10 ITAA 1997 (Collectable losses quarantined — only offset collectable gains)',
      's 108-20 ITAA 1997 (Personal use asset losses disregarded)',
      'Division 115 ITAA 1997 (50% CGT discount)',
      'Division 152 ITAA 1997 (Small business CGT concessions)',
      'Subdivision 152-15 ITAA 1997 (Net asset test includes connected entities and affiliates)',
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
  const connectedEntities = options?.connectedEntities ?? []
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

  // Net asset test with connected entity aggregation (Subdivision 152-15 ITAA 1997)
  // The $6M threshold includes net assets of ALL connected entities and affiliates
  const connectedEntityAssets = connectedEntities.reduce((sum, ce) => sum + ce.netAssetValue, 0)
  const aggregatedNetAssets = netAssets !== undefined ? netAssets + connectedEntityAssets : null
  const CLIFF_EDGE_RATIO = 0.9 // Warn when within 10% of threshold
  const cliffEdgeThreshold = DIV152_NET_ASSET_THRESHOLD * CLIFF_EDGE_RATIO // $5.4M
  const cliffEdgeWarning = aggregatedNetAssets !== null
    && aggregatedNetAssets >= cliffEdgeThreshold
    && aggregatedNetAssets < DIV152_NET_ASSET_THRESHOLD

  let netAssetNote: string
  if (netAssets === undefined) {
    netAssetNote = 'Net asset value not provided. Cannot assess Subdiv 152-A net asset test.'
    if (connectedEntities.length > 0) {
      netAssetNote += ` Note: ${connectedEntities.length} connected entity/affiliate(s) provided but own net asset value is required.`
    }
  } else if (connectedEntities.length === 0) {
    netAssetNote = aggregatedNetAssets! < DIV152_NET_ASSET_THRESHOLD
      ? `Net assets $${aggregatedNetAssets!.toLocaleString('en-AU')} < $${DIV152_NET_ASSET_THRESHOLD.toLocaleString('en-AU')} threshold - test satisfied. ` +
        'WARNING: Subdivision 152-15 requires including connected entity and affiliate net assets. No connected entities were provided — verify completeness.'
      : `Net assets $${aggregatedNetAssets!.toLocaleString('en-AU')} >= $${DIV152_NET_ASSET_THRESHOLD.toLocaleString('en-AU')} threshold - test failed`
  } else {
    const breakdown = connectedEntities.map(ce =>
      `${ce.name} (${ce.relationship}): $${ce.netAssetValue.toLocaleString('en-AU')}`
    ).join('; ')
    netAssetNote = aggregatedNetAssets! < DIV152_NET_ASSET_THRESHOLD
      ? `Aggregated net assets $${aggregatedNetAssets!.toLocaleString('en-AU')} (own: $${netAssets.toLocaleString('en-AU')} + connected: $${connectedEntityAssets.toLocaleString('en-AU')}) < $${DIV152_NET_ASSET_THRESHOLD.toLocaleString('en-AU')} threshold - test satisfied (Subdiv 152-15). Connected entities: ${breakdown}`
      : `Aggregated net assets $${aggregatedNetAssets!.toLocaleString('en-AU')} (own: $${netAssets.toLocaleString('en-AU')} + connected: $${connectedEntityAssets.toLocaleString('en-AU')}) >= $${DIV152_NET_ASSET_THRESHOLD.toLocaleString('en-AU')} threshold - test failed. Connected entities: ${breakdown}`
  }
  if (cliffEdgeWarning) {
    netAssetNote += ` CLIFF EDGE WARNING: Aggregated net assets ($${aggregatedNetAssets!.toLocaleString('en-AU')}) are within 10% of the $${DIV152_NET_ASSET_THRESHOLD.toLocaleString('en-AU')} threshold. Small changes in asset values could change eligibility. Professional review strongly recommended.`
  }

  const netAssetTest = {
    met: aggregatedNetAssets !== null ? aggregatedNetAssets < DIV152_NET_ASSET_THRESHOLD : false,
    netAssetValue: netAssets ?? null,
    connectedEntityAssets,
    aggregatedNetAssets,
    threshold: DIV152_NET_ASSET_THRESHOLD,
    cliffEdgeWarning,
    note: netAssetNote,
    breakdown: connectedEntities.length > 0
      ? connectedEntities.map(ce => ({ name: ce.name, value: ce.netAssetValue, relationship: ce.relationship }))
      : undefined,
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

  // Connected entity warnings (Subdivision 152-15 ITAA 1997)
  if (netAssets !== undefined && connectedEntities.length === 0) {
    recommendations.push(
      'Subdivision 152-15 ITAA 1997: The $6M net asset test must include assets of connected entities and affiliates. ' +
      'No connected entities were provided — ensure all connected entities/affiliates have been identified.'
    )
  }
  if (netAssetTest.cliffEdgeWarning) {
    recommendations.push(
      `CLIFF EDGE: Aggregated net assets ($${aggregatedNetAssets!.toLocaleString('en-AU')}) are within 10% of the $6M threshold. ` +
      'Monitor asset values closely — small changes could disqualify Division 152 concessions entirely.'
    )
  }
  if (connectedEntities.length > 0 && !netAssetTest.met) {
    recommendations.push(
      `Connected entity aggregation caused net asset test failure: own assets ($${(netAssets ?? 0).toLocaleString('en-AU')}) ` +
      `plus connected entity assets ($${connectedEntityAssets.toLocaleString('en-AU')}) = $${aggregatedNetAssets!.toLocaleString('en-AU')} >= $6M threshold`
    )
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
 * Classify asset category for loss quarantining (s 108-10, s 108-20 ITAA 1997).
 *
 * - Collectables (s 108-10(2)): artwork, jewellery, antiques, coins, rare books, stamps, wine
 * - Personal use assets (s 108-20(2)): boats, furniture, electrical goods, sporting equipment
 * - Other: standard business/investment assets with no quarantining
 */
function classifyAssetCategory(
  tx: CGTForensicRow
): { category: CGTAssetCategory; note: string } {
  const description = (tx.transaction_description || '').toLowerCase()
  const primaryCategory = (tx.primary_category || '').toLowerCase()
  const combined = `${description} ${primaryCategory}`

  // Check collectable keywords first (s 108-10(2))
  for (const keyword of COLLECTABLE_KEYWORDS) {
    if (combined.includes(keyword)) {
      return {
        category: 'collectable',
        note: `Classified as collectable (s 108-10 ITAA 1997) — matched "${keyword}". ` +
          'Capital losses from collectables can ONLY offset capital gains from other collectables.',
      }
    }
  }

  // Check personal use asset keywords (s 108-20(2))
  for (const keyword of PERSONAL_USE_KEYWORDS) {
    if (combined.includes(keyword)) {
      return {
        category: 'personal_use',
        note: `Classified as personal use asset (s 108-20 ITAA 1997) — matched "${keyword}". ` +
          'Capital losses from personal use assets are COMPLETELY DISREGARDED.',
      }
    }
  }

  return {
    category: 'other',
    note: 'Standard capital asset — no loss quarantining applies.',
  }
}

/** CGT event types that may modify cost base of subsequent events (s 112-30 ITAA 1997) */
const COST_BASE_MODIFYING_EVENT_TYPES: CGTEventType[] = ['A1', 'C2', 'D1', 'H2']

/**
 * Detect CGT event interactions that may modify cost base (s 112-30 ITAA 1997).
 *
 * When multiple CGT events occur on the same asset, prior events can modify
 * the cost base used for calculating gains/losses on subsequent events.
 * Common scenarios:
 * - Partial disposal (A1) apportions cost base to the disposed portion
 * - Asset destruction (C2) preceding disposal (A1) affects cost base
 * - Creating contractual rights (D1) modifies cost base of underlying asset
 * - Receipt of assessable amounts (H2) adjusts subsequent cost base
 *
 * This function does NOT attempt to calculate the actual cost base adjustment
 * (which requires full asset register data). It flags the interaction for
 * professional review.
 *
 * @param events - Array of CGT events to analyse
 * @returns The same events with priorEventWarning populated where applicable
 */
function adjustCostBaseForPriorEvents(events: CGTEvent[]): CGTEvent[] {
  if (events.length <= 1) return events

  // Group events by asset description (normalised to lowercase, trimmed)
  const assetGroups = new Map<string, CGTEvent[]>()

  for (const event of events) {
    // Use normalised asset description as the grouping key
    const assetKey = event.assetDescription.toLowerCase().trim()
    if (!assetKey || assetKey === '') continue

    if (!assetGroups.has(assetKey)) {
      assetGroups.set(assetKey, [])
    }
    assetGroups.get(assetKey)!.push(event)
  }

  // For assets with multiple events, sort chronologically and flag interactions
  for (const [, assetEvents] of assetGroups) {
    if (assetEvents.length < 2) continue

    // Sort by disposal date ascending
    assetEvents.sort((a, b) => {
      const dateA = a.disposalDate || ''
      const dateB = b.disposalDate || ''
      return dateA.localeCompare(dateB)
    })

    // For each event after the first, check if any prior event could modify cost base
    for (let i = 1; i < assetEvents.length; i++) {
      const currentEvent = assetEvents[i]
      const priorEvents = assetEvents.slice(0, i)

      // Find prior events with cost-base-modifying event types
      const modifyingPriorEvents = priorEvents.filter(
        (pe) => COST_BASE_MODIFYING_EVENT_TYPES.includes(pe.eventType)
      )

      if (modifyingPriorEvents.length > 0) {
        const priorDates = modifyingPriorEvents
          .map((pe) => `${pe.eventType} on ${pe.disposalDate || 'unknown date'}`)
          .join('; ')

        currentEvent.priorEventWarning =
          `s 112-30 ITAA 1997: Cost base may be modified by ${modifyingPriorEvents.length} prior CGT event(s) ` +
          `on the same asset (${priorDates}). ` +
          'Prior CGT events can affect the cost base or reduced cost base used for this event. ' +
          'Review with tax advisor to ensure correct cost base allocation.'
      }
    }
  }

  return events
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
  div152: Div152Analysis | null,
  collectableLossesCarriedForward: number = 0,
  personalUseLossesDisregarded: number = 0
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

  // Loss quarantining warnings (s 108-10, s 108-20)
  if (personalUseLossesDisregarded > 0) {
    recommendations.push(
      `Personal use asset losses DISREGARDED: $${personalUseLossesDisregarded.toFixed(2)} ` +
      '(s 108-20(1) ITAA 1997 — losses from personal use assets cannot offset any capital gains)'
    )
  }
  if (collectableLossesCarriedForward > 0) {
    recommendations.push(
      `Collectable losses carried forward: $${collectableLossesCarriedForward.toFixed(2)} ` +
      '(s 108-10(1) ITAA 1997 — can only offset future capital gains from collectables)'
    )
  }

  if (taxableGain > 0) {
    recommendations.push(`Taxable capital gain after concessions: $${taxableGain.toFixed(2)}`)
    recommendations.push('Include in assessable income via the company tax return or individual return')
  }

  if (div152?.basicConditionsMet) {
    recommendations.push('Division 152 Small Business CGT Concessions are available')
  }

  // s 112-30 cost base interaction warnings
  const eventsWithPriorWarning = events.filter(e => e.priorEventWarning)
  if (eventsWithPriorWarning.length > 0) {
    recommendations.push(
      `${eventsWithPriorWarning.length} CGT event(s) may have cost base modified by prior events on the same asset ` +
      '(s 112-30 ITAA 1997). Professional review required to verify correct cost base allocation.'
    )
  }

  const uncertainEvents = events.filter(e => e.confidence < 60)
  if (uncertainEvents.length > 0) {
    recommendations.push(`${uncertainEvents.length} CGT event(s) have low confidence - professional review required`)
  }

  // Asset category classification warnings
  const collectableEvents = events.filter(e => e.assetCategory === 'collectable')
  const personalUseEvents = events.filter(e => e.assetCategory === 'personal_use')
  if (collectableEvents.length > 0 || personalUseEvents.length > 0) {
    recommendations.push(
      `Asset categorisation: ${collectableEvents.length} collectable, ${personalUseEvents.length} personal use. ` +
      'Verify classifications — incorrect categorisation affects loss offset eligibility.'
    )
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
    collectableGains: 0,
    collectableLosses: 0,
    collectableLossesApplied: 0,
    collectableLossesCarriedForward: 0,
    personalUseLossesDisregarded: 0,
    taxRateSource: 'none',
    taxRateVerifiedAt: new Date().toISOString(),
    legislativeReferences: [],
    recommendations: ['No CGT events found. Connect Xero and run analysis first.'],
    professionalReviewRequired: false,
  }
}
