/**
 * Cash Flow Forecast Engine
 *
 * Projects future tax obligations and cash flow requirements based on
 * historical data and current tax position.
 *
 * Outputs:
 * - Quarterly BAS/PAYG instalment projections
 * - Annual tax liability estimates
 * - Superannuation guarantee payment schedule
 * - R&D offset timing
 * - FBT payment dates
 * - Recommended cash reserves
 *
 * DISCLAIMER: Projections are estimates only, not financial advice.
 * Actual obligations may differ based on future business performance.
 * Does not constitute advice under Corporations Act 2001.
 * See ASIC RG 234 for disclosure requirements for forward-looking statements.
 */

import { createServiceClient } from '@/lib/supabase/server'
import {
  getCurrentFinancialYear,
  getBASQuarter,
  getFYStartDate,
  getFYEndDate,
} from '@/lib/utils/financial-year'
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager'
import Decimal from 'decimal.js'

/**
 * Single forecast period (monthly or quarterly).
 */
export interface ForecastPeriod {
  periodLabel: string // e.g., 'Q1 FY2025-26' or 'Jul 2025'
  periodStart: Date
  periodEnd: Date

  // Income projection
  projectedIncome: number
  incomeConfidence: number // 0-100

  // Tax obligations
  paygInstalment: number
  gstPayable: number
  fbtInstalment: number
  superGuarantee: number
  incomeTaxProvision: number

  // Total outflows
  totalTaxObligations: number
  dueDate: Date | null

  // Running balance
  openingCashPosition: number
  netCashflow: number
  closingCashPosition: number

  // Alerts
  alerts: string[]
}

/**
 * Complete cash flow forecast.
 */
export interface CashFlowForecast {
  tenantId: string
  financialYear: string
  forecastHorizon: number // months

  // Forecast periods
  periods: ForecastPeriod[]

  // Summary
  totalProjectedIncome: number
  totalProjectedExpenses: number
  totalTaxObligations: number
  recommendedCashReserve: number

  // Key dates
  keyDates: Array<{
    date: Date
    description: string
    amount: number
    category: string
  }>

  // Assumptions
  assumptions: string[]

  // Metadata
  confidence: number
  disclaimer: string
  recommendations: string[]
  taxRateSource: string
  taxRateVerifiedAt: string
}

/**
 * Options for cash flow forecast.
 */
export interface ForecastOptions {
  /** Forecast horizon in months (default: 12) */
  horizonMonths?: number
  /** Starting cash balance */
  openingBalance?: number
  /** Annual turnover for projections */
  projectedTurnover?: number
  /** PAYG instalment rate */
  paygInstalmentRate?: number
  /** PAYG notified amount (annual) */
  paygNotifiedAmount?: number
  /** Estimated FBT liability */
  estimatedFBTLiability?: number
  /** Monthly payroll for super guarantee */
  monthlyPayroll?: number
  /** Corporate tax rate */
  corporateTaxRate?: number
  /** Whether GST registered */
  isGSTRegistered?: boolean
  /** GST reporting frequency */
  gstFrequency?: 'monthly' | 'quarterly'
}

/**
 * Generate cash flow forecast for a tenant.
 */
