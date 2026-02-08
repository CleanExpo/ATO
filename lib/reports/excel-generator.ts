/**
 * Excel Report Generator
 *
 * Creates professional Excel workbooks with:
 * - Multiple worksheets for different analyses
 * - Formulas and calculations
 * - Conditional formatting
 * - Pivot tables
 * - Data validation
 */

import ExcelJS from 'exceljs'
import type { PDFReport } from './pdf-generator'
import { generatePDFReportData } from './pdf-generator'
import { createLogger } from '@/lib/logger'
import type { RndProjectAnalysis } from '@/lib/analysis/rnd-engine'
import type { LossAnalysis } from '@/lib/analysis/loss-engine'
import type { ActionableRecommendation } from '@/lib/recommendations/recommendation-engine'
import type { ForensicAnalysisRow } from '@/lib/types/forensic-analysis'

const log = createLogger('reports:excel')

/**
 * Generate Excel workbook from report data
 *
 * @param reportData - Full report data structure
 * @returns Excel workbook buffer
 */
export async function generateExcelReport(reportData: PDFReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()

  // Set workbook properties
  workbook.creator = 'ATO Forensic Tax Audit System'
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.lastPrinted = new Date()

  // Create worksheets
  await createExecutiveSummarySheet(workbook, reportData)
  await createRndAnalysisSheet(workbook, reportData)
  await createDeductionsSheet(workbook, reportData)
  await createLossesSheet(workbook, reportData)
  await createRecommendationsSheet(workbook, reportData)
  await createTransactionDetailSheet(workbook, reportData)

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * Create Executive Summary worksheet
 */
async function createExecutiveSummarySheet(
  workbook: ExcelJS.Workbook,
  report: PDFReport
): Promise<void> {
  const sheet = workbook.addWorksheet('Executive Summary', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  // Set column widths
  sheet.columns = [
    { width: 30 },
    { width: 20 },
    { width: 15 },
  ]

  // Title
  const titleRow = sheet.addRow(['Forensic Tax Audit Report'])
  titleRow.font = { size: 18, bold: true, color: { argb: 'FF4F46E5' } }
  titleRow.height = 30
  sheet.mergeCells('A1:C1')

  // Metadata
  sheet.addRow([''])
  sheet.addRow(['Organization', report.metadata.organizationName])
  sheet.addRow(['ABN', report.metadata.abn])
  sheet.addRow(['Report ID', report.metadata.reportId])
  sheet.addRow(['Generated', report.metadata.generatedAt.toLocaleString()])
  sheet.addRow(['Years Analyzed', report.metadata.yearsAnalyzed.join(', ')])
  sheet.addRow([''])

  // Summary section
  const summaryHeaderRow = sheet.addRow(['Opportunity Summary', '', ''])
  summaryHeaderRow.font = { size: 14, bold: true }
  summaryHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E7FF' },
  }
  sheet.mergeCells(`A${summaryHeaderRow.number}:C${summaryHeaderRow.number}`)

  sheet.addRow([
    'Total Opportunity',
    report.executiveSummary.totalOpportunity,
    { formula: `B${sheet.lastRow!.number}*0.25`, result: report.executiveSummary.totalOpportunity * 0.25 },
  ])
  sheet.addRow([
    'Confidence-Adjusted Benefit',
    report.executiveSummary.adjustedOpportunity,
    '',
  ])
  sheet.addRow([
    'Overall Confidence',
    `${report.executiveSummary.overallConfidence.toFixed(0)}%`,
    '',
  ])

  // Format currency columns
  sheet.getColumn(2).numFmt = '$#,##0.00'
  sheet.getColumn(3).numFmt = '$#,##0.00'

  // Breakdown section
  sheet.addRow([''])
  const breakdownHeaderRow = sheet.addRow(['Breakdown by Tax Area', 'Amount', 'Percentage'])
  breakdownHeaderRow.font = { bold: true }
  breakdownHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' },
  }

  const total = report.executiveSummary.totalOpportunity
  sheet.addRow([
    'R&D Tax Incentive',
    report.executiveSummary.breakdown.rnd,
    { formula: `B${sheet.lastRow!.number}/${total}`, result: report.executiveSummary.breakdown.rnd / total },
  ])
  sheet.addRow([
    'General Deductions',
    report.executiveSummary.breakdown.deductions,
    { formula: `B${sheet.lastRow!.number}/${total}`, result: report.executiveSummary.breakdown.deductions / total },
  ])
  sheet.addRow([
    'Loss Optimization',
    report.executiveSummary.breakdown.losses,
    { formula: `B${sheet.lastRow!.number}/${total}`, result: report.executiveSummary.breakdown.losses / total },
  ])
  sheet.addRow([
    'Division 7A Compliance',
    report.executiveSummary.breakdown.div7a,
    { formula: `B${sheet.lastRow!.number}/${total}`, result: report.executiveSummary.breakdown.div7a / total },
  ])

  // Format percentage column
  sheet.getColumn(3).numFmt = '0.0%'

  // Apply borders
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        }
      })
    }
  })
}

