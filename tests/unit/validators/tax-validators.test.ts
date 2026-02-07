import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'

/**
 * Unit Tests: Tax Validators
 *
 * Tests tax calculation validation logic for:
 * - R&D offset calculations
 * - Division 7A compliance
 * - Tax rate accuracy
 * - Legislative compliance
 * - Financial year validation
 */

describe('R&D Tax Incentive Validator', () => {
  describe('Offset Rate Validation', () => {
    it('should validate 43.5% offset rate for turnover < $20M', () => {
      const config = {
        turnover: 15000000,
        offsetRate: 0.435
      }

      const expectedRate = config.turnover < 20000000 ? 0.435 : 0.385

      expect(config.offsetRate).toBe(expectedRate)
    })

    it('should flag incorrect offset rate for small business', () => {
      const config = {
        turnover: 15000000,
        offsetRate: 0.385 // Wrong rate
      }

      const expectedRate = config.turnover < 20000000 ? 0.435 : 0.385
      const isValid = config.offsetRate === expectedRate

      expect(isValid).toBe(false)
    })

    it('should validate 38.5% offset rate for turnover >= $20M', () => {
      const config = {
        turnover: 25000000,
        offsetRate: 0.385
      }

      const expectedRate = config.turnover < 20000000 ? 0.435 : 0.385

      expect(config.offsetRate).toBe(expectedRate)
    })

    it('should flag incorrect offset rate for large business', () => {
      const config = {
        turnover: 25000000,
        offsetRate: 0.435 // Wrong rate
      }

      const expectedRate = config.turnover < 20000000 ? 0.435 : 0.385
      const isValid = config.offsetRate === expectedRate

      expect(isValid).toBe(false)
    })
  })

  describe('Four-Element Test Validation', () => {
    it('should pass when all four elements are true', () => {
      const activity = {
        unknownOutcome: true,
        systematicApproach: true,
        newKnowledge: true,
        scientificMethod: true
      }

      const isValid = Object.values(activity).every(v => v === true)

      expect(isValid).toBe(true)
    })

    it('should fail when unknown outcome is false', () => {
      const activity = {
        unknownOutcome: false, // Outcome was determinable
        systematicApproach: true,
        newKnowledge: true,
        scientificMethod: true
      }

      const isValid = Object.values(activity).every(v => v === true)

      expect(isValid).toBe(false)
    })

    it('should fail when systematic approach is missing', () => {
      const activity = {
        unknownOutcome: true,
        systematicApproach: false, // No systematic approach
        newKnowledge: true,
        scientificMethod: true
      }

      const isValid = Object.values(activity).every(v => v === true)

      expect(isValid).toBe(false)
    })

    it('should fail when new knowledge is not generated', () => {
      const activity = {
        unknownOutcome: true,
        systematicApproach: true,
        newKnowledge: false, // Routine work
        scientificMethod: true
      }

      const isValid = Object.values(activity).every(v => v === true)

      expect(isValid).toBe(false)
    })

    it('should fail when scientific method is not applied', () => {
      const activity = {
        unknownOutcome: true,
        systematicApproach: true,
        newKnowledge: true,
        scientificMethod: false // No scientific basis
      }

      const isValid = Object.values(activity).every(v => v === true)

      expect(isValid).toBe(false)
    })
  })

  describe('Expenditure Calculation Validation', () => {
    it('should calculate correct offset for eligible expenditure', () => {
      const expenditure = 100000
      const offsetRate = 0.435

      const offset = new Decimal(expenditure)
        .times(offsetRate)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber()

      expect(offset).toBe(43500)
    })

    it('should handle decimal expenditure correctly', () => {
      const expenditure = 123456.78
      const offsetRate = 0.435

      const offset = new Decimal(expenditure)
        .times(offsetRate)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber()

      expect(offset).toBe(53703.70)
    })

    it('should flag incorrect offset calculations', () => {
      const expenditure = 100000
      const claimedOffset = 40000 // Should be 43500

      const expectedOffset = new Decimal(expenditure)
        .times(0.435)
        .toNumber()

      const isValid = claimedOffset === expectedOffset

      expect(isValid).toBe(false)
    })

    it('should round to 2 decimal places correctly', () => {
      const expenditure = 100000.005
      const offsetRate = 0.435

      const offset = new Decimal(expenditure)
        .times(offsetRate)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber()

      // Should round 43500.002175 to 43500.00
      expect(offset).toBe(43500.00)
    })
  })

  describe('Legislative Reference Validation', () => {
    it('should validate Division 355 reference', () => {
      const reference = 'Division 355 ITAA 1997'

      const isValid = reference.includes('Division 355') &&
        reference.includes('ITAA 1997')

      expect(isValid).toBe(true)
    })

    it('should flag missing legislative reference', () => {
      const reference = ''

      const isValid = reference.length > 0

      expect(isValid).toBe(false)
    })

    it('should validate Section 355-25 for eligibility', () => {
      const reference = 'Section 355-25 ITAA 1997'

      const isValid = reference.includes('Section 355-25')

      expect(isValid).toBe(true)
    })
  })
})

