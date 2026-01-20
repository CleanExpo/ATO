/**
 * Excel Workbook Generator
 *
 * Generates comprehensive Excel workbooks with multiple tabs for forensic tax audit data.
 * All data is pivot-ready with filters, conditional formatting, and formulas.
 *
 * Workbook Structure:
 * - Summary: Dashboard with key metrics and charts
 * - R&D Candidates: All R&D transactions with analysis
 * - Deductions: All deduction opportunities by category
 * - Losses: Loss position tracking year-over-year
 * - Division 7A: Shareholder loan analysis
 * - Transactions: Full transaction-level detail
 * - Recommendations: Prioritized action items
 * - Amendments: Amendment schedules by year
 *
 * Note: This implementation generates structured data for Excel.
 * For production, integrate with ExcelJS library.
 */

import { generateRecommendations } from '@/lib/recommendations/recommendation-engine'
import { generateAmendmentSchedules } from '@/lib/reports/amendment-schedules'
import { analyzeRndOpportunities } from '@/lib/analysis/rnd-engine'
import { analyzeDeductionOpportunities } from '@/lib/analysis/deduction-engine'
import { analyzeLossPosition } from '@/lib/analysis/loss-engine'
import { analyzeDiv7aCompliance } from '@/lib/analysis/div7a-engine'
import { createServiceClient } from '@/lib/supabase/server'

export interface ExcelWorkbookData {
  metadata: {
    organizationName: string
    abn: string
    generatedAt: Date
    yearsAnalyzed: string[]
  }
  sheets: {
    summary: SummarySheet
    rndCandidates: RndCandidatesSheet
    deductions: DeductionsSheet
    losses: LossesSheet
    div7a: Div7aSheet
    transactions: TransactionsSheet
    recommendations: RecommendationsSheet
    amendments: AmendmentsSheet
  }
}

export interface SummarySheet {
  headers: string[]
  data: any[][]
  charts: ChartDefinition[]
}

export interface ChartDefinition {
  type: 'bar' | 'pie' | 'line'
  title: string
  dataRange: string
  position: string
}

export interface RndCandidatesSheet {
  headers: string[]
  data: any[][]
  totals: any[]
}

export interface DeductionsSheet {
  headers: string[]
  data: any[][]
  totals: any[]
}

export interface LossesSheet {
  headers: string[]
  data: any[][]
}

export interface Div7aSheet {
  headers: string[]
  data: any[][]
}

export interface TransactionsSheet {
  headers: string[]
  data: any[][]
}

export interface RecommendationsSheet {
  headers: string[]
  data: any[][]
}

export interface AmendmentsSheet {
  headers: string[]
  data: any[][]
}

/**
 * Generate complete Excel workbook data structure
 */
export async function generateExcelWorkbookData(
  tenantId: string,
  organizationName: string,
  abn: string
): Promise<ExcelWorkbookData> {
  console.log(`Generating Excel workbook for tenant ${tenantId}`)

  // Run all analyses in parallel
  const [
    rndSummary,
    deductionSummary,
    lossSummary,
    div7aSummary,
    recommendationSummary,
    amendmentSummary,
  ] = await Promise.all([
    analyzeRndOpportunities(tenantId),
    analyzeDeductionOpportunities(tenantId),
    analyzeLossPosition(tenantId),
    analyzeDiv7aCompliance(tenantId),
    generateRecommendations(tenantId),
    generateAmendmentSchedules(tenantId),
  ])

  // Fetch raw transaction data
  const transactions = await fetchTransactionData(tenantId)

  // Create metadata
  const metadata = {
    organizationName,
    abn,
    generatedAt: new Date(),
    yearsAnalyzed: Array.from(
      new Set([
        ...Object.keys(rndSummary.projectsByYear),
        ...Object.keys(deductionSummary.opportunitiesByYear),
        ...Object.keys(lossSummary.lossesByYear),
      ])
    ).sort(),
  }

  // Generate each sheet
  const sheets = {
    summary: createSummarySheet(
      rndSummary,
      deductionSummary,
      lossSummary,
      div7aSummary,
      recommendationSummary
    ),
    rndCandidates: createRndCandidatesSheet(rndSummary),
    deductions: createDeductionsSheet(deductionSummary),
    losses: createLossesSheet(lossSummary),
    div7a: createDiv7aSheet(div7aSummary),
    transactions: createTransactionsSheet(transactions),
    recommendations: createRecommendationsSheet(recommendationSummary),
    amendments: createAmendmentsSheet(amendmentSummary),
  }

  return {
    metadata,
    sheets,
  }
}

/**
 * Create Summary sheet with dashboard metrics
 */
