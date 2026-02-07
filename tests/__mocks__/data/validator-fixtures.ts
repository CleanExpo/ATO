/**
 * Python Validator Mock Data Factory
 *
 * Generates mock responses from Python validation hooks without executing them.
 * This allows testing validation logic without subprocess overhead.
 */

import { faker } from '@faker-js/faker'

// Set seed for reproducible tests
faker.seed(12345)

export class ValidatorMockFactory {
  /**
   * Mock tax calculation validator response
   */
  static taxCalculationResult(valid: boolean = true, data?: {
    rndOffset?: number
    div7aRate?: number
    financialYear?: string
  }) {
    const issues: string[] = []

    if (!valid) {
      if (data?.rndOffset && data.rndOffset !== 0.435) {
        issues.push(`R&D offset rate should be 43.5% for turnover < $20M, got ${(data.rndOffset * 100).toFixed(1)}%`)
      }
      if (data?.div7aRate && data.div7aRate !== 0.0877) {
        issues.push(`Division 7A interest rate should be 8.77% for FY2024-25, got ${(data.div7aRate * 100).toFixed(2)}%`)
      }
    }

    return {
      passed: valid,
      confidence: valid ? faker.number.int({ min: 90, max: 98 }) : faker.number.int({ min: 40, max: 60 }),
      validators: ['tax_calculation_validator'],
      issues,
      timestamp: new Date().toISOString(),
      details: {
        rnd_offset_rate: data?.rndOffset || 0.435,
        div7a_benchmark_rate: data?.div7aRate || 0.0877,
        financial_year: data?.financialYear || 'FY2024-25',
      },
    }
  }

  /**
   * Mock R&D eligibility validator response
   */
  static rndEligibilityResult(valid: boolean = true, activity?: {
    description?: string
    outcome?: string
    approach?: string
  }) {
    const fourElementTest = {
      unknownOutcome: valid,
      systematicApproach: valid,
      newKnowledge: valid,
      scientificMethod: valid,
    }

    const issues: string[] = []

    if (!valid) {
      if (activity?.outcome?.toLowerCase().includes('known')) {
        issues.push('Outcome was determinable in advance - fails "new knowledge" test')
        fourElementTest.unknownOutcome = false
      }
      if (activity?.approach?.toLowerCase().includes('routine')) {
        issues.push('Lacks systematic approach - appears to be routine work')
        fourElementTest.systematicApproach = false
      }
      if (activity?.description?.toLowerCase().includes('standard')) {
        issues.push('Activity appears to be standard practice, not generating new knowledge')
        fourElementTest.newKnowledge = false
      }
    }

    return {
      passed: valid,
      confidence: valid ? faker.number.int({ min: 85, max: 95 }) : faker.number.int({ min: 45, max: 60 }),
      validators: ['rnd_eligibility_validator'],
      issues,
      fourElementTest,
      timestamp: new Date().toISOString(),
      recommendations: valid
        ? [
            'Document systematic approach in detail',
            'Maintain contemporaneous records of experiments',
            'Register activity within 10 months of FY end',
          ]
        : [
            'Review activity against four-element test',
            'Consult R&D tax specialist before claiming',
            'Consider alternative tax treatments',
          ],
    }
  }

  /**
   * Mock Division 7A validator response
   */
  static div7aResult(valid: boolean = true, loan?: {
    amount?: number
    interestRate?: number
    repayment?: number
  }) {
    const issues: string[] = []
    const benchmarkRate = 0.0877 // FY2024-25
    const amount = loan?.amount || 100000
    const correctMinRepayment = amount * (benchmarkRate / (1 - Math.pow(1 + benchmarkRate, -7)))

    if (!valid) {
      if (loan?.interestRate && loan.interestRate < benchmarkRate) {
        issues.push(`Benchmark rate (8.77%) not applied correctly - loan charged ${(loan.interestRate * 100).toFixed(2)}%`)
      }
      if (loan?.repayment && loan.repayment < correctMinRepayment) {
        issues.push(`Minimum repayment calculation incorrect - should be $${correctMinRepayment.toFixed(2)}, got $${loan.repayment.toFixed(2)}`)
      }
    }

    return {
      passed: valid,
      confidence: valid ? faker.number.int({ min: 92, max: 98 }) : faker.number.int({ min: 35, max: 55 }),
      validators: ['div7a_validator'],
      issues,
      calculations: {
        benchmarkRate: 0.0877,
        loanAmount: amount,
        minimumRepayment: correctMinRepayment,
        actualRepayment: loan?.repayment || correctMinRepayment,
        actualInterestRate: loan?.interestRate || benchmarkRate,
        compliant: valid,
      },
      timestamp: new Date().toISOString(),
      recommendations: valid
        ? [
            'Maintain loan agreement documentation',
            'Ensure annual minimum repayments made by lodgment day',
            'Review loan terms annually for benchmark rate changes',
          ]
        : [
            'Update loan agreement to Division 7A compliant terms',
            'Make top-up payment to meet minimum repayment',
            'Consider dividend declaration to clear loan account',
            'Consult tax advisor on deemed dividend implications',
          ],
    }
  }

