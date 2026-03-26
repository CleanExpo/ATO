/**
 * NZ KiwiSaver Compliance and Optimisation Engine
 *
 * Analyses KiwiSaver employer obligations, ESCT calculations,
 * employee contribution rate impact, and total remuneration modelling.
 *
 * Key Legislation:
 * - KiwiSaver Act 2006
 *   - s 101B — Compulsory employer contributions (3% minimum)
 *   - s 101D — Employer contribution rates
 *   - s 64 — Employee contribution rates (3%, 4%, 6%, 8%, 10%)
 *   - s 66 — Deduction of contributions from salary/wages
 *
 * - Income Tax Act 2007 (NZ)
 *   - s RD 67 — Employer Superannuation Contribution Tax (ESCT)
 *   - Schedule 1, Table 3 — ESCT rates
 *     (aligned with income tax brackets: 10.5%, 17.5%, 30%, 33%, 39%)
 *
 * ESCT Rate Selection (based on employee's earnings + employer contributions):
 *   $0 – $16,800:        10.5%
 *   $16,801 – $57,600:   17.5%
 *   $57,601 – $84,000:   30%
 *   $84,001 – $216,000:  33%
 *   $216,001+:            39%
 */

import Decimal from 'decimal.js'
import { BaseTaxEngine } from '@/lib/analysis/base-engine'
import type { EngineResult, EngineOptions } from '@/lib/analysis/base-engine'
import type { TaxBracket } from '@/lib/types/jurisdiction'
import { createLogger } from '@/lib/logger'

const log = createLogger('analysis:nz:kiwisaver')

// ─── Constants ────────────────────────────────────────────────────────

const EMPLOYER_MIN_RATE = 3

const EMPLOYEE_RATES = [3, 4, 6, 8, 10] as const

const ESCT_BRACKETS: TaxBracket[] = [
  { min: 0, max: 16_800, rate: 10.5, label: '10.5% on $0 – $16,800' },
  { min: 16_801, max: 57_600, rate: 17.5, label: '17.5% on $16,801 – $57,600' },
  { min: 57_601, max: 84_000, rate: 30, label: '30% on $57,601 – $84,000' },
  { min: 84_001, max: 216_000, rate: 33, label: '33% on $84,001 – $216,000' },
  { min: 216_001, max: null, rate: 39, label: '39% on $216,001+' },
]

// ─── Types ────────────────────────────────────────────────────────────

export interface EmployeeKiwiSaverInput {
  employeeId: string
  name: string
  grossAnnualSalary: number
  employeeContributionRate: number
  employerContributionRate?: number
  onSavingsSuspension?: boolean
  optedOut?: boolean
}

export interface EmployeeKiwiSaverResult {
  employeeId: string
  name: string
  grossAnnualSalary: number
  employeeContribution: number
  employeeRate: number
  employerContribution: number
  employerRate: number
  esctRate: number
  esctAmount: number
  netEmployerCost: number
  takeHomeReduction: number
  totalToFund: number
  onSavingsSuspension: boolean
  optedOut: boolean
}

export interface KiwiSaverSummary {
  totalEmployees: number
  activeMembers: number
  onSuspension: number
  optedOut: number
  totalEmployerContributions: number
  totalESCT: number
  totalEmployerCost: number
  totalEmployeeContributions: number
  totalToFunds: number
  averageEmployerRate: number
  averageESCTRate: number
}

export interface ContributionRateScenario {
  employeeRate: number
  employeeContribution: number
  employerContribution: number
  esctAmount: number
  netToFund: number
  takeHomeImpact: number
}

export interface KiwiSaverAnalysis {
  employeeResults: EmployeeKiwiSaverResult[]
  summary: KiwiSaverSummary
  rateScenarios: ContributionRateScenario[]
  totalRemunerationImpact: number
  recommendations: string[]
  legislativeRefs: string[]
}

// ─── Engine ───────────────────────────────────────────────────────────

export class NZKiwiSaverEngine extends BaseTaxEngine {
  constructor() {
    super('NZ')
  }

  /**
   * Determine the ESCT rate for an employee based on combined earnings.
   * ESCT is a flat rate based on which bracket the combined figure falls into.
   */
  getESCTRate(grossSalary: number, employerContribution: number): number {
    const combined = grossSalary + employerContribution

    for (let i = ESCT_BRACKETS.length - 1; i >= 0; i--) {
      if (combined >= ESCT_BRACKETS[i].min) {
        return ESCT_BRACKETS[i].rate
      }
    }

    return ESCT_BRACKETS[0].rate
  }

