/**
 * Amendment Schedule Generator
 *
 * Generates pre-filled amendment schedules for each financial year with
 * recommendations. Ready for accountant review and lodgment to ATO.
 *
 * Output includes:
 * - Original tax position
 * - Proposed amendments
 * - Revised tax position
 * - Refund expected
 * - Forms required with pre-filled data
 */

import {
  generateRecommendations,
  type ActionableRecommendation,
} from '@/lib/recommendations/recommendation-engine'

export interface TaxPosition {
  income: number
  deductions: number
  taxableIncome: number
  taxPayable: number
  rndOffset: number
  lossesUtilized: number
}

export interface ProposedAmendments {
  additionalRndExpenditure: number
  additionalRndOffset: number // 43.5% of R&D
  additionalDeductions: number
  lossAdjustments: number
  totalAdjustment: number
}

export interface FormData {
  formType: string
  formNumber?: string
  prefillData: Record<string, unknown>
  instructions: string[]
}

export interface AmendmentSchedule {
  financialYear: string
  amendmentType: 'increase_refund' | 'reduce_liability' | 'compliance'

  // Tax positions
  originalTaxReturn: TaxPosition
  proposedAmendments: ProposedAmendments
  revisedTaxPosition: TaxPosition

  // Financial impact
  refundExpected: number
  timeToAmend: string // e.g., "2-3 weeks"
  confidence: number // Average confidence of amendments

  // Forms and documentation
  forms: FormData[]
  deadline: Date
  priorityLevel: 'critical' | 'high' | 'medium' | 'low'

  // Supporting data
  recommendations: ActionableRecommendation[]
  supportingDocuments: string[]
  notes: string[]
}

export interface AmendmentSummary {
  totalSchedules: number
  totalRefundExpected: number
  schedulesByYear: Record<string, number>
  schedulesByPriority: Record<string, number>
  earliestDeadline: Date | null
  averageConfidence: number
  schedules: AmendmentSchedule[]
}

const CORPORATE_TAX_RATE_SMALL = 0.25 // 25% for small business

/**
 * Generate amendment schedules for all years with recommendations
 */
export async function generateAmendmentSchedules(
  tenantId: string,
  taxRate: number = CORPORATE_TAX_RATE_SMALL
): Promise<AmendmentSummary> {
  console.log(`Generating amendment schedules for tenant ${tenantId}`)

  // Get all recommendations
  const recSummary = await generateRecommendations(tenantId)

  // Group recommendations by financial year
  const byYear = new Map<string, ActionableRecommendation[]>()

  recSummary.recommendations.forEach((rec) => {
    if (!byYear.has(rec.financialYear)) {
      byYear.set(rec.financialYear, [])
    }
    byYear.get(rec.financialYear)!.push(rec)
  })

  // Generate schedule for each year
  const schedules: AmendmentSchedule[] = []

  byYear.forEach((recommendations, year) => {
    const schedule = generateScheduleForYear(year, recommendations, taxRate)
    schedules.push(schedule)
  })

  // Sort by priority and deadline
  schedules.sort((a, b) => {
    const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 }
    if (a.priorityLevel !== b.priorityLevel) {
      return priorityWeight[b.priorityLevel] - priorityWeight[a.priorityLevel]
    }
    return a.deadline.getTime() - b.deadline.getTime()
  })

  // Calculate summary
  const summary = calculateAmendmentSummary(schedules)

  console.log(`Generated ${summary.totalSchedules} amendment schedules, total refund: $${summary.totalRefundExpected.toFixed(2)}`)

  return summary
}

/**
 * Generate amendment schedule for a single financial year
 */