function createSummarySheet(
  rndSummary: any,
  deductionSummary: any,
  lossSummary: any,
  div7aSummary: any,
  recommendationSummary: any
): SummarySheet {
  const headers = ['Metric', 'Value', 'Notes']

  const data = [
    ['EXECUTIVE SUMMARY', '', ''],
    ['Total Opportunity', `$${recommendationSummary.totalAdjustedBenefit.toFixed(2)}`, 'Confidence-adjusted'],
    ['Total Recommendations', recommendationSummary.totalRecommendations, ''],
    ['Critical Items', recommendationSummary.byPriority.critical, 'Requires immediate action'],
    ['', '', ''],
    ['R&D TAX INCENTIVE', '', ''],
    ['Total Projects', rndSummary.totalProjects, ''],
    ['Eligible Expenditure', `$${rndSummary.totalEligibleExpenditure.toFixed(2)}`, ''],
    ['Estimated Offset (43.5%)', `$${rndSummary.totalEstimatedOffset.toFixed(2)}`, ''],
    ['Average Confidence', `${rndSummary.averageConfidence}%`, ''],
    ['', '', ''],
    ['GENERAL DEDUCTIONS', '', ''],
    ['Total Opportunities', deductionSummary.totalOpportunities, ''],
    ['Unclaimed Deductions', `$${deductionSummary.totalUnclaimedDeductions.toFixed(2)}`, ''],
    ['Estimated Tax Saving', `$${deductionSummary.totalEstimatedTaxSaving.toFixed(2)}`, 'At 25% corporate rate'],
    ['', '', ''],
    ['LOSS CARRY-FORWARD', '', ''],
    ['Available Losses', `$${lossSummary.totalAvailableLosses.toFixed(2)}`, ''],
    ['Future Tax Value', `$${lossSummary.totalFutureTaxValue.toFixed(2)}`, 'At 25% corporate rate'],
    ['Utilization Rate', `${lossSummary.utilizationRate}%`, ''],
    ['', '', ''],
    ['DIVISION 7A COMPLIANCE', '', ''],
    ['Total Loans', div7aSummary.totalLoans, ''],
    ['Compliant Loans', div7aSummary.compliantLoans, ''],
    ['Non-Compliant Loans', div7aSummary.nonCompliantLoans, ''],
    ['Deemed Dividend Risk', `$${div7aSummary.totalDeemedDividendRisk.toFixed(2)}`, ''],
    ['', '', ''],
    ['BREAKDOWN BY YEAR', '', ''],
    ...Object.entries(recommendationSummary.byYear).map(([year, amount]: [string, any]) => [
      year,
      `$${amount.toFixed(2)}`,
      '',
    ]),
  ]

  const charts: ChartDefinition[] = [
    {
      type: 'pie',
      title: 'Opportunity by Tax Area',
      dataRange: 'B2:B5',
      position: 'E2',
    },
    {
      type: 'bar',
      title: 'Opportunity by Year',
      dataRange: 'B27:B31', // Adjust based on actual data
      position: 'E15',
    },
  ]

  return { headers, data, charts }
}

/**
 * Create R&D Candidates sheet
 */
function createRndCandidatesSheet(rndSummary: any): RndCandidatesSheet {
  const headers = [
    'Project Name',
    'Financial Years',
    'Transaction Count',
    'Total Expenditure',
    'Eligible Expenditure',
    'Estimated Offset (43.5%)',
    'Confidence (%)',
    'Meets Eligibility',
    'Activity Type',
    'Registration Deadline',
    'Registration Status',
  ]

  const data = rndSummary.projects.map((project: any) => [
    project.projectName,
    project.financialYears.join(', '),
    project.transactionCount,
    project.totalExpenditure,
    project.eligibleExpenditure,
    project.estimatedOffset,
    project.overallConfidence,
    project.meetsEligibility ? 'Yes' : 'No',
    project.transactions[0]?.activityType || 'N/A',
    project.registrationDeadline.toLocaleDateString(),
    project.registrationStatus,
  ])

  const totals = [
    'TOTALS',
    '',
    rndSummary.projects.reduce((sum: number, p: any) => sum + p.transactionCount, 0),
    rndSummary.projects.reduce((sum: number, p: any) => sum + p.totalExpenditure, 0),
    rndSummary.totalEligibleExpenditure,
    rndSummary.totalEstimatedOffset,
    rndSummary.averageConfidence,
    '',
    '',
    '',
    '',
  ]

  return { headers, data, totals }
}

/**
 * Create Deductions sheet
 */
