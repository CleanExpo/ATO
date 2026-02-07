/**
 * Australian Tax Bracket Data & Calculation Helpers
 *
 * All rates sourced from ITAA 1997 with financial year attribution.
 * Uses Decimal.js for precise monetary calculations.
 */

import { Decimal } from 'decimal.js'

export interface TaxBracket {
  /** Lower bound (inclusive) */
  min: number
  /** Upper bound (inclusive, Infinity for top bracket) */
  max: number
  /** Marginal rate as decimal (e.g., 0.30 = 30%) */
  rate: number
  /** Display label */
  label: string
  /** Legislative reference */
  legislativeRef: string
}

export interface TaxBracketSet {
  financialYear: string
  entityType: 'individual' | 'company_base' | 'company_standard'
  brackets: TaxBracket[]
  source: string
  sourceUrl: string
}

export interface TaxCalculation {
  grossIncome: number
  taxPayable: number
  effectiveRate: number
  marginalRate: number
  bracketBreakdown: {
    bracket: TaxBracket
    taxableInBracket: number
    taxOnBracket: number
  }[]
}

/**
 * Individual tax brackets FY2024-25
 * Source: ITAA 1997 Schedule 7, as amended by Treasury Laws Amendment
 * (Cost of Living Tax Cuts) Act 2024
 */
export const INDIVIDUAL_BRACKETS_FY2024_25: TaxBracketSet = {
  financialYear: 'FY2024-25',
  entityType: 'individual',
  brackets: [
    {
      min: 0,
      max: 18200,
      rate: 0,
      label: '$0 - $18,200',
      legislativeRef: 'ITAA 1997 Schedule 7 Part I',
    },
    {
      min: 18201,
      max: 45000,
      rate: 0.16,
      label: '$18,201 - $45,000',
      legislativeRef: 'ITAA 1997 Schedule 7 Part I',
    },
    {
      min: 45001,
      max: 135000,
      rate: 0.30,
      label: '$45,001 - $135,000',
      legislativeRef: 'ITAA 1997 Schedule 7 Part I',
    },
    {
      min: 135001,
      max: 190000,
      rate: 0.37,
      label: '$135,001 - $190,000',
      legislativeRef: 'ITAA 1997 Schedule 7 Part I',
    },
    {
      min: 190001,
      max: Infinity,
      rate: 0.45,
      label: '$190,001+',
      legislativeRef: 'ITAA 1997 Schedule 7 Part I',
    },
  ],
  source: 'ATO - Tax rates for Australian residents',
  sourceUrl: 'https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents',
}

/**
 * Company tax rates FY2024-25
 * Base rate: 25% (aggregated turnover < $50M, <= 80% base rate entity passive income)
 * Standard rate: 30%
 */
export const COMPANY_RATES_FY2024_25 = {
  financialYear: 'FY2024-25',
  baseRate: {
    rate: 0.25,
    label: 'Base rate entity (25%)',
    turnoverThreshold: 50_000_000,
    passiveIncomeThreshold: 0.80,
    legislativeRef: 'ITAA 1997 s 23AA',
  },
  standardRate: {
    rate: 0.30,
    label: 'Standard rate (30%)',
    legislativeRef: 'ITAA 1997 s 23',
  },
  source: 'ATO - Company tax rates',
  sourceUrl: 'https://www.ato.gov.au/tax-rates-and-codes/company-tax-rates',
}

/**
 * CGT discount rates
 */
export const CGT_DISCOUNTS = {
  financialYear: 'FY2024-25',
  individual: {
    rate: 0.50,
    label: '50% discount',
    holdingPeriodMonths: 12,
    legislativeRef: 'ITAA 1997 Division 115',
  },
  superFund: {
    rate: 1 / 3,
    label: '33.33% discount',
    holdingPeriodMonths: 12,
    legislativeRef: 'ITAA 1997 Division 115',
  },
  company: {
    rate: 0,
    label: 'No discount',
    holdingPeriodMonths: 0,
    legislativeRef: 'ITAA 1997 s 115-10',
  },
  source: 'ATO - CGT discount',
  sourceUrl: 'https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/cgt-discount',
}

/**
 * Calculate tax payable for a given income using progressive brackets
 */
export function calculateTax(income: number, bracketSet: TaxBracketSet): TaxCalculation {
  const grossIncome = Math.max(0, income)
  let remaining = new Decimal(grossIncome)
  let totalTax = new Decimal(0)
  const breakdown: TaxCalculation['bracketBreakdown'] = []

  for (const bracket of bracketSet.brackets) {
    if (remaining.lte(0)) {
      breakdown.push({ bracket, taxableInBracket: 0, taxOnBracket: 0 })
      continue
    }

    const bracketMin = new Decimal(bracket.min === 0 ? 0 : bracket.min - 1)
    const bracketMax = bracket.max === Infinity
      ? remaining.plus(bracketMin)
      : new Decimal(bracket.max)
    const bracketWidth = bracketMax.minus(bracketMin.gt(0) ? bracketMin : 0)

    const taxableInBracket = Decimal.min(remaining, bracketWidth)
    const taxOnBracket = taxableInBracket.times(bracket.rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

    breakdown.push({
      bracket,
      taxableInBracket: taxableInBracket.toNumber(),
      taxOnBracket: taxOnBracket.toNumber(),
    })

    totalTax = totalTax.plus(taxOnBracket)
    remaining = remaining.minus(taxableInBracket)
  }

  const taxPayable = totalTax.toNumber()
  const effectiveRate = grossIncome > 0 ? totalTax.div(grossIncome).times(100).toDecimalPlaces(2).toNumber() : 0
  const marginalRate = grossIncome > 0
    ? (bracketSet.brackets.find(b => grossIncome >= b.min && grossIncome <= b.max)?.rate ?? 0) * 100
    : 0

  return {
    grossIncome,
    taxPayable,
    effectiveRate,
    marginalRate,
    bracketBreakdown: breakdown,
  }
}

/**
 * Generate chart data for tax bracket waterfall
 */
export function generateWaterfallData(bracketSet: TaxBracketSet): {
  name: string
  rate: number
  rangeLabel: string
  taxOnBracket: number
  cumulativeTax: number
  effectiveRate: number
}[] {
  let cumulativeTax = 0
  let cumulativeIncome = 0

  return bracketSet.brackets.map((bracket) => {
    const bracketWidth = bracket.max === Infinity ? 100000 : bracket.max - (bracket.min === 0 ? 0 : bracket.min - 1)
    const taxOnBracket = new Decimal(bracketWidth).times(bracket.rate).toDecimalPlaces(2).toNumber()

    cumulativeTax += taxOnBracket
    cumulativeIncome += bracketWidth
    const effectiveRate = cumulativeIncome > 0
      ? new Decimal(cumulativeTax).div(cumulativeIncome).times(100).toDecimalPlaces(1).toNumber()
      : 0

    return {
      name: `${(bracket.rate * 100).toFixed(0)}%`,
      rate: bracket.rate * 100,
      rangeLabel: bracket.label,
      taxOnBracket,
      cumulativeTax,
      effectiveRate,
    }
  })
}
