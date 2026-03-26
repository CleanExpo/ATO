/**
 * NZ Income Tax Analysis Engine
 *
 * Calculates New Zealand income tax liability using progressive brackets,
 * applies credits, and tracks loss carry-forward.
 *
 * Key Legislation:
 * - Income Tax Act 2007 (NZ)
 *   - Subpart BC 1 — Obligation to pay income tax
 *   - Schedule 1, Part A — Tax rates for individuals
 *   - Schedule 1, Part B — Tax rates for companies (28%)
 *   - Schedule 1, Part C — Tax rates for trusts (33% / 39%)
 *   - Subpart LB 1 — Tax credits for PAYE
 *   - Subpart MB — Independent Earner Tax Credit (IETC)
 *     (available for income $24,000–$48,000 range)
 *   - Subpart IC — Loss carry-forward (Business Continuity Test from 2020)
 *   - Subpart RE — Resident Withholding Tax (RWT) on interest and dividends
 *   - Subpart LP — Imputation credits for companies
 */

import Decimal from 'decimal.js'
import { BaseTaxEngine } from '@/lib/analysis/base-engine'
import type { EngineResult, EngineOptions } from '@/lib/analysis/base-engine'
import type { TaxBracket } from '@/lib/types/jurisdiction'
import { createLogger } from '@/lib/logger'

const log = createLogger('analysis:nz:income-tax')

// ─── Fallback Rates ───────────────────────────────────────────────────

/** NZ individual income tax brackets (2025–26 income year) */
const FALLBACK_INDIVIDUAL_BRACKETS: TaxBracket[] = [
  { min: 0, max: 14_000, rate: 10.5, label: '10.5% on $0 – $14,000' },
  { min: 14_001, max: 48_000, rate: 17.5, label: '17.5% on $14,001 – $48,000' },
  { min: 48_001, max: 70_000, rate: 30, label: '30% on $48,001 – $70,000' },
  { min: 70_001, max: 180_000, rate: 33, label: '33% on $70,001 – $180,000' },
  { min: 180_001, max: null, rate: 39, label: '39% on $180,001+' },
]

/** NZ company flat rate */
const FALLBACK_COMPANY_RATE = 28

/** NZ trust rates */
const FALLBACK_TRUSTEE_RATE = 33
const FALLBACK_TRUST_39_RATE = 39

/** IETC parameters */
const IETC_ANNUAL_MAX = 520 // $520 per year
const IETC_INCOME_MIN = 24_000
const IETC_INCOME_MAX = 48_000
const IETC_ABATEMENT_THRESHOLD = 44_000
const IETC_ABATEMENT_RATE = 13 // 13 cents per dollar above $44,000

/** ACC Earner Levy fallback */
const FALLBACK_ACC_EARNER_LEVY = 1.60

/** RWT rates for interest income */
const RWT_RATES = [10.5, 17.5, 30, 33, 39] as const

// ─── Types ────────────────────────────────────────────────────────────

export type NZEntityType =
  | 'individual'
  | 'company'
  | 'trust'
  | 'partnership'
  | 'sole_trader'
  | 'look_through_company'

export interface TaxBracketResult {
  bracket: TaxBracket
  taxableInBracket: number
  taxOnBracket: number
}

export interface LossCarryForward {
  priorYearLosses: number
  lossesApplied: number
  remainingLosses: number
  businessContinuityTestMet: boolean
}

export interface ImputationCredits {
  openingBalance: number
  creditsReceived: number
  creditsPaid: number
  taxPayments: number
  closingBalance: number
}

export interface NZIncomeTaxAnalysis {
  entityType: NZEntityType
  grossIncome: number
  totalDeductions: number
  taxableIncome: number
  bracketBreakdown: TaxBracketResult[]
  grossTaxLiability: number
  ietcAmount: number
  accLevy: number
  netTaxPayable: number
  effectiveTaxRate: number
  marginalTaxRate: number
  lossCarryForward: LossCarryForward
  imputationCredits?: ImputationCredits
  recommendedRWTRate: number
  recommendations: string[]
  legislativeRefs: string[]
}

export interface IncomeTaxOptions extends EngineOptions {
  deductions?: number
  priorYearLosses?: number
  businessContinuityTestMet?: boolean
  imputationCreditsOpening?: number
  dividendsReceived?: number
  dividendsPaid?: number
  taxPaymentsMade?: number
}

// ─── Engine ───────────────────────────────────────────────────────────

export class NZIncomeTaxEngine extends BaseTaxEngine {
  constructor() {
    super('NZ')
  }

