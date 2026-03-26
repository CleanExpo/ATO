/**
 * UK Corporation Tax Analysis Engine
 *
 * Calculates corporation tax liability for UK companies including
 * marginal relief, associated company rules, quarterly instalment
 * payments, and R&D tax relief.
 *
 * Key Legislation:
 * - Corporation Tax Act 2010 (CTA 2010)
 * - Corporation Tax Act 2009 (CTA 2009)
 * - Capital Allowances Act 2001 (CAA 2001)
 * - Finance Act 2023 — marginal relief reintroduction
 *
 * Rates from 1 April 2023:
 * - Main rate: 25% (profits > GBP 250,000)
 * - Small profits rate: 19% (profits <= GBP 50,000)
 * - Marginal relief: between GBP 50,001 and GBP 250,000
 */

import Decimal from 'decimal.js'
import { BaseTaxEngine } from '@/lib/analysis/base-engine'
import type { EngineResult, EngineOptions } from '@/lib/analysis/base-engine'
import { createLogger } from '@/lib/logger'

const log = createLogger('analysis:uk-corporation-tax')

// ─── Types ───────────────────────────────────────────────────────────

export interface MarginalReliefCalculation {
  applicable: boolean
  upperLimit: number
  lowerLimit: number
  adjustedUpperLimit: number
  adjustedLowerLimit: number
  marginalReliefFraction: number // 3/200
  marginalReliefAmount: number
  effectiveRate: number
}

export interface AssociatedCompanyAdjustment {
  numberOfAssociatedCompanies: number
  divisor: number // 1 + associated companies
  adjustedUpperLimit: number
  adjustedLowerLimit: number
}

export interface QuarterlyInstalmentPayment {
  applicable: boolean
  largeCompanyThreshold: number
  isLargeCompany: boolean
  totalLiability: number
  instalmentAmount: number
  instalmentDates: string[]
  recommendation: string
}

export interface RDTaxReliefAnalysis {
  eligible: boolean
  scheme: 'sme_enhanced' | 'rdec' | 'merged' | null
  qualifyingExpenditure: number
  enhancedDeduction: number // SME: 186% of qualifying expenditure
  rdecCredit: number // RDEC: 20% of qualifying expenditure
  taxSaving: number
  effectiveRelief: number // percentage
  recommendation: string
}

export interface PatentBoxAnalysis {
  eligible: boolean
  qualifyingProfits: number
  effectiveRate: number // 10%
  taxSaving: number
  recommendation: string
}

export interface CapitalAllowancesSummary {
  aiaClaimable: number
  aiaLimit: number
  writingDownAllowance: number
  firstYearAllowance: number
  totalAllowances: number
}

export interface LossRelief {
  currentYearLoss: number
  carryBackAmount: number // up to 12 months carry-back
  carryForwardAmount: number
  groupReliefAvailable: boolean
  recommendation: string
}

export interface UKCorporationTaxAnalysis {
  // Profit summary
  taxableProfit: number
  financialYear: string

  // Rate determination
  applicableRate: number
  mainRate: number
  smallProfitsRate: number
  rateCategory: 'small_profits' | 'marginal_relief' | 'main_rate'

  // Associated companies
  associatedCompanies: AssociatedCompanyAdjustment

  // Tax calculation
  grossTaxLiability: number
  marginalRelief: MarginalReliefCalculation
  netTaxLiability: number
  effectiveTaxRate: number

  // Quarterly instalments
  quarterlyInstalments: QuarterlyInstalmentPayment

  // R&D tax relief
  rdTaxRelief: RDTaxReliefAnalysis | null

  // Patent Box
  patentBox: PatentBoxAnalysis | null

  // Capital allowances
  capitalAllowances: CapitalAllowancesSummary | null

  // Loss relief
  lossRelief: LossRelief | null

  // Recommendations
  recommendations: string[]
}

// ─── Fallback Rates ──────────────────────────────────────────────────

