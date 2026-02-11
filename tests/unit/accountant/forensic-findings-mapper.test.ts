/**
 * @vitest-environment node
 *
 * Forensic Findings Mapper Tests
 *
 * Tests the pure functions in lib/accountant/forensic-findings-mapper.ts:
 * - determineWorkflowArea: Priority-based routing of forensic rows to workflow areas
 * - mapConfidence: Weighted confidence scoring from multiple signals
 * - estimateBenefit: Per-area financial benefit calculation
 * - mapAnalysisToFinding: Full mapping from ForensicAnalysisRow to AccountantFindingInsert
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import {
  determineWorkflowArea,
  mapConfidence,
  estimateBenefit,
  mapAnalysisToFinding,
  type ForensicAnalysisRow,
  type WorkflowArea,
} from '@/lib/accountant/forensic-findings-mapper'

// ---------------------------------------------------------------------------
// Test Helper
// ---------------------------------------------------------------------------

/**
 * Create a default ForensicAnalysisRow with all flags false and sensible defaults.
 * Override any field by passing partial overrides.
 */
function createMockForensicRow(overrides: Partial<ForensicAnalysisRow> = {}): ForensicAnalysisRow {
  return {
    id: 'far-001',
    tenant_id: 'tenant-abc',
    transaction_id: 'txn-001',
    financial_year: 'FY2024-25',
    primary_category: 'Office Supplies',
    secondary_categories: null,
    category_confidence: 85,
    is_rnd_candidate: false,
    meets_div355_criteria: false,
    rnd_activity_type: null,
    rnd_confidence: null,
    rnd_reasoning: null,
    div355_outcome_unknown: null,
    div355_systematic_approach: null,
    div355_new_knowledge: null,
    div355_scientific_method: null,
    is_fully_deductible: true,
    deduction_type: 'general',
    claimable_amount: 1000,
    deduction_restrictions: null,
    deduction_confidence: 90,
    requires_documentation: false,
    fbt_implications: false,
    division7a_risk: false,
    compliance_notes: null,
    transaction_amount: -1000,
    transaction_date: '2024-10-15',
    transaction_description: 'Office supplies purchase',
    supplier_name: 'Officeworks',
    analyzed_at: '2024-11-01T10:00:00Z',
    ...overrides,
  }
}

// ===========================================================================
// determineWorkflowArea()
// ===========================================================================