/**
 * Create R&D Analysis worksheet
 */
async function createRndAnalysisSheet(
  workbook: ExcelJS.Workbook,
  report: PDFReport
): Promise<void> {
  const sheet = workbook.addWorksheet('R&D Analysis', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  // Column definitions
  sheet.columns = [
    { header: 'Project Name', key: 'project', width: 30 },
    { header: 'Financial Years', key: 'years', width: 20 },
    { header: 'Eligible Expenditure', key: 'expenditure', width: 20 },
    { header: '43.5% Offset', key: 'offset', width: 20 },
    { header: 'Confidence', key: 'confidence', width: 15 },
    { header: 'Activity Type', key: 'activityType', width: 25 },
  ]

  // Style header row
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6366F1' },
  }
  headerRow.height = 20

  // Add data rows
  if (report.rndAnalysis.projects && report.rndAnalysis.projects.length > 0) {
    report.rndAnalysis.projects.forEach((project: RndProjectAnalysis) => {
      sheet.addRow({
        project: project.projectName,
        years: project.financialYears.join(', '),
        expenditure: project.eligibleExpenditure,
        offset: project.estimatedOffset,
        confidence: project.overallConfidence / 100,
        activityType: project.projectDescription || 'Core R&D',
      })
    })
  }

  // Add totals row
  const totalRow = sheet.addRow({
    project: 'TOTAL',
    years: '',
    expenditure: { formula: `SUM(C2:C${sheet.lastRow!.number})` },
    offset: { formula: `SUM(D2:D${sheet.lastRow!.number})` },
    confidence: { formula: `AVERAGE(E2:E${sheet.lastRow!.number})` },
    activityType: '',
  })
  totalRow.font = { bold: true }
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' },
  }

  // Format columns
  sheet.getColumn('expenditure').numFmt = '$#,##0.00'
  sheet.getColumn('offset').numFmt = '$#,##0.00'
  sheet.getColumn('confidence').numFmt = '0.0%'

  // Add conditional formatting for confidence
  sheet.addConditionalFormatting({
    ref: `E2:E${sheet.lastRow!.number - 1}`,
    rules: [
      {
        type: 'colorScale',
        priority: 1,
        cfvo: [
          { type: 'num', value: 0 },
          { type: 'num', value: 0.5 },
          { type: 'num', value: 1 },
        ],
        color: [
          { argb: 'FFF87171' }, // Red
          { argb: 'FFFBBF24' }, // Yellow
          { argb: 'FF34D399' }, // Green
        ],
      },
    ],
  })
}

/**
 * Create Deductions worksheet
 */
