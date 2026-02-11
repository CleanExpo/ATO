/**
 * Fringe Benefits Tax Engine (FBTAA 1986)
 *
 * Analyses employee benefits to calculate FBT liability.
 *
 * IMPORTANT: FBT year runs 1 April - 31 March, NOT the standard
 * Australian income tax FY (1 July - 30 June).
 *
 * Key Legislation:
 * - FBTAA 1986 (Fringe Benefits Tax Assessment Act)
 * - s 5B-5E: Definitions of benefit types
 * - s 136: FBT rate (47% for FY2024-25)
 * - s 57A: Exempt benefits
 * - s 58X: Minor benefits exemption ($300 per benefit)
 * - s 24: Otherwise deductible rule (reduces taxable value)
 *
 * Benefit Categories:
 * - Division 2: Car fringe benefits
 * - Division 3: Debt waiver fringe benefits / Property
 * - Division 4: Loan fringe benefits
 * - Division 5: Expense payment fringe benefits
 * - Division 6: Housing fringe benefits
 * - Division 7: Living-away-from-home allowance benefits
 * - Division 9A: Meal entertainment fringe benefits
 * - Division 12: Residual fringe benefits
 *
 * Gross-Up Rates (FY2024-25):
 * - Type 1 (GST-creditable): 2.0802
 * - Type 2 (non-GST-creditable): 1.8868
 */

import { createServiceClient } from '@/lib/supabase/server'
import type { ForensicAnalysisRow } from '@/lib/types/forensic-analysis'

/** Extended forensic row with optional FBT-specific fields */
interface FBTForensicRow extends ForensicAnalysisRow {
  tax_type?: string
  gst_amount?: number | null
}
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'
import { getCurrentFBTYear, getFBTYearStartDate, getFBTYearEndDate } from '@/lib/utils/financial-year'
import Decimal from 'decimal.js'

// FBT rates (FBTAA 1986, s 136)
const FALLBACK_FBT_RATE = 0.47 // 47% FBT rate
const FALLBACK_GROSS_UP_RATE_1 = 2.0802 // Type 1 (GST-creditable)
const FALLBACK_GROSS_UP_RATE_2 = 1.8868 // Type 2 (non-GST-creditable)

// Exemption thresholds
const MINOR_BENEFIT_THRESHOLD = 300 // s 58X - $300 per benefit
const _CAR_PARKING_THRESHOLD = 9.72 // s 58GA - per-day threshold FY2024-25

// FBT benefit categories
export type FBTCategory =
  | 'car_fringe_benefit'        // Division 2 FBTAA
  | 'loan_fringe_benefit'       // Division 4
  | 'expense_payment'           // Division 5
  | 'housing_benefit'           // Division 6
  | 'living_away_from_home'     // Division 7
  | 'meal_entertainment'        // Division 9A
  | 'property_fringe_benefit'   // Division 3
  | 'residual_fringe_benefit'   // Division 12
  | 'exempt_benefit'            // s 57A, s 58X
  | 'otherwise_deductible'      // s 24

/** Car fringe benefit valuation detail (s 9 / s 10 FBTAA 1986) */
export interface CarBenefitDetail {
  /** GST-inclusive cost price of the vehicle */
  baseValue: number
  /** Number of days in FBT year car was available for private use */
  daysAvailable: number
  /** Employee after-tax contribution toward running costs */
  employeeContribution: number
  /** Total operating costs: fuel, insurance, rego, maintenance, lease, depreciation */
  totalOperatingCosts: number
  /** Private km / total km (0-1). If no log book, deemed 1.0 (100%) */
  privateUsePercentage: number
  /** Whether a valid 12-week log book exists (s 10A FBTAA 1986) */
  logBookAvailable: boolean

  // Calculated results
  /** Taxable value under statutory formula method (s 9 FBTAA) */
  statutoryValue: number
  /** Taxable value under operating cost method (s 10 FBTAA) */
  operatingCostValue: number
  /** Which method produces the lower taxable value */
  recommendedMethod: 'statutory_formula' | 'operating_cost'
  /** Dollar savings from using optimal method vs the other */
  savings: number
}

/** Otherwise deductible rule result (s 24 FBTAA 1986) */
export interface OtherwiseDeductibleResult {
  /** The portion of the benefit that would be deductible under s 8-1 ITAA 1997 */
  reduction: number
  /** Taxable value after applying the ODR reduction */
  adjustedTaxableValue: number
  /** Description of the rule applied */
  rule: string
  /** The otherwise deductible percentage (0-1) */
  otherwiseDeductiblePercentage: number
}

export interface FBTItem {
  transactionId: string
  transactionDate: string
  description: string
  amount: number
  supplier: string | null
  category: FBTCategory
  benefitType: 'type_1' | 'type_2' // Type 1 = GST-creditable, Type 2 = not
  taxableValue: number
  grossedUpValue: number
  gstCredits: number
  exemptionApplied: string | null
  employeeContribution: number
  fbtLiability: number
  confidence: number
  legislativeReference: string

