/**
 * Division 7A Compliance Engine (ITAA 1936)
 *
 * Analyzes shareholder loans and private company payments to ensure
 * compliance with Division 7A deemed dividend rules.
 *
 * Key Requirements:
 * - Shareholder loans must have written agreement
 * - Interest charged at benchmark rate (8.77% for FY2024-25)
 * - Minimum yearly repayment required
 * - Non-compliance = deemed dividend (taxed at shareholder's marginal rate)
 */

import { createServiceClient } from '@/lib/supabase/server'

// Division 7A benchmark interest rates (ATO published rates)
const DIV7A_BENCHMARK_RATES: Record<string, number> = {
  'FY2024-25': 0.0877, // 8.77%
  'FY2023-24': 0.0833, // 8.33%
  'FY2022-23': 0.0452, // 4.52%
  'FY2021-22': 0.0445, // 4.45%
  'FY2020-21': 0.0480, // 4.80%
}

// Loan term maximums
const UNSECURED_LOAN_MAX_TERM = 7 // 7 years
const SECURED_LOAN_MAX_TERM = 25 // 25 years

// Minimum repayment thresholds
const MIN_REPAYMENT_THRESHOLD = 100 // Don't flag if below $100

export interface ShareholderLoan {
  loanId: string
  shareholderName: string
  shareholderId: string | null
  loanType: 'unsecured' | 'secured' | 'unknown'
  maxTermYears: number
}

export interface Division7aAnalysis {
  loanId: string
  shareholderName: string
  financialYears: string[]
  loanType: 'unsecured' | 'secured' | 'unknown'

  // Financial position
  openingBalance: number
  advancesThisYear: number // New loans/payments to shareholder
  repaymentsThisYear: number // Principal + interest repayments
  closingBalance: number

  // Interest analysis
  interestCharged: number
  benchmarkInterestRate: number
  benchmarkInterestRequired: number
  interestShortfall: number

  // Repayment analysis
  minimumRepaymentRequired: number
  actualRepayment: number
  repaymentShortfall: number

  // Compliance
  hasWrittenAgreement: boolean
  isCompliant: boolean
  complianceIssues: string[]

  // Risk assessment
  deemedDividendRisk: number // Amount at risk of being deemed dividend
  potentialTaxLiability: number // Estimated tax if deemed dividend
  riskLevel: 'low' | 'medium' | 'high' | 'critical'

  // Recommendations
  recommendations: string[]
  correctiveActions: string[]
}

export interface Div7aSummary {
  totalLoans: number
  totalLoanBalance: number
  compliantLoans: number
  nonCompliantLoans: number
  totalDeemedDividendRisk: number
  totalPotentialTaxLiability: number
  averageRiskLevel: string
  criticalIssues: string[]
  loanAnalyses: Division7aAnalysis[]
}

/**
 * Analyze Division 7A compliance for all shareholder loans
 */
export async function analyzeDiv7aCompliance(
  tenantId: string,
  startYear?: string,
  endYear?: string
): Promise<Div7aSummary> {
  const supabase = await createServiceClient()

  // Identify shareholder loans from transaction patterns
  const loans = await identifyShareholderLoans(supabase, tenantId, startYear, endYear)

  if (loans.length === 0) {
    console.log('No shareholder loans identified')
    return createEmptyDiv7aSummary()
  }

  console.log(`Analyzing ${loans.length} shareholder loans for Division 7A compliance`)

  // Analyze each loan
  const loanAnalyses: Division7aAnalysis[] = []

  for (const loan of loans) {
    const analysis = await analyzeSingleLoan(supabase, tenantId, loan, startYear, endYear)
    loanAnalyses.push(analysis)
  }

  // Calculate summary
  const summary = calculateDiv7aSummary(loanAnalyses)

  return summary
}

/**
 * Identify shareholder loans from transaction data
 * Looks for patterns like:
 * - Payments to individuals (not suppliers)
 * - Account codes for "Director Loans", "Shareholder Loans"
 * - Recurring payments to same individual
 */