  /**
   * Calculate progressive income tax for an individual across brackets.
   */
  calculateProgressiveTax(
    taxableIncome: number,
    brackets: TaxBracket[]
  ): { breakdown: TaxBracketResult[]; totalTax: number } {
    const breakdown: TaxBracketResult[] = []
    let totalTax = new Decimal(0)
    let remaining = new Decimal(taxableIncome)

    for (const bracket of brackets) {
      if (remaining.lte(0)) break

      const bracketMin = new Decimal(bracket.min)
      const bracketMax = bracket.max !== null ? new Decimal(bracket.max) : null
      const bracketWidth = bracketMax !== null
        ? bracketMax.minus(bracketMin).plus(1)
        : remaining

      const taxableInBracket = Decimal.min(remaining, bracketWidth)
      const taxOnBracket = taxableInBracket.mul(new Decimal(bracket.rate).div(100))

      breakdown.push({
        bracket,
        taxableInBracket: this.roundCurrency(taxableInBracket),
        taxOnBracket: this.roundCurrency(taxOnBracket),
      })

      totalTax = totalTax.plus(taxOnBracket)
      remaining = remaining.minus(taxableInBracket)
    }

    return {
      breakdown,
      totalTax: this.roundCurrency(totalTax),
    }
  }

  /**
   * Calculate flat-rate tax (for companies, trusts).
   */
  calculateFlatTax(taxableIncome: number, rate: number): number {
    return this.roundCurrency(this.decimal(taxableIncome).mul(this.decimal(rate).div(100)))
  }

  /**
   * Calculate IETC eligibility and amount.
   */
  calculateIETC(taxableIncome: number): number {
    if (taxableIncome < IETC_INCOME_MIN || taxableIncome > IETC_INCOME_MAX) {
      return 0
    }

    if (taxableIncome <= IETC_ABATEMENT_THRESHOLD) {
      return IETC_ANNUAL_MAX
    }

    const excess = this.decimal(taxableIncome).minus(IETC_ABATEMENT_THRESHOLD)
    const abatement = excess.mul(this.decimal(IETC_ABATEMENT_RATE).div(100))
    const credit = this.decimal(IETC_ANNUAL_MAX).minus(abatement)

    return Math.max(0, this.roundCurrency(credit))
  }

  /**
   * Determine the marginal tax rate for a given income level.
   */
  getMarginalRate(taxableIncome: number, brackets: TaxBracket[]): number {
    for (let i = brackets.length - 1; i >= 0; i--) {
      if (taxableIncome >= brackets[i].min) {
        return brackets[i].rate
      }
    }
    return brackets[0]?.rate ?? 0
  }

  /**
   * Recommend the appropriate RWT rate based on estimated income.
   */
  getRecommendedRWTRate(estimatedIncome: number, brackets: TaxBracket[]): number {
    const marginal = this.getMarginalRate(estimatedIncome, brackets)
    for (const rate of RWT_RATES) {
      if (rate >= marginal) return rate
    }
    return RWT_RATES[RWT_RATES.length - 1]
  }

  /**
   * Calculate ACC earner levy.
   */
  calculateACCLevy(taxableIncome: number, levyRate: number): number {
    const maxEarnings = 142_283
    const assessableIncome = Math.min(taxableIncome, maxEarnings)
    return this.roundCurrency(this.decimal(assessableIncome).mul(this.decimal(levyRate).div(100)))
  }

