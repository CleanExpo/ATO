/**
 * Recommendation Engine - Aggregates all tax analysis findings and generates
 * prioritized, actionable recommendations with specific forms, deadlines, and
 * financial benefits.
 *
 * Integrates:
 * - R&D Engine (Division 355)
 * - Deduction Engine (Division 8)
 * - Loss Engine (Division 36/165)
 * - Division 7A Engine
 */

import { analyzeRndOpportunities } from '@/lib/analysis/rnd-engine'
import { analyzeDeductionOpportunities } from '@/lib/analysis/deduction-engine'
import { analyzeLossPosition } from '@/lib/analysis/loss-engine'
import { analyzeDiv7aCompliance } from '@/lib/analysis/div7a-engine'
import { createLogger } from '@/lib/logger'

const log = createLogger('recommendations:engine')

export type TaxArea = 'rnd' | 'deductions' | 'losses' | 'div7a'
export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type AmendmentWindow = 'open' | 'closing_soon' | 'closed'

export interface ActionableRecommendation {
  id: string
  priority: Priority
  taxArea: TaxArea
  financialYear: string

  // Financial Impact
  estimatedBenefit: number
  confidence: number // 0-100
  adjustedBenefit: number // benefit × (confidence / 100)

  // Action Required
  action: string // One-line description
  description: string // Detailed explanation
  atoForms: string[] // Forms to lodge
  deadline: Date
  amendmentWindow: AmendmentWindow

  // Details
  legislativeReference: string
  supportingEvidence: string[]
  documentationRequired: string[]

  // Implementation
  estimatedAccountingCost: number
  netBenefit: number // adjustedBenefit - estimatedAccountingCost

  // Related Data
  transactionIds: string[]
  transactionCount: number

  // Status
  status: 'identified' | 'in_progress' | 'completed' | 'rejected'
  notes: string
}

export interface RecommendationSummary {
  totalRecommendations: number
  totalEstimatedBenefit: number
  totalAdjustedBenefit: number
  totalNetBenefit: number
  byTaxArea: Record<TaxArea, number> // Benefit by tax area
  byPriority: Record<Priority, number> // Count by priority
  byYear: Record<string, number> // Benefit by financial year
  byAmendmentWindow: Record<AmendmentWindow, number> // Count by deadline status
  criticalRecommendations: ActionableRecommendation[]
  recommendations: ActionableRecommendation[]
}

/**
 * Generate all recommendations for a tenant across all tax areas
 */
export async function generateRecommendations(
  tenantId: string,
  startYear?: string,
  endYear?: string
): Promise<RecommendationSummary> {
  log.info('Generating recommendations', { tenantId })

  // Run all analysis engines in parallel
  const [rndSummary, deductionSummary, lossSummary, div7aSummary] = await Promise.all([
    analyzeRndOpportunities(tenantId, startYear, endYear),
    analyzeDeductionOpportunities(tenantId, startYear, endYear),
    analyzeLossPosition(tenantId, startYear, endYear),
    analyzeDiv7aCompliance(tenantId, startYear, endYear),
  ])

  const recommendations: ActionableRecommendation[] = []

  // Generate R&D recommendations
  rndSummary.projects.forEach((project) => {
    if (project.meetsEligibility && project.overallConfidence >= 70) {
      project.financialYears.forEach((year) => {
        const rec = createRndRecommendation(project, year)
        recommendations.push(rec)
      })
    }
  })

  // Generate deduction recommendations
  deductionSummary.opportunities.forEach((opportunity) => {
    if (opportunity.unclaimedAmount > 0 && opportunity.confidence >= 60) {
      const rec = createDeductionRecommendation(opportunity)
      recommendations.push(rec)
    }
  })

  // Generate loss optimization recommendations
  lossSummary.optimizationOpportunities.forEach((lossAnalysis) => {
    if (lossAnalysis.optimization.additionalBenefit > 0) {
      const rec = createLossRecommendation(lossAnalysis)
      recommendations.push(rec)
    }
  })

  // Generate Division 7A recommendations
  div7aSummary.loanAnalyses.forEach((loanAnalysis) => {
    if (!loanAnalysis.isCompliant && loanAnalysis.deemedDividendRisk > 0) {
      const rec = createDiv7aRecommendation(loanAnalysis)
      recommendations.push(rec)
    }
  })

  // Prioritize recommendations
  const prioritized = prioritizeRecommendations(recommendations)

  // Calculate summary
  const summary = calculateRecommendationSummary(prioritized)

  log.info('Recommendations generated', { totalRecommendations: summary.totalRecommendations, totalAdjustedBenefit: summary.totalAdjustedBenefit.toFixed(2) })

  return summary
}