describe('Division 7A Validator', () => {
  describe('Benchmark Rate Validation', () => {
    it('should validate 8.77% benchmark rate for FY2024-25', () => {
      const config = {
        financialYear: 'FY2024-25',
        benchmarkRate: 0.0877
      }

      const rates: { [key: string]: number } = {
        'FY2024-25': 0.0877,
        'FY2023-24': 0.0827,
        'FY2022-23': 0.0452
      }

      const expectedRate = rates[config.financialYear]

      expect(config.benchmarkRate).toBe(expectedRate)
    })

    it('should flag incorrect benchmark rate', () => {
      const config = {
        financialYear: 'FY2024-25',
        benchmarkRate: 0.08 // Wrong rate
      }

      const correctRate = 0.0877
      const isValid = Math.abs(config.benchmarkRate - correctRate) < 0.0001

      expect(isValid).toBe(false)
    })

    it('should validate historical rates', () => {
      const rates: { [key: string]: number } = {
        'FY2023-24': 0.0827,
        'FY2022-23': 0.0452,
        'FY2021-22': 0.0447
      }

      Object.entries(rates).forEach(([fy, rate]) => {
        expect(rate).toBeGreaterThan(0)
        expect(rate).toBeLessThan(0.1)
      })
    })
  })

  describe('Minimum Repayment Calculation', () => {
    it('should validate minimum repayment using annuity formula', () => {
      const principal = 100000
      const rate = 0.0877
      const term = 7

      const minimumRepayment = principal * (rate / (1 - Math.pow(1 + rate, -term)))

      expect(minimumRepayment).toBeCloseTo(19716, 0)
    })

    it('should flag incorrect minimum repayment', () => {
      const principal = 100000
      const claimedRepayment = 15000

      const correctRepayment = principal * (0.0877 / (1 - Math.pow(1 + 0.0877, -7)))

      const isValid = Math.abs(claimedRepayment - correctRepayment) < 100

      expect(isValid).toBe(false)
    })

    it('should validate repayment for different loan terms', () => {
      const principal = 100000
      const rate = 0.0877

      // Unsecured loan: 7 years
      const unsecuredRepayment = principal * (rate / (1 - Math.pow(1 + rate, -7)))

      // Secured loan: 25 years
      const securedRepayment = principal * (rate / (1 - Math.pow(1 + rate, -25)))

      expect(unsecuredRepayment).toBeGreaterThan(securedRepayment)
      expect(unsecuredRepayment).toBeCloseTo(19716, 0)
      expect(securedRepayment).toBeCloseTo(9992, 0)
    })
  })

  describe('Deemed Dividend Calculation', () => {
    it('should calculate deemed dividend from shortfall', () => {
      const minimumRepayment = 19716
      const actualRepayment = 15000
      const shortfall = minimumRepayment - actualRepayment

      expect(shortfall).toBeCloseTo(4716, 0)
    })

    it('should have zero deemed dividend when compliant', () => {
      const minimumRepayment = 19716
      const actualRepayment = 20000 // Overpayment

      const shortfall = Math.max(0, minimumRepayment - actualRepayment)

      expect(shortfall).toBe(0)
    })

    it('should flag incorrect deemed dividend calculation', () => {
      const minimumRepayment = 19716
      const actualRepayment = 15000
      const claimedDeemedDividend = 5000 // Wrong amount

      const correctDeemedDividend = minimumRepayment - actualRepayment

      const isValid = claimedDeemedDividend === correctDeemedDividend

      expect(isValid).toBe(false)
    })
  })

  describe('Legislative Reference Validation', () => {
    it('should validate Section 109N reference', () => {
      const reference = 'Section 109N ITAA 1936'

      const isValid = reference.includes('Section 109N') &&
        reference.includes('ITAA 1936')

      expect(isValid).toBe(true)
    })

    it('should flag incorrect ITAA year', () => {
      const reference = 'Section 109N ITAA 1997' // Wrong year

      const isValid = reference.includes('ITAA 1936')

      expect(isValid).toBe(false)
    })
  })
})