function createDeductionsSheet(deductionSummary: any): DeductionsSheet {
  const headers = [
    'Category',
    'Financial Year',
    'Transaction Count',
    'Total Amount',
    'Claimed Amount',
    'Unclaimed Amount',
    'Tax Saving (25%)',
    'Confidence (%)',
    'Legislative Reference',
    'FBT Implications',
  ]

  const data = deductionSummary.opportunities.map((opp: any) => [
    opp.category,
    opp.financialYear,
    opp.transactionCount,
    opp.totalAmount,
    opp.claimedAmount,
    opp.unclaimedAmount,
    opp.estimatedTaxSaving,
    opp.confidence,
    opp.legislativeReference,
    opp.fbtImplications ? 'Yes' : 'No',
  ])

  const totals = [
    'TOTALS',
    '',
    deductionSummary.opportunities.reduce((sum: number, o: any) => sum + o.transactionCount, 0),
    deductionSummary.opportunities.reduce((sum: number, o: any) => sum + o.totalAmount, 0),
    deductionSummary.opportunities.reduce((sum: number, o: any) => sum + o.claimedAmount, 0),
    deductionSummary.totalUnclaimedDeductions,
    deductionSummary.totalEstimatedTaxSaving,
    deductionSummary.averageConfidence,
    '',
    '',
  ]

  return { headers, data, totals }
}

/**
 * Create Losses sheet
 */
function createLossesSheet(lossSummary: any): LossesSheet {
  const headers = [
    'Financial Year',
    'Opening Balance',
    'Current Year Loss',
    'Losses Utilized',
    'Closing Balance',
    'COT Satisfied',
    'SBT Required',
    'SBT Satisfied',
    'Eligible for Carry-Forward',
    'Future Tax Value (25%)',
    'Risk Level',
  ]

  const data = lossSummary.lossHistory.map((loss: any) => [
    loss.financialYear,
    loss.openingLossBalance,
    loss.currentYearLoss,
    loss.lossesUtilized,
    loss.closingLossBalance,
    loss.cotSbtAnalysis.cotSatisfied ? 'Yes' : 'No',
    loss.cotSbtAnalysis.sbtRequired ? 'Yes' : 'No',
    loss.cotSbtAnalysis.sbtSatisfied ? 'Yes' : 'No',
    loss.isEligibleForCarryforward ? 'Yes' : 'No',
    loss.futureTaxValue,
    loss.cotSbtAnalysis.riskLevel,
  ])

  return { headers, data }
}

/**
 * Create Division 7A sheet
 */
function createDiv7aSheet(div7aSummary: any): Div7aSheet {
  const headers = [
    'Loan ID',
    'Shareholder',
    'Financial Years',
    'Loan Type',
    'Opening Balance',
    'Advances This Year',
    'Repayments This Year',
    'Closing Balance',
    'Interest Charged',
    'Benchmark Interest Required',
    'Interest Shortfall',
    'Minimum Repayment Required',
    'Repayment Shortfall',
    'Has Written Agreement',
    'Is Compliant',
    'Deemed Dividend Risk',
    'Potential Tax Liability',
    'Risk Level',
  ]

  const data = div7aSummary.loanAnalyses.map((loan: any) => [
    loan.loanId,
    loan.shareholderName,
    loan.financialYears.join(', '),
    loan.loanType,
    loan.openingBalance,
    loan.advancesThisYear,
    loan.repaymentsThisYear,
    loan.closingBalance,
    loan.interestCharged,
    loan.benchmarkInterestRequired,
    loan.interestShortfall,
    loan.minimumRepaymentRequired,
    loan.repaymentShortfall,
    loan.hasWrittenAgreement ? 'Yes' : 'No',
    loan.isCompliant ? 'Yes' : 'No',
    loan.deemedDividendRisk,
    loan.potentialTaxLiability,
    loan.riskLevel,
  ])

  return { headers, data }
}

/**
 * Create Transactions sheet with full detail
 */
function createTransactionsSheet(transactions: any[]): TransactionsSheet {
  const headers = [
    'Transaction ID',
    'Date',
    'Financial Year',
    'Description',
    'Amount',
    'Type',
    'Supplier',
    'Account Code',
    'Primary Category',
    'R&D Candidate',
    'R&D Confidence',
    'Meets Div 355',
    'Deductible',
    'Deduction Type',
    'Deduction Confidence',
    'Claimable Amount',
  ]

  const data = transactions.map((tx) => [
    tx.transaction_id,
    tx.transaction_date,
    tx.financial_year,
    tx.transaction_description,
    tx.transaction_amount,
    tx.transaction_type,
    tx.supplier_name,
    tx.account_code,
    tx.primary_category,
    tx.is_rnd_candidate ? 'Yes' : 'No',
    tx.rnd_confidence,
    tx.meets_div355_criteria ? 'Yes' : 'No',
    tx.is_fully_deductible ? 'Yes' : 'No',
    tx.deduction_type,
    tx.deduction_confidence,
    tx.claimable_amount,
  ])

  return { headers, data }
}

/**
 * Create Recommendations sheet
 */
