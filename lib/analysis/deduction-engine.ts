/**
 * Deduction Optimization Engine (Division 8 ITAA 1997)
 *
 * Analyzes business expenses to identify:
 * - Unclaimed deductions (Section 8-1 general deductions)
 * - Instant asset write-offs (≤$20,000)
 * - Capital allowances (Division 40)
 * - Home office expenses
 * - Vehicle expenses
 * - Professional fees and subscriptions
 * - Non-deductible expenses (private/domestic)
 */

import { createServiceClient } from '@/lib/supabase/server'
import type { ForensicAnalysisRow } from '@/lib/types/forensic-analysis'

/** Extended forensic row with optional deduction-specific fields */
interface DeductionForensicRow extends ForensicAnalysisRow {
  deduction_reasoning?: string
}
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'
import { type EntityTypeForAmendment } from '@/lib/utils/financial-year'
import Decimal from 'decimal.js'
import { createLogger } from '@/lib/logger'

const log = createLogger('analysis:deduction')

// Deduction thresholds and rates
// NOTE: These are fallback values - actual values fetched from ATO.gov.au
const FALLBACK_INSTANT_WRITEOFF_THRESHOLD = 20000 // $20,000 (2024-25 fallback)
const FALLBACK_HOME_OFFICE_RATE_PER_HOUR = 0.67 // 67c per hour (2024-25 fallback)
const MIN_CONFIDENCE_FOR_CLAIM = 60 // Minimum confidence to recommend claiming

// Fallback corporate tax rates - s 23AA and s 23 ITAA 1997
const FALLBACK_CORPORATE_TAX_RATE_BASE = 0.25 // 25% base rate entity
const FALLBACK_CORPORATE_TAX_RATE_STANDARD = 0.30 // 30% standard corporate rate

// Small business turnover threshold for instant asset write-off - s 328-180 ITAA 1997
const SMALL_BUSINESS_TURNOVER_THRESHOLD = 10_000_000 // $10M

// Partial deductibility factors
const ENTERTAINMENT_DEDUCTIBILITY_FACTOR = new Decimal('0.50') // 50% deductible - FBTAA 1986, s 32-5

/**
 * Entity type for tax rate determination
 * - 'base_rate_entity': Turnover < $50M, pays 25% tax (s 23AA ITAA 1997)
 * - 'standard_company': Turnover >= $50M, pays 30% tax (s 23 ITAA 1997)
 * - 'trust': Tax saving depends on beneficiary marginal rates
 * - 'unknown': Defaults to 30% (conservative)
 */
export type EntityType = 'base_rate_entity' | 'standard_company' | 'trust' | 'unknown'

/**
 * Deduction status - all identified deductions are 'potential' until verified
 * against lodged tax returns. This system analyses Xero transactions and AI
 * analysis results but has no access to actual ATO lodgement data.
 */
export type DeductionStatus = 'potential'

/**
 * Options for deduction analysis
 */
export interface DeductionAnalysisOptions {
  /** Entity type for tax rate determination. Defaults to 'unknown' (30% rate). */
  entityType?: EntityType
  /** Whether entity qualifies as base rate entity (turnover < $50M). Defaults to false. */
  isBaseRateEntity?: boolean
  /** Whether entity is a small business (turnover < $10M) for instant asset write-off. Defaults to false. */
  isSmallBusiness?: boolean
  /** Annual turnover (used to auto-determine entity type if not specified) */
  annualTurnover?: number
  /**
   * Percentage of assessable income that is base rate entity passive income (0-100).
   * s 23AA ITAA 1997 requires BOTH turnover < $50M AND passive income <= 80%
   * for the 25% base rate to apply.
   * Passive income includes: dividends, franking credits, interest, royalties,
   * rent, net capital gains, and certain trust distributions.
   * If not provided, a warning will be included when base rate is applied.
   */
  passiveIncomePercentage?: number
  /**
   * Entity type for amendment period checks (maps to shared utility).
   * If not provided, derived from entityType.
   */
  entityTypeForAmendment?: EntityTypeForAmendment
}

// Cache for tax rates (refreshed per function invocation)
let cachedRates: {
  instantWriteOffThreshold: number
  homeOfficeRatePerHour: number
  source: string
} | null = null

/**
 * Get current deduction thresholds from ATO (cached for 24 hours)
 */
async function getDeductionThresholds(): Promise<{
  instantWriteOffThreshold: number
  homeOfficeRatePerHour: number
  source: string
}> {
  if (cachedRates) {
    return cachedRates
  }

  try {
    const rates = await getCurrentTaxRates()

    cachedRates = {
      instantWriteOffThreshold: rates.instantWriteOffThreshold || FALLBACK_INSTANT_WRITEOFF_THRESHOLD,
      homeOfficeRatePerHour: rates.homeOfficeRatePerHour || FALLBACK_HOME_OFFICE_RATE_PER_HOUR,
      source: rates.sources.instantWriteOff || 'ATO_FALLBACK_DEFAULT'
    }

    return cachedRates
  } catch (error) {
    console.warn('Failed to fetch current tax rates, using fallback values:', error)

    // Return fallback values on error
    return {
      instantWriteOffThreshold: FALLBACK_INSTANT_WRITEOFF_THRESHOLD,
      homeOfficeRatePerHour: FALLBACK_HOME_OFFICE_RATE_PER_HOUR,
      source: 'ERROR_FALLBACK'
    }
  }
}