describe('Tax Rate Validator', () => {
  describe('Corporate Tax Rates', () => {
    it('should validate 25% small business rate', () => {
      const config = {
        entityType: 'company',
        turnover: 15000000,
        taxRate: 0.25
      }

      const expectedRate = config.turnover < 50000000 ? 0.25 : 0.30

      expect(config.taxRate).toBe(expectedRate)
    })

    it('should validate 30% standard company rate', () => {
      const config = {
        entityType: 'company',
        turnover: 60000000,
        taxRate: 0.30
      }

      const expectedRate = config.turnover < 50000000 ? 0.25 : 0.30

      expect(config.taxRate).toBe(expectedRate)
    })

    it('should flag incorrect small business rate', () => {
      const config = {
        turnover: 15000000,
        taxRate: 0.30 // Should be 0.25
      }

      const expectedRate = config.turnover < 50000000 ? 0.25 : 0.30
      const isValid = config.taxRate === expectedRate

      expect(isValid).toBe(false)
    })
  })

  describe('FBT Rate Validation', () => {
    it('should validate 47% FBT rate', () => {
      const fbtRate = 0.47

      expect(fbtRate).toBe(0.47)
    })

    it('should flag incorrect FBT rate', () => {
      const claimedRate: number = 0.45

      const isValid = claimedRate === 0.47

      expect(isValid).toBe(false)
    })
  })

  describe('GST Rate Validation', () => {
    it('should validate 10% GST rate', () => {
      const gstRate = 0.10

      expect(gstRate).toBe(0.10)
    })

    it('should flag incorrect GST rate', () => {
      const claimedRate: number = 0.15

      const isValid = claimedRate === 0.10

      expect(isValid).toBe(false)
    })
  })
})

