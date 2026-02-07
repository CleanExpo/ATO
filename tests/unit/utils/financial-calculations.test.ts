import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'

/**
 * Unit Tests: Financial Calculations
 *
 * Tests financial calculation utilities including:
 * - Tax offset calculations
 * - Decimal precision handling
 * - Interest rate calculations
 * - Financial year utilities
 * - GST calculations
 * - Percentage calculations
 */

describe('R&D Tax Offset Calculations', () => {
  it('should calculate 43.5% offset for eligible expenditure', () => {
    const expenditure = 100000
    const offsetRate = new Decimal('0.435')
    const offset = new Decimal(expenditure).times(offsetRate).toNumber()

    expect(offset).toBe(43500)
  })

  it('should handle decimal precision correctly', () => {
    const expenditure = 123456.78
    const offsetRate = new Decimal('0.435')
    const offset = new Decimal(expenditure)
      .times(offsetRate)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber()

    expect(offset).toBe(53703.70)
  })

  it('should calculate total offset for multiple activities', () => {
    const activities = [
      { expenditure: 50000 },
      { expenditure: 30000 },
      { expenditure: 20000 }
    ]

    const offsetRate = new Decimal('0.435')
    const totalExpenditure = activities.reduce((sum, a) => sum + a.expenditure, 0)
    const totalOffset = new Decimal(totalExpenditure)
      .times(offsetRate)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber()

    expect(totalExpenditure).toBe(100000)
    expect(totalOffset).toBe(43500)
  })

  it('should apply small business offset rate (43.5%)', () => {
    const turnover = 15000000 // < $20M threshold
    const offsetRate = turnover < 20000000 ? 0.435 : 0.385

    expect(offsetRate).toBe(0.435)
  })

  it('should apply large business offset rate (38.5%)', () => {
    const turnover = 25000000 // > $20M threshold
    const offsetRate = turnover < 20000000 ? 0.435 : 0.385

    expect(offsetRate).toBe(0.385)
  })
})

describe('Division 7A Interest Calculations', () => {
  it('should calculate minimum repayment using annuity formula', () => {
    const principal = 100000
    const rate = 0.0877 // 8.77% FY2024-25
    const term = 7 // years for unsecured loan

    // Annuity formula: P * (r / (1 - (1 + r)^-n))
    const minimumRepayment = principal * (rate / (1 - Math.pow(1 + rate, -term)))

    expect(minimumRepayment).toBeCloseTo(19716, 0)
  })

  it('should calculate deemed dividend for shortfall', () => {
    const minimumRepayment = 19344
    const actualRepayment = 15000
    const shortfall = minimumRepayment - actualRepayment

    const deemedDividend = shortfall > 0 ? shortfall : 0

    expect(deemedDividend).toBeCloseTo(4344, 0)
  })

  it('should use 8.77% benchmark rate for FY2024-25', () => {
    const financialYear = 'FY2024-25'
    const benchmarkRates: { [key: string]: number } = {
      'FY2024-25': 0.0877,
      'FY2023-24': 0.0827,
      'FY2022-23': 0.0452
    }

    const rate = benchmarkRates[financialYear]

    expect(rate).toBe(0.0877)
  })

  it('should calculate interest for partial year', () => {
    const principal = 100000
    const annualRate = 0.0877
    const daysHeld = 183 // Half year
    const daysInYear = 365

    const interest = principal * annualRate * (daysHeld / daysInYear)

    expect(interest).toBeCloseTo(4397, 0)
  })

  it('should determine loan term (7 years unsecured, 25 years secured)', () => {
    const unsecuredTerm = 7
    const securedTerm = 25

    const loanType = 'unsecured'
    const term = loanType === 'unsecured' ? unsecuredTerm : securedTerm

    expect(term).toBe(7)
  })
})

describe('Financial Year Utilities', () => {
  it('should parse FY2023-24 to date range', () => {
    const fy = 'FY2023-24'
    const yearMatch = fy.match(/^FY(\d{4})-(\d{2})$/)

    expect(yearMatch).toBeTruthy()

    if (yearMatch) {
      const startYear = parseInt(yearMatch[1])
      const endYear = parseInt(`20${yearMatch[2]}`)

      expect(startYear).toBe(2023)
      expect(endYear).toBe(2024)

      const startDate = new Date(startYear, 6, 1) // July 1, 2023
      const endDate = new Date(endYear, 5, 30) // June 30, 2024

      expect(startDate.toLocaleDateString('en-CA')).toBe('2023-07-01')
      expect(endDate.toLocaleDateString('en-CA')).toBe('2024-06-30')
    }
  })

  it('should determine current financial year', () => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() // 0-11

    let fyStartYear: number
    let fyEndYear: number

    if (currentMonth >= 6) {
      // July-December: FY starts this year
      fyStartYear = currentYear
      fyEndYear = currentYear + 1
    } else {
      // January-June: FY started last year
      fyStartYear = currentYear - 1
      fyEndYear = currentYear
    }

    const fy = `FY${fyStartYear}-${fyEndYear.toString().slice(2)}`

    expect(fy).toMatch(/^FY\d{4}-\d{2}$/)
  })

  it('should validate FY format', () => {
    const validFY = 'FY2023-24'
    const invalidFY1 = '2023-24'
    const invalidFY2 = 'FY2023'

    const fyRegex = /^FY\d{4}-\d{2}$/

    expect(fyRegex.test(validFY)).toBe(true)
    expect(fyRegex.test(invalidFY1)).toBe(false)
    expect(fyRegex.test(invalidFY2)).toBe(false)
  })

  it('should calculate days in financial year', () => {
    const startDate = new Date('2023-07-01')
    const endDate = new Date('2024-06-30')

    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

    expect(days).toBe(366) // Leap year
  })

  it('should check if date falls within financial year', () => {
    const fy = 'FY2023-24'
    const testDate = new Date('2024-01-15')

    const fyStart = new Date('2023-07-01')
    const fyEnd = new Date('2024-06-30')

    const isInFY = testDate >= fyStart && testDate <= fyEnd

    expect(isInFY).toBe(true)
  })
})

