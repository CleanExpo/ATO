/**
 * Tests for Client View Transformer (lib/utils/client-view-transformer.ts)
 *
 * Validates:
 * - transformDataQualityToClientView() generates correct headlines based on accuracy tiers
 * - transformDataQualityToClientView() generates key findings from issue types
 * - transformDataQualityToClientView() calculates accuracy score correctly
 * - transformDataQualityToClientView() estimates fix time based on pending review count
 * - transformDataQualityToClientView() generates issue breakdown with percentages
 * - transformDataQualityToClientView() provides appropriate "what this means" text
 * - transformDataQualityToClientView() generates next steps
 * - transformForensicAuditToClientView() generates headlines based on benefit tiers
 * - transformForensicAuditToClientView() generates findings from tax areas
 * - transformForensicAuditToClientView() calculates issue breakdown percentages
 * - Edge cases: zero issues, zero transactions, zero benefit
 */

import { describe, it, expect } from 'vitest'
import {
  transformDataQualityToClientView,
  transformForensicAuditToClientView,
  type DataQualityScanResult,
  type ForensicAuditResult,
} from '@/lib/utils/client-view-transformer'

// ---------------------------------------------------------------------------
// Helpers — factory functions for test data
// ---------------------------------------------------------------------------

function makeDataQuality(overrides: Partial<DataQualityScanResult> = {}): DataQualityScanResult {
  return {
    issuesFound: 5,
    transactionsScanned: 1000,
    issuesByType: {
      duplicate: 2,
      wrongAccount: 1,
      taxClassification: 1,
      unreconciled: 1,
      misallocated: 0,
    },
    totalImpactAmount: 15000,
    issuesAutoCorrected: 3,
    issuesPendingReview: 2,
    confidence: 90,
    ...overrides,
  }
}