function generateScheduleForYear(
  financialYear: string,
  recommendations: ActionableRecommendation[],
  taxRate: number
): AmendmentSchedule {
  // Calculate proposed amendments
  const rndRecs = recommendations.filter((r) => r.taxArea === 'rnd')
  const deductionRecs = recommendations.filter((r) => r.taxArea === 'deductions')
  const lossRecs = recommendations.filter((r) => r.taxArea === 'losses')
  const div7aRecs = recommendations.filter((r) => r.taxArea === 'div7a')

  const additionalRndExpenditure = rndRecs.reduce((sum, r) => sum + (r.estimatedBenefit / 0.435), 0)
  const additionalRndOffset = rndRecs.reduce((sum, r) => sum + r.estimatedBenefit, 0)
  const additionalDeductions = deductionRecs.reduce((sum, r) => sum + (r.estimatedBenefit / taxRate), 0)
  const lossAdjustments = lossRecs.reduce((sum, r) => sum + r.estimatedBenefit, 0)

  const totalAdjustment = additionalRndOffset + (additionalDeductions * taxRate) + lossAdjustments

  const proposedAmendments: ProposedAmendments = {
    additionalRndExpenditure,
    additionalRndOffset,
    additionalDeductions,
    lossAdjustments,
    totalAdjustment,
  }

  // Create original tax position (placeholder - would pull from actual returns)
  const originalTaxReturn: TaxPosition = {
    income: 500000, // Placeholder
    deductions: 300000, // Placeholder
    taxableIncome: 200000,
    taxPayable: 200000 * taxRate,
    rndOffset: 0,
    lossesUtilized: 0,
  }

  // Calculate revised tax position
  const revisedTaxPosition: TaxPosition = {
    income: originalTaxReturn.income,
    deductions: originalTaxReturn.deductions + additionalDeductions,
    taxableIncome: originalTaxReturn.taxableIncome - additionalDeductions - (lossAdjustments / taxRate),
    taxPayable: (originalTaxReturn.taxableIncome - additionalDeductions - (lossAdjustments / taxRate)) * taxRate - additionalRndOffset,
    rndOffset: originalTaxReturn.rndOffset + additionalRndOffset,
    lossesUtilized: originalTaxReturn.lossesUtilized + (lossAdjustments / taxRate),
  }

  // Calculate refund expected
  const refundExpected = originalTaxReturn.taxPayable - revisedTaxPosition.taxPayable

  // Determine priority level
  const priorityLevel = determinePriorityLevel(recommendations)

  // Get deadline (earliest deadline among recommendations)
  const deadline = recommendations.reduce((earliest, rec) => {
    return rec.deadline < earliest ? rec.deadline : earliest
  }, recommendations[0].deadline)

  // Generate forms
  const forms = generateForms(financialYear, proposedAmendments, recommendations)

  // Collect supporting documents
  const supportingDocuments = collectSupportingDocuments(recommendations)

  // Calculate average confidence
  const averageConfidence = Math.round(
    recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length
  )

  // Generate notes
  const notes = generateAmendmentNotes(recommendations, refundExpected, averageConfidence)

  // Determine amendment type
  let amendmentType: 'increase_refund' | 'reduce_liability' | 'compliance' = 'increase_refund'
  if (div7aRecs.length > 0) {
    amendmentType = 'compliance'
  } else if (refundExpected > 0) {
    amendmentType = 'increase_refund'
  } else {
    amendmentType = 'reduce_liability'
  }

  return {
    financialYear,
    amendmentType,
    originalTaxReturn,
    proposedAmendments,
    revisedTaxPosition,
    refundExpected,
    timeToAmend: '2-3 weeks',
    confidence: averageConfidence,
    forms,
    deadline,
    priorityLevel,
    recommendations,
    supportingDocuments,
    notes,
  }
}

/**
 * Determine priority level for amendment schedule
 */
function determinePriorityLevel(
  recommendations: ActionableRecommendation[]
): 'critical' | 'high' | 'medium' | 'low' {
  const priorities = recommendations.map((r) => r.priority)

  if (priorities.includes('critical')) {
    return 'critical'
  } else if (priorities.includes('high')) {
    return 'high'
  } else if (priorities.includes('medium')) {
    return 'medium'
  } else {
    return 'low'
  }
}