  /**
   * Mock financial year validator response
   */
  static financialYearResult(valid: boolean = true, fy?: string) {
    const issues: string[] = []

    if (!valid) {
      if (fy && !fy.match(/^FY\d{4}-\d{2}$/)) {
        issues.push(`Invalid financial year format: "${fy}". Expected format: FY2023-24`)
      }
    }

    return {
      passed: valid,
      confidence: valid ? 100 : 0,
      validators: ['financial_year_validator'],
      issues,
      timestamp: new Date().toISOString(),
      parsed: valid ? {
        startDate: '2023-07-01',
        endDate: '2024-06-30',
        year: 2023,
      } : null,
    }
  }

  /**
   * Mock Xero data validator response
   */
  static xeroDataResult(valid: boolean = true, data?: any) {
    const issues: string[] = []

    if (!valid) {
      if (!data?.organisationID) {
        issues.push('Missing required field: organisationID')
      }
      if (!data?.baseCurrency || data.baseCurrency !== 'AUD') {
        issues.push('Invalid or missing baseCurrency - must be AUD for Australian organisations')
      }
      if (data?.transactions && !Array.isArray(data.transactions)) {
        issues.push('Transactions must be an array')
      }
    }

    return {
      passed: valid,
      confidence: valid ? faker.number.int({ min: 95, max: 100 }) : faker.number.int({ min: 0, max: 40 }),
      validators: ['xero_data_validator'],
      issues,
      timestamp: new Date().toISOString(),
      schema_version: '2.0',
    }
  }

