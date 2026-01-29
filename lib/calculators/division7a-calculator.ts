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
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'

// Benchmark interest rate for FY2024-25 (Section 109N ITAA 1936) - FALLBACK
const FALLBACK_DIV7A_BENCHMARK_RATE = new Decimal('0.0877') // 8.77%

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
  taxRateSource?: string
}

/**
 * Calculate Division 7A minimum yearly repayment schedule
 */
export async function calculateDiv7ARepayments(loan: Div7ALoan): Promise<Div7ACalculation> {
  const warnings: string[] = []
  const recommendations: string[] = []

  // Fetch live rate
  let liveRate = FALLBACK_DIV7A_BENCHMARK_RATE
  let rateSource = 'ATO_FALLBACK'
  try {
    const rates = await getCurrentTaxRates()
    if (rates.division7ABenchmarkRate) {
      liveRate = new Decimal(rates.division7ABenchmarkRate)
      rateSource = rates.sources.division7A || 'ATO.gov.au'
    }
  } catch (err) {
    console.warn('Failed to fetch live Div7A rate, using fallback', err)
  }

  // Determine loan term
  const loanTerm = loan.isSecured ? 25 : 7

  // Use provided interest rate or benchmark
  const interestRate = loan.interestRate
    ? new Decimal(loan.interestRate)
    : liveRate

  // Validate interest rate
  if (loan.interestRate && loan.interestRate < liveRate.toNumber()) {
    warnings.push(
      `Interest rate ${(loan.interestRate * 100).toFixed(2)}% is below benchmark rate ${(liveRate.toNumber() * 100).toFixed(2)}%. This may result in deemed dividend.`
    )
    recommendations.push(
      `Increase interest rate to at least ${(liveRate.toNumber() * 100).toFixed(2)}% to avoid Division 7A issues.`
    )
  }

  // Calculate minimum yearly repayment using amortization formula
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
    if (balance.lessThanOrEqualTo(0)) break
  }

  // Add recommendations based on loan structure
  if (!loan.isSecured && loan.loanAmount > 100000) {
    recommendations.push(
      'Consider securing this loan with a registered mortgage to extend the repayment term from 7 to 25 years.'
    )
  }

  return {
    loanDetails: loan,
    benchmarkRate: liveRate.toNumber(),
    loanTerm,
    totalInterest: totalInterest.toNumber(),
    totalRepayments: minimumYearlyRepayment.times(schedule.length).toNumber(),
    repaymentSchedule: schedule,
    warnings,
    recommendations,
    taxRateSource: rateSource
  }
}

/**
 * Calculate if a loan arrangement complies with Division 7A
 */
export async function checkDiv7ACompliance(
  loan: Div7ALoan,
  actualRepayments: Array<{ date: string; amount: number }>
): Promise<{
  compliant: boolean
  issues: string[]
  shortfall: number
  recommendations: string[]
}> {
  const calculation = await calculateDiv7ARepayments(loan)
  const issues: string[] = []
  const recommendations: string[] = []
  let totalShortfall = 0

  actualRepayments.forEach((repayment, index) => {
    const expectedMinimum = calculation.repaymentSchedule[index]?.minimumRepayment || 0
    if (repayment.amount < expectedMinimum) {
      const shortfall = expectedMinimum - repayment.amount
      totalShortfall += shortfall
      issues.push(
        `Year ${index + 1}: Repayment $${repayment.amount.toFixed(2)} is below minimum $${expectedMinimum.toFixed(2)}`
      )
    }
  })

  if (loan.interestRate && loan.interestRate < calculation.benchmarkRate) {
    issues.push(
      `Interest rate ${(loan.interestRate * 100).toFixed(2)}% is below benchmark rate ${(calculation.benchmarkRate * 100).toFixed(2)}%`
    )
  }

  if (totalShortfall > 0) {
    recommendations.push(`Make additional repayment of $${totalShortfall.toFixed(2)} before lodgement day.`)
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
export async function compareLoanOptions(loanAmount: number): Promise<{
  unsecured: Div7ACalculation
  secured: Div7ACalculation
  savings: {
    yearlyRepaymentReduction: number
    totalInterestDifference: number
    extendedYears: number
  }
}> {
  const [unsecured, secured] = await Promise.all([
    calculateDiv7ARepayments({ loanAmount, loanDate: new Date().toISOString(), isSecured: false }),
    calculateDiv7ARepayments({ loanAmount, loanDate: new Date().toISOString(), isSecured: true })
  ])

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
      extendedYears: 18,
    },
  }
}