// Deduction categories
export type DeductionCategory =
  | 'Instant Asset Write-Off'
  | 'Professional Fees'
  | 'Marketing & Advertising'
  | 'Office Expenses'
  | 'Software & Subscriptions'
  | 'Travel Expenses'
  | 'Vehicle Expenses'
  | 'Home Office'
  | 'Insurance'
  | 'Bank Fees'
  | 'Repairs & Maintenance'
  | 'Utilities'
  | 'Training & Education'
  | 'Capital Allowance (Division 40)'
  | 'Interest Expenses'
  | 'Bad Debts'
  | 'Entertainment & Meals'
  | 'Clothing & Uniforms'
  | 'Phone & Internet'
  | 'Gifts & Donations'
  | 'Other Deductible Expenses'
  | 'Non-Deductible (Private/Domestic)'

export interface DeductionTransaction {
  transactionId: string
  transactionDate: string
  description: string
  amount: number
  supplier: string | null
  category: DeductionCategory
  isFullyDeductible: boolean
  deductibleAmount: number
  nonDeductibleAmount: number
  deductionType: string // e.g., 'Section 8-1', 'Division 40', etc.
  confidence: number
  reasoning: string
  restrictions: string[]
  /**
   * All identified deductions are 'potential' - this system analyses Xero data
   * and AI results but cannot confirm whether expenses were included in prior
   * lodged tax returns. Verify against lodged returns before claiming.
   */
  status: DeductionStatus
  /** Partial deductibility factor applied (1.0 = fully deductible, 0.5 = 50%, etc.) */
  partialDeductibilityFactor?: number
  /** Notes about partial deductibility rules or claiming methods */
  deductibilityNotes?: string[]
  /** Whether this is an asset eligible for instant write-off vs depreciation */
  assetWriteOffEligible?: boolean
  /** Asset treatment note (instant write-off or depreciation) */
  assetTreatmentNote?: string
}

export interface DeductionOpportunity {
  category: DeductionCategory
  financialYear: string
  totalAmount: number
  /**
   * @deprecated Retained for backward compatibility. Always 0 - this system cannot
   * determine whether deductions were included in lodged tax returns.
   */
  claimedAmount: number
  /**
   * Total potentially deductible amount. All amounts are 'potential' and must be
   * verified against lodged tax returns before claiming.
   */
  unclaimedAmount: number
  transactionCount: number
  transactions: DeductionTransaction[]
  legislativeReference: string
  confidence: number
  recommendations: string[]
  /**
   * Estimated tax saving calculated using the applicable corporate tax rate.
   * Default: 30% (s 23 ITAA 1997). For base rate entities: 25% (s 23AA ITAA 1997).
   * For trusts: depends on beneficiary marginal rates.
   */
  estimatedTaxSaving: number
  /** The tax rate used for estimatedTaxSaving calculation */
  appliedTaxRate: number
  /** Note about how tax saving was calculated */
  taxRateNote: string
  requiresDocumentation: boolean
  documentationRequired: string[]
  fbtImplications: boolean
  /** Verification note - always present to remind users to check lodged returns */
  verificationNote: string
}

export interface DeductionSummary {
  totalOpportunities: number
  totalUnclaimedDeductions: number
  totalEstimatedTaxSaving: number
  opportunitiesByYear: Record<string, number>
  unclaimedByYear: Record<string, number>
  opportunitiesByCategory: Record<DeductionCategory, number>
  averageConfidence: number
  highValueOpportunities: DeductionOpportunity[] // >$10k
  opportunities: DeductionOpportunity[]
  /** Source URL of the tax rate used for calculations */
  taxRateSource: string
  /** Timestamp of when the tax rates were verified */
  taxRateVerifiedAt: string
}

/**
 * Determine the applicable corporate tax rate based on entity type.
 *
 * - Base rate entity (turnover < $50M): 25% - s 23AA ITAA 1997
 * - Standard company (turnover >= $50M): 30% - s 23 ITAA 1997
 * - Trust: depends on beneficiary marginal rates (defaults to 30% as conservative estimate)
 * - Unknown: defaults to 30% (conservative) - s 23 ITAA 1997
 */
/**
 * Determine the applicable corporate tax rate based on entity type.
 */