  /**
   * Mock data integrity validator response
   */
  static dataIntegrityResult(valid: boolean = true, checks?: {
    duplicates?: number
    missingDates?: number
    invalidAmounts?: number
  }) {
    const issues: string[] = []

    if (!valid) {
      if (checks?.duplicates && checks.duplicates > 0) {
        issues.push(`Found ${checks.duplicates} duplicate transaction(s)`)
      }
      if (checks?.missingDates && checks.missingDates > 0) {
        issues.push(`Found ${checks.missingDates} transaction(s) with missing dates`)
      }
      if (checks?.invalidAmounts && checks.invalidAmounts > 0) {
        issues.push(`Found ${checks.invalidAmounts} transaction(s) with invalid amounts`)
      }
    }

    return {
      passed: valid,
      confidence: valid ? faker.number.int({ min: 88, max: 96 }) : faker.number.int({ min: 30, max: 50 }),
      validators: ['data_integrity_validator'],
      issues,
      statistics: {
        total_transactions: faker.number.int({ min: 100, max: 10000 }),
        duplicates: checks?.duplicates || 0,
        missing_dates: checks?.missingDates || 0,
        invalid_amounts: checks?.invalidAmounts || 0,
        data_quality_score: valid ? faker.number.float({ min: 90, max: 99, fractionDigits: 1 }) : faker.number.float({ min: 40, max: 70, fractionDigits: 1 }),
      },
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Mock deduction validator response
   */
  static deductionResult(valid: boolean = true, expense?: {
    amount?: number
    category?: string
    privateUse?: number
    includedInIncome?: boolean
    recoveryAttempts?: number
    description?: string
    hasBusinessPurpose?: boolean
    [key: string]: any
  }) {
    const issues: string[] = []

    if (!valid) {
      if (expense?.category === 'CAPITAL') {
        issues.push('Expense appears to be capital in nature - not immediately deductible under Section 8-1')
      }
      if (expense?.privateUse && expense.privateUse > 0) {
        issues.push(`Private use component (${expense.privateUse}%) requires apportionment`)
      }
      if (expense?.includedInIncome === false) {
        issues.push('Debt not previously included in assessable income')
      }
      if (expense?.recoveryAttempts !== undefined && expense.recoveryAttempts < 3) {
        issues.push('Insufficient recovery attempts before write-off')
      }
      if (expense?.description?.toLowerCase().includes('entertainment')) {
        issues.push('Entertainment expenses are generally non-deductible under Division 32 ITAA 1997')
      }
      // If no specific issue was generated, add a generic one
      if (issues.length === 0) {
        issues.push('Expense does not meet deductibility requirements under Section 8-1 ITAA 1997')
      }
    }

    return {
      passed: valid,
      confidence: valid ? faker.number.int({ min: 80, max: 92 }) : faker.number.int({ min: 45, max: 65 }),
      validators: ['deduction_validator'],
      issues,
      analysis: {
        deductible_amount: expense?.amount || 0,
        private_use_percentage: expense?.privateUse || 0,
        business_portion: expense?.amount ? expense.amount * (1 - (expense.privateUse || 0) / 100) : 0,
        legislative_basis: 'Section 8-1 ITAA 1997',
      },
      timestamp: new Date().toISOString(),
      recommendations: valid
        ? [
            'Retain tax invoice and payment evidence',
            'Document business purpose',
            'Apply apportionment if private use component exists',
          ]
        : [
            'Review expense classification',
            'Consider alternative tax treatments',
            'Consult tax advisor for capital vs revenue determination',
          ],
    }
  }

  /**
   * Mock loss validator response
   */
  static lossResult(valid: boolean = true, loss?: {
    amount?: number
    carriedForward?: boolean
    cotPassed?: boolean
    sbtPassed?: boolean
    [key: string]: any
  }) {
    const issues: string[] = []

    if (!valid) {
      if (loss?.cotPassed === false) {
        issues.push('COT failed - ownership change detected')
      }
      if (loss?.sbtPassed === false) {
        issues.push('SBT failed - business activities have materially changed')
      }
      // If no specific issue was generated, add a generic one
      if (issues.length === 0) {
        issues.push('Loss carry-forward eligibility requirements not met')
      }
    }

    return {
      passed: valid,
      confidence: valid ? faker.number.int({ min: 85, max: 93 }) : faker.number.int({ min: 40, max: 60 }),
      validators: ['loss_validator'],
      issues,
      analysis: {
        loss_amount: loss?.amount || 0,
        carry_forward_eligible: valid,
        cot_result: loss?.cotPassed !== false,
        sbt_result: loss?.sbtPassed !== false,
        legislative_basis: 'Subdivision 36-A ITAA 1997',
      },
      timestamp: new Date().toISOString(),
      recommendations: valid
        ? [
            'Document ownership structure for COT compliance',
            'Maintain records of business activities for SBT',
            'Review loss utilization strategy annually',
          ]
        : [
            'Review ownership changes during loss year',
            'Assess Same Business Test applicability',
            'Consider restructuring to preserve losses',
            'Obtain ATO private ruling if uncertain',
          ],
    }
  }

  /**
   * Mock report structure validator response
   */
  static reportStructureResult(valid: boolean = true, report?: {
    hasSummary?: boolean
    hasRecommendations?: boolean
    hasLegislativeRefs?: boolean
  }) {
    const issues: string[] = []

    if (!valid) {
      if (!report?.hasSummary) {
        issues.push('Missing required section: Executive Summary')
      }
      if (!report?.hasRecommendations) {
        issues.push('Missing required section: Recommendations')
      }
      if (!report?.hasLegislativeRefs) {
        issues.push('Missing legislative references for tax positions')
      }
    }

    return {
      passed: valid,
      confidence: valid ? 100 : faker.number.int({ min: 20, max: 50 }),
      validators: ['report_structure_validator'],
      issues,
      checklist: {
        has_executive_summary: report?.hasSummary !== false,
        has_methodology: true,
        has_findings: true,
        has_recommendations: report?.hasRecommendations !== false,
        has_legislative_references: report?.hasLegislativeRefs !== false,
        has_disclaimer: true,
      },
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Generate a passing validation result for any validator
   */
  static pass(validatorName: string) {
    return {
      passed: true,
      confidence: faker.number.int({ min: 90, max: 99 }),
      validators: [validatorName],
      issues: [],
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Generate a failing validation result for any validator
   */
  static fail(validatorName: string, reason: string) {
    return {
      passed: false,
      confidence: faker.number.int({ min: 30, max: 60 }),
      validators: [validatorName],
      issues: [reason],
      timestamp: new Date().toISOString(),
    }
  }
}