  /** Car fringe benefit valuation detail (populated for car_fringe_benefit items with sufficient data) */
  carBenefitDetail: CarBenefitDetail | null
  /** Otherwise deductible rule result (s 24 FBTAA 1986) — populated when ODR applies */
  otherwiseDeductibleResult: OtherwiseDeductibleResult | null
}

export interface FBTSummary {
  fbtYear: string // 'FBT2024-25' (1 Apr 2024 - 31 Mar 2025)
  totalFBTLiability: number
  totalTaxableValue: number
  type1AggregateAmount: number // Grossed-up (GST-creditable)
  type2AggregateAmount: number // Grossed-up (no GST credit)
  fbtRate: number
  grossUpRate1: number
  grossUpRate2: number
  itemCount: number
  exemptBenefitsCount: number
  exemptBenefitsValue: number
  byCategory: Record<string, {
    count: number
    taxableValue: number
    grossedUpValue: number
    fbtLiability: number
  }>
  items: FBTItem[]
  lodgmentDeadline: string // 21 May after FBT year end
  lodgmentStatus: 'upcoming' | 'due_soon' | 'overdue'

  // Car benefit valuation (Change 1: FBT P1-3)
  carBenefitCount: number
  carBenefitTotalSavings: number // Total savings from using optimal valuation method

  // Otherwise deductible rule (Change 2: s 24 FBTAA)
  odrAppliedCount: number
  odrTotalReduction: number // Total taxable value reduction from ODR

  // Provenance
  taxRateSource: string
  taxRateVerifiedAt: string
  legislativeReferences: string[]
  recommendations: string[]
  professionalReviewRequired: boolean
}

// Keywords for FBT category classification
const FBT_CAR_KEYWORDS = ['car', 'vehicle', 'motor', 'fuel', 'petrol', 'diesel', 'parking', 'toll', 'rego']
const FBT_ENTERTAINMENT_KEYWORDS = ['entertainment', 'meal', 'dining', 'restaurant', 'catering', 'drinks', 'lunch', 'dinner']
const FBT_HOUSING_KEYWORDS = ['housing', 'accommodation', 'rent', 'rental property', 'employee housing']
const FBT_LOAN_KEYWORDS = ['loan', 'employee loan', 'staff loan', 'advance']
const FBT_EXPENSE_KEYWORDS = ['reimbursement', 'expense claim', 'staff expense', 'employee expense']
const FBT_EDUCATION_KEYWORDS = ['training', 'education', 'course', 'conference', 'seminar']

// Otherwise deductible rule category mappings (s 24 FBTAA 1986)
// Maps description keywords to the proportion that would be deductible under s 8-1 ITAA 1997
const ODR_WORK_TRAVEL_KEYWORDS = ['business travel', 'work travel', 'client visit', 'site visit', 'work trip', 'business trip']
const ODR_PHONE_KEYWORDS = ['mobile phone', 'phone plan', 'mobile plan', 'telecommunications']
const ODR_TOOL_KEYWORDS = ['laptop', 'computer', 'tablet', 'tools', 'equipment', 'software licence', 'software license']
const ODR_PROFESSIONAL_KEYWORDS = ['professional development', 'training course', 'conference', 'seminar', 'workshop', 'cpd']

/**
 * Statutory fraction for car fringe benefits.
 * Flat 20% since FY2014-15 for all km ranges (s 9(2) FBTAA 1986).
 * Prior to FY2014-15, the rate varied by total km (0.26, 0.20, 0.11, 0.07).
 */
const STATUTORY_FRACTION = new Decimal('0.20')

/** Days in a standard FBT year (non-leap) */
const DAYS_IN_FBT_YEAR = 365

/**
 * Calculate car fringe benefit under both valuation methods (FBT P1-3).
 *
 * Statutory Formula Method (s 9 FBTAA 1986):
 *   Taxable value = (Base value x Statutory fraction x Days available / 365)
 *                   - Employee contribution
 *
 * Operating Cost Method (s 10 FBTAA 1986):
 *   Taxable value = (Total operating costs x Private use %)
 *                   - Employee contribution
 *   Requires 12-week log book per s 10A FBTAA 1986.
 *   If no log book: deemed 100% private use.
 *
 * @param baseValue - GST-inclusive cost price of the vehicle
 * @param daysAvailable - Days in FBT year car was available for private use
 * @param employeeContribution - After-tax employee contribution
 * @param totalOperatingCosts - Fuel, insurance, rego, maintenance, lease, depreciation
 * @param privateUsePercentage - Private km / total km (0-1); defaults to 1.0 if no log book
 * @param logBookAvailable - Whether a valid 12-week log book exists
 * @returns CarBenefitDetail with both valuations and recommended method
 */