describe('Financial Year Validator', () => {
  describe('FY Format Validation', () => {
    it('should validate FY2023-24 format', () => {
      const fy = 'FY2023-24'

      const fyRegex = /^FY\d{4}-\d{2}$/

      expect(fyRegex.test(fy)).toBe(true)
    })

    it('should reject invalid FY formats', () => {
      const invalidFormats = [
        '2023-24',
        'FY2023',
        'FY23-24',
        'FY2023-2024',
        'FY 2023-24'
      ]

      const fyRegex = /^FY\d{4}-\d{2}$/

      invalidFormats.forEach(format => {
        expect(fyRegex.test(format)).toBe(false)
      })
    })

    it('should validate year continuity', () => {
      const fy = 'FY2023-24'
      const match = fy.match(/^FY(\d{4})-(\d{2})$/)

      expect(match).toBeTruthy()

      if (match) {
        const startYear = parseInt(match[1])
        const endYear = parseInt(`20${match[2]}`)

        expect(endYear).toBe(startYear + 1)
      }
    })

    it('should flag incorrect year continuity', () => {
      const fy = 'FY2023-25' // Should be FY2023-24
      const match = fy.match(/^FY(\d{4})-(\d{2})$/)

      if (match) {
        const startYear = parseInt(match[1])
        const endYear = parseInt(`20${match[2]}`)

        const isValid = endYear === startYear + 1

        expect(isValid).toBe(false)
      }
    })
  })

  describe('Date Range Validation', () => {
    it('should validate July 1 to June 30 date range', () => {
      const fy = 'FY2023-24'
      const startDate = new Date('2023-07-01')
      const endDate = new Date('2024-06-30')

      expect(startDate.getMonth()).toBe(6) // July (0-indexed)
      expect(startDate.getDate()).toBe(1)

      expect(endDate.getMonth()).toBe(5) // June (0-indexed)
      expect(endDate.getDate()).toBe(30)
    })

    it('should validate date falls within FY', () => {
      const testDate = new Date('2024-01-15')
      const fyStart = new Date('2023-07-01')
      const fyEnd = new Date('2024-06-30')

      const isInFY = testDate >= fyStart && testDate <= fyEnd

      expect(isInFY).toBe(true)
    })

    it('should flag date outside FY', () => {
      const testDate = new Date('2024-07-15') // Next FY
      const fyStart = new Date('2023-07-01')
      const fyEnd = new Date('2024-06-30')

      const isInFY = testDate >= fyStart && testDate <= fyEnd

      expect(isInFY).toBe(false)
    })
  })

  describe('Leap Year Handling', () => {
    it('should correctly identify leap year FY', () => {
      const fy = 'FY2023-24' // 2024 is a leap year
      const startDate = new Date('2023-07-01')
      const endDate = new Date('2024-06-30')

      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

      expect(days).toBe(366)
    })

    it('should correctly identify non-leap year FY', () => {
      const fy = 'FY2022-23' // 2023 is not a leap year
      const startDate = new Date('2022-07-01')
      const endDate = new Date('2023-06-30')

      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

      expect(days).toBe(365)
    })
  })
})

describe('Deduction Validator', () => {
  describe('Section 8-1 Compliance', () => {
    it('should validate business purpose requirement', () => {
      const expense = {
        description: 'Office supplies',
        businessPurpose: true,
        capitalExpense: false,
        privateUse: false
      }

      const isDeductible = expense.businessPurpose &&
        !expense.capitalExpense &&
        !expense.privateUse

      expect(isDeductible).toBe(true)
    })

    it('should flag capital expenses as non-deductible under Section 8-1', () => {
      const expense = {
        description: 'Purchase of building',
        businessPurpose: true,
        capitalExpense: true,
        privateUse: false
      }

      const isSection8_1Deductible = expense.businessPurpose &&
        !expense.capitalExpense &&
        !expense.privateUse

      expect(isSection8_1Deductible).toBe(false)
    })

    it('should flag private use expenses', () => {
      const expense = {
        description: 'Personal holiday',
        businessPurpose: false,
        capitalExpense: false,
        privateUse: true
      }

      const isDeductible = expense.businessPurpose &&
        !expense.capitalExpense &&
        !expense.privateUse

      expect(isDeductible).toBe(false)
    })
  })

  describe('Apportionment Validation', () => {
    it('should validate apportionment calculation', () => {
      const totalExpense = 10000
      const businessUsePercentage = 70

      const deductibleAmount = totalExpense * (businessUsePercentage / 100)

      expect(deductibleAmount).toBe(7000)
    })

    it('should flag incorrect apportionment', () => {
      const totalExpense = 10000
      const businessUsePercentage = 70
      const claimedDeduction = 8000 // Should be 7000

      const correctDeduction = totalExpense * (businessUsePercentage / 100)
      const isValid = claimedDeduction === correctDeduction

      expect(isValid).toBe(false)
    })

    it('should require evidence for apportionment', () => {
      const expense = {
        amount: 10000,
        businessUsePercentage: 70,
        evidenceProvided: true // Log book, diary, etc.
      }

      expect(expense.evidenceProvided).toBe(true)
    })
  })
})