async function identifyShareholderLoans(
  supabase: any,
  tenantId: string,
  startYear?: string,
  endYear?: string
): Promise<ShareholderLoan[]> {
  // Query transactions for shareholder loan patterns
  let query = supabase
    .from('forensic_analysis_results')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('division7a_risk', true)

  if (startYear) {
    query = query.gte('financial_year', startYear)
  }
  if (endYear) {
    query = query.lte('financial_year', endYear)
  }

  const { data, error } = await query

  if (error || !data) {
    console.error('Failed to fetch Division 7A transactions:', error)
    return []
  }

  // Group transactions by shareholder/payee
  const loanMap = new Map<string, any[]>()

  data.forEach((tx: any) => {
    const shareholderName = tx.supplier_name || tx.contact_name || 'Unknown Shareholder'
    const key = shareholderName.toLowerCase()

    if (!loanMap.has(key)) {
      loanMap.set(key, [])
    }
    loanMap.get(key)!.push(tx)
  })

  // Convert to loan objects
  const loans: ShareholderLoan[] = []

  loanMap.forEach((transactions, key) => {
    const firstTx = transactions[0]
    const loanId = `DIV7A-${key.replace(/[^a-z0-9]/g, '-')}`

    // Determine loan type from transaction descriptions
    const description = (firstTx.transaction_description || '').toLowerCase()
    let loanType: 'unsecured' | 'secured' | 'unknown' = 'unknown'

    if (description.includes('secured') || description.includes('mortgage')) {
      loanType = 'secured'
    } else if (description.includes('unsecured') || description.includes('loan')) {
      loanType = 'unsecured'
    }

    loans.push({
      loanId,
      shareholderName: firstTx.supplier_name || firstTx.contact_name || 'Unknown Shareholder',
      shareholderId: firstTx.contact_id,
      loanType,
      maxTermYears: loanType === 'secured' ? SECURED_LOAN_MAX_TERM : UNSECURED_LOAN_MAX_TERM,
    })
  })

  return loans
}

/**
 * Analyze a single shareholder loan for Division 7A compliance
 */
async function analyzeSingleLoan(
  supabase: any,
  tenantId: string,
  loan: ShareholderLoan,
  startYear?: string,
  endYear?: string
): Promise<Division7aAnalysis> {
  // Fetch all transactions for this loan
  let query = supabase
    .from('forensic_analysis_results')
    .select('*')
    .eq('tenant_id', tenantId)
    .ilike('supplier_name', `%${loan.shareholderName}%`)
    .order('transaction_date', { ascending: true })

  if (startYear) {
    query = query.gte('financial_year', startYear)
  }
  if (endYear) {
    query = query.lte('financial_year', endYear)
  }

  const { data: transactions, error } = await query

  if (error || !transactions) {
    console.error(`Failed to fetch transactions for loan ${loan.loanId}:`, error)
    // Return default analysis
    return createDefaultLoanAnalysis(loan)
  }

  // Calculate financial position
  const financialYears = Array.from(new Set(transactions.map((tx: any) => tx.financial_year))).sort() as string[]
  const latestYear = financialYears[financialYears.length - 1]

  let openingBalance = 0
  let advancesThisYear = 0
  let repaymentsThisYear = 0
  let interestCharged = 0

  transactions.forEach((tx: any) => {
    const amount = Math.abs(parseFloat(tx.transaction_amount) || 0)
    const description = (tx.transaction_description || '').toLowerCase()

    // Determine if advance or repayment
    if (description.includes('loan') || description.includes('advance') || description.includes('payment to')) {
      advancesThisYear += amount
    } else if (description.includes('repayment') || description.includes('interest')) {
      repaymentsThisYear += amount

      if (description.includes('interest')) {
        interestCharged += amount
      }
    }
  })

  // Calculate closing balance (simplified - real implementation would track year-over-year)
  const closingBalance = openingBalance + advancesThisYear - repaymentsThisYear

  // Calculate benchmark interest
  const benchmarkInterestRate = DIV7A_BENCHMARK_RATES[latestYear as string] || 0.0877
  const benchmarkInterestRequired = closingBalance * benchmarkInterestRate
  const interestShortfall = Math.max(0, benchmarkInterestRequired - interestCharged)

  // Calculate minimum repayment
  const minimumRepaymentRequired = calculateMinimumRepayment(
    closingBalance,
    benchmarkInterestRate,
    loan.maxTermYears
  )
  const actualRepayment = repaymentsThisYear
  const repaymentShortfall = Math.max(0, minimumRepaymentRequired - actualRepayment)

  // Check for written agreement (would need to be manually verified)
  const hasWrittenAgreement = false // Conservative assumption - requires manual verification

  // Compliance check
  const complianceIssues: string[] = []

  if (!hasWrittenAgreement && closingBalance > MIN_REPAYMENT_THRESHOLD) {
    complianceIssues.push('No written loan agreement in place')
  }

  if (interestShortfall > MIN_REPAYMENT_THRESHOLD) {
    complianceIssues.push(`Interest shortfall: $${interestShortfall.toFixed(2)} (required: $${benchmarkInterestRequired.toFixed(2)}, charged: $${interestCharged.toFixed(2)})`)
  }

  if (repaymentShortfall > MIN_REPAYMENT_THRESHOLD) {
    complianceIssues.push(`Repayment shortfall: $${repaymentShortfall.toFixed(2)} (required: $${minimumRepaymentRequired.toFixed(2)}, actual: $${actualRepayment.toFixed(2)})`)
  }

  const isCompliant = complianceIssues.length === 0

  // Calculate deemed dividend risk
  const deemedDividendRisk = isCompliant ? 0 : closingBalance

  // Estimate tax liability (assume 47% marginal rate including Medicare Levy)
  const potentialTaxLiability = deemedDividendRisk * 0.47

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
  if (complianceIssues.length >= 2 && deemedDividendRisk > 50000) {
    riskLevel = 'critical'
  } else if (complianceIssues.length >= 2 || deemedDividendRisk > 20000) {
    riskLevel = 'high'
  } else if (complianceIssues.length === 1) {
    riskLevel = 'medium'
  }

  // Generate recommendations
  const recommendations = generateDiv7aRecommendations(
    loan,
    isCompliant,
    complianceIssues,
    interestShortfall,
    repaymentShortfall,
    benchmarkInterestRate,
    minimumRepaymentRequired
  )

  // Generate corrective actions
  const correctiveActions = generateCorrectiveActions(
    loan,
    hasWrittenAgreement,
    interestShortfall,
    repaymentShortfall
  )

  return {
    loanId: loan.loanId,
    shareholderName: loan.shareholderName,
    financialYears,
    loanType: loan.loanType,
    openingBalance,
    advancesThisYear,
    repaymentsThisYear,
    closingBalance,
    interestCharged,
    benchmarkInterestRate,
    benchmarkInterestRequired,
    interestShortfall,
    minimumRepaymentRequired,
    actualRepayment,
    repaymentShortfall,
    hasWrittenAgreement,
    isCompliant,
    complianceIssues,
    deemedDividendRisk,
    potentialTaxLiability,
    riskLevel,
    recommendations,
    correctiveActions,
  }
}

