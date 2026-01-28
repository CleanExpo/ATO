/**
 * Division 7A Loan Calculator
 *
 * Calculates minimum yearly repayments and interest for loans under Division 7A ITAA 1936
 *
 * Key Rules:
 * - Loans must be repaid within 7 years (unsecured) or 25 years (secured by mortgage)
 * - Minimum yearly repayment required to avoid deemed dividend
 * - Interest must be charged at benchmark rate (8.77% for FY2024-25)
 * - Repayment must be made by lodgement day
 */

import Decimal from 'decimal.js'

// Benchmark interest rate for FY2024-25 (Section 109N ITAA 1936)
const DIV7A_BENCHMARK_RATE = new Decimal('0.0877') // 8.77%

export interface Div7ALoan {
  loanAmount: number
  loanDate: string // ISO date
  isSecured: boolean // Secured by registered mortgage over real property
  interestRate?: number // If not provided, uses benchmark rate
}

export interface Div7ARepayment {
  year: number
  financialYear: string
  openingBalance: number
  minimumRepayment: number
  principalComponent: number
  interestComponent: number
  closingBalance: number
  deemedDividendRisk: number // Amount that would be deemed dividend if minimum not paid
}

export interface Div7ACalculation {
  loanDetails: Div7ALoan
  benchmarkRate: number
  loanTerm: number // 7 or 25 years
  totalInterest: number
  totalRepayments: number
  repaymentSchedule: Div7ARepayment[]
  warnings: string[]
  recommendations: string[]
}

/**
 * Calculate Division 7A minimum yearly repayment schedule
 */
export function calculateDiv7ARepayments(loan: Div7ALoan): Div7ACalculation {
  const warnings: string[] = []
  const recommendations: string[] = []

  // Determine loan term
  const loanTerm = loan.isSecured ? 25 : 7

  // Use provided interest rate or benchmark
  const interestRate = loan.interestRate
    ? new Decimal(loan.interestRate)
    : DIV7A_BENCHMARK_RATE

  // Validate interest rate
  if (loan.interestRate && loan.interestRate < DIV7A_BENCHMARK_RATE.toNumber()) {
    warnings.push(
      `Interest rate ${(loan.interestRate * 100).toFixed(2)}% is below benchmark rate ${(DIV7A_BENCHMARK_RATE.toNumber() * 100).toFixed(2)}%. This may result in deemed dividend.`
    )
    recommendations.push(
      `Increase interest rate to at least ${(DIV7A_BENCHMARK_RATE.toNumber() * 100).toFixed(2)}% to avoid Division 7A issues.`
    )
  }

  // Calculate minimum yearly repayment using amortization formula
  // PMT = P × [r(1 + r)^n] / [(1 + r)^n - 1]
  const principal = new Decimal(loan.loanAmount)
  const rate = interestRate
  const n = loanTerm

  const onePlusR = new Decimal(1).plus(rate)
  const onePlusRPowN = onePlusR.pow(n)

  const minimumYearlyRepayment = principal
    .times(rate.times(onePlusRPowN))
    .dividedBy(onePlusRPowN.minus(1))
    .toDecimalPlaces(2, Decimal.ROUND_UP) // Round up to ensure compliance

  // Generate repayment schedule
  const schedule: Div7ARepayment[] = []
  let balance = principal
  const loanYear = new Date(loan.loanDate).getFullYear()
  let totalInterest = new Decimal(0)

  for (let year = 1; year <= loanTerm; year++) {
    const openingBalance = balance
    const interestComponent = balance.times(rate).toDecimalPlaces(2, Decimal.ROUND_UP)
    const principalComponent = minimumYearlyRepayment.minus(interestComponent)
    const closingBalance = balance.minus(principalComponent)

    totalInterest = totalInterest.plus(interestComponent)

    // Calculate deemed dividend risk (what would be deemed if minimum not paid)
    const deemedDividendRisk = minimumYearlyRepayment

    schedule.push({
      year,
      financialYear: `FY${loanYear + year - 1}-${String(loanYear + year).slice(-2)}`,
      openingBalance: openingBalance.toNumber(),
      minimumRepayment: minimumYearlyRepayment.toNumber(),
      principalComponent: principalComponent.toNumber(),
      interestComponent: interestComponent.toNumber(),
      closingBalance: Math.max(0, closingBalance.toNumber()),
      deemedDividendRisk: deemedDividendRisk.toNumber(),
    })

    balance = closingBalance

    // Stop if loan is fully repaid
    if (balance.lessThanOrEqualTo(0)) {
      break
    }
  }

  // Add recommendations based on loan structure
  if (!loan.isSecured && loan.loanAmount > 100000) {
    recommendations.push(
      'Consider securing this loan with a registered mortgage to extend the repayment term from 7 to 25 years, reducing the minimum yearly repayment.'
    )
  }

  if (schedule.length > 0 && schedule[0].minimumRepayment > loan.loanAmount * 0.2) {
    recommendations.push(
      'The minimum yearly repayment is high relative to the loan amount. Consider restructuring or increasing shareholder salary to reduce the loan.'
    )
  }

  // Check if repayment schedule will fully repay the loan
  const finalBalance = schedule[schedule.length - 1]?.closingBalance || 0
  if (finalBalance > 1) {
    warnings.push(
      `Loan will not be fully repaid after ${loanTerm} years. Final balance: $${finalBalance.toFixed(2)}. This may result in deemed dividend.`
    )
  }

  return {
    loanDetails: loan,
    benchmarkRate: DIV7A_BENCHMARK_RATE.toNumber(),
    loanTerm,
    totalInterest: totalInterest.toNumber(),
    totalRepayments: minimumYearlyRepayment.times(schedule.length).toNumber(),
    repaymentSchedule: schedule,
    warnings,
    recommendations,
  }
}

