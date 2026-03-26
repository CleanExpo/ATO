/**
 * UK National Insurance Contributions Engine
 *
 * Calculates National Insurance contributions for employees,
 * employers, and self-employed individuals.
 *
 * Key Legislation:
 * - Social Security Contributions and Benefits Act 1992 (SSCBA 1992)
 * - National Insurance Contributions Act 2014
 * - Social Security (Contributions) Regulations 2001 (SI 2001/1004)
 *
 * NI Classes:
 * - Class 1 Primary (employees): 8% on GBP 12,570-50,270, 2% above
 * - Class 1 Secondary (employers): 13.8% above GBP 9,100
 * - Class 1A (benefits in kind): 13.8%
 * - Class 2 (self-employed): GBP 3.45/week if profits > GBP 12,570
 * - Class 4 (self-employed profits): 6% on GBP 12,570-50,270, 2% above
 */

import Decimal from 'decimal.js'
import { BaseTaxEngine } from '@/lib/analysis/base-engine'
import type { EngineResult, EngineOptions } from '@/lib/analysis/base-engine'
import { createLogger } from '@/lib/logger'

const log = createLogger('analysis:uk-national-insurance')

// ─── Types ───────────────────────────────────────────────────────────

export interface Employee {
  id: string
  name: string
  annualGrossSalary: number
  isDirector: boolean
  benefitsInKind?: number // Taxable value of BiK
  salarySacrifice?: number // Annual salary sacrifice amount
  category: NICategory
}

/** NI category letters determine which rates apply */
export type NICategory =
  | 'A' // Standard
  | 'B' // Married women/widows (reduced)
  | 'C' // Over state pension age
  | 'H' // Apprentice under 25
  | 'M' // Under 21
  | 'Z' // Under 21 deferment

export interface EmployeeNIBreakdown {
  employeeId: string
  employeeName: string
  grossSalary: number
  category: NICategory

  // Employee (primary) contributions
  primaryNI: number
  primaryLowerBand: number // 8% band
  primaryUpperBand: number // 2% band

  // Employer (secondary) contributions
  secondaryNI: number
  secondaryNIBeforeAllowance: number

  // Benefits in kind
  class1ANI: number

  // Salary sacrifice analysis
  salarySacrificeAnalysis: SalarySacrificeAnalysis | null

  // Director method
  directorAnnualMethod: boolean

  // Total employer cost
  totalEmployerCost: number
}

export interface SalarySacrificeAnalysis {
  currentSalary: number
  sacrificeAmount: number
  reducedSalary: number
  employeeNISaving: number
  employerNISaving: number
  totalNISaving: number
  recommendation: string
}

export interface SelfEmployedNIBreakdown {
  annualProfits: number

  // Class 2
  class2Applicable: boolean
  class2WeeklyRate: number
  class2AnnualContribution: number
  class2Weeks: number

  // Class 4
  class4LowerBandContribution: number
  class4UpperBandContribution: number
  class4TotalContribution: number

  // Totals
  totalSelfEmployedNI: number
}

export interface EmploymentAllowanceAnalysis {
  eligible: boolean
  allowanceAmount: number
  applied: number
  reason: string
}

export interface UKNationalInsuranceAnalysis {
  // Employee analysis (one per employee)
  employeeBreakdowns: EmployeeNIBreakdown[]

  // Aggregated employer costs
  totalPrimaryNI: number // Total employee NI
  totalSecondaryNI: number // Total employer NI (before allowance)
  totalClass1ANI: number // Total BiK NI

  // Employment Allowance
  employmentAllowance: EmploymentAllowanceAnalysis

  // Net employer NI liability
  netEmployerNI: number

  // Self-employed breakdown (if applicable)
  selfEmployed: SelfEmployedNIBreakdown | null

  // Total NI liability (employer + self-employed)
  totalNILiability: number

  // Salary sacrifice optimisation
  totalSalarySacrificeSavings: number