  /**
   * Run the full income tax analysis.
   */
  async analyze(
    tenantId: string,
    financialYear: string,
    income: number,
    entityType: NZEntityType = 'individual',
    options?: IncomeTaxOptions
  ): Promise<EngineResult<NZIncomeTaxAnalysis>> {
    const startTime = Date.now()
    const engineName = 'nz-income-tax-engine'

    log.info('Starting NZ income tax analysis', { tenantId, financialYear, income, entityType })

    try {
      const deductions = options?.deductions ?? 0
      const priorYearLosses = options?.priorYearLosses ?? 0
      const businessContinuityMet = options?.businessContinuityTestMet ?? true

      const incomeAfterDeductions = Math.max(0, income - deductions)

      let lossesApplied = 0
      let remainingLosses = priorYearLosses

      if (businessContinuityMet && priorYearLosses > 0 && incomeAfterDeductions > 0) {
        lossesApplied = Math.min(priorYearLosses, incomeAfterDeductions)
        remainingLosses = priorYearLosses - lossesApplied
      }

      const taxableIncome = Math.max(0, incomeAfterDeductions - lossesApplied)

      const warnings: string[] = []
      const recommendations: string[] = []
      const legislativeRefs: string[] = [
        'Income Tax Act 2007 (NZ), Subpart BC 1 — Obligation to pay income tax',
      ]

      let grossTaxLiability = 0
      let bracketBreakdown: TaxBracketResult[] = []
      let marginalTaxRate = 0
      let ietcAmount = 0

      switch (entityType) {
        case 'individual':
        case 'sole_trader': {
          const brackets = FALLBACK_INDIVIDUAL_BRACKETS
          const result = this.calculateProgressiveTax(taxableIncome, brackets)
          grossTaxLiability = result.totalTax
          bracketBreakdown = result.breakdown
          marginalTaxRate = this.getMarginalRate(taxableIncome, brackets)
          ietcAmount = this.calculateIETC(taxableIncome)
          legislativeRefs.push(
            'Income Tax Act 2007 (NZ), Schedule 1, Part A — Individual tax rates',
            'Income Tax Act 2007 (NZ), Subpart MB — Independent Earner Tax Credit'
          )
          break
        }

        case 'company':
        case 'look_through_company': {
          const companyRate = await this.getTaxRateWithFallback(
            'income_tax', 'company_rate', FALLBACK_COMPANY_RATE
          )
          grossTaxLiability = this.calculateFlatTax(taxableIncome, companyRate)
          marginalTaxRate = companyRate
          legislativeRefs.push(
            'Income Tax Act 2007 (NZ), Schedule 1, Part B — Company tax rate (28%)'
          )
          break
        }

        case 'trust': {
          const trustBrackets: TaxBracket[] = [
            { min: 0, max: 10_000, rate: FALLBACK_TRUSTEE_RATE, label: '33% on $0 – $10,000' },
            { min: 10_001, max: null, rate: FALLBACK_TRUST_39_RATE, label: '39% on $10,001+' },
          ]
          const result = this.calculateProgressiveTax(taxableIncome, trustBrackets)
          grossTaxLiability = result.totalTax
          bracketBreakdown = result.breakdown
          marginalTaxRate = taxableIncome > 10_000 ? FALLBACK_TRUST_39_RATE : FALLBACK_TRUSTEE_RATE
          legislativeRefs.push(
            'Income Tax Act 2007 (NZ), Schedule 1, Part C — Trustee income tax rates'
          )
          break
        }

        case 'partnership': {
          warnings.push(
            'Partnership income is allocated to partners and taxed at their individual rates. ' +
            'This analysis shows the aggregate position only.'
          )
          const result = this.calculateProgressiveTax(taxableIncome, FALLBACK_INDIVIDUAL_BRACKETS)
          grossTaxLiability = result.totalTax
          bracketBreakdown = result.breakdown
          marginalTaxRate = this.getMarginalRate(taxableIncome, FALLBACK_INDIVIDUAL_BRACKETS)
          legislativeRefs.push(
            'Income Tax Act 2007 (NZ), Subpart HG — Partnerships'
          )
          break
        }
      }

      // ACC earner levy (individuals and sole traders)
      const accLevy =
        entityType === 'individual' || entityType === 'sole_trader'
          ? this.calculateACCLevy(taxableIncome, FALLBACK_ACC_EARNER_LEVY)
          : 0

      const netTaxPayable = this.roundCurrency(
        new Decimal(grossTaxLiability).minus(ietcAmount)
      )

      const effectiveTaxRate = taxableIncome > 0
        ? this.roundCurrency(new Decimal(netTaxPayable).div(taxableIncome).mul(100))
        : 0

      const recommendedRWTRate =
        entityType === 'individual' || entityType === 'sole_trader'
          ? this.getRecommendedRWTRate(taxableIncome, FALLBACK_INDIVIDUAL_BRACKETS)
          : marginalTaxRate

      const lossCarryForward: LossCarryForward = {
        priorYearLosses,
        lossesApplied,
        remainingLosses,
        businessContinuityTestMet: businessContinuityMet,
      }

      if (priorYearLosses > 0) {
        legislativeRefs.push(
          'Income Tax Act 2007 (NZ), Subpart IC — Loss carry-forward',
          'Income Tax Act 2007 (NZ), s IB 3 — Business Continuity Test (from 2020, replacing Shareholder Continuity)'
        )
      }

      if (!businessContinuityMet && priorYearLosses > 0) {
        warnings.push(
          'Business Continuity Test not met — prior year losses cannot be carried forward. ' +
          'Review whether the business has maintained continuity of economic activity (s IB 3 ITA 2007).'
        )
      }

      // Imputation credits (companies)
      let imputationCredits: ImputationCredits | undefined
      if (entityType === 'company' || entityType === 'look_through_company') {
        const opening = options?.imputationCreditsOpening ?? 0
        const received = options?.dividendsReceived ?? 0
        const paid = options?.dividendsPaid ?? 0
        const taxPaid = options?.taxPaymentsMade ?? 0

        imputationCredits = {
          openingBalance: opening,
          creditsReceived: received,
          creditsPaid: paid,
          taxPayments: taxPaid,
          closingBalance: this.roundCurrency(
            new Decimal(opening).plus(received).plus(taxPaid).minus(paid)
          ),
        }

        legislativeRefs.push(
          'Income Tax Act 2007 (NZ), Subpart LP — Imputation credit accounts'
        )

        if (imputationCredits.closingBalance < 0) {
          warnings.push(
            'Imputation credit account is in debit. A further income tax (FIT) of 33% may apply ' +
            'on the deficit at the end of the imputation year (s OB 72 ITA 2007).'
          )
        }
      }

      // Recommendations
      if (entityType === 'individual' && taxableIncome > 0 && taxableIncome < IETC_INCOME_MIN) {
        recommendations.push(
          `Income of $${taxableIncome.toLocaleString('en-NZ')} is below the IETC eligibility threshold of $24,000. ` +
          'Consider whether additional income sources could bring total income into the $24,000–$48,000 IETC range.'
        )
      }

      if (ietcAmount > 0) {
        recommendations.push(
          `Independent Earner Tax Credit of $${ietcAmount.toLocaleString('en-NZ')} applied. ` +
          'Ensure the entity is not receiving Working for Families or other income-tested benefits ' +
          'that would disqualify IETC eligibility (Subpart MB ITA 2007).'
        )
      }

      if (entityType === 'individual' && taxableIncome > 180_000) {
        recommendations.push(
          'Income exceeds $180,000 — the 39% top marginal rate applies. ' +
          'Consider whether any income can legitimately be restructured through a trust or company ' +
          'to achieve a lower effective rate, subject to anti-avoidance provisions (s BG 1 ITA 2007).'
        )
      }

      if (remainingLosses > 0) {
        recommendations.push(
          `$${remainingLosses.toLocaleString('en-NZ')} in tax losses carried forward to future income years. ` +
          'Ensure the Business Continuity Test continues to be met in subsequent years (s IB 3 ITA 2007).'
        )
      }

      legislativeRefs.push(
        'Income Tax Act 2007 (NZ), Subpart RE — Resident Withholding Tax'
      )

      const analysis: NZIncomeTaxAnalysis = {
        entityType,
        grossIncome: income,
        totalDeductions: deductions,
        taxableIncome,
        bracketBreakdown,
        grossTaxLiability,
        ietcAmount,
        accLevy,
        netTaxPayable,
        effectiveTaxRate,
        marginalTaxRate,
        lossCarryForward,
        imputationCredits,
        recommendedRWTRate,
        recommendations,
        legislativeRefs,
      }

      log.info('NZ income tax analysis complete', {
        tenantId,
        netTaxPayable,
        effectiveTaxRate,
        durationMs: Date.now() - startTime,
      })

      return this.createResult(engineName, startTime, analysis, 0.90, legislativeRefs, warnings)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      log.error('NZ income tax analysis failed', { tenantId, error: message })
      return this.createErrorResult<NZIncomeTaxAnalysis>(engineName, startTime, message)
    }
  }
}

// ─── Singleton Engine Instance ────────────────────────────────────────

const engine = new NZIncomeTaxEngine()

// ─── Public Analysis Function ─────────────────────────────────────────

/**
 * Analyse NZ income tax for a tenant entity.
 *
 * @param tenantId - Organisation/tenant identifier
 * @param financialYear - NZ financial year (e.g. 'NZ2025-26')
 * @param income - Gross taxable income in NZD
 * @param entityType - Type of NZ entity
 * @param options - Engine configuration options
 * @returns Income tax analysis with bracket breakdown, credits, and recommendations
 */
export async function analyzeNZIncomeTax(
  tenantId: string,
  financialYear: string,
  income: number,
  entityType: NZEntityType = 'individual',
  options?: IncomeTaxOptions
): Promise<EngineResult<NZIncomeTaxAnalysis>> {
  return engine.analyze(tenantId, financialYear, income, entityType, options)
}
