/**
 * NZ GST Analysis Engine
 *
 * Analyses Goods and Services Tax obligations for New Zealand entities.
 *
 * Key Legislation:
 * - Goods and Services Tax Act 1985 (NZ) — core GST framework
 * - s 8: Imposition of GST at 15% on taxable supplies
 * - s 11: Zero-rated supplies (exported services, going concerns, land)
 * - s 14: Exempt supplies (financial services, residential accommodation)
 * - s 20: Calculation of tax payable (output tax minus input tax)
 * - s 51: Registration threshold ($60,000 turnover in 12 months)
 *
 * GST Return Frequencies (s 15):
 * - Monthly: taxable supplies > $24M or voluntary
 * - Two-monthly: default for most registered persons
 * - Six-monthly: taxable supplies < $500,000
 */

import Decimal from 'decimal.js'
import { BaseTaxEngine } from '@/lib/analysis/base-engine'
import type { EngineResult, EngineOptions } from '@/lib/analysis/base-engine'
import { createLogger } from '@/lib/logger'
import { getNZGSTPeriod } from '@/lib/utils/financial-year'

const log = createLogger('analysis:nz:gst')

// ─── Constants ────────────────────────────────────────────────────────

const FALLBACK_GST_RATE = 15
const REGISTRATION_THRESHOLD = 60_000 // $60,000 in 12 months (s 51)
const MONTHLY_THRESHOLD = 24_000_000 // $24M for mandatory monthly filing
const SIX_MONTHLY_THRESHOLD = 500_000 // $500K for six-monthly eligibility

// ─── Supply Classifications ───────────────────────────────────────────

const ZERO_RATED_CATEGORIES = [
  'exported_goods',
  'exported_services',
  'going_concern',
  'land_supply',
  'fine_metals',
  'duty_free_goods',
  'international_transport',
] as const

const EXEMPT_CATEGORIES = [
  'financial_services',
  'residential_accommodation',
  'donated_goods_nonprofit',
  'penalty_interest',
  'life_insurance',
] as const

export type SupplyType = 'standard' | 'zero_rated' | 'exempt'

// ─── Types ────────────────────────────────────────────────────────────

export interface GSTTransaction {
  id: string
  date: string
  description: string
  amount: number // GST-exclusive amount in NZD
  gstAmount?: number // GST component, if known
  supplyType?: SupplyType
  category?: string
  isInput: boolean // true = purchase (input tax credit), false = supply (output tax)
}

export interface GSTSupplySummary {
  standardRatedSupplies: number
  zeroRatedSupplies: number
  exemptSupplies: number
  totalOutputTax: number
  totalInputTax: number
  gstPayable: number // output - input (positive = owe IRD, negative = refund)
}

export interface GSTReturnPeriod {
  periodStart: string
  periodEnd: string
  dueDate: string
  label: string
  frequency: 'monthly' | 'two-monthly' | 'six-monthly'
}

export interface NZGSTAnalysis {
  /** Summary of GST across all supply types */
  supplySummary: GSTSupplySummary
  /** Whether the entity must be GST-registered */
  registrationRequired: boolean
  /** Current or recommended GST return frequency */
  returnFrequency: 'monthly' | 'two-monthly' | 'six-monthly'
  /** Return periods within the financial year */
  returnPeriods: GSTReturnPeriod[]
  /** Total turnover for threshold analysis */
  totalTurnover: number
  /** Effective GST rate applied */
  gstRate: number
  /** Input tax credits claimable */
  inputTaxCredits: number
  /** Net GST position (positive = payable, negative = refundable) */
  netGSTPosition: number
  /** Recommendations for GST optimisation */
  recommendations: string[]
  /** Legislative references cited in analysis */
  legislativeRefs: string[]
}

// ─── Engine ───────────────────────────────────────────────────────────

export class NZGSTEngine extends BaseTaxEngine {
  constructor() {
    super('NZ')
  }

  /**
   * Classify a transaction's supply type based on category keywords.
   */
  classifySupplyType(category: string | undefined, description: string): SupplyType {
    const text = `${category ?? ''} ${description}`.toLowerCase()

    for (const zr of ZERO_RATED_CATEGORIES) {
      if (text.includes(zr.replace(/_/g, ' ')) || text.includes(zr.replace(/_/g, ''))) {
        return 'zero_rated'
      }
    }

    if (
      text.includes('export') ||
      text.includes('overseas') ||
      text.includes('international') ||
      text.includes('fine metal') ||
      text.includes('going concern')
    ) {
      return 'zero_rated'
    }

    for (const ex of EXEMPT_CATEGORIES) {
      if (text.includes(ex.replace(/_/g, ' ')) || text.includes(ex.replace(/_/g, ''))) {
        return 'exempt'
      }
    }

    if (
      text.includes('financial service') ||
      text.includes('residential rent') ||
      text.includes('residential accommodation') ||
      text.includes('life insurance')
    ) {
      return 'exempt'
    }

    return 'standard'
  }

