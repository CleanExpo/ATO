/**
 * @vitest-environment node
 *
 * Superannuation Cap Analyzer Tests (Division 291 ITAA 1997)
 *
 * Tests for concessional contribution cap analysis:
 * - SuperannuationCapAnalysis structure validation
 * - Carry-forward concessional contributions (s 291-20 ITAA 1997)
 * - Cap breach detection and Division 291 tax calculation
 * - CarryForwardAllowance type fields
 * - Missing total super balance handling
 */

import { describe, it, expect, vi } from 'vitest'
import {
  analyzeSuperannuationCaps,
  type SuperContribution,
  type SuperannuationCapAnalysis,
  type CarryForwardAllowance,
} from '@/lib/analysis/superannuation-cap-analyzer'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/tax-data/cache-manager', () => ({
  getCurrentTaxRates: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContribution(
  overrides: Partial<SuperContribution> = {}
): SuperContribution {
  return {
    employee_id: 'EMP-001',
    employee_name: 'Jane Smith',
    contribution_date: '2024-10-15',
    contribution_amount: 5000,
    contribution_type: 'SG',
    is_concessional: true,
    financial_year: 'FY2024-25',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SuperannuationCapAnalyzer', () => {
  // -----------------------------------------------------------------------
  // 1. Basic structure
  // -----------------------------------------------------------------------
  describe('analyzeSuperannuationCaps - basic structure', () => {
    it('should return a SuperannuationCapAnalysis array with correct top-level fields', async () => {
      const contributions: SuperContribution[] = [
        makeContribution({ contribution_amount: 10_000, contribution_type: 'SG' }),
        makeContribution({ contribution_amount: 5_000, contribution_type: 'salary_sacrifice' }),
      ]

      const results = await analyzeSuperannuationCaps(contributions)

      expect(results).toHaveLength(1)
      const analysis: SuperannuationCapAnalysis = results[0]

      // Structure assertions
      expect(analysis).toHaveProperty('tenant_id')
      expect(analysis).toHaveProperty('financial_year', 'FY2024-25')
      expect(analysis).toHaveProperty('total_employees_analyzed')
      expect(analysis).toHaveProperty('employees_with_contributions')
      expect(analysis).toHaveProperty('employee_summaries')
      expect(analysis).toHaveProperty('total_concessional_contributions')
      expect(analysis).toHaveProperty('total_excess_contributions')
      expect(analysis).toHaveProperty('total_division_291_tax')
      expect(analysis).toHaveProperty('employees_breaching_cap')
      expect(analysis).toHaveProperty('employees_approaching_cap')
      expect(analysis).toHaveProperty('compliance_summary')
      expect(analysis).toHaveProperty('professional_review_required')

      // Values
      expect(analysis.total_employees_analyzed).toBe(1)
      expect(analysis.employees_with_contributions).toBe(1)
      expect(analysis.total_concessional_contributions).toBe(15_000)
    })

    it('should return an empty array when no contributions are provided', async () => {
      const results = await analyzeSuperannuationCaps([])

      expect(results).toEqual([])
    })
  })

  // -----------------------------------------------------------------------
  // 2. Carry-forward concessional contributions
  // -----------------------------------------------------------------------
  describe('carry-forward concessional contributions (s 291-20)', () => {
    it('should calculate carry-forward from 5 prior years when balance < $500K', async () => {
      // Employee contributed $10K in each of the 5 prior years against a $27,500 cap
      // (FY2019-20 to FY2023-24). Unused amounts should carry forward.
      const priorYearContributions: Record<string, number> = {
        'FY2023-24': 10_000, // cap $27,500 => unused $17,500
        'FY2022-23': 10_000, // cap $27,500 => unused $17,500
        'FY2021-22': 10_000, // cap $27,500 => unused $17,500
        'FY2020-21': 10_000, // cap $25,000 => unused $15,000
        'FY2019-20': 10_000, // cap $25,000 => unused $15,000
      }

      const contributions: SuperContribution[] = [
        makeContribution({
          contribution_amount: 50_000,
          contribution_type: 'SG',
          financial_year: 'FY2024-25',
          total_super_balance: 300_000, // Under $500K threshold
          prior_year_contributions: priorYearContributions,
        }),
      ]

      const results = await analyzeSuperannuationCaps(contributions)
      const summary = results[0].employee_summaries[0]

      expect(summary.carry_forward_eligible).toBe(true)
      expect(summary.carry_forward_amounts.length).toBeGreaterThan(0)
      // Total carry-forward: 17500 + 17500 + 17500 + 15000 + 15000 = 82500
      expect(summary.total_carry_forward).toBe(82_500)
      // Effective cap = base $30,000 + $82,500 = $112,500
      expect(summary.effective_cap).toBe(112_500)
      // $50K contribution is well under $112.5K effective cap
      expect(summary.breaches_cap).toBe(false)
      expect(summary.excess_contributions).toBe(0)
    })

    it('should NOT allow carry-forward when total super balance >= $500K', async () => {
      const contributions: SuperContribution[] = [
        makeContribution({
          contribution_amount: 35_000,
          contribution_type: 'SG',
          financial_year: 'FY2024-25',
          total_super_balance: 600_000, // Over $500K threshold
          prior_year_contributions: {
            'FY2023-24': 5_000,
            'FY2022-23': 5_000,
          },
        }),
      ]

      const results = await analyzeSuperannuationCaps(contributions)
      const summary = results[0].employee_summaries[0]

      expect(summary.carry_forward_eligible).toBe(false)
      expect(summary.total_carry_forward).toBe(0)
      expect(summary.carry_forward_amounts).toEqual([])
      // Effective cap is just the base cap ($30K) with no carry-forward
      expect(summary.effective_cap).toBe(30_000)
      // $35K > $30K => breach
      expect(summary.breaches_cap).toBe(true)
      expect(summary.excess_contributions).toBe(5_000)
    })

    it('should only carry forward from FY2018-19 onwards', async () => {
      // Provide prior year data going back further than FY2018-19
      const priorYearContributions: Record<string, number> = {
        'FY2019-20': 10_000, // cap $25K => unused $15K (within window)
        'FY2018-19': 10_000, // cap $25K => unused $15K (within window, earliest allowed)
        'FY2017-18': 10_000, // Should NOT be included (before carry-forward start)
      }

      const contributions: SuperContribution[] = [
        makeContribution({
          contribution_amount: 40_000,
          contribution_type: 'SG',
          financial_year: 'FY2024-25',
          total_super_balance: 200_000,
          prior_year_contributions: priorYearContributions,
        }),
      ]

      const results = await analyzeSuperannuationCaps(contributions)
      const summary = results[0].employee_summaries[0]

      expect(summary.carry_forward_eligible).toBe(true)

      // Only FY2019-20 should be picked up (FY2018-19 is 6 years back from FY2024-25,
      // which exceeds the 5-year window). FY2017-18 is before the scheme start.
      const carryForwardYears = summary.carry_forward_amounts.map(a => a.fromYear)
      expect(carryForwardYears).not.toContain('FY2017-18')
    })
  })

  // -----------------------------------------------------------------------
  // 3. Cap breach detection
  // -----------------------------------------------------------------------
  describe('cap breach detection (Division 291)', () => {
    it('should detect a breach when concessional contributions exceed $30,000 cap for FY2024-25', async () => {
      const contributions: SuperContribution[] = [
        makeContribution({
          contribution_amount: 25_000,
          contribution_type: 'SG',
          financial_year: 'FY2024-25',
        }),
        makeContribution({
          contribution_amount: 10_000,
          contribution_type: 'salary_sacrifice',
          financial_year: 'FY2024-25',
        }),
      ]

      const results = await analyzeSuperannuationCaps(contributions)
      const analysis = results[0]
      const summary = analysis.employee_summaries[0]

      // Total = $35K, cap = $30K (no carry-forward since no balance data)
      expect(summary.total_concessional).toBe(35_000)
      expect(summary.concessional_cap).toBe(30_000)
      expect(summary.breaches_cap).toBe(true)
      expect(summary.excess_contributions).toBe(5_000)

      // Division 291 tax = excess * 15%
      expect(summary.division_291_tax_payable).toBe(750)

      // Overall analysis flags
      expect(analysis.employees_breaching_cap).toBe(1)
      expect(analysis.total_excess_contributions).toBe(5_000)
      expect(analysis.total_division_291_tax).toBe(750)
      expect(analysis.professional_review_required).toBe(true)
    })

    it('should NOT flag a breach when contributions are within $30,000 cap', async () => {
      const contributions: SuperContribution[] = [
        makeContribution({
          contribution_amount: 20_000,
          contribution_type: 'SG',
          financial_year: 'FY2024-25',
        }),
        makeContribution({
          contribution_amount: 5_000,
          contribution_type: 'salary_sacrifice',
          financial_year: 'FY2024-25',
        }),
      ]

      const results = await analyzeSuperannuationCaps(contributions)
      const summary = results[0].employee_summaries[0]

      expect(summary.total_concessional).toBe(25_000)
      expect(summary.breaches_cap).toBe(false)
      expect(summary.excess_contributions).toBe(0)
      expect(summary.division_291_tax_payable).toBe(0)
    })

    it('should use the $27,500 cap for FY2023-24', async () => {
      const contributions: SuperContribution[] = [
        makeContribution({
          contribution_amount: 29_000,
          contribution_type: 'SG',
          financial_year: 'FY2023-24',
        }),
      ]

      const results = await analyzeSuperannuationCaps(contributions)
      const summary = results[0].employee_summaries[0]

      expect(summary.concessional_cap).toBe(27_500)
      expect(summary.breaches_cap).toBe(true)
      expect(summary.excess_contributions).toBe(1_500)
      // Division 291: 1500 * 0.15 = 225
      expect(summary.division_291_tax_payable).toBe(225)
    })

    it('should flag employees approaching cap (>80% usage) but not breaching', async () => {
      const contributions: SuperContribution[] = [
        makeContribution({
          contribution_amount: 26_000,
          contribution_type: 'SG',
          financial_year: 'FY2024-25',
        }),
      ]

      const results = await analyzeSuperannuationCaps(contributions)
      const analysis = results[0]
      const summary = analysis.employee_summaries[0]

      // 26,000 / 30,000 = 86.67% (>80%)
      expect(summary.cap_usage_percentage).toBeGreaterThan(80)
      expect(summary.breaches_cap).toBe(false)
      expect(analysis.employees_approaching_cap).toBe(1)
      expect(analysis.employees_breaching_cap).toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // 4. CarryForwardAllowance type fields
  // -----------------------------------------------------------------------
  describe('CarryForwardAllowance type structure', () => {
    it('should populate fromYear, unusedAmount, and isWithinWindow correctly', async () => {
      const priorYearContributions: Record<string, number> = {
        'FY2023-24': 20_000, // cap $27,500 => unused $7,500
        'FY2022-23': 15_000, // cap $27,500 => unused $12,500
      }

      const contributions: SuperContribution[] = [
        makeContribution({
          contribution_amount: 30_000,
          contribution_type: 'SG',
          financial_year: 'FY2024-25',
          total_super_balance: 400_000,
          prior_year_contributions: priorYearContributions,
        }),
      ]

      const results = await analyzeSuperannuationCaps(contributions)
      const summary = results[0].employee_summaries[0]

      expect(summary.carry_forward_amounts.length).toBeGreaterThanOrEqual(2)

      const fy2324 = summary.carry_forward_amounts.find(
        (a: CarryForwardAllowance) => a.fromYear === 'FY2023-24'
      )
      expect(fy2324).toBeDefined()
      expect(fy2324!.unusedAmount).toBe(7_500)
      expect(fy2324!.isWithinWindow).toBe(true)

      const fy2223 = summary.carry_forward_amounts.find(
        (a: CarryForwardAllowance) => a.fromYear === 'FY2022-23'
      )
      expect(fy2223).toBeDefined()
      expect(fy2223!.unusedAmount).toBe(12_500)
      expect(fy2223!.isWithinWindow).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // 5. Missing total super balance (warning flag)
  // -----------------------------------------------------------------------
  describe('when totalSuperBalance is not provided', () => {
    it('should mark carry-forward as ineligible and recommend providing balance data', async () => {
      const contributions: SuperContribution[] = [
        makeContribution({
          contribution_amount: 25_000,
          contribution_type: 'SG',
          financial_year: 'FY2024-25',
          // total_super_balance intentionally omitted
          prior_year_contributions: { 'FY2023-24': 10_000 },
        }),
      ]

      const results = await analyzeSuperannuationCaps(contributions)
      const summary = results[0].employee_summaries[0]

      expect(summary.carry_forward_eligible).toBe(false)
      expect(summary.total_carry_forward).toBe(0)
      expect(summary.effective_cap).toBe(30_000) // Just the base cap

      // Should have a recommendation about providing balance data
      const hasBalanceRecommendation = summary.recommendations.some(
        (r: string) => r.toLowerCase().includes('balance') || r.toLowerCase().includes('carry-forward')
      )
      expect(hasBalanceRecommendation).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // 6. Multiple employees and contribution types
  // -----------------------------------------------------------------------
  describe('multiple employees and contribution breakdown', () => {
    it('should separately analyze multiple employees in the same FY', async () => {
      const contributions: SuperContribution[] = [
        // Employee A: within cap
        makeContribution({
          employee_id: 'EMP-A',
          employee_name: 'Alice',
          contribution_amount: 20_000,
          contribution_type: 'SG',
          financial_year: 'FY2024-25',
        }),
        // Employee B: breaching cap
        makeContribution({
          employee_id: 'EMP-B',
          employee_name: 'Bob',
          contribution_amount: 25_000,
          contribution_type: 'SG',
          financial_year: 'FY2024-25',
        }),
        makeContribution({
          employee_id: 'EMP-B',
          employee_name: 'Bob',
          contribution_amount: 10_000,
          contribution_type: 'salary_sacrifice',
          financial_year: 'FY2024-25',
        }),
      ]

      const results = await analyzeSuperannuationCaps(contributions)
      const analysis = results[0]

      expect(analysis.total_employees_analyzed).toBe(2)
      expect(analysis.employees_breaching_cap).toBe(1)

      const aliceSummary = analysis.employee_summaries.find(s => s.employee_id === 'EMP-A')
      expect(aliceSummary).toBeDefined()
      expect(aliceSummary!.breaches_cap).toBe(false)
      expect(aliceSummary!.sg_contributions).toBe(20_000)

      const bobSummary = analysis.employee_summaries.find(s => s.employee_id === 'EMP-B')
      expect(bobSummary).toBeDefined()
      expect(bobSummary!.total_concessional).toBe(35_000)
      expect(bobSummary!.sg_contributions).toBe(25_000)
      expect(bobSummary!.salary_sacrifice).toBe(10_000)
      expect(bobSummary!.breaches_cap).toBe(true)
      expect(bobSummary!.excess_contributions).toBe(5_000)
    })

    it('should correctly split SG, salary sacrifice, and employer additional', async () => {
      const contributions: SuperContribution[] = [
        makeContribution({ contribution_amount: 12_000, contribution_type: 'SG' }),
        makeContribution({ contribution_amount: 8_000, contribution_type: 'salary_sacrifice' }),
        makeContribution({ contribution_amount: 3_000, contribution_type: 'employer_additional' }),
      ]

      const results = await analyzeSuperannuationCaps(contributions)
      const summary = results[0].employee_summaries[0]

      expect(summary.sg_contributions).toBe(12_000)
      expect(summary.salary_sacrifice).toBe(8_000)
      expect(summary.employer_additional).toBe(3_000)
      expect(summary.total_concessional).toBe(23_000)
    })
  })

  // -----------------------------------------------------------------------
  // 7. Non-concessional contributions filtered out
  // -----------------------------------------------------------------------
  describe('non-concessional filtering', () => {
    it('should exclude non-concessional contributions from cap analysis', async () => {
      const contributions: SuperContribution[] = [
        makeContribution({
          contribution_amount: 20_000,
          contribution_type: 'SG',
          is_concessional: true,
        }),
        makeContribution({
          contribution_amount: 50_000,
          contribution_type: 'SG',
          is_concessional: false, // Non-concessional (after-tax)
        }),
      ]

      const results = await analyzeSuperannuationCaps(contributions)
      const analysis = results[0]

      // Only the $20K concessional contribution should be analysed
      expect(analysis.total_concessional_contributions).toBe(20_000)
      expect(analysis.employee_summaries[0].total_concessional).toBe(20_000)
      expect(analysis.employee_summaries[0].breaches_cap).toBe(false)
    })
  })
})
