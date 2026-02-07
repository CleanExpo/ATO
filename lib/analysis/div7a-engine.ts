/**
 * Division 7A Compliance Engine (ITAA 1936)
 *
 * Analyses shareholder loans and private company payments to ensure
 * compliance with Division 7A deemed dividend rules.
 *
 * Key Sections:
 * - s 109D: Deemed dividends from loans to shareholders/associates
 * - s 109E: Loan definitions and exclusions
 * - s 109N: Benchmark interest rate for complying loan agreements
 * - s 109F: Deemed dividends from forgiven debts
 *
 * Key Requirements:
 * - Shareholder loans must have written agreement (s 109N)
 * - Interest charged at benchmark rate (8.77% for FY2024-25, per s 109N)
 * - Minimum yearly repayment required
 * - Non-compliance = deemed dividend (taxed at shareholder's marginal rate, s 109D)
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'
import {
  getCurrentFinancialYear,
  getPriorFinancialYear as sharedGetPriorFinancialYear,
} from '@/lib/utils/financial-year'

// Division 7A benchmark interest rates (ATO published rates, per s 109N ITAA 1936)
// Now fetched dynamically, falling back to these historical values if API fails
const HISTORICAL_DIV7A_RATES: Record<string, number> = {
  'FY2024-25': 0.0877, // 8.77%
  'FY2023-24': 0.0833, // 8.33%
  'FY2022-23': 0.0452, // 4.52%
  'FY2021-22': 0.0445, // 4.45%
  'FY2020-21': 0.0480, // 4.80%
}

// Loan term maximums (s 109N ITAA 1936)
const UNSECURED_LOAN_MAX_TERM = 7 // 7 years
const SECURED_LOAN_MAX_TERM = 25 // 25 years

// Minimum repayment thresholds
const MIN_REPAYMENT_THRESHOLD = 100 // Don't flag if below $100

// Fix 4c: Australian individual income tax brackets for deemed dividend impact analysis
// Source: ATO tax rates for Australian residents FY2024-25
const SHAREHOLDER_TAX_SCENARIOS = [
  { label: 'Low bracket (32.5%)', rate: 0.325, description: 'Taxable income $45,001-$120,000' },
  { label: 'Medium bracket (37%)', rate: 0.37, description: 'Taxable income $120,001-$180,000' },
  { label: 'High bracket (45%)', rate: 0.45, description: 'Taxable income $180,001+' },
  { label: 'Maximum (45% + 2% Medicare Levy)', rate: 0.47, description: 'Maximum potential tax exposure' },
] as const

// Fix 4d: Keywords for improved loan classification (s 109E ITAA 1936 - loan definitions)
const LOAN_CLASSIFICATION_KEYWORDS = [
  'loan', 'advance', 'director loan', 'shareholder loan',
  'repayment', 'drawing', 'director drawing', 'shareholder drawing',
  'div 7a', 'division 7a', 'loan repay',
] as const

// Fix 4d: Xero account types that strongly indicate a loan transaction
const LOAN_ACCOUNT_TYPES = [
  'CURRLIAB',    // Current Liability
  'NONCURRLIAB', // Non-Current Liability
  'CURRASS',     // Current Asset (loans receivable)
  'NONCURRASS',  // Non-Current Asset
] as const

export interface ShareholderLoan {
  loanId: string
  shareholderName: string
  shareholderId: string | null
  loanType: 'unsecured' | 'secured' | 'unknown'
  maxTermYears: number
  /** Fix 4d: Confidence score (0-100) for loan classification accuracy */
  classificationConfidence: number
  /** Fix 4d: Signals that contributed to the loan classification */
  classificationSignals: string[]
}

/** Fix 4c: Tax liability scenario at a specific marginal rate */
export interface TaxScenario {
  label: string
  rate: number
  description: string
  taxLiability: number
}

export interface Division7aAnalysis {
  loanId: string
  shareholderName: string
  financialYears: string[]
  loanType: 'unsecured' | 'secured' | 'unknown'