  /**
   * Determine the appropriate GST return frequency based on turnover.
   */
  determineFrequency(annualTurnover: number): 'monthly' | 'two-monthly' | 'six-monthly' {
    if (annualTurnover >= MONTHLY_THRESHOLD) return 'monthly'
    if (annualTurnover < SIX_MONTHLY_THRESHOLD) return 'six-monthly'
    return 'two-monthly'
  }

  /**
   * Calculate GST on a GST-exclusive amount.
   */
  calculateGST(exclusiveAmount: number, rate: number): number {
    return this.roundCurrency(this.decimal(exclusiveAmount).mul(this.decimal(rate).div(100)))
  }

  /**
   * Extract GST from a GST-inclusive amount.
   */
  extractGST(inclusiveAmount: number, rate: number): number {
    const rateDecimal = this.decimal(rate).div(100)
    const divisor = this.decimal(1).plus(rateDecimal)
    const exclusive = this.decimal(inclusiveAmount).div(divisor)
    return this.roundCurrency(this.decimal(inclusiveAmount).minus(exclusive))
  }

  /**
   * Generate GST return periods for a financial year.
   */
  generateReturnPeriods(
    financialYear: string,
    frequency: 'monthly' | 'two-monthly' | 'six-monthly'
  ): GSTReturnPeriod[] {
    const periods: GSTReturnPeriod[] = []

    const match = financialYear.match(/^NZ(\d{4})-(\d{2})$/)
    if (!match) return periods

    const startYear = parseInt(match[1], 10)
    const monthCount =
      frequency === 'monthly' ? 12 : frequency === 'two-monthly' ? 6 : 2
    const stepMonths =
      frequency === 'monthly' ? 1 : frequency === 'two-monthly' ? 2 : 6

    for (let i = 0; i < monthCount; i++) {
      const monthOffset = i * stepMonths
      const periodDate = new Date(startYear, 3 + monthOffset, 15)
      const period = getNZGSTPeriod(periodDate, frequency)

      periods.push({
        periodStart: period.periodStart.toISOString().split('T')[0],
        periodEnd: period.periodEnd.toISOString().split('T')[0],
        dueDate: period.dueDate.toISOString().split('T')[0],
        label: period.label,
        frequency,
      })
    }

    return periods
  }