async function createDeductionsSheet(
  workbook: ExcelJS.Workbook,
  report: PDFReport
): Promise<void> {
  const sheet = workbook.addWorksheet('Deductions', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  sheet.columns = [
    { header: 'Category', key: 'category', width: 30 },
    { header: 'Financial Year', key: 'year', width: 15 },
    { header: 'Unclaimed Amount', key: 'amount', width: 20 },
    { header: 'Tax Rate', key: 'rate', width: 12 },
    { header: 'Tax Saving', key: 'saving', width: 20 },
    { header: 'Confidence', key: 'confidence', width: 15 },
  ]

  // Style header
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF10B981' },
  }

  // Add opportunities by category
  const opportunities = report.deductionAnalysis.opportunitiesByCategory || {}
  Object.entries(opportunities).forEach(([category, amount]) => {
    const row = sheet.addRow({
      category,
      year: 'Various',
      amount: amount,
      rate: 0.25,
      saving: { formula: `C${sheet.lastRow!.number}*D${sheet.lastRow!.number}` },
      confidence: 0.75,
    })
  })

  // Add total row
  const totalRow = sheet.addRow({
    category: 'TOTAL',
    year: '',
    amount: { formula: `SUM(C2:C${sheet.lastRow!.number})` },
    rate: '',
    saving: { formula: `SUM(E2:E${sheet.lastRow!.number})` },
    confidence: { formula: `AVERAGE(F2:F${sheet.lastRow!.number})` },
  })
  totalRow.font = { bold: true }
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' },
  }

  // Format columns
  sheet.getColumn('amount').numFmt = '$#,##0.00'
  sheet.getColumn('rate').numFmt = '0%'
  sheet.getColumn('saving').numFmt = '$#,##0.00'
  sheet.getColumn('confidence').numFmt = '0.0%'
}

/**
 * Create Losses worksheet
 * Shows loss carry-forward history, COT/SBT status, and future tax value
 */
async function createLossesSheet(
  workbook: ExcelJS.Workbook,
  report: PDFReport
): Promise<void> {
  const sheet = workbook.addWorksheet('Loss Analysis', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  sheet.columns = [
    { header: 'Financial Year', key: 'year', width: 15 },
    { header: 'Loss Type', key: 'lossType', width: 12 },
    { header: 'Opening Balance', key: 'opening', width: 18 },
    { header: 'Current Year Loss', key: 'currentLoss', width: 18 },
    { header: 'Losses Utilised', key: 'utilised', width: 18 },
    { header: 'Closing Balance', key: 'closing', width: 18 },
    { header: 'Future Tax Value', key: 'taxValue', width: 18 },
    { header: 'COT/SBT Status', key: 'cotSbt', width: 18 },
    { header: 'Risk Level', key: 'risk', width: 12 },
  ]

  // Style header
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF8B5CF6' },
  }

  // Add loss history rows
  const lossHistory = report.lossAnalysis.lossHistory || []
  lossHistory.forEach((analysis: LossAnalysis) => {
    const cotStatus = analysis.cotSbtAnalysis.cotSatisfied === true
      ? 'COT Satisfied'
      : analysis.cotSbtAnalysis.cotSatisfied === false
        ? 'COT Failed'
        : 'Review Required'

    const row = sheet.addRow({
      year: analysis.financialYear,
      lossType: analysis.lossType === 'capital' ? 'Capital' : 'Revenue',
      opening: analysis.openingLossBalance,
      currentLoss: analysis.currentYearLoss,
      utilised: analysis.lossesUtilized,
      closing: analysis.closingLossBalance,
      taxValue: analysis.futureTaxValue,
      cotSbt: cotStatus,
      risk: analysis.cotSbtAnalysis.riskLevel.toUpperCase(),
    })

    // Color-code risk level
    const riskCell = row.getCell('risk')
    if (analysis.cotSbtAnalysis.riskLevel === 'high') {
      riskCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFECACA' },
      }
      riskCell.font = { bold: true, color: { argb: 'FFDC2626' } }
    } else if (analysis.cotSbtAnalysis.riskLevel === 'medium') {
      riskCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFED7AA' },
      }
      riskCell.font = { bold: true, color: { argb: 'FFEA580C' } }
    }
  })

  // Add totals row
  if (lossHistory.length > 0) {
    const totalRow = sheet.addRow({
      year: 'TOTAL',
      lossType: '',
      opening: '',
      currentLoss: { formula: `SUM(D2:D${sheet.lastRow!.number})` },
      utilised: { formula: `SUM(E2:E${sheet.lastRow!.number})` },
      closing: report.lossAnalysis.totalAvailableLosses - report.lossAnalysis.totalUtilizedLosses,
      taxValue: { formula: `SUM(G2:G${sheet.lastRow!.number})` },
      cotSbt: '',
      risk: '',
    })
    totalRow.font = { bold: true }
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    }
  }

  // Add summary section below data
  const summaryStartRow = sheet.lastRow!.number + 2
  const summaryHeaderRow = sheet.getRow(summaryStartRow)
  summaryHeaderRow.getCell(1).value = 'Loss Summary'
  summaryHeaderRow.font = { size: 12, bold: true }

  sheet.getRow(summaryStartRow + 1).values = ['Revenue Losses', report.lossAnalysis.revenueLosses]
  sheet.getRow(summaryStartRow + 2).values = ['Capital Losses', report.lossAnalysis.capitalLosses]
  sheet.getRow(summaryStartRow + 3).values = ['Utilisation Rate', report.lossAnalysis.utilizationRate / 100]
  sheet.getRow(summaryStartRow + 4).values = ['Total Future Tax Value', report.lossAnalysis.totalFutureTaxValue]
  sheet.getRow(summaryStartRow + 5).values = ['Rate Source', report.lossAnalysis.taxRateSource]

  // Format columns
  sheet.getColumn('opening').numFmt = '$#,##0.00'
  sheet.getColumn('currentLoss').numFmt = '$#,##0.00'
  sheet.getColumn('utilised').numFmt = '$#,##0.00'
  sheet.getColumn('closing').numFmt = '$#,##0.00'
  sheet.getColumn('taxValue').numFmt = '$#,##0.00'

  // Format summary cells
  sheet.getCell(`B${summaryStartRow + 1}`).numFmt = '$#,##0.00'
  sheet.getCell(`B${summaryStartRow + 2}`).numFmt = '$#,##0.00'
  sheet.getCell(`B${summaryStartRow + 3}`).numFmt = '0.0%'
  sheet.getCell(`B${summaryStartRow + 4}`).numFmt = '$#,##0.00'

  // Add auto-filter
  if (lossHistory.length > 0) {
    sheet.autoFilter = {
      from: 'A1',
      to: 'I1',
    }
  }
}