const FALLBACK_MAIN_RATE = 25
const FALLBACK_SMALL_PROFITS_RATE = 19
const FALLBACK_UPPER_LIMIT = 250_000
const FALLBACK_LOWER_LIMIT = 50_000
const FALLBACK_MARGINAL_RELIEF_FRACTION = 3 / 200 // 0.015

// QIP threshold — companies with profits > GBP 1.5M must pay in quarterly instalments
const FALLBACK_QIP_THRESHOLD = 1_500_000

// R&D relief rates
const FALLBACK_RD_ENHANCED_DEDUCTION_RATE = 1.86 // 186% (merged scheme from April 2024)
const FALLBACK_RDEC_CREDIT_RATE = 0.20 // 20% RDEC

// Patent Box
const FALLBACK_PATENT_BOX_RATE = 10

// Annual Investment Allowance
const FALLBACK_AIA_LIMIT = 1_000_000

// ─── Engine ──────────────────────────────────────────────────────────

export class UKCorporationTaxEngine extends BaseTaxEngine {
  constructor() {
    super('UK')
  }

  /**
   * Adjust the upper and lower limits for associated companies.
   *
   * CTA 2010, s 24:
   * The upper and lower limits are divided by (1 + number of associated companies).
   * Associated companies share the same thresholds.
   */
  calculateAssociatedCompanyAdjustment(
    associatedCompanies: number,
    upperLimit: number,
    lowerLimit: number
  ): AssociatedCompanyAdjustment {
    const divisor = 1 + associatedCompanies
    return {
      numberOfAssociatedCompanies: associatedCompanies,
      divisor,
      adjustedUpperLimit: Math.floor(upperLimit / divisor),
      adjustedLowerLimit: Math.floor(lowerLimit / divisor),
    }
  }

  /**
   * Calculate marginal relief.
   *
   * CTA 2010, s 19:
   * Marginal Relief = (U - P) x N/P x F
   * Where:
   *   U = upper limit (adjusted for associated companies)
   *   P = taxable total profits (including franked investment income)
   *   N = taxable total profits minus franked investment income
   *   F = standard fraction (3/200)
   *
   * For simplicity, N = P when there is no franked investment income.
   */
  calculateMarginalRelief(
    taxableProfit: number,
    adjustedUpperLimit: number,
    adjustedLowerLimit: number,
    mainRate: number,
    smallProfitsRate: number
  ): MarginalReliefCalculation {
    // Below lower limit — small profits rate applies, no marginal relief
    if (taxableProfit <= adjustedLowerLimit) {
      return {
        applicable: false,
        upperLimit: adjustedUpperLimit,
        lowerLimit: adjustedLowerLimit,
        adjustedUpperLimit,
        adjustedLowerLimit,
        marginalReliefFraction: FALLBACK_MARGINAL_RELIEF_FRACTION,
        marginalReliefAmount: 0,
        effectiveRate: smallProfitsRate,
      }
    }

    // Above upper limit — main rate applies, no marginal relief
    if (taxableProfit >= adjustedUpperLimit) {
      return {
        applicable: false,
        upperLimit: adjustedUpperLimit,
        lowerLimit: adjustedLowerLimit,
        adjustedUpperLimit,
        adjustedLowerLimit,
        marginalReliefFraction: FALLBACK_MARGINAL_RELIEF_FRACTION,
        marginalReliefAmount: 0,
        effectiveRate: mainRate,
      }
    }

    // In marginal relief band
    // MR = (U - P) x N/P x F
    // When N = P, simplifies to: MR = (U - P) x F
    const mrAmount = this.roundCurrency(
      this.decimal(adjustedUpperLimit)
        .sub(taxableProfit)
        .mul(FALLBACK_MARGINAL_RELIEF_FRACTION)
    )

    // Tax at main rate minus marginal relief
    const grossTax = this.roundCurrency(
      this.decimal(taxableProfit).mul(this.decimal(mainRate).div(100))
    )
    const netTax = this.roundCurrency(this.decimal(grossTax).sub(mrAmount))
    const effectiveRate = taxableProfit > 0
      ? this.roundCurrency(this.decimal(netTax).div(taxableProfit).mul(100))
      : 0

    return {
      applicable: true,
      upperLimit: adjustedUpperLimit,
      lowerLimit: adjustedLowerLimit,
      adjustedUpperLimit,
      adjustedLowerLimit,
      marginalReliefFraction: FALLBACK_MARGINAL_RELIEF_FRACTION,
      marginalReliefAmount: mrAmount,
      effectiveRate,
    }
  }