  // Financial position
  openingBalance: number
  /** Fix 4a: Tracks how the opening balance was determined */
  balanceSource: 'calculated' | 'unknown'
  /** Fix 4a: Note explaining balance provenance */
  balanceNote: string
  advancesThisYear: number // New loans/payments to shareholder (s 109D ITAA 1936)
  repaymentsThisYear: number // Principal + interest repayments
  closingBalance: number

  // Interest analysis (s 109N ITAA 1936 - benchmark interest rate)
  interestCharged: number
  benchmarkInterestRate: number
  benchmarkInterestRequired: number
  interestShortfall: number

  // Repayment analysis
  minimumRepaymentRequired: number
  actualRepayment: number
  repaymentShortfall: number

  // Compliance
  /** Fix 4b: Changed from boolean to tri-state. 'unknown' means not yet verified. */
  hasWrittenAgreement: boolean | 'unknown'
  /** Fix 4b: Note about written agreement verification status */
  writtenAgreementNote: string
  isCompliant: boolean
  complianceIssues: string[]

  // Risk assessment (s 109D ITAA 1936 - deemed dividends)
  deemedDividendRisk: number // Amount at risk of being deemed dividend
  potentialTaxLiability: number // Estimated tax if deemed dividend (maximum rate for backward compat)
  /** Fix 4c: Tax liability at different marginal rate brackets */
  taxScenarios: TaxScenario[]
  /** Fix 4c: Note explaining tax rate assumptions */
  taxRateNote: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'

  // Fix 4b: Dual compliance scenarios
  /** Scenario A: Compliance position assuming a written agreement exists */
  scenarioWithAgreement?: {
    minimumRepaymentRequired: number
    benchmarkInterestRequired: number
    isCompliant: boolean
    complianceIssues: string[]
    note: string
  }
  /** Scenario B: Compliance position assuming NO written agreement (deemed dividend, s 109D) */
  scenarioWithoutAgreement?: {
    deemedDividendAmount: number
    potentialTaxLiability: number
    note: string
  }

  // Classification quality (Fix 4d)
  /** Confidence score (0-100) for the loan classification */
  classificationConfidence: number
  /** Signals used to classify this as a shareholder loan */
  classificationSignals: string[]

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
  taxRateSource: string
  taxRateVerifiedAt: string
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
  let rateSource = 'ATO-Live-Rates'
  try {
    const liveRates = await getCurrentTaxRates()
    if (liveRates.sources.division7A) {
      rateSource = liveRates.sources.division7A
    }
  } catch (err) {
    console.warn('Failed to fetch live rates for summary provenance', err)
  }

  const summary = calculateDiv7aSummary(loanAnalyses, rateSource)

  return summary
}

/**
 * Identify shareholder loans from transaction data (s 109E ITAA 1936 - loan definitions)
 *
 * Fix 4d: Uses multiple classification signals for improved accuracy:
 * - Payments to individuals (not suppliers) - original pattern matching
 * - Account code check: Current Asset/Liability accounts in Xero
 * - Description keywords: "loan", "advance", "director loan", "drawing", etc.
 * - Amount patterns: Round numbers or regular recurring amounts
 * - Each loan receives a classificationConfidence score (0-100)
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

  // Convert to loan objects with classification confidence scoring (Fix 4d)
  const loans: ShareholderLoan[] = []

  loanMap.forEach((transactions, key) => {
    const firstTx = transactions[0]
    const loanId = `DIV7A-${key.replace(/[^a-z0-9]/g, '-')}`

    // Determine loan type from transaction descriptions (existing logic preserved)
    const description = (firstTx.transaction_description || '').toLowerCase()
    let loanType: 'unsecured' | 'secured' | 'unknown' = 'unknown'

    if (description.includes('secured') || description.includes('mortgage')) {
      loanType = 'secured'
    } else if (description.includes('unsecured') || description.includes('loan')) {
      loanType = 'unsecured'
    }

    // Fix 4d: Calculate classification confidence from multiple signals
    const { confidence, signals } = calculateClassificationConfidence(transactions)

    loans.push({
      loanId,
      shareholderName: firstTx.supplier_name || firstTx.contact_name || 'Unknown Shareholder',
      shareholderId: firstTx.contact_id,
      loanType,
      maxTermYears: loanType === 'secured' ? SECURED_LOAN_MAX_TERM : UNSECURED_LOAN_MAX_TERM,
      classificationConfidence: confidence,
      classificationSignals: signals,
    })
  })

  return loans
}

/**
 * Fix 4d: Calculate classification confidence for a group of transactions
 * identified as a potential shareholder loan (s 109E ITAA 1936).
 *
 * Uses multiple signals to determine how likely these transactions
 * represent a genuine Division 7A shareholder loan vs a misclassification.
 *
 * @returns confidence (0-100) and list of contributing signals
 */
