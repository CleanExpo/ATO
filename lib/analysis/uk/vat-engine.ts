/**
 * UK VAT Analysis Engine
 *
 * Analyses Value Added Tax obligations, liability, and compliance
 * for UK-registered businesses.
 *
 * Key Legislation:
 * - Value Added Tax Act 1994 (VATA 1994)
 * - VAT Regulations 1995 (SI 1995/2518)
 * - Finance Act 2022 (Making Tax Digital)
 *
 * VAT Rates:
 * - Standard rate: 20% (VATA 1994, s 2(1))
 * - Reduced rate: 5% (VATA 1994, Sch 7A)
 * - Zero rate: 0% (VATA 1994, Sch 8)
 *
 * Registration threshold: GBP 90,000 (from 1 April 2024)
 * Deregistration threshold: GBP 88,000
 */

import Decimal from 'decimal.js'
import { BaseTaxEngine } from '@/lib/analysis/base-engine'
import type { EngineResult, EngineOptions } from '@/lib/analysis/base-engine'
import { getUKVATQuarter } from '@/lib/utils/financial-year'
import { createLogger } from '@/lib/logger'

const log = createLogger('analysis:uk-vat')

// ─── Types ───────────────────────────────────────────────────────────

export type VATRateCategory = 'standard' | 'reduced' | 'zero' | 'exempt' | 'outside_scope'

export interface VATTransaction {
  id: string
  date: string // ISO date
  description: string
  netAmount: number // GBP exclusive of VAT
  vatAmount: number
  vatRate: number
  category: VATRateCategory
  isInput: boolean // true = purchase (input VAT), false = sale (output VAT)
}

export interface VATReturnPeriod {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  periodStart: string
  periodEnd: string
  dueDate: string
  outputVAT: number
  inputVAT: number
  netVAT: number // positive = owed to HMRC, negative = refund due
  label: string
}

export interface FlatRateSchemeAnalysis {
  eligible: boolean
  flatRatePercentage: number | null
  vatUnderFlatRate: number
  vatUnderStandard: number
  savings: number
  recommendation: string
}

export interface PartialExemptionAnalysis {
  totalInputVAT: number
  attributableToTaxable: number
  attributableToExempt: number
  residualInputVAT: number
  recoverablePercentage: number
  recoverableAmount: number
  irrecoverableAmount: number
}

export interface MTDComplianceCheck {
  compliant: boolean
  issues: string[]
  recommendations: string[]
  quarterlyReturns: VATReturnPeriod[]
}

export interface UKVATAnalysis {
  // Registration assessment
  registrationRequired: boolean
  taxableTurnover: number
  registrationThreshold: number
  headroomToThreshold: number

  // VAT liability
  totalOutputVAT: number
  totalInputVAT: number
  netVATLiability: number

  // Breakdown by rate category
  standardRatedSales: number
  reducedRatedSales: number
  zeroRatedSales: number
  exemptSales: number

  // Quarterly returns
  quarterlyReturns: VATReturnPeriod[]

  // Flat Rate Scheme analysis
  flatRateScheme: FlatRateSchemeAnalysis

  // Partial exemption (if applicable)
  partialExemption: PartialExemptionAnalysis | null

  // Making Tax Digital compliance
  mtdCompliance: MTDComplianceCheck

  // Reverse charge
  reverseChargeApplied: boolean
  reverseChargeAmount: number

  // Recommendations
  recommendations: string[]
}

// ─── Fallback Rates ──────────────────────────────────────────────────

const FALLBACK_VAT_STANDARD_RATE = 20
const FALLBACK_VAT_REDUCED_RATE = 5
const FALLBACK_VAT_REGISTRATION_THRESHOLD = 90_000
const FALLBACK_VAT_DEREGISTRATION_THRESHOLD = 88_000

/**
 * Flat Rate Scheme percentages by sector (simplified).
 * HMRC publishes a full list — these cover common categories.
 */