  calculateEmployerContribution(grossSalary: number, rate: number): number {
    return this.roundCurrency(this.decimal(grossSalary).mul(this.decimal(rate).div(100)))
  }

  calculateESCT(employerContribution: number, esctRate: number): number {
    return this.roundCurrency(this.decimal(employerContribution).mul(this.decimal(esctRate).div(100)))
  }

  calculateEmployeeContribution(grossSalary: number, rate: number): number {
    return this.roundCurrency(this.decimal(grossSalary).mul(this.decimal(rate).div(100)))
  }

  /**
   * Model different employee contribution rate scenarios.
   */
  modelRateScenarios(
    grossSalary: number,
    employerRate: number,
    currentEmployeeRate: number
  ): ContributionRateScenario[] {
    const currentEmployeeContribution = this.calculateEmployeeContribution(grossSalary, currentEmployeeRate)

    return EMPLOYEE_RATES.map((rate) => {
      const employeeContribution = this.calculateEmployeeContribution(grossSalary, rate)
      const employerContribution = this.calculateEmployerContribution(grossSalary, employerRate)
      const esctRate = this.getESCTRate(grossSalary, employerContribution)
      const esctAmount = this.calculateESCT(employerContribution, esctRate)
      const netToFund = this.roundCurrency(
        new Decimal(employeeContribution).plus(employerContribution).minus(esctAmount)
      )
      const takeHomeImpact = this.roundCurrency(
        new Decimal(employeeContribution).minus(currentEmployeeContribution)
      )

      return {
        employeeRate: rate,
        employeeContribution,
        employerContribution,
        esctAmount,
        netToFund,
        takeHomeImpact,
      }
    })
  }

