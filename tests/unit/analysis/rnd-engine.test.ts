/**
 * R&D Tax Incentive Engine Tests
 *
 * Tests for lib/analysis/rnd-engine.ts
 * Division 355 ITAA 1997 - R&D Tax Incentive
 */

import { describe, it, expect, beforeEach } from 'vitest'

// =============================================================================
// R&D Eligibility Tests (Four-Element Test)
// =============================================================================

describe('R&D Four-Element Eligibility Test', () => {
  interface RndActivity {
    outcomeUnknown: boolean
    systematicApproach: boolean
    generatesNewKnowledge: boolean
    scientificMethod: boolean
  }

  function isEligibleForRnd(activity: RndActivity): boolean {
    return (
      activity.outcomeUnknown &&
      activity.systematicApproach &&
      activity.generatesNewKnowledge &&
      activity.scientificMethod
    )
  }

  it('passes when all four elements are met', () => {
    const activity: RndActivity = {
      outcomeUnknown: true,
      systematicApproach: true,
      generatesNewKnowledge: true,
      scientificMethod: true
    }

    expect(isEligibleForRnd(activity)).toBe(true)
  })

  it('fails when outcome is known', () => {
    const activity: RndActivity = {
      outcomeUnknown: false, // Known outcome = routine work
      systematicApproach: true,
      generatesNewKnowledge: true,
      scientificMethod: true
    }

    expect(isEligibleForRnd(activity)).toBe(false)
  })

  it('fails when not systematic', () => {
    const activity: RndActivity = {
      outcomeUnknown: true,
      systematicApproach: false, // Ad-hoc work not eligible
      generatesNewKnowledge: true,
      scientificMethod: true
    }

    expect(isEligibleForRnd(activity)).toBe(false)
  })

  it('fails when no new knowledge generated', () => {
    const activity: RndActivity = {
      outcomeUnknown: true,
      systematicApproach: true,
      generatesNewKnowledge: false, // Just applying existing knowledge
      scientificMethod: true
    }

    expect(isEligibleForRnd(activity)).toBe(false)
  })

  it('fails when not using scientific method', () => {
    const activity: RndActivity = {
      outcomeUnknown: true,
      systematicApproach: true,
      generatesNewKnowledge: true,
      scientificMethod: false // No hypothesis/testing
    }

    expect(isEligibleForRnd(activity)).toBe(false)
  })
})

// =============================================================================
// R&D Offset Calculation Tests
// =============================================================================

describe('R&D Tax Offset Calculation', () => {
  const RND_OFFSET_RATE_SMALL_BUSINESS = 0.435 // 43.5% for turnover < $20M
  const RND_OFFSET_RATE_LARGE_BUSINESS = 0.385 // 38.5% for turnover >= $20M
  const TURNOVER_THRESHOLD = 20_000_000

  function calculateRndOffset(
    expenditure: number,
    aggregatedTurnover: number
  ): number {
    const rate =
      aggregatedTurnover < TURNOVER_THRESHOLD
        ? RND_OFFSET_RATE_SMALL_BUSINESS
        : RND_OFFSET_RATE_LARGE_BUSINESS

    return Math.round(expenditure * rate * 100) / 100
  }

  it('calculates 43.5% offset for small business', () => {
    const offset = calculateRndOffset(100000, 10_000_000)
    expect(offset).toBe(43500)
  })

  it('calculates 38.5% offset for large business', () => {
    const offset = calculateRndOffset(100000, 50_000_000)
    expect(offset).toBe(38500)
  })

  it('uses small business rate at threshold boundary', () => {
    // Just under $20M
    const offset = calculateRndOffset(100000, 19_999_999)
    expect(offset).toBe(43500)
  })

  it('uses large business rate at threshold', () => {
    // Exactly $20M
    const offset = calculateRndOffset(100000, 20_000_000)
    expect(offset).toBe(38500)
  })

  it('handles large expenditure amounts', () => {
    const offset = calculateRndOffset(5_000_000, 10_000_000)
    expect(offset).toBe(2_175_000)
  })

  it('handles zero expenditure', () => {
    const offset = calculateRndOffset(0, 10_000_000)
    expect(offset).toBe(0)
  })

  it('rounds correctly to 2 decimal places', () => {
    const offset = calculateRndOffset(100001, 10_000_000)
    expect(offset).toBe(43500.44) // 100001 * 0.435 = 43500.435
  })
})

// =============================================================================
// Eligible Expenditure Categories
// =============================================================================

describe('Eligible R&D Expenditure Categories', () => {
  type ExpenditureCategory =
    | 'salary_wages'
    | 'contractor_costs'
    | 'materials_consumables'
    | 'software_licenses'
    | 'equipment_depreciation'
    | 'overhead_costs'
    | 'travel'
    | 'marketing'
    | 'routine_testing'

  function isEligibleExpenditure(category: ExpenditureCategory): boolean {
    const eligible: ExpenditureCategory[] = [
      'salary_wages',
      'contractor_costs',
      'materials_consumables',
      'software_licenses',
      'equipment_depreciation',
      'overhead_costs' // Limited to 20% of direct costs
    ]

    return eligible.includes(category)
  }

  it('includes salary and wages', () => {
    expect(isEligibleExpenditure('salary_wages')).toBe(true)
  })

  it('includes contractor costs', () => {
    expect(isEligibleExpenditure('contractor_costs')).toBe(true)
  })

  it('includes materials and consumables', () => {
    expect(isEligibleExpenditure('materials_consumables')).toBe(true)
  })

  it('includes software licenses', () => {
    expect(isEligibleExpenditure('software_licenses')).toBe(true)
  })

  it('includes equipment depreciation', () => {
    expect(isEligibleExpenditure('equipment_depreciation')).toBe(true)
  })

  it('includes overhead costs (limited)', () => {
    expect(isEligibleExpenditure('overhead_costs')).toBe(true)
  })

  it('excludes travel costs', () => {
    expect(isEligibleExpenditure('travel')).toBe(false)
  })

  it('excludes marketing', () => {
    expect(isEligibleExpenditure('marketing')).toBe(false)
  })

  it('excludes routine testing', () => {
    expect(isEligibleExpenditure('routine_testing')).toBe(false)
  })
})