interface RndProject {
  projectName: string
  projectDescription: string
  overallConfidence: number
  eligibilityCriteria: {
    outcomeUnknown: {
      evidence: string[]
    }
  }
  documentationRequired: string[]
  transactions: Array<{
    transactionId: string
    transactionDate: string
    amount: number
  }>
  financialYears: string[]
  meetsEligibility: boolean
}

/**
 * Create R&D recommendation from project analysis
 */
function createRndRecommendation(
  project: RndProject,
  financialYear: string
): ActionableRecommendation {
  const yearExpenditure = project.transactions
    .filter((tx) => tx.transactionDate.includes(financialYear.replace('FY', '')))
    .reduce((sum, tx) => sum + tx.amount, 0)

  const yearOffset = yearExpenditure * 0.435 // 43.5%

  const deadline = calculateAmendmentDeadline(financialYear)
  const amendmentWindow = getAmendmentWindow(deadline)

  const priority = determinePriority(
    yearOffset,
    amendmentWindow,
    project.overallConfidence
  )

  return {
    id: `rnd-${project.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${financialYear}`,
    priority,
    taxArea: 'rnd',
    financialYear,
    estimatedBenefit: yearOffset,
    confidence: project.overallConfidence,
    adjustedBenefit: yearOffset * (project.overallConfidence / 100),
    action: `Claim R&D Tax Incentive offset for ${project.projectName}`,
    description: project.projectDescription,
    atoForms: ['Company Tax Return', 'Schedule 16N (R&D Tax Incentive Schedule)'],
    deadline,
    amendmentWindow,
    legislativeReference: 'Division 355 ITAA 1997 (R&D Tax Incentive)',
    supportingEvidence: project.eligibilityCriteria.outcomeUnknown.evidence,
    documentationRequired: project.documentationRequired,
    estimatedAccountingCost: estimateAccountingCost('rnd', yearOffset),
    netBenefit: (yearOffset * (project.overallConfidence / 100)) - estimateAccountingCost('rnd', yearOffset),
    transactionIds: project.transactions.map((tx) => tx.transactionId),
    transactionCount: project.transactions.length,
    status: 'identified',
    notes: '',
  }
}

interface DeductionOpportunity {
  category: string
  financialYear: string
  unclaimedAmount: number
  estimatedTaxSaving: number
  confidence: number
  legislativeReference: string
  documentationRequired: string[]
  transactionCount: number
  transactions: Array<{
    transactionId: string
    description: string
    amount: number
  }>
}

/**
 * Create deduction recommendation from opportunity analysis
 */
function createDeductionRecommendation(
  opportunity: DeductionOpportunity
): ActionableRecommendation {
  const deadline = calculateAmendmentDeadline(opportunity.financialYear)
  const amendmentWindow = getAmendmentWindow(deadline)

  const taxSaving = opportunity.estimatedTaxSaving
  const priority = determinePriority(
    taxSaving,
    amendmentWindow,
    opportunity.confidence
  )

  return {
    id: `deduction-${opportunity.category.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${opportunity.financialYear}`,
    priority,
    taxArea: 'deductions',
    financialYear: opportunity.financialYear,
    estimatedBenefit: taxSaving,
    confidence: opportunity.confidence,
    adjustedBenefit: taxSaving * (opportunity.confidence / 100),
    action: `Claim ${opportunity.category} deductions`,
    description: `Unclaimed ${opportunity.category} expenses totaling $${opportunity.unclaimedAmount.toFixed(2)} across ${opportunity.transactionCount} transactions`,
    atoForms: ['Company Tax Return'],
    deadline,
    amendmentWindow,
    legislativeReference: opportunity.legislativeReference,
    supportingEvidence: opportunity.transactions.map((tx) => tx.description).slice(0, 5),
    documentationRequired: opportunity.documentationRequired,
    estimatedAccountingCost: estimateAccountingCost('deductions', taxSaving),
    netBenefit: (taxSaving * (opportunity.confidence / 100)) - estimateAccountingCost('deductions', taxSaving),
    transactionIds: opportunity.transactions.map((tx) => tx.transactionId),
    transactionCount: opportunity.transactionCount,
    status: 'identified',
    notes: '',
  }
}

interface LossAnalysis {
  financialYear: string
  optimization: {
    additionalBenefit: number
    reasoning: string
  }
  cotSbtAnalysis: {
    cotNotes: string[]
  }
}

/**
 * Create loss optimization recommendation
 */