  // Summary costs
  totalPayrollCost: number // Gross salaries + employer NI + employer pension

  // Recommendations
  recommendations: string[]
}

// ─── Fallback Rates (2024-25 Tax Year) ──────────────────────────────

// Class 1 Primary (employee) thresholds and rates
const FALLBACK_PRIMARY_THRESHOLD = 12_570 // Primary Threshold (PT)
const FALLBACK_UPPER_EARNINGS_LIMIT = 50_270 // Upper Earnings Limit (UEL)
const FALLBACK_PRIMARY_RATE = 8 // 8% between PT and UEL
const FALLBACK_PRIMARY_UPPER_RATE = 2 // 2% above UEL

// Class 1 Secondary (employer) thresholds and rates
const FALLBACK_SECONDARY_THRESHOLD = 9_100 // Secondary Threshold (ST)
const FALLBACK_SECONDARY_RATE = 13.8 // 13.8% above ST

// Class 1A (benefits in kind)
const FALLBACK_CLASS_1A_RATE = 13.8

// Employment Allowance
const FALLBACK_EMPLOYMENT_ALLOWANCE = 5_000

// Class 2 (self-employed)
const FALLBACK_CLASS_2_WEEKLY_RATE = 3.45
const FALLBACK_CLASS_2_PROFIT_THRESHOLD = 12_570
const FALLBACK_WEEKS_IN_YEAR = 52

// Class 4 (self-employed profits)
const FALLBACK_CLASS_4_LOWER_LIMIT = 12_570
const FALLBACK_CLASS_4_UPPER_LIMIT = 50_270
const FALLBACK_CLASS_4_LOWER_RATE = 6 // 6% between lower and upper limits
const FALLBACK_CLASS_4_UPPER_RATE = 2 // 2% above upper limit

// ─── Engine ──────────────────────────────────────────────────────────

export class UKNationalInsuranceEngine extends BaseTaxEngine {
  constructor() {
    super('UK')
  }

  /**
   * Calculate employee (Class 1 Primary) NI contributions.
   *
   * SSCBA 1992, s 6:
   * Primary contributions are payable on earnings between the
   * Primary Threshold and Upper Earnings Limit at 8%,
   * and at 2% on earnings above the UEL.
   *
   * For directors, the annual earnings method is used:
   * total annual earnings are assessed rather than per-pay-period.
   * SSCBA 1992, s 8 — Directors' contributions.
   */
  calculatePrimaryNI(
    annualSalary: number,
    _isDirector: boolean
  ): { total: number; lowerBand: number; upperBand: number } {
    if (annualSalary <= FALLBACK_PRIMARY_THRESHOLD) {
      return { total: 0, lowerBand: 0, upperBand: 0 }
    }

    // Earnings in the 8% band (PT to UEL)
    const earningsInLowerBand = Math.min(
      annualSalary,
      FALLBACK_UPPER_EARNINGS_LIMIT
    ) - FALLBACK_PRIMARY_THRESHOLD

    const lowerBandNI = this.roundCurrency(
      this.decimal(Math.max(0, earningsInLowerBand))
        .mul(this.decimal(FALLBACK_PRIMARY_RATE).div(100))
    )

    // Earnings above UEL (2% band)
    const earningsAboveUEL = Math.max(0, annualSalary - FALLBACK_UPPER_EARNINGS_LIMIT)
    const upperBandNI = this.roundCurrency(
      this.decimal(earningsAboveUEL)
        .mul(this.decimal(FALLBACK_PRIMARY_UPPER_RATE).div(100))
    )

    return {
      total: this.roundCurrency(this.decimal(lowerBandNI).add(upperBandNI)),
      lowerBand: lowerBandNI,
      upperBand: upperBandNI,
    }
  }

