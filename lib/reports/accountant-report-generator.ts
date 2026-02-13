/**
 * Accountant Report Generator
 *
 * Creates Excel reports from accountant findings with:
 * - Summary sheet: Org details, totals by area, confidence metrics
 * - Findings Detail sheet: Row per finding with all metadata
 * - Legislation References sheet: Deduplicated references
 */

import ExcelJS from 'exceljs'
import type { SupabaseClient } from '@supabase/supabase-js'

type WorkflowAreaId = 'sundries' | 'deductions' | 'fbt' | 'div7a' | 'documents' | 'reconciliation'

interface AccountantReportOptions {
  organizationId: string
  tenantId: string
  workflowAreas?: WorkflowAreaId[]
  statuses?: string[]
  financialYear?: string
  organizationName?: string
  abn?: string
}

interface FindingRow {
  id: string
  workflow_area: string
  transaction_id: string
  transaction_date: string
  description: string
  amount: number
  current_classification: string | null
  suggested_classification: string | null
  suggested_action: string | null
  confidence_score: number
  confidence_level: string
  legislation_refs: Array<{ section: string; title: string; url: string }> | null
  reasoning: string
  financial_year: string
  estimated_benefit: number | null
  status: string
  rejection_reason: string | null
  accountant_notes: string | null
  created_at: string
}

interface AreaSummary {
  area: string
  count: number
  totalBenefit: number
  avgConfidence: number
}

/**
 * Query accountant_findings with filters and generate report data
 */