  /**
   * Determine quarterly instalment payment obligations.
   *
   * CTA 2010, s 59E and Corporation Tax (Instalment Payments) Regulations 1998:
   * Companies with profits exceeding GBP 1.5M (adjusted for associated companies)
   * must pay corporation tax in quarterly instalments.
   *
   * Instalments due: months 7, 10, 13, 16 of the accounting period.
   * For a year ending 31 March, instalments due: 14 Oct, 14 Jan, 14 Apr, 14 Jul.
   */
  assessQuarterlyInstalments(
    taxableProfit: number,
    totalLiability: number,
    associatedCompanies: number
  ): QuarterlyInstalmentPayment {
    const adjustedThreshold = Math.floor(FALLBACK_QIP_THRESHOLD / (1 + associatedCompanies))
    const isLargeCompany = taxableProfit > adjustedThreshold

    if (!isLargeCompany) {
      return {
        applicable: false,
        largeCompanyThreshold: adjustedThreshold,
        isLargeCompany: false,
        totalLiability,
        instalmentAmount: 0,
        instalmentDates: [],
        recommendation: `Corporation tax due 9 months and 1 day after accounting period end`,
      }
    }

    const instalmentAmount = this.roundCurrency(this.decimal(totalLiability).div(4))

    return {
      applicable: true,
      largeCompanyThreshold: adjustedThreshold,
      isLargeCompany: true,
      totalLiability,
      instalmentAmount,
      instalmentDates: [
        'Month 7 of accounting period',
        'Month 10 of accounting period',
        'Month 13 of accounting period',
        'Month 16 of accounting period',
      ],
      recommendation: `Quarterly instalments of GBP ${instalmentAmount.toLocaleString('en-GB')} each are required for large companies`,
    }
  }

  /**
   * Calculate R&D tax relief.
   *
   * From 1 April 2024, the merged R&D scheme applies:
   * - Enhanced deduction: 186% of qualifying expenditure
   * - RDEC rate: 20% (for subcontracted/subsidised R&D)
   * - R&D-intensive SMEs (40%+ spend on R&D): additional payable credit
   *
   * CTA 2009, Part 13 (as amended by Finance Act 2024)
   */
  calculateRDRelief(
    qualifyingExpenditure: number,
    taxableProfit: number,
    taxRate: number,
    isSME: boolean
  ): RDTaxReliefAnalysis {
    if (qualifyingExpenditure <= 0) {
      return {
        eligible: false,
        scheme: null,
        qualifyingExpenditure: 0,
        enhancedDeduction: 0,
        rdecCredit: 0,
        taxSaving: 0,
        effectiveRelief: 0,
        recommendation: 'No qualifying R&D expenditure identified',
      }
    }

    // Merged scheme from April 2024
    const enhancedDeduction = this.roundCurrency(
      this.decimal(qualifyingExpenditure).mul(FALLBACK_RD_ENHANCED_DEDUCTION_RATE)
    )

    // Additional deduction above normal trading deduction
    const additionalDeduction = this.roundCurrency(
      this.decimal(enhancedDeduction).sub(qualifyingExpenditure)
    )

    // Tax saving = additional deduction * tax rate
    const taxSaving = this.roundCurrency(
      this.decimal(additionalDeduction).mul(this.decimal(taxRate).div(100))
    )

    const effectiveRelief = qualifyingExpenditure > 0
      ? this.roundCurrency(this.decimal(taxSaving).div(qualifyingExpenditure).mul(100))
      : 0

    return {
      eligible: true,
      scheme: 'merged',
      qualifyingExpenditure,
      enhancedDeduction,
      rdecCredit: this.roundCurrency(
        this.decimal(qualifyingExpenditure).mul(FALLBACK_RDEC_CREDIT_RATE)
      ),
      taxSaving,
      effectiveRelief,
      recommendation: `R&D enhanced deduction of GBP ${additionalDeduction.toLocaleString('en-GB')} reduces taxable profit, saving GBP ${taxSaving.toLocaleString('en-GB')} in corporation tax`,
    }
  }

