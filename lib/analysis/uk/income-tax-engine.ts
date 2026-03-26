/**
 * UK Income Tax Analysis Engine
 *
 * Calculates income tax liability for individuals and sole traders
 * in the United Kingdom, including Personal Allowance taper,
 * Scottish rate variations, dividend tax, and special allowances.
 *
 * Key Legislation:
 * - Income Tax Act 2007 (ITA 2007)
 * - Income Tax (Earnings and Pensions) Act 2003 (ITEPA 2003)
 * - Income Tax (Trading and Other Income) Act 2005 (ITTOIA 2005)
 * - Scotland Act 2016 — Scottish rate of income tax (SRIT)
 *
 * Tax Year: 6 April to 5 April (HMRC year)
 */

import Decimal from 'decimal.js'
import { BaseTaxEngine } from '@/lib/analysis/base-engine'
import type { EngineResult, EngineOptions } from '@/lib/analysis/base-engine'
import type { TaxBracket } from '@/lib/types/jurisdiction'
import { createLogger } from '@/lib/logger'

const log = createLogger('analysis:uk-income-tax')

// ─── Types ───────────────────────────────────────────────────────────

export type UKTaxRegion = 'england_ni_wales' | 'scotland'

export interface BracketBreakdown {
  bracket: string
  rate: number
  taxableInBracket: number
  taxOnBracket: number
}

export interface PersonalAllowanceTaper {
  grossIncome: number
  taperThreshold: number
  adjustedPersonalAllowance: number
  allowanceReduction: number
  effectiveMarginalRate: number
}

export interface DividendTaxBreakdown {
  totalDividends: number
  dividendAllowance: number
  taxableDividends: number
  basicRateDividendTax: number
  higherRateDividendTax: number
  additionalRateDividendTax: number
  totalDividendTax: number
}

export interface MarriageAllowanceAnalysis {
  eligible: boolean
  transferAmount: number
  taxSaving: number
  recommendation: string
}

export interface HighIncomeChildBenefitCharge {
  applicable: boolean
  adjustedNetIncome: number
  chargePercentage: number
  chargeAmount: number
  childBenefitReceived: number
}

export interface UKIncomeTaxAnalysis {
  // Income summary
  grossIncome: number
  adjustedNetIncome: number
  taxRegion: UKTaxRegion

  // Personal Allowance
  personalAllowance: number
  personalAllowanceTaper: PersonalAllowanceTaper | null
  taxableIncome: number

  // Tax calculation by bracket
  bracketBreakdown: BracketBreakdown[]
  totalIncomeTax: number

  // Effective rates
  effectiveTaxRate: number
  marginalTaxRate: number

  // Dividend tax (if applicable)
  dividendTax: DividendTaxBreakdown | null

  // Marriage Allowance
  marriageAllowance: MarriageAllowanceAnalysis | null

  // High Income Child Benefit Charge
  childBenefitCharge: HighIncomeChildBenefitCharge | null

  // Blind Person's Allowance
  blindPersonsAllowance: number

  // Total tax liability
  totalTaxLiability: number

  // Recommendations
  recommendations: string[]
}

// ─── Fallback Rates (2024-25 Tax Year) ──────────────────────────────

const FALLBACK_PERSONAL_ALLOWANCE = 12_570
const FALLBACK_PERSONAL_ALLOWANCE_TAPER_THRESHOLD = 100_000
const FALLBACK_BLIND_PERSONS_ALLOWANCE = 2_870
const FALLBACK_MARRIAGE_ALLOWANCE_AMOUNT = 1_260
const FALLBACK_DIVIDEND_ALLOWANCE = 500

/** England, Wales, and Northern Ireland income tax brackets */
const FALLBACK_INCOME_TAX_BRACKETS: TaxBracket[] = [
  { min: 0, max: 12_570, rate: 0, label: 'Personal Allowance' },
  { min: 12_571, max: 50_270, rate: 20, label: 'Basic rate' },
  { min: 50_271, max: 125_140, rate: 40, label: 'Higher rate' },
  { min: 125_141, max: null, rate: 45, label: 'Additional rate' },
]

