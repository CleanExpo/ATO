/**
 * NZ Provisional Tax Analysis Engine
 *
 * Analyses provisional tax obligations, compares methods, and calculates
 * instalment dates with use-of-money interest (UOMI) implications.
 *
 * Key Legislation:
 * - Tax Administration Act 1994 (NZ), Part 7 — Provisional Tax
 *   - s RC 1 — Who is a provisional taxpayer
 *   - s RC 5 — Standard method (105% of prior year RIT)
 *   - s RC 6 — Estimation method
 *   - s RC 7 — GST ratio method
 *   - s RC 10 — AIM (Accounting Income Method) via approved software
 *   - s RC 9 — Instalment dates (3 instalments for standard balance date)
 *   - s 120K — Use of money interest on underpayment
 *   - s RC 3 — Safe harbour for new provisional taxpayers
 *
 * Provisional tax threshold: Residual Income Tax (RIT) > $5,000
 *
 * Three instalment dates for standard 31 March balance date:
 *   P1: 28 August
 *   P2: 15 January
 *   P3: 7 May
 */

import Decimal from 'decimal.js'
import { BaseTaxEngine } from '@/lib/analysis/base-engine'
import type { EngineResult, EngineOptions } from '@/lib/analysis/base-engine'
import { createLogger } from '@/lib/logger'

const log = createLogger('analysis:nz:provisional-tax')

// ─── Constants ────────────────────────────────────────────────────────

const PROVISIONAL_TAX_THRESHOLD = 5_000
const STANDARD_UPLIFT = 1.05
const FALLBACK_UOMI_DEBIT_RATE = 10.91 // % p.a.
const FALLBACK_UOMI_CREDIT_RATE = 4.67 // % p.a.
const STANDARD_INSTALMENTS = 3

// ─── Types ────────────────────────────────────────────────────────────

export type ProvisionalTaxMethod = 'standard' | 'estimation' | 'aim'

export interface InstalmentSchedule {
  instalment: string
  dueDate: string
  amountDue: number
  isPast: boolean
}

export interface MethodComparison {
  method: ProvisionalTaxMethod
  totalProvisionalTax: number
  perInstalment: number
  uomiRisk: 'low' | 'medium' | 'high'
  description: string
  advantages: string[]
  disadvantages: string[]
}

export interface UOMICalculation {
  applies: boolean
  dailyRate: number
  estimatedAmount: number
  periodDays: number
  explanation: string
}

export interface NZProvisionalTaxAnalysis {
  provisionalTaxRequired: boolean
  priorYearRIT: number
  estimatedCurrentIncome: number | null
  methodComparison: MethodComparison[]
  recommendedMethod: ProvisionalTaxMethod
  instalmentSchedule: InstalmentSchedule[]
  totalProvisionalTax: number
  uomiAnalysis: UOMICalculation
  safeHarbourEligible: boolean
  recommendations: string[]
  legislativeRefs: string[]
}

export interface ProvisionalTaxOptions extends EngineOptions {
  isNewProvisionalTaxpayer?: boolean
  amountsPaid?: number[]
}

// ─── Engine ───────────────────────────────────────────────────────────

export class NZProvisionalTaxEngine extends BaseTaxEngine {
  constructor() {
    super('NZ')
  }

  /**
   * Calculate standard method: 105% of prior year RIT.
   */
  calculateStandardMethod(priorYearRIT: number): number {
    return this.roundCurrency(this.decimal(priorYearRIT).mul(STANDARD_UPLIFT))
  }

  /**
   * Calculate per-instalment amount.
   */
  calculateInstalmentAmount(totalTax: number, instalments: number = STANDARD_INSTALMENTS): number {
    return this.roundCurrency(this.decimal(totalTax).div(instalments))
  }