function calculateClassificationConfidence(
  transactions: any[]
): { confidence: number; signals: string[] } {
  let score = 0
  const signals: string[] = []

  // Signal 1: The transaction was already flagged as division7a_risk (base confidence)
  // This is inherent since we query for division7a_risk = true
  score += 30
  signals.push('Flagged as Division 7A risk in forensic analysis')

  // Signal 2: Account code check - loan-type accounts in Xero
  const hasLoanAccountType = transactions.some((tx: any) => {
    const accountType = (tx.account_type || tx.xero_account_type || '').toUpperCase()
    return LOAN_ACCOUNT_TYPES.some((loanType) => accountType.includes(loanType))
  })
  if (hasLoanAccountType) {
    score += 25
    signals.push('Posted to Current Asset/Liability account (loan-type account code)')
  }

  // Signal 3: Description keyword matching
  const allDescriptions = transactions
    .map((tx: any) => (tx.transaction_description || '').toLowerCase())
    .join(' ')
  const matchedKeywords = LOAN_CLASSIFICATION_KEYWORDS.filter((kw) =>
    allDescriptions.includes(kw)
  )
  if (matchedKeywords.length > 0) {
    score += Math.min(20, matchedKeywords.length * 7)
    signals.push(`Description keywords matched: ${matchedKeywords.join(', ')}`)
  }

  // Signal 4: Amount patterns - round numbers suggest loans (not invoices)
  const amounts = transactions.map((tx: any) =>
    Math.abs(parseFloat(tx.transaction_amount) || 0)
  )
  const roundNumberCount = amounts.filter((amt) => amt > 0 && amt % 100 === 0).length
  const roundNumberRatio = amounts.length > 0 ? roundNumberCount / amounts.length : 0
  if (roundNumberRatio >= 0.5) {
    score += 10
    signals.push(`Round number pattern: ${(roundNumberRatio * 100).toFixed(0)}% of amounts are round numbers`)
  }

  // Signal 5: Recurring regular amounts suggest structured loan repayments
  if (amounts.length >= 3) {
    const uniqueAmounts = new Set(amounts.map((a) => a.toFixed(2)))
    if (uniqueAmounts.size <= Math.ceil(amounts.length / 2)) {
      score += 10
      signals.push('Recurring regular amounts detected (structured repayment pattern)')
    }
  }

  // Signal 6: Account name contains loan-related terms
  const accountName = (transactions[0]?.account_name || '').toLowerCase()
  if (accountName.includes('loan') || accountName.includes('director') || accountName.includes('shareholder')) {
    score += 15
    signals.push(`Account name indicates loan: "${transactions[0]?.account_name}"`)
  }

  // Cap at 100
  const confidence = Math.min(100, score)

  // Add warning if confidence is low
  if (confidence < 60) {
    signals.push(
      'WARNING: Transaction requires manual verification - may not be a shareholder loan (s 109E ITAA 1936)'
    )
  }

  return { confidence, signals }
}