export function calculateCarBenefit(
  baseValue: number,
  daysAvailable: number,
  employeeContribution: number,
  totalOperatingCosts: number,
  privateUsePercentage: number,
  logBookAvailable: boolean
): CarBenefitDetail {
  const decBaseValue = new Decimal(baseValue)
  const decDaysAvailable = new Decimal(Math.min(Math.max(daysAvailable, 0), DAYS_IN_FBT_YEAR))
  const decEmployeeContribution = new Decimal(employeeContribution)

  // Statutory Formula Method (s 9 FBTAA 1986)
  // Taxable value = (Base value x 0.20 x Days available / 365) - Employee contribution
  const statutoryGross = decBaseValue
    .times(STATUTORY_FRACTION)
    .times(decDaysAvailable)
    .dividedBy(DAYS_IN_FBT_YEAR)
  const statutoryValue = Decimal.max(
    statutoryGross.minus(decEmployeeContribution),
    new Decimal(0)
  )
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber()

  // Operating Cost Method (s 10 FBTAA 1986)
  // If no log book, private use is deemed 100% (s 10A FBTAA 1986)
  const effectivePrivateUse = logBookAvailable
    ? new Decimal(Math.min(Math.max(privateUsePercentage, 0), 1))
    : new Decimal(1)
  const decTotalOperatingCosts = new Decimal(totalOperatingCosts)
  const operatingCostGross = decTotalOperatingCosts.times(effectivePrivateUse)
  const operatingCostValue = Decimal.max(
    operatingCostGross.minus(decEmployeeContribution),
    new Decimal(0)
  )
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber()

  // Recommend the method producing the lower taxable value
  const recommendedMethod: 'statutory_formula' | 'operating_cost' =
    statutoryValue <= operatingCostValue ? 'statutory_formula' : 'operating_cost'
  const savings = new Decimal(Math.abs(statutoryValue - operatingCostValue))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber()

  return {
    baseValue,
    daysAvailable: decDaysAvailable.toNumber(),
    employeeContribution,
    totalOperatingCosts,
    privateUsePercentage: effectivePrivateUse.toNumber(),
    logBookAvailable,
    statutoryValue,
    operatingCostValue,
    recommendedMethod,
    savings,
  }
}

/**
 * Apply the Otherwise Deductible Rule (s 24 FBTAA 1986).
 *
 * Reduces the taxable value of a fringe benefit by the amount that would
 * have been an allowable income tax deduction to the employee under s 8-1
 * ITAA 1997 if the employee had incurred the expense themselves.
 *
 * Common cases:
 * - Work-related travel: typically 100% otherwise deductible -> taxable value $0
 * - Mobile phone with personal use: pro-rata based on work-use percentage
 * - Laptop/tools for work: typically 100% otherwise deductible
 * - Professional development/training: typically 100% otherwise deductible
 *
 * The ODR is applied BEFORE gross-up, reducing the base taxable value.
 *
 * @param taxableValue - The gross taxable value before ODR
 * @param description - Transaction description for category matching
 * @param category - FBT category of the item
 * @returns OtherwiseDeductibleResult or null if ODR does not apply
 */
export function applyOtherwiseDeductibleRule(
  taxableValue: number,
  description: string,
  category: FBTCategory
): OtherwiseDeductibleResult | null {
  const desc = description.toLowerCase()
  const decTaxableValue = new Decimal(taxableValue)

  // Determine otherwise deductible percentage based on benefit type
  let odrPercentage: Decimal | null = null
  let rule = ''

  // 1. Work-related travel: 100% otherwise deductible (s 8-1 ITAA 1997 — travel in course of employment)
  if (ODR_WORK_TRAVEL_KEYWORDS.some(kw => desc.includes(kw))) {
    odrPercentage = new Decimal(1)
    rule = 's 24 FBTAA 1986 — work-related travel: 100% otherwise deductible under s 8-1 ITAA 1997'
  }

  // 2. Professional development/training: 100% otherwise deductible (s 8-1 — maintaining/improving work skills)
  if (odrPercentage === null && ODR_PROFESSIONAL_KEYWORDS.some(kw => desc.includes(kw))) {
    odrPercentage = new Decimal(1)
    rule = 's 24 FBTAA 1986 — professional development: 100% otherwise deductible under s 8-1 ITAA 1997'
  }

  // 3. Laptop/tools/equipment: 100% otherwise deductible (s 8-1 — tools of trade for employment)
  if (odrPercentage === null && ODR_TOOL_KEYWORDS.some(kw => desc.includes(kw))) {
    odrPercentage = new Decimal(1)
    rule = 's 24 FBTAA 1986 — work tools/equipment: 100% otherwise deductible under s 8-1 ITAA 1997'
  }

  // 4. Mobile phone/telecommunications: pro-rata based on assumed 75% work use
  //    (conservative estimate; actual % would require employee declaration)
  if (odrPercentage === null && ODR_PHONE_KEYWORDS.some(kw => desc.includes(kw))) {
    odrPercentage = new Decimal('0.75')
    rule = 's 24 FBTAA 1986 — mobile phone: 75% otherwise deductible (estimated work-use proportion under s 8-1 ITAA 1997)'
  }

  // 5. Education/training categories classified as 'otherwise_deductible': 100%
  if (odrPercentage === null && category === 'otherwise_deductible') {
    odrPercentage = new Decimal(1)
    rule = 's 24 FBTAA 1986 — education/training: 100% otherwise deductible under s 8-1 ITAA 1997'
  }

  // 6. Expense payments that are clearly work-related (reimbursement for work expenses)
  if (odrPercentage === null && category === 'expense_payment') {
    const WORK_EXPENSE_KEYWORDS = ['work expense', 'business expense', 'work-related', 'business purpose']
    if (WORK_EXPENSE_KEYWORDS.some(kw => desc.includes(kw))) {
      odrPercentage = new Decimal(1)
      rule = 's 24 FBTAA 1986 — work-related expense payment: 100% otherwise deductible under s 8-1 ITAA 1997'
    }
  }

  if (odrPercentage === null) {
    return null
  }

  // Calculate the reduction
  const reduction = decTaxableValue
    .times(odrPercentage)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  const adjustedTaxableValue = Decimal.max(
    decTaxableValue.minus(reduction),
    new Decimal(0)
  )
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber()

  return {
    reduction: reduction.toNumber(),
    adjustedTaxableValue,
    rule,
    otherwiseDeductiblePercentage: odrPercentage.toNumber(),
  }
}