/** Scottish income tax brackets (SRIT) */
const FALLBACK_SCOTTISH_BRACKETS: TaxBracket[] = [
  { min: 0, max: 12_570, rate: 0, label: 'Personal Allowance' },
  { min: 12_571, max: 14_876, rate: 19, label: 'Starter rate' },
  { min: 14_877, max: 26_561, rate: 20, label: 'Basic rate' },
  { min: 26_562, max: 43_662, rate: 21, label: 'Intermediate rate' },
  { min: 43_663, max: 75_000, rate: 42, label: 'Higher rate' },
  { min: 75_001, max: 125_140, rate: 45, label: 'Advanced rate' },
  { min: 125_141, max: null, rate: 48, label: 'Top rate' },
]

/** Dividend tax rates */
const FALLBACK_DIVIDEND_BASIC_RATE = 8.75
const FALLBACK_DIVIDEND_HIGHER_RATE = 33.75
const FALLBACK_DIVIDEND_ADDITIONAL_RATE = 39.35

// ─── Engine ──────────────────────────────────────────────────────────

export class UKIncomeTaxEngine extends BaseTaxEngine {
  constructor() {
    super('UK')
  }

  /**
   * Get the income tax brackets for the appropriate region.
   */
  getBrackets(region: UKTaxRegion): TaxBracket[] {
    return region === 'scotland'
      ? [...FALLBACK_SCOTTISH_BRACKETS]
      : [...FALLBACK_INCOME_TAX_BRACKETS]
  }

  /**
   * Calculate the Personal Allowance after taper.
   *
   * ITA 2007, s 35:
   * The Personal Allowance is reduced by GBP 1 for every GBP 2
   * of adjusted net income above GBP 100,000.
   * At GBP 125,140, the allowance is completely eliminated.
   */
  calculatePersonalAllowanceTaper(
    grossIncome: number,
    baseAllowance: number
  ): PersonalAllowanceTaper {
    const taperThreshold = FALLBACK_PERSONAL_ALLOWANCE_TAPER_THRESHOLD

    if (grossIncome <= taperThreshold) {
      return {
        grossIncome,
        taperThreshold,
        adjustedPersonalAllowance: baseAllowance,
        allowanceReduction: 0,
        effectiveMarginalRate: 0,
      }
    }

    // Reduction = (income - 100,000) / 2
    const excessIncome = this.decimal(grossIncome).sub(taperThreshold)
    const reduction = excessIncome.div(2)
    const adjustedAllowance = Math.max(
      0,
      this.roundCurrency(this.decimal(baseAllowance).sub(reduction))
    )
    const actualReduction = baseAllowance - adjustedAllowance

    // In the taper zone, the effective marginal rate is:
    // 40% tax rate + (1/2 of allowance lost * 40% rate) = 60% effective rate
    const effectiveMarginalRate = adjustedAllowance > 0 ? 60 : 45

    return {
      grossIncome,
      taperThreshold,
      adjustedPersonalAllowance: adjustedAllowance,
      allowanceReduction: actualReduction,
      effectiveMarginalRate,
    }
  }