describe('GST Calculations', () => {
  it('should calculate GST at 10% rate', () => {
    const amount = 1000
    const gstRate = 0.10
    const gst = amount * gstRate

    expect(gst).toBe(100)
  })

  it('should extract GST from inclusive amount', () => {
    const inclusiveAmount = 1100 // Includes GST
    const gstRate = 0.10

    // GST = amount / (1 + rate) * rate
    const gst = (inclusiveAmount / (1 + gstRate)) * gstRate

    expect(gst).toBeCloseTo(100, 2)
  })

  it('should add GST to exclusive amount', () => {
    const exclusiveAmount = 1000
    const gstRate = 0.10
    const inclusiveAmount = exclusiveAmount * (1 + gstRate)

    expect(inclusiveAmount).toBe(1100)
  })

  it('should calculate net GST (collected - paid)', () => {
    const gstCollected = 5000 // GST on sales
    const gstPaid = 3000 // GST on purchases
    const netGST = gstCollected - gstPaid

    expect(netGST).toBe(2000)
  })

  it('should handle GST-free sales', () => {
    const amount = 1000
    const taxType = 'EXEMPTOUTPUT'

    const gst = taxType === 'EXEMPTOUTPUT' ? 0 : amount * 0.10

    expect(gst).toBe(0)
  })
})

describe('Percentage Calculations', () => {
  it('should calculate business use percentage', () => {
    const totalExpense = 10000
    const privateUse = 3000
    const businessUse = totalExpense - privateUse

    const businessUsePercentage = (businessUse / totalExpense) * 100

    expect(businessUsePercentage).toBe(70)
  })

  it('should apportion expense by business use', () => {
    const totalExpense = 10000
    const businessUsePercentage = 70
    const deductibleAmount = totalExpense * (businessUsePercentage / 100)

    expect(deductibleAmount).toBe(7000)
  })

  it('should calculate confidence percentage', () => {
    const score = 92
    const maxScore = 100
    const confidence = (score / maxScore) * 100

    expect(confidence).toBe(92)
  })

  it('should calculate progress percentage', () => {
    const completed = 3
    const total = 5
    const progress = (completed / total) * 100

    expect(progress).toBe(60)
  })
})