  /**
   * Calculate employer (Class 1 Secondary) NI contributions.
   *
   * SSCBA 1992, s 7:
   * Secondary contributions are payable at 13.8% on earnings
   * above the Secondary Threshold.
   *
   * Under-21s and apprentices under 25 (categories M/H):
   * secondary contributions only apply above the Upper Secondary
   * Threshold (GBP 50,270), not the standard Secondary Threshold.
   */
  calculateSecondaryNI(
    annualSalary: number,
    category: NICategory
  ): number {
    // Categories M (under 21) and H (apprentice under 25) have a higher threshold
    const threshold = (category === 'M' || category === 'H')
      ? FALLBACK_UPPER_EARNINGS_LIMIT
      : FALLBACK_SECONDARY_THRESHOLD

    if (annualSalary <= threshold) {
      return 0
    }

    return this.roundCurrency(
      this.decimal(annualSalary - threshold)
        .mul(this.decimal(FALLBACK_SECONDARY_RATE).div(100))
    )
  }

  /**
   * Calculate Class 1A NI on benefits in kind.
   *
   * SSCBA 1992, s 10:
   * Employers pay Class 1A NI at 13.8% on the taxable value
   * of benefits in kind provided to employees.
   */
  calculateClass1ANI(benefitsInKind: number): number {
    if (benefitsInKind <= 0) return 0

    return this.roundCurrency(
      this.decimal(benefitsInKind)
        .mul(this.decimal(FALLBACK_CLASS_1A_RATE).div(100))
    )
  }

  /**
   * Analyse salary sacrifice NI savings.
   *
   * Salary sacrifice reduces both employer and employee NI
   * because the sacrificed amount is no longer "earnings" for
   * NI purposes. Common sacrifices: pension contributions,
   * cycle-to-work, childcare vouchers.
   */
  analyzeSalarySacrifice(
    currentSalary: number,
    sacrificeAmount: number,
    isDirector: boolean,
    category: NICategory
  ): SalarySacrificeAnalysis {
    const reducedSalary = currentSalary - sacrificeAmount

    // Employee NI before and after
    const niBefore = this.calculatePrimaryNI(currentSalary, isDirector)
    const niAfter = this.calculatePrimaryNI(reducedSalary, isDirector)
    const employeeNISaving = this.roundCurrency(
      this.decimal(niBefore.total).sub(niAfter.total)
    )

    // Employer NI before and after
    const employerNIBefore = this.calculateSecondaryNI(currentSalary, category)
    const employerNIAfter = this.calculateSecondaryNI(reducedSalary, category)
    const employerNISaving = this.roundCurrency(
      this.decimal(employerNIBefore).sub(employerNIAfter)
    )

    const totalSaving = this.roundCurrency(
      this.decimal(employeeNISaving).add(employerNISaving)
    )

    return {
      currentSalary,
      sacrificeAmount,
      reducedSalary,
      employeeNISaving,
      employerNISaving,
      totalNISaving: totalSaving,
      recommendation: totalSaving > 0
        ? `Salary sacrifice of GBP ${sacrificeAmount.toLocaleString('en-GB')} saves GBP ${totalSaving.toLocaleString('en-GB')} in total NI (employee: GBP ${employeeNISaving.toLocaleString('en-GB')}, employer: GBP ${employerNISaving.toLocaleString('en-GB')})`
        : 'Salary sacrifice does not generate NI savings at this salary level',
    }
  }

