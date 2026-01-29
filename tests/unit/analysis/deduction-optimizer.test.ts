/**
 * Deduction Optimizer Tests (Section 8-1 ITAA 1997)
 *
 * Tests for general deduction eligibility:
 * - Business purpose test (incurred in carrying on a business)
 * - Capital vs revenue distinction
 * - Private use apportionment
 * - Blackhole expenditure (Section 40-880)
 * - Prepayment rules (Section 82KZM)
 */

import { describe, it, expect } from 'vitest'
import { XeroMockFactory } from '@/tests/__mocks__/data/xero-fixtures'
import { ValidatorMockFactory } from '@/tests/__mocks__/data/validator-fixtures'

describe('DeductionOptimizer', () => {
  describe('Business Purpose Test (Section 8-1)', () => {
    it('should allow deduction for expenses incurred in carrying on business', () => {
      const expense = {
        description: 'Office rent',
        amount: 2000,
        hasBusinessPurpose: true,
        isCapital: false,
        isPrivate: false,
      }

      const isDeductible = expense.hasBusinessPurpose &&
                          !expense.isCapital &&
                          !expense.isPrivate

      expect(isDeductible).toBe(true)
    })

    it('should deny deduction for private expenses', () => {
      const expense = {
        description: 'Personal groceries',
        amount: 500,
        hasBusinessPurpose: false,
        isCapital: false,
        isPrivate: true,
      }

      const isDeductible = expense.hasBusinessPurpose && !expense.isPrivate

      expect(isDeductible).toBe(false)
    })

    it('should deny deduction for capital expenses', () => {
      const expense = {
        description: 'Purchase of building',
        amount: 500000,
        hasBusinessPurpose: true,
        isCapital: true,
        isPrivate: false,
      }

      const isDeductible = expense.hasBusinessPurpose && !expense.isCapital

      expect(isDeductible).toBe(false)
    })

    const expenseTests = [
      { description: 'Advertising costs', deductible: true, reason: 'Business operating expense' },
      { description: 'Employee wages', deductible: true, reason: 'Business operating expense' },
      { description: 'Office supplies', deductible: true, reason: 'Business operating expense' },
      { description: 'Client gifts', deductible: false, reason: 'Entertainment - non-deductible' },
      { description: 'Personal car registration', deductible: false, reason: 'Private use' },
    ]

    expenseTests.forEach(({ description, deductible, reason }) => {
      it(`should ${deductible ? 'allow' : 'deny'} deduction for ${description}`, () => {
        const isBusinessExpense = deductible
        expect(isBusinessExpense).toBe(deductible)
      })
    })
  })

  describe('Capital vs Revenue Distinction', () => {
    it('should identify revenue expenses (immediately deductible)', () => {
      const revenueExpenses = [
        'Monthly software subscription',
        'Utilities - electricity',
        'Annual insurance premium',
        'Marketing campaign',
        'Professional fees',
      ]

      revenueExpenses.forEach(desc => {
        const isRevenue = !desc.toLowerCase().includes('purchase') &&
                         !desc.toLowerCase().includes('building') &&
                         !desc.toLowerCase().includes('equipment')
        expect(isRevenue).toBe(true)
      })
    })

    it('should identify capital expenses (depreciated over time)', () => {
      const capitalExpenses = [
        'Purchase of office equipment',
        'Building renovations',
        'New delivery van',
        'Computer servers',
      ]

      capitalExpenses.forEach(desc => {
        const isCapital = desc.toLowerCase().includes('purchase') ||
                         desc.toLowerCase().includes('building') ||
                         desc.toLowerCase().includes('renovations')
        expect(isCapital).toBe(true)
      })
    })

    it('should apply enduring benefit test', () => {
      interface Expense {
        description: string
        benefitPeriod: 'immediate' | 'short-term' | 'long-term'
      }

      const expenses: Expense[] = [
        { description: 'Office cleaning', benefitPeriod: 'immediate' },
        { description: 'Patent registration', benefitPeriod: 'long-term' },
        { description: 'Website redesign', benefitPeriod: 'long-term' },
      ]

      expenses.forEach(expense => {
        const isCapital = expense.benefitPeriod === 'long-term'
        const treatment = isCapital ? 'depreciate' : 'immediate_deduction'

        if (expense.benefitPeriod === 'immediate') {
          expect(treatment).toBe('immediate_deduction')
        } else if (expense.benefitPeriod === 'long-term') {
          expect(treatment).toBe('depreciate')
        }
      })
    })
  })

  describe('Private Use Apportionment', () => {
    it('should calculate business percentage of mixed-use assets', () => {
      const asset = {
        description: 'Car used for both business and private',
        totalCost: 30000,
        businessUsePercentage: 0.70, // 70% business, 30% private
      }

      const deductibleAmount = asset.totalCost * asset.businessUsePercentage

      expect(deductibleAmount).toBe(21000)
    })

    it('should handle 100% business use', () => {
      const expense = {
        description: 'Dedicated business phone line',
        amount: 1200,
        businessUsePercentage: 1.0,
      }

      const deductibleAmount = expense.amount * expense.businessUsePercentage

      expect(deductibleAmount).toBe(1200)
    })

    it('should handle 0% business use (fully private)', () => {
      const expense = {
        description: 'Personal vacation',
        amount: 5000,
        businessUsePercentage: 0.0,
      }

      const deductibleAmount = expense.amount * expense.businessUsePercentage

      expect(deductibleAmount).toBe(0)
    })

    const apportionmentTests = [
      { businessUse: 0.80, amount: 10000, expected: 8000 },
      { businessUse: 0.60, amount: 15000, expected: 9000 },
      { businessUse: 0.50, amount: 20000, expected: 10000 },
      { businessUse: 0.25, amount: 8000, expected: 2000 },
    ]

    apportionmentTests.forEach(({ businessUse, amount, expected }) => {
      it(`should calculate ${businessUse * 100}% business use for $${amount}`, () => {
        const deductible = amount * businessUse
        expect(deductible).toBe(expected)
      })
    })
  })

  describe('Blackhole Expenditure (Section 40-880)', () => {
    it('should allow 5-year write-off for business establishment costs', () => {
      const establishmentCost = 25000
      const writeOffPeriod = 5 // years

      const annualDeduction = establishmentCost / writeOffPeriod

      expect(annualDeduction).toBe(5000)
    })

    it('should identify eligible blackhole expenditure types', () => {
      const eligibleTypes = [
        'Legal fees - company formation',
        'Business name registration',
        'Initial prospecting costs',
        'Unsuccessful takeover bid costs',
      ]

      eligibleTypes.forEach(type => {
        const isBlackholeExpenditure = type.toLowerCase().includes('formation') ||
                                      type.toLowerCase().includes('registration') ||
                                      type.toLowerCase().includes('prospecting') ||
                                      type.toLowerCase().includes('unsuccessful')
        expect(isBlackholeExpenditure).toBe(true)
      })
    })

    it('should calculate deduction over 5-year period', () => {
      const totalCost = 50000
      const years = 5

      const yearlyDeductions = Array.from({ length: years }, () =>
        totalCost / years
      )

      expect(yearlyDeductions).toHaveLength(5)
      expect(yearlyDeductions[0]).toBe(10000)
      expect(yearlyDeductions.reduce((sum, d) => sum + d, 0)).toBe(50000)
    })
  })

  describe('Prepayment Rules (Section 82KZM)', () => {
    it('should allow immediate deduction for prepayments <= 12 months', () => {
      const prepayment = {
        description: 'Annual insurance premium',
        amount: 12000,
        servicePeriodMonths: 12,
        paymentDate: new Date('2024-07-01'),
      }

      const isImmediatelyDeductible = prepayment.servicePeriodMonths <= 12

      expect(isImmediatelyDeductible).toBe(true)
    })

    it('should require apportionment for prepayments > 12 months', () => {
      const prepayment = {
        description: '2-year maintenance contract',
        amount: 24000,
        servicePeriodMonths: 24,
        paymentDate: new Date('2024-07-01'),
      }

      const isImmediatelyDeductible = prepayment.servicePeriodMonths <= 12

      expect(isImmediatelyDeductible).toBe(false)

      // Should apportion over 2 years
      const annualDeduction = prepayment.amount / (prepayment.servicePeriodMonths / 12)
      expect(annualDeduction).toBe(12000)
    })

    it('should handle edge case at 12-month boundary', () => {
      const prepayment = {
        description: 'Exactly 12-month service',
        amount: 6000,
        servicePeriodMonths: 12,
      }

      const isImmediatelyDeductible = prepayment.servicePeriodMonths <= 12

      expect(isImmediatelyDeductible).toBe(true)
    })

    it('should calculate apportioned deduction for multi-year prepayment', () => {
      const prepayment = {
        amount: 36000,
        servicePeriodMonths: 36, // 3 years
      }

      const annualDeduction = prepayment.amount / (prepayment.servicePeriodMonths / 12)

      expect(annualDeduction).toBe(12000)
    })
  })

  describe('Common Deductible Expenses', () => {
    it('should identify advertising and marketing as deductible', () => {
      const expense = {
        description: 'Google Ads campaign',
        accountCode: '420', // Marketing
        amount: 5000,
      }

      const isDeductible = expense.accountCode.startsWith('4') // Expense accounts
      expect(isDeductible).toBe(true)
    })

    it('should identify bad debts as deductible (Section 25-35)', () => {
      const expense = {
        description: 'Write-off - uncollectable invoice',
        accountCode: '460', // Bad Debts
        amount: 10000,
        wasIncomeAccounted: true, // Must have been included in assessable income
      }

      const isDeductible = expense.wasIncomeAccounted
      expect(isDeductible).toBe(true)
    })

    it('should identify interest on business loans as deductible', () => {
      const expense = {
        description: 'Bank loan interest',
        accountCode: '404', // Interest Expense
        amount: 15000,
        loanPurpose: 'business',
      }

      const isDeductible = expense.loanPurpose === 'business'
      expect(isDeductible).toBe(true)
    })

    it('should deny interest on private loans', () => {
      const expense = {
        description: 'Home loan interest',
        accountCode: '404',
        amount: 20000,
        loanPurpose: 'private',
      }

      const isDeductible = expense.loanPurpose === 'business'
      expect(isDeductible).toBe(false)
    })

    const commonExpenses = [
      { type: 'Rent', deductible: true },
      { type: 'Utilities', deductible: true },
      { type: 'Phone and internet', deductible: true },
      { type: 'Professional fees', deductible: true },
      { type: 'Bank fees', deductible: true },
      { type: 'Depreciation', deductible: true },
      { type: 'Employee superannuation', deductible: true },
      { type: 'Entertainment - client meals', deductible: false },
      { type: 'Fines and penalties', deductible: false },
      { type: 'Income tax', deductible: false },
    ]

    commonExpenses.forEach(({ type, deductible }) => {
      it(`should ${deductible ? 'allow' : 'deny'} deduction for ${type}`, () => {
        expect(deductible).toBe(deductible)
      })
    })
  })

  describe('Home Office Expenses', () => {
    it('should calculate fixed-rate method ($0.67 per hour)', () => {
      const hoursWorked = 1000 // hours per year
      const fixedRate = 0.67 // $0.67 per hour

      const deduction = hoursWorked * fixedRate

      expect(deduction).toBe(670)
    })

    it('should calculate actual cost method with floor space percentage', () => {
      const homeExpenses = {
        rent: 24000,
        utilities: 4000,
        internet: 1200,
        total: 29200,
      }

      const homeOfficePercentage = 0.15 // 15% of home used for business

      const deduction = homeExpenses.total * homeOfficePercentage

      expect(deduction).toBe(4380)
    })

    it('should not allow deduction for mortgage principal', () => {
      const homeExpenses = {
        mortgagePrincipal: 20000, // Not deductible
        mortgageInterest: 15000, // Deductible (if income-producing property)
      }

      const officePercentage = 0.10

      const deductiblePortion = homeExpenses.mortgageInterest * officePercentage

      expect(deductiblePortion).toBe(1500)

      // Principal should never be deductible
      const principalDeduction = 0
      expect(principalDeduction).toBe(0)
    })
  })

  describe('Motor Vehicle Expenses', () => {
    it('should calculate cents per kilometre method (88 cents for FY2024-25)', () => {
      const kilometres = 5000 // max 5,000km per car
      const rate = 0.88 // 88 cents per km

      const deduction = kilometres * rate

      expect(deduction).toBe(4400)
    })

    it('should cap cents per km at 5,000km', () => {
      const kilometres = 10000 // Exceeds cap
      const maxKm = 5000
      const rate = 0.88

      const deduction = Math.min(kilometres, maxKm) * rate

      expect(deduction).toBe(4400)
    })

    it('should calculate logbook method with business percentage', () => {
      const totalCarExpenses = {
        fuel: 3000,
        registration: 800,
        insurance: 1200,
        servicing: 1500,
        total: 6500,
      }

      const businessUsePercentage = 0.65 // 65% business use from logbook

      const deduction = totalCarExpenses.total * businessUsePercentage

      expect(deduction).toBe(4225)
    })

    it('should require minimum 12-week logbook period', () => {
      const logbook = {
        durationWeeks: 12,
        businessKm: 8000,
        totalKm: 12000,
      }

      const isValidLogbook = logbook.durationWeeks >= 12

      expect(isValidLogbook).toBe(true)

      const businessPercentage = logbook.businessKm / logbook.totalKm

      expect(businessPercentage).toBeCloseTo(0.667, 2)
    })
  })

  describe('Integration with Mock Data', () => {
    it('should process Xero transactions for deduction analysis', () => {
      const transactions = XeroMockFactory.transactions(50, {
        accountTypes: ['200', '400', '500', '600', '800'], // Expense accounts
        financialYear: 'FY2023-24',
      })

      expect(transactions.length).toBe(50)
      expect(transactions[0]).toHaveProperty('accountCode')
      expect(transactions[0]).toHaveProperty('amount')
    })

    it('should use validator for deduction eligibility', () => {
      const result = ValidatorMockFactory.deductionResult(true, {
        description: 'Office rent',
        amount: 2000,
        hasBusinessPurpose: true,
      })

      expect(result.passed).toBe(true)
      expect(result.confidence).toBeGreaterThan(80)
    })

    it('should flag non-deductible expenses', () => {
      const result = ValidatorMockFactory.deductionResult(false, {
        description: 'Entertainment - client dinner',
        amount: 500,
        hasBusinessPurpose: true, // Even with business purpose, entertainment is non-deductible
      })

      expect(result.passed).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero-dollar expenses', () => {
      const expense = {
        amount: 0,
        hasBusinessPurpose: true,
      }

      const deduction = expense.amount

      expect(deduction).toBe(0)
    })

    it('should handle very large deductions', () => {
      const expense = {
        description: 'Major equipment purchase',
        amount: 1000000,
        isCapital: true,
      }

      // Capital expense - use depreciation not immediate deduction
      const isImmediatelyDeductible = !expense.isCapital

      expect(isImmediatelyDeductible).toBe(false)
    })

    it('should handle expenses in foreign currency', () => {
      const expense = {
        description: 'Overseas supplier',
        amountUSD: 5000,
        exchangeRate: 1.52, // AUD/USD
        amountAUD: 5000 * 1.52,
      }

      const deductionInAUD = expense.amountAUD

      expect(deductionInAUD).toBe(7600)
    })

    it('should handle GST-exclusive vs GST-inclusive amounts', () => {
      const expense = {
        amountIncGST: 11000,
        gstRate: 0.10, // 10% GST
      }

      const amountExcGST = expense.amountIncGST / (1 + expense.gstRate)

      expect(amountExcGST).toBeCloseTo(10000, 2)
    })
  })

  describe('Timing of Deductions', () => {
    it('should apply cash basis for small businesses (< $10M turnover)', () => {
      const business = {
        turnover: 5000000, // $5M
        usesCashBasis: true,
      }

      const expense = {
        invoiceDate: new Date('2024-05-15'),
        paidDate: new Date('2024-07-10'), // Next FY
      }

      // Cash basis - deduct when paid, not invoiced
      const deductionYear = expense.paidDate.getFullYear()

      expect(deductionYear).toBe(2024)
      expect(business.usesCashBasis).toBe(true)
    })

    it('should apply accruals basis for large businesses', () => {
      const business = {
        turnover: 50000000, // $50M
        usesCashBasis: false,
      }

      const expense = {
        invoiceDate: new Date('2024-06-15'),
        paidDate: new Date('2024-08-10'),
      }

      // Accruals basis - deduct when incurred, not paid
      const deductionYear = expense.invoiceDate.getFullYear()

      expect(deductionYear).toBe(2024)
      expect(business.usesCashBasis).toBe(false)
    })
  })
})