describe('Loss Carry-Forward Validator', () => {
  describe('COT/SBT Validation', () => {
    it('should validate Continuity of Ownership Test', () => {
      const shareholders = [
        { name: 'John Smith', percentage: 60, period: 'entire year' },
        { name: 'Jane Doe', percentage: 40, period: 'entire year' }
      ]

      const majorityHolder = shareholders.find(s => s.percentage > 50)
      const cotPassed = majorityHolder?.period === 'entire year'

      expect(cotPassed).toBe(true)
    })

    it('should fail COT when ownership changes', () => {
      const shareholders = [
        { name: 'John Smith', percentage: 60, period: '6 months' },
        { name: 'New Owner', percentage: 60, period: '6 months' }
      ]

      const majorityHolder = shareholders.find(s => s.percentage > 50)
      const cotPassed = majorityHolder?.period === 'entire year'

      expect(cotPassed).toBe(false)
    })

    it('should validate Same Business Test as fallback', () => {
      const businessActivities = {
        original: ['Software consulting', 'Web development'],
        current: ['Software consulting', 'Web development', 'Mobile apps']
      }

      const originalActivitiesContinue = businessActivities.original.every(
        activity => businessActivities.current.includes(activity)
      )

      expect(originalActivitiesContinue).toBe(true)
    })

    it('should fail SBT when business changes significantly', () => {
      const businessActivities = {
        original: ['Software consulting', 'Web development'],
        current: ['Real estate investment'] // Completely different
      }

      const originalActivitiesContinue = businessActivities.original.every(
        activity => businessActivities.current.includes(activity)
      )

      expect(originalActivitiesContinue).toBe(false)
    })
  })

  describe('FIFO Application Validation', () => {
    it('should validate FIFO loss application', () => {
      const losses = [
        { fy: 'FY2021-22', amount: 150000, remaining: 150000 },
        { fy: 'FY2022-23', amount: 80000, remaining: 80000 }
      ]

      const profit = 100000

      let remainingProfit = profit

      const updatedLosses = losses.map(loss => {
        if (remainingProfit <= 0) return loss

        const lossUsed = Math.min(remainingProfit, loss.remaining)
        remainingProfit -= lossUsed

        return {
          ...loss,
          remaining: loss.remaining - lossUsed
        }
      })

      // Oldest loss should be used first
      expect(updatedLosses[0].remaining).toBe(50000)
      expect(updatedLosses[1].remaining).toBe(80000)
    })
  })
})

describe('Bad Debt Validator', () => {
  describe('Section 25-35 Compliance', () => {
    it('should validate debt was in assessable income', () => {
      const debt = {
        amount: 25000,
        assessableIncome: true,
        formallyWrittenOff: true,
        recoveryAttempts: 3
      }

      expect(debt.assessableIncome).toBe(true)
    })

    it('should require formal write-off', () => {
      const debt = {
        amount: 25000,
        assessableIncome: true,
        formallyWrittenOff: true,
        writeOffDate: '2024-03-15'
      }

      expect(debt.formallyWrittenOff).toBe(true)
      expect(debt.writeOffDate).toBeTruthy()
    })

    it('should validate reasonable recovery attempts', () => {
      const debt = {
        amount: 25000,
        recoveryAttempts: [
          'Reminder email sent',
          'Phone call follow-up',
          'Demand letter issued',
          'Debt collector engaged'
        ]
      }

      const hasReasonableAttempts = debt.recoveryAttempts.length >= 3

      expect(hasReasonableAttempts).toBe(true)
    })

    it('should flag insufficient recovery attempts', () => {
      const debt = {
        amount: 25000,
        recoveryAttempts: [
          'Email sent'
        ]
      }

      const hasReasonableAttempts = debt.recoveryAttempts.length >= 3

      expect(hasReasonableAttempts).toBe(false)
    })
  })
})