/**
 * Analyse a single shareholder loan for Division 7A compliance
 * (s 109D, s 109E, s 109N ITAA 1936)
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

  // Fix 4a: Determine opening balance from prior year data instead of hardcoded $0
  const { openingBalance, balanceSource, balanceNote } = await calculateOpeningBalance(
    supabase,
    tenantId,
    loan,
    financialYears,
    startYear
  )

  let advancesThisYear = 0
  let repaymentsThisYear = 0
  let interestCharged = 0

  transactions.forEach((tx: any) => {
    const amount = Math.abs(parseFloat(tx.transaction_amount) || 0)
    const description = (tx.transaction_description || '').toLowerCase()

    // Determine if advance or repayment (s 109D - payments/loans to shareholders)
    if (description.includes('loan') || description.includes('advance') || description.includes('payment to')) {
      advancesThisYear += amount
    } else if (description.includes('repayment') || description.includes('interest')) {
      repaymentsThisYear += amount

      if (description.includes('interest')) {
        interestCharged += amount
      }
    }
  })

  // Calculate closing balance
  const closingBalance = openingBalance + advancesThisYear - repaymentsThisYear

  // Calculate benchmark interest (s 109N ITAA 1936 - benchmark interest rate)
  const benchmarkInterestRate = await getBenchmarkRate(latestYear as string)
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

  // Fix 4b: Written agreement status is unknown until manually verified (s 109N ITAA 1936)
  const hasWrittenAgreement: boolean | 'unknown' = 'unknown'
  const writtenAgreementNote =
    'Written agreement status must be verified manually. ' +
    'Check company records for Division 7A compliant loan agreements (s 109N ITAA 1936). ' +
    'Both scenarios (with and without agreement) are presented below.'

  // Fix 4b: Build compliance issues WITHOUT assuming agreement status
  // Only flag interest and repayment shortfalls as definite issues
  const complianceIssues: string[] = []

  if (interestShortfall > MIN_REPAYMENT_THRESHOLD) {
    complianceIssues.push(`Interest shortfall: $${interestShortfall.toFixed(2)} (required: $${benchmarkInterestRequired.toFixed(2)}, charged: $${interestCharged.toFixed(2)})`)
  }

  if (repaymentShortfall > MIN_REPAYMENT_THRESHOLD) {
    complianceIssues.push(`Repayment shortfall: $${repaymentShortfall.toFixed(2)} (required: $${minimumRepaymentRequired.toFixed(2)}, actual: $${actualRepayment.toFixed(2)})`)
  }

  // Fix 4b: Scenario A - WITH written agreement (complying loan per s 109N)
  const scenarioWithAgreement = {
    minimumRepaymentRequired,
    benchmarkInterestRequired,
    isCompliant: complianceIssues.length === 0,
    complianceIssues: [...complianceIssues],
    note: 'If a complying Division 7A loan agreement exists (s 109N ITAA 1936): ' +
      'minimum yearly repayments and benchmark interest must be met. ' +
      `Benchmark rate: ${(benchmarkInterestRate * 100).toFixed(2)}% for ${latestYear || 'current FY'}.`,
  }

  // Fix 4b: Scenario B - WITHOUT written agreement (deemed dividend per s 109D)
  const scenarioWithoutAgreement = {
    deemedDividendAmount: Math.max(0, closingBalance),
    potentialTaxLiability: Math.max(0, closingBalance) * 0.47,
    note: 'Without a complying loan agreement, the entire outstanding loan balance ' +
      'is treated as a deemed dividend under s 109D ITAA 1936 and taxed at the ' +
      "shareholder's marginal rate in the year the loan was made.",
  }

  // For overall compliance flag, since agreement status is unknown we flag as non-compliant
  // if there are ANY issues (conservative approach, but with clear explanation)
  const hasComplianceRisks = complianceIssues.length > 0 || closingBalance > MIN_REPAYMENT_THRESHOLD
  const isCompliant = !hasComplianceRisks

  // Add agreement-unknown warning to compliance issues if balance is material
  if (closingBalance > MIN_REPAYMENT_THRESHOLD) {
    complianceIssues.push(
      'Written agreement status unknown - verify whether a complying Division 7A loan agreement exists (s 109N ITAA 1936)'
    )
  }

  // Calculate deemed dividend risk (worst case: no agreement)
  const deemedDividendRisk = isCompliant ? 0 : closingBalance

  // Fix 4c: Calculate tax scenarios at multiple marginal rate brackets
  const taxScenarios: TaxScenario[] = SHAREHOLDER_TAX_SCENARIOS.map((scenario) => ({
    label: scenario.label,
    rate: scenario.rate,
    description: scenario.description,
    taxLiability: deemedDividendRisk * scenario.rate,
  }))

  // Fix 4c: potentialTaxLiability uses 47% (maximum) for backward compatibility
  // but is now clearly labelled as worst-case estimate
  const potentialTaxLiability = deemedDividendRisk * 0.47
  const taxRateNote =
    'Maximum potential tax exposure calculated at 47% (45% top marginal rate + 2% Medicare Levy). ' +
    "Actual tax liability depends on the shareholder's total assessable income for the financial year. " +
    'See taxScenarios for impact at different tax brackets.'

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

  // Generate corrective actions (pass 'unknown' for agreement status)
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
    balanceSource,
    balanceNote,
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
    writtenAgreementNote,
    isCompliant,
    complianceIssues,
    deemedDividendRisk,
    potentialTaxLiability,
    taxScenarios,
    taxRateNote,
    riskLevel,
    scenarioWithAgreement,
    scenarioWithoutAgreement,
    classificationConfidence: loan.classificationConfidence,
    classificationSignals: loan.classificationSignals,
    recommendations,
    correctiveActions,
  }
}

/**
 * Fix 4a: Calculate the opening balance for a shareholder loan
 * by examining prior year transaction data.
 *
 * Instead of defaulting to $0 (which hides missing data), this function:
 * 1. Checks for prior FY transactions in forensic_analysis_results
 * 2. If found: calculates opening balance = prior advances - prior repayments
 * 3. If not found: returns 0 with balanceSource='unknown' and a verification note
 */