/**
 * Calculate minimum yearly repayment for Division 7A loan
 * Formula: Principal × (r × (1+r)^n) / ((1+r)^n - 1)
 * Where r = benchmark rate, n = term in years
 */
function calculateMinimumRepayment(principal: number, interestRate: number, termYears: number): number {
  if (principal <= 0 || termYears <= 0) {
    return 0
  }

  const r = interestRate
  const n = termYears
  const rPlus1PowerN = Math.pow(1 + r, n)

  const minRepayment = principal * ((r * rPlus1PowerN) / (rPlus1PowerN - 1))

  return minRepayment
}

/**
 * Generate recommendations for Division 7A compliance
 */
function generateDiv7aRecommendations(
  loan: ShareholderLoan,
  isCompliant: boolean,
  complianceIssues: string[],
  interestShortfall: number,
  repaymentShortfall: number,
  benchmarkRate: number,
  minRepayment: number
): string[] {
  const recommendations: string[] = []

  if (isCompliant) {
    recommendations.push('✅ Loan is compliant with Division 7A requirements')
    recommendations.push('Continue to maintain written agreement and meet repayment obligations')
    return recommendations
  }

  // Critical issues
  if (complianceIssues.length > 0) {
    recommendations.push('🔴 CRITICAL: Division 7A non-compliance detected')
    recommendations.push('Risk of deemed dividend - immediate action required')
  }

  // Specific issue recommendations
  if (interestShortfall > MIN_REPAYMENT_THRESHOLD) {
    recommendations.push(`💰 Charge additional interest: $${interestShortfall.toFixed(2)}`)
    recommendations.push(`📊 Benchmark interest rate: ${(benchmarkRate * 100).toFixed(2)}%`)
    recommendations.push('Lodge amended company tax return if interest not charged')
  }

  if (repaymentShortfall > MIN_REPAYMENT_THRESHOLD) {
    recommendations.push(`💵 Make additional repayment: $${repaymentShortfall.toFixed(2)}`)
    recommendations.push(`📋 Minimum annual repayment: $${minRepayment.toFixed(2)}`)
    recommendations.push('Make repayment before lodgment day to avoid deemed dividend')
  }

  // Written agreement
  if (!complianceIssues.some((issue) => issue.includes('written agreement'))) {
    recommendations.push('📝 Ensure written loan agreement is in place and signed')
    recommendations.push('Agreement must be executed by lodgment day of year loan was made')
  }

  // Loan type specific
  if (loan.loanType === 'unknown') {
    recommendations.push('⚠️ Clarify loan type (secured vs unsecured) for correct term length')
  }

  // General recommendations
  recommendations.push('📋 Lodge Division 7A loan schedule with Company Tax Return')
  recommendations.push('Maintain records of all loan advances, repayments, and interest charges')
  recommendations.push('Consider seeking professional advice from tax specialist')

  return recommendations
}

/**
 * Generate corrective actions to achieve compliance
 */