export async function generateAccountantReportData(
  supabase: SupabaseClient,
  options: AccountantReportOptions
): Promise<FindingRow[]> {
  let query = supabase
    .from('accountant_findings')
    .select('*')
    .eq('tenant_id', options.tenantId)

  if (options.workflowAreas && options.workflowAreas.length > 0) {
    query = query.in('workflow_area', options.workflowAreas)
  }

  if (options.statuses && options.statuses.length > 0) {
    query = query.in('status', options.statuses)
  }

  if (options.financialYear) {
    query = query.eq('financial_year', options.financialYear)
  }

  query = query.order('workflow_area').order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch findings: ${error.message}`)
  }

  return (data || []) as FindingRow[]
}

/**
 * Generate an Excel workbook from accountant findings
 */
export async function generateAccountantExcel(
  findings: FindingRow[],
  options: AccountantReportOptions
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ATO Accountant Workflow System'
  workbook.created = new Date()
  workbook.modified = new Date()

  await createSummarySheet(workbook, findings, options)
  await createFindingsDetailSheet(workbook, findings)
  await createLegislationSheet(workbook, findings)

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

const AREA_LABELS: Record<string, string> = {
  sundries: 'Sundries',
  deductions: 'Deductions (Section 8-1)',
  fbt: 'Fringe Benefits Tax',
  div7a: 'Division 7A',
  documents: 'Source Documents',
  reconciliation: 'Reconciliation',
}

/**
 * Summary sheet with organisation details and area breakdowns
 */
async function createSummarySheet(
  workbook: ExcelJS.Workbook,
  findings: FindingRow[],
  options: AccountantReportOptions
): Promise<void> {
  const sheet = workbook.addWorksheet('Summary', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  sheet.columns = [
    { width: 35 },
    { width: 20 },
    { width: 20 },
    { width: 15 },
  ]

  // Title
  const titleRow = sheet.addRow(['Accountant Workflow Report'])
  titleRow.font = { size: 18, bold: true, color: { argb: 'FF4F46E5' } }
  titleRow.height = 30
  sheet.mergeCells('A1:D1')

  // Metadata
  sheet.addRow([''])
  sheet.addRow(['Organisation', options.organizationName || 'N/A'])
  if (options.abn) sheet.addRow(['ABN', options.abn])
  sheet.addRow(['Generated', new Date().toLocaleString('en-AU')])
  sheet.addRow(['Financial Year', options.financialYear || 'All'])
  sheet.addRow(['Statuses Included', (options.statuses || ['approved']).join(', ')])
  sheet.addRow([''])

  // Area breakdown
  const areaHeader = sheet.addRow(['Workflow Area', 'Findings', 'Est. Benefit', 'Avg Confidence'])
  areaHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  areaHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6366F1' },
  }

  const areaSummaries: AreaSummary[] = []
  const areas = ['sundries', 'deductions', 'fbt', 'div7a', 'documents', 'reconciliation']

  for (const area of areas) {
    const areaFindings = findings.filter((f) => f.workflow_area === area)
    if (areaFindings.length === 0) continue

    const totalBenefit = areaFindings.reduce((s, f) => s + (f.estimated_benefit ?? 0), 0)
    const avgConf = areaFindings.reduce((s, f) => s + f.confidence_score, 0) / areaFindings.length

    areaSummaries.push({
      area: AREA_LABELS[area] || area,
      count: areaFindings.length,
      totalBenefit,
      avgConfidence: Math.round(avgConf),
    })

    sheet.addRow([
      AREA_LABELS[area] || area,
      areaFindings.length,
      totalBenefit,
      avgConf / 100,
    ])
  }

  // Totals
  const totalBenefit = findings.reduce((s, f) => s + (f.estimated_benefit ?? 0), 0)
  const avgConfidence = findings.length > 0
    ? findings.reduce((s, f) => s + f.confidence_score, 0) / findings.length
    : 0

  const totalRow = sheet.addRow([
    'TOTAL',
    findings.length,
    totalBenefit,
    avgConfidence / 100,
  ])
  totalRow.font = { bold: true }
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' },
  }

  // Format columns
  sheet.getColumn(3).numFmt = '$#,##0.00'
  sheet.getColumn(4).numFmt = '0%'

  // Disclaimer
  sheet.addRow([''])
  sheet.addRow([''])
  const disclaimerRow = sheet.addRow([
    'DISCLAIMER: This report is generated by automated software and does not constitute tax, financial, or legal advice. ' +
    'All findings should be reviewed by a registered tax agent before any action is taken.',
  ])
  disclaimerRow.font = { size: 9, italic: true, color: { argb: 'FF999999' } }
  sheet.mergeCells(`A${disclaimerRow.number}:D${disclaimerRow.number}`)
}

/**
 * Findings Detail sheet - one row per finding
 */
async function createFindingsDetailSheet(
  workbook: ExcelJS.Workbook,
  findings: FindingRow[]
): Promise<void> {
  const sheet = workbook.addWorksheet('Findings Detail', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  sheet.columns = [
    { header: 'Workflow Area', key: 'area', width: 20 },
    { header: 'Transaction ID', key: 'txnId', width: 18 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Est. Benefit', key: 'benefit', width: 15 },
    { header: 'Confidence', key: 'confidence', width: 12 },
    { header: 'Level', key: 'level', width: 10 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Suggestion', key: 'suggestion', width: 35 },
    { header: 'Legislation', key: 'legislation', width: 30 },
    { header: 'FY', key: 'fy', width: 12 },
    { header: 'Rejection Reason', key: 'reason', width: 25 },
    { header: 'Notes', key: 'notes', width: 25 },
  ]

  // Style header
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF10B981' },
  }
  headerRow.height = 20

  // Add data rows
  for (const f of findings) {
    const refs = f.legislation_refs || []
    const legText = refs.map((r) => r.section).join('; ')
    const suggestion = f.suggested_classification || f.suggested_action || ''

    const row = sheet.addRow({
      area: AREA_LABELS[f.workflow_area] || f.workflow_area,
      txnId: f.transaction_id,
      date: f.transaction_date ? new Date(f.transaction_date) : '',
      description: f.description,
      amount: f.amount,
      benefit: f.estimated_benefit ?? 0,
      confidence: f.confidence_score / 100,
      level: f.confidence_level,
      status: f.status.charAt(0).toUpperCase() + f.status.slice(1),
      suggestion,
      legislation: legText,
      fy: f.financial_year,
      reason: f.rejection_reason || '',
      notes: f.accountant_notes || '',
    })

    // Colour-code status
    const statusCell = row.getCell('status')
    if (f.status === 'approved') {
      statusCell.font = { color: { argb: 'FF16A34A' } }
    } else if (f.status === 'rejected') {
      statusCell.font = { color: { argb: 'FFDC2626' } }
    } else if (f.status === 'deferred') {
      statusCell.font = { color: { argb: 'FFCA8A04' } }
    }
  }

  // Format columns
  sheet.getColumn('date').numFmt = 'dd/mm/yyyy'
  sheet.getColumn('amount').numFmt = '$#,##0.00'
  sheet.getColumn('benefit').numFmt = '$#,##0.00'
  sheet.getColumn('confidence').numFmt = '0%'

  // Auto-filter
  if (findings.length > 0) {
    sheet.autoFilter = { from: 'A1', to: 'N1' }
  }
}

/**
 * Legislation References sheet - deduplicated
 */
async function createLegislationSheet(
  workbook: ExcelJS.Workbook,
  findings: FindingRow[]
): Promise<void> {
  const sheet = workbook.addWorksheet('Legislation References', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  sheet.columns = [
    { header: 'Section', key: 'section', width: 25 },
    { header: 'Title', key: 'title', width: 50 },
    { header: 'URL', key: 'url', width: 60 },
    { header: 'Referenced By', key: 'count', width: 15 },
  ]

  // Style header
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF8B5CF6' },
  }

  // Deduplicate legislation references
  const refMap = new Map<string, { section: string; title: string; url: string; count: number }>()
  for (const f of findings) {
    const refs = f.legislation_refs || []
    for (const ref of refs) {
      const key = ref.section
      const existing = refMap.get(key)
      if (existing) {
        existing.count++
      } else {
        refMap.set(key, { section: ref.section, title: ref.title, url: ref.url, count: 1 })
      }
    }
  }

  // Sort by count desc
  const sortedRefs = Array.from(refMap.values()).sort((a, b) => b.count - a.count)

  for (const ref of sortedRefs) {
    sheet.addRow({
      section: ref.section,
      title: ref.title,
      url: ref.url,
      count: ref.count,
    })
  }
}