async function calculateOpeningBalance(
  supabase: any,
  tenantId: string,
  loan: ShareholderLoan,
  financialYears: string[],
  startYear?: string
): Promise<{ openingBalance: number; balanceSource: 'calculated' | 'unknown'; balanceNote: string }> {
  // Determine the earliest FY in the analysis range
  const earliestAnalysisYear = financialYears.length > 0 ? financialYears[0] : startYear

  if (!earliestAnalysisYear) {
    return {
      openingBalance: 0,
      balanceSource: 'unknown',
      balanceNote:
        'Opening balance unknown - no financial year data available. ' +
        'Manual verification required. Check prior year financial statements for outstanding shareholder loan balances.',
    }
  }

  // Calculate the prior FY (e.g., FY2023-24 -> FY2022-23)
  const priorYear = getPriorFinancialYear(earliestAnalysisYear)

  if (!priorYear) {
    return {
      openingBalance: 0,
      balanceSource: 'unknown',
      balanceNote:
        `Opening balance unknown - unable to determine prior year for ${earliestAnalysisYear}. ` +
        'Manual verification required. Check prior year financial statements for outstanding shareholder loan balances.',
    }
  }

  // Query for prior year transactions for this shareholder
  const { data: priorTransactions, error } = await supabase
    .from('forensic_analysis_results')
    .select('transaction_amount, transaction_description')
    .eq('tenant_id', tenantId)
    .ilike('supplier_name', `%${loan.shareholderName}%`)
    .eq('financial_year', priorYear)
    .order('transaction_date', { ascending: true })

  if (error || !priorTransactions || priorTransactions.length === 0) {
    return {
      openingBalance: 0,
      balanceSource: 'unknown',
      balanceNote:
        `Opening balance unknown - no prior year (${priorYear}) transaction data found for ${loan.shareholderName}. ` +
        'Manual verification required. Check prior year financial statements for outstanding shareholder loan balances.',
    }
  }

  // Calculate prior year net position: advances minus repayments
  let priorAdvances = 0
  let priorRepayments = 0

  priorTransactions.forEach((tx: any) => {
    const amount = Math.abs(parseFloat(tx.transaction_amount) || 0)
    const description = (tx.transaction_description || '').toLowerCase()

    if (description.includes('loan') || description.includes('advance') || description.includes('payment to')) {
      priorAdvances += amount
    } else if (description.includes('repayment') || description.includes('interest')) {
      priorRepayments += amount
    }
  })

  const calculatedBalance = priorAdvances - priorRepayments

  return {
    openingBalance: Math.max(0, calculatedBalance), // Loan balance cannot be negative
    balanceSource: 'calculated',
    balanceNote:
      `Opening balance calculated from ${priorYear} transaction data: ` +
      `$${priorAdvances.toFixed(2)} in advances - $${priorRepayments.toFixed(2)} in repayments. ` +
      'Note: This calculation is based on available transaction data only and may not reflect the full loan history. ' +
      'Verify against prior year financial statements for accuracy.',
  }
}