describe('determineWorkflowArea', () => {
  it('should return "sundries" for R&D candidate', () => {
    const row = createMockForensicRow({ is_rnd_candidate: true })
    expect(determineWorkflowArea(row)).toBe('sundries')
  })

  it('should return "sundries" for Division 355 criteria met', () => {
    const row = createMockForensicRow({ meets_div355_criteria: true })
    expect(determineWorkflowArea(row)).toBe('sundries')
  })

  it('should return "div7a" for Division 7A risk', () => {
    const row = createMockForensicRow({ division7a_risk: true })
    expect(determineWorkflowArea(row)).toBe('div7a')
  })

  it('should return "fbt" for FBT implications', () => {
    const row = createMockForensicRow({ fbt_implications: true })
    expect(determineWorkflowArea(row)).toBe('fbt')
  })

  it('should return "documents" when documentation is required', () => {
    const row = createMockForensicRow({
      requires_documentation: true,
      is_fully_deductible: false,
      category_confidence: 85,
    })
    expect(determineWorkflowArea(row)).toBe('documents')
  })

  it('should return "deductions" for fully deductible with low confidence (<80)', () => {
    const row = createMockForensicRow({
      is_fully_deductible: true,
      deduction_confidence: 65,
    })
    expect(determineWorkflowArea(row)).toBe('deductions')
  })

  it('should return "reconciliation" for low category confidence (<50)', () => {
    const row = createMockForensicRow({
      is_fully_deductible: false,
      category_confidence: 30,
    })
    expect(determineWorkflowArea(row)).toBe('reconciliation')
  })

  it('should return null for non-actionable row (no flags, high confidence)', () => {
    const row = createMockForensicRow({
      is_fully_deductible: true,
      deduction_confidence: 90,
      category_confidence: 85,
    })
    expect(determineWorkflowArea(row)).toBeNull()
  })

  // Priority ordering tests
  it('should prioritise R&D over div7a (sundries > div7a)', () => {
    const row = createMockForensicRow({
      is_rnd_candidate: true,
      division7a_risk: true,
    })
    expect(determineWorkflowArea(row)).toBe('sundries')
  })

  it('should prioritise R&D over FBT (sundries > fbt)', () => {
    const row = createMockForensicRow({
      is_rnd_candidate: true,
      fbt_implications: true,
    })
    expect(determineWorkflowArea(row)).toBe('sundries')
  })

  it('should prioritise div7a over FBT', () => {
    const row = createMockForensicRow({
      division7a_risk: true,
      fbt_implications: true,
    })
    expect(determineWorkflowArea(row)).toBe('div7a')
  })

  it('should prioritise FBT over documents', () => {
    const row = createMockForensicRow({
      fbt_implications: true,
      requires_documentation: true,
    })
    expect(determineWorkflowArea(row)).toBe('fbt')
  })

  it('should prioritise documents over deductions', () => {
    const row = createMockForensicRow({
      requires_documentation: true,
      is_fully_deductible: true,
      deduction_confidence: 50,
    })
    expect(determineWorkflowArea(row)).toBe('documents')
  })

  it('should prioritise deductions over reconciliation', () => {
    const row = createMockForensicRow({
      is_fully_deductible: true,
      deduction_confidence: 40,
      category_confidence: 30,
    })
    expect(determineWorkflowArea(row)).toBe('deductions')
  })

  it('should return null when deduction_confidence is null and not low category', () => {
    const row = createMockForensicRow({
      is_fully_deductible: true,
      deduction_confidence: null,
      category_confidence: 85,
    })
    expect(determineWorkflowArea(row)).toBeNull()
  })

  it('should return null when category_confidence is null and no other flags', () => {
    const row = createMockForensicRow({
      is_fully_deductible: false,
      category_confidence: null,
    })
    expect(determineWorkflowArea(row)).toBeNull()
  })

  it('should handle deduction_confidence exactly at boundary (80)', () => {
    const row = createMockForensicRow({
      is_fully_deductible: true,
      deduction_confidence: 80,
    })
    // 80 is NOT less than 80, so should NOT route to deductions
    expect(determineWorkflowArea(row)).toBeNull()
  })

  it('should handle category_confidence exactly at boundary (50)', () => {
    const row = createMockForensicRow({
      is_fully_deductible: false,
      category_confidence: 50,
    })
    // 50 is NOT less than 50, so should NOT route to reconciliation
    expect(determineWorkflowArea(row)).toBeNull()
  })
})

// ===========================================================================
// mapConfidence()
// ===========================================================================

