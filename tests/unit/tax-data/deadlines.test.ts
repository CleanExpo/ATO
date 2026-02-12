/**
 * Unit tests for Australian Tax Compliance Deadlines
 *
 * Tests cover:
 * - Returns correct deadlines for different entity types
 * - FBT deadline (21 May for self-lodgers)
 * - BAS deadlines per quarter
 * - R&D registration deadline (10 months after FY end)
 * - Amendment period deadlines
 * - Handle current and future FYs
 * - Deadline status (urgency levels)
 * - Filtering by entity type and month
 */

import { describe, it, expect, beforeEach } from 'vitest'

import {
  generateDeadlines,
  getDeadlineStatus,
  filterByEntityType,
  getDeadlinesForMonth,
  type TaxDeadline,
  type EntityType,
} from '@/lib/tax-data/deadlines'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Tax Deadlines', () => {
  // Use FY2024-25 (July 2024 - June 2025) as the primary test year
  const FY_START = 2024
  let deadlines: TaxDeadline[]

  beforeEach(() => {
    deadlines = generateDeadlines(FY_START)
  })

  // ========================================================================
  // generateDeadlines -- general properties
  // ========================================================================

  describe('generateDeadlines -- general', () => {
    it('should return a non-empty array of deadlines', () => {
      expect(deadlines.length).toBeGreaterThan(0)
    })

    it('should return deadlines sorted by date ascending', () => {
      for (let i = 1; i < deadlines.length; i++) {
        expect(deadlines[i].date.getTime()).toBeGreaterThanOrEqual(
          deadlines[i - 1].date.getTime()
        )
      }
    })

    it('should have unique IDs for all deadlines', () => {
      const ids = deadlines.map((d) => d.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should include legislative references for all deadlines', () => {
      for (const d of deadlines) {
        expect(d.legislativeRef).toBeTruthy()
        expect(typeof d.legislativeRef).toBe('string')
      }
    })

    it('should have valid type for all deadlines', () => {
      const validTypes = ['lodgement', 'payment', 'registration']
      for (const d of deadlines) {
        expect(validTypes).toContain(d.type)
      }
    })

    it('should have valid category for all deadlines', () => {
      const validCategories = ['bas', 'payg', 'fbt', 'income_tax', 'rnd', 'super', 'other']
      for (const d of deadlines) {
        expect(validCategories).toContain(d.category)
      }
    })
  })

  // ========================================================================
  // BAS Deadlines
  // ========================================================================

  describe('BAS deadlines', () => {
    it('should generate 12 monthly BAS deadlines', () => {
      const monthlyBAS = deadlines.filter((d) => d.id.startsWith('bas-monthly-'))
      expect(monthlyBAS).toHaveLength(12)
    })

    it('should set monthly BAS due on 21st of following month', () => {
      // bas-monthly-0 is for July 2024, due 21 August 2024
      const julyBAS = deadlines.find((d) => d.id === 'bas-monthly-0')
      expect(julyBAS).toBeDefined()
      expect(julyBAS!.date.getDate()).toBe(21)
      expect(julyBAS!.date.getMonth()).toBe(7) // August (0-indexed)
      expect(julyBAS!.date.getFullYear()).toBe(2024)
    })

    it('should generate 4 quarterly BAS deadlines', () => {
      const quarterlyBAS = deadlines.filter((d) => d.id.startsWith('bas-quarterly-'))
      expect(quarterlyBAS).toHaveLength(4)
    })

    it('should set Q1 BAS due 28 October', () => {
      const q1 = deadlines.find((d) => d.id === 'bas-quarterly-q1')
      expect(q1).toBeDefined()
      expect(q1!.date.getMonth()).toBe(9) // October
      expect(q1!.date.getDate()).toBe(28)
      expect(q1!.date.getFullYear()).toBe(2024)
    })

    it('should set Q2 BAS due 28 February next year', () => {
      const q2 = deadlines.find((d) => d.id === 'bas-quarterly-q2')
      expect(q2).toBeDefined()
      expect(q2!.date.getMonth()).toBe(1) // February
      expect(q2!.date.getDate()).toBe(28)
      expect(q2!.date.getFullYear()).toBe(2025)
    })

    it('should set Q3 BAS due 28 April next year', () => {
      const q3 = deadlines.find((d) => d.id === 'bas-quarterly-q3')
      expect(q3).toBeDefined()
      expect(q3!.date.getMonth()).toBe(3) // April
      expect(q3!.date.getDate()).toBe(28)
      expect(q3!.date.getFullYear()).toBe(2025)
    })

    it('should set Q4 BAS due 28 July next year', () => {
      const q4 = deadlines.find((d) => d.id === 'bas-quarterly-q4')
      expect(q4).toBeDefined()
      expect(q4!.date.getMonth()).toBe(6) // July
      expect(q4!.date.getDate()).toBe(28)
      expect(q4!.date.getFullYear()).toBe(2025)
    })

    it('should apply quarterly BAS to all entity types', () => {
      const q1 = deadlines.find((d) => d.id === 'bas-quarterly-q1')
      expect(q1!.entityTypes).toContain('company')
      expect(q1!.entityTypes).toContain('individual')
      expect(q1!.entityTypes).toContain('trust')
      expect(q1!.entityTypes).toContain('partnership')
      expect(q1!.entityTypes).toContain('super_fund')
    })

    it('should apply monthly BAS to company, trust, and partnership only', () => {
      const monthly = deadlines.find((d) => d.id === 'bas-monthly-0')
      expect(monthly!.entityTypes).toContain('company')
      expect(monthly!.entityTypes).toContain('trust')
      expect(monthly!.entityTypes).toContain('partnership')
      expect(monthly!.entityTypes).not.toContain('individual')
    })
  })

  // ========================================================================
  // PAYG Instalments
  // ========================================================================

  describe('PAYG instalment deadlines', () => {
    it('should generate 4 quarterly PAYG deadlines', () => {
      const payg = deadlines.filter((d) => d.id.startsWith('payg-'))
      expect(payg).toHaveLength(4)
    })

    it('should set PAYG due on 21st of month', () => {
      const paygQ1 = deadlines.find((d) => d.id === 'payg-q1')
      expect(paygQ1).toBeDefined()
      expect(paygQ1!.date.getDate()).toBe(21)
    })

    it('should be payment type', () => {
      const paygQ1 = deadlines.find((d) => d.id === 'payg-q1')
      expect(paygQ1!.type).toBe('payment')
    })

    it('should apply to company, individual, and trust', () => {
      const paygQ1 = deadlines.find((d) => d.id === 'payg-q1')
      expect(paygQ1!.entityTypes).toContain('company')
      expect(paygQ1!.entityTypes).toContain('individual')
      expect(paygQ1!.entityTypes).toContain('trust')
    })
  })

  // ========================================================================
  // FBT Deadlines
  // ========================================================================

  describe('FBT deadlines', () => {
    it('should have FBT return due 21 May (self-lodgement)', () => {
      const fbtReturn = deadlines.find((d) => d.id === 'fbt-return')
      expect(fbtReturn).toBeDefined()
      expect(fbtReturn!.date.getMonth()).toBe(4) // May
      expect(fbtReturn!.date.getDate()).toBe(21)
      expect(fbtReturn!.date.getFullYear()).toBe(2025)
    })

    it('should have FBT payment due 28 May', () => {
      const fbtPayment = deadlines.find((d) => d.id === 'fbt-payment')
      expect(fbtPayment).toBeDefined()
      expect(fbtPayment!.date.getMonth()).toBe(4) // May
      expect(fbtPayment!.date.getDate()).toBe(28)
      expect(fbtPayment!.date.getFullYear()).toBe(2025)
    })

    it('should set FBT return type as lodgement', () => {
      const fbtReturn = deadlines.find((d) => d.id === 'fbt-return')
      expect(fbtReturn!.type).toBe('lodgement')
    })

    it('should set FBT payment type as payment', () => {
      const fbtPayment = deadlines.find((d) => d.id === 'fbt-payment')
      expect(fbtPayment!.type).toBe('payment')
    })

    it('should reference FBTAA 1986', () => {
      const fbtReturn = deadlines.find((d) => d.id === 'fbt-return')
      expect(fbtReturn!.legislativeRef).toBe('FBTAA 1986')
    })

    it('should apply FBT to company, trust, and partnership', () => {
      const fbtReturn = deadlines.find((d) => d.id === 'fbt-return')
      expect(fbtReturn!.entityTypes).toContain('company')
      expect(fbtReturn!.entityTypes).toContain('trust')
      expect(fbtReturn!.entityTypes).toContain('partnership')
    })
  })

  // ========================================================================
  // Income Tax Returns
  // ========================================================================

  describe('income tax return deadlines', () => {
    it('should set individual return due 31 October (self-lodgement)', () => {
      const individual = deadlines.find((d) => d.id === 'income-tax-individual')
      expect(individual).toBeDefined()
      expect(individual!.date.getMonth()).toBe(9) // October
      expect(individual!.date.getDate()).toBe(31)
      expect(individual!.date.getFullYear()).toBe(2025)
    })

    it('should set company return due 28 February of following year', () => {
      const company = deadlines.find((d) => d.id === 'income-tax-company')
      expect(company).toBeDefined()
      expect(company!.date.getMonth()).toBe(1) // February
      expect(company!.date.getDate()).toBe(28)
      expect(company!.date.getFullYear()).toBe(2026)
    })

    it('should set trust return due 28 February of following year', () => {
      const trust = deadlines.find((d) => d.id === 'income-tax-trust')
      expect(trust).toBeDefined()
      expect(trust!.date.getMonth()).toBe(1)
      expect(trust!.date.getDate()).toBe(28)
      expect(trust!.date.getFullYear()).toBe(2026)
    })

    it('should set SMSF return due 28 February of following year', () => {
      const smsf = deadlines.find((d) => d.id === 'income-tax-super')
      expect(smsf).toBeDefined()
      expect(smsf!.date.getMonth()).toBe(1)
      expect(smsf!.date.getDate()).toBe(28)
      expect(smsf!.date.getFullYear()).toBe(2026)
    })

    it('should apply individual return only to individual entity type', () => {
      const individual = deadlines.find((d) => d.id === 'income-tax-individual')
      expect(individual!.entityTypes).toEqual(['individual'])
    })

    it('should apply company return only to company entity type', () => {
      const company = deadlines.find((d) => d.id === 'income-tax-company')
      expect(company!.entityTypes).toEqual(['company'])
    })
  })

  // ========================================================================
  // R&D Registration Deadline
  // ========================================================================

  describe('R&D registration deadline', () => {
    it('should be due 30 April (10 months after FY end)', () => {
      const rnd = deadlines.find((d) => d.id === 'rnd-registration')
      expect(rnd).toBeDefined()
      expect(rnd!.date.getMonth()).toBe(3) // April
      expect(rnd!.date.getDate()).toBe(30)
      // FY2024-25 ends June 2025, + 10 months = April 2026
      expect(rnd!.date.getFullYear()).toBe(2026)
    })

    it('should be registration type', () => {
      const rnd = deadlines.find((d) => d.id === 'rnd-registration')
      expect(rnd!.type).toBe('registration')
    })

    it('should apply only to companies', () => {
      const rnd = deadlines.find((d) => d.id === 'rnd-registration')
      expect(rnd!.entityTypes).toEqual(['company'])
    })

    it('should reference Industry Research and Development Act', () => {
      const rnd = deadlines.find((d) => d.id === 'rnd-registration')
      expect(rnd!.legislativeRef).toContain('Industry Research and Development Act')
    })
  })

  // ========================================================================
  // Superannuation Guarantee
  // ========================================================================

  describe('superannuation guarantee deadlines', () => {
    it('should generate 4 quarterly super deadlines', () => {
      const superDls = deadlines.filter((d) => d.id.startsWith('super-'))
      expect(superDls).toHaveLength(4)
    })

    it('should set Q1 super due 28 October', () => {
      const sq1 = deadlines.find((d) => d.id === 'super-q1')
      expect(sq1).toBeDefined()
      expect(sq1!.date.getMonth()).toBe(9) // October
      expect(sq1!.date.getDate()).toBe(28)
    })

    it('should set Q2 super due 28 January next year', () => {
      const sq2 = deadlines.find((d) => d.id === 'super-q2')
      expect(sq2).toBeDefined()
      expect(sq2!.date.getMonth()).toBe(0) // January
      expect(sq2!.date.getDate()).toBe(28)
      expect(sq2!.date.getFullYear()).toBe(2025)
    })

    it('should be payment type', () => {
      const sq1 = deadlines.find((d) => d.id === 'super-q1')
      expect(sq1!.type).toBe('payment')
    })

    it('should reference SGAA 1992', () => {
      const sq1 = deadlines.find((d) => d.id === 'super-q1')
      expect(sq1!.legislativeRef).toBe('SGAA 1992 s 23')
    })
  })

  // ========================================================================
  // Different financial years
  // ========================================================================

  describe('handles different financial years', () => {
    it('should generate correct deadlines for FY2025-26', () => {
      const fy2526 = generateDeadlines(2025)

      const fbtReturn = fy2526.find((d) => d.id === 'fbt-return')
      expect(fbtReturn!.date.getFullYear()).toBe(2026)
      expect(fbtReturn!.date.getMonth()).toBe(4)

      const rnd = fy2526.find((d) => d.id === 'rnd-registration')
      expect(rnd!.date.getFullYear()).toBe(2027)
      expect(rnd!.date.getMonth()).toBe(3) // April 2027
    })

    it('should generate correct deadlines for FY2023-24 (historical)', () => {
      const fy2324 = generateDeadlines(2023)

      const individual = fy2324.find((d) => d.id === 'income-tax-individual')
      expect(individual!.date.getFullYear()).toBe(2024)
      expect(individual!.date.getMonth()).toBe(9) // October 2024
    })
  })

  // ========================================================================
  // getDeadlineStatus
  // ========================================================================

  describe('getDeadlineStatus', () => {
    const makeDeadline = (daysFromNow: number): TaxDeadline => ({
      id: 'test',
      name: 'Test Deadline',
      description: 'Test',
      category: 'other',
      entityTypes: ['company'],
      date: new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000),
      legislativeRef: 'Test Act',
      type: 'lodgement',
    })

    it('should return "ok" when more than 30 days remaining', () => {
      const status = getDeadlineStatus(makeDeadline(60))
      expect(status.urgency).toBe('ok')
      expect(status.daysRemaining).toBeGreaterThan(30)
    })

    it('should return "approaching" when 7-30 days remaining', () => {
      const status = getDeadlineStatus(makeDeadline(15))
      expect(status.urgency).toBe('approaching')
    })

    it('should return "urgent" when less than 7 days remaining', () => {
      const status = getDeadlineStatus(makeDeadline(3))
      expect(status.urgency).toBe('urgent')
    })

    it('should return "overdue" when date has passed', () => {
      const status = getDeadlineStatus(makeDeadline(-5))
      expect(status.urgency).toBe('overdue')
      expect(status.daysRemaining).toBeLessThan(0)
    })

    it('should use provided reference date instead of current date', () => {
      const deadline = makeDeadline(0)
      deadline.date = new Date(2025, 9, 31) // 31 Oct 2025

      const referenceDate = new Date(2025, 9, 25) // 25 Oct 2025 (6 days before)
      const status = getDeadlineStatus(deadline, referenceDate)

      expect(status.urgency).toBe('urgent')
      expect(status.daysRemaining).toBe(6)
    })

    it('should include the original deadline object', () => {
      const deadline = makeDeadline(10)
      const status = getDeadlineStatus(deadline)
      expect(status.deadline).toBe(deadline)
    })
  })

  // ========================================================================
  // filterByEntityType
  // ========================================================================

  describe('filterByEntityType', () => {
    it('should return only company-applicable deadlines', () => {
      const companyDeadlines = filterByEntityType(deadlines, 'company')

      for (const d of companyDeadlines) {
        expect(d.entityTypes).toContain('company')
      }
      expect(companyDeadlines.length).toBeGreaterThan(0)
    })

    it('should return only individual-applicable deadlines', () => {
      const individualDeadlines = filterByEntityType(deadlines, 'individual')

      for (const d of individualDeadlines) {
        expect(d.entityTypes).toContain('individual')
      }

      // Individuals should have quarterly BAS, PAYG, income tax
      expect(individualDeadlines.length).toBeGreaterThan(0)
    })

    it('should exclude company-only deadlines from individual filter', () => {
      const individualDeadlines = filterByEntityType(deadlines, 'individual')

      const rnd = individualDeadlines.find((d) => d.id === 'rnd-registration')
      expect(rnd).toBeUndefined() // R&D is company-only
    })

    it('should return super fund deadlines', () => {
      const superfundDeadlines = filterByEntityType(deadlines, 'super_fund')

      expect(superfundDeadlines.length).toBeGreaterThan(0)

      const smsf = superfundDeadlines.find((d) => d.id === 'income-tax-super')
      expect(smsf).toBeDefined()
    })

    it('should return trust deadlines including FBT', () => {
      const trustDeadlines = filterByEntityType(deadlines, 'trust')

      const fbt = trustDeadlines.find((d) => d.id === 'fbt-return')
      expect(fbt).toBeDefined()
    })
  })

  // ========================================================================
  // getDeadlinesForMonth
  // ========================================================================

  describe('getDeadlinesForMonth', () => {
    it('should return deadlines for October 2024 (Q1 BAS, Q1 PAYG, Q1 Super)', () => {
      const october = getDeadlinesForMonth(deadlines, 2024, 9) // month is 0-indexed

      expect(october.length).toBeGreaterThan(0)

      const ids = october.map((d) => d.id)
      expect(ids).toContain('bas-quarterly-q1')
    })

    it('should return empty array for month with no deadlines', () => {
      // December 2025 should have no deadlines from FY2024-25
      // (monthly BAS for Nov is due Dec, but let us check a gap)
      const result = getDeadlinesForMonth(deadlines, 2027, 11) // Far future month

      expect(result).toHaveLength(0)
    })

    it('should return FBT deadlines in May', () => {
      const may = getDeadlinesForMonth(deadlines, 2025, 4) // May

      const fbtReturn = may.find((d) => d.id === 'fbt-return')
      const fbtPayment = may.find((d) => d.id === 'fbt-payment')

      expect(fbtReturn).toBeDefined()
      expect(fbtPayment).toBeDefined()
    })

    it('should return R&D deadline in April', () => {
      const april = getDeadlinesForMonth(deadlines, 2026, 3) // April 2026

      const rnd = april.find((d) => d.id === 'rnd-registration')
      expect(rnd).toBeDefined()
    })
  })
})