/**
 * Get the prior financial year string.
 * Delegates to shared utility in lib/utils/financial-year.ts
 */
function getPriorFinancialYear(financialYear: string): string | null {
  return sharedGetPriorFinancialYear(financialYear)
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
 * Generate corrective actions to achieve compliance (s 109N ITAA 1936)
 *
 * Fix 4b: Updated to handle 'unknown' written agreement status.
 * When status is unknown, actions include verification step first.
 */
function generateCorrectiveActions(
  loan: ShareholderLoan,
  hasWrittenAgreement: boolean | 'unknown',
  interestShortfall: number,
  repaymentShortfall: number
): string[] {
  const actions: string[] = []

  // Fix 4b: Handle tri-state agreement status
  if (hasWrittenAgreement === 'unknown') {
    actions.push('1. VERIFY: Check company records for existing Division 7A compliant loan agreement (s 109N ITAA 1936)')
    actions.push('   - A complying agreement must specify benchmark interest rate and repayment terms')
    actions.push('   - If no agreement exists, execute one immediately using ATO approved template')
    actions.push('   - Ensure signed by both company and shareholder')
    actions.push(`   - Specify term: ${loan.maxTermYears} years (${loan.loanType === 'secured' ? 'secured' : 'unsecured'})`)
  } else if (!hasWrittenAgreement) {
    actions.push('1. Execute complying Division 7A loan agreement immediately (s 109N ITAA 1936)')
    actions.push('   - Use ATO approved loan agreement template')
    actions.push('   - Ensure signed by both company and shareholder')
    actions.push(`   - Specify term: ${loan.maxTermYears} years (${loan.loanType === 'secured' ? 'secured' : 'unsecured'})`)
  }

  if (interestShortfall > MIN_REPAYMENT_THRESHOLD) {
    actions.push('2. Charge benchmark interest before lodgment day (s 109N ITAA 1936)')
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
/**
 * Calculate overall summary with provenance
 */
function calculateDiv7aSummary(
  loanAnalyses: Division7aAnalysis[],
  taxRateSource: string = 'none'
): Div7aSummary {
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
    taxRateSource,
    taxRateVerifiedAt: new Date().toISOString(),
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
    balanceSource: 'unknown',
    balanceNote: 'Opening balance unknown - insufficient transaction data. Manual verification required.',
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
    hasWrittenAgreement: 'unknown',
    writtenAgreementNote: 'Written agreement status unknown - insufficient data to determine. Manual verification required.',
    isCompliant: false,
    complianceIssues: ['Insufficient data to determine compliance'],
    deemedDividendRisk: 0,
    potentialTaxLiability: 0,
    taxScenarios: SHAREHOLDER_TAX_SCENARIOS.map((s) => ({
      label: s.label,
      rate: s.rate,
      description: s.description,
      taxLiability: 0,
    })),
    taxRateNote: 'No deemed dividend risk calculated - insufficient data.',
    riskLevel: 'medium',
    classificationConfidence: loan.classificationConfidence,
    classificationSignals: loan.classificationSignals,
    recommendations: ['Unable to analyse - insufficient transaction data'],
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
    taxRateSource: 'none',
    taxRateVerifiedAt: new Date().toISOString(),
  }
}

/**
 * Get Division 7A benchmark interest rate for a financial year
 */
export async function getBenchmarkRate(financialYear: string): Promise<number> {
  const currentFY = getCurrentFinancialYear()

  if (financialYear === currentFY) {
    try {
      const rates = await getCurrentTaxRates()
      if (rates.division7ABenchmarkRate) {
        return rates.division7ABenchmarkRate
      }
    } catch (err) {
      console.warn('Failed to fetch live Div7A rate, using fallback', err)
    }
  }

  return HISTORICAL_DIV7A_RATES[financialYear] || 0.0877 // Default to current year rate
}
