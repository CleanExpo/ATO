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
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'

// Deduction thresholds and rates
// NOTE: These are fallback values - actual values fetched from ATO.gov.au
const FALLBACK_INSTANT_WRITEOFF_THRESHOLD = 20000 // $20,000 (2024-25 fallback)
const FALLBACK_HOME_OFFICE_RATE_PER_HOUR = 0.67 // 67c per hour (2024-25 fallback)
const MIN_CONFIDENCE_FOR_CLAIM = 60 // Minimum confidence to recommend claiming

// Cache for tax rates (refreshed per function invocation)
let cachedRates: {
  instantWriteOffThreshold: number
  homeOfficeRatePerHour: number
} | null = null

/**
 * Get current deduction thresholds from ATO (cached for 24 hours)
 */
async function getDeductionThresholds(): Promise<{
  instantWriteOffThreshold: number
  homeOfficeRatePerHour: number
}> {
  if (cachedRates) {
    return cachedRates
  }

  try {
    const rates = await getCurrentTaxRates()

    cachedRates = {
      instantWriteOffThreshold: rates.instantWriteOffThreshold || FALLBACK_INSTANT_WRITEOFF_THRESHOLD,
      homeOfficeRatePerHour: rates.homeOfficeRatePerHour || FALLBACK_HOME_OFFICE_RATE_PER_HOUR,
    }

    return cachedRates
  } catch (error) {
    console.warn('Failed to fetch current tax rates, using fallback values:', error)

    // Return fallback values on error
    return {
      instantWriteOffThreshold: FALLBACK_INSTANT_WRITEOFF_THRESHOLD,
      homeOfficeRatePerHour: FALLBACK_HOME_OFFICE_RATE_PER_HOUR,
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
}

export interface DeductionOpportunity {
  category: DeductionCategory
  financialYear: string
  totalAmount: number
  claimedAmount: number
  unclaimedAmount: number
  transactionCount: number
  transactions: DeductionTransaction[]
  legislativeReference: string
  confidence: number
  recommendations: string[]
  estimatedTaxSaving: number // At 25% corporate tax rate
  requiresDocumentation: boolean
  documentationRequired: string[]
  fbtImplications: boolean
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
}

/**
 * Analyze all deduction opportunities for a tenant
 */
export async function analyzeDeductionOpportunities(
  tenantId: string,
  startYear?: string,
  endYear?: string
): Promise<DeductionSummary> {
  const supabase = await createServiceClient()

  // Fetch all analyzed transactions with deduction eligibility
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
    return createEmptySummary()
  }

  console.log(`Analyzing ${transactions.length} transactions for deduction opportunities`)

  // Group transactions by category and financial year
  const opportunities = groupByDeductionCategory(transactions)

  // Calculate summary statistics
  const summary = calculateDeductionSummary(opportunities)

  return summary
}

/**
 * Group transactions by deduction category and financial year
 */
function groupByDeductionCategory(transactions: any[]): DeductionOpportunity[] {
  const categoryYearMap = new Map<string, any[]>()

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
    const opportunity = analyzeDeductionCategory(category as DeductionCategory, year, txs)

    // Only include if there are unclaimed deductions
    if (opportunity.unclaimedAmount > 0) {
      opportunities.push(opportunity)
    }
  })

  // Sort by unclaimed amount (descending)
  opportunities.sort((a, b) => b.unclaimedAmount - a.unclaimedAmount)

  return opportunities
}

/**
 * Analyze a specific deduction category for a financial year
 */
function analyzeDeductionCategory(
  category: DeductionCategory,
  financialYear: string,
  transactions: any[]
): DeductionOpportunity {
  let totalAmount = 0
  let claimedAmount = 0
  let unclaimedAmount = 0
  let totalConfidence = 0

  const deductionTransactions: DeductionTransaction[] = transactions.map((tx) => {
    const amount = Math.abs(parseFloat(tx.transaction_amount) || 0)
    totalAmount += amount

    const isFullyDeductible = tx.is_fully_deductible || false
    const deductibleAmount = parseFloat(tx.claimable_amount) || (isFullyDeductible ? amount : 0)
    const nonDeductibleAmount = amount - deductibleAmount

    // Assume claimed if confidence is high and marked as deductible
    // (In reality, would need to check actual tax return data)
    const wasClaimed = isFullyDeductible && tx.deduction_confidence >= 80
    if (wasClaimed) {
      claimedAmount += deductibleAmount
    } else if (isFullyDeductible) {
      unclaimedAmount += deductibleAmount
    }

    totalConfidence += tx.deduction_confidence || 0

    return {
      transactionId: tx.transaction_id,
      transactionDate: tx.transaction_date,
      description: tx.transaction_description,
      amount,
      supplier: tx.supplier_name,
      category,
      isFullyDeductible,
      deductibleAmount,
      nonDeductibleAmount,
      deductionType: tx.deduction_type || 'Section 8-1',
      confidence: tx.deduction_confidence || 0,
      reasoning: tx.deduction_reasoning || '',
      restrictions: tx.deduction_restrictions || [],
    }
  })

  const averageConfidence = transactions.length > 0 ? Math.round(totalConfidence / transactions.length) : 0

  // Calculate estimated tax saving (25% corporate rate for small business)
  const estimatedTaxSaving = unclaimedAmount * 0.25

  // Get legislative reference
  const legislativeReference = getLegislativeReference(category)

  // Generate recommendations
  const recommendations = generateDeductionRecommendations(
    category,
    unclaimedAmount,
    claimedAmount,
    transactions.length,
    averageConfidence
  )

  // Determine documentation requirements
  const requiresDocumentation = unclaimedAmount > 1000 // Require docs for >$1k
  const documentationRequired = generateDeductionDocumentation(category, unclaimedAmount, transactions.length)

  // Check FBT implications
  const fbtImplications = checkFbtImplications(category)

  return {
    category,
    financialYear,
    totalAmount,
    claimedAmount,
    unclaimedAmount,
    transactionCount: transactions.length,
    transactions: deductionTransactions,
    legislativeReference,
    confidence: averageConfidence,
    recommendations,
    estimatedTaxSaving,
    requiresDocumentation,
    documentationRequired,
    fbtImplications,
  }
}

