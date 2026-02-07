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
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'
import { getCurrentFBTYear, getFBTYearStartDate, getFBTYearEndDate } from '@/lib/utils/financial-year'
import Decimal from 'decimal.js'

// FBT rates (FBTAA 1986, s 136)
const FALLBACK_FBT_RATE = 0.47 // 47% FBT rate
const FALLBACK_GROSS_UP_RATE_1 = 2.0802 // Type 1 (GST-creditable)
const FALLBACK_GROSS_UP_RATE_2 = 1.8868 // Type 2 (non-GST-creditable)

// Exemption thresholds
const MINOR_BENEFIT_THRESHOLD = 300 // s 58X - $300 per benefit
const CAR_PARKING_THRESHOLD = 9.72 // s 58GA - per-day threshold FY2024-25

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
  const items: FBTItem[] = transactions.map((tx: any) => {
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

  const recommendations = generateFBTRecommendations(
    totalFBTLiability, taxableItems, exemptItems, lodgmentStatus, byCategory
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
    taxRateSource: rateSource,
    taxRateVerifiedAt: new Date().toISOString(),
    legislativeReferences: [
      'FBTAA 1986 (Fringe Benefits Tax Assessment Act)',
      's 136 FBTAA 1986 (FBT rate)',
      's 57A FBTAA 1986 (Exempt benefits)',
      's 58X FBTAA 1986 (Minor benefits exemption - $300)',
      's 24 FBTAA 1986 (Otherwise deductible rule)',
    ],
    recommendations,
    professionalReviewRequired: totalFBTLiability > 10000,
  }
}

/**
 * Classify transaction and calculate FBT liability
 */
function classifyAndCalculateFBT(
  tx: any,
  fbtRate: number,
  grossUpRate1: number,
  grossUpRate2: number
): FBTItem {
  const amount = Math.abs(parseFloat(tx.transaction_amount) || 0)
  const description = (tx.transaction_description || '').toLowerCase()
  const category = classifyFBTCategory(description, tx.primary_category)

  // Determine benefit type (Type 1 = GST-creditable, Type 2 = not)
  // Type 1: employer is entitled to a GST input tax credit on the benefit
  // Type 2: no GST credit available (GST-free, input-taxed, or no ABN supplier)
  const benefitType = determineBenefitType(category, description, tx)

  // Check for exemptions
  const exemption = checkFBTExemptions(category, amount, description)

  // Calculate taxable value
  let taxableValue = amount
  if (exemption) {
    taxableValue = 0 // Exempt
  }

  // Gross up
  const grossUpRate = benefitType === 'type_1' ? grossUpRate1 : grossUpRate2
  const grossedUpValue = new Decimal(taxableValue)
    .times(grossUpRate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber()

  // GST credits (Type 1 only)
  const gstCredits = benefitType === 'type_1'
    ? new Decimal(taxableValue).dividedBy(11).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
    : 0

  // FBT liability
  const fbtLiability = new Decimal(grossedUpValue)
    .times(fbtRate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber()

  return {
    transactionId: tx.transaction_id,
    transactionDate: tx.transaction_date,
    description: tx.transaction_description || '',
    amount,
    supplier: tx.supplier_name,
    category: exemption ? 'exempt_benefit' : category,
    benefitType,
    taxableValue,
    grossedUpValue,
    gstCredits,
    exemptionApplied: exemption,
    employeeContribution: 0, // Would need employee contribution data
    fbtLiability,
    confidence: tx.category_confidence || 50,
    legislativeReference: getLegislativeRef(category),
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
  tx: any
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
    const gstAmount = parseFloat(tx.gst_amount) || 0
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
  byCategory: Record<string, { count: number; taxableValue: number; grossedUpValue: number; fbtLiability: number }>
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
  if (byCategory['car_fringe_benefit']) {
    recs.push('Car fringe benefits detected - compare statutory formula method vs operating cost method for lowest FBT')
  }

  recs.push('Consider employee contributions (s 24 FBTAA 1986) to reduce FBT taxable value')
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
    taxRateSource: 'none',
    taxRateVerifiedAt: new Date().toISOString(),
    legislativeReferences: [],
    recommendations: ['No FBT items found. Connect Xero and run analysis first.'],
    professionalReviewRequired: false,
  }
}