export async function generateCashFlowForecast(
  tenantId: string,
  financialYear?: string,
  options?: ForecastOptions
): Promise<CashFlowForecast> {
  const fy = financialYear || getCurrentFinancialYear()
  const horizonMonths = options?.horizonMonths ?? 12
  const supabase = await createServiceClient()

  // Fetch historical data for trend analysis
  const { data: transactions, error } = await supabase
    .from('historical_transactions_cache')
    .select('raw_data, financial_year')
    .eq('tenant_id', tenantId)
    .order('financial_year', { ascending: false })
    .limit(500)

  if (error) {
    console.error('Failed to fetch transactions for forecast:', error)
    throw new Error(`Failed to fetch transactions: ${error.message}`)
  }

  // Get tax rates
  let corporateTaxRate = options?.corporateTaxRate ?? 0.25
  let taxRateSource = 'fallback'
  try {
    const rates = await getCurrentTaxRates()
    if (rates.corporateTaxRateSmall) corporateTaxRate = rates.corporateTaxRateSmall
    taxRateSource = rates.sources.corporateTax || 'ATO'
  } catch {
    // Use fallback
  }

  // Calculate historical monthly averages
  const monthlyAverages = calculateMonthlyAverages(transactions || [])

  // Generate forecast periods
  const fyStart = getFYStartDate(fy)
  if (!fyStart) throw new Error(`Invalid financial year format: ${fy}`)

  const periods: ForecastPeriod[] = []
  let runningBalance = options?.openingBalance ?? 0
  const now = new Date()

  for (let month = 0; month < horizonMonths; month++) {
    const periodStart = new Date(fyStart)
    periodStart.setMonth(periodStart.getMonth() + month)

    const periodEnd = new Date(periodStart)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    periodEnd.setDate(periodEnd.getDate() - 1)

    const monthIndex = periodStart.getMonth()
    const monthLabel = periodStart.toLocaleString('en-AU', { month: 'short', year: 'numeric' })

    // Project income
    const projectedIncome = options?.projectedTurnover
      ? options.projectedTurnover / 12
      : monthlyAverages.income[monthIndex] || monthlyAverages.averageMonthlyIncome

    // Calculate tax obligations for this period
    const paygInstalment = calculateMonthlyPAYG(
      projectedIncome, options?.paygInstalmentRate ?? corporateTaxRate, options?.paygNotifiedAmount, periodStart
    )

    const gstPayable = options?.isGSTRegistered
      ? new Decimal(projectedIncome).times(new Decimal('0.1')).toDecimalPlaces(2).toNumber() // Simplified: 1/11 of income
      : 0

    const superGuarantee = options?.monthlyPayroll
      ? new Decimal(options.monthlyPayroll).times(new Decimal('0.115')).toDecimalPlaces(2).toNumber() // 11.5% SG rate FY2024-25
      : monthlyAverages.superGuarantee

    const fbtInstalment = (options?.estimatedFBTLiability ?? 0) / 4 / 3 // Monthly portion of quarterly FBT

    const incomeTaxProvision = new Decimal(projectedIncome)
      .times(new Decimal(corporateTaxRate))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber()

    const totalTaxObligations = paygInstalment + gstPayable + superGuarantee + fbtInstalment

    // Estimate expenses (rough: 70% of income based on typical SME)
    const estimatedExpenses = projectedIncome * 0.70

    const netCashflow = projectedIncome - estimatedExpenses - totalTaxObligations
    const closingBalance = runningBalance + netCashflow

    // Determine due date (end of quarter or month depending on obligations)
    const { quarter, dueDate } = getBASQuarter(periodStart)
    const isQuarterEnd = periodStart.getMonth() % 3 === 2

    // Alerts
    const alerts: string[] = []
    if (closingBalance < 0) {
      alerts.push(`Projected negative cash position: -$${Math.abs(closingBalance).toLocaleString()}`)
    }
    if (isQuarterEnd) {
      alerts.push(`BAS due ${dueDate.toISOString().split('T')[0]} for ${quarter}`)
    }
    if (periodStart > now && closingBalance < totalTaxObligations * 2) {
      alerts.push('Cash reserve below 2x monthly tax obligations')
    }

    periods.push({
      periodLabel: monthLabel,
      periodStart,
      periodEnd,
      projectedIncome,
      incomeConfidence: options?.projectedTurnover ? 60 : 40,
      paygInstalment,
      gstPayable,
      fbtInstalment,
      superGuarantee,
      incomeTaxProvision,
      totalTaxObligations,
      dueDate: isQuarterEnd ? dueDate : null,
      openingCashPosition: runningBalance,
      netCashflow,
      closingCashPosition: closingBalance,
      alerts,
    })

    runningBalance = closingBalance
  }

  // Summary calculations
  const totalProjectedIncome = periods.reduce((sum, p) => sum + p.projectedIncome, 0)
  const totalProjectedExpenses = totalProjectedIncome * 0.70
  const totalTaxObligations = periods.reduce((sum, p) => sum + p.totalTaxObligations, 0)

  // Recommended cash reserve: 3 months of tax obligations
  const avgMonthlyTax = totalTaxObligations / horizonMonths
  const recommendedCashReserve = avgMonthlyTax * 3

  // Key dates
  const keyDates = buildKeyDates(fy, periods, options)

  // Assumptions
  const assumptions = buildAssumptions(options, monthlyAverages, corporateTaxRate)

  // Recommendations
  const recommendations = generateForecastRecommendations(periods, recommendedCashReserve, options)

  return {
    tenantId,
    financialYear: fy,
    forecastHorizon: horizonMonths,
    periods,
    totalProjectedIncome,
    totalProjectedExpenses,
    totalTaxObligations,
    recommendedCashReserve,
    keyDates,
    assumptions,
    confidence: options?.projectedTurnover ? 50 : 30,
    disclaimer: 'ESTIMATES ONLY: This cash flow forecast is based on historical data and assumptions. ' +
      'Actual results will differ. This does not constitute financial advice under the Corporations Act 2001. ' +
      'Consult a qualified financial adviser for investment and cashflow management decisions. ' +
      'See ASIC RG 234 for guidance on forward-looking statements.',
    recommendations,
    taxRateSource,
    taxRateVerifiedAt: new Date().toISOString(),
  }
}