const FLAT_RATE_PERCENTAGES: Record<string, number> = {
  'accountancy': 14.5,
  'advertising': 11,
  'architecture': 14.5,
  'computer_repair': 10.5,
  'computer_consultancy': 14.5,
  'estate_agency': 12,
  'general': 12,
  'hairdressing': 13,
  'hotel': 10.5,
  'labour_only_building': 14.5,
  'legal_services': 14.5,
  'management_consultancy': 14,
  'photography': 11,
  'publishing': 11,
  'restaurant': 12.5,
  'retail_food': 4,
  'retail_other': 7.5,
  'secretary': 13,
  'transport': 10,
}

// ─── Engine ──────────────────────────────────────────────────────────

export class UKVATEngine extends BaseTaxEngine {
  constructor() {
    super('UK')
  }

  /**
   * Classify a transaction's VAT rate category based on the applied rate.
   */
  classifyVATRate(rate: number): VATRateCategory {
    if (rate === 0) return 'zero'
    if (rate === 5) return 'reduced'
    if (rate === 20) return 'standard'
    if (rate < 0) return 'outside_scope'
    return 'exempt'
  }

  /**
   * Calculate VAT registration requirement based on taxable turnover.
   *
   * VATA 1994, Sch 1, para 1:
   * A person must register if taxable turnover in the past 12 months
   * exceeds the registration threshold, or is expected to exceed it
   * in the next 30 days alone.
   */
  assessRegistration(
    taxableTurnover: number,
    threshold: number
  ): { required: boolean; headroom: number } {
    return {
      required: taxableTurnover > threshold,
      headroom: threshold - taxableTurnover,
    }
  }

  /**
   * Calculate output VAT for a sale at the given rate.
   */
  calculateOutputVAT(netAmount: number, rate: number): number {
    return this.roundCurrency(this.decimal(netAmount).mul(this.decimal(rate).div(100)))
  }

  /**
   * Calculate the Flat Rate Scheme VAT liability.
   *
   * Under FRS, VAT is calculated as a percentage of gross (VAT-inclusive) turnover.
   * Businesses keep the difference between VAT charged and the flat rate amount.
   *
   * First-year discount: 1% reduction in the flat rate percentage.
   */
  calculateFlatRate(
    grossTurnover: number,
    sectorKey: string,
    isFirstYear: boolean
  ): FlatRateSchemeAnalysis {
    const baseFlatRate = FLAT_RATE_PERCENTAGES[sectorKey] ?? FLAT_RATE_PERCENTAGES['general']
    const flatRatePercentage = isFirstYear
      ? Math.max(baseFlatRate - 1, 0)
      : baseFlatRate

    const vatUnderFlatRate = this.roundCurrency(
      this.decimal(grossTurnover).mul(this.decimal(flatRatePercentage).div(100))
    )

    // Compare with standard scheme: output VAT = gross / 1.2 * 0.2 = gross / 6
    const vatUnderStandard = this.roundCurrency(this.decimal(grossTurnover).div(6))
    const savings = this.roundCurrency(this.decimal(vatUnderStandard).sub(vatUnderFlatRate))

    // FRS eligible if taxable turnover <= GBP 150,000
    const eligible = grossTurnover <= 150_000

    return {
      eligible,
      flatRatePercentage,
      vatUnderFlatRate,
      vatUnderStandard,
      savings,
      recommendation: savings > 0
        ? `Flat Rate Scheme would save GBP ${savings.toLocaleString('en-GB')} per year at ${flatRatePercentage}% rate`
        : 'Standard VAT scheme is more beneficial for this business',
    }
  }