/**
 * Analyse FBT liability for a tenant
 */
export async function analyzeFBT(
  tenantId: string,
  fbtYear?: string
): Promise<FBTSummary> {
  const supabase = await createServiceClient()
  const targetFBTYear = fbtYear || getCurrentFBTYear()

  // Determine FBT year date range
  const fbtStart = getFBTYearStartDate(targetFBTYear)
  const fbtEnd = getFBTYearEndDate(targetFBTYear)

  if (!fbtStart || !fbtEnd) {
    return createEmptyFBTSummary(targetFBTYear)
  }

  // Fetch transactions within FBT year date range
  // Note: FBT year is Apr-Mar, so we query by actual date, not financial_year
  const { data: transactions, error } = await supabase
    .from('forensic_analysis_results')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('transaction_date', fbtStart.toISOString().split('T')[0])
    .lte('transaction_date', fbtEnd.toISOString().split('T')[0])
    .eq('fbt_implications', true)
    .order('transaction_date', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch FBT transactions: ${error.message}`)
  }

  if (!transactions || transactions.length === 0) {
    return createEmptyFBTSummary(targetFBTYear)
  }

  // Get FBT rates
  let fbtRate = FALLBACK_FBT_RATE
  let grossUpRate1 = FALLBACK_GROSS_UP_RATE_1
  let grossUpRate2 = FALLBACK_GROSS_UP_RATE_2
  let rateSource = 'ATO_FALLBACK_DEFAULT'

  try {
    const rates = await getCurrentTaxRates()
    if (rates.fbtRate) fbtRate = rates.fbtRate
    if (rates.fbtType1GrossUpRate) grossUpRate1 = rates.fbtType1GrossUpRate
    if (rates.fbtType2GrossUpRate) grossUpRate2 = rates.fbtType2GrossUpRate
    if (rates.sources.fbt) rateSource = rates.sources.fbt
    else if (rates.sources.corporateTax) rateSource = rates.sources.corporateTax
  } catch (err) {
    console.warn('Failed to fetch live FBT rates, using fallback defaults', err)
  }

  // Classify and calculate FBT for each transaction
  const items: FBTItem[] = transactions.map((tx: FBTForensicRow) => {
    return classifyAndCalculateFBT(tx, fbtRate, grossUpRate1, grossUpRate2)
  })

  // Separate exempt benefits
  const taxableItems = items.filter(i => i.category !== 'exempt_benefit')
  const exemptItems = items.filter(i => i.category === 'exempt_benefit')

  // Calculate aggregates
  const type1Items = taxableItems.filter(i => i.benefitType === 'type_1')
  const type2Items = taxableItems.filter(i => i.benefitType === 'type_2')

  const type1Aggregate = type1Items.reduce((sum, i) => sum + i.grossedUpValue, 0)
  const type2Aggregate = type2Items.reduce((sum, i) => sum + i.grossedUpValue, 0)
  const totalTaxableValue = taxableItems.reduce((sum, i) => sum + i.taxableValue, 0)
  const totalFBTLiability = new Decimal(type1Aggregate + type2Aggregate)
    .times(fbtRate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber()

  // Group by category
  const byCategory: Record<string, { count: number; taxableValue: number; grossedUpValue: number; fbtLiability: number }> = {}
  taxableItems.forEach(item => {
    if (!byCategory[item.category]) {
      byCategory[item.category] = { count: 0, taxableValue: 0, grossedUpValue: 0, fbtLiability: 0 }
    }
    byCategory[item.category].count++
    byCategory[item.category].taxableValue += item.taxableValue
    byCategory[item.category].grossedUpValue += item.grossedUpValue
    byCategory[item.category].fbtLiability += item.fbtLiability
  })

  // Lodgment deadline: 21 May after FBT year ends
  const fbtEndYear = fbtEnd.getFullYear()
  const lodgmentDeadline = new Date(fbtEndYear, 4, 21) // May 21
  const now = new Date()
  const daysUntilDeadline = Math.ceil((lodgmentDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  let lodgmentStatus: 'upcoming' | 'due_soon' | 'overdue' = 'upcoming'
  if (daysUntilDeadline < 0) lodgmentStatus = 'overdue'
  else if (daysUntilDeadline < 30) lodgmentStatus = 'due_soon'

  // Aggregate car benefit and ODR statistics
  const carBenefitItems = items.filter(i => i.carBenefitDetail !== null)
  const carBenefitTotalSavings = carBenefitItems.reduce(
    (sum, i) => sum + (i.carBenefitDetail?.savings ?? 0), 0
  )
  const odrAppliedItems = items.filter(i => i.otherwiseDeductibleResult !== null)
  const odrTotalReduction = odrAppliedItems.reduce(
    (sum, i) => sum + (i.otherwiseDeductibleResult?.reduction ?? 0), 0
  )

  const recommendations = generateFBTRecommendations(
    totalFBTLiability, taxableItems, exemptItems, lodgmentStatus, byCategory,
    carBenefitItems, carBenefitTotalSavings, odrAppliedItems, odrTotalReduction
  )

  return {
    fbtYear: targetFBTYear,
    totalFBTLiability,
    totalTaxableValue,
    type1AggregateAmount: type1Aggregate,
    type2AggregateAmount: type2Aggregate,
    fbtRate,
    grossUpRate1,
    grossUpRate2,
    itemCount: taxableItems.length,
    exemptBenefitsCount: exemptItems.length,
    exemptBenefitsValue: exemptItems.reduce((sum, i) => sum + i.amount, 0),
    byCategory,
    items,
    lodgmentDeadline: lodgmentDeadline.toISOString().split('T')[0],
    lodgmentStatus,
    carBenefitCount: carBenefitItems.length,
    carBenefitTotalSavings,
    odrAppliedCount: odrAppliedItems.length,
    odrTotalReduction,
    taxRateSource: rateSource,
    taxRateVerifiedAt: new Date().toISOString(),
    legislativeReferences: [
      'FBTAA 1986 (Fringe Benefits Tax Assessment Act)',
      's 136 FBTAA 1986 (FBT rate)',
      's 57A FBTAA 1986 (Exempt benefits)',
      's 58X FBTAA 1986 (Minor benefits exemption - $300)',
      's 9 FBTAA 1986 (Car fringe benefit - statutory formula method)',
      's 10 FBTAA 1986 (Car fringe benefit - operating cost method)',
      's 10A FBTAA 1986 (Log book method substantiation)',
      's 24 FBTAA 1986 (Otherwise deductible rule)',
      's 8-1 ITAA 1997 (General deductions - otherwise deductible test)',
    ],
    recommendations,
    professionalReviewRequired: totalFBTLiability > 10000,
  }
}

/**
 * Classify transaction and calculate FBT liability.
 *
 * Flow:
 * 1. Classify the benefit category
 * 2. Determine Type 1 / Type 2 (GST credit entitlement)
 * 3. Check exemptions (s 57A / s 58X)
 * 4. Calculate gross taxable value
 * 5. If car benefit with sufficient data: run car benefit valuation (s 9 / s 10)
 * 6. Apply Otherwise Deductible Rule (s 24) BEFORE gross-up
 * 7. Gross up the (possibly reduced) taxable value
 * 8. Calculate FBT liability
 */
function classifyAndCalculateFBT(
  tx: FBTForensicRow,
  fbtRate: number,
  grossUpRate1: number,
  grossUpRate2: number
): FBTItem {
  const amount = Math.abs(parseFloat(String(tx.transaction_amount)) || 0)
  const description = (tx.transaction_description || '').toLowerCase()
  const category = classifyFBTCategory(description, tx.primary_category)

  // Determine benefit type (Type 1 = GST-creditable, Type 2 = not)
  // Type 1: employer is entitled to a GST input tax credit on the benefit
  // Type 2: no GST credit available (GST-free, input-taxed, or no ABN supplier)
  const benefitType = determineBenefitType(category, description, tx)

  // Check for exemptions
  const exemption = checkFBTExemptions(category, amount, description)

  // Step 4: Calculate gross taxable value
  let taxableValue = amount
  if (exemption) {
    taxableValue = 0 // Exempt
  }

  // Step 5: Car fringe benefit valuation (s 9 / s 10 FBTAA 1986)
  // If car-related and we have base value data from the transaction, calculate both methods.
  // In practice, base value data would come from asset registers or supplementary input.
  // We attempt to use available transaction metadata if present.
  let carBenefitDetail: CarBenefitDetail | null = null
  if (category === 'car_fringe_benefit' && !exemption) {
    // Check if extended data is available on the transaction row (e.g., from fbt_items table)
    const txAny = tx as unknown as Record<string, unknown>
    const baseValue = typeof txAny['base_value'] === 'number' ? txAny['base_value'] as number : null
    const daysAvailable = typeof txAny['days_available'] === 'number' ? txAny['days_available'] as number : DAYS_IN_FBT_YEAR
    const empContribution = typeof txAny['employee_contribution'] === 'number' ? txAny['employee_contribution'] as number : 0
    const totalOpCosts = typeof txAny['total_operating_costs'] === 'number' ? txAny['total_operating_costs'] as number : null
    const privateUsePct = typeof txAny['private_use_percentage'] === 'number' ? txAny['private_use_percentage'] as number : 1.0
    const logBook = typeof txAny['log_book_available'] === 'boolean' ? txAny['log_book_available'] as boolean : false

    if (baseValue !== null && baseValue > 0) {
      // We have enough data for at least statutory formula.
      // For operating cost method, use totalOperatingCosts if available, otherwise fall back to transaction amount.
      const effectiveOpCosts = totalOpCosts !== null && totalOpCosts > 0
        ? totalOpCosts
        : amount // Fallback: use the transaction amount as a proxy for operating costs

      carBenefitDetail = calculateCarBenefit(
        baseValue,
        daysAvailable,
        empContribution,
        effectiveOpCosts,
        privateUsePct,
        logBook
      )

      // Use the recommended (lower) method's taxable value
      taxableValue = carBenefitDetail.recommendedMethod === 'statutory_formula'
        ? carBenefitDetail.statutoryValue
        : carBenefitDetail.operatingCostValue
    }
    // If no base value data available, taxableValue remains as the raw transaction amount.
    // A recommendation will be generated to collect car benefit data.
  }

  // Step 6: Apply Otherwise Deductible Rule (s 24 FBTAA 1986) BEFORE gross-up
  // This reduces the taxable value by the portion deductible under s 8-1 ITAA 1997
  let otherwiseDeductibleResult: OtherwiseDeductibleResult | null = null
  if (taxableValue > 0 && !exemption) {
    otherwiseDeductibleResult = applyOtherwiseDeductibleRule(
      taxableValue,
      tx.transaction_description || '',
      category
    )
    if (otherwiseDeductibleResult) {
      taxableValue = otherwiseDeductibleResult.adjustedTaxableValue
    }
  }

  // Step 7: Gross up the (possibly reduced) taxable value
  const grossUpRate = benefitType === 'type_1' ? grossUpRate1 : grossUpRate2
  const grossedUpValue = new Decimal(taxableValue)
    .times(grossUpRate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber()

  // GST credits (Type 1 only)
  const gstCredits = benefitType === 'type_1'
    ? new Decimal(taxableValue).dividedBy(11).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
    : 0

  // Step 8: FBT liability
  const fbtLiability = new Decimal(grossedUpValue)
    .times(fbtRate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber()

  return {
    transactionId: tx.transaction_id,
    transactionDate: tx.transaction_date || '',
    description: tx.transaction_description || '',
    amount,
    supplier: tx.supplier_name,
    category: exemption ? 'exempt_benefit' : category,
    benefitType,
    taxableValue,
    grossedUpValue,
    gstCredits,
    exemptionApplied: exemption,
    employeeContribution: carBenefitDetail?.employeeContribution ?? 0,
    fbtLiability,
    confidence: tx.category_confidence || 50,
    legislativeReference: getLegislativeRef(category),
    carBenefitDetail,
    otherwiseDeductibleResult,
  }
}

/**
 * Classify FBT category from description
 */
function classifyFBTCategory(description: string, primaryCategory: string | null): FBTCategory {
  const desc = description.toLowerCase()
  const cat = (primaryCategory || '').toLowerCase()

  if (FBT_CAR_KEYWORDS.some(kw => desc.includes(kw) || cat.includes(kw))) return 'car_fringe_benefit'
  if (FBT_ENTERTAINMENT_KEYWORDS.some(kw => desc.includes(kw) || cat.includes(kw))) return 'meal_entertainment'
  if (FBT_HOUSING_KEYWORDS.some(kw => desc.includes(kw) || cat.includes(kw))) return 'housing_benefit'
  if (FBT_LOAN_KEYWORDS.some(kw => desc.includes(kw) || cat.includes(kw))) return 'loan_fringe_benefit'
  if (FBT_EXPENSE_KEYWORDS.some(kw => desc.includes(kw) || cat.includes(kw))) return 'expense_payment'
  if (FBT_EDUCATION_KEYWORDS.some(kw => desc.includes(kw) || cat.includes(kw))) return 'otherwise_deductible'

  return 'residual_fringe_benefit'
}

/**
 * Determine Type 1 vs Type 2 benefit based on GST input tax credit entitlement
 *
 * Type 1 (GST-creditable): Employer is entitled to GST input tax credit on the benefit.
 *   Applies when the supply is taxable (GST-inclusive) and the employer can claim the credit.
 *
 * Type 2 (no GST credit): No GST credit available. Applies when:
 *   - Supply is GST-free (e.g. basic food, medical, education, childcare)
 *   - Supply is input-taxed (e.g. residential rent, financial supplies)
 *   - Supplier is not registered for GST (no ABN or under $75K threshold)
 *   - Benefit is meal entertainment (Division 9A -- typically no GST credit)
 *   - Benefit is a living-away-from-home allowance
 *
 * Per-item analysis based on available transaction data. Falls back to Type 1
 * (conservative -- higher gross-up) when GST status cannot be determined.
 */
function determineBenefitType(
  category: FBTCategory,
  description: string,
  tx: FBTForensicRow
): 'type_1' | 'type_2' {
  const desc = description.toLowerCase()

  // Division 9A meal entertainment -- typically Type 2 (no GST credit on entertainment)
  if (category === 'meal_entertainment') return 'type_2'

  // Living-away-from-home allowances -- Type 2 (no GST on allowances)
  if (category === 'living_away_from_home') return 'type_2'

  // GST-free supplies are Type 2 (no input tax credit available)
  // Health/medical services (GST-free under Division 38 GST Act)
  const GST_FREE_KEYWORDS = [
    'medical', 'health', 'dental', 'hospital', 'doctor', 'physiotherapy',
    'childcare', 'child care', 'daycare', 'day care',
    'education', 'school fees', 'university', 'tuition',
    'fresh food', 'basic food',
  ]
  if (GST_FREE_KEYWORDS.some(kw => desc.includes(kw))) return 'type_2'

  // Input-taxed supplies are Type 2 (no input tax credit available)
  // Residential accommodation, financial supplies
  const INPUT_TAXED_KEYWORDS = [
    'residential rent', 'residential accommodation',
    'interest on loan', 'bank charges', 'financial',
  ]
  if (INPUT_TAXED_KEYWORDS.some(kw => desc.includes(kw))) return 'type_2'

  // Housing benefits -- residential accommodation is input-taxed (Type 2)
  if (category === 'housing_benefit') return 'type_2'

  // Loan fringe benefits -- no GST on loans (Type 2)
  if (category === 'loan_fringe_benefit') return 'type_2'

  // Check transaction-level GST data if available from Xero
  if (tx.tax_type) {
    const taxType = String(tx.tax_type).toUpperCase()
    // Xero tax types: GST-free = 'EXEMPTOUTPUT' or 'BASEXCLUDED', Input-taxed = 'INPUTTAXED'
    if (taxType.includes('EXEMPT') || taxType.includes('BASEXCLUDED') || taxType.includes('INPUTTAXED')) {
      return 'type_2'
    }
    // Standard GST (10%) = 'OUTPUT' or 'OUTPUT2'
    if (taxType.includes('OUTPUT') || taxType.includes('GST')) {
      return 'type_1'
    }
  }

  // If GST amount data is available, use it
  if (tx.gst_amount !== undefined && tx.gst_amount !== null) {
    const gstAmount = parseFloat(String(tx.gst_amount)) || 0
    // Zero GST amount on a taxable transaction indicates GST-free or input-taxed
    if (gstAmount === 0) return 'type_2'
    if (gstAmount > 0) return 'type_1'
  }

  // Default to Type 1 (conservative -- higher gross-up rate produces higher FBT liability)
  // This ensures we do not understate FBT liability when GST status is unknown
  return 'type_1'
}

/**
 * Check FBT exemptions
 */
function checkFBTExemptions(category: FBTCategory, amount: number, description: string): string | null {
  // Minor benefit exemption (s 58X): < $300 per benefit
  if (amount < MINOR_BENEFIT_THRESHOLD) {
    return `Minor benefit exemption (s 58X FBTAA 1986) - amount $${amount.toFixed(2)} < $${MINOR_BENEFIT_THRESHOLD} threshold`
  }

  // Work-related items exemption (s 58X)
  if (description.includes('laptop') || description.includes('computer') || description.includes('phone')) {
    if (category === 'expense_payment' || category === 'property_fringe_benefit') {
      return 'Work-related item exemption (s 58X FBTAA 1986) - portable electronic device primarily for work use'
    }
  }

  return null
}

/**
 * Get legislative reference for FBT category
 */
function getLegislativeRef(category: FBTCategory): string {
  switch (category) {
    case 'car_fringe_benefit': return 'Division 2 FBTAA 1986 (Car fringe benefits)'
    case 'loan_fringe_benefit': return 'Division 4 FBTAA 1986 (Loan fringe benefits)'
    case 'expense_payment': return 'Division 5 FBTAA 1986 (Expense payment fringe benefits)'
    case 'housing_benefit': return 'Division 6 FBTAA 1986 (Housing fringe benefits)'
    case 'living_away_from_home': return 'Division 7 FBTAA 1986 (LAFHA benefits)'
    case 'meal_entertainment': return 'Division 9A FBTAA 1986 (Meal entertainment fringe benefits)'
    case 'property_fringe_benefit': return 'Division 3 FBTAA 1986 (Property fringe benefits)'
    case 'residual_fringe_benefit': return 'Division 12 FBTAA 1986 (Residual fringe benefits)'
    case 'exempt_benefit': return 's 57A / s 58X FBTAA 1986 (Exempt benefits)'
    case 'otherwise_deductible': return 's 24 FBTAA 1986 (Otherwise deductible rule)'
    default: return 'FBTAA 1986'
  }
}

/**
 * Generate FBT recommendations
 */
function generateFBTRecommendations(
  totalLiability: number,
  taxableItems: FBTItem[],
  exemptItems: FBTItem[],
  lodgmentStatus: string,
  byCategory: Record<string, { count: number; taxableValue: number; grossedUpValue: number; fbtLiability: number }>,
  carBenefitItems: FBTItem[],
  carBenefitTotalSavings: number,
  odrAppliedItems: FBTItem[],
  odrTotalReduction: number
): string[] {
  const recs: string[] = []

  if (totalLiability === 0 && taxableItems.length === 0) {
    recs.push('No FBT liability identified. Verify all employee benefits have been accounted for.')
    return recs
  }

  recs.push(`Total FBT liability: $${totalLiability.toFixed(2)} across ${taxableItems.length} taxable benefits`)

  if (exemptItems.length > 0) {
    recs.push(`${exemptItems.length} benefit(s) exempt from FBT (minor benefit exemption or work-related items)`)
  }

  if (lodgmentStatus === 'overdue') {
    recs.push('FBT return lodgment is OVERDUE - lodge immediately to avoid penalties')
  } else if (lodgmentStatus === 'due_soon') {
    recs.push('FBT return lodgment deadline approaching - prepare return now')
  }

  // Category-specific recommendations
  if (byCategory['meal_entertainment']) {
    recs.push('Meal entertainment benefits detected - consider the 50-50 split method or 12-week register method for valuation')
  }

  // Car fringe benefit recommendations (s 9 / s 10 FBTAA 1986)
  if (byCategory['car_fringe_benefit']) {
    if (carBenefitItems.length > 0 && carBenefitTotalSavings > 0) {
      recs.push(
        `Car fringe benefits: ${carBenefitItems.length} vehicle(s) valued using both statutory formula (s 9) and operating cost (s 10) methods. ` +
        `Potential savings of $${carBenefitTotalSavings.toFixed(2)} by using optimal method per vehicle.`
      )
      // Recommend log book if any car items lack one
      const missingLogBook = carBenefitItems.filter(i => i.carBenefitDetail && !i.carBenefitDetail.logBookAvailable)
      if (missingLogBook.length > 0) {
        recs.push(
          `${missingLogBook.length} car benefit(s) lack a valid log book (s 10A FBTAA 1986). ` +
          'Without a 12-week log book, private use is deemed 100%. Maintaining a log book may significantly reduce FBT via the operating cost method.'
        )
      }
    } else {
      // Car benefits classified but no valuation data available
      const carCount = byCategory['car_fringe_benefit'].count
      recs.push(
        `${carCount} car fringe benefit(s) detected but base value data not available for valuation. ` +
        'Provide vehicle cost price and operating cost data to compare statutory formula (s 9) vs operating cost (s 10) methods for potential FBT savings.'
      )
    }
  }

  // Otherwise Deductible Rule recommendations (s 24 FBTAA 1986)
  if (odrAppliedItems.length > 0) {
    recs.push(
      `Otherwise deductible rule (s 24 FBTAA 1986) applied to ${odrAppliedItems.length} benefit(s), ` +
      `reducing total taxable value by $${odrTotalReduction.toFixed(2)}. ` +
      'The ODR reduces taxable value where the employee could have claimed a deduction under s 8-1 ITAA 1997.'
    )
  }

  // Check for items that might qualify for ODR but were not matched
  const potentialOdrItems = taxableItems.filter(
    i => i.otherwiseDeductibleResult === null &&
      i.category !== 'exempt_benefit' &&
      i.category !== 'car_fringe_benefit' &&
      i.taxableValue > 0
  )
  if (potentialOdrItems.length > 0) {
    recs.push(
      `${potentialOdrItems.length} benefit(s) may qualify for the otherwise deductible rule (s 24 FBTAA 1986). ` +
      'Review whether these benefits would have been deductible to the employee under s 8-1 ITAA 1997 to reduce FBT.'
    )
  }

  recs.push('Consider employee contributions to further reduce FBT taxable value')
  recs.push('Review salary packaging arrangements to optimise FBT position')
  recs.push('Maintain FBT records for 5 years from date of lodgment')

  if (totalLiability > 50000) {
    recs.push('High FBT liability - professional review strongly recommended')
  }

  return recs
}

/**
 * Create empty FBT summary
 */
function createEmptyFBTSummary(fbtYear: string): FBTSummary {
  return {
    fbtYear,
    totalFBTLiability: 0,
    totalTaxableValue: 0,
    type1AggregateAmount: 0,
    type2AggregateAmount: 0,
    fbtRate: FALLBACK_FBT_RATE,
    grossUpRate1: FALLBACK_GROSS_UP_RATE_1,
    grossUpRate2: FALLBACK_GROSS_UP_RATE_2,
    itemCount: 0,
    exemptBenefitsCount: 0,
    exemptBenefitsValue: 0,
    byCategory: {},
    items: [],
    lodgmentDeadline: '',
    lodgmentStatus: 'upcoming',
    carBenefitCount: 0,
    carBenefitTotalSavings: 0,
    odrAppliedCount: 0,
    odrTotalReduction: 0,
    taxRateSource: 'none',
    taxRateVerifiedAt: new Date().toISOString(),
    legislativeReferences: [],
    recommendations: ['No FBT items found. Connect Xero and run analysis first.'],
    professionalReviewRequired: false,
  }
}