function createLossRecommendation(
  lossAnalysis: LossAnalysis
): ActionableRecommendation {
  const deadline = calculateAmendmentDeadline(lossAnalysis.financialYear)
  const amendmentWindow = getAmendmentWindow(deadline)

  const benefit = lossAnalysis.optimization.additionalBenefit
  const priority = determinePriority(benefit, amendmentWindow, 80) // High confidence for loss utilization

  return {
    id: `loss-${lossAnalysis.financialYear}`,
    priority,
    taxArea: 'losses',
    financialYear: lossAnalysis.financialYear,
    estimatedBenefit: benefit,
    confidence: 80,
    adjustedBenefit: benefit * 0.8,
    action: `Optimize loss utilization for ${lossAnalysis.financialYear}`,
    description: lossAnalysis.optimization.reasoning,
    atoForms: ['Company Tax Return', 'Schedule 5 (Losses)'],
    deadline,
    amendmentWindow,
    legislativeReference: 'Division 36 & 165 ITAA 1997 (Tax losses)',
    supportingEvidence: lossAnalysis.cotSbtAnalysis.cotNotes,
    documentationRequired: [
      'Loss schedule showing carry-forward calculation',
      'Shareholder register (for COT compliance)',
      'Business activity records (for SBT compliance)',
    ],
    estimatedAccountingCost: estimateAccountingCost('losses', benefit),
    netBenefit: (benefit * 0.8) - estimateAccountingCost('losses', benefit),
    transactionIds: [],
    transactionCount: 0,
    status: 'identified',
    notes: '',
  }
}

interface LoanAnalysis {
  loanId: string
  shareholderName: string
  closingBalance: number
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  potentialTaxLiability: number
  complianceIssues: string[]
  financialYears: string[]
  isCompliant: boolean
  deemedDividendRisk: number
}

/**
 * Create Division 7A compliance recommendation
 */
function createDiv7aRecommendation(
  loanAnalysis: LoanAnalysis
): ActionableRecommendation {
  const latestYear = loanAnalysis.financialYears[loanAnalysis.financialYears.length - 1]
  const deadline = calculateAmendmentDeadline(latestYear)
  const amendmentWindow = getAmendmentWindow(deadline)

  const benefit = loanAnalysis.potentialTaxLiability // Tax liability avoided by fixing compliance
  const priority: Priority = loanAnalysis.riskLevel === 'critical' ? 'critical' : loanAnalysis.riskLevel === 'high' ? 'high' : 'medium'

  return {
    id: `div7a-${loanAnalysis.loanId}`,
    priority,
    taxArea: 'div7a',
    financialYear: latestYear,
    estimatedBenefit: benefit,
    confidence: 90, // High confidence on compliance requirements
    adjustedBenefit: benefit * 0.9,
    action: `Rectify Division 7A non-compliance for ${loanAnalysis.shareholderName}`,
    description: `Shareholder loan of $${loanAnalysis.closingBalance.toFixed(2)} has compliance issues: ${loanAnalysis.complianceIssues.join(', ')}`,
    atoForms: ['Company Tax Return', 'Division 7A Loan Schedule'],
    deadline,
    amendmentWindow,
    legislativeReference: 'Division 7A ITAA 1936 (Deemed dividends)',
    supportingEvidence: loanAnalysis.complianceIssues,
    documentationRequired: [
      'Complying Division 7A loan agreement',
      'Loan ledger showing advances and repayments',
      'Interest calculation worksheets',
      'Evidence of minimum yearly repayment',
    ],
    estimatedAccountingCost: estimateAccountingCost('div7a', benefit),
    netBenefit: (benefit * 0.9) - estimateAccountingCost('div7a', benefit),
    transactionIds: [],
    transactionCount: 0,
    status: 'identified',
    notes: '',
  }
}

/**
 * Calculate amendment deadline (2-4 years from original due date)
 */
function calculateAmendmentDeadline(financialYear: string): Date {
  // Financial year format: "FY2024-25" means July 1, 2024 to June 30, 2025
  const endYearMatch = financialYear.match(/FY\d{4}-(\d{2})/)
  if (!endYearMatch) {
    throw new Error(`Invalid financial year format: ${financialYear}`)
  }

  const endYearShort = parseInt(endYearMatch[1], 10)
  const endYear = endYearShort < 50 ? 2000 + endYearShort : 1900 + endYearShort

  // FY ends June 30
  const fyEndDate = new Date(endYear, 5, 30) // Month is 0-indexed (5 = June)

  // Amendment deadline is 4 years after FY end (for most companies)
  const deadline = new Date(fyEndDate)
  deadline.setFullYear(deadline.getFullYear() + 4)

  return deadline
}

/**
 * Determine amendment window status
 */