  /**
   * Calculate partial exemption recovery using the standard method.
   *
   * VAT Regulations 1995, reg 101:
   * Residual input VAT is apportioned based on the ratio of taxable
   * supplies to total supplies (rounded up to the nearest whole percentage).
   *
   * De minimis rule: If irrecoverable input VAT is both:
   *   (a) GBP 625 or less per month on average, AND
   *   (b) 50% or less of total input VAT
   * then ALL input VAT is recoverable.
   */
  calculatePartialExemption(
    totalInputVAT: number,
    attributableToTaxable: number,
    attributableToExempt: number,
    taxableSupplies: number,
    totalSupplies: number
  ): PartialExemptionAnalysis {
    const residualInputVAT = this.roundCurrency(
      this.decimal(totalInputVAT)
        .sub(attributableToTaxable)
        .sub(attributableToExempt)
    )

    // Standard method: taxable supplies / total supplies (rounded up)
    let recoverablePercentage = 0
    if (totalSupplies > 0) {
      recoverablePercentage = Math.ceil(
        this.decimal(taxableSupplies).div(totalSupplies).mul(100).toNumber()
      )
    }
    recoverablePercentage = Math.min(recoverablePercentage, 100)

    const recoverableResidual = this.roundCurrency(
      this.decimal(residualInputVAT).mul(this.decimal(recoverablePercentage).div(100))
    )

    const totalRecoverable = this.roundCurrency(
      this.decimal(attributableToTaxable).add(recoverableResidual)
    )

    const irrecoverable = this.roundCurrency(
      this.decimal(totalInputVAT).sub(totalRecoverable)
    )

    return {
      totalInputVAT,
      attributableToTaxable,
      attributableToExempt,
      residualInputVAT,
      recoverablePercentage,
      recoverableAmount: totalRecoverable,
      irrecoverableAmount: irrecoverable,
    }
  }

  /**
   * Group transactions into quarterly VAT return periods.
   */
  groupByQuarter(transactions: VATTransaction[]): Map<string, VATTransaction[]> {
    const quarters = new Map<string, VATTransaction[]>()

    for (const txn of transactions) {
      const date = new Date(txn.date)
      const quarter = getUKVATQuarter(date)
      const key = quarter.label

      if (!quarters.has(key)) {
        quarters.set(key, [])
      }
      quarters.get(key)!.push(txn)
    }

    return quarters
  }

  /**
   * Build a VAT return period from a group of transactions.
   */
  buildReturnPeriod(quarterLabel: string, transactions: VATTransaction[]): VATReturnPeriod {
    let outputVAT = new Decimal(0)
    let inputVAT = new Decimal(0)

    for (const txn of transactions) {
      if (txn.isInput) {
        inputVAT = inputVAT.add(txn.vatAmount)
      } else {
        outputVAT = outputVAT.add(txn.vatAmount)
      }
    }

    const netVAT = outputVAT.sub(inputVAT)

    // Derive period dates from first transaction
    const firstDate = new Date(transactions[0].date)
    const quarter = getUKVATQuarter(firstDate)

    return {
      quarter: quarter.quarter,
      periodStart: quarter.periodStart.toISOString().split('T')[0],
      periodEnd: quarter.periodEnd.toISOString().split('T')[0],
      dueDate: quarter.dueDate.toISOString().split('T')[0],
      outputVAT: this.roundCurrency(outputVAT),
      inputVAT: this.roundCurrency(inputVAT),
      netVAT: this.roundCurrency(netVAT),
      label: quarterLabel,
    }
  }