  /**
   * Calculate income tax across progressive brackets.
   *
   * @param taxableIncome - Income after Personal Allowance deduction
   * @param brackets - Tax brackets to apply (region-specific)
   * @param personalAllowance - The (possibly tapered) Personal Allowance
   * @returns Bracket-by-bracket breakdown and total tax
   */
  calculateTaxByBracket(
    taxableIncome: number,
    brackets: TaxBracket[],
    personalAllowance: number
  ): { breakdown: BracketBreakdown[]; total: number } {
    const breakdown: BracketBreakdown[] = []
    let totalTax = new Decimal(0)
    let remainingIncome = this.decimal(taxableIncome).add(personalAllowance)

    for (const bracket of brackets) {
      const bracketMin = this.decimal(bracket.min)
      const bracketMax = bracket.max !== null ? this.decimal(bracket.max) : null

      if (remainingIncome.lessThanOrEqualTo(bracketMin)) break

      const incomeInBracket = bracketMax !== null
        ? Decimal.max(Decimal.min(remainingIncome, bracketMax).sub(bracketMin), 0)
        : Decimal.max(remainingIncome.sub(bracketMin), 0)

      const taxInBracket = incomeInBracket.mul(this.decimal(bracket.rate).div(100))

      if (incomeInBracket.greaterThan(0)) {
        breakdown.push({
          bracket: bracket.label ?? `${bracket.rate}%`,
          rate: bracket.rate,
          taxableInBracket: this.roundCurrency(incomeInBracket),
          taxOnBracket: this.roundCurrency(taxInBracket),
        })
        totalTax = totalTax.add(taxInBracket)
      }
    }

    return {
      breakdown,
      total: this.roundCurrency(totalTax),
    }
  }

  /**
   * Calculate dividend tax.
   *
   * ITA 2007, s 13A:
   * Dividends above the dividend allowance are taxed at:
   * - Basic rate: 8.75%
   * - Higher rate: 33.75%
   * - Additional rate: 39.35%
   *
   * Dividends sit on top of other income when determining the rate band.
   */
  calculateDividendTax(
    totalDividends: number,
    otherTaxableIncome: number,
    personalAllowance: number
  ): DividendTaxBreakdown {
    const dividendAllowance = FALLBACK_DIVIDEND_ALLOWANCE
    const taxableDividends = Math.max(0, totalDividends - dividendAllowance)

    if (taxableDividends <= 0) {
      return {
        totalDividends,
        dividendAllowance,
        taxableDividends: 0,
        basicRateDividendTax: 0,
        higherRateDividendTax: 0,
        additionalRateDividendTax: 0,
        totalDividendTax: 0,
      }
    }

    // Determine how much of each band remains after non-dividend income
    const totalNonDivIncome = otherTaxableIncome + personalAllowance
    const basicRateBand = 50_270
    const higherRateBand = 125_140

    let divInBasic = new Decimal(0)
    let divInHigher = new Decimal(0)
    let divInAdditional = new Decimal(0)

    let remainingDividends = this.decimal(taxableDividends)
    const incomeStart = this.decimal(totalNonDivIncome)

    // Basic rate band remaining
    if (incomeStart.lessThan(basicRateBand)) {
      const spaceInBasic = this.decimal(basicRateBand).sub(incomeStart)
      divInBasic = Decimal.min(remainingDividends, spaceInBasic)
      remainingDividends = remainingDividends.sub(divInBasic)
    }

    // Higher rate band remaining
    if (remainingDividends.greaterThan(0)) {
      const effectiveHigherStart = Decimal.max(incomeStart, this.decimal(basicRateBand))
      if (effectiveHigherStart.lessThan(higherRateBand)) {
        const spaceInHigher = this.decimal(higherRateBand).sub(effectiveHigherStart)
        divInHigher = Decimal.min(remainingDividends, spaceInHigher)
        remainingDividends = remainingDividends.sub(divInHigher)
      }
    }

    // Additional rate — everything else
    if (remainingDividends.greaterThan(0)) {
      divInAdditional = remainingDividends
    }

    const basicTax = this.roundCurrency(
      divInBasic.mul(this.decimal(FALLBACK_DIVIDEND_BASIC_RATE).div(100))
    )
    const higherTax = this.roundCurrency(
      divInHigher.mul(this.decimal(FALLBACK_DIVIDEND_HIGHER_RATE).div(100))
    )
    const additionalTax = this.roundCurrency(
      divInAdditional.mul(this.decimal(FALLBACK_DIVIDEND_ADDITIONAL_RATE).div(100))
    )

    return {
      totalDividends,
      dividendAllowance,
      taxableDividends,
      basicRateDividendTax: basicTax,
      higherRateDividendTax: higherTax,
      additionalRateDividendTax: additionalTax,
      totalDividendTax: this.roundCurrency(
        this.decimal(basicTax).add(higherTax).add(additionalTax)
      ),
    }
  }