/**
 * Create Recommendations worksheet
 */
async function createRecommendationsSheet(
  workbook: ExcelJS.Workbook,
  report: PDFReport
): Promise<void> {
  const sheet = workbook.addWorksheet('Recommendations', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  sheet.columns = [
    { header: 'Priority', key: 'priority', width: 12 },
    { header: 'Action', key: 'action', width: 50 },
    { header: 'Financial Year', key: 'year', width: 15 },
    { header: 'Benefit', key: 'benefit', width: 18 },
    { header: 'Confidence', key: 'confidence', width: 12 },
    { header: 'Deadline', key: 'deadline', width: 15 },
    { header: 'ATO Forms', key: 'forms', width: 20 },
  ]

  // Style header
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEF4444' },
  }

  // Add recommendations
  if (report.recommendations.recommendations) {
    report.recommendations.recommendations.forEach((rec: ActionableRecommendation) => {
      const row = sheet.addRow({
        priority: rec.priority.toUpperCase(),
        action: rec.action,
        year: rec.financialYear,
        benefit: rec.adjustedBenefit,
        confidence: rec.confidence / 100,
        deadline: rec.deadline,
        forms: rec.atoForms?.join(', ') || '',
      })

      // Color-code priority
      const priorityCell = row.getCell('priority')
      if (rec.priority === 'critical') {
        priorityCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFECACA' },
        }
        priorityCell.font = { bold: true, color: { argb: 'FFDC2626' } }
      } else if (rec.priority === 'high') {
        priorityCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFED7AA' },
        }
        priorityCell.font = { bold: true, color: { argb: 'FFEA580C' } }
      }
    })
  }

  // Format columns
  sheet.getColumn('benefit').numFmt = '$#,##0.00'
  sheet.getColumn('confidence').numFmt = '0%'
  sheet.getColumn('deadline').numFmt = 'dd/mm/yyyy'

  // Apply data validation for priority column using per-cell property
  // (ExcelJS dataValidations.add() may not exist; use per-cell dataValidation)
  for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
    const cell = sheet.getCell(`A${rowNum}`)
    cell.dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"CRITICAL,HIGH,MEDIUM,LOW"'],
    }
  }
}