function generateCorrectiveActions(
  loan: ShareholderLoan,
  hasWrittenAgreement: boolean,
  interestShortfall: number,
  repaymentShortfall: number
): string[] {
  const actions: string[] = []

  if (!hasWrittenAgreement) {
    actions.push('1. Execute complying Division 7A loan agreement immediately')
    actions.push('   - Use ATO approved loan agreement template')
    actions.push('   - Ensure signed by both company and shareholder')
    actions.push(`   - Specify term: ${loan.maxTermYears} years (${loan.loanType === 'secured' ? 'secured' : 'unsecured'})`)
  }

  if (interestShortfall > MIN_REPAYMENT_THRESHOLD) {
    actions.push('2. Charge benchmark interest before lodgment day')
    actions.push(`   - Record interest expense in company books: $${interestShortfall.toFixed(2)}`)
    actions.push('   - Issue invoice to shareholder for interest due')
  }

  if (repaymentShortfall > MIN_REPAYMENT_THRESHOLD) {
    actions.push('3. Make minimum repayment before lodgment day')
    actions.push(`   - Shortfall to pay: $${repaymentShortfall.toFixed(2)}`)
    actions.push('   - Record repayment in company books')
    actions.push('   - Allocate between principal and interest')
  }

  actions.push('4. Lodge Division 7A loan schedule with tax return')
  actions.push('5. Consider self-amending prior year returns if non-compliant in previous years')

  return actions
}

/**
 * Calculate overall Division 7A summary
 */
function calculateDiv7aSummary(loanAnalyses: Division7aAnalysis[]): Div7aSummary {
  let totalLoanBalance = 0
  let compliantLoans = 0
  let nonCompliantLoans = 0
  let totalDeemedDividendRisk = 0
  let totalPotentialTaxLiability = 0

  const riskLevels: string[] = []
  const criticalIssues: string[] = []

  loanAnalyses.forEach((analysis) => {
    totalLoanBalance += analysis.closingBalance

    if (analysis.isCompliant) {
      compliantLoans++
    } else {
      nonCompliantLoans++
    }

    totalDeemedDividendRisk += analysis.deemedDividendRisk
    totalPotentialTaxLiability += analysis.potentialTaxLiability

    riskLevels.push(analysis.riskLevel)

    if (analysis.riskLevel === 'critical') {
      criticalIssues.push(`${analysis.shareholderName}: ${analysis.complianceIssues.join(', ')}`)
    }
  })

  // Calculate average risk level
  const criticalCount = riskLevels.filter((r) => r === 'critical').length
  const highCount = riskLevels.filter((r) => r === 'high').length
  let averageRiskLevel = 'low'
  if (criticalCount > 0) {
    averageRiskLevel = 'critical'
  } else if (highCount > 0) {
    averageRiskLevel = 'high'
  } else if (riskLevels.some((r) => r === 'medium')) {
    averageRiskLevel = 'medium'
  }

  return {
    totalLoans: loanAnalyses.length,
    totalLoanBalance,
    compliantLoans,
    nonCompliantLoans,
    totalDeemedDividendRisk,
    totalPotentialTaxLiability,
    averageRiskLevel,
    criticalIssues,
    loanAnalyses,
  }
}

/**
 * Create default loan analysis when data unavailable
 */
function createDefaultLoanAnalysis(loan: ShareholderLoan): Division7aAnalysis {
  return {
    loanId: loan.loanId,
    shareholderName: loan.shareholderName,
    financialYears: [],
    loanType: loan.loanType,
    openingBalance: 0,
    advancesThisYear: 0,
    repaymentsThisYear: 0,
    closingBalance: 0,
    interestCharged: 0,
    benchmarkInterestRate: 0.0877,
    benchmarkInterestRequired: 0,
    interestShortfall: 0,
    minimumRepaymentRequired: 0,
    actualRepayment: 0,
    repaymentShortfall: 0,
    hasWrittenAgreement: false,
    isCompliant: false,
    complianceIssues: ['Insufficient data to determine compliance'],
    deemedDividendRisk: 0,
    potentialTaxLiability: 0,
    riskLevel: 'medium',
    recommendations: ['Unable to analyze - insufficient transaction data'],
    correctiveActions: ['Verify loan details and transaction history'],
  }
}

/**
 * Create empty summary when no data available
 */
function createEmptyDiv7aSummary(): Div7aSummary {
  return {
    totalLoans: 0,
    totalLoanBalance: 0,
    compliantLoans: 0,
    nonCompliantLoans: 0,
    totalDeemedDividendRisk: 0,
    totalPotentialTaxLiability: 0,
    averageRiskLevel: 'low',
    criticalIssues: [],
    loanAnalyses: [],
  }
}

/**
 * Get Division 7A benchmark interest rate for a financial year
 */
export function getBenchmarkRate(financialYear: string): number {
  return DIV7A_BENCHMARK_RATES[financialYear] || 0.0877 // Default to current year rate
}