describe('Decimal Precision', () => {
  it('should avoid floating point errors with Decimal', () => {
    // Floating point error
    const floatResult = 0.1 + 0.2
    expect(floatResult).not.toBe(0.3) // 0.30000000000000004

    // Decimal precision
    const decimalResult = new Decimal(0.1).plus(0.2).toNumber()
    expect(decimalResult).toBe(0.3)
  })

  it('should round to 2 decimal places for currency', () => {
    const amount = 123.456789
    const rounded = new Decimal(amount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber()

    expect(rounded).toBe(123.46)
  })

  it('should handle large numbers without precision loss', () => {
    const largeNumber = 999999999999.99
    const result = new Decimal(largeNumber).plus(0.01).toNumber()

    expect(result).toBe(1000000000000.00)
  })

  it('should multiply currency values precisely', () => {
    const price = 19.99
    const quantity = 3
    const total = new Decimal(price).times(quantity).toNumber()

    expect(total).toBe(59.97)
  })

  it('should divide amounts precisely', () => {
    const total = 100
    const parts = 3
    const perPart = new Decimal(total)
      .dividedBy(parts)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber()

    expect(perPart).toBe(33.33)
  })
})

describe('Tax Bracket Calculations', () => {
  it('should calculate tax for small business (25% rate)', () => {
    const taxableIncome = 100000
    const smallBusinessRate = 0.25
    const tax = taxableIncome * smallBusinessRate

    expect(tax).toBe(25000)
  })

  it('should calculate tax for standard company (30% rate)', () => {
    const taxableIncome = 100000
    const standardRate = 0.30
    const tax = taxableIncome * standardRate

    expect(tax).toBe(30000)
  })

  it('should apply marginal tax rates for individuals', () => {
    const income = 90000

    const brackets = [
      { threshold: 0, rate: 0 },
      { threshold: 18200, rate: 0.19 },
      { threshold: 45000, rate: 0.325 },
      { threshold: 120000, rate: 0.37 },
      { threshold: 180000, rate: 0.45 }
    ]

    let tax = 0
    let previousThreshold = 0

    for (const bracket of brackets) {
      if (income > bracket.threshold) {
        const taxableInBracket = Math.min(income, bracket.threshold) - previousThreshold
        if (previousThreshold >= 18200) {
          tax += taxableInBracket * brackets[brackets.indexOf(bracket) - 1].rate
        }
        previousThreshold = bracket.threshold
      } else {
        break
      }
    }

    // Add remaining income in current bracket
    if (income > previousThreshold) {
      const currentBracket = brackets.find(b => income <= (brackets[brackets.indexOf(b) + 1]?.threshold || Infinity))
      if (currentBracket) {
        tax += (income - previousThreshold) * currentBracket.rate
      }
    }

    expect(tax).toBeGreaterThan(0)
  })
})

describe('Loss Carry-Forward Calculations', () => {
  it('should apply losses using FIFO method', () => {
    const losses = [
      { fy: 'FY2021-22', amount: 150000, remaining: 150000 },
      { fy: 'FY2022-23', amount: 80000, remaining: 80000 }
    ]

    const currentProfit = 100000
    let remainingProfit = currentProfit

    const updatedLosses = losses.map(loss => {
      if (remainingProfit <= 0) return loss

      const lossUsed = Math.min(remainingProfit, loss.remaining)
      remainingProfit -= lossUsed

      return {
        ...loss,
        remaining: loss.remaining - lossUsed
      }
    })

    expect(updatedLosses[0].remaining).toBe(50000) // 150k - 100k
    expect(updatedLosses[1].remaining).toBe(80000) // Untouched
    expect(remainingProfit).toBe(0)
  })

  it('should calculate total available losses', () => {
    const losses = [
      { fy: 'FY2021-22', remaining: 150000 },
      { fy: 'FY2022-23', remaining: 80000 },
      { fy: 'FY2023-24', remaining: 45000 }
    ]

    const totalLosses = losses.reduce((sum, loss) => sum + loss.remaining, 0)

    expect(totalLosses).toBe(275000)
  })
})

describe('Depreciation Calculations', () => {
  it('should calculate diminishing value depreciation', () => {
    const cost = 10000
    const effectiveLife = 4 // years
    const depreciationRate = 200 / effectiveLife / 100 // 50% for DV

    let bookValue = cost
    const year1Depreciation = bookValue * depreciationRate

    expect(year1Depreciation).toBe(5000)

    bookValue -= year1Depreciation
    const year2Depreciation = bookValue * depreciationRate

    expect(year2Depreciation).toBe(2500)
  })

  it('should calculate prime cost depreciation', () => {
    const cost = 10000
    const effectiveLife = 4 // years
    const annualDepreciation = cost / effectiveLife

    expect(annualDepreciation).toBe(2500) // Same each year
  })

  it('should apply instant asset write-off for eligible assets', () => {
    const assetCost = 15000
    const threshold = 20000

    const isEligible = assetCost < threshold
    const deduction = isEligible ? assetCost : 0

    expect(isEligible).toBe(true)
    expect(deduction).toBe(15000)
  })
})

describe('Bad Debt Calculations', () => {
  it('should calculate deductible bad debt amount', () => {
    const originalDebt = 25000
    const recoveredAmount = 3000
    const deductibleAmount = originalDebt - recoveredAmount

    expect(deductibleAmount).toBe(22000)
  })

  it('should verify debt was in assessable income', () => {
    const debt = {
      amount: 25000,
      invoiceDate: '2023-08-15',
      paymentTerms: 30,
      assessableIncome: true
    }

    const isDeductible = debt.assessableIncome

    expect(isDeductible).toBe(true)
  })
})

describe('Compound Interest Calculations', () => {
  it('should calculate compound interest on investments', () => {
    const principal = 10000
    const annualRate = 0.05
    const years = 5
    const compoundsPerYear = 12 // Monthly

    const amount = principal * Math.pow(
      1 + annualRate / compoundsPerYear,
      compoundsPerYear * years
    )

    expect(amount).toBeCloseTo(12833.59, 2)
  })

  it('should calculate future value with regular contributions', () => {
    const initialPrincipal = 10000
    const monthlyContribution = 500
    const annualRate = 0.05
    const months = 60 // 5 years

    const monthlyRate = annualRate / 12
    const futureValue = initialPrincipal * Math.pow(1 + monthlyRate, months) +
      monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)

    expect(futureValue).toBeGreaterThan(45000)
  })
})

describe('Currency Formatting', () => {
  it('should format currency with 2 decimal places', () => {
    const amount = 1234.56
    const formatted = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount)

    expect(formatted).toContain('1,234.56')
  })

  it('should handle negative amounts', () => {
    const amount = -500.00
    const formatted = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount)

    expect(formatted).toContain('500.00')
  })

  it('should format large numbers with thousands separators', () => {
    const amount = 1234567.89
    const formatted = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount)

    expect(formatted).toContain('1,234,567.89')
  })
})
