/**
 * Australian Tax Compliance Deadlines
 *
 * All deadlines sourced from ATO, with entity type tagging.
 * FY-parameterised date generation using date-fns.
 */

import { addMonths, setDate, format, differenceInDays } from 'date-fns'

export type EntityType = 'company' | 'individual' | 'trust' | 'partnership' | 'super_fund'

export type DeadlineCategory = 'bas' | 'payg' | 'fbt' | 'income_tax' | 'rnd' | 'super' | 'other'

export interface TaxDeadline {
  id: string
  name: string
  description: string
  category: DeadlineCategory
  /** Entity types this deadline applies to */
  entityTypes: EntityType[]
  /** Date of the deadline */
  date: Date
  /** Legislative reference */
  legislativeRef: string
  /** Whether this is a lodgement or payment deadline */
  type: 'lodgement' | 'payment' | 'registration'
}

export interface DeadlineStatus {
  deadline: TaxDeadline
  daysRemaining: number
  urgency: 'ok' | 'approaching' | 'urgent' | 'overdue'
}

/**
 * Generate all tax deadlines for a given financial year.
 *
 * @param fyStartYear - The calendar year the FY starts in (e.g., 2024 for FY2024-25)
 */
export function generateDeadlines(fyStartYear: number): TaxDeadline[] {
  const fyStart = new Date(fyStartYear, 6, 1) // 1 July
  const _fyEnd = new Date(fyStartYear + 1, 5, 30) // 30 June
  const deadlines: TaxDeadline[] = []

  // === BAS (Business Activity Statement) ===
  // Monthly BAS: due 21st of following month
  for (let month = 0; month < 12; month++) {
    const periodMonth = new Date(fyStart)
    periodMonth.setMonth(periodMonth.getMonth() + month)
    const dueDate = setDate(addMonths(periodMonth, 1), 21)

    deadlines.push({
      id: `bas-monthly-${month}`,
      name: `Monthly BAS - ${format(periodMonth, 'MMMM yyyy')}`,
      description: `Business Activity Statement for ${format(periodMonth, 'MMMM yyyy')}`,
      category: 'bas',
      entityTypes: ['company', 'trust', 'partnership'],
      date: dueDate,
      legislativeRef: 'TAA 1953 Division 31',
      type: 'lodgement',
    })
  }

  // Quarterly BAS: Q1 (Jul-Sep) due 28 Oct, Q2 (Oct-Dec) due 28 Feb, Q3 (Jan-Mar) due 28 Apr, Q4 (Apr-Jun) due 28 Jul
  const quarterlyBAS = [
    { q: 'Q1', period: 'July - September', dueMonth: 9, dueDay: 28 },
    { q: 'Q2', period: 'October - December', dueMonth: 1, dueDay: 28, nextYear: true },
    { q: 'Q3', period: 'January - March', dueMonth: 3, dueDay: 28, nextYear: true },
    { q: 'Q4', period: 'April - June', dueMonth: 6, dueDay: 28, nextYear: true },
  ]

  for (const q of quarterlyBAS) {
    const year = q.nextYear ? fyStartYear + 1 : fyStartYear
    deadlines.push({
      id: `bas-quarterly-${q.q.toLowerCase()}`,
      name: `Quarterly BAS - ${q.q} (${q.period})`,
      description: `Quarterly Business Activity Statement for ${q.period} ${fyStartYear}/${fyStartYear + 1}`,
      category: 'bas',
      entityTypes: ['company', 'individual', 'trust', 'partnership', 'super_fund'],
      date: new Date(year, q.dueMonth, q.dueDay),
      legislativeRef: 'TAA 1953 Division 31',
      type: 'lodgement',
    })
  }

  // === PAYG Instalments (quarterly) ===
  const paygQuarters = [
    { q: 'Q1', dueMonth: 9, dueDay: 21 },
    { q: 'Q2', dueMonth: 1, dueDay: 21, nextYear: true },
    { q: 'Q3', dueMonth: 3, dueDay: 21, nextYear: true },
    { q: 'Q4', dueMonth: 6, dueDay: 21, nextYear: true },
  ]

  for (const q of paygQuarters) {
    const year = q.nextYear ? fyStartYear + 1 : fyStartYear
    deadlines.push({
      id: `payg-${q.q.toLowerCase()}`,
      name: `PAYG Instalment - ${q.q}`,
      description: `Pay As You Go instalment for ${q.q}`,
      category: 'payg',
      entityTypes: ['company', 'individual', 'trust'],
      date: new Date(year, q.dueMonth, q.dueDay),
      legislativeRef: 'TAA 1953 Division 45 Schedule 1',
      type: 'payment',
    })
  }

  // === FBT (Fringe Benefits Tax) ===
  // FBT year: 1 April - 31 March
  deadlines.push({
    id: 'fbt-return',
    name: 'FBT Return Lodgement',
    description: `Fringe Benefits Tax return for FBT year ending 31 March ${fyStartYear + 1}`,
    category: 'fbt',
    entityTypes: ['company', 'trust', 'partnership'],
    date: new Date(fyStartYear + 1, 4, 21), // 21 May
    legislativeRef: 'FBTAA 1986',
    type: 'lodgement',
  })

  deadlines.push({
    id: 'fbt-payment',
    name: 'FBT Payment Due',
    description: `Fringe Benefits Tax payment for FBT year ending 31 March ${fyStartYear + 1}`,
    category: 'fbt',
    entityTypes: ['company', 'trust', 'partnership'],
    date: new Date(fyStartYear + 1, 4, 28), // 28 May
    legislativeRef: 'FBTAA 1986',
    type: 'payment',
  })

  // === Income Tax Returns ===
  deadlines.push({
    id: 'income-tax-individual',
    name: 'Individual Income Tax Return',
    description: `Income tax return for individuals (self-lodgement) for FY${fyStartYear}-${(fyStartYear + 1).toString().slice(-2)}`,
    category: 'income_tax',
    entityTypes: ['individual'],
    date: new Date(fyStartYear + 1, 9, 31), // 31 October
    legislativeRef: 'ITAA 1936 s 161',
    type: 'lodgement',
  })

  deadlines.push({
    id: 'income-tax-company',
    name: 'Company Income Tax Return',
    description: `Company income tax return (non-agent) for FY${fyStartYear}-${(fyStartYear + 1).toString().slice(-2)}`,
    category: 'income_tax',
    entityTypes: ['company'],
    date: new Date(fyStartYear + 2, 1, 28), // 28 February following year (if not using tax agent)
    legislativeRef: 'ITAA 1936 s 161',
    type: 'lodgement',
  })

  deadlines.push({
    id: 'income-tax-trust',
    name: 'Trust Income Tax Return',
    description: `Trust income tax return for FY${fyStartYear}-${(fyStartYear + 1).toString().slice(-2)}`,
    category: 'income_tax',
    entityTypes: ['trust'],
    date: new Date(fyStartYear + 2, 1, 28), // 28 February
    legislativeRef: 'ITAA 1936 s 161',
    type: 'lodgement',
  })

  deadlines.push({
    id: 'income-tax-super',
    name: 'SMSF Income Tax Return',
    description: `Self-managed super fund income tax return for FY${fyStartYear}-${(fyStartYear + 1).toString().slice(-2)}`,
    category: 'income_tax',
    entityTypes: ['super_fund'],
    date: new Date(fyStartYear + 2, 1, 28), // 28 February
    legislativeRef: 'ITAA 1936 s 161',
    type: 'lodgement',
  })

  // === R&D Tax Incentive Registration ===
  deadlines.push({
    id: 'rnd-registration',
    name: 'R&D Tax Incentive Registration',
    description: `Registration of R&D activities with AusIndustry (10 months after FY end)`,
    category: 'rnd',
    entityTypes: ['company'],
    date: new Date(fyStartYear + 2, 3, 30), // 30 April (10 months after 30 June)
    legislativeRef: 'Industry Research and Development Act 1986 s 27A',
    type: 'registration',
  })

  // === Superannuation Guarantee ===
  const superQuarters = [
    { q: 'Q1', period: 'July - September', dueMonth: 9, dueDay: 28 },
    { q: 'Q2', period: 'October - December', dueMonth: 0, dueDay: 28, nextYear: true },
    { q: 'Q3', period: 'January - March', dueMonth: 3, dueDay: 28, nextYear: true },
    { q: 'Q4', period: 'April - June', dueMonth: 6, dueDay: 28, nextYear: true },
  ]

  for (const q of superQuarters) {
    const year = q.nextYear ? fyStartYear + 1 : fyStartYear
    deadlines.push({
      id: `super-${q.q.toLowerCase()}`,
      name: `Super Guarantee - ${q.q} (${q.period})`,
      description: `Superannuation guarantee payment for ${q.period}`,
      category: 'super',
      entityTypes: ['company', 'trust', 'partnership'],
      date: new Date(year, q.dueMonth, q.dueDay),
      legislativeRef: 'SGAA 1992 s 23',
      type: 'payment',
    })
  }

  return deadlines.sort((a, b) => a.date.getTime() - b.date.getTime())
}

/**
 * Calculate deadline status relative to a reference date
 */
export function getDeadlineStatus(deadline: TaxDeadline, referenceDate: Date = new Date()): DeadlineStatus {
  const daysRemaining = differenceInDays(deadline.date, referenceDate)

  let urgency: DeadlineStatus['urgency']
  if (daysRemaining < 0) urgency = 'overdue'
  else if (daysRemaining < 7) urgency = 'urgent'
  else if (daysRemaining < 30) urgency = 'approaching'
  else urgency = 'ok'

  return { deadline, daysRemaining, urgency }
}

/**
 * Filter deadlines by entity type
 */
export function filterByEntityType(deadlines: TaxDeadline[], entityType: EntityType): TaxDeadline[] {
  return deadlines.filter(d => d.entityTypes.includes(entityType))
}

/**
 * Get deadlines for a specific month
 */
export function getDeadlinesForMonth(deadlines: TaxDeadline[], year: number, month: number): TaxDeadline[] {
  return deadlines.filter(d => d.date.getFullYear() === year && d.date.getMonth() === month)
}