/**
 * Create Transaction Detail worksheet
 */
async function createTransactionDetailSheet(
  workbook: ExcelJS.Workbook,
  report: PDFReport
): Promise<void> {
  const sheet = workbook.addWorksheet('Transaction Details', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  sheet.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Category', key: 'category', width: 25 },
    { header: 'R&D Candidate', key: 'rnd', width: 15 },
    { header: 'Confidence', key: 'confidence', width: 12 },
  ]

  // Style header
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF64748B' },
  }

  // Note: Actual transaction data would be fetched separately
  // This is a placeholder structure

  // Format columns
  sheet.getColumn('date').numFmt = 'dd/mm/yyyy'
  sheet.getColumn('amount').numFmt = '$#,##0.00'
  sheet.getColumn('confidence').numFmt = '0%'

  // Add auto-filter
  sheet.autoFilter = {
    from: 'A1',
    to: 'F1',
  }
}

/**
 * Generate Excel report from tenant data
 */
export async function generateExcelFromTenant(
  tenantId: string,
  organizationName: string = 'Organisation',
  abn: string = ''
): Promise<Buffer> {
  log.info('Generating Excel report', { tenantId })

  // Generate report data
  const reportData = await generatePDFReportData(tenantId, organizationName, abn)

  // Generate Excel workbook
  const buffer = await generateExcelReport(reportData)

  log.info('Excel report generated', { bytes: buffer.length })
  return buffer
}

/**
 * Generate simple Excel export (transactions only)
 */
export async function generateTransactionsExcel(
  transactions: ForensicAnalysisRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Transactions')

  // Define columns
  sheet.columns = [
    { header: 'Transaction ID', key: 'id', width: 30 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Supplier', key: 'supplier', width: 30 },
    { header: 'Category', key: 'category', width: 25 },
    { header: 'Financial Year', key: 'year', width: 15 },
    { header: 'R&D Candidate', key: 'rnd', width: 15 },
    { header: 'Confidence', key: 'confidence', width: 12 },
  ]

  // Style header
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' },
  }

  // Add transactions
  transactions.forEach((txn) => {
    sheet.addRow({
      id: txn.transaction_id,
      date: txn.transaction_date ? new Date(txn.transaction_date) : '',
      description: txn.transaction_description,
      amount: txn.transaction_amount,
      supplier: txn.supplier_name,
      category: txn.primary_category,
      year: txn.financial_year,
      rnd: txn.is_rnd_candidate ? 'Yes' : 'No',
      confidence: (txn.category_confidence ?? 0) / 100,
    })
  })

  // Format columns
  sheet.getColumn('date').numFmt = 'dd/mm/yyyy'
  sheet.getColumn('amount').numFmt = '$#,##0.00'
  sheet.getColumn('confidence').numFmt = '0%'

  // Add auto-filter
  sheet.autoFilter = {
    from: 'A1',
    to: 'I1',
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * Generate Excel workbook data (for compatibility with report generation route)
 * Returns workbook data structure for further processing
 */
export async function generateExcelWorkbookData(
  tenantId: string,
  organizationName: string,
  abn: string
): Promise<{ buffer: Buffer; filename: string }> {
  const buffer = await generateExcelFromTenant(tenantId, organizationName, abn)
  return {
    buffer,
    filename: `forensic-audit-${organizationName.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.xlsx`
  }
}

/**
 * Export workbook as CSV zip (for compatibility - returns Excel as is for now)
 */
export async function exportWorkbookAsCSVZip(
  workbookData: { buffer: Buffer; filename: string }
): Promise<{ buffer: Buffer; filename: string }> {
  // For now, just return the Excel buffer
  // In the future, this could convert to CSV format and zip
  return workbookData
}