/**
 * Map AI category to standard deduction category
 */
function mapToDeductionCategory(aiCategory: string | null): DeductionCategory {
  if (!aiCategory) return 'Other Deductible Expenses'

  const category = aiCategory.toLowerCase()

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
  if (category.includes('utilities') || category.includes('electricity') || category.includes('internet')) {
    return 'Utilities'
  }
  if (category.includes('training') || category.includes('education') || category.includes('course')) {
    return 'Training & Education'
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
      return 'Section 40-82 ITAA 1997 (Simplified depreciation - instant asset write-off)'
    case 'Capital Allowance (Division 40)':
      return 'Division 40 ITAA 1997 (Capital allowances)'
    case 'Professional Fees':
    case 'Marketing & Advertising':
    case 'Office Expenses':
    case 'Software & Subscriptions':
    case 'Travel Expenses':
    case 'Repairs & Maintenance':
    case 'Utilities':
    case 'Training & Education':
    case 'Other Deductible Expenses':
      return 'Section 8-1 ITAA 1997 (General deductions)'
    case 'Vehicle Expenses':
      return 'Section 8-1 ITAA 1997 (General deductions - business use portion)'
    case 'Home Office':
      return 'Section 8-1 ITAA 1997 (Home office expenses - business use portion)'
    case 'Insurance':
      return 'Section 8-1 ITAA 1997 (Business insurance premiums)'
    case 'Bank Fees':
      return 'Section 8-1 ITAA 1997 (Borrowing expenses)'
    case 'Interest Expenses':
      return 'Section 8-1 ITAA 1997 (Interest on business loans)'
    case 'Bad Debts':
      return 'Section 8-1 & Section 25-35 ITAA 1997 (Bad debts)'
    case 'Non-Deductible (Private/Domestic)':
      return 'Section 8-1(2)(b) ITAA 1997 (Private or domestic expenses - not deductible)'
    default:
      return 'Section 8-1 ITAA 1997 (General deductions)'
  }
}

/**
 * Generate recommendations for deduction category
 */
function generateDeductionRecommendations(
  category: DeductionCategory,
  unclaimedAmount: number,
  claimedAmount: number,
  transactionCount: number,
  confidence: number
): string[] {
  const recommendations: string[] = []

  if (category === 'Non-Deductible (Private/Domestic)') {
    recommendations.push('❌ Private or domestic expenses are not deductible')
    recommendations.push('Ensure these expenses are not claimed in tax return')
    return recommendations
  }

  if (unclaimedAmount === 0) {
    recommendations.push('✅ All eligible expenses appear to be claimed')
    return recommendations
  }

  if (confidence < MIN_CONFIDENCE_FOR_CLAIM) {
    recommendations.push(`⚠️ Low confidence (${confidence}%) - review with accountant before claiming`)
  }

  recommendations.push(`💰 Unclaimed deductions: $${unclaimedAmount.toFixed(2)} across ${transactionCount} transactions`)
  recommendations.push(`💵 Estimated tax saving: $${(unclaimedAmount * 0.25).toFixed(2)} at 25% corporate rate`)

  if (category === 'Instant Asset Write-Off') {
    recommendations.push(`📋 Lodge amended return to claim instant asset write-off`)
    recommendations.push('Ensure assets are under $20,000 and first used/installed ready for use')
    recommendations.push('Retain invoices and proof of payment')
  } else if (category === 'Capital Allowance (Division 40)') {
    recommendations.push('Calculate depreciation using effective life or diminishing value method')
    recommendations.push('Lodge amended return if depreciation was not claimed')
  } else if (category === 'Home Office') {
    recommendations.push('Use either 67c per hour method or actual cost method (whichever is higher)')
    recommendations.push('Maintain diary or timesheet showing hours worked from home')
  } else if (category === 'Vehicle Expenses') {
    recommendations.push('Use cents per km method (85c/km for 2024-25) or logbook method')
    recommendations.push('Maintain logbook for 12 continuous weeks if using logbook method')
  } else {
    recommendations.push('Lodge amended return to claim missed deductions')
    recommendations.push('Ensure expenses have business purpose (nexus to income generation)')
  }

  recommendations.push('Retain all invoices, receipts, and proof of payment (5 years)')

  if (unclaimedAmount > 10000) {
    recommendations.push('⚠️ High-value claim - ensure comprehensive documentation is available')
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
  ]
  return fbtCategories.includes(category)
}

/**
 * Calculate overall deduction summary
 */
function calculateDeductionSummary(opportunities: DeductionOpportunity[]): DeductionSummary {
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
  }
}

/**
 * Identify instant asset write-off opportunities (≤ current threshold from ATO)
 */
export async function identifyInstantWriteOffs(tenantId: string): Promise<DeductionOpportunity[]> {
  const summary = await analyzeDeductionOpportunities(tenantId)
  const { instantWriteOffThreshold } = await getDeductionThresholds()

  return summary.opportunities.filter((opp) => {
    return (
      opp.category === 'Capital Allowance (Division 40)' &&
      opp.transactions.some((tx) => tx.amount <= instantWriteOffThreshold)
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
  }
}