  /**
   * Calculate self-employed NI (Class 2 + Class 4).
   *
   * Class 2 — SSCBA 1992, s 11:
   * Flat-rate weekly contribution of GBP 3.45 if profits exceed GBP 12,570.
   * Voluntary contributions available below the threshold for NI record.
   *
   * Class 4 — SSCBA 1992, s 15:
   * 6% on profits between GBP 12,570 and GBP 50,270.
   * 2% on profits above GBP 50,270.
   */
  calculateSelfEmployedNI(annualProfits: number): SelfEmployedNIBreakdown {
    // Class 2
    const class2Applicable = annualProfits > FALLBACK_CLASS_2_PROFIT_THRESHOLD
    const class2Annual = class2Applicable
      ? this.roundCurrency(
          this.decimal(FALLBACK_CLASS_2_WEEKLY_RATE).mul(FALLBACK_WEEKS_IN_YEAR)
        )
      : 0

    // Class 4 — lower band (6%)
    const class4LowerBandEarnings = Math.max(
      0,
      Math.min(annualProfits, FALLBACK_CLASS_4_UPPER_LIMIT) - FALLBACK_CLASS_4_LOWER_LIMIT
    )
    const class4LowerBand = this.roundCurrency(
      this.decimal(class4LowerBandEarnings)
        .mul(this.decimal(FALLBACK_CLASS_4_LOWER_RATE).div(100))
    )

    // Class 4 — upper band (2%)
    const class4UpperBandEarnings = Math.max(0, annualProfits - FALLBACK_CLASS_4_UPPER_LIMIT)
    const class4UpperBand = this.roundCurrency(
      this.decimal(class4UpperBandEarnings)
        .mul(this.decimal(FALLBACK_CLASS_4_UPPER_RATE).div(100))
    )

    const class4Total = this.roundCurrency(
      this.decimal(class4LowerBand).add(class4UpperBand)
    )

    return {
      annualProfits,
      class2Applicable,
      class2WeeklyRate: FALLBACK_CLASS_2_WEEKLY_RATE,
      class2AnnualContribution: class2Annual,
      class2Weeks: class2Applicable ? FALLBACK_WEEKS_IN_YEAR : 0,
      class4LowerBandContribution: class4LowerBand,
      class4UpperBandContribution: class4UpperBand,
      class4TotalContribution: class4Total,
      totalSelfEmployedNI: this.roundCurrency(
        this.decimal(class2Annual).add(class4Total)
      ),
    }
  }

  /**
   * Assess Employment Allowance eligibility.
   *
   * National Insurance Contributions Act 2014, s 2:
   * Employers can claim up to GBP 5,000 reduction in Class 1 secondary NI.
   *
   * Not eligible if:
   * - Sole employee is a director
   * - Employer is a public body or quasi-public body
   * - Previous year Class 1 secondary NI liability > GBP 100,000
   */
  assessEmploymentAllowance(
    employees: Employee[],
    totalSecondaryNI: number
  ): EmploymentAllowanceAnalysis {
    // Check: sole employee is a director
    if (employees.length === 1 && employees[0].isDirector) {
      return {
        eligible: false,
        allowanceAmount: FALLBACK_EMPLOYMENT_ALLOWANCE,
        applied: 0,
        reason: 'Not eligible: sole employee is a director (NICA 2014, s 2(2))',
      }
    }

    // Check: NI liability cap of GBP 100,000
    if (totalSecondaryNI > 100_000) {
      return {
        eligible: false,
        allowanceAmount: FALLBACK_EMPLOYMENT_ALLOWANCE,
        applied: 0,
        reason: 'Not eligible: previous year Class 1 secondary NI exceeded GBP 100,000',
      }
    }

    const applied = Math.min(FALLBACK_EMPLOYMENT_ALLOWANCE, totalSecondaryNI)

    return {
      eligible: true,
      allowanceAmount: FALLBACK_EMPLOYMENT_ALLOWANCE,
      applied,
      reason: `Employment Allowance of GBP ${applied.toLocaleString('en-GB')} applied against Class 1 secondary NI`,
    }
  }