describe('mapConfidence', () => {
  it('should return High level for score >= 80', () => {
    const row = createMockForensicRow({
      category_confidence: 90,
      deduction_confidence: 90,
    })
    const result = mapConfidence(row)
    expect(result.level).toBe('High')
    expect(result.score).toBeGreaterThanOrEqual(80)
  })

  it('should return Medium level for score >= 60 and < 80', () => {
    const row = createMockForensicRow({
      category_confidence: 70,
      deduction_confidence: 65,
    })
    const result = mapConfidence(row)
    expect(result.level).toBe('Medium')
    expect(result.score).toBeGreaterThanOrEqual(60)
    expect(result.score).toBeLessThan(80)
  })

  it('should return Low level for score < 60', () => {
    const row = createMockForensicRow({
      category_confidence: 30,
      deduction_confidence: 40,
      requires_documentation: true,
    })
    const result = mapConfidence(row)
    expect(result.level).toBe('Low')
    expect(result.score).toBeLessThan(60)
  })

  it('should default category_confidence to 50 when null', () => {
    const row = createMockForensicRow({
      category_confidence: null,
      deduction_confidence: null,
    })
    const result = mapConfidence(row)
    // With catConf=50 (default), no deduction_confidence, no rnd: score based on 50 + documentation
    expect(result.factors).toHaveLength(2) // category + documentation
    expect(result.factors[0].factor).toContain('50%')
  })

  it('should include R&D confidence factor for R&D candidates', () => {
    const row = createMockForensicRow({
      is_rnd_candidate: true,
      rnd_confidence: 75,
      category_confidence: 80,
    })
    const result = mapConfidence(row)
    const rndFactor = result.factors.find((f) => f.factor.includes('R&D'))
    expect(rndFactor).toBeDefined()
    expect(rndFactor!.weight).toBe(0.25)
    expect(rndFactor!.impact).toBe('positive')
  })

  it('should NOT include R&D confidence when not an R&D candidate', () => {
    const row = createMockForensicRow({
      is_rnd_candidate: false,
      rnd_confidence: 90,
    })
    const result = mapConfidence(row)
    const rndFactor = result.factors.find((f) => f.factor.includes('R&D'))
    expect(rndFactor).toBeUndefined()
  })

  it('should weight category confidence at 40%', () => {
    const row = createMockForensicRow({ category_confidence: 80 })
    const result = mapConfidence(row)
    const catFactor = result.factors.find((f) => f.factor.includes('Category'))
    expect(catFactor).toBeDefined()
    expect(catFactor!.weight).toBe(0.4)
  })

  it('should weight deduction confidence at 20%', () => {
    const row = createMockForensicRow({ deduction_confidence: 75 })
    const result = mapConfidence(row)
    const dedFactor = result.factors.find((f) => f.factor.includes('Deduction'))
    expect(dedFactor).toBeDefined()
    expect(dedFactor!.weight).toBe(0.2)
  })

  it('should weight documentation impact at 15%', () => {
    const row = createMockForensicRow({ requires_documentation: true })
    const result = mapConfidence(row)
    const docFactor = result.factors.find((f) => f.factor.includes('documentation') || f.factor.includes('Documentation'))
    expect(docFactor).toBeDefined()
    expect(docFactor!.weight).toBe(0.15)
  })

  it('should mark documentation as negative impact when required', () => {
    const row = createMockForensicRow({ requires_documentation: true })
    const result = mapConfidence(row)
    const docFactor = result.factors.find((f) => f.factor.includes('Missing'))
    expect(docFactor).toBeDefined()
    expect(docFactor!.impact).toBe('negative')
  })

  it('should mark documentation as positive impact when not required', () => {
    const row = createMockForensicRow({ requires_documentation: false })
    const result = mapConfidence(row)
    const docFactor = result.factors.find((f) => f.factor.includes('adequate'))
    expect(docFactor).toBeDefined()
    expect(docFactor!.impact).toBe('positive')
  })

  it('should mark category confidence as negative when below 70%', () => {
    const row = createMockForensicRow({ category_confidence: 50 })
    const result = mapConfidence(row)
    const catFactor = result.factors.find((f) => f.factor.includes('Category'))
    expect(catFactor!.impact).toBe('negative')
  })

  it('should return a score that is an integer', () => {
    const row = createMockForensicRow({
      category_confidence: 73,
      deduction_confidence: 61,
    })
    const result = mapConfidence(row)
    expect(Number.isInteger(result.score)).toBe(true)
  })
})

// ===========================================================================
// estimateBenefit()
// ===========================================================================

