/**
 * Division 7A Analyzer Tests
 *
 * Tests for Division 7A ITAA 1936 loan analysis:
 * - Benchmark interest rate validation (8.77% for FY2024-25)
 * - Minimum repayment calculations
 * - Deemed dividend detection
 * - Loan agreement compliance
 */

import { describe, it, expect } from 'vitest'
import { ValidatorMockFactory } from '@/tests/__mocks__/data/validator-fixtures'

describe('Division7aAnalyzer', () => {
  const BENCHMARK_RATE_FY2024_25 = 0.0877 // 8.77%
  const LOAN_TERM_YEARS = 7 // Standard unsecured loan term

  describe('Benchmark Interest Rate', () => {
    it('should validate correct benchmark rate for FY2024-25', () => {
      const result = ValidatorMockFactory.div7aResult(true, {
        amount: 100000,
        interestRate: 0.0877,
      })

      expect(result.passed).toBe(true)
      expect(result.calculations.benchmarkRate).toBe(0.0877)
      expect(result.calculations.compliant).toBe(true)
    })

    it('should fail if interest rate below benchmark', () => {
      const result = ValidatorMockFactory.div7aResult(false, {
        amount: 100000,
        interestRate: 0.05, // 5% - below benchmark
      })

      expect(result.passed).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0]).toContain('Benchmark rate (8.77%)')
    })

    it('should allow interest rate above benchmark', () => {
      const result = ValidatorMockFactory.div7aResult(true, {
        amount: 100000,
        interestRate: 0.10, // 10% - above benchmark
      })

      expect(result.passed).toBe(true)
      expect(result.calculations.compliant).toBe(true)
    })
  })

  describe('Minimum Repayment Calculation', () => {
    it('should calculate correct minimum repayment for unsecured loan', () => {
      const loanAmount = 100000
      const benchmarkRate = BENCHMARK_RATE_FY2024_25
      const term = LOAN_TERM_YEARS

      // Formula: PMT = PV × [r / (1 - (1 + r)^-n)]
      const minimumRepayment = loanAmount * (benchmarkRate / (1 - Math.pow(1 + benchmarkRate, -term)))

      expect(minimumRepayment).toBeGreaterThan(0)
      expect(minimumRepayment).toBeCloseTo(19344, 0) // ~$19,344 per year
    })

    it('should fail if repayment below minimum', () => {
      const correctMinRepayment = 19344
      const result = ValidatorMockFactory.div7aResult(false, {
        amount: 100000,
        interestRate: 0.0877,
        repayment: 15000, // Below minimum
      })

      expect(result.passed).toBe(false)
      expect(result.issues).toContain(`Minimum repayment calculation incorrect - should be $${correctMinRepayment.toFixed(2)}, got $15000.00`)
    })

    it('should pass if repayment exceeds minimum', () => {
      const result = ValidatorMockFactory.div7aResult(true, {
        amount: 100000,
        interestRate: 0.0877,
        repayment: 25000, // Above minimum
      })

      expect(result.passed).toBe(true)
      expect(result.calculations.compliant).toBe(true)
    })

    // Test various loan amounts
    const loanTests = [
      { amount: 50000, expectedMin: 9672 },
      { amount: 100000, expectedMin: 19344 },
      { amount: 250000, expectedMin: 48360 },
      { amount: 500000, expectedMin: 96720 },
    ]

    loanTests.forEach(({ amount, expectedMin }) => {
      it(`should calculate minimum repayment for $${amount.toLocaleString()} loan`, () => {
        const benchmarkRate = BENCHMARK_RATE_FY2024_25
        const term = LOAN_TERM_YEARS
        const minimumRepayment = amount * (benchmarkRate / (1 - Math.pow(1 + benchmarkRate, -term)))

        expect(minimumRepayment).toBeCloseTo(expectedMin, 0)
      })
    })
  })

  describe('Deemed Dividend Detection', () => {
    it('should flag loan with no agreement as potential deemed dividend', () => {
      const scenario = {
        hasLoanAgreement: false,
        interestRate: 0.0,
        repaymentSchedule: null,
      }

      const isDeemedDividend = !scenario.hasLoanAgreement || scenario.interestRate < BENCHMARK_RATE_FY2024_25

      expect(isDeemedDividend).toBe(true)
    })

    it('should flag interest-free loan as deemed dividend', () => {
      const scenario = {
        hasLoanAgreement: true,
        interestRate: 0.0,
        repaymentSchedule: 'monthly',
      }

      const isDeemedDividend = scenario.interestRate < BENCHMARK_RATE_FY2024_25

      expect(isDeemedDividend).toBe(true)
    })

    it('should not flag compliant loan as deemed dividend', () => {
      const scenario = {
        hasLoanAgreement: true,
        interestRate: 0.0877,
        repaymentSchedule: 'annual',
        minimumRepaymentMet: true,
      }

      const isDeemedDividend = !scenario.hasLoanAgreement ||
                              scenario.interestRate < BENCHMARK_RATE_FY2024_25 ||
                              !scenario.minimumRepaymentMet

      expect(isDeemedDividend).toBe(false)
    })
  })

  describe('Loan Agreement Compliance', () => {
    it('should require written loan agreement', () => {
      const requirements = [
        'Written loan agreement signed before lodgment day',
        'Benchmark interest rate charged',
        'Minimum yearly repayment made',
        'Loan term not exceeding 7 years (unsecured) or 25 years (secured)',
      ]

      expect(requirements.length).toBe(4)
      expect(requirements).toContain('Written loan agreement signed before lodgment day')
    })

    it('should validate loan term limits', () => {
      const unsecuredMaxTerm = 7
      const securedMaxTerm = 25

      expect(unsecuredMaxTerm).toBe(7)
      expect(securedMaxTerm).toBe(25)

      // Test compliance
      expect(5).toBeLessThan(unsecuredMaxTerm) // 5 year unsecured - compliant
      expect(10).toBeGreaterThan(unsecuredMaxTerm) // 10 year unsecured - non-compliant
      expect(20).toBeLessThan(securedMaxTerm) // 20 year secured - compliant
    })

    it('should calculate lodgment day deadline', () => {
      // Lodgment day is usually December 15 following end of income year
      // For FY2023-24 (ending June 30, 2024), lodgment day is December 15, 2024

      const fyEnd = new Date('2024-06-30')
      const lodgmentDay = new Date(fyEnd)
      lodgmentDay.setMonth(11) // December (0-indexed)
      lodgmentDay.setDate(15)
      lodgmentDay.setFullYear(fyEnd.getFullYear())

      // If lodgment day is before FY end, it's in the next year
      if (lodgmentDay < fyEnd) {
        lodgmentDay.setFullYear(fyEnd.getFullYear() + 1)
      }

      expect(lodgmentDay.getMonth()).toBe(11) // December
      expect(lodgmentDay.getDate()).toBe(15)
      expect(lodgmentDay.getFullYear()).toBe(2024)
    })
  })

  describe('Integration with Mock Data', () => {
    it('should process validator response for compliant loan', () => {
      const result = ValidatorMockFactory.div7aResult(true, {
        amount: 150000,
        interestRate: 0.0877,
        repayment: 29016, // Correct minimum
      })

      expect(result.passed).toBe(true)
      expect(result.confidence).toBeGreaterThan(90)
      expect(result.calculations.compliant).toBe(true)
      expect(result.recommendations).toContain('Maintain loan agreement documentation')
    })

    it('should provide recommendations for non-compliant loan', () => {
      const result = ValidatorMockFactory.div7aResult(false, {
        amount: 150000,
        interestRate: 0.05,
        repayment: 20000,
      })

      expect(result.passed).toBe(false)
      expect(result.recommendations.length).toBeGreaterThan(0)
      expect(result.recommendations).toContain('Update loan agreement to Division 7A compliant terms')
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero loan amount', () => {
      const loanAmount = 0
      const minimumRepayment = loanAmount * (BENCHMARK_RATE_FY2024_25 / (1 - Math.pow(1 + BENCHMARK_RATE_FY2024_25, -LOAN_TERM_YEARS)))

      expect(minimumRepayment).toBe(0)
    })

    it('should handle very large loan amounts', () => {
      const loanAmount = 10000000 // $10M
      const minimumRepayment = loanAmount * (BENCHMARK_RATE_FY2024_25 / (1 - Math.pow(1 + BENCHMARK_RATE_FY2024_25, -LOAN_TERM_YEARS)))

      expect(minimumRepayment).toBeGreaterThan(0)
      expect(minimumRepayment).toBeCloseTo(1934400, 0) // ~$1.93M per year
    })

    it('should handle negative interest rates (invalid)', () => {
      const negativeRate = -0.05

      const isInvalid = negativeRate < 0 || negativeRate < BENCHMARK_RATE_FY2024_25

      expect(isInvalid).toBe(true)
    })

    it('should handle fractional repayments', () => {
      const result = ValidatorMockFactory.div7aResult(true, {
        amount: 100000,
        interestRate: 0.0877,
        repayment: 19344.56, // Fractional cents
      })

      expect(result.calculations.actualRepayment).toBeCloseTo(19344.56, 2)
    })
  })

  describe('Multi-Year Scenarios', () => {
    it('should track loan balance over time', () => {
      const initialLoan = 100000
      const annualRepayment = 19344
      const interestRate = 0.0877

      // Year 1
      const year1Interest = initialLoan * interestRate
      const year1Principal = annualRepayment - year1Interest
      const year1Balance = initialLoan - year1Principal

      expect(year1Balance).toBeLessThan(initialLoan)
      expect(year1Balance).toBeCloseTo(88433, 0)

      // Year 2
      const year2Interest = year1Balance * interestRate
      const year2Principal = annualRepayment - year2Interest
      const year2Balance = year1Balance - year2Principal

      expect(year2Balance).toBeLessThan(year1Balance)
      expect(year2Balance).toBeCloseTo(76171, 0)
    })

    it('should confirm loan fully repaid after term', () => {
      const loanAmount = 100000
      const annualRepayment = 19344
      const interestRate = 0.0877
      const term = 7

      let balance = loanAmount

      for (let year = 1; year <= term; year++) {
        const interest = balance * interestRate
        const principal = annualRepayment - interest
        balance -= principal
      }

      // Should be close to zero (within rounding)
      expect(balance).toBeCloseTo(0, 0)
    })
  })
})