  /**
   * Check Making Tax Digital compliance requirements.
   *
   * Finance Act 2022:
   * All VAT-registered businesses must keep digital records
   * and submit VAT returns using MTD-compatible software.
   */
  checkMTDCompliance(
    isVATRegistered: boolean,
    quarterlyReturns: VATReturnPeriod[]
  ): MTDComplianceCheck {
    const issues: string[] = []
    const recommendations: string[] = []

    if (!isVATRegistered) {
      return {
        compliant: true,
        issues: [],
        recommendations: ['Register for VAT if taxable turnover approaches GBP 90,000 threshold'],
        quarterlyReturns,
      }
    }

    // Check quarterly return coverage
    if (quarterlyReturns.length < 4) {
      issues.push(
        `Only ${quarterlyReturns.length} quarterly returns found; 4 expected per year`
      )
    }

    // Check for late filing risk
    const now = new Date()
    for (const qr of quarterlyReturns) {
      const dueDate = new Date(qr.dueDate)
      const periodEnd = new Date(qr.periodEnd)
      const daysBetween = Math.floor(
        (dueDate.getTime() - periodEnd.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysBetween < 30 && now > periodEnd) {
        recommendations.push(
          `${qr.label}: Return due ${qr.dueDate} — ensure submission via MTD-compatible software`
        )
      }
    }

    recommendations.push('Maintain digital links between accounting records and VAT returns')
    recommendations.push('Use MTD-compatible software for all VAT return submissions')

    return {
      compliant: issues.length === 0,
      issues,
      recommendations,
      quarterlyReturns,
    }
  }

  /**
   * Run the full VAT analysis.
   *
   * Public entry point that has access to protected base class methods.
   */
  async analyze(
    tenantId: string,
    financialYear: string,
    transactions: VATTransaction[],
    options?: EngineOptions
  ): Promise<EngineResult<UKVATAnalysis>> {
    const startTime = Date.now()

    log.info('Starting UK VAT analysis', { tenantId, financialYear, txnCount: transactions.length })

    try {
      // Fetch rates with fallback
      const _standardRate = await this.getTaxRateWithFallback(
        'vat', 'standard_rate', FALLBACK_VAT_STANDARD_RATE
      )
      const registrationThreshold = await this.getTaxRateWithFallback(
        'vat', 'registration_threshold', FALLBACK_VAT_REGISTRATION_THRESHOLD
      )

      // Separate input and output transactions
      const outputTransactions = transactions.filter((t) => !t.isInput)
      const inputTransactions = transactions.filter((t) => t.isInput)

      // Calculate totals by rate category
      let standardRatedSales = new Decimal(0)
      let reducedRatedSales = new Decimal(0)
      let zeroRatedSales = new Decimal(0)
      let exemptSales = new Decimal(0)
      let totalOutputVAT = new Decimal(0)
      let totalInputVAT = new Decimal(0)
      const reverseChargeAmount = new Decimal(0)

      for (const txn of outputTransactions) {
        const category = this.classifyVATRate(txn.vatRate)
        const net = new Decimal(txn.netAmount)

        switch (category) {
          case 'standard':
            standardRatedSales = standardRatedSales.add(net)
            break
          case 'reduced':
            reducedRatedSales = reducedRatedSales.add(net)
            break
          case 'zero':
            zeroRatedSales = zeroRatedSales.add(net)
            break
          case 'exempt':
            exemptSales = exemptSales.add(net)
            break
        }
        totalOutputVAT = totalOutputVAT.add(txn.vatAmount)
      }

      for (const txn of inputTransactions) {
        totalInputVAT = totalInputVAT.add(txn.vatAmount)
      }

      // Taxable turnover = standard + reduced + zero rated (not exempt)
      const taxableTurnover = this.roundCurrency(
        standardRatedSales.add(reducedRatedSales).add(zeroRatedSales)
      )

      // Registration assessment
      const registration = this.assessRegistration(taxableTurnover, registrationThreshold)

      // Net VAT liability
      const netVATLiability = this.roundCurrency(totalOutputVAT.sub(totalInputVAT))

      // Group into quarterly returns
      const quarterGroups = this.groupByQuarter(transactions)
      const quarterlyReturns: VATReturnPeriod[] = []
      for (const [label, txns] of quarterGroups) {
        if (txns.length > 0) {
          quarterlyReturns.push(this.buildReturnPeriod(label, txns))
        }
      }

      // Flat Rate Scheme analysis (using gross turnover)
      const grossTurnover = this.roundCurrency(
        standardRatedSales.mul(1.2)
          .add(reducedRatedSales.mul(1.05))
          .add(zeroRatedSales)
      )
      const flatRateScheme = this.calculateFlatRate(grossTurnover, 'general', false)

      // Partial exemption (only if there are exempt supplies)
      let partialExemption: PartialExemptionAnalysis | null = null
      const hasExemptSupplies = exemptSales.greaterThan(0)

      if (hasExemptSupplies) {
        const totalSupplies = this.roundCurrency(
          standardRatedSales.add(reducedRatedSales).add(zeroRatedSales).add(exemptSales)
        )
        // Simplified: attribute 80% to taxable, 10% to exempt, 10% residual
        const inputVATNum = this.roundCurrency(totalInputVAT)
        const attrToTaxable = this.roundCurrency(totalInputVAT.mul(0.8))
        const attrToExempt = this.roundCurrency(totalInputVAT.mul(0.1))

        partialExemption = this.calculatePartialExemption(
          inputVATNum,
          attrToTaxable,
          attrToExempt,
          taxableTurnover,
          totalSupplies
        )
      }

      // MTD compliance check
      const mtdCompliance = this.checkMTDCompliance(
        registration.required || taxableTurnover > 0,
        quarterlyReturns
      )

      // Build recommendations
      const recommendations: string[] = []

      if (!registration.required && registration.headroom < 10_000) {
        recommendations.push(
          `Taxable turnover is within GBP ${registration.headroom.toLocaleString('en-GB')} of the registration threshold. Consider voluntary registration for input VAT recovery.`
        )
      }

      if (flatRateScheme.eligible && flatRateScheme.savings > 500) {
        recommendations.push(flatRateScheme.recommendation)
      }

      if (hasExemptSupplies && partialExemption) {
        recommendations.push(
          `Partial exemption applies: GBP ${partialExemption.irrecoverableAmount.toLocaleString('en-GB')} input VAT is irrecoverable. Review supply categorisation to maximise recovery.`
        )
      }

      if (options?.includeRecommendations !== false) {
        recommendations.push('Review zero-rated and exempt supply classifications annually')
        recommendations.push('Ensure all purchase invoices are VAT-compliant for input tax recovery')
      }

      const warnings: string[] = []
      if (netVATLiability < 0) {
        warnings.push(
          `Net VAT position is a refund of GBP ${Math.abs(netVATLiability).toLocaleString('en-GB')}. HMRC may request verification before processing.`
        )
      }

      const analysis: UKVATAnalysis = {
        registrationRequired: registration.required,
        taxableTurnover,
        registrationThreshold,
        headroomToThreshold: registration.headroom,
        totalOutputVAT: this.roundCurrency(totalOutputVAT),
        totalInputVAT: this.roundCurrency(totalInputVAT),
        netVATLiability,
        standardRatedSales: this.roundCurrency(standardRatedSales),
        reducedRatedSales: this.roundCurrency(reducedRatedSales),
        zeroRatedSales: this.roundCurrency(zeroRatedSales),
        exemptSales: this.roundCurrency(exemptSales),
        quarterlyReturns,
        flatRateScheme,
        partialExemption,
        mtdCompliance,
        reverseChargeApplied: reverseChargeAmount.greaterThan(0),
        reverseChargeAmount: this.roundCurrency(reverseChargeAmount),
        recommendations,
      }

      return this.createResult(
        'UKVATEngine',
        startTime,
        analysis,
        0.90,
        [
          'Value Added Tax Act 1994, s 2(1) — standard rate',
          'Value Added Tax Act 1994, Sch 1, para 1 — registration threshold',
          'Value Added Tax Act 1994, Sch 7A — reduced rate',
          'Value Added Tax Act 1994, Sch 8 — zero rate',
          'VAT Regulations 1995, reg 101 — partial exemption standard method',
          'Finance Act 2022 — Making Tax Digital for VAT',
        ],
        warnings
      )
    } catch (error) {
      log.error('UK VAT analysis failed', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      })
      return this.createErrorResult<UKVATAnalysis>(
        'UKVATEngine',
        startTime,
        `UK VAT analysis failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}

// ─── Exported Analysis Function ──────────────────────────────────────

/**
 * Analyse UK VAT obligations and liability.
 *
 * @param tenantId - Organisation identifier
 * @param financialYear - UK tax year (e.g. 'UK2025-26')
 * @param transactions - Array of VAT transactions
 * @param options - Optional engine configuration
 * @returns Comprehensive VAT analysis with confidence score
 */
export async function analyzeUKVAT(
  tenantId: string,
  financialYear: string,
  transactions: VATTransaction[],
  options?: EngineOptions
): Promise<EngineResult<UKVATAnalysis>> {
  const engine = new UKVATEngine()
  return engine.analyze(tenantId, financialYear, transactions, options)
}