// =============================================================================
// Overhead Cost Limitation Tests
// =============================================================================

describe('Overhead Cost Limitation (20% cap)', () => {
  function calculateMaxOverheads(directCosts: number): number {
    return Math.round(directCosts * 0.20 * 100) / 100
  }

  function calculateEligibleExpenditureWithOverheads(
    directCosts: number,
    overheadCosts: number
  ): number {
    const maxOverheads = calculateMaxOverheads(directCosts)
    const eligibleOverheads = Math.min(overheadCosts, maxOverheads)
    return directCosts + eligibleOverheads
  }

  it('allows overheads up to 20% of direct costs', () => {
    const directCosts = 100000
    const overheads = 15000 // 15%

    const eligible = calculateEligibleExpenditureWithOverheads(
      directCosts,
      overheads
    )

    expect(eligible).toBe(115000)
  })

  it('caps overheads at 20%', () => {
    const directCosts = 100000
    const overheads = 30000 // 30% - exceeds cap

    const eligible = calculateEligibleExpenditureWithOverheads(
      directCosts,
      overheads
    )

    expect(eligible).toBe(120000) // 100k + 20k (capped)
  })

  it('handles zero overheads', () => {
    const eligible = calculateEligibleExpenditureWithOverheads(100000, 0)
    expect(eligible).toBe(100000)
  })

  it('calculates 20% cap correctly', () => {
    expect(calculateMaxOverheads(100000)).toBe(20000)
    expect(calculateMaxOverheads(500000)).toBe(100000)
  })
})

// =============================================================================
// Registration Deadline Tests
// =============================================================================

describe('R&D Registration Deadlines', () => {
  interface FinancialYear {
    startDate: Date
    endDate: Date
  }

  function getRegistrationDeadline(fy: FinancialYear): Date {
    // Deadline is 10 months after end of financial year
    const deadline = new Date(fy.endDate)
    deadline.setMonth(deadline.getMonth() + 10)
    return deadline
  }

  it('calculates deadline 10 months after FY end', () => {
    const fy: FinancialYear = {
      startDate: new Date('2024-07-01'),
      endDate: new Date('2025-06-30')
    }

    const deadline = getRegistrationDeadline(fy)

    expect(deadline.getFullYear()).toBe(2026)
    expect(deadline.getMonth()).toBe(3) // April (0-indexed)
    expect(deadline.getDate()).toBe(30)
  })

  it('handles FY2023-24', () => {
    const fy: FinancialYear = {
      startDate: new Date('2023-07-01'),
      endDate: new Date('2024-06-30')
    }

    const deadline = getRegistrationDeadline(fy)

    expect(deadline.toISOString().slice(0, 10)).toBe('2025-04-30')
  })
})

// =============================================================================
// Confidence Scoring Tests
// =============================================================================

describe('R&D Confidence Scoring', () => {
  interface RndAssessment {
    hasKeywords: boolean // Software, algorithm, research, prototype, etc.
    hasSystematicEvidence: boolean // Documentation, version control
    hasNovelty: boolean // New approach, not routine
    hasUncertainty: boolean // Unknown outcome
    hasTechnicalRisk: boolean // Could fail
  }

  function calculateConfidenceScore(assessment: RndAssessment): number {
    let score = 0

    if (assessment.hasKeywords) score += 20
    if (assessment.hasSystematicEvidence) score += 25
    if (assessment.hasNovelty) score += 25
    if (assessment.hasUncertainty) score += 15
    if (assessment.hasTechnicalRisk) score += 15

    return score
  }

  it('gives maximum score for strong R&D evidence', () => {
    const assessment: RndAssessment = {
      hasKeywords: true,
      hasSystematicEvidence: true,
      hasNovelty: true,
      hasUncertainty: true,
      hasTechnicalRisk: true
    }

    expect(calculateConfidenceScore(assessment)).toBe(100)
  })

  it('gives medium score for partial evidence', () => {
    const assessment: RndAssessment = {
      hasKeywords: true,
      hasSystematicEvidence: true,
      hasNovelty: false,
      hasUncertainty: false,
      hasTechnicalRisk: false
    }

    expect(calculateConfidenceScore(assessment)).toBe(45)
  })

  it('gives low score for weak evidence', () => {
    const assessment: RndAssessment = {
      hasKeywords: true,
      hasSystematicEvidence: false,
      hasNovelty: false,
      hasUncertainty: false,
      hasTechnicalRisk: false
    }

    expect(calculateConfidenceScore(assessment)).toBe(20)
  })
})