  /**
   * Assess Marriage Allowance eligibility.
   *
   * ITA 2007, s 55B-55E:
   * A spouse/civil partner can transfer 10% of their Personal Allowance
   * (GBP 1,260) if:
   * - Transferor's income is below the Personal Allowance
   * - Recipient is a basic rate taxpayer (not higher/additional)
   */
  assessMarriageAllowance(
    applicantIncome: number,
    spouseIncome: number,
    personalAllowance: number
  ): MarriageAllowanceAnalysis {
    const transferAmount = FALLBACK_MARRIAGE_ALLOWANCE_AMOUNT
    const eligible =
      applicantIncome <= personalAllowance &&
      spouseIncome > personalAllowance &&
      spouseIncome <= 50_270

    if (!eligible) {
      return {
        eligible: false,
        transferAmount: 0,
        taxSaving: 0,
        recommendation: applicantIncome > personalAllowance
          ? 'Applicant income exceeds Personal Allowance; not eligible for Marriage Allowance transfer'
          : 'Recipient must be a basic rate taxpayer to benefit from Marriage Allowance',
      }
    }

    // Tax saving = transfer amount * basic rate (20%)
    const taxSaving = this.roundCurrency(this.decimal(transferAmount).mul(0.20))

    return {
      eligible: true,
      transferAmount,
      taxSaving,
      recommendation: `Marriage Allowance transfer of GBP ${transferAmount.toLocaleString('en-GB')} would save GBP ${taxSaving.toLocaleString('en-GB')} per year`,
    }
  }

  /**
   * Calculate the High Income Child Benefit Charge.
   *
   * ITEPA 2003, Part 10, Ch 8 (s 681B-681H):
   * If either parent has adjusted net income above GBP 60,000, a tax charge
   * of 1% of Child Benefit for every GBP 200 of income above GBP 60,000 applies.
   * At GBP 80,000+, the full Child Benefit is clawed back.
   *
   * Note: Threshold increased from GBP 50,000 to GBP 60,000 from 6 April 2024.
   */
  calculateChildBenefitCharge(
    adjustedNetIncome: number,
    annualChildBenefit: number
  ): HighIncomeChildBenefitCharge {
    const chargeThreshold = 60_000
    const fullChargeThreshold = 80_000

    if (adjustedNetIncome <= chargeThreshold || annualChildBenefit <= 0) {
      return {
        applicable: false,
        adjustedNetIncome,
        chargePercentage: 0,
        chargeAmount: 0,
        childBenefitReceived: annualChildBenefit,
      }
    }

    // 1% per GBP 200 above threshold
    const excessIncome = Math.min(
      adjustedNetIncome - chargeThreshold,
      fullChargeThreshold - chargeThreshold
    )
    const chargePercentage = Math.min(Math.floor(excessIncome / 200), 100)
    const chargeAmount = this.roundCurrency(
      this.decimal(annualChildBenefit).mul(this.decimal(chargePercentage).div(100))
    )

    return {
      applicable: true,
      adjustedNetIncome,
      chargePercentage,
      chargeAmount,
      childBenefitReceived: annualChildBenefit,
    }
  }