  /**
   * Run the full GST analysis. Uses `this` to access protected BaseTaxEngine helpers.
   */
  async analyze(
    tenantId: string,
    financialYear: string,
    transactions: GSTTransaction[],
    _options?: EngineOptions
  ): Promise<EngineResult<NZGSTAnalysis>> {
    const startTime = Date.now()
    const engineName = 'nz-gst-engine'

    log.info('Starting NZ GST analysis', { tenantId, financialYear, txCount: transactions.length })

    try {
      const gstRate = await this.getTaxRateWithFallback('gst', 'standard_rate', FALLBACK_GST_RATE)

      let standardRatedSupplies = new Decimal(0)
      let zeroRatedSupplies = new Decimal(0)
      let exemptSupplies = new Decimal(0)
      let totalOutputTax = new Decimal(0)
      let totalInputTax = new Decimal(0)
      let totalTurnover = new Decimal(0)

      const warnings: string[] = []

      for (const tx of transactions) {
        const supplyType = tx.supplyType ?? this.classifySupplyType(tx.category, tx.description)
        const amount = new Decimal(tx.amount)

        if (!tx.isInput) {
          totalTurnover = totalTurnover.plus(amount)

          switch (supplyType) {
            case 'standard': {
              standardRatedSupplies = standardRatedSupplies.plus(amount)
              const gst = tx.gstAmount
                ? new Decimal(tx.gstAmount)
                : amount.mul(new Decimal(gstRate).div(100))
              totalOutputTax = totalOutputTax.plus(gst)
              break
            }
            case 'zero_rated':
              zeroRatedSupplies = zeroRatedSupplies.plus(amount)
              break
            case 'exempt':
              exemptSupplies = exemptSupplies.plus(amount)
              break
          }
        } else {
          if (supplyType !== 'exempt') {
            const gst = tx.gstAmount
              ? new Decimal(tx.gstAmount)
              : amount.mul(new Decimal(gstRate).div(100))
            totalInputTax = totalInputTax.plus(gst)
          }
        }
      }

      const netGST = totalOutputTax.minus(totalInputTax)
      const turnoverNum = this.roundCurrency(totalTurnover)

      const registrationRequired = turnoverNum >= REGISTRATION_THRESHOLD
      const returnFrequency = this.determineFrequency(turnoverNum)
      const returnPeriods = this.generateReturnPeriods(financialYear, returnFrequency)

      const recommendations: string[] = []

      if (!registrationRequired && turnoverNum > REGISTRATION_THRESHOLD * 0.8) {
        recommendations.push(
          `Turnover of $${turnoverNum.toLocaleString('en-NZ')} is approaching the $60,000 GST registration threshold. ` +
          'Monitor closely and register before exceeding the threshold (s 51 GST Act 1985).'
        )
      }

      if (registrationRequired) {
        recommendations.push(
          'Entity is required to be GST-registered (turnover exceeds $60,000 in 12 months, s 51 GST Act 1985).'
        )
      }

      const exemptRatio = exemptSupplies.toNumber() / (totalTurnover.toNumber() || 1)
      if (exemptRatio > 0.1) {
        recommendations.push(
          'Significant exempt supplies detected. Review input tax credit apportionment — ' +
          'input tax on costs related to exempt supplies is not claimable (s 20(3H) GST Act 1985).'
        )
        warnings.push('Input tax credit apportionment may be required due to mixed supplies.')
      }

      if (netGST.isNegative()) {
        recommendations.push(
          `GST refund position of $${Math.abs(this.roundCurrency(netGST)).toLocaleString('en-NZ')}. ` +
          'Ensure supporting documentation is retained for IRD review (s 75 Tax Administration Act 1994).'
        )
      }

      if (returnFrequency === 'two-monthly' && turnoverNum < SIX_MONTHLY_THRESHOLD) {
        recommendations.push(
          'Turnover is below $500,000 — entity may be eligible for six-monthly GST filing (s 15(4) GST Act 1985). ' +
          'Consider switching to reduce compliance burden.'
        )
      }

      const legislativeRefs = [
        'Goods and Services Tax Act 1985 (NZ), s 8 — Imposition of GST',
        'Goods and Services Tax Act 1985 (NZ), s 11 — Zero-rated supplies',
        'Goods and Services Tax Act 1985 (NZ), s 14 — Exempt supplies',
        'Goods and Services Tax Act 1985 (NZ), s 20 — Calculation of tax payable',
        'Goods and Services Tax Act 1985 (NZ), s 51 — Registration',
      ]

      const analysis: NZGSTAnalysis = {
        supplySummary: {
          standardRatedSupplies: this.roundCurrency(standardRatedSupplies),
          zeroRatedSupplies: this.roundCurrency(zeroRatedSupplies),
          exemptSupplies: this.roundCurrency(exemptSupplies),
          totalOutputTax: this.roundCurrency(totalOutputTax),
          totalInputTax: this.roundCurrency(totalInputTax),
          gstPayable: this.roundCurrency(netGST),
        },
        registrationRequired,
        returnFrequency,
        returnPeriods,
        totalTurnover: turnoverNum,
        gstRate,
        inputTaxCredits: this.roundCurrency(totalInputTax),
        netGSTPosition: this.roundCurrency(netGST),
        recommendations,
        legislativeRefs,
      }

      log.info('NZ GST analysis complete', {
        tenantId,
        netGST: this.roundCurrency(netGST),
        turnover: turnoverNum,
        durationMs: Date.now() - startTime,
      })

      return this.createResult(engineName, startTime, analysis, 0.90, legislativeRefs, warnings)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      log.error('NZ GST analysis failed', { tenantId, error: message })
      return this.createErrorResult<NZGSTAnalysis>(engineName, startTime, message)
    }
  }
}

// ─── Singleton Engine Instance ────────────────────────────────────────

const engine = new NZGSTEngine()

// ─── Public Analysis Function ─────────────────────────────────────────

/**
 * Analyse NZ GST obligations for a tenant.
 *
 * @param tenantId - Organisation/tenant identifier
 * @param financialYear - NZ financial year (e.g. 'NZ2025-26')
 * @param transactions - Array of GST transactions to analyse
 * @param options - Engine configuration options
 * @returns GST analysis result with supply summary, return periods, and recommendations
 */
export async function analyzeNZGST(
  tenantId: string,
  financialYear: string,
  transactions: GSTTransaction[],
  options?: EngineOptions
): Promise<EngineResult<NZGSTAnalysis>> {
  return engine.analyze(tenantId, financialYear, transactions, options)
}