  /**
   * Run the full National Insurance analysis.
   *
   * Public entry point that has access to protected base class methods.
   */
  async analyze(
    tenantId: string,
    financialYear: string,
    employees: Employee[],
    options?: EngineOptions & {
      selfEmployedProfits?: number
    }
  ): Promise<EngineResult<UKNationalInsuranceAnalysis>> {
    const startTime = Date.now()

    log.info('Starting UK National Insurance analysis', {
      tenantId,
      financialYear,
      employeeCount: employees.length,
    })

    try {
      const employeeBreakdowns: EmployeeNIBreakdown[] = []
      let totalPrimaryNI = new Decimal(0)
      let totalSecondaryNI = new Decimal(0)
      let totalClass1ANI = new Decimal(0)
      let totalSalarySacrificeSavings = new Decimal(0)
      let totalPayrollCost = new Decimal(0)

      // Process each employee
      for (const emp of employees) {
        const effectiveSalary = emp.salarySacrifice
          ? emp.annualGrossSalary - emp.salarySacrifice
          : emp.annualGrossSalary

        // Primary NI (employee)
        const primaryNI = this.calculatePrimaryNI(effectiveSalary, emp.isDirector)

        // Secondary NI (employer)
        const secondaryNI = this.calculateSecondaryNI(effectiveSalary, emp.category)

        // Class 1A NI (benefits in kind)
        const class1ANI = this.calculateClass1ANI(emp.benefitsInKind ?? 0)

        // Salary sacrifice analysis
        let salarySacrificeAnalysis: SalarySacrificeAnalysis | null = null
        if (emp.salarySacrifice && emp.salarySacrifice > 0) {
          salarySacrificeAnalysis = this.analyzeSalarySacrifice(
            emp.annualGrossSalary,
            emp.salarySacrifice,
            emp.isDirector,
            emp.category
          )
          totalSalarySacrificeSavings = totalSalarySacrificeSavings.add(
            salarySacrificeAnalysis.totalNISaving
          )
        }

        totalPrimaryNI = totalPrimaryNI.add(primaryNI.total)
        totalSecondaryNI = totalSecondaryNI.add(secondaryNI)
        totalClass1ANI = totalClass1ANI.add(class1ANI)
        totalPayrollCost = totalPayrollCost.add(effectiveSalary).add(secondaryNI).add(class1ANI)

        employeeBreakdowns.push({
          employeeId: emp.id,
          employeeName: emp.name,
          grossSalary: emp.annualGrossSalary,
          category: emp.category,
          primaryNI: primaryNI.total,
          primaryLowerBand: primaryNI.lowerBand,
          primaryUpperBand: primaryNI.upperBand,
          secondaryNI,
          secondaryNIBeforeAllowance: secondaryNI,
          class1ANI,
          salarySacrificeAnalysis,
          directorAnnualMethod: emp.isDirector,
          totalEmployerCost: this.roundCurrency(
            new Decimal(effectiveSalary).add(secondaryNI).add(class1ANI)
          ),
        })
      }

      // Employment Allowance
      const totalSecondaryNINum = this.roundCurrency(totalSecondaryNI)
      const employmentAllowance = this.assessEmploymentAllowance(employees, totalSecondaryNINum)

      // Net employer NI after Employment Allowance
      const netEmployerNI = this.roundCurrency(
        totalSecondaryNI.add(totalClass1ANI).sub(employmentAllowance.applied)
      )

      // Self-employed NI
      let selfEmployed: SelfEmployedNIBreakdown | null = null
      if (options?.selfEmployedProfits && options.selfEmployedProfits > 0) {
        selfEmployed = this.calculateSelfEmployedNI(options.selfEmployedProfits)
      }

      // Total NI liability
      const totalNILiability = this.roundCurrency(
        new Decimal(netEmployerNI).add(selfEmployed?.totalSelfEmployedNI ?? 0)
      )

      // Build recommendations
      const recommendations: string[] = []

      if (employmentAllowance.eligible) {
        recommendations.push(employmentAllowance.reason)
      } else {
        recommendations.push(employmentAllowance.reason)
      }

      // Check for salary sacrifice opportunities
      const nonSacrificeEmployees = employees.filter(
        (e) => !e.salarySacrifice && e.annualGrossSalary > FALLBACK_PRIMARY_THRESHOLD
      )
      if (nonSacrificeEmployees.length > 0) {
        recommendations.push(
          `${nonSacrificeEmployees.length} employee(s) could benefit from salary sacrifice arrangements (e.g. pension contributions) to reduce NI liability`
        )
      }

      // Check for young employee NI savings
      const youngEmployees = employees.filter(
        (e) => e.category === 'M' || e.category === 'H'
      )
      if (youngEmployees.length > 0) {
        recommendations.push(
          `${youngEmployees.length} employee(s) in under-21/apprentice category — employer NI is reduced (secondary threshold at GBP ${FALLBACK_UPPER_EARNINGS_LIMIT.toLocaleString('en-GB')} instead of GBP ${FALLBACK_SECONDARY_THRESHOLD.toLocaleString('en-GB')})`
        )
      }

      if (selfEmployed && selfEmployed.class2Applicable) {
        recommendations.push(
          `Self-employed Class 2 NI of GBP ${selfEmployed.class2AnnualContribution.toLocaleString('en-GB')}/year maintains State Pension entitlement. Ensure contributions are up to date.`
        )
      }

      // Director warning
      const directors = employees.filter((e) => e.isDirector)
      if (directors.length > 0) {
        recommendations.push(
          'Director NI is calculated using the annual earnings method. Review salary/dividend mix for NI efficiency.'
        )
      }

      const totalSalarySacrificeSavingsNum = this.roundCurrency(totalSalarySacrificeSavings)
      if (totalSalarySacrificeSavingsNum > 0) {
        recommendations.push(
          `Total NI savings from salary sacrifice: GBP ${totalSalarySacrificeSavingsNum.toLocaleString('en-GB')}`
        )
      }

      const warnings: string[] = []
      if (employees.length === 0 && !selfEmployed) {
        warnings.push('No employees or self-employed profits provided for NI analysis.')
      }

      const analysis: UKNationalInsuranceAnalysis = {
        employeeBreakdowns,
        totalPrimaryNI: this.roundCurrency(totalPrimaryNI),
        totalSecondaryNI: totalSecondaryNINum,
        totalClass1ANI: this.roundCurrency(totalClass1ANI),
        employmentAllowance,
        netEmployerNI,
        selfEmployed,
        totalNILiability,
        totalSalarySacrificeSavings: totalSalarySacrificeSavingsNum,
        totalPayrollCost: this.roundCurrency(totalPayrollCost),
        recommendations,
      }

      return this.createResult(
        'UKNationalInsuranceEngine',
        startTime,
        analysis,
        0.90,
        [
          'Social Security Contributions and Benefits Act 1992, s 6 — primary Class 1 contributions',
          'Social Security Contributions and Benefits Act 1992, s 7 — secondary Class 1 contributions',
          'Social Security Contributions and Benefits Act 1992, s 8 — directors contributions (annual method)',
          'Social Security Contributions and Benefits Act 1992, s 10 — Class 1A contributions (benefits in kind)',
          'Social Security Contributions and Benefits Act 1992, s 11 — Class 2 contributions',
          'Social Security Contributions and Benefits Act 1992, s 15 — Class 4 contributions',
          'National Insurance Contributions Act 2014, s 2 — Employment Allowance',
        ],
        warnings
      )
    } catch (error) {
      log.error('UK National Insurance analysis failed', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      })
      return this.createErrorResult<UKNationalInsuranceAnalysis>(
        'UKNationalInsuranceEngine',
        startTime,
        `UK National Insurance analysis failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}

// ─── Exported Analysis Function ──────────────────────────────────────

/**
 * Analyse UK National Insurance contributions.
 *
 * @param tenantId - Organisation identifier
 * @param financialYear - UK tax year (e.g. 'UK2025-26')
 * @param employees - Array of employee records
 * @param options - Optional engine configuration
 * @returns Comprehensive NI analysis with confidence score
 */
export async function analyzeUKNationalInsurance(
  tenantId: string,
  financialYear: string,
  employees: Employee[],
  options?: EngineOptions & {
    selfEmployedProfits?: number
  }
): Promise<EngineResult<UKNationalInsuranceAnalysis>> {
  const engine = new UKNationalInsuranceEngine()
  return engine.analyze(tenantId, financialYear, employees, options)
}