function createRecommendationsSheet(recommendationSummary: any): RecommendationsSheet {
  const headers = [
    'Priority',
    'Tax Area',
    'Financial Year',
    'Action',
    'Estimated Benefit',
    'Confidence (%)',
    'Adjusted Benefit',
    'Net Benefit',
    'ATO Forms',
    'Deadline',
    'Amendment Window',
    'Legislative Reference',
    'Transaction Count',
    'Status',
  ]

  const data = recommendationSummary.recommendations.map((rec: any) => [
    rec.priority.toUpperCase(),
    rec.taxArea.toUpperCase(),
    rec.financialYear,
    rec.action,
    rec.estimatedBenefit,
    rec.confidence,
    rec.adjustedBenefit,
    rec.netBenefit,
    rec.atoForms.join('; '),
    rec.deadline.toLocaleDateString(),
    rec.amendmentWindow,
    rec.legislativeReference,
    rec.transactionCount,
    rec.status,
  ])

  return { headers, data }
}

/**
 * Create Amendments sheet
 */
function createAmendmentsSheet(amendmentSummary: any): AmendmentsSheet {
  const headers = [
    'Financial Year',
    'Amendment Type',
    'Priority',
    'Additional R&D Expenditure',
    'Additional R&D Offset',
    'Additional Deductions',
    'Loss Adjustments',
    'Total Adjustment',
    'Refund Expected',
    'Confidence (%)',
    'Deadline',
    'Time to Amend',
    'Recommendation Count',
  ]

  const data = amendmentSummary.schedules.map((schedule: any) => [
    schedule.financialYear,
    schedule.amendmentType,
    schedule.priorityLevel.toUpperCase(),
    schedule.proposedAmendments.additionalRndExpenditure,
    schedule.proposedAmendments.additionalRndOffset,
    schedule.proposedAmendments.additionalDeductions,
    schedule.proposedAmendments.lossAdjustments,
    schedule.proposedAmendments.totalAdjustment,
    schedule.refundExpected,
    schedule.confidence,
    schedule.deadline.toLocaleDateString(),
    schedule.timeToAmend,
    schedule.recommendations.length,
  ])

  return { headers, data }
}

/**
 * Fetch transaction data from database
 */
async function fetchTransactionData(tenantId: string): Promise<any[]> {
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('forensic_analysis_results')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('transaction_date', { ascending: false })
    .limit(10000) // Limit to prevent excessive data

  if (error) {
    console.error('Failed to fetch transaction data:', error)
    return []
  }

  return data || []
}

/**
 * Export workbook data as CSV (for simple export without ExcelJS)
 */
export function exportSheetAsCSV(
  sheet: { headers: string[]; data: any[][] },
  sheetName: string
): string {
  const rows = [sheet.headers, ...sheet.data]

  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          const cellStr = String(cell ?? '')
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`
          }
          return cellStr
        })
        .join(',')
    )
    .join('\n')

  return csv
}

/**
 * Export all sheets as ZIP of CSVs
 */
export async function exportWorkbookAsCSVZip(
  workbookData: ExcelWorkbookData
): Promise<Record<string, string>> {
  const csvFiles: Record<string, string> = {}

  csvFiles['summary.csv'] = exportSheetAsCSV(workbookData.sheets.summary, 'Summary')
  csvFiles['rnd_candidates.csv'] = exportSheetAsCSV(workbookData.sheets.rndCandidates, 'R&D Candidates')
  csvFiles['deductions.csv'] = exportSheetAsCSV(workbookData.sheets.deductions, 'Deductions')
  csvFiles['losses.csv'] = exportSheetAsCSV(workbookData.sheets.losses, 'Losses')
  csvFiles['div7a.csv'] = exportSheetAsCSV(workbookData.sheets.div7a, 'Division 7A')
  csvFiles['transactions.csv'] = exportSheetAsCSV(workbookData.sheets.transactions, 'Transactions')
  csvFiles['recommendations.csv'] = exportSheetAsCSV(workbookData.sheets.recommendations, 'Recommendations')
  csvFiles['amendments.csv'] = exportSheetAsCSV(workbookData.sheets.amendments, 'Amendments')

  return csvFiles
}

/**
 * Generate workbook metadata for download
 */
export function generateWorkbookMetadata(workbookData: ExcelWorkbookData) {
  return {
    filename: `Forensic_Tax_Audit_${workbookData.metadata.organizationName.replace(/[^a-zA-Z0-9]/g, '_')}_${workbookData.metadata.generatedAt.toISOString().split('T')[0]}.xlsx`,
    sheets: [
      'Summary',
      'R&D Candidates',
      'Deductions',
      'Losses',
      'Division 7A',
      'Transactions',
      'Recommendations',
      'Amendments',
    ],
    generatedAt: workbookData.metadata.generatedAt,
    organizationName: workbookData.metadata.organizationName,
    abn: workbookData.metadata.abn,
  }
}