/**
 * Generate forms with pre-filled data
 */
function generateForms(
  financialYear: string,
  amendments: ProposedAmendments,
  recommendations: ActionableRecommendation[]
): FormData[] {
  const forms: FormData[] = []

  // Company Tax Return
  forms.push({
    formType: 'Company Tax Return',
    formNumber: 'NAT 0656',
    prefillData: {
      financialYear,
      income: 'As per original return',
      additionalDeductions: amendments.additionalDeductions,
      revisedTaxableIncome: 'Calculated field',
      revisedTaxPayable: 'Calculated field',
      reasonForAmendment: 'Claim additional deductions identified in forensic tax audit',
    },
    instructions: [
      'Complete Label D2 - Total business income (unchanged)',
      'Complete Label D8 - Total deductions (add $' + amendments.additionalDeductions.toFixed(2) + ')',
      'Complete Label V - Reason for amendment',
      'Lodge via Business Portal or through registered tax agent',
    ],
  })

  // Schedule 16N for R&D claims
  const rndRecs = recommendations.filter((r) => r.taxArea === 'rnd')
  if (rndRecs.length > 0 && amendments.additionalRndOffset > 0) {
    forms.push({
      formType: 'R&D Tax Incentive Schedule',
      formNumber: 'Schedule 16N',
      prefillData: {
        financialYear,
        rndExpenditure: amendments.additionalRndExpenditure,
        rndOffset: amendments.additionalRndOffset,
        projects: rndRecs.map((r) => ({
          projectName: r.action,
          expenditure: r.estimatedBenefit / 0.435,
          offset: r.estimatedBenefit,
        })),
      },
      instructions: [
        'Complete Part A - R&D entity details',
        'Complete Part B - R&D activities (list each project)',
        'Complete Part C - R&D expenditure breakdown',
        'Complete Part D - Calculation of offset (43.5%)',
        'Lodge with Company Tax Return amendment',
      ],
    })
  }

  // Schedule 5 for losses
  const lossRecs = recommendations.filter((r) => r.taxArea === 'losses')
  if (lossRecs.length > 0) {
    forms.push({
      formType: 'Tax Losses Schedule',
      formNumber: 'Schedule 5',
      prefillData: {
        financialYear,
        openingLossBalance: 'From prior year',
        currentYearLoss: 0,
        lossesUtilized: amendments.lossAdjustments / 0.25,
        closingLossBalance: 'Calculated field',
      },
      instructions: [
        'Complete Part A - Tax losses deducted',
        'Complete Part B - Tax losses carried forward',
        'Ensure COT/SBT compliance is documented',
        'Lodge with Company Tax Return amendment',
      ],
    })
  }

  // Division 7A Loan Schedule
  const div7aRecs = recommendations.filter((r) => r.taxArea === 'div7a')
  if (div7aRecs.length > 0) {
    forms.push({
      formType: 'Division 7A Loan Schedule',
      formNumber: 'Custom Schedule',
      prefillData: {
        financialYear,
        loans: div7aRecs.map((r) => ({
          shareholder: r.action,
          loanBalance: 'From transaction records',
          interestCharged: 'As per benchmark rate',
          repayments: 'Minimum yearly repayment',
        })),
      },
      instructions: [
        'Complete loan details for each shareholder',
        'Show interest charged at benchmark rate',
        'Show minimum yearly repayments made',
        'Attach complying loan agreement',
        'Lodge with Company Tax Return amendment',
      ],
    })
  }

  return forms
}

/**
 * Collect all supporting documents required
 */
function collectSupportingDocuments(
  recommendations: ActionableRecommendation[]
): string[] {
  const docs = new Set<string>()

  recommendations.forEach((rec) => {
    rec.documentationRequired.forEach((doc) => docs.add(doc))
    rec.supportingEvidence.forEach((evidence) => docs.add(evidence))
  })

  // Add common documents
  docs.add('Original company tax return for reference')
  docs.add('Amended company tax return (completed)')
  docs.add('Covering letter explaining amendments')
  docs.add('Calculation worksheets showing adjustments')

  return Array.from(docs)
}