  /**
   * Run the full KiwiSaver analysis.
   */
  async analyze(
    tenantId: string,
    financialYear: string,
    employees: EmployeeKiwiSaverInput[],
    options?: EngineOptions
  ): Promise<EngineResult<KiwiSaverAnalysis>> {
    const startTime = Date.now()
    const engineName = 'nz-kiwisaver-engine'

    log.info('Starting KiwiSaver analysis', {
      tenantId, financialYear, employeeCount: employees.length,
    })

    try {
      const warnings: string[] = []
      const recommendations: string[] = []
      const legislativeRefs: string[] = [
        'KiwiSaver Act 2006, s 101B — Compulsory employer contributions',
        'KiwiSaver Act 2006, s 101D — Employer contribution rates',
        'KiwiSaver Act 2006, s 64 — Employee contribution rates',
        'Income Tax Act 2007 (NZ), s RD 67 — Employer Superannuation Contribution Tax (ESCT)',
        'Income Tax Act 2007 (NZ), Schedule 1, Table 3 — ESCT rate thresholds',
      ]

      const employeeResults: EmployeeKiwiSaverResult[] = []

      let totalEmployerContributions = new Decimal(0)
      let totalESCT = new Decimal(0)
      let totalEmployerCost = new Decimal(0)
      let totalEmployeeContributions = new Decimal(0)
      let totalToFunds = new Decimal(0)
      let activeMembers = 0
      let suspendedCount = 0
      let optedOutCount = 0

      for (const emp of employees) {
        if (emp.optedOut) {
          optedOutCount++
          employeeResults.push({
            employeeId: emp.employeeId,
            name: emp.name,
            grossAnnualSalary: emp.grossAnnualSalary,
            employeeContribution: 0,
            employeeRate: 0,
            employerContribution: 0,
            employerRate: 0,
            esctRate: 0,
            esctAmount: 0,
            netEmployerCost: 0,
            takeHomeReduction: 0,
            totalToFund: 0,
            onSavingsSuspension: false,
            optedOut: true,
          })
          continue
        }

        if (emp.onSavingsSuspension) {
          suspendedCount++
          const employerRate = Math.max(emp.employerContributionRate ?? EMPLOYER_MIN_RATE, EMPLOYER_MIN_RATE)
          const employerContribution = this.calculateEmployerContribution(emp.grossAnnualSalary, employerRate)
          const esctRate = this.getESCTRate(emp.grossAnnualSalary, employerContribution)
          const esctAmount = this.calculateESCT(employerContribution, esctRate)
          const netCost = this.roundCurrency(new Decimal(employerContribution).plus(esctAmount))

          totalEmployerContributions = totalEmployerContributions.plus(employerContribution)
          totalESCT = totalESCT.plus(esctAmount)
          totalEmployerCost = totalEmployerCost.plus(netCost)
          totalToFunds = totalToFunds.plus(new Decimal(employerContribution).minus(esctAmount))

          employeeResults.push({
            employeeId: emp.employeeId,
            name: emp.name,
            grossAnnualSalary: emp.grossAnnualSalary,
            employeeContribution: 0,
            employeeRate: 0,
            employerContribution,
            employerRate,
            esctRate,
            esctAmount,
            netEmployerCost: netCost,
            takeHomeReduction: 0,
            totalToFund: this.roundCurrency(new Decimal(employerContribution).minus(esctAmount)),
            onSavingsSuspension: true,
            optedOut: false,
          })
          continue
        }

        // Active member
        activeMembers++

        const employeeRate = EMPLOYEE_RATES.includes(emp.employeeContributionRate as typeof EMPLOYEE_RATES[number])
          ? emp.employeeContributionRate
          : 3

        if (!EMPLOYEE_RATES.includes(emp.employeeContributionRate as typeof EMPLOYEE_RATES[number])) {
          warnings.push(
            `Employee ${emp.name} has non-standard contribution rate of ${emp.employeeContributionRate}%. ` +
            'Defaulting to 3%. Valid rates are 3%, 4%, 6%, 8%, or 10% (s 64 KiwiSaver Act 2006).'
          )
        }

        const employerRate = Math.max(emp.employerContributionRate ?? EMPLOYER_MIN_RATE, EMPLOYER_MIN_RATE)

        if (emp.employerContributionRate !== undefined && emp.employerContributionRate < EMPLOYER_MIN_RATE) {
          warnings.push(
            `Employee ${emp.name}: employer contribution rate of ${emp.employerContributionRate}% ` +
            `is below the 3% minimum. Adjusted to ${EMPLOYER_MIN_RATE}% (s 101B KiwiSaver Act 2006).`
          )
        }

        const employeeContribution = this.calculateEmployeeContribution(emp.grossAnnualSalary, employeeRate)
        const employerContribution = this.calculateEmployerContribution(emp.grossAnnualSalary, employerRate)
        const esctRate = this.getESCTRate(emp.grossAnnualSalary, employerContribution)
        const esctAmount = this.calculateESCT(employerContribution, esctRate)
        const netEmployerCost = this.roundCurrency(new Decimal(employerContribution).plus(esctAmount))
        const netToFund = this.roundCurrency(
          new Decimal(employeeContribution).plus(employerContribution).minus(esctAmount)
        )

        totalEmployerContributions = totalEmployerContributions.plus(employerContribution)
        totalESCT = totalESCT.plus(esctAmount)
        totalEmployerCost = totalEmployerCost.plus(netEmployerCost)
        totalEmployeeContributions = totalEmployeeContributions.plus(employeeContribution)
        totalToFunds = totalToFunds.plus(netToFund)

        employeeResults.push({
          employeeId: emp.employeeId,
          name: emp.name,
          grossAnnualSalary: emp.grossAnnualSalary,
          employeeContribution,
          employeeRate,
          employerContribution,
          employerRate,
          esctRate,
          esctAmount,
          netEmployerCost,
          takeHomeReduction: employeeContribution,
          totalToFund: netToFund,
          onSavingsSuspension: false,
          optedOut: false,
        })
      }

      // Summary
      const totalEmployees = employees.length
      const activeSalaryTotal = employeeResults
        .filter((e) => !e.optedOut && !e.onSavingsSuspension)
        .reduce((sum, e) => new Decimal(sum).plus(e.grossAnnualSalary), new Decimal(0))

      const avgEmployerRate = activeMembers > 0 && activeSalaryTotal.gt(0)
        ? this.roundCurrency(totalEmployerContributions.div(activeSalaryTotal).mul(100))
        : 0

      const nonOptedOut = employeeResults.filter((e) => !e.optedOut)
      const avgESCTRate = nonOptedOut.length > 0
        ? this.roundCurrency(
            new Decimal(nonOptedOut.reduce((sum, e) => sum + e.esctRate, 0)).div(nonOptedOut.length)
          )
        : 0

      const summary: KiwiSaverSummary = {
        totalEmployees,
        activeMembers,
        onSuspension: suspendedCount,
        optedOut: optedOutCount,
        totalEmployerContributions: this.roundCurrency(totalEmployerContributions),
        totalESCT: this.roundCurrency(totalESCT),
        totalEmployerCost: this.roundCurrency(totalEmployerCost),
        totalEmployeeContributions: this.roundCurrency(totalEmployeeContributions),
        totalToFunds: this.roundCurrency(totalToFunds),
        averageEmployerRate: avgEmployerRate,
        averageESCTRate: avgESCTRate,
      }

      // Rate scenarios
      let rateScenarios: ContributionRateScenario[] = []
      const firstActive = employees.find((e) => !e.optedOut && !e.onSavingsSuspension)
      if (firstActive) {
        const empRate = Math.max(firstActive.employerContributionRate ?? EMPLOYER_MIN_RATE, EMPLOYER_MIN_RATE)
        rateScenarios = this.modelRateScenarios(
          firstActive.grossAnnualSalary,
          empRate,
          firstActive.employeeContributionRate
        )
      }

      // Total remuneration impact
      const totalSalaryBill = employees.reduce((sum, e) => sum + e.grossAnnualSalary, 0)
      const totalRemunerationImpact = totalSalaryBill > 0
        ? this.roundCurrency(totalEmployerCost.div(totalSalaryBill).mul(100))
        : 0

      // Recommendations
      if (activeMembers === 0 && totalEmployees > 0) {
        recommendations.push(
          'No active KiwiSaver members found. If employees are eligible, ' +
          'ensure automatic enrolment has been processed (s 12 KiwiSaver Act 2006).'
        )
      }

      if (suspendedCount > 0) {
        recommendations.push(
          `${suspendedCount} employee(s) on savings suspension. Employer contributions continue ` +
          'during suspension but employee deductions are paused. Monitor suspension expiry dates.'
        )
      }

      const highESCTEmployees = employeeResults.filter((e) => e.esctRate >= 33 && !e.optedOut)
      if (highESCTEmployees.length > 0) {
        recommendations.push(
          `${highESCTEmployees.length} employee(s) attract ESCT at 33% or higher. ` +
          'Consider whether total remuneration packaging could be structured to ' +
          'optimise the ESCT impact (s RD 67 ITA 2007).'
        )
      }

      if (totalRemunerationImpact > 5) {
        recommendations.push(
          `Total KiwiSaver employer cost is ${totalRemunerationImpact}% of total salary bill. ` +
          'Ensure this is factored into remuneration budgeting and forecasting.'
        )
      }

      const atMinRate = employeeResults.filter((e) => e.employeeRate === 3 && !e.optedOut && !e.onSavingsSuspension)
      if (atMinRate.length > 0 && options?.includeRecommendations !== false) {
        recommendations.push(
          `${atMinRate.length} employee(s) contributing at the minimum 3% rate. ` +
          'Consider communicating the long-term KiwiSaver benefit of higher contribution rates ' +
          '(4%, 6%, 8%, or 10%) to employees (s 64 KiwiSaver Act 2006).'
        )
      }

      const analysis: KiwiSaverAnalysis = {
        employeeResults,
        summary,
        rateScenarios,
        totalRemunerationImpact,
        recommendations,
        legislativeRefs,
      }

      log.info('KiwiSaver analysis complete', {
        tenantId,
        activeMembers,
        totalEmployerCost: this.roundCurrency(totalEmployerCost),
        durationMs: Date.now() - startTime,
      })

      return this.createResult(engineName, startTime, analysis, 0.92, legislativeRefs, warnings)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      log.error('KiwiSaver analysis failed', { tenantId, error: message })
      return this.createErrorResult<KiwiSaverAnalysis>(engineName, startTime, message)
    }
  }
}

// ─── Singleton Engine Instance ────────────────────────────────────────

const engine = new NZKiwiSaverEngine()

// ─── Public Analysis Function ─────────────────────────────────────────

/**
 * Analyse KiwiSaver compliance and optimisation for a tenant's employees.
 *
 * @param tenantId - Organisation/tenant identifier
 * @param financialYear - NZ financial year (e.g. 'NZ2025-26')
 * @param employees - Array of employee KiwiSaver inputs
 * @param options - Engine configuration options
 * @returns KiwiSaver analysis with per-employee breakdown, summary, and scenarios
 */
export async function analyzeKiwiSaver(
  tenantId: string,
  financialYear: string,
  employees: EmployeeKiwiSaverInput[],
  options?: EngineOptions
): Promise<EngineResult<KiwiSaverAnalysis>> {
  return engine.analyze(tenantId, financialYear, employees, options)
}