describe('estimateBenefit', () => {
  it('should calculate R&D offset at 43.5% for sundries', () => {
    const row = createMockForensicRow({ claimable_amount: 10000 })
    const benefit = estimateBenefit(row, 'sundries')
    expect(benefit).toBe(4350)
  })

  it('should calculate deduction benefit at 25%', () => {
    const row = createMockForensicRow({ claimable_amount: 10000 })
    const benefit = estimateBenefit(row, 'deductions')
    expect(benefit).toBe(2500)
  })

  it('should calculate FBT exposure at 47%', () => {
    const row = createMockForensicRow({ transaction_amount: -5000 })
    const benefit = estimateBenefit(row, 'fbt')
    expect(benefit).toBe(2350)
  })

  it('should calculate div7a as 100% of amount (full deemed dividend)', () => {
    const row = createMockForensicRow({ transaction_amount: -8000 })
    const benefit = estimateBenefit(row, 'div7a')
    expect(benefit).toBe(8000)
  })

  it('should return 0 for documents (compliance, no monetary benefit)', () => {
    const row = createMockForensicRow({ transaction_amount: -5000 })
    const benefit = estimateBenefit(row, 'documents')
    expect(benefit).toBe(0)
  })

  it('should calculate reconciliation benefit at 25%', () => {
    const row = createMockForensicRow({ claimable_amount: 4000 })
    const benefit = estimateBenefit(row, 'reconciliation')
    expect(benefit).toBe(1000)
  })

  it('should handle zero amounts', () => {
    const row = createMockForensicRow({ transaction_amount: 0, claimable_amount: 0 })
    expect(estimateBenefit(row, 'sundries')).toBe(0)
    expect(estimateBenefit(row, 'deductions')).toBe(0)
    expect(estimateBenefit(row, 'fbt')).toBe(0)
    expect(estimateBenefit(row, 'div7a')).toBe(0)
  })

  it('should handle null amounts (defaults to 0)', () => {
    const row = createMockForensicRow({ transaction_amount: null, claimable_amount: null })
    expect(estimateBenefit(row, 'sundries')).toBe(0)
    expect(estimateBenefit(row, 'deductions')).toBe(0)
  })

  it('should use absolute values for negative amounts', () => {
    const row = createMockForensicRow({ transaction_amount: -3000, claimable_amount: -3000 })
    const benefit = estimateBenefit(row, 'deductions')
    expect(benefit).toBe(750) // 25% of 3000
  })

  it('should use claimable_amount over transaction_amount for sundries/deductions', () => {
    const row = createMockForensicRow({ transaction_amount: -5000, claimable_amount: 3000 })
    const benefit = estimateBenefit(row, 'sundries')
    // sundries uses claimable: 43.5% of 3000 = 1305
    expect(benefit).toBe(1305)
  })

  it('should use transaction_amount for FBT area', () => {
    const row = createMockForensicRow({ transaction_amount: -2000, claimable_amount: 1500 })
    const benefit = estimateBenefit(row, 'fbt')
    // FBT uses amount (transaction_amount), not claimable: 47% of 2000 = 940
    expect(benefit).toBe(940)
  })

  it('should round to 2 decimal places', () => {
    const row = createMockForensicRow({ claimable_amount: 333 })
    const benefit = estimateBenefit(row, 'sundries')
    // Math.round(333 * 0.435 * 100) / 100
    // JS floating point: 333 * 0.435 = 144.855 -> * 100 = 14485.5 -> Math.round = 14486 -> / 100 = 144.86
    // BUT JS floating point may yield 14485.4999... -> Math.round = 14485 -> 144.85
    // Verify it returns a number with at most 2 decimal places
    const decimalPlaces = (benefit.toString().split('.')[1] || '').length
    expect(decimalPlaces).toBeLessThanOrEqual(2)
    // The actual value: Math.round(144.855 * 100) / 100
    expect(benefit).toBe(Math.round(333 * 0.435 * 100) / 100)
  })
})

// ===========================================================================
// mapAnalysisToFinding()
// ===========================================================================