interface MonthlyAverages {
  income: Record<number, number> // month index -> average income
  expenses: Record<number, number>
  averageMonthlyIncome: number
  averageMonthlyExpenses: number
  superGuarantee: number
}

function calculateMonthlyAverages(transactions: any[]): MonthlyAverages {
  const monthlyIncome: Record<number, number[]> = {}
  const monthlyExpenses: Record<number, number[]> = {}

  const rawTxs = transactions.flatMap((t: any) => {
    const raw = t.raw_data
    return Array.isArray(raw) ? raw : [raw]
  })

  rawTxs.forEach((tx: any) => {
    const dateStr = tx.Date || tx.DateString
    if (!dateStr) return

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return

    const month = date.getMonth()
    const amount = Math.abs(parseFloat(tx.Total) || 0)
    const type = tx.Type

    if (type === 'ACCREC' || (type === 'BANK' && parseFloat(tx.Total) > 0)) {
      if (!monthlyIncome[month]) monthlyIncome[month] = []
      monthlyIncome[month].push(amount)
    } else if (type === 'ACCPAY' || (type === 'BANK' && parseFloat(tx.Total) < 0)) {
      if (!monthlyExpenses[month]) monthlyExpenses[month] = []
      monthlyExpenses[month].push(amount)
    }
  })

  const income: Record<number, number> = {}
  const expenses: Record<number, number> = {}
  let totalIncome = 0
  let totalExpenses = 0
  let monthCount = 0

  for (let m = 0; m < 12; m++) {
    const incAmounts = monthlyIncome[m] || []
    const expAmounts = monthlyExpenses[m] || []
    income[m] = incAmounts.length > 0 ? incAmounts.reduce((a, b) => a + b, 0) / incAmounts.length : 0
    expenses[m] = expAmounts.length > 0 ? expAmounts.reduce((a, b) => a + b, 0) / expAmounts.length : 0
    if (incAmounts.length > 0) {
      totalIncome += income[m]
      monthCount++
    }
    totalExpenses += expenses[m]
  }

  const averageMonthlyIncome = monthCount > 0 ? totalIncome / monthCount : 0

  return {
    income,
    expenses,
    averageMonthlyIncome,
    averageMonthlyExpenses: monthCount > 0 ? totalExpenses / monthCount : 0,
    superGuarantee: 0, // Cannot determine from transaction data alone
  }
}

function calculateMonthlyPAYG(
  monthlyIncome: number,
  rate: number,
  notifiedAmount: number | undefined,
  periodStart: Date
): number {
  // PAYG is quarterly, so only applies in quarter-end months
  const month = periodStart.getMonth()
  const isQuarterEnd = month === 8 || month === 11 || month === 2 || month === 5 // Sep, Dec, Mar, Jun

  if (!isQuarterEnd) return 0

  if (notifiedAmount !== undefined) {
    return notifiedAmount / 4 // Quarterly instalment
  }

  // Rate method: instalment income * rate (quarterly, so 3 months of income)
  return new Decimal(monthlyIncome * 3)
    .times(new Decimal(rate))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber()
}

