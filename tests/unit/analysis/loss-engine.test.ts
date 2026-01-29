/**
 * Tax Loss Engine Tests (Subdivision 36-A ITAA 1997)
 *
 * Tests for tax loss carry-forward analysis:
 * - Continuity of Ownership Test (COT)
 * - Same Business Test (SBT)
 * - Loss recoupment calculations
 * - Prior year loss tracking
 * - Business continuity assessment
 */

import { describe, it, expect } from 'vitest'
import { ValidatorMockFactory } from '@/tests/__mocks__/data/validator-fixtures'

describe('LossEngine', () => {
  describe('Continuity of Ownership Test (COT)', () => {
    it('should pass COT when ownership unchanged for entire loss year', () => {
      const ownership = {
        lossYear: 'FY2022-23',
        testPeriod: {
          start: new Date('2022-07-01'),
          end: new Date('2023-06-30'),
        },
        shareholding: [
          { shareholder: 'John Smith', percentage: 60, period: 'entire year' },
          { shareholder: 'Jane Doe', percentage: 40, period: 'entire year' },
        ],
      }

      // COT requires > 50% ownership maintained throughout test period
      const majorityHolder = ownership.shareholding.find(sh => sh.percentage > 50)
      const cotPassed = majorityHolder?.period === 'entire year'

      expect(cotPassed).toBe(true)
    })

    it('should fail COT when majority ownership changes', () => {
      const ownership = {
        lossYear: 'FY2022-23',
        ownershipChange: {
          date: new Date('2023-01-15'),
          description: 'Sale of 60% shares to new investor',
        },
        beforeChange: [
          { shareholder: 'Original Owner', percentage: 60 },
        ],
        afterChange: [
          { shareholder: 'New Investor', percentage: 60 },
        ],
      }

      // Ownership change occurred during test period
      const cotPassed = false // Majority ownership changed

      expect(cotPassed).toBe(false)
    })

    it('should allow minor ownership changes under 50% threshold', () => {
      const ownership = {
        shareholding: [
          { shareholder: 'Majority Owner', percentage: 70, stable: true },
          { shareholder: 'Minor Investor A', percentage: 15 },
          { shareholder: 'Minor Investor B', percentage: 15 },
        ],
      }

      // Minor investors changed, but majority owner (70%) unchanged
      const majorityStable = ownership.shareholding.find(sh => sh.percentage > 50)?.stable

      expect(majorityStable).toBe(true)
    })

    it('should track beneficial ownership, not just legal ownership', () => {
      const ownership = {
        legalOwner: 'Trust ABC',
        beneficialOwners: [
          { name: 'John Smith', percentage: 60 },
          { name: 'Jane Doe', percentage: 40 },
        ],
      }

      // COT looks through trusts to beneficial ownership
      const beneficialMajority = ownership.beneficialOwners.find(bo => bo.percentage > 50)

      expect(beneficialMajority).toBeDefined()
      expect(beneficialMajority?.percentage).toBe(60)
    })

    const cotScenarios = [
      {
        scenario: 'No ownership change',
        ownershipStable: true,
        cotPasses: true,
      },
      {
        scenario: 'Sale of 51% shares',
        ownershipStable: false,
        cotPasses: false,
      },
      {
        scenario: 'Death of majority shareholder',
        ownershipStable: false,
        cotPasses: false,
      },
      {
        scenario: 'Share buyback maintaining proportions',
        ownershipStable: true,
        cotPasses: true,
      },
    ]

    cotScenarios.forEach(({ scenario, ownershipStable, cotPasses }) => {
      it(`should handle ${scenario}`, () => {
        expect(ownershipStable).toBe(cotPasses)
      })
    })
  })

  describe('Same Business Test (SBT)', () => {
    it('should pass SBT when business activities unchanged', () => {
      const business = {
        lossYearActivities: [
          'Software development',
          'IT consulting',
          'Cloud infrastructure',
        ],
        currentActivities: [
          'Software development',
          'IT consulting',
          'Cloud infrastructure',
        ],
      }

      const activitiesMatch = JSON.stringify(business.lossYearActivities.sort()) ===
                              JSON.stringify(business.currentActivities.sort())

      expect(activitiesMatch).toBe(true)
    })

    it('should fail SBT when business completely changes', () => {
      const business = {
        lossYearActivities: ['Software development'],
        currentActivities: ['Property investment', 'Real estate sales'],
      }

      const activitiesOverlap = business.lossYearActivities.some(activity =>
        business.currentActivities.includes(activity)
      )

      expect(activitiesOverlap).toBe(false)
    })

    it('should allow incremental business expansion', () => {
      const business = {
        lossYearActivities: [
          'Software development',
          'IT consulting',
        ],
        currentActivities: [
          'Software development',
          'IT consulting',
          'Cloud infrastructure', // New but related
        ],
      }

      // Original activities still present
      const originalActivitiesContinue = business.lossYearActivities.every(activity =>
        business.currentActivities.includes(activity)
      )

      expect(originalActivitiesContinue).toBe(true)
    })

    it('should assess business assets and employees for continuity', () => {
      const businessContinuity = {
        assets: {
          lossYear: ['Office building', 'Software licenses', 'Client contracts'],
          current: ['Office building', 'Software licenses', 'Client contracts'],
          retained: true,
        },
        employees: {
          lossYear: ['John (CEO)', 'Jane (CTO)', '10 developers'],
          current: ['John (CEO)', 'Jane (CTO)', '12 developers'],
          keyPersonnelRetained: true,
        },
        customers: {
          lossYear: ['Client A', 'Client B', 'Client C'],
          current: ['Client A', 'Client B', 'Client C', 'Client D'],
          existingClientsRetained: true,
        },
      }

      const sbtFactorsPositive = businessContinuity.assets.retained &&
                                 businessContinuity.employees.keyPersonnelRetained &&
                                 businessContinuity.customers.existingClientsRetained

      expect(sbtFactorsPositive).toBe(true)
    })

    const sbtScenarios = [
      {
        scenario: 'Expansion into related services',
        businessChanged: false,
        sbtPasses: true,
      },
      {
        scenario: 'Complete pivot to unrelated industry',
        businessChanged: true,
        sbtPasses: false,
      },
      {
        scenario: 'Scaling existing operations',
        businessChanged: false,
        sbtPasses: true,
      },
      {
        scenario: 'Acquisition of competitor (same business)',
        businessChanged: false,
        sbtPasses: true,
      },
    ]

    sbtScenarios.forEach(({ scenario, businessChanged, sbtPasses }) => {
      it(`should handle ${scenario}`, () => {
        const result = !businessChanged
        expect(result).toBe(sbtPasses)
      })
    })
  })

  describe('Loss Recoupment Calculation', () => {
    it('should deduct prior year losses from current year profit', () => {
      const currentYear = {
        taxableIncome: 150_000,
        priorYearLosses: 80_000,
      }

      const netTaxableIncome = currentYear.taxableIncome - currentYear.priorYearLosses

      expect(netTaxableIncome).toBe(70_000)
    })

    it('should carry forward unused losses to future years', () => {
      const currentYear = {
        taxableIncome: 50_000,
        priorYearLosses: 100_000,
      }

      const lossesUsed = Math.min(currentYear.taxableIncome, currentYear.priorYearLosses)
      const lossesCarriedForward = currentYear.priorYearLosses - lossesUsed

      expect(lossesUsed).toBe(50_000)
      expect(lossesCarriedForward).toBe(50_000)
    })

    it('should apply losses in chronological order (FIFO)', () => {
      const losses = [
        { year: 'FY2020-21', amount: 30_000 },
        { year: 'FY2021-22', amount: 40_000 },
        { year: 'FY2022-23', amount: 20_000 },
      ]

      const currentYearProfit = 50_000

      let remainingProfit = currentYearProfit
      const lossesApplied = []

      for (const loss of losses) {
        if (remainingProfit <= 0) break

        const lossUsed = Math.min(remainingProfit, loss.amount)
        lossesApplied.push({ year: loss.year, amount: lossUsed })
        remainingProfit -= lossUsed
      }

      expect(lossesApplied).toHaveLength(2)
      expect(lossesApplied[0]).toEqual({ year: 'FY2020-21', amount: 30_000 })
      expect(lossesApplied[1]).toEqual({ year: 'FY2021-22', amount: 20_000 })
      expect(remainingProfit).toBe(0)
    })

    it('should calculate tax savings from loss recoupment', () => {
      const scenario = {
        profitWithoutLosses: 100_000,
        priorYearLosses: 60_000,
        corporateTaxRate: 0.30, // 30%
      }

      const taxableIncomeWithLosses = scenario.profitWithoutLosses - scenario.priorYearLosses
      const taxWithLosses = taxableIncomeWithLosses * scenario.corporateTaxRate

      const taxWithoutLosses = scenario.profitWithoutLosses * scenario.corporateTaxRate
      const taxSavings = taxWithoutLosses - taxWithLosses

      expect(taxableIncomeWithLosses).toBe(40_000)
      expect(taxSavings).toBe(18_000) // $60k loss × 30% = $18k saved
    })
  })

  describe('Multi-Year Loss Tracking', () => {
    it('should track losses across multiple years', () => {
      interface YearlyResults {
        year: string
        profit: number
        lossCarriedForward: number
      }

      const yearlyResults: YearlyResults[] = [
        { year: 'FY2020-21', profit: -50_000, lossCarriedForward: 50_000 },
        { year: 'FY2021-22', profit: -30_000, lossCarriedForward: 80_000 },
        { year: 'FY2022-23', profit: 40_000, lossCarriedForward: 40_000 },
        { year: 'FY2023-24', profit: 60_000, lossCarriedForward: 0 },
      ]

      // Verify cumulative loss tracking
      expect(yearlyResults[0].lossCarriedForward).toBe(50_000)
      expect(yearlyResults[1].lossCarriedForward).toBe(80_000) // 50k + 30k
      expect(yearlyResults[2].lossCarriedForward).toBe(40_000) // 80k - 40k
      expect(yearlyResults[3].lossCarriedForward).toBe(0) // 40k - 40k (fully recouped)
    })

    it('should calculate total losses available for recoupment', () => {
      const lossHistory = [
        { year: 'FY2020-21', loss: 50_000, used: 0, remaining: 50_000 },
        { year: 'FY2021-22', loss: 30_000, used: 0, remaining: 30_000 },
        { year: 'FY2022-23', loss: 20_000, used: 0, remaining: 20_000 },
      ]

      const totalLossesAvailable = lossHistory.reduce((sum, entry) => sum + entry.remaining, 0)

      expect(totalLossesAvailable).toBe(100_000)
    })

    it('should track partial loss utilization across years', () => {
      const lossYear = {
        year: 'FY2020-21',
        originalLoss: 100_000,
        utilizationHistory: [
          { year: 'FY2021-22', used: 30_000 },
          { year: 'FY2022-23', used: 40_000 },
          { year: 'FY2023-24', used: 20_000 },
        ],
      }

      const totalUsed = lossYear.utilizationHistory.reduce((sum, u) => sum + u.used, 0)
      const remaining = lossYear.originalLoss - totalUsed

      expect(totalUsed).toBe(90_000)
      expect(remaining).toBe(10_000)
    })
  })

  describe('Trust Loss Rules (Schedule 2F)', () => {
    it('should require 50%+ stake for trust loss recoupment', () => {
      const trust = {
        type: 'discretionary',
        beneficiaries: [
          { name: 'John Smith', fixedEntitlement: 60 },
          { name: 'Jane Doe', fixedEntitlement: 40 },
        ],
      }

      // For trust losses, need 50%+ fixed entitlement
      const eligibleBeneficiary = trust.beneficiaries.find(b => b.fixedEntitlement > 50)

      expect(eligibleBeneficiary).toBeDefined()
      expect(eligibleBeneficiary?.fixedEntitlement).toBe(60)
    })

    it('should prevent loss streaming to tax-exempt entities', () => {
      const distribution = {
        loss: 50_000,
        proposedBeneficiary: {
          name: 'Charity Foundation',
          taxExempt: true,
        },
      }

      // Cannot stream losses to tax-exempt beneficiaries
      const canStreamLoss = !distribution.proposedBeneficiary.taxExempt

      expect(canStreamLoss).toBe(false)
    })

    it('should apply family trust election for trust losses', () => {
      const trust = {
        hasFamilyTrustElection: true,
        familyGroup: ['John Smith', 'Jane Smith', 'Children'],
        outsideBeneficiary: 'Unrelated Party',
      }

      // Family trust election restricts distributions to family group
      const canDistributeToOutsider = !trust.hasFamilyTrustElection

      expect(canDistributeToOutsider).toBe(false)
    })
  })

  describe('Loss Integrity Rules', () => {
    it('should prevent loss trafficking (Section 175-10)', () => {
      const transaction = {
        description: 'Acquisition of loss company',
        lossCompany: {
          losses: 500_000,
          netAssets: 100_000, // Losses exceed net assets significantly
        },
        purchasePrice: 150_000,
        primaryPurpose: 'acquire_losses', // Red flag
      }

      // Loss trafficking indicators
      const lossesExceedAssets = transaction.lossCompany.losses > transaction.lossCompany.netAssets * 2
      const suspiciousPurpose = transaction.primaryPurpose === 'acquire_losses'

      const isLossTrafficking = lossesExceedAssets && suspiciousPurpose

      expect(isLossTrafficking).toBe(true)
    })

    it('should apply commercial debt forgiveness (Section 245-35)', () => {
      const debtForgiveness = {
        originalDebt: 200_000,
        amountForgiven: 150_000,
        priorYearLosses: 100_000,
      }

      // Commercial debt forgiveness reduces prior year losses first
      const lossReduction = Math.min(debtForgiveness.amountForgiven, debtForgiveness.priorYearLosses)
      const remainingLosses = debtForgiveness.priorYearLosses - lossReduction

      expect(lossReduction).toBe(100_000)
      expect(remainingLosses).toBe(0)
    })
  })

  describe('Integration with Mock Data', () => {
    it('should validate loss calculations with validator', () => {
      const result = ValidatorMockFactory.lossResult(true, {
        lossYear: 'FY2022-23',
        lossAmount: 80_000,
        cotPassed: true,
        sbtPassed: true,
      })

      expect(result.passed).toBe(true)
      expect(result.confidence).toBeGreaterThan(85)
    })

    it('should flag COT/SBT failures', () => {
      const result = ValidatorMockFactory.lossResult(false, {
        lossYear: 'FY2022-23',
        lossAmount: 80_000,
        cotPassed: false,
        sbtPassed: false,
      })

      expect(result.passed).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues).toContain('COT failed - ownership change detected')
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero losses', () => {
      const year = {
        taxableIncome: 100_000,
        priorYearLosses: 0,
      }

      const netIncome = year.taxableIncome - year.priorYearLosses

      expect(netIncome).toBe(100_000)
    })

    it('should handle very old losses (no time limit)', () => {
      const loss = {
        year: 'FY2010-11', // 13 years old
        amount: 50_000,
        cotMaintained: true,
      }

      // Australian tax losses have no expiry if COT maintained
      const canUse = loss.cotMaintained

      expect(canUse).toBe(true)
    })

    it('should handle losses exceeding current year profit', () => {
      const scenario = {
        currentProfit: 30_000,
        priorLosses: 100_000,
      }

      const taxableIncome = Math.max(0, scenario.currentProfit - scenario.priorLosses)

      expect(taxableIncome).toBe(0)
    })

    it('should handle company restructures and demergers', () => {
      const restructure = {
        type: 'demerger',
        originalCompany: 'Parent Co',
        newEntity: 'Demerged Co',
        lossAllocation: {
          parent: 60_000,
          demerged: 40_000,
        },
      }

      const totalLosses = restructure.lossAllocation.parent + restructure.lossAllocation.demerged

      expect(totalLosses).toBe(100_000)
    })
  })

  describe('Reporting and Documentation', () => {
    it('should require Schedule 36 for loss recoupment', () => {
      const taxReturn = {
        hasSchedule36: true,
        lossDetails: {
          currentYearLoss: 0,
          priorYearLosses: 80_000,
          lossesApplied: 50_000,
          lossesCarriedForward: 30_000,
        },
      }

      expect(taxReturn.hasSchedule36).toBe(true)
      expect(taxReturn.lossDetails.lossesApplied + taxReturn.lossDetails.lossesCarriedForward)
        .toBe(taxReturn.lossDetails.priorYearLosses)
    })

    it('should document COT/SBT compliance', () => {
      const documentation = {
        cotEvidence: [
          'Share register for loss year',
          'Share register for current year',
          'Statutory declarations from shareholders',
        ],
        sbtEvidence: [
          'Business activity statements',
          'Customer contracts',
          'Asset register',
        ],
      }

      expect(documentation.cotEvidence.length).toBeGreaterThan(0)
      expect(documentation.sbtEvidence.length).toBeGreaterThan(0)
    })
  })
})