  /**
   * Run the full income tax analysis.
   *
   * Public entry point that has access to protected base class methods.
   */
  async analyze(
    tenantId: string,
    financialYear: string,
    income: number,
    entityType: string,
    options?: EngineOptions & {
      taxRegion?: UKTaxRegion
      dividendIncome?: number
      spouseIncome?: number
      childBenefitReceived?: number
      isBlindPerson?: boolean
    }
  ): Promise<EngineResult<UKIncomeTaxAnalysis>> {
    const startTime = Date.now()

    log.info('Starting UK income tax analysis', { tenantId, financialYear, income, entityType })

    try {
      const taxRegion = options?.taxRegion ?? 'england_ni_wales'
      const dividendIncome = options?.dividendIncome ?? 0
      const grossIncome = income

      // Fetch Personal Allowance with fallback
      const basePersonalAllowance = await this.getTaxRateWithFallback(
        'income_tax', 'personal_allowance', FALLBACK_PERSONAL_ALLOWANCE
      )

      // Blind Person's Allowance
      const blindPersonsAllowance = options?.isBlindPerson
        ? FALLBACK_BLIND_PERSONS_ALLOWANCE
        : 0

      // Adjusted net income (before PA)
      const adjustedNetIncome = grossIncome

      // Personal Allowance taper calculation
      const taper = this.calculatePersonalAllowanceTaper(grossIncome, basePersonalAllowance)
      const effectivePersonalAllowance = taper.adjustedPersonalAllowance + blindPersonsAllowance

      // Non-dividend taxable income
      const nonDividendIncome = grossIncome - dividendIncome
      const taxableIncome = Math.max(0, nonDividendIncome - effectivePersonalAllowance)

      // Get appropriate brackets for region
      const brackets = this.getBrackets(taxRegion)

      // Calculate tax by bracket
      const { breakdown, total: incomeTax } = this.calculateTaxByBracket(
        taxableIncome,
        brackets,
        effectivePersonalAllowance
      )

      // Dividend tax
      let dividendTax: DividendTaxBreakdown | null = null
      let totalDividendTax = 0
      if (dividendIncome > 0) {
        dividendTax = this.calculateDividendTax(
          dividendIncome,
          taxableIncome,
          effectivePersonalAllowance
        )
        totalDividendTax = dividendTax.totalDividendTax
      }

      // Marriage Allowance
      let marriageAllowance: MarriageAllowanceAnalysis | null = null
      if (options?.spouseIncome !== undefined) {
        marriageAllowance = this.assessMarriageAllowance(
          grossIncome,
          options.spouseIncome,
          basePersonalAllowance
        )
      }

      // High Income Child Benefit Charge
      let childBenefitCharge: HighIncomeChildBenefitCharge | null = null
      if (options?.childBenefitReceived !== undefined && options.childBenefitReceived > 0) {
        childBenefitCharge = this.calculateChildBenefitCharge(
          adjustedNetIncome,
          options.childBenefitReceived
        )
      }

      // Total tax liability
      const totalTaxLiability = this.roundCurrency(
        new Decimal(incomeTax)
          .add(totalDividendTax)
          .add(childBenefitCharge?.chargeAmount ?? 0)
      )

      // Effective and marginal rates
      const effectiveTaxRate = grossIncome > 0
        ? this.roundCurrency(new Decimal(totalTaxLiability).div(grossIncome).mul(100))
        : 0

      // Marginal rate depends on position in brackets
      let marginalTaxRate = 0
      if (taper.adjustedPersonalAllowance > 0 && grossIncome > FALLBACK_PERSONAL_ALLOWANCE_TAPER_THRESHOLD) {
        marginalTaxRate = 60 // Effective 60% in taper zone
      } else if (taxableIncome + effectivePersonalAllowance > 125_140) {
        marginalTaxRate = taxRegion === 'scotland' ? 48 : 45
      } else if (taxableIncome + effectivePersonalAllowance > 50_270) {
        marginalTaxRate = taxRegion === 'scotland' ? 42 : 40
      } else if (taxableIncome > 0) {
        marginalTaxRate = 20
      }

      // Build recommendations
      const recommendations: string[] = []

      if (taper.allowanceReduction > 0) {
        recommendations.push(
          `Personal Allowance reduced by GBP ${taper.allowanceReduction.toLocaleString('en-GB')} due to income above GBP 100,000. Consider pension contributions to reduce adjusted net income below the taper threshold.`
        )
      }

      if (grossIncome > 50_000 && grossIncome <= 60_000) {
        recommendations.push(
          'Income is approaching the High Income Child Benefit Charge threshold (GBP 60,000). Salary sacrifice into pension could reduce the charge.'
        )
      }

      if (marriageAllowance?.eligible) {
        recommendations.push(marriageAllowance.recommendation)
      }

      if (taxRegion === 'scotland' && grossIncome > 43_662) {
        recommendations.push(
          'Scottish higher rate (42%) applies above GBP 43,663. Review tax-efficient remuneration strategies.'
        )
      }

      if (dividendIncome > 0 && dividendIncome > FALLBACK_DIVIDEND_ALLOWANCE) {
        recommendations.push(
          `Dividend income of GBP ${dividendIncome.toLocaleString('en-GB')} exceeds the GBP ${FALLBACK_DIVIDEND_ALLOWANCE} allowance. Consider ISA wrapper for investments to shelter future dividends.`
        )
      }

      const warnings: string[] = []
      if (taper.effectiveMarginalRate === 60) {
        warnings.push(
          'Income falls within the 60% effective marginal rate zone (GBP 100,000-125,140) due to Personal Allowance taper.'
        )
      }

      const analysis: UKIncomeTaxAnalysis = {
        grossIncome,
        adjustedNetIncome,
        taxRegion,
        personalAllowance: effectivePersonalAllowance,
        personalAllowanceTaper: taper.allowanceReduction > 0 ? taper : null,
        taxableIncome,
        bracketBreakdown: breakdown,
        totalIncomeTax: incomeTax,
        effectiveTaxRate,
        marginalTaxRate,
        dividendTax,
        marriageAllowance,
        childBenefitCharge,
        blindPersonsAllowance,
        totalTaxLiability,
        recommendations,
      }

      return this.createResult(
        'UKIncomeTaxEngine',
        startTime,
        analysis,
        0.92,
        [
          'Income Tax Act 2007, s 10 — charge to income tax',
          'Income Tax Act 2007, s 35 — Personal Allowance taper',
          'Income Tax Act 2007, s 13A — dividend ordinary rate',
          'Income Tax Act 2007, s 55B-55E — Marriage Allowance',
          'ITEPA 2003, s 681B-681H — High Income Child Benefit Charge',
          ...(taxRegion === 'scotland'
            ? ['Scotland Act 2016, s 14 — Scottish rate of income tax']
            : []),
        ],
        warnings
      )
    } catch (error) {
      log.error('UK income tax analysis failed', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      })
      return this.createErrorResult<UKIncomeTaxAnalysis>(
        'UKIncomeTaxEngine',
        startTime,
        `UK income tax analysis failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}

// ─── Exported Analysis Function ──────────────────────────────────────

/**
 * Analyse UK income tax liability.
 *
 * @param tenantId - Organisation identifier
 * @param financialYear - UK tax year (e.g. 'UK2025-26')
 * @param income - Total gross income in GBP
 * @param entityType - 'individual' | 'sole_trader'
 * @param options - Optional engine configuration
 * @returns Comprehensive income tax analysis with confidence score
 */
export async function analyzeUKIncomeTax(
  tenantId: string,
  financialYear: string,
  income: number,
  entityType: string,
  options?: EngineOptions & {
    taxRegion?: UKTaxRegion
    dividendIncome?: number
    spouseIncome?: number
    childBenefitReceived?: number
    isBlindPerson?: boolean
  }
): Promise<EngineResult<UKIncomeTaxAnalysis>> {
  const engine = new UKIncomeTaxEngine()
  return engine.analyze(tenantId, financialYear, income, entityType, options)
}