  /**
   * Calculate Patent Box relief.
   *
   * CTA 2010, Part 8A (s 357A):
   * Qualifying patent profits are taxed at an effective rate of 10%.
   * The company must own or exclusively licence the qualifying patent
   * and have made a significant contribution to the invention.
   */
  calculatePatentBox(
    qualifyingPatentProfits: number,
    mainRate: number
  ): PatentBoxAnalysis {
    if (qualifyingPatentProfits <= 0) {
      return {
        eligible: false,
        qualifyingProfits: 0,
        effectiveRate: 0,
        taxSaving: 0,
        recommendation: 'No qualifying patent profits identified',
      }
    }

    const normalTax = this.roundCurrency(
      this.decimal(qualifyingPatentProfits).mul(this.decimal(mainRate).div(100))
    )
    const patentBoxTax = this.roundCurrency(
      this.decimal(qualifyingPatentProfits).mul(this.decimal(FALLBACK_PATENT_BOX_RATE).div(100))
    )
    const taxSaving = this.roundCurrency(this.decimal(normalTax).sub(patentBoxTax))

    return {
      eligible: true,
      qualifyingProfits: qualifyingPatentProfits,
      effectiveRate: FALLBACK_PATENT_BOX_RATE,
      taxSaving,
      recommendation: `Patent Box reduces tax on qualifying profits to ${FALLBACK_PATENT_BOX_RATE}%, saving GBP ${taxSaving.toLocaleString('en-GB')}`,
    }
  }

  /**
   * Summarise capital allowances.
   *
   * CAA 2001:
   * - Annual Investment Allowance (AIA): 100% deduction up to GBP 1,000,000
   * - Writing Down Allowance: 18% main pool, 6% special rate pool
   * - First-year allowances for qualifying plant and machinery
   * - Full expensing: 100% for main rate assets (from April 2023)
   */
  calculateCapitalAllowances(
    qualifyingExpenditure: number
  ): CapitalAllowancesSummary {
    const aiaClaimable = Math.min(qualifyingExpenditure, FALLBACK_AIA_LIMIT)
    const excess = Math.max(0, qualifyingExpenditure - FALLBACK_AIA_LIMIT)
    const writingDownAllowance = this.roundCurrency(
      this.decimal(excess).mul(0.18) // 18% main pool WDA
    )

    return {
      aiaClaimable,
      aiaLimit: FALLBACK_AIA_LIMIT,
      writingDownAllowance,
      firstYearAllowance: 0, // Calculated separately for qualifying assets
      totalAllowances: aiaClaimable + writingDownAllowance,
    }
  }

