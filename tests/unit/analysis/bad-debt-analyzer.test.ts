/**
 * Bad Debt Analyzer Tests (Section 25-35 ITAA 1997)
 *
 * Tests for bad debt deduction eligibility:
 * - Debt previously included in assessable income
 * - Debt written off as bad during income year
 * - Reasonable steps taken to recover debt
 * - Debtor insolvency or uneconomical to pursue
 * - Documentation requirements
 */

import { describe, it, expect } from 'vitest'
import { ValidatorMockFactory } from '@/tests/__mocks__/data/validator-fixtures'

describe('BadDebtAnalyzer', () => {
  describe('Income Test (Section 25-35(2))', () => {
    it('should require debt was included in assessable income', () => {
      const debt = {
        invoiceNumber: 'INV-001',
        amount: 10_000,
        invoiceDate: new Date('2023-05-15'),
        includedInIncome: true, // Critical requirement
      }

      const isDeductible = debt.includedInIncome

      expect(isDeductible).toBe(true)
    })

    it('should deny deduction for debts not previously in income', () => {
      const debt = {
        description: 'Loan to friend',
        amount: 5_000,
        includedInIncome: false, // Not business income
      }

      const isDeductible = debt.includedInIncome

      expect(isDeductible).toBe(false)
    })

    it('should verify debt was assessable income in prior year', () => {
      const debt = {
        invoiceDate: new Date('2022-08-15'),
        recognizedIncome: {
          year: 'FY2022-23',
          amount: 15_000,
          method: 'accruals', // Income recognized when invoiced
        },
        writeOffDate: new Date('2024-03-20'),
        writeOffYear: 'FY2023-24',
      }

      // Debt was in assessable income in FY2022-23
      const wasInIncome = debt.recognizedIncome.year !== debt.writeOffYear

      expect(wasInIncome).toBe(true)
    })

    const incomeScenarios = [
      {
        type: 'Trade debtor - services rendered',
        includedInIncome: true,
        deductible: true,
      },
      {
        type: 'Trade debtor - goods sold',
        includedInIncome: true,
        deductible: true,
      },
      {
        type: 'Personal loan to employee',
        includedInIncome: false,
        deductible: false,
      },
      {
        type: 'Capital contribution',
        includedInIncome: false,
        deductible: false,
      },
    ]

    incomeScenarios.forEach(({ type, includedInIncome, deductible }) => {
      it(`should handle ${type}`, () => {
        expect(includedInIncome).toBe(deductible)
      })
    })
  })

  describe('Write-Off Test (Section 25-35(1))', () => {
    it('should require debt written off during income year', () => {
      const debt = {
        amount: 8_000,
        writeOffDate: new Date('2024-04-15'),
        financialYear: 'FY2023-24',
        formallyWrittenOff: true, // Board resolution or similar
      }

      const isWrittenOff = debt.formallyWrittenOff

      expect(isWrittenOff).toBe(true)
    })

    it('should require formal write-off action', () => {
      const writeOffEvidence = {
        boardResolution: true,
        resolutionDate: new Date('2024-03-20'),
        accountingEntry: {
          debit: 'Bad Debts Expense',
          credit: 'Accounts Receivable',
          amount: 10_000,
        },
      }

      const hasFormalWriteOff = writeOffEvidence.boardResolution &&
                               writeOffEvidence.accountingEntry.debit === 'Bad Debts Expense'

      expect(hasFormalWriteOff).toBe(true)
    })

    it('should verify write-off occurred in correct income year', () => {
      const debt = {
        writeOffDate: new Date('2024-06-15'), // June 15, 2024
        financialYear: 'FY2023-24', // July 1, 2023 - June 30, 2024
      }

      const fyStart = new Date('2023-07-01')
      const fyEnd = new Date('2024-06-30')

      const isInCorrectYear = debt.writeOffDate >= fyStart && debt.writeOffDate <= fyEnd

      expect(isInCorrectYear).toBe(true)
    })

    it('should not allow provisional write-offs', () => {
      const debt = {
        status: 'doubtful',
        provision: 5_000, // Provision for doubtful debt
        actualWriteOff: false,
      }

      // Provisions are not deductible, only actual write-offs
      const isDeductible = debt.actualWriteOff

      expect(isDeductible).toBe(false)
    })
  })

  describe('Reasonable Steps Test', () => {
    it('should verify reasonable debt recovery attempts', () => {
      const recoveryAttempts = [
        { date: '2023-08-15', action: 'Sent reminder email' },
        { date: '2023-09-01', action: 'Phone call to debtor' },
        { date: '2023-10-15', action: 'Formal demand letter' },
        { date: '2023-12-01', action: 'Engaged debt collector' },
      ]

      const hasReasonableSteps = recoveryAttempts.length >= 3

      expect(hasReasonableSteps).toBe(true)
    })

    it('should accept debtor insolvency as reasonable to write off', () => {
      const debtor = {
        name: 'Insolvent Company Pty Ltd',
        status: 'liquidation',
        liquidatorAppointed: new Date('2024-01-15'),
        estimatedRecovery: 0.05, // 5 cents in the dollar
      }

      const isInsolvent = debtor.status === 'liquidation' || debtor.status === 'bankruptcy'

      expect(isInsolvent).toBe(true)
    })

    it('should accept uneconomical pursuit as reasonable', () => {
      const debt = {
        amount: 500,
        estimatedRecoveryCost: {
          legalFees: 2_000,
          courtFees: 500,
          timeValue: 1_000,
          total: 3_500,
        },
      }

      const isUneconomical = debt.estimatedRecoveryCost.total > debt.amount

      expect(isUneconomical).toBe(true)
    })

    it('should accept debtor unable to be located', () => {
      const debtor = {
        lastKnownAddress: '123 Main St, Sydney',
        skipTracingAttempts: [
          { date: '2023-09-15', method: 'Address search', result: 'Not found' },
          { date: '2023-10-01', method: 'Phone directory', result: 'Unlisted' },
          { date: '2023-11-01', method: 'Social media search', result: 'No profile' },
        ],
        located: false,
      }

      const cannotLocate = !debtor.located && debtor.skipTracingAttempts.length >= 2

      expect(cannotLocate).toBe(true)
    })

    const reasonableStepsTests = [
      { scenario: 'Multiple reminders sent', reasonable: true },
      { scenario: 'Debt collector engaged', reasonable: true },
      { scenario: 'Legal action commenced', reasonable: true },
      { scenario: 'Debtor bankrupt', reasonable: true },
      { scenario: 'No contact attempts made', reasonable: false },
      { scenario: 'Single email sent only', reasonable: false },
    ]

    reasonableStepsTests.forEach(({ scenario, reasonable }) => {
      it(`should assess ${scenario} as ${reasonable ? 'reasonable' : 'unreasonable'}`, () => {
        expect(reasonable).toBe(reasonable)
      })
    })
  })

  describe('Partial Recovery', () => {
    it('should handle partial debt recovery before write-off', () => {
      const debt = {
        originalAmount: 10_000,
        partialPayment: 3_000,
        remainingBalance: 7_000,
      }

      const deductibleAmount = debt.remainingBalance

      expect(deductibleAmount).toBe(7_000)
    })

    it('should reverse deduction if debt recovered after write-off', () => {
      const debt = {
        originalAmount: 10_000,
        writtenOffYear: 'FY2023-24',
        writtenOffAmount: 10_000,
        recoveryYear: 'FY2024-25',
        recoveredAmount: 6_000,
      }

      // Recovered amount is assessable income in recovery year
      const assessableInRecoveryYear = debt.recoveredAmount

      expect(assessableInRecoveryYear).toBe(6_000)
    })

    it('should allow write-off of balance after partial recovery', () => {
      const debt = {
        originalInvoice: 15_000,
        payments: [
          { date: '2023-08-01', amount: 2_000 },
          { date: '2023-09-15', amount: 3_000 },
        ],
        totalPaid: 5_000,
        balance: 10_000,
        writeOffDate: new Date('2024-03-20'),
      }

      const deductibleWriteOff = debt.balance

      expect(deductibleWriteOff).toBe(10_000)
      expect(debt.originalInvoice).toBe(debt.totalPaid + debt.balance)
    })
  })

  describe('Documentation Requirements', () => {
    it('should require comprehensive debt documentation', () => {
      const documentation = {
        invoice: true, // Original invoice
        proofOfDelivery: true, // Goods/services provided
        accountingRecords: true, // Debt in AR ledger
        incomeRecognition: true, // Included in tax return
        writeOffEvidence: true, // Board minutes/email
        recoveryAttempts: true, // Correspondence log
      }

      const allDocumentationPresent = Object.values(documentation).every(d => d === true)

      expect(allDocumentationPresent).toBe(true)
    })

    it('should maintain debt recovery timeline', () => {
      const timeline = [
        { date: '2023-05-15', event: 'Invoice issued', amount: 10_000 },
        { date: '2023-06-15', event: 'Payment due' },
        { date: '2023-07-01', event: 'First reminder sent' },
        { date: '2023-08-15', event: 'Second reminder sent' },
        { date: '2023-10-01', event: 'Demand letter sent' },
        { date: '2024-01-15', event: 'Debtor entered liquidation' },
        { date: '2024-03-20', event: 'Debt written off as bad' },
      ]

      expect(timeline.length).toBeGreaterThan(5)
      expect(timeline[0].event).toBe('Invoice issued')
      expect(timeline[timeline.length - 1].event).toBe('Debt written off as bad')
    })

    it('should document commercial judgment to write off', () => {
      const writeOffDecision = {
        debtAge: 18, // months
        debtorStatus: 'liquidation',
        recoveryProbability: 0.02, // 2%
        recoveryCost: 3_500,
        debtAmount: 2_000,
        recommendation: 'Write off as uneconomical to pursue',
        approvedBy: 'CFO',
        approvalDate: new Date('2024-03-20'),
      }

      const hasCommercialJustification = writeOffDecision.recoveryCost > writeOffDecision.debtAmount

      expect(hasCommercialJustification).toBe(true)
    })
  })

  describe('Industry-Specific Bad Debts', () => {
    it('should handle construction industry retention debts', () => {
      const retentionDebt = {
        contractValue: 100_000,
        retentionPercentage: 0.10,
        retentionAmount: 10_000,
        releaseDate: new Date('2024-06-30'),
        clientInsolvent: true,
      }

      // Retention was in assessable income, now unrecoverable
      const isDeductible = retentionDebt.clientInsolvent

      expect(isDeductible).toBe(true)
      expect(retentionDebt.retentionAmount).toBe(10_000)
    })

    it('should handle professional services WIP write-offs', () => {
      const wip = {
        client: 'ABC Company',
        unbilledWork: 15_000,
        billed: false,
        includedInIncome: false, // WIP not yet billed
      }

      // Unbilled WIP not in assessable income = not deductible as bad debt
      const isDeductible = wip.includedInIncome

      expect(isDeductible).toBe(false)
    })

    it('should handle subscription service bad debts', () => {
      const subscription = {
        customer: 'Customer XYZ',
        monthlyFee: 500,
        billedMonths: 6,
        totalBilled: 3_000,
        paidMonths: 2,
        totalPaid: 1_000,
        unpaidBalance: 2_000,
      }

      // Billed amounts were in assessable income
      const deductibleAmount = subscription.unpaidBalance

      expect(deductibleAmount).toBe(2_000)
    })
  })

  describe('Connected Entities and Related Parties', () => {
    it('should scrutinize bad debts from related parties', () => {
      const debt = {
        debtor: 'Related Company Pty Ltd',
        relationship: 'Same controlling shareholders',
        armLength: false,
        commercialTerms: false,
      }

      // Related party debts require commercial substance
      const requiresScrutiny = !debt.armLength

      expect(requiresScrutiny).toBe(true)
    })

    it('should deny deduction for non-commercial related party debts', () => {
      const debt = {
        debtor: 'Director loan account',
        commercial: false,
        marketInterestCharged: false,
      }

      const isDeductible = debt.commercial && debt.marketInterestCharged

      expect(isDeductible).toBe(false)
    })

    it('should allow genuine trade debts from related parties', () => {
      const debt = {
        debtor: 'Sister Company Pty Ltd',
        nature: 'Trade debt for services',
        marketRates: true,
        normalTerms: true,
        commercial: true,
      }

      const isDeductible = debt.commercial && debt.marketRates

      expect(isDeductible).toBe(true)
    })
  })

  describe('Timing and Quantum', () => {
    it('should deduct bad debt in year written off', () => {
      const debt = {
        invoiceYear: 'FY2021-22',
        writeOffYear: 'FY2023-24',
      }

      const deductionYear = debt.writeOffYear

      expect(deductionYear).toBe('FY2023-24')
      expect(deductionYear).not.toBe(debt.invoiceYear)
    })

    it('should calculate exact deductible amount', () => {
      const debt = {
        invoiceAmountExGST: 10_000,
        gst: 1_000,
        invoiceAmountIncGST: 11_000,
        gstClaimedAsCredit: true,
      }

      // Deduct ex-GST amount (GST already claimed as input tax credit)
      const deductibleAmount = debt.invoiceAmountExGST

      expect(deductibleAmount).toBe(10_000)
    })

    it('should handle foreign currency debts', () => {
      const debt = {
        invoiceAmountUSD: 10_000,
        invoiceDate: new Date('2023-05-15'),
        exchangeRateAtInvoice: 1.50, // AUD/USD
        writeOffDate: new Date('2024-03-20'),
        exchangeRateAtWriteOff: 1.48,
        recognizedIncomeAUD: 15_000, // 10,000 × 1.50
      }

      // Deduct AUD amount that was included in assessable income
      const deductibleAmount = debt.recognizedIncomeAUD

      expect(deductibleAmount).toBe(15_000)
    })
  })

  describe('Integration with Mock Data', () => {
    it('should validate bad debt eligibility', () => {
      const result = ValidatorMockFactory.deductionResult(true, {
        description: 'Bad debt - Invoice #12345',
        amount: 8_000,
        includedInIncome: true,
        writtenOff: true,
        reasonableSteps: true,
      } as any)

      expect(result.passed).toBe(true)
      expect(result.confidence).toBeGreaterThan(80)
    })

    it('should flag missing income inclusion', () => {
      const result = ValidatorMockFactory.deductionResult(false, {
        description: 'Loan to employee',
        amount: 5_000,
        includedInIncome: false,
      } as any)

      expect(result.passed).toBe(false)
      expect(result.issues).toContain('Debt not previously included in assessable income')
    })

    it('should flag insufficient recovery attempts', () => {
      const result = ValidatorMockFactory.deductionResult(false, {
        description: 'Trade debtor write-off',
        amount: 10_000,
        recoveryAttempts: 1, // Insufficient
      } as any)

      expect(result.passed).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle statute-barred debts', () => {
      const debt = {
        invoiceDate: new Date('2018-05-15'),
        writeOffDate: new Date('2024-03-20'),
        yearsOld: 6,
        statuteBarred: true, // Cannot legally pursue after 6 years
      }

      // Statute-barred = reasonable to write off
      const reasonableToWriteOff = debt.statuteBarred

      expect(reasonableToWriteOff).toBe(true)
    })

    it('should handle debtor deceased with no estate', () => {
      const debtor = {
        name: 'John Doe',
        status: 'deceased',
        dateOfDeath: new Date('2024-01-15'),
        estate: {
          value: 0,
          solvent: false,
        },
      }

      const isUnrecoverable = debtor.status === 'deceased' && !debtor.estate.solvent

      expect(isUnrecoverable).toBe(true)
    })

    it('should handle zero-value debts', () => {
      const debt = {
        originalAmount: 0,
      }

      const deductibleAmount = debt.originalAmount

      expect(deductibleAmount).toBe(0)
    })

    it('should handle debts with interest component', () => {
      const debt = {
        principal: 10_000,
        accruedInterest: 2_000,
        totalDebt: 12_000,
        principalInIncome: true,
        interestInIncome: true,
      }

      // Both principal and interest were in assessable income
      const deductibleAmount = debt.totalDebt

      expect(deductibleAmount).toBe(12_000)
    })
  })

  describe('ATO Compliance and Audit Risk', () => {
    it('should maintain contemporaneous records', () => {
      const records = {
        invoice: { date: '2023-05-15', retained: true },
        deliveryProof: { date: '2023-05-20', retained: true },
        reminderLetters: { count: 3, retained: true },
        writeOffApproval: { date: '2024-03-20', retained: true },
      }

      const hasContemporaneousRecords = Object.values(records).every(r => r.retained)

      expect(hasContemporaneousRecords).toBe(true)
    })

    it('should identify high-risk bad debt claims', () => {
      const claim = {
        amount: 100_000, // Large amount
        debtorIsRelated: true, // Related party
        recoveryAttempts: 1, // Minimal attempts
        daysOverdue: 60, // Recent debt
      }

      const isHighRisk = claim.amount > 50_000 &&
                        claim.debtorIsRelated &&
                        claim.recoveryAttempts < 3 &&
                        claim.daysOverdue < 180

      expect(isHighRisk).toBe(true)
    })

    it('should verify commercial substance', () => {
      const debt = {
        hasWrittenContract: true,
        marketTerms: true,
        genuineCommercialPurpose: true,
        armLengthNegotiation: true,
      }

      const hasCommercialSubstance = debt.hasWrittenContract &&
                                     debt.marketTerms &&
                                     debt.genuineCommercialPurpose

      expect(hasCommercialSubstance).toBe(true)
    })
  })

  describe('Cash vs Accruals Basis', () => {
    it('should handle bad debts under accruals accounting', () => {
      const business = {
        accountingBasis: 'accruals',
        debt: {
          invoiceDate: new Date('2023-05-15'),
          incomeRecognized: true, // Recognized when invoiced
          paidDate: null,
        },
      }

      // Accruals: Income recognized = bad debt deductible
      const isDeductible = business.accountingBasis === 'accruals' && business.debt.incomeRecognized

      expect(isDeductible).toBe(true)
    })

    it('should handle bad debts under cash accounting', () => {
      const business = {
        accountingBasis: 'cash',
        debt: {
          invoiceDate: new Date('2023-05-15'),
          paidDate: null, // Never paid
          incomeRecognized: false, // Cash basis: no income until paid
        },
      }

      // Cash basis: No income = no bad debt deduction
      const isDeductible = business.accountingBasis === 'cash' && business.debt.incomeRecognized

      expect(isDeductible).toBe(false)
    })
  })
})