export async function determineTaxRate(options?: DeductionAnalysisOptions): Promise<{
  rate: Decimal
  rateNumber: number
  note: string
}> {
  const entityType = options?.entityType ?? 'unknown'
  const isBaseRate = options?.isBaseRateEntity ?? false

  let rateBase = FALLBACK_CORPORATE_TAX_RATE_BASE
  let rateStandard = FALLBACK_CORPORATE_TAX_RATE_STANDARD

  try {
    const liveRates = await getCurrentTaxRates()
    if (liveRates.corporateTaxRateSmall) rateBase = liveRates.corporateTaxRateSmall
    if (liveRates.corporateTaxRateStandard) rateStandard = liveRates.corporateTaxRateStandard
  } catch (err) {
    console.warn('Failed to fetch live corporate rates for deduction engine', err)
  }

  // Helper: check passive income test (s 23AA ITAA 1997)
  // Base rate entity requires BOTH: turnover < $50M AND passive income <= 80%
  const passiveIncome = options?.passiveIncomePercentage
  const passiveIncomeFailsTest = passiveIncome !== undefined && passiveIncome > 80

  // Auto-determine from turnover if available
  if (options?.annualTurnover !== undefined && entityType === 'unknown') {
    if (options.annualTurnover < 50_000_000) {
      // Check passive income test before applying base rate
      if (passiveIncomeFailsTest) {
        return {
          rate: new Decimal(rateStandard),
          rateNumber: rateStandard,
          note: `Turnover < $50M but passive income is ${passiveIncome}% (>80%) - does NOT qualify as base rate entity. Standard ${rateStandard * 100}% rate applies (s 23AA ITAA 1997 passive income test failed).`,
        }
      }
      const passiveNote = passiveIncome !== undefined
        ? ` Passive income: ${passiveIncome}% (passes <= 80% test).`
        : ' WARNING: Passive income percentage not provided - base rate entity status unverified. s 23AA requires passive income <= 80%.'
      return {
        rate: new Decimal(rateBase),
        rateNumber: rateBase,
        note: `Base rate entity (turnover < $50M) - ${rateBase * 100}% tax rate (s 23AA ITAA 1997).${passiveNote}`,
      }
    }
    return {
      rate: new Decimal(rateStandard),
      rateNumber: rateStandard,
      note: `Standard corporate rate (turnover >= $50M) - ${rateStandard * 100}% tax rate (s 23 ITAA 1997)`,
    }
  }

  if (entityType === 'base_rate_entity' || isBaseRate) {
    // Check passive income test before applying base rate
    if (passiveIncomeFailsTest) {
      return {
        rate: new Decimal(rateStandard),
        rateNumber: rateStandard,
        note: `Entity marked as base rate but passive income is ${passiveIncome}% (>80%) - does NOT qualify. Standard ${rateStandard * 100}% rate applies (s 23AA ITAA 1997 passive income test failed).`,
      }
    }
    const passiveNote = passiveIncome !== undefined
      ? ` Passive income: ${passiveIncome}% (passes <= 80% test).`
      : ' WARNING: Passive income percentage not provided - base rate entity status unverified. s 23AA requires passive income <= 80%.'
    return {
      rate: new Decimal(rateBase),
      rateNumber: rateBase,
      note: `Base rate entity - ${rateBase * 100}% tax rate (s 23AA ITAA 1997).${passiveNote}`,
    }
  }

  if (entityType === 'trust') {
    return {
      rate: new Decimal(rateStandard),
      rateNumber: rateStandard,
      note: `Trust entity - tax saving depends on beneficiary marginal rates. Using ${rateStandard * 100}% as conservative estimate.`,
    }
  }

  // Default to standard rate (conservative) for unknown or standard_company
  return {
    rate: new Decimal(rateStandard),
    rateNumber: rateStandard,
    note: entityType === 'standard_company'
      ? `Standard corporate rate - ${rateStandard * 100}% tax rate (s 23 ITAA 1997)`
      : `Entity type unknown - defaulting to ${rateStandard * 100}% standard corporate rate (s 23 ITAA 1997). Specify entityType for accurate calculation.`,
  }
}

/**
 * Determine whether an entity qualifies as small business for
 * instant asset write-off purposes (turnover < $10M).
 */
function isSmallBusinessEntity(options?: DeductionAnalysisOptions): boolean {
  if (options?.isSmallBusiness !== undefined) return options.isSmallBusiness
  if (options?.annualTurnover !== undefined) {
    return options.annualTurnover < SMALL_BUSINESS_TURNOVER_THRESHOLD
  }
  return false // Conservative default - don't assume small business
}

/**
 * Apply partial deductibility rules based on expense category.
 * Returns the adjusted deductible amount and any notes about claiming rules.
 *
 * Categories with special rules:
 * - Entertainment/meals: 50% deductible (FBTAA 1986, s 32-5)
 * - Home office: fixed rate method (67c/hour) or actual cost method (PCG 2023/1)
 * - Vehicle: cents per km (85c/km, max 5,000km - TD 2024/3) or logbook method
 * - Phone/internet: apportion business use percentage
 * - Clothing: only deductible if occupation-specific or registered uniform
 * - Self-education/training: must connect to current income-earning activity (s 8-1 ITAA 1997)
 * - Gifts/donations: must be to DGR and exceed $2
 */