describe('mapAnalysisToFinding', () => {
  const orgId = 'org-123'

  it('should return null for non-actionable rows', () => {
    const row = createMockForensicRow({
      is_fully_deductible: true,
      deduction_confidence: 95,
      category_confidence: 90,
    })
    const result = mapAnalysisToFinding(row, orgId)
    expect(result).toBeNull()
  })

  it('should correctly populate all fields for an R&D finding', () => {
    const row = createMockForensicRow({
      is_rnd_candidate: true,
      meets_div355_criteria: true,
      rnd_confidence: 80,
      rnd_reasoning: 'Experimental development activity',
      transaction_amount: -5000,
      claimable_amount: 5000,
    })

    const result = mapAnalysisToFinding(row, orgId)

    expect(result).not.toBeNull()
    expect(result!.organization_id).toBe(orgId)
    expect(result!.workflow_area).toBe('sundries')
    expect(result!.status).toBe('pending')
    expect(result!.transaction_id).toBe('txn-001')
    expect(result!.transaction_date).toBe('2024-10-15')
    expect(result!.amount).toBe(5000) // absolute value
    expect(result!.financial_year).toBe('FY2024-25')
    expect(result!.estimated_benefit).toBe(2175) // 43.5% of 5000
  })

  it('should use absolute value for negative transaction amounts', () => {
    const row = createMockForensicRow({
      is_rnd_candidate: true,
      transaction_amount: -7500,
      claimable_amount: null,
    })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.amount).toBe(7500)
  })

  it('should default transaction_date to today when null', () => {
    const row = createMockForensicRow({
      is_rnd_candidate: true,
      transaction_date: null,
    })

    const result = mapAnalysisToFinding(row, orgId)
    const today = new Date().toISOString().split('T')[0]
    expect(result!.transaction_date).toBe(today)
  })

  it('should build suggested action for sundries with div355 criteria', () => {
    const row = createMockForensicRow({
      is_rnd_candidate: true,
      meets_div355_criteria: true,
    })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.suggested_action).toContain('Division 355')
    expect(result!.suggested_action).toContain('four-element test')
  })

  it('should build suggested action for sundries without div355 criteria', () => {
    const row = createMockForensicRow({
      is_rnd_candidate: true,
      meets_div355_criteria: false,
    })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.suggested_action).toContain('R&D candidacy')
  })

  it('should build suggested action for deductions area', () => {
    const row = createMockForensicRow({
      is_fully_deductible: true,
      deduction_confidence: 60,
    })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.suggested_action).toContain('s 8-1')
    expect(result!.suggested_action).toContain('60%')
  })

  it('should build suggested action for FBT area', () => {
    const row = createMockForensicRow({ fbt_implications: true })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.suggested_action).toContain('FBT')
    expect(result!.suggested_action).toContain('gross-up')
  })

  it('should build suggested action for div7a area', () => {
    const row = createMockForensicRow({ division7a_risk: true })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.suggested_action).toContain('Division 7A')
    expect(result!.suggested_action).toContain('loan')
  })

  it('should build suggested action for documents area', () => {
    const row = createMockForensicRow({
      requires_documentation: true,
      is_fully_deductible: false,
      category_confidence: 85,
    })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.suggested_action).toContain('documentation')
    expect(result!.suggested_action).toContain('s 900-70')
  })

  it('should build suggested action for reconciliation area', () => {
    const row = createMockForensicRow({
      category_confidence: 30,
      is_fully_deductible: false,
    })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.suggested_action).toContain('30%')
    expect(result!.suggested_action).toContain('GL account')
  })

  it('should include correct legislation references for sundries', () => {
    const row = createMockForensicRow({ is_rnd_candidate: true })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.legislation_refs).toHaveLength(2)
    expect(result!.legislation_refs[0].section).toBe('Division 355')
    expect(result!.legislation_refs[0].act).toBe('ITAA 1997')
  })

  it('should include correct legislation references for div7a', () => {
    const row = createMockForensicRow({ division7a_risk: true })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.legislation_refs).toHaveLength(2)
    expect(result!.legislation_refs[0].section).toBe('Division 7A')
    expect(result!.legislation_refs[0].act).toBe('ITAA 1936')
    expect(result!.legislation_refs[1].section).toBe('s 109D')
  })

  it('should include correct legislation references for deductions', () => {
    const row = createMockForensicRow({
      is_fully_deductible: true,
      deduction_confidence: 50,
    })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.legislation_refs).toHaveLength(1)
    expect(result!.legislation_refs[0].section).toBe('s 8-1')
  })

  it('should include correct legislation references for documents', () => {
    const row = createMockForensicRow({
      requires_documentation: true,
      is_fully_deductible: false,
      category_confidence: 85,
    })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.legislation_refs).toHaveLength(2)
    expect(result!.legislation_refs[0].section).toBe('s 900-70')
    expect(result!.legislation_refs[1].section).toBe('s 262A')
  })

  it('should build reasoning that includes primary category', () => {
    const row = createMockForensicRow({
      is_rnd_candidate: true,
      primary_category: 'Software Development',
    })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.reasoning).toContain('Software Development')
  })

  it('should build reasoning that includes R&D reasoning when present', () => {
    const row = createMockForensicRow({
      is_rnd_candidate: true,
      rnd_reasoning: 'Experimental development with uncertain outcome',
    })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.reasoning).toContain('Experimental development with uncertain outcome')
  })

  it('should use transaction_description for description field', () => {
    const row = createMockForensicRow({
      is_rnd_candidate: true,
      transaction_description: 'Cloud hosting for R&D project',
    })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.description).toBe('Cloud hosting for R&D project')
  })

  it('should default description when transaction_description is null', () => {
    const row = createMockForensicRow({
      is_rnd_candidate: true,
      transaction_description: null,
    })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.description).toContain('Transaction')
    expect(result!.description).toContain(row.transaction_id)
  })

  it('should use empty string for financial_year when null', () => {
    const row = createMockForensicRow({
      is_rnd_candidate: true,
      financial_year: null,
    })

    const result = mapAnalysisToFinding(row, orgId)
    expect(result!.financial_year).toBe('')
  })

  it('should include confidence_factors array', () => {
    const row = createMockForensicRow({ fbt_implications: true })

    const result = mapAnalysisToFinding(row, orgId)
    expect(Array.isArray(result!.confidence_factors)).toBe(true)
    expect(result!.confidence_factors.length).toBeGreaterThan(0)
    expect(result!.confidence_factors[0]).toHaveProperty('factor')
    expect(result!.confidence_factors[0]).toHaveProperty('impact')
    expect(result!.confidence_factors[0]).toHaveProperty('weight')
  })
})
