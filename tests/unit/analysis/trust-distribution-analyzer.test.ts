/**
 * @vitest-environment node
 *
 * Trust Distribution Analyzer Tests (Section 100A ITAA 1936)
 *
 * Tests for trust distribution compliance analysis:
 * - Section100AAnalysis structure validation
 * - Section 100A flag generation (reimbursement, non-resident, minor, UPE)
 * - Family dealing exclusion (s 100A(13), TR 2022/4) severity downgrade
 * - Trustee penalty rate 47% (45% + 2% Medicare Levy per s 99A ITAA 1936)
 * - Non-resident and minor beneficiary handling
 */

import { describe, it, expect, vi } from 'vitest'
import {
  analyzeTrustDistributions,
  type TrustDistribution,
  type Section100AAnalysis,
} from '@/lib/analysis/trust-distribution-analyzer'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/tax-data/cache-manager', () => ({
  getCurrentTaxRates: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDistribution(
  overrides: Partial<TrustDistribution> = {}
): TrustDistribution {
  return {
    transaction_id: 'TXN-001',
    transaction_date: '2024-06-15',
    trust_entity_id: 'TRUST-001',
    trust_entity_name: 'Smith Family Trust',
    beneficiary_id: 'BEN-001',
    beneficiary_name: 'John Smith',
    beneficiary_entity_type: 'individual',
    distribution_amount: 50_000,
    distribution_type: 'cash',
    financial_year: 'FY2024-25',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TrustDistributionAnalyzer', () => {
  // -----------------------------------------------------------------------
  // 1. Basic structure
  // -----------------------------------------------------------------------
  describe('analyzeTrustDistributions - basic structure', () => {
    it('should return a Section100AAnalysis array with correct top-level fields', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({ distribution_amount: 100_000 }),
      ]

      const results = await analyzeTrustDistributions(distributions)

      expect(results).toHaveLength(1)
      const analysis: Section100AAnalysis = results[0]

      // Structure assertions
      expect(analysis).toHaveProperty('trust_entity_id', 'TRUST-001')
      expect(analysis).toHaveProperty('trust_entity_name', 'Smith Family Trust')
      expect(analysis).toHaveProperty('financial_year', 'FY2024-25')
      expect(analysis).toHaveProperty('total_distributions', 100_000)
      expect(analysis).toHaveProperty('cash_distributions')
      expect(analysis).toHaveProperty('upe_distributions')
      expect(analysis).toHaveProperty('distributions_by_beneficiary')
      expect(analysis).toHaveProperty('section_100a_flags')
      expect(analysis).toHaveProperty('upe_summary')
      expect(analysis).toHaveProperty('overall_risk_level')
      expect(analysis).toHaveProperty('compliance_summary')
      expect(analysis).toHaveProperty('professional_review_required')

      expect(analysis.distributions_by_beneficiary).toHaveLength(1)
      expect(analysis.distributions_by_beneficiary[0].beneficiary_id).toBe('BEN-001')
    })

    it('should return an empty array when no distributions are provided', async () => {
      const results = await analyzeTrustDistributions([])

      expect(results).toEqual([])
    })
  })

  // -----------------------------------------------------------------------
  // 2. Section 100A flags generation
  // -----------------------------------------------------------------------
  describe('Section 100A flags generation', () => {
    it('should generate a reimbursement_agreement flag when loan-back pattern detected', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          has_reimbursement_pattern: true,
          distribution_amount: 80_000,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)
      const flags = results[0].section_100a_flags

      const reimbursementFlag = flags.find(f => f.flag_type === 'reimbursement_agreement')
      expect(reimbursementFlag).toBeDefined()
      expect(reimbursementFlag!.severity).toBe('critical')
      expect(reimbursementFlag!.amount).toBe(80_000)
      expect(reimbursementFlag!.beneficiary_id).toBe('BEN-001')
    })

    it('should generate a non_resident_distribution flag', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          is_non_resident: true,
          distribution_amount: 60_000,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)
      const flags = results[0].section_100a_flags

      const nonResidentFlag = flags.find(f => f.flag_type === 'non_resident_distribution')
      expect(nonResidentFlag).toBeDefined()
      expect(nonResidentFlag!.severity).toBe('high')
      expect(nonResidentFlag!.amount).toBe(60_000)
    })

    it('should generate a minor_distribution flag for under-18 beneficiaries', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          is_minor: true,
          distribution_amount: 5_000,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)
      const flags = results[0].section_100a_flags

      const minorFlag = flags.find(f => f.flag_type === 'minor_distribution')
      expect(minorFlag).toBeDefined()
      expect(minorFlag!.severity).toBe('high')
    })

    it('should generate an excessive_upe flag when UPE is aged > 2 years', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          distribution_type: 'upe',
          distribution_amount: 200_000,
          upe_balance: 200_000,
          upe_age_years: 3.5,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)
      const flags = results[0].section_100a_flags

      const upeFlag = flags.find(
        f => f.flag_type === 'excessive_upe' && f.severity === 'critical'
      )
      expect(upeFlag).toBeDefined()
      expect(upeFlag!.amount).toBe(200_000)
      expect(upeFlag!.description).toContain('3.5')
    })
  })

  // -----------------------------------------------------------------------
  // 3. Family dealing exclusion (s 100A(13), TR 2022/4)
  // -----------------------------------------------------------------------
  describe('family dealing exclusion (s 100A(13), TR 2022/4)', () => {
    it('should downgrade non-resident flag from high to medium for family members without reimbursement', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          is_non_resident: true,
          is_related_party: true,
          is_family_member: true,
          has_reimbursement_pattern: false,
          distribution_amount: 70_000,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)
      const flags = results[0].section_100a_flags

      const nonResidentFlag = flags.find(f => f.flag_type === 'non_resident_distribution')
      expect(nonResidentFlag).toBeDefined()
      // Severity downgraded from 'high' to 'medium' due to family dealing exclusion
      expect(nonResidentFlag!.severity).toBe('medium')
      expect(nonResidentFlag!.familyDealingNote).toBeDefined()
      expect(nonResidentFlag!.familyDealingNote).toContain('Severity reduced')
    })

    it('should downgrade minor flag from high to low for family members without reimbursement', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          is_minor: true,
          is_related_party: true,
          is_family_member: true,
          has_reimbursement_pattern: false,
          distribution_amount: 3_000,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)
      const flags = results[0].section_100a_flags

      const minorFlag = flags.find(f => f.flag_type === 'minor_distribution')
      expect(minorFlag).toBeDefined()
      // Severity downgraded from 'high' to 'low' due to family dealing exclusion
      expect(minorFlag!.severity).toBe('low')
      expect(minorFlag!.familyDealingNote).toBeDefined()
      expect(minorFlag!.familyDealingNote).toContain('TR 2022/4')
    })

    it('should NOT apply family dealing exclusion when reimbursement pattern exists', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          is_non_resident: true,
          is_related_party: true,
          is_family_member: true,
          has_reimbursement_pattern: true, // Reimbursement overrides family exclusion
          distribution_amount: 50_000,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)
      const flags = results[0].section_100a_flags

      // Reimbursement agreement flag should be critical
      const reimbursementFlag = flags.find(f => f.flag_type === 'reimbursement_agreement')
      expect(reimbursementFlag).toBeDefined()
      expect(reimbursementFlag!.severity).toBe('critical')

      // Non-resident flag should remain 'high' (family dealing exclusion NOT applied)
      const nonResidentFlag = flags.find(f => f.flag_type === 'non_resident_distribution')
      expect(nonResidentFlag).toBeDefined()
      expect(nonResidentFlag!.severity).toBe('high')
    })

    it('should reduce risk score by up to 40 points for family dealing', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          is_non_resident: true,        // +40 risk
          is_related_party: true,
          is_family_member: true,
          has_reimbursement_pattern: false,
          distribution_amount: 100_000,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)
      const beneficiary = results[0].distributions_by_beneficiary[0]

      // Non-resident adds 40 points; family dealing subtracts up to 40 points
      // Expected: 40 - 40 = 0
      expect(beneficiary.risk_score).toBe(0)

      // familyDealingExclusion note should be populated
      expect(beneficiary.familyDealingExclusion).toBeDefined()
      expect(beneficiary.familyDealingExclusion).toContain('TR 2022/4')
    })
  })

  // -----------------------------------------------------------------------
  // 4. Trustee penalty rate is 47% (45% + 2% Medicare Levy per s 99A)
  // -----------------------------------------------------------------------
  describe('trustee penalty rate (s 99A ITAA 1936)', () => {
    it('should reference 47% trustee rate in reimbursement agreement recommendations', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          has_reimbursement_pattern: true,
          distribution_amount: 100_000,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)
      const flags = results[0].section_100a_flags

      const reimbursementFlag = flags.find(f => f.flag_type === 'reimbursement_agreement')
      expect(reimbursementFlag).toBeDefined()
      // Must reference 47%, not 45%
      expect(reimbursementFlag!.recommendation).toContain('47%')
      // Should also explain the breakdown
      expect(reimbursementFlag!.recommendation).toContain('45%')
      expect(reimbursementFlag!.recommendation).toContain('2%')
      expect(reimbursementFlag!.recommendation).toContain('Medicare Levy')
    })

    it('should reference 47% in compliance summary for critical issues', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          has_reimbursement_pattern: true,
          distribution_amount: 100_000,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)
      const summary = results[0].compliance_summary

      // Compliance summary should mention 47% penalty rate for critical flags
      expect(summary).toContain('47%')
    })
  })

  // -----------------------------------------------------------------------
  // 5. Non-resident beneficiary handling
  // -----------------------------------------------------------------------
  describe('non-resident beneficiary handling', () => {
    it('should add 40 risk points for non-resident beneficiaries', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          is_non_resident: true,
          // NOT a family member, so no risk reduction
          is_related_party: false,
          is_family_member: false,
          distribution_amount: 50_000,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)
      const beneficiary = results[0].distributions_by_beneficiary[0]

      // Non-resident: +40 risk points, no family reduction
      expect(beneficiary.risk_score).toBe(40)
      expect(beneficiary.risk_factors).toEqual(
        expect.arrayContaining([expect.stringContaining('Non-resident')])
      )
    })

    it('should mark overall risk as high for non-resident distributions', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          is_non_resident: true,
          distribution_amount: 100_000,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)

      // Non-resident generates a 'high' severity flag => overall risk should be at least 'high'
      expect(['high', 'critical']).toContain(results[0].overall_risk_level)
      expect(results[0].professional_review_required).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // 6. Minor beneficiary handling
  // -----------------------------------------------------------------------
  describe('minor beneficiary handling', () => {
    it('should add 35 risk points for minor beneficiaries', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          is_minor: true,
          is_related_party: false,
          is_family_member: false,
          distribution_amount: 10_000,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)
      const beneficiary = results[0].distributions_by_beneficiary[0]

      expect(beneficiary.risk_score).toBe(35)
      expect(beneficiary.risk_factors).toEqual(
        expect.arrayContaining([expect.stringContaining('Minor')])
      )
    })

    it('should reference $1,307 excepted income threshold for minors', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          is_minor: true,
          distribution_amount: 5_000,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)
      const flags = results[0].section_100a_flags

      const minorFlag = flags.find(f => f.flag_type === 'minor_distribution')
      expect(minorFlag).toBeDefined()
      expect(minorFlag!.recommendation).toContain('1,307')
    })
  })

  // -----------------------------------------------------------------------
  // 7. UPE summary and Division 7A implications
  // -----------------------------------------------------------------------
  describe('UPE summary and Division 7A', () => {
    it('should calculate UPE summary totals correctly', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          beneficiary_id: 'BEN-A',
          beneficiary_name: 'Alice',
          distribution_type: 'upe',
          distribution_amount: 100_000,
          upe_balance: 100_000,
          upe_age_years: 1.5,
        }),
        makeDistribution({
          beneficiary_id: 'BEN-B',
          beneficiary_name: 'Bob',
          distribution_type: 'upe',
          distribution_amount: 50_000,
          upe_balance: 50_000,
          upe_age_years: 3,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)
      const upeSummary = results[0].upe_summary

      expect(upeSummary.total_upe_balance).toBe(150_000)
      expect(upeSummary.beneficiaries_with_upe).toBe(2)
    })
  })

  // -----------------------------------------------------------------------
  // 8. Overall risk level determination
  // -----------------------------------------------------------------------
  describe('overall risk level determination', () => {
    it('should return low risk when no flags or UPE issues exist', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          distribution_type: 'cash',
          distribution_amount: 30_000,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)

      expect(results[0].section_100a_flags).toHaveLength(0)
      expect(results[0].overall_risk_level).toBe('low')
      expect(results[0].professional_review_required).toBe(false)
    })

    it('should return critical when a reimbursement agreement is detected', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          has_reimbursement_pattern: true,
          distribution_amount: 200_000,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)

      expect(results[0].overall_risk_level).toBe('critical')
      expect(results[0].professional_review_required).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // 9. Multiple trust entities and financial years
  // -----------------------------------------------------------------------
  describe('multiple trust entities', () => {
    it('should produce separate analyses for different trusts', async () => {
      const distributions: TrustDistribution[] = [
        makeDistribution({
          trust_entity_id: 'TRUST-A',
          trust_entity_name: 'Alpha Trust',
          distribution_amount: 40_000,
        }),
        makeDistribution({
          trust_entity_id: 'TRUST-B',
          trust_entity_name: 'Beta Trust',
          distribution_amount: 60_000,
        }),
      ]

      const results = await analyzeTrustDistributions(distributions)

      expect(results).toHaveLength(2)

      const alphaAnalysis = results.find(r => r.trust_entity_id === 'TRUST-A')
      const betaAnalysis = results.find(r => r.trust_entity_id === 'TRUST-B')

      expect(alphaAnalysis).toBeDefined()
      expect(alphaAnalysis!.total_distributions).toBe(40_000)

      expect(betaAnalysis).toBeDefined()
      expect(betaAnalysis!.total_distributions).toBe(60_000)
    })
  })
})