  /**
   * Run the full corporation tax analysis.
   *
   * Public entry point that has access to protected base class methods.
   */
  async analyze(
    tenantId: string,
    financialYear: string,
    taxableProfit: number,
    associatedCompanies: number,
    options?: EngineOptions & {
      rdExpenditure?: number
      patentProfits?: number
      capitalExpenditure?: number
      currentYearLoss?: number
      isSME?: boolean
    }
  ): Promise<EngineResult<UKCorporationTaxAnalysis>> {
    const startTime = Date.now()

    log.info('Starting UK corporation tax analysis', {
      tenantId,
      financialYear,
      taxableProfit,
      associatedCompanies,
    })

    try {
      // Fetch rates with fallback
      const mainRate = await this.getTaxRateWithFallback(
        'corporation_tax', 'main_rate', FALLBACK_MAIN_RATE
      )
      const smallProfitsRate = await this.getTaxRateWithFallback(
        'corporation_tax', 'small_profits_rate', FALLBACK_SMALL_PROFITS_RATE
      )
      const upperLimit = await this.getTaxRateWithFallback(
        'corporation_tax', 'upper_limit', FALLBACK_UPPER_LIMIT
      )
      const lowerLimit = await this.getTaxRateWithFallback(
        'corporation_tax', 'lower_limit', FALLBACK_LOWER_LIMIT
      )

      // Adjust limits for associated companies
      const acAdjustment = this.calculateAssociatedCompanyAdjustment(
        associatedCompanies,
        upperLimit,
        lowerLimit
      )

      // Determine rate category
      let rateCategory: 'small_profits' | 'marginal_relief' | 'main_rate'
      if (taxableProfit <= acAdjustment.adjustedLowerLimit) {
        rateCategory = 'small_profits'
      } else if (taxableProfit >= acAdjustment.adjustedUpperLimit) {
        rateCategory = 'main_rate'
      } else {
        rateCategory = 'marginal_relief'
      }

      // Calculate marginal relief
      const marginalRelief = this.calculateMarginalRelief(
        taxableProfit,
        acAdjustment.adjustedUpperLimit,
        acAdjustment.adjustedLowerLimit,
        mainRate,
        smallProfitsRate
      )

      // Calculate gross tax liability
      let grossTaxLiability: number
      if (rateCategory === 'small_profits') {
        grossTaxLiability = this.roundCurrency(
          new Decimal(taxableProfit).mul(new Decimal(smallProfitsRate).div(100))
        )
      } else {
        grossTaxLiability = this.roundCurrency(
          new Decimal(taxableProfit).mul(new Decimal(mainRate).div(100))
        )
      }

      // Net liability after marginal relief
      const netTaxLiability = this.roundCurrency(
        new Decimal(grossTaxLiability).sub(marginalRelief.marginalReliefAmount)
      )

      const effectiveTaxRate = taxableProfit > 0
        ? this.roundCurrency(new Decimal(netTaxLiability).div(taxableProfit).mul(100))
        : 0

      const applicableRate = rateCategory === 'small_profits'
        ? smallProfitsRate
        : rateCategory === 'main_rate'
          ? mainRate
          : marginalRelief.effectiveRate

      // Quarterly instalment payments
      const quarterlyInstalments = this.assessQuarterlyInstalments(
        taxableProfit,
        netTaxLiability,
        associatedCompanies
      )

      // R&D tax relief
      let rdTaxRelief: RDTaxReliefAnalysis | null = null
      if (options?.rdExpenditure && options.rdExpenditure > 0) {
        rdTaxRelief = this.calculateRDRelief(
          options.rdExpenditure,
          taxableProfit,
          applicableRate,
          options.isSME ?? true
        )
      }

      // Patent Box
      let patentBox: PatentBoxAnalysis | null = null
      if (options?.patentProfits && options.patentProfits > 0) {
        patentBox = this.calculatePatentBox(options.patentProfits, mainRate)
      }

      // Capital allowances
      let capitalAllowances: CapitalAllowancesSummary | null = null
      if (options?.capitalExpenditure && options.capitalExpenditure > 0) {
        capitalAllowances = this.calculateCapitalAllowances(options.capitalExpenditure)
      }

      // Loss relief
      let lossRelief: LossRelief | null = null
      if (options?.currentYearLoss && options.currentYearLoss > 0) {
        lossRelief = {
          currentYearLoss: options.currentYearLoss,
          carryBackAmount: Math.min(options.currentYearLoss, taxableProfit),
          carryForwardAmount: Math.max(0, options.currentYearLoss - taxableProfit),
          groupReliefAvailable: associatedCompanies > 0,
          recommendation: associatedCompanies > 0
            ? 'Consider group relief to surrender losses to associated companies with taxable profits'
            : `Trading loss of GBP ${options.currentYearLoss.toLocaleString('en-GB')} can be carried back 12 months or carried forward indefinitely against future trading profits`,
        }
      }

      // Build recommendations
      const recommendations: string[] = []

      if (marginalRelief.applicable) {
        recommendations.push(
          `Profits of GBP ${taxableProfit.toLocaleString('en-GB')} fall within the marginal relief band. Effective rate is ${marginalRelief.effectiveRate}% (between ${smallProfitsRate}% and ${mainRate}%). Consider timing of income/expenditure to optimise the rate band.`
        )
      }

      if (associatedCompanies > 0) {
        recommendations.push(
          `${associatedCompanies} associated company/companies reduce the upper limit to GBP ${acAdjustment.adjustedUpperLimit.toLocaleString('en-GB')} and lower limit to GBP ${acAdjustment.adjustedLowerLimit.toLocaleString('en-GB')}. Review associated company status annually.`
        )
      }

      if (quarterlyInstalments.applicable) {
        recommendations.push(quarterlyInstalments.recommendation)
      }

      if (rdTaxRelief?.eligible) {
        recommendations.push(rdTaxRelief.recommendation)
      }

      if (patentBox?.eligible) {
        recommendations.push(patentBox.recommendation)
      }

      if (capitalAllowances) {
        recommendations.push(
          `Annual Investment Allowance of GBP ${capitalAllowances.aiaClaimable.toLocaleString('en-GB')} available. Full expensing (100%) also available for qualifying main rate plant and machinery.`
        )
      }

      if (lossRelief) {
        recommendations.push(lossRelief.recommendation)
      }

      const warnings: string[] = []
      if (taxableProfit <= 0) {
        warnings.push('No corporation tax liability on nil or negative profits. Ensure trading loss relief is claimed correctly.')
      }

      const analysis: UKCorporationTaxAnalysis = {
        taxableProfit,
        financialYear,
        applicableRate,
        mainRate,
        smallProfitsRate,
        rateCategory,
        associatedCompanies: acAdjustment,
        grossTaxLiability,
        marginalRelief,
        netTaxLiability,
        effectiveTaxRate,
        quarterlyInstalments,
        rdTaxRelief,
        patentBox,
        capitalAllowances,
        lossRelief,
        recommendations,
      }

      return this.createResult(
        'UKCorporationTaxEngine',
        startTime,
        analysis,
        0.91,
        [
          'Corporation Tax Act 2010, s 3 — charge to corporation tax',
          'Corporation Tax Act 2010, s 18 — small profits rate',
          'Corporation Tax Act 2010, s 19 — marginal relief',
          'Corporation Tax Act 2010, s 24 — associated companies',
          'Corporation Tax Act 2010, s 59E — instalment payments',
          'Corporation Tax Act 2009, Part 13 — R&D expenditure credits',
          'Corporation Tax Act 2010, Part 8A — Patent Box',
          'Capital Allowances Act 2001 — Annual Investment Allowance',
          'Finance Act 2023 — marginal relief reintroduction',
        ],
        warnings
      )
    } catch (error) {
      log.error('UK corporation tax analysis failed', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      })
      return this.createErrorResult<UKCorporationTaxAnalysis>(
        'UKCorporationTaxEngine',
        startTime,
        `UK corporation tax analysis failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}

// ─── Exported Analysis Function ──────────────────────────────────────

/**
 * Analyse UK corporation tax liability.
 *
 * @param tenantId - Organisation identifier
 * @param financialYear - UK tax year (e.g. 'UK2025-26')
 * @param taxableProfit - Taxable total profits in GBP
 * @param associatedCompanies - Number of associated companies (0 if none)
 * @param options - Optional engine configuration
 * @returns Comprehensive corporation tax analysis with confidence score
 */
export async function analyzeUKCorporationTax(
  tenantId: string,
  financialYear: string,
  taxableProfit: number,
  associatedCompanies: number,
  options?: EngineOptions & {
    rdExpenditure?: number
    patentProfits?: number
    capitalExpenditure?: number
    currentYearLoss?: number
    isSME?: boolean
  }
): Promise<EngineResult<UKCorporationTaxAnalysis>> {
  const engine = new UKCorporationTaxEngine()
  return engine.analyze(tenantId, financialYear, taxableProfit, associatedCompanies, options)
}