/**
 * Generate notes for amendment schedule
 */
function generateAmendmentNotes(
  recommendations: ActionableRecommendation[],
  refundExpected: number,
  confidence: number
): string[] {
  const notes: string[] = []

  notes.push(`Expected refund: $${refundExpected.toFixed(2)}`)
  notes.push(`Average confidence: ${confidence}%`)
  notes.push(`${recommendations.length} recommendations included in this amendment`)

  if (confidence < 70) {
    notes.push('⚠️ Lower confidence - recommend detailed review with tax specialist before lodging')
  }

  if (refundExpected > 100000) {
    notes.push('⚠️ High-value amendment - expect ATO review, ensure all documentation is comprehensive')
  }

  const criticalRecs = recommendations.filter((r) => r.priority === 'critical')
  if (criticalRecs.length > 0) {
    notes.push(`🔴 ${criticalRecs.length} critical recommendation(s) - lodge urgently`)
  }

  notes.push('Lodge amendment via Business Portal or through registered tax agent')
  notes.push('Allow 2-3 weeks for ATO processing')
  notes.push('Refund will be paid to nominated bank account')

  return notes
}

/**
 * Calculate amendment summary statistics
 */
function calculateAmendmentSummary(schedules: AmendmentSchedule[]): AmendmentSummary {
  let totalRefundExpected = 0
  const schedulesByYear: Record<string, number> = {}
  const schedulesByPriority: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }
  let earliestDeadline: Date | null = null
  let totalConfidence = 0

  schedules.forEach((schedule) => {
    totalRefundExpected += schedule.refundExpected
    schedulesByYear[schedule.financialYear] = schedule.refundExpected
    schedulesByPriority[schedule.priorityLevel]++
    totalConfidence += schedule.confidence

    if (!earliestDeadline || schedule.deadline < earliestDeadline) {
      earliestDeadline = schedule.deadline
    }
  })

  const averageConfidence = schedules.length > 0 ? Math.round(totalConfidence / schedules.length) : 0

  return {
    totalSchedules: schedules.length,
    totalRefundExpected,
    schedulesByYear,
    schedulesByPriority,
    earliestDeadline,
    averageConfidence,
    schedules,
  }
}

/**
 * Export amendment schedule as structured data for accountant software
 */
export function exportAmendmentSchedule(schedule: AmendmentSchedule): string {
  // Export as JSON for import into accounting software
  return JSON.stringify(schedule, null, 2)
}

/**
 * Generate plain-text amendment summary for email
 */
export function generateAmendmentSummaryText(summary: AmendmentSummary): string {
  let text = 'AMENDMENT SCHEDULE SUMMARY\n'
  text += '==========================\n\n'

  text += `Total Schedules: ${summary.totalSchedules}\n`
  text += `Total Refund Expected: $${summary.totalRefundExpected.toFixed(2)}\n`
  text += `Average Confidence: ${summary.averageConfidence}%\n\n`

  if (summary.earliestDeadline) {
    const daysUntil = Math.ceil((summary.earliestDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    text += `Earliest Deadline: ${summary.earliestDeadline.toLocaleDateString()} (${daysUntil} days)\n\n`
  }

  text += 'BREAKDOWN BY YEAR:\n'
  Object.entries(summary.schedulesByYear).forEach(([year, refund]) => {
    text += `  ${year}: $${refund.toFixed(2)}\n`
  })
  text += '\n'

  text += 'BREAKDOWN BY PRIORITY:\n'
  Object.entries(summary.schedulesByPriority).forEach(([priority, count]) => {
    text += `  ${priority.toUpperCase()}: ${count} schedule(s)\n`
  })

  return text
}