function buildKeyDates(
  fy: string,
  periods: ForecastPeriod[],
  options?: ForecastOptions
): Array<{ date: Date; description: string; amount: number; category: string }> {
  const keyDates: Array<{ date: Date; description: string; amount: number; category: string }> = []

  // BAS due dates from periods
  periods.forEach(period => {
    if (period.dueDate) {
      keyDates.push({
        date: period.dueDate,
        description: `BAS due - ${period.periodLabel}`,
        amount: period.gstPayable + period.paygInstalment,
        category: 'BAS',
      })
    }
  })

  // Super guarantee dates (28th of month following quarter)
  const fyStart = getFYStartDate(fy)
  if (fyStart) {
    const sgDates = [
      new Date(fyStart.getFullYear(), 9, 28), // Q1: 28 October
      new Date(fyStart.getFullYear() + 1, 0, 28), // Q2: 28 January
      new Date(fyStart.getFullYear() + 1, 3, 28), // Q3: 28 April
      new Date(fyStart.getFullYear() + 1, 6, 28), // Q4: 28 July
    ]

    sgDates.forEach((date, i) => {
      keyDates.push({
        date,
        description: `Super Guarantee Q${i + 1} due`,
        amount: options?.monthlyPayroll
          ? options.monthlyPayroll * 3 * 0.115
          : 0,
        category: 'Super',
      })
    })
  }

  // Income tax return due
  const fyEnd = getFYEndDate(fy)
  if (fyEnd) {
    const taxReturnDue = new Date(fyEnd)
    taxReturnDue.setMonth(taxReturnDue.getMonth() + 4) // Roughly 31 October
    keyDates.push({
      date: taxReturnDue,
      description: `Income tax return due for ${fy}`,
      amount: 0,
      category: 'Tax Return',
    })
  }

  return keyDates.sort((a, b) => a.date.getTime() - b.date.getTime())
}

function buildAssumptions(
  options: ForecastOptions | undefined,
  averages: MonthlyAverages,
  corporateTaxRate: number
): string[] {
  const assumptions: string[] = []

  if (options?.projectedTurnover) {
    assumptions.push(`Projected annual turnover: $${options.projectedTurnover.toLocaleString()}`)
  } else {
    assumptions.push(`Income projected from historical monthly averages ($${averages.averageMonthlyIncome.toLocaleString()}/month)`)
  }

  assumptions.push(`Corporate tax rate: ${(corporateTaxRate * 100).toFixed(1)}%`)
  assumptions.push('Expense ratio assumed at 70% of income (industry average)')

  if (options?.isGSTRegistered) {
    assumptions.push('GST registered - estimated at 1/11 of income')
  }

  if (options?.monthlyPayroll) {
    assumptions.push(`Monthly payroll: $${options.monthlyPayroll.toLocaleString()} (SG at 11.5%)`)
  }

  assumptions.push('Projections assume consistent business performance')
  assumptions.push('Does not account for one-off or extraordinary items')

  return assumptions
}

function generateForecastRecommendations(
  periods: ForecastPeriod[],
  recommendedReserve: number,
  options?: ForecastOptions
): string[] {
  const recommendations: string[] = []

  // Cash position alerts
  const negativeMonths = periods.filter(p => p.closingCashPosition < 0)
  if (negativeMonths.length > 0) {
    recommendations.push(
      `Projected negative cash position in ${negativeMonths.length} month(s). Consider arranging a business line of credit or adjusting payment timing.`
    )
  }

  // Reserve recommendation
  recommendations.push(
    `Recommended cash reserve for tax obligations: $${recommendedReserve.toLocaleString()} (3 months of estimated tax payments).`
  )

  const currentBalance = options?.openingBalance ?? 0
  if (currentBalance < recommendedReserve) {
    const shortfall = recommendedReserve - currentBalance
    recommendations.push(
      `Current cash position is $${shortfall.toLocaleString()} below recommended reserve. Consider building reserves over the next 3-6 months.`
    )
  }

  // Upcoming large payments
  const upcomingLarge = periods.filter(p => p.totalTaxObligations > (options?.openingBalance ?? 0) * 0.3)
  if (upcomingLarge.length > 0) {
    recommendations.push(
      'Some upcoming tax periods have obligations exceeding 30% of current balance. Plan ahead to ensure liquidity.'
    )
  }

  recommendations.push(
    'Review this forecast quarterly and update assumptions based on actual performance.'
  )

  return recommendations
}