function makeForensicAudit(overrides: Partial<ForensicAuditResult> = {}): ForensicAuditResult {
  return {
    totalAdjustedBenefit: 250000,
    byTaxArea: {
      rnd: 100000,
      deductions: 80000,
      losses: 50000,
      div7a: 20000,
    },
    byPriority: {
      critical: 2,
      high: 5,
      medium: 10,
      low: 3,
    },
    transactionsAnalyzed: 5000,
    yearsAnalyzed: 3,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// transformDataQualityToClientView
// ---------------------------------------------------------------------------

describe('transformDataQualityToClientView', () => {
  // -- Headline tiers --

  it('generates "Excellent" headline for >= 95% accuracy', () => {
    const data = makeDataQuality({ issuesFound: 2, transactionsScanned: 100 }) // 98%
    const result = transformDataQualityToClientView(data)

    expect(result.headline).toContain('Excellent')
    expect(result.headline).toContain('98%')
  })

  it('generates "Good news" headline for 85-94% accuracy', () => {
    const data = makeDataQuality({ issuesFound: 10, transactionsScanned: 100 }) // 90%
    const result = transformDataQualityToClientView(data)

    expect(result.headline).toContain('Good news')
    expect(result.headline).toContain('90%')
  })

  it('generates "some fixes needed" headline for 75-84% accuracy', () => {
    const data = makeDataQuality({ issuesFound: 20, transactionsScanned: 100 }) // 80%
    const result = transformDataQualityToClientView(data)

    expect(result.headline).toContain('80%')
    expect(result.headline).toContain('some fixes needed')
  })

  it('generates issues-count headline for < 75% accuracy', () => {
    const data = makeDataQuality({ issuesFound: 30, transactionsScanned: 100 }) // 70%
    const result = transformDataQualityToClientView(data)

    expect(result.headline).toContain('30 issues')
  })

  // -- Accuracy score --

  it('calculates accuracy score correctly', () => {
    const data = makeDataQuality({ issuesFound: 5, transactionsScanned: 200 }) // 97.5% -> 98
    const result = transformDataQualityToClientView(data)

    expect(result.visualData.accuracyScore).toBe(98)
  })

  // -- Key findings --

  it('includes duplicate finding when duplicates exist', () => {
    const data = makeDataQuality({
      issuesByType: { duplicate: 5, wrongAccount: 0, taxClassification: 0, unreconciled: 0, misallocated: 0 },
    })
    const result = transformDataQualityToClientView(data)

    expect(result.keyFindings.some(f => f.includes('duplicate'))).toBe(true)
  })

  it('includes wrong account finding', () => {
    const data = makeDataQuality({
      issuesByType: { duplicate: 0, wrongAccount: 3, taxClassification: 0, unreconciled: 0, misallocated: 0 },
    })
    const result = transformDataQualityToClientView(data)

    expect(result.keyFindings.some(f => f.includes('wrong category'))).toBe(true)
  })

  it('includes tax classification finding', () => {
    const data = makeDataQuality({
      issuesByType: { duplicate: 0, wrongAccount: 0, taxClassification: 4, unreconciled: 0, misallocated: 0 },
    })
    const result = transformDataQualityToClientView(data)

    expect(result.keyFindings.some(f => f.includes('tax settings'))).toBe(true)
  })

  it('includes auto-corrected finding', () => {
    const data = makeDataQuality({ issuesAutoCorrected: 7 })
    const result = transformDataQualityToClientView(data)

    expect(result.keyFindings.some(f => f.includes('automatically fixed'))).toBe(true)
  })

  it('skips findings for zero-count issue types', () => {
    const data = makeDataQuality({
      issuesByType: { duplicate: 0, wrongAccount: 0, taxClassification: 0, unreconciled: 0, misallocated: 0 },
      issuesAutoCorrected: 0,
    })
    const result = transformDataQualityToClientView(data)

    expect(result.keyFindings).toHaveLength(0)
  })

  // -- Estimated fix time --

  it('estimates 30 minutes for <= 10 pending reviews', () => {
    const result = transformDataQualityToClientView(makeDataQuality({ issuesPendingReview: 5 }))
    expect(result.visualData.estimatedFixTime).toBe('30 minutes')
  })

  it('estimates 30-60 minutes for 11-20 pending reviews', () => {
    const result = transformDataQualityToClientView(makeDataQuality({ issuesPendingReview: 15 }))
    expect(result.visualData.estimatedFixTime).toBe('30-60 minutes')
  })

  it('estimates 1-2 hours for 21-50 pending reviews', () => {
    const result = transformDataQualityToClientView(makeDataQuality({ issuesPendingReview: 30 }))
    expect(result.visualData.estimatedFixTime).toBe('1-2 hours')
  })

  it('estimates 3-4 hours for > 50 pending reviews', () => {
    const result = transformDataQualityToClientView(makeDataQuality({ issuesPendingReview: 100 }))
    expect(result.visualData.estimatedFixTime).toBe('3-4 hours')
  })

  // -- Issue breakdown --

  it('includes only non-zero issue types in breakdown', () => {
    const data = makeDataQuality({
      issuesFound: 10,
      issuesByType: { duplicate: 5, wrongAccount: 5, taxClassification: 0, unreconciled: 0, misallocated: 0 },
    })
    const result = transformDataQualityToClientView(data)

    expect(result.issueBreakdown).toHaveLength(2) // duplicate + wrongAccount
  })

  it('calculates correct percentages', () => {
    const data = makeDataQuality({
      issuesFound: 10,
      issuesByType: { duplicate: 5, wrongAccount: 3, taxClassification: 2, unreconciled: 0, misallocated: 0 },
    })
    const result = transformDataQualityToClientView(data)

    const duplicateEntry = result.issueBreakdown.find(i => i.name === 'Duplicate Transactions')
    expect(duplicateEntry?.percentage).toBe(50)
  })

  it('handles zero total issues without division by zero', () => {
    const data = makeDataQuality({
      issuesFound: 0,
      issuesByType: { duplicate: 0, wrongAccount: 0, taxClassification: 0, unreconciled: 0, misallocated: 0 },
    })
    const result = transformDataQualityToClientView(data)

    expect(result.issueBreakdown).toHaveLength(0)
  })

  // -- What this means --

  it('returns excellent explanation for >= 95% accuracy', () => {
    const data = makeDataQuality({ issuesFound: 1, transactionsScanned: 100 })
    const result = transformDataQualityToClientView(data)

    expect(result.whatThisMeans).toContain('excellent shape')
  })

  it('returns good explanation for 85-94% accuracy', () => {
    const data = makeDataQuality({ issuesFound: 10, transactionsScanned: 100 })
    const result = transformDataQualityToClientView(data)

    expect(result.whatThisMeans).toContain('generally good')
  })

  it('returns needs-attention explanation for < 85% accuracy', () => {
    const data = makeDataQuality({ issuesFound: 20, transactionsScanned: 100 })
    const result = transformDataQualityToClientView(data)

    expect(result.whatThisMeans).toContain('several issues')
  })

  // -- Next steps --

  it('always includes accountant scheduling step', () => {
    const result = transformDataQualityToClientView(makeDataQuality())
    expect(result.nextSteps.some(s => s.includes('accountant'))).toBe(true)
  })

  it('includes review step when issues pending', () => {
    const result = transformDataQualityToClientView(makeDataQuality({ issuesPendingReview: 5 }))
    expect(result.nextSteps.some(s => s.includes('Review'))).toBe(true)
  })

  // -- Visual data --

  it('sets savingsPotential from totalImpactAmount', () => {
    const result = transformDataQualityToClientView(makeDataQuality({ totalImpactAmount: 25000 }))
    expect(result.visualData.savingsPotential).toBe(25000)
  })

  it('sets issuesCount from issuesFound', () => {
    const result = transformDataQualityToClientView(makeDataQuality({ issuesFound: 42 }))
    expect(result.visualData.issuesCount).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// transformForensicAuditToClientView
// ---------------------------------------------------------------------------

describe('transformForensicAuditToClientView', () => {
  // -- Headline tiers --

  it('generates "Excellent" headline for > $100k benefit', () => {
    const data = makeForensicAudit({ totalAdjustedBenefit: 250000 })
    const result = transformForensicAuditToClientView(data)

    expect(result.headline).toContain('Excellent')
    expect(result.headline).toContain('$250k')
  })

  it('generates "Good news" headline for $50k-$100k benefit', () => {
    const data = makeForensicAudit({ totalAdjustedBenefit: 75000 })
    const result = transformForensicAuditToClientView(data)

    expect(result.headline).toContain('Good news')
    expect(result.headline).toContain('$75k')
  })

  it('generates "opportunities" headline for < $50k benefit', () => {
    const data = makeForensicAudit({ totalAdjustedBenefit: 30000 })
    const result = transformForensicAuditToClientView(data)

    expect(result.headline).toContain('opportunities')
    expect(result.headline).toContain('$30k')
  })

  // -- Key findings --

  it('includes R&D finding when rnd > 0', () => {
    const result = transformForensicAuditToClientView(makeForensicAudit())
    expect(result.keyFindings.some(f => f.includes('R&D'))).toBe(true)
  })

  it('includes deductions finding when deductions > 0', () => {
    const result = transformForensicAuditToClientView(makeForensicAudit())
    expect(result.keyFindings.some(f => f.includes('deductions'))).toBe(true)
  })

  it('includes losses finding when losses > 0', () => {
    const result = transformForensicAuditToClientView(makeForensicAudit())
    expect(result.keyFindings.some(f => f.includes('losses'))).toBe(true)
  })

  it('includes div7a finding when div7a > 0', () => {
    const result = transformForensicAuditToClientView(makeForensicAudit())
    expect(result.keyFindings.some(f => f.includes('Division 7A'))).toBe(true)
  })

  it('includes transaction count finding', () => {
    const data = makeForensicAudit({ transactionsAnalyzed: 12345, yearsAnalyzed: 4 })
    const result = transformForensicAuditToClientView(data)

    expect(result.keyFindings.some(f => f.includes('12,345') && f.includes('4 years'))).toBe(true)
  })

  it('skips findings for zero-value tax areas', () => {
    const data = makeForensicAudit({
      totalAdjustedBenefit: 50000,
      byTaxArea: { rnd: 0, deductions: 50000, losses: 0, div7a: 0 },
    })
    const result = transformForensicAuditToClientView(data)

    expect(result.keyFindings.some(f => f.includes('R&D'))).toBe(false)
    expect(result.keyFindings.some(f => f.includes('losses'))).toBe(false)
    expect(result.keyFindings.some(f => f.includes('Division 7A'))).toBe(false)
  })

  // -- Issue breakdown --

  it('includes only non-zero tax areas in breakdown', () => {
    const data = makeForensicAudit({
      totalAdjustedBenefit: 100000,
      byTaxArea: { rnd: 50000, deductions: 50000, losses: 0, div7a: 0 },
    })
    const result = transformForensicAuditToClientView(data)

    expect(result.issueBreakdown).toHaveLength(2)
  })

  it('calculates correct breakdown percentages', () => {
    const data = makeForensicAudit({
      totalAdjustedBenefit: 100000,
      byTaxArea: { rnd: 60000, deductions: 40000, losses: 0, div7a: 0 },
    })
    const result = transformForensicAuditToClientView(data)

    const rndEntry = result.issueBreakdown.find(i => i.name === 'R&D Tax Incentive')
    expect(rndEntry?.percentage).toBe(60)
  })

  // -- Visual data --

  it('sets savingsPotential from totalAdjustedBenefit', () => {
    const result = transformForensicAuditToClientView(makeForensicAudit({ totalAdjustedBenefit: 123456 }))
    expect(result.visualData.savingsPotential).toBe(123456)
  })

  it('sets issuesCount from critical + high priority count', () => {
    const data = makeForensicAudit({
      byPriority: { critical: 3, high: 7, medium: 10, low: 5 },
    })
    const result = transformForensicAuditToClientView(data)

    expect(result.visualData.issuesCount).toBe(10) // 3 + 7
  })

  it('sets accuracyScore to 0 (not applicable)', () => {
    const result = transformForensicAuditToClientView(makeForensicAudit())
    expect(result.visualData.accuracyScore).toBe(0)
  })

  // -- Static content --

  it('includes whatThisMeans text about AI analysis', () => {
    const result = transformForensicAuditToClientView(makeForensicAudit())
    expect(result.whatThisMeans).toContain('AI')
  })

  it('includes 5 next steps', () => {
    const result = transformForensicAuditToClientView(makeForensicAudit())
    expect(result.nextSteps).toHaveLength(5)
  })

  it('includes accountant step in next steps', () => {
    const result = transformForensicAuditToClientView(makeForensicAudit())
    expect(result.nextSteps.some(s => s.includes('accountant'))).toBe(true)
  })
})