  /**
   * Generate instalment schedule for a standard 31 March balance date.
   */
  generateInstalmentSchedule(
    financialYear: string,
    totalTax: number,
    referenceDate: Date = new Date()
  ): InstalmentSchedule[] {
    const match = financialYear.match(/^NZ(\d{4})-(\d{2})$/)
    if (!match) return []

    const startYear = parseInt(match[1], 10)
    const endCentury = match[1].substring(0, 2)
    const endYear = parseInt(`${endCentury}${match[2]}`, 10)

    const perInstalment = this.calculateInstalmentAmount(totalTax)

    const p1Date = new Date(startYear, 7, 28)
    const p2Date = new Date(endYear, 0, 15)
    const p3Date = new Date(endYear, 4, 7)

    return [
      {
        instalment: 'P1',
        dueDate: p1Date.toISOString().split('T')[0],
        amountDue: perInstalment,
        isPast: referenceDate > p1Date,
      },
      {
        instalment: 'P2',
        dueDate: p2Date.toISOString().split('T')[0],
        amountDue: perInstalment,
        isPast: referenceDate > p2Date,
      },
      {
        instalment: 'P3',
        dueDate: p3Date.toISOString().split('T')[0],
        amountDue: this.roundCurrency(
          this.decimal(totalTax).minus(this.decimal(perInstalment).mul(2))
        ),
        isPast: referenceDate > p3Date,
      },
    ]
  }

  /**
   * Calculate use-of-money interest for underpayment.
   */
  calculateUOMI(
    shortfall: number,
    daysLate: number,
    annualRate: number = FALLBACK_UOMI_DEBIT_RATE
  ): number {
    if (shortfall <= 0 || daysLate <= 0) return 0
    const dailyRate = this.decimal(annualRate).div(100).div(365)
    return this.roundCurrency(this.decimal(shortfall).mul(dailyRate).mul(daysLate))
  }

  /**
   * Build method comparison for all three provisional tax methods.
   */
  buildMethodComparison(
    priorYearRIT: number,
    estimatedIncome: number | null
  ): MethodComparison[] {
    const methods: MethodComparison[] = []

    const standardTotal = this.calculateStandardMethod(priorYearRIT)
    methods.push({
      method: 'standard',
      totalProvisionalTax: standardTotal,
      perInstalment: this.calculateInstalmentAmount(standardTotal),
      uomiRisk: 'low',
      description: '105% of prior year residual income tax (s RC 5 TAA 1994)',
      advantages: [
        'Simple to calculate — no ongoing accounting required',
        'UOMI-safe if prior year RIT is accurate and paid on time',
        'No penalties for underpayment if correctly applied',
      ],
      disadvantages: [
        'May overpay if current year income is significantly lower',
        'No adjustment for known income changes',
        '5% uplift can cause cash flow strain',
      ],
    })

    if (estimatedIncome !== null) {
      const estimationTotal = Math.max(0, estimatedIncome)
      methods.push({
        method: 'estimation',
        totalProvisionalTax: estimationTotal,
        perInstalment: this.calculateInstalmentAmount(estimationTotal),
        uomiRisk: estimationTotal < standardTotal * 0.8 ? 'high' : 'medium',
        description: 'Taxpayer estimates current year RIT (s RC 6 TAA 1994)',
        advantages: [
          'Matches payments to actual expected income',
          'Reduces overpayment when income is declining',
          'Flexible — can re-estimate at each instalment',
        ],
        disadvantages: [
          'UOMI exposure if estimate is too low',
          'Requires ongoing income tracking and accounting',
          'No safe harbour — interest accrues from original due dates if underpaid',
        ],
      })
    }

    methods.push({
      method: 'aim',
      totalProvisionalTax: 0,
      perInstalment: 0,
      uomiRisk: 'low',
      description: 'Accounting Income Method — calculated via approved software (s RC 10 TAA 1994)',
      advantages: [
        'Most accurate — based on actual accounting income per period',
        'UOMI-safe when filed correctly through approved software',
        'Monthly or two-monthly payments spread cash flow impact',
        'Automatically adjusts for seasonal income fluctuations',
      ],
      disadvantages: [
        'Requires AIM-capable accounting software (e.g. Xero Tax)',
        'More frequent filing obligations',
        'Only available for entities using approved software',
        'Setup cost and ongoing software requirements',
      ],
    })

    return methods
  }