function getAmendmentWindow(deadline: Date): AmendmentWindow {
  const now = new Date()
  const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilDeadline < 0) {
    return 'closed'
  } else if (daysUntilDeadline < 180) {
    return 'closing_soon' // Less than 6 months
  } else {
    return 'open'
  }
}

/**
 * Determine priority based on benefit, deadline, and confidence
 */
function determinePriority(
  benefit: number,
  amendmentWindow: AmendmentWindow,
  confidence: number
): Priority {
  // Critical: High benefit + deadline closing soon
  if (benefit > 50000 && amendmentWindow === 'closing_soon') {
    return 'critical'
  }

  // High: High benefit OR deadline closing soon
  if (benefit > 20000 || amendmentWindow === 'closing_soon') {
    return 'high'
  }

  // Medium: Moderate benefit with good confidence
  if (benefit > 5000 && confidence >= 70) {
    return 'medium'
  }

  // Low: Everything else
  return 'low'
}

/**
 * Estimate accounting cost for implementing recommendation
 * Based on typical Big 4 hourly rates and complexity
 */
function estimateAccountingCost(taxArea: TaxArea, benefit: number): number {
  const baseRates: Record<TaxArea, number> = {
    rnd: 5000, // R&D claims are complex
    deductions: 1000, // Simple amendments
    losses: 2000, // Moderate complexity
    div7a: 3000, // Compliance work
  }

  let cost = baseRates[taxArea]

  // Scale with benefit (larger claims = more work)
  if (benefit > 100000) {
    cost *= 2.0
  } else if (benefit > 50000) {
    cost *= 1.5
  }

  return Math.round(cost)
}

/**
 * Prioritize recommendations by net benefit and urgency
 */
function prioritizeRecommendations(
  recommendations: ActionableRecommendation[]
): ActionableRecommendation[] {
  return recommendations.sort((a, b) => {
    // Priority order: critical > high > medium > low
    const priorityWeight: Record<Priority, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    }

    if (a.priority !== b.priority) {
      return priorityWeight[b.priority] - priorityWeight[a.priority]
    }

    // Within same priority, sort by net benefit
    return b.netBenefit - a.netBenefit
  })
}

/**
 * Calculate recommendation summary statistics
 */
function calculateRecommendationSummary(
  recommendations: ActionableRecommendation[]
): RecommendationSummary {
  let totalEstimatedBenefit = 0
  let totalAdjustedBenefit = 0
  let totalNetBenefit = 0

  const byTaxArea: Record<TaxArea, number> = {
    rnd: 0,
    deductions: 0,
    losses: 0,
    div7a: 0,
  }

  const byPriority: Record<Priority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }

  const byYear: Record<string, number> = {}

  const byAmendmentWindow: Record<AmendmentWindow, number> = {
    open: 0,
    closing_soon: 0,
    closed: 0,
  }

  recommendations.forEach((rec) => {
    totalEstimatedBenefit += rec.estimatedBenefit
    totalAdjustedBenefit += rec.adjustedBenefit
    totalNetBenefit += rec.netBenefit

    byTaxArea[rec.taxArea] += rec.adjustedBenefit
    byPriority[rec.priority]++

    byYear[rec.financialYear] = (byYear[rec.financialYear] || 0) + rec.adjustedBenefit

    byAmendmentWindow[rec.amendmentWindow]++
  })

  const criticalRecommendations = recommendations.filter((rec) => rec.priority === 'critical')

  return {
    totalRecommendations: recommendations.length,
    totalEstimatedBenefit,
    totalAdjustedBenefit,
    totalNetBenefit,
    byTaxArea,
    byPriority,
    byYear,
    byAmendmentWindow,
    criticalRecommendations,
    recommendations,
  }
}

/**
 * Get specific recommendation by ID
 */
export async function getRecommendation(
  tenantId: string,
  recommendationId: string
): Promise<ActionableRecommendation | null> {
  const summary = await generateRecommendations(tenantId)
  const rec = summary.recommendations.find((r) => r.id === recommendationId)
  return rec || null
}

/**
 * Get recommendations by priority
 */
export async function getRecommendationsByPriority(
  tenantId: string,
  priority: Priority
): Promise<ActionableRecommendation[]> {
  const summary = await generateRecommendations(tenantId)
  return summary.recommendations.filter((r) => r.priority === priority)
}

/**
 * Get recommendations by tax area
 */
export async function getRecommendationsByTaxArea(
  tenantId: string,
  taxArea: TaxArea
): Promise<ActionableRecommendation[]> {
  const summary = await generateRecommendations(tenantId)
  return summary.recommendations.filter((r) => r.taxArea === taxArea)
}