function applyPartialDeductibilityRules(
  category: DeductionCategory,
  amount: number,
  description: string
): {
  adjustedAmount: number
  factor: number
  notes: string[]
} {
  const notes: string[] = []
  let factor = 1.0

  switch (category) {
    case 'Entertainment & Meals':
      // Entertainment expenses: 50% deductible - FBTAA 1986, s 32-5
      factor = ENTERTAINMENT_DEDUCTIBILITY_FACTOR.toNumber()
      notes.push(
        'Entertainment/meal expenses are 50% deductible (FBTAA 1986, s 32-5). ' +
        'The remaining 50% is subject to FBT or non-deductible.'
      )
      break

    case 'Home Office':
      notes.push(
        'Claim using fixed rate method (67c/hour - PCG 2023/1) or actual cost method. ' +
        'The fixed rate method covers electricity, phone, internet, stationery, and depreciation of equipment. ' +
        'Maintain a record of hours worked from home.'
      )
      break

    case 'Vehicle Expenses':
      notes.push(
        'Claim using cents per km method (85c/km, max 5,000 business km - TD 2024/3) or logbook method. ' +
        'Logbook method requires a 12-week continuous logbook showing business vs private use.'
      )
      break

    case 'Phone & Internet':
      notes.push(
        'Apportion business use percentage. Keep records of business vs personal use ' +
        '(e.g., itemised phone bills or a 4-week representative diary).'
      )
      break

    case 'Clothing & Uniforms':
      notes.push(
        'Only deductible if occupation-specific protective clothing or a registered uniform ' +
        '(registered with AusIndustry). Conventional clothing is not deductible even if worn for work.'
      )
      break

    case 'Training & Education':
      notes.push(
        'Must have sufficient connection to current income-earning activity (s 8-1 ITAA 1997). ' +
        'Not deductible if it relates to a new profession or is too general in nature.'
      )
      break

    case 'Gifts & Donations':
      notes.push(
        'Deductible only if recipient has Deductible Gift Recipient (DGR) status and the gift exceeds $2. ' +
        'Verify DGR status on the ABN Lookup (abr.business.gov.au).'
      )
      break

    default:
      // No partial deductibility rule applies
      break
  }

  // Also check description for entertainment-like expenses in other categories
  if (category !== 'Entertainment & Meals' && category !== 'Non-Deductible (Private/Domestic)') {
    const descLower = (description || '').toLowerCase()
    if (
      descLower.includes('entertainment') ||
      descLower.includes('dining') ||
      descLower.includes('restaurant') ||
      descLower.includes('catering')
    ) {
      factor = ENTERTAINMENT_DEDUCTIBILITY_FACTOR.toNumber()
      notes.push(
        'This expense appears to be entertainment-related. Entertainment expenses are 50% deductible ' +
        '(FBTAA 1986, s 32-5). Review to confirm entertainment classification.'
      )
    }
  }

  const adjustedAmount = new Decimal(amount).times(new Decimal(factor)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()

  return { adjustedAmount, factor, notes }
}

/**
 * Apply instant asset write-off vs depreciation rules for capital assets.
 *
 * - Asset < $20,000 AND small business (turnover < $10M): instant write-off (s 328-180 ITAA 1997)
 * - Asset >= $20,000 OR not small business: depreciate under Division 40 ITAA 1997
 * - Small business depreciation pool: 15% first year, 30% subsequent (s 328-185 ITAA 1997)
 */
function applyAssetWriteOffRules(
  amount: number,
  isSmallBusiness: boolean,
  thresholdOverride?: number
): {
  eligible: boolean
  note: string
} {
  const threshold = thresholdOverride ?? FALLBACK_INSTANT_WRITEOFF_THRESHOLD

  if (amount < threshold && isSmallBusiness) {
    return {
      eligible: true,
      note:
        `Eligible for instant asset write-off (cost $${amount.toLocaleString('en-AU')} < $${threshold.toLocaleString('en-AU')} threshold, ` +
        `small business entity). Claim immediate deduction under s 328-180 ITAA 1997. ` +
        `Asset must be first used or installed ready for use in the relevant income year.`,
    }
  }

  if (amount >= threshold) {
    return {
      eligible: false,
      note:
        `Asset cost $${amount.toLocaleString('en-AU')} exceeds instant write-off threshold ($${threshold.toLocaleString('en-AU')}). ` +
        `Must be depreciated under Division 40 ITAA 1997 using effective life or diminishing value method. ` +
        (isSmallBusiness
          ? `Small business entities may add to general depreciation pool: 15% first year, 30% subsequent years (s 328-185 ITAA 1997).`
          : `Capital assets cannot be claimed as immediate deductions unless eligible for instant asset write-off.`),
    }
  }

  // Not small business but under threshold
  return {
    eligible: false,
    note:
      `Entity does not qualify as small business (turnover >= $10M). Asset must be depreciated under ` +
      `Division 40 ITAA 1997 regardless of cost. Capital assets cannot be claimed as immediate deductions ` +
      `unless eligible for instant asset write-off.`,
  }
}

/**
 * Analyse all deduction opportunities for a tenant
 */
export async function analyzeDeductionOpportunities(
  tenantId: string,
  startYear?: string,
  endYear?: string,
  options?: DeductionAnalysisOptions
): Promise<DeductionSummary> {
  const supabase = await createServiceClient()

  // Fetch all analysed transactions with deduction eligibility
  let query = supabase
    .from('forensic_analysis_results')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('transaction_date', { ascending: true })

  if (startYear) {
    query = query.gte('financial_year', startYear)
  }
  if (endYear) {
    query = query.lte('financial_year', endYear)
  }

  const { data: transactions, error } = await query

  if (error) {
    console.error('Failed to fetch transactions:', error)
    throw new Error(`Failed to fetch transactions: ${error.message}`)
  }

  if (!transactions || transactions.length === 0) {
    return {
      ...createEmptySummary(),
      taxRateSource: 'none',
      taxRateVerifiedAt: new Date().toISOString()
    }
  }

  log.info('Analysing transactions for deduction opportunities', { count: transactions.length })

  // Determine tax rate and small business status
  const taxRateInfo = await determineTaxRate(options)
  const smallBusiness = isSmallBusinessEntity(options)

  // Group transactions by category and financial year
  const opportunities = groupByDeductionCategory(transactions, taxRateInfo, smallBusiness)

  // Determine source of rates (fetch again to get source metadata)
  const rateSource = (await getDeductionThresholds()).source

  // Calculate summary statistics
  // Calculate summary statistics
  const summary = calculateDeductionSummary(opportunities, rateSource)

  return summary

  return summary
}

/**
 * Group transactions by deduction category and financial year
 */
function groupByDeductionCategory(
  transactions: DeductionForensicRow[],
  taxRateInfo: { rate: Decimal; rateNumber: number; note: string },
  isSmallBusiness: boolean
): DeductionOpportunity[] {
  const categoryYearMap = new Map<string, DeductionForensicRow[]>()

  transactions.forEach((tx) => {
    const category = mapToDeductionCategory(tx.primary_category)
    const year = tx.financial_year
    const key = `${category}|${year}`

    if (!categoryYearMap.has(key)) {
      categoryYearMap.set(key, [])
    }
    categoryYearMap.get(key)!.push(tx)
  })

  const opportunities: DeductionOpportunity[] = []

  categoryYearMap.forEach((txs, key) => {
    const [category, year] = key.split('|')
    const opportunity = analyzeDeductionCategory(
      category as DeductionCategory,
      year,
      txs,
      taxRateInfo,
      isSmallBusiness
    )

    // Only include if there are potential deductions
    if (opportunity.unclaimedAmount > 0) {
      opportunities.push(opportunity)
    }
  })

  // Sort by potential deduction amount (descending)
  opportunities.sort((a, b) => b.unclaimedAmount - a.unclaimedAmount)

  return opportunities
}

/**
 * Analyse a specific deduction category for a financial year.
 *
 * Fix 3a: All deductions are classified as status: 'potential'. This system analyses
 *   Xero transactions and AI results but has NO access to lodged tax return data.
 *   High AI confidence means the expense is likely deductible, NOT that it was claimed.
 *
 * Fix 3b: Tax rate is dynamic based on entity type (25% or 30%).
 *
 * Fix 3c: Partial deductibility rules applied per category.
 *
 * Fix 3d: Capital assets assessed for instant write-off vs depreciation.
 */
function analyzeDeductionCategory(
  category: DeductionCategory,
  financialYear: string,
  transactions: DeductionForensicRow[],
  taxRateInfo: { rate: Decimal; rateNumber: number; note: string },
  isSmallBusiness: boolean
): DeductionOpportunity {
  let totalAmount = 0
  // claimedAmount is always 0 - we cannot determine whether deductions were
  // included in lodged tax returns (Fix 3a)
  const claimedAmount = 0
  let potentialDeductibleAmount = 0
  let totalConfidence = 0

  const isCapitalCategory =
    category === 'Capital Allowance (Division 40)' || category === 'Instant Asset Write-Off'

  const deductionTransactions: DeductionTransaction[] = transactions.map((tx) => {
    const amount = Math.abs(parseFloat(String(tx.transaction_amount)) || 0)
    totalAmount += amount

    const isFullyDeductible = tx.is_fully_deductible || false
    const rawDeductibleAmount = parseFloat(String(tx.claimable_amount)) || (isFullyDeductible ? amount : 0)
    const description = tx.transaction_description || ''

    // Fix 3c: Apply partial deductibility rules based on category
    const partialRules = applyPartialDeductibilityRules(category, rawDeductibleAmount, description)
    const adjustedDeductibleAmount = partialRules.adjustedAmount
    const nonDeductibleAmount = amount - adjustedDeductibleAmount

    // Fix 3d: Apply asset write-off vs depreciation rules for capital assets
    let assetWriteOffEligible: boolean | undefined
    let assetTreatmentNote: string | undefined
    if (isCapitalCategory) {
      const assetRules = applyAssetWriteOffRules(amount, isSmallBusiness)
      assetWriteOffEligible = assetRules.eligible
      assetTreatmentNote = assetRules.note
    }

    // Fix 3a: All deductions are 'potential' - confidence reflects how likely
    // the expense is deductible, NOT whether it was already claimed
    if (isFullyDeductible || adjustedDeductibleAmount > 0) {
      potentialDeductibleAmount += adjustedDeductibleAmount
    }

    totalConfidence += tx.deduction_confidence || 0

    return {
      transactionId: tx.transaction_id,
      transactionDate: tx.transaction_date || '',
      description,
      amount,
      supplier: tx.supplier_name,
      category,
      isFullyDeductible: partialRules.factor === 1.0 && isFullyDeductible,
      deductibleAmount: adjustedDeductibleAmount,
      nonDeductibleAmount,
      deductionType: tx.deduction_type || 'Section 8-1',
      confidence: tx.deduction_confidence ?? 0,
      reasoning: tx.deduction_reasoning || '',
      restrictions: tx.deduction_restrictions || [],
      // Fix 3a: Always 'potential' - cannot confirm against lodged returns
      status: 'potential' as DeductionStatus,
      // Fix 3c: Partial deductibility factor and notes
      partialDeductibilityFactor: partialRules.factor,
      deductibilityNotes: partialRules.notes.length > 0 ? partialRules.notes : undefined,
      // Fix 3d: Asset treatment
      assetWriteOffEligible,
      assetTreatmentNote,
    }
  })

  const averageConfidence = transactions.length > 0 ? Math.round(totalConfidence / transactions.length) : 0

  // Fix 3b: Calculate estimated tax saving using dynamic tax rate
  const estimatedTaxSaving = new Decimal(potentialDeductibleAmount)
    .times(taxRateInfo.rate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber()

  // Get legislative reference
  const legislativeReference = getLegislativeReference(category)

  // Generate recommendations (updated for Fix 3a - no claimed/unclaimed distinction)
  const recommendations = generateDeductionRecommendations(
    category,
    potentialDeductibleAmount,
    claimedAmount,
    transactions.length,
    averageConfidence,
    taxRateInfo
  )

  // Determine documentation requirements
  const requiresDocumentation = potentialDeductibleAmount > 1000 // Require docs for >$1k
  const documentationRequired = generateDeductionDocumentation(category, potentialDeductibleAmount, transactions.length)

  // Check FBT implications
  const fbtImplications = checkFbtImplications(category)

  return {
    category,
    financialYear,
    totalAmount,
    claimedAmount, // Always 0 - retained for backward compatibility (Fix 3a)
    unclaimedAmount: potentialDeductibleAmount,
    transactionCount: transactions.length,
    transactions: deductionTransactions,
    legislativeReference,
    confidence: averageConfidence,
    recommendations,
    estimatedTaxSaving,
    appliedTaxRate: taxRateInfo.rateNumber,
    taxRateNote: taxRateInfo.note,
    requiresDocumentation,
    documentationRequired,
    fbtImplications,
    verificationNote:
      'Verify against lodged tax return before claiming. This analysis identifies potentially ' +
      'deductible expenses from Xero data but cannot confirm whether they were included in prior returns.',
  }
}

/**
 * Map AI category to standard deduction category
 */
function mapToDeductionCategory(aiCategory: string | null): DeductionCategory {
  if (!aiCategory) return 'Other Deductible Expenses'

  const category = aiCategory.toLowerCase()

  // Entertainment & Meals - 50% deductible (FBTAA 1986, s 32-5)
  if (
    category.includes('entertainment') ||
    category.includes('meal') ||
    category.includes('dining') ||
    category.includes('restaurant') ||
    category.includes('catering')
  ) {
    return 'Entertainment & Meals'
  }
  if (category.includes('software') || category.includes('subscription') || category.includes('saas')) {
    return 'Software & Subscriptions'
  }
  if (category.includes('marketing') || category.includes('advertising')) {
    return 'Marketing & Advertising'
  }
  if (category.includes('professional') || category.includes('legal') || category.includes('accounting')) {
    return 'Professional Fees'
  }
  if (category.includes('office') || category.includes('stationery')) {
    return 'Office Expenses'
  }
  if (category.includes('travel')) {
    return 'Travel Expenses'
  }
  if (category.includes('vehicle') || category.includes('motor')) {
    return 'Vehicle Expenses'
  }
  if (category.includes('home office')) {
    return 'Home Office'
  }
  if (category.includes('insurance')) {
    return 'Insurance'
  }
  if (category.includes('bank') || category.includes('fee')) {
    return 'Bank Fees'
  }
  if (category.includes('repair') || category.includes('maintenance')) {
    return 'Repairs & Maintenance'
  }
  // Phone & Internet - apportion business use
  if (category.includes('phone') || category.includes('mobile') || category.includes('telecommunication')) {
    return 'Phone & Internet'
  }
  if (category.includes('utilities') || category.includes('electricity') || category.includes('internet')) {
    return 'Utilities'
  }
  if (category.includes('training') || category.includes('education') || category.includes('course')) {
    return 'Training & Education'
  }
  // Clothing & Uniforms - only occupation-specific
  if (category.includes('clothing') || category.includes('uniform') || category.includes('workwear')) {
    return 'Clothing & Uniforms'
  }
  if (category.includes('asset') || category.includes('equipment') || category.includes('depreciation')) {
    return 'Capital Allowance (Division 40)'
  }
  if (category.includes('interest')) {
    return 'Interest Expenses'
  }
  if (category.includes('bad debt')) {
    return 'Bad Debts'
  }
  // Gifts & Donations - must be to DGR, exceed $2
  if (category.includes('gift') || category.includes('donation') || category.includes('charity')) {
    return 'Gifts & Donations'
  }
  if (category.includes('private') || category.includes('domestic') || category.includes('personal')) {
    return 'Non-Deductible (Private/Domestic)'
  }

  return 'Other Deductible Expenses'
}

/**
 * Get legislative reference for deduction category
 */
function getLegislativeReference(category: DeductionCategory): string {
  switch (category) {
    case 'Instant Asset Write-Off':
      return 'Section 328-180 ITAA 1997 (Simplified depreciation - instant asset write-off for small business entities)'
    case 'Capital Allowance (Division 40)':
      return 'Division 40 ITAA 1997 (Capital allowances and depreciation)'
    case 'Professional Fees':
    case 'Marketing & Advertising':
    case 'Office Expenses':
    case 'Software & Subscriptions':
    case 'Travel Expenses':
    case 'Repairs & Maintenance':
    case 'Utilities':
    case 'Other Deductible Expenses':
      return 'Section 8-1 ITAA 1997 (General deductions)'
    case 'Vehicle Expenses':
      return 'Section 8-1 ITAA 1997 (General deductions - business use portion; TD 2024/3 cents per km rate)'
    case 'Home Office':
      return 'Section 8-1 ITAA 1997 (Home office expenses - PCG 2023/1 fixed rate or actual cost method)'
    case 'Insurance':
      return 'Section 8-1 ITAA 1997 (Business insurance premiums)'
    case 'Bank Fees':
      return 'Section 8-1 ITAA 1997 (Borrowing expenses)'
    case 'Interest Expenses':
      return 'Section 8-1 ITAA 1997 (Interest on business loans)'
    case 'Bad Debts':
      return 'Section 8-1 & Section 25-35 ITAA 1997 (Bad debts)'
    case 'Entertainment & Meals':
      return 'FBTAA 1986, s 32-5 ITAA 1997 (Entertainment expenses - 50% deductible)'
    case 'Clothing & Uniforms':
      return 'Section 8-1 ITAA 1997 (Occupation-specific clothing and registered uniforms only)'
    case 'Phone & Internet':
      return 'Section 8-1 ITAA 1997 (Telecommunications - business use portion)'
    case 'Gifts & Donations':
      return 'Division 30 ITAA 1997 (Gifts to Deductible Gift Recipients exceeding $2)'
    case 'Training & Education':
      return 'Section 8-1 ITAA 1997 (Self-education connected to current income-earning activity)'
    case 'Non-Deductible (Private/Domestic)':
      return 'Section 8-1(2)(b) ITAA 1997 (Private or domestic expenses - not deductible)'
    default:
      return 'Section 8-1 ITAA 1997 (General deductions)'
  }
}

/**
 * Generate recommendations for deduction category.
 *
 * Fix 3a: Recommendations no longer assume expenses were/weren't claimed.
 * All deductions are 'potential' and must be verified against lodged returns.
 *
 * Fix 3b: Uses dynamic tax rate instead of hardcoded 25%.
 */
function generateDeductionRecommendations(
  category: DeductionCategory,
  potentialAmount: number,
  _claimedAmount: number,
  transactionCount: number,
  confidence: number,
  taxRateInfo?: { rate: Decimal; rateNumber: number; note: string }
): string[] {
  const recommendations: string[] = []

  if (category === 'Non-Deductible (Private/Domestic)') {
    recommendations.push('Private or domestic expenses are not deductible (s 8-1(2)(b) ITAA 1997)')
    recommendations.push('Ensure these expenses are not claimed in tax return')
    return recommendations
  }

  if (potentialAmount === 0) {
    recommendations.push('No potentially deductible expenses identified in this category')
    return recommendations
  }

  if (confidence < MIN_CONFIDENCE_FOR_CLAIM) {
    recommendations.push(`Low confidence (${confidence}%) - review with accountant before claiming`)
  }

  // Fix 3b: Calculate tax saving with dynamic rate
  const taxRate = taxRateInfo?.rate ?? new Decimal(FALLBACK_CORPORATE_TAX_RATE_STANDARD)
  const taxRatePercent = taxRate.times(100).toNumber()
  const taxSaving = new Decimal(potentialAmount).times(taxRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()

  recommendations.push(
    `Potentially deductible: $${potentialAmount.toFixed(2)} across ${transactionCount} transactions`
  )
  recommendations.push(
    `Estimated tax saving: $${taxSaving.toFixed(2)} at ${taxRatePercent}% corporate rate` +
    (taxRateInfo ? ` (${taxRateInfo.note})` : '')
  )

  // Fix 3a: Always include verification reminder
  recommendations.push(
    'Verify against lodged tax returns - this analysis identifies potentially deductible expenses ' +
    'but cannot confirm whether they were included in prior returns'
  )

  if (category === 'Instant Asset Write-Off') {
    recommendations.push('Lodge amended return to claim instant asset write-off if not previously claimed')
    recommendations.push(
      'Ensure assets are under $20,000 (s 328-180 ITAA 1997) and first used/installed ready for use'
    )
    recommendations.push('Retain invoices and proof of payment')
  } else if (category === 'Capital Allowance (Division 40)') {
    recommendations.push(
      'Determine whether asset qualifies for instant write-off or must be depreciated (Division 40 ITAA 1997)'
    )
    recommendations.push('Calculate depreciation using effective life or diminishing value method')
    recommendations.push('Lodge amended return if depreciation was not claimed')
  } else if (category === 'Home Office') {
    recommendations.push('Use either 67c per hour method (PCG 2023/1) or actual cost method (whichever is higher)')
    recommendations.push('Maintain diary or timesheet showing hours worked from home')
  } else if (category === 'Vehicle Expenses') {
    recommendations.push('Use cents per km method (85c/km for 2024-25 - TD 2024/3) or logbook method')
    recommendations.push('Maintain logbook for 12 continuous weeks if using logbook method')
  } else if (category === 'Entertainment & Meals') {
    recommendations.push('Entertainment expenses are only 50% deductible (FBTAA 1986, s 32-5)')
    recommendations.push('Consider whether FBT applies if provided to employees')
  } else if (category === 'Clothing & Uniforms') {
    recommendations.push(
      'Only deductible if occupation-specific protective clothing or a registered uniform. ' +
      'Conventional clothing is not deductible.'
    )
  } else if (category === 'Phone & Internet') {
    recommendations.push('Apportion business use percentage based on records or representative diary')
  } else if (category === 'Gifts & Donations') {
    recommendations.push(
      'Deductible only if recipient has DGR status and amount exceeds $2 (Division 30 ITAA 1997)'
    )
  } else if (category === 'Training & Education') {
    recommendations.push(
      'Must have sufficient connection to current income-earning activity (s 8-1 ITAA 1997)'
    )
  } else {
    recommendations.push('Lodge amended return to claim if not previously claimed')
    recommendations.push('Ensure expenses have business purpose (nexus to income generation)')
  }

  recommendations.push('Retain all invoices, receipts, and proof of payment (5 years)')

  if (potentialAmount > 10000) {
    recommendations.push('High-value potential claim - ensure comprehensive documentation is available')
    recommendations.push('Professional review recommended before lodging amended return')
  }

  return recommendations
}

/**
 * Generate documentation requirements for deduction
 */
function generateDeductionDocumentation(
  category: DeductionCategory,
  amount: number,
  transactionCount: number
): string[] {
  const docs: string[] = []

  docs.push(`Invoices and receipts for all ${transactionCount} transactions`)
  docs.push('Proof of payment (bank statements, credit card statements)')

  if (category === 'Instant Asset Write-Off' || category === 'Capital Allowance (Division 40)') {
    docs.push('Asset register showing purchase date, cost, and depreciation')
    docs.push('Proof asset is first used/installed ready for use')
  }

  if (category === 'Home Office') {
    docs.push('Diary or timesheet showing hours worked from home')
    docs.push('Floor plan showing dedicated work area (if using actual cost method)')
    docs.push('Receipts for home expenses (electricity, internet, phone)')
  }

  if (category === 'Vehicle Expenses') {
    docs.push('Logbook (12 continuous weeks) showing business vs private use')
    docs.push('Odometer readings at start and end of financial year')
    docs.push('Fuel receipts and maintenance invoices')
  }

  if (category === 'Travel Expenses') {
    docs.push('Travel itinerary showing business purpose')
    docs.push('Receipts for accommodation, flights, meals')
  }

  if (category === 'Training & Education') {
    docs.push('Course details showing relevance to current employment/business')
    docs.push('Receipt for course fees')
  }

  docs.push('Evidence of business purpose (emails, contracts, project documents)')

  if (amount > 5000) {
    docs.push('⚠️ High-value deduction - maintain detailed records to substantiate claim')
  }

  return docs
}

/**
 * Check if category has FBT implications
 */
function checkFbtImplications(category: DeductionCategory): boolean {
  const fbtCategories: DeductionCategory[] = [
    'Vehicle Expenses',
    'Travel Expenses',
    'Training & Education',
    'Home Office', // Can have FBT if provided by employer
    'Entertainment & Meals', // Subject to FBT or 50% deductibility rule (FBTAA 1986)
  ]
  return fbtCategories.includes(category)
}

/**
 * Calculate overall deduction summary
 */
/**
 * Calculate overall deduction summary
 */
function calculateDeductionSummary(
  opportunities: DeductionOpportunity[],
  taxRateSource: string = 'none'
): DeductionSummary {
  let totalUnclaimedDeductions = 0
  let totalEstimatedTaxSaving = 0
  let totalConfidence = 0

  const opportunitiesByYear: Record<string, number> = {}
  const unclaimedByYear: Record<string, number> = {}
  const opportunitiesByCategory: Record<DeductionCategory, number> = {} as Record<DeductionCategory, number>

  opportunities.forEach((opp) => {
    totalUnclaimedDeductions += opp.unclaimedAmount
    totalEstimatedTaxSaving += opp.estimatedTaxSaving
    totalConfidence += opp.confidence

    opportunitiesByYear[opp.financialYear] = (opportunitiesByYear[opp.financialYear] || 0) + opp.unclaimedAmount
    unclaimedByYear[opp.financialYear] = (unclaimedByYear[opp.financialYear] || 0) + opp.unclaimedAmount
    opportunitiesByCategory[opp.category] = (opportunitiesByCategory[opp.category] || 0) + opp.unclaimedAmount
  })

  const averageConfidence = opportunities.length > 0 ? Math.round(totalConfidence / opportunities.length) : 0

  const highValueOpportunities = opportunities.filter((opp) => opp.unclaimedAmount > 10000)

  return {
    totalOpportunities: opportunities.length,
    totalUnclaimedDeductions,
    totalEstimatedTaxSaving,
    opportunitiesByYear,
    unclaimedByYear,
    opportunitiesByCategory,
    averageConfidence,
    highValueOpportunities,
    opportunities,
    taxRateSource,
    taxRateVerifiedAt: new Date().toISOString(),
  }
}

/**
 * Identify instant asset write-off opportunities (s 328-180 ITAA 1997).
 *
 * Assets must be:
 * - Under the current threshold (default $20,000)
 * - Owned by a small business entity (turnover < $10M)
 * - First used or installed ready for use in the relevant income year
 */
export async function identifyInstantWriteOffs(
  tenantId: string,
  options?: DeductionAnalysisOptions
): Promise<DeductionOpportunity[]> {
  const summary = await analyzeDeductionOpportunities(tenantId, undefined, undefined, options)
  const { instantWriteOffThreshold } = await getDeductionThresholds()
  const smallBusiness = isSmallBusinessEntity(options)

  return summary.opportunities.filter((opp) => {
    return (
      (opp.category === 'Capital Allowance (Division 40)' || opp.category === 'Instant Asset Write-Off') &&
      opp.transactions.some((tx) => tx.amount < instantWriteOffThreshold && smallBusiness)
    )
  })
}

/**
 * Calculate home office deductions using current ATO rate
 */
export async function calculateHomeOfficeDeductions(
  tenantId: string,
  hoursWorkedFromHome: number
): Promise<number> {
  const { homeOfficeRatePerHour } = await getDeductionThresholds()

  // Per hour method (current ATO rate, e.g., 67c)
  const perHourDeduction = hoursWorkedFromHome * homeOfficeRatePerHour

  // Could also calculate actual cost method if utility/internet expenses available
  // For now, return the per hour method
  return perHourDeduction
}

/**
 * Create empty summary when no data available
 */
function createEmptySummary(): DeductionSummary {
  return {
    totalOpportunities: 0,
    totalUnclaimedDeductions: 0,
    totalEstimatedTaxSaving: 0,
    opportunitiesByYear: {},
    unclaimedByYear: {},
    opportunitiesByCategory: {} as Record<DeductionCategory, number>,
    averageConfidence: 0,
    highValueOpportunities: [],
    opportunities: [],
    taxRateSource: 'none',
    taxRateVerifiedAt: new Date().toISOString(),
  }
}