  /**
   * Run the full provisional tax analysis.
   */
  async analyze(
    tenantId: string,
    financialYear: string,
    priorYearRIT: number,
    estimatedIncome?: number,
    options?: ProvisionalTaxOptions
  ): Promise<EngineResult<NZProvisionalTaxAnalysis>> {
    const startTime = Date.now()
    const engineName = 'nz-provisional-tax-engine'

    log.info('Starting NZ provisional tax analysis', {
      tenantId, financialYear, priorYearRIT, estimatedIncome,
    })

    try {
      const warnings: string[] = []
      const recommendations: string[] = []
      const legislativeRefs: string[] = [
        'Tax Administration Act 1994 (NZ), Part 7 — Provisional Tax',
        'Tax Administration Act 1994 (NZ), s RC 1 — Provisional taxpayer definition',
      ]

      const provisionalTaxRequired = priorYearRIT > PROVISIONAL_TAX_THRESHOLD

      if (!provisionalTaxRequired) {
        const analysis: NZProvisionalTaxAnalysis = {
          provisionalTaxRequired: false,
          priorYearRIT,
          estimatedCurrentIncome: estimatedIncome ?? null,
          methodComparison: [],
          recommendedMethod: 'standard',
          instalmentSchedule: [],
          totalProvisionalTax: 0,
          uomiAnalysis: {
            applies: false,
            dailyRate: 0,
            estimatedAmount: 0,
            periodDays: 0,
            explanation: `Prior year RIT of $${priorYearRIT.toLocaleString('en-NZ')} ` +
              `is below the $5,000 threshold. No provisional tax required (s RC 1 TAA 1994).`,
          },
          safeHarbourEligible: false,
          recommendations: [
            'Residual income tax is below $5,000 — provisional tax is not required. ' +
            'Terminal tax will be due on the terminal tax date.',
          ],
          legislativeRefs,
        }

        return this.createResult(engineName, startTime, analysis, 0.95, legislativeRefs, warnings)
      }

      const methodComparison = this.buildMethodComparison(priorYearRIT, estimatedIncome ?? null)

      let recommendedMethod: ProvisionalTaxMethod = 'standard'

      if (estimatedIncome !== null && estimatedIncome !== undefined) {
        const standardTotal = this.calculateStandardMethod(priorYearRIT)

        if (estimatedIncome < standardTotal * 0.7) {
          recommendedMethod = 'estimation'
          recommendations.push(
            'Estimated current year income is significantly below the standard method amount. ' +
            'The estimation method may better match cash flow, but carries UOMI risk if underpaid (s RC 6 TAA 1994).'
          )
        } else if (estimatedIncome > standardTotal * 1.2) {
          recommendations.push(
            'Standard method is recommended as it provides UOMI protection. ' +
            'The 105% uplift covers modest income growth (s RC 5 TAA 1994).'
          )
        }
      }

      const recommendedComparison = methodComparison.find((m) => m.method === recommendedMethod)
      const totalProvisionalTax = recommendedComparison?.totalProvisionalTax ?? 0

      const instalmentSchedule = this.generateInstalmentSchedule(financialYear, totalProvisionalTax)

      const amountsPaid = options?.amountsPaid ?? []
      const totalPaid = amountsPaid.reduce((sum, p) => sum + p, 0)
      const shortfall = Math.max(0, totalProvisionalTax - totalPaid)

      const now = new Date()
      const pastInstalments = instalmentSchedule.filter((i) => i.isPast)
      let daysLate = 0
      if (pastInstalments.length > 0 && shortfall > 0) {
        const lastPastDate = new Date(pastInstalments[pastInstalments.length - 1].dueDate)
        daysLate = Math.max(0, Math.floor((now.getTime() - lastPastDate.getTime()) / (1000 * 60 * 60 * 24)))
      }

      const uomiAmount = this.calculateUOMI(shortfall, daysLate)

      const uomiAnalysis: UOMICalculation = {
        applies: shortfall > 0 && daysLate > 0,
        dailyRate: this.roundCurrency(
          new Decimal(FALLBACK_UOMI_DEBIT_RATE).div(100).div(365)
        ),
        estimatedAmount: uomiAmount,
        periodDays: daysLate,
        explanation: shortfall > 0
          ? `Shortfall of $${shortfall.toLocaleString('en-NZ')} with ${daysLate} days of potential UOMI ` +
            `at ${FALLBACK_UOMI_DEBIT_RATE}% p.a. Estimated UOMI: $${uomiAmount.toLocaleString('en-NZ')} ` +
            '(s 120K TAA 1994).'
          : 'No UOMI exposure — payments are up to date.',
      }

      if (uomiAmount > 0) {
        warnings.push(
          `Estimated use-of-money interest of $${uomiAmount.toLocaleString('en-NZ')} on provisional tax shortfall.`
        )
      }

      const isNewTaxpayer = options?.isNewProvisionalTaxpayer ?? false
      const safeHarbourEligible = isNewTaxpayer

      if (safeHarbourEligible) {
        recommendations.push(
          'As a new provisional taxpayer, safe harbour provisions may apply — ' +
          'UOMI will not be charged if using the standard or estimation method and ' +
          'reasonable efforts are made to pay on time (s RC 3 TAA 1994).'
        )
        legislativeRefs.push(
          'Tax Administration Act 1994 (NZ), s RC 3 — Safe harbour for new provisional taxpayers'
        )
      }

      const upcomingInstalments = instalmentSchedule.filter((i) => !i.isPast)
      for (const instalment of upcomingInstalments) {
        const dueDate = new Date(instalment.dueDate)
        const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        if (daysUntilDue <= 30 && daysUntilDue > 0) {
          recommendations.push(
            `${instalment.instalment} is due on ${instalment.dueDate} ` +
            `($${instalment.amountDue.toLocaleString('en-NZ')}). ` +
            `${daysUntilDue} days remaining.`
          )
        }
      }

      legislativeRefs.push(
        'Tax Administration Act 1994 (NZ), s RC 5 — Standard method',
        'Tax Administration Act 1994 (NZ), s RC 6 — Estimation method',
        'Tax Administration Act 1994 (NZ), s RC 10 — AIM method',
        'Tax Administration Act 1994 (NZ), s RC 9 — Instalment dates',
        'Tax Administration Act 1994 (NZ), s 120K — Use of money interest'
      )

      const analysis: NZProvisionalTaxAnalysis = {
        provisionalTaxRequired,
        priorYearRIT,
        estimatedCurrentIncome: estimatedIncome ?? null,
        methodComparison,
        recommendedMethod,
        instalmentSchedule,
        totalProvisionalTax,
        uomiAnalysis,
        safeHarbourEligible,
        recommendations,
        legislativeRefs,
      }

      log.info('NZ provisional tax analysis complete', {
        tenantId,
        totalProvisionalTax,
        recommendedMethod,
        durationMs: Date.now() - startTime,
      })

      return this.createResult(engineName, startTime, analysis, 0.88, legislativeRefs, warnings)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      log.error('NZ provisional tax analysis failed', { tenantId, error: message })
      return this.createErrorResult<NZProvisionalTaxAnalysis>(engineName, startTime, message)
    }
  }
}

// ─── Singleton Engine Instance ────────────────────────────────────────

const engine = new NZProvisionalTaxEngine()

// ─── Public Analysis Function ─────────────────────────────────────────

/**
 * Analyse NZ provisional tax obligations.
 *
 * @param tenantId - Organisation/tenant identifier
 * @param financialYear - NZ financial year (e.g. 'NZ2025-26')
 * @param priorYearRIT - Residual Income Tax from the prior year
 * @param estimatedIncome - Estimated current year RIT (optional, for estimation method)
 * @param options - Engine configuration options
 * @returns Provisional tax analysis with method comparison and instalment schedule
 */
export async function analyzeNZProvisionalTax(
  tenantId: string,
  financialYear: string,
  priorYearRIT: number,
  estimatedIncome?: number,
  options?: ProvisionalTaxOptions
): Promise<EngineResult<NZProvisionalTaxAnalysis>> {
  return engine.analyze(tenantId, financialYear, priorYearRIT, estimatedIncome, options)
}