/**
 * Calculate if a loan arrangement complies with Division 7A
 */
export function checkDiv7ACompliance(
  loan: Div7ALoan,
  actualRepayments: Array<{ date: string; amount: number }>
): {
  compliant: boolean
  issues: string[]
  shortfall: number
  recommendations: string[]
} {
  const calculation = calculateDiv7ARepayments(loan)
  const issues: string[] = []
  const recommendations: string[] = []
  let totalShortfall = 0

  // Check if actual repayments meet minimum requirements
  actualRepayments.forEach((repayment, index) => {
    const expectedMinimum = calculation.repaymentSchedule[index]?.minimumRepayment || 0

    if (repayment.amount < expectedMinimum) {
      const shortfall = expectedMinimum - repayment.amount
      totalShortfall += shortfall
      issues.push(
        `Year ${index + 1}: Repayment of $${repayment.amount.toFixed(2)} is below minimum required $${expectedMinimum.toFixed(2)} (shortfall: $${shortfall.toFixed(2)})`
      )
    }
  })

  // Check interest rate
  if (loan.interestRate && loan.interestRate < DIV7A_BENCHMARK_RATE.toNumber()) {
    issues.push(
      `Interest rate of ${(loan.interestRate * 100).toFixed(2)}% is below the benchmark rate of ${(DIV7A_BENCHMARK_RATE.toNumber() * 100).toFixed(2)}%`
    )
  }

  // Generate recommendations
  if (totalShortfall > 0) {
    recommendations.push(
      `Make an additional repayment of $${totalShortfall.toFixed(2)} before lodgement day to avoid deemed dividend.`
    )
    recommendations.push(
      'Consider setting up automatic monthly repayments to ensure minimum requirements are met.'
    )
  }

  if (issues.length === 0) {
    recommendations.push(
      'Loan is currently compliant with Division 7A. Ensure minimum repayments continue each year.'
    )
  }

  return {
    compliant: issues.length === 0,
    issues,
    shortfall: totalShortfall,
    recommendations,
  }
}

/**
 * Compare loan restructuring options
 */
export function compareLoanOptions(loanAmount: number): {
  unsecured: Div7ACalculation
  secured: Div7ACalculation
  savings: {
    yearlyRepaymentReduction: number
    totalInterestDifference: number
    extendedYears: number
  }
} {
  const unsecured = calculateDiv7ARepayments({
    loanAmount,
    loanDate: new Date().toISOString(),
    isSecured: false,
  })

  const secured = calculateDiv7ARepayments({
    loanAmount,
    loanDate: new Date().toISOString(),
    isSecured: true,
  })

  const yearlyReduction =
    unsecured.repaymentSchedule[0].minimumRepayment -
    secured.repaymentSchedule[0].minimumRepayment

  const interestDifference = secured.totalInterest - unsecured.totalInterest

  return {
    unsecured,
    secured,
    savings: {
      yearlyRepaymentReduction: yearlyReduction,
      totalInterestDifference: interestDifference,
      extendedYears: 18, // 25 - 7
    },
  }
}
