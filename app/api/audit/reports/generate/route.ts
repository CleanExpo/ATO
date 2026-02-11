/**
 * POST /api/audit/reports/generate
 *
 * Generate forensic audit reports in multiple formats.
 *
 * Request Body:
 * {
 *   "tenantId": string (required)
 *   "format": "pdf" | "excel" | "amendments" | "all" (required)
 *   "organizationName": string (required)
 *   "abn": string (required)
 * }
 *
 * Response:
 * {
 *   "reportId": string
 *   "format": string
 *   "status": "generating" | "complete" | "error"
 *   "downloadUrl"?: string (when complete)
 *   "estimatedTime": string
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { generatePDFReportData, generatePDFReportHTML } from '@/lib/reports/pdf-generator'
import { generateExcelWorkbookData, exportWorkbookAsCSVZip } from '@/lib/reports/excel-generator'
import { generateAmendmentSchedules, generateAmendmentSummaryText } from '@/lib/reports/amendment-schedules'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const log = createLogger('api:audit:reports:generate')

export async function POST(request: NextRequest) {
  try {
    // Authenticate and validate tenant access (tenantId from body)
    const auth = await requireAuth(request, { tenantIdSource: 'body' })
    if (isErrorResponse(auth)) return auth

    const { tenantId } = auth
    const body = await request.json()
    const { format, organizationName, abn } = body

    if (!format) {
      return createValidationError('format is required')
    }

    if (!organizationName) {
      return createValidationError('organizationName is required')
    }

    if (!abn) {
      return createValidationError('abn is required')
    }

    const validFormats = ['pdf', 'excel', 'amendments', 'all']
    if (!validFormats.includes(format)) {
      return createValidationError(`Invalid format. Must be one of: ${validFormats.join(', ')}`)
    }

    log.info('Generating report', { format, tenantId })

    const reportId = `REPORT-${Date.now()}`

    // Generate based on format
    let reportData: unknown
    let estimatedTime = '30 seconds'

    switch (format) {
      case 'pdf':
        reportData = await generatePDFReport(tenantId, organizationName, abn)
        estimatedTime = '30 seconds'
        break

      case 'excel':
        reportData = await generateExcelReport(tenantId, organizationName, abn)
        estimatedTime = '1 minute'
        break

      case 'amendments':
        reportData = await generateAmendmentsReport(tenantId)
        estimatedTime = '15 seconds'
        break

      case 'all':
        reportData = await generateAllReports(tenantId, organizationName, abn)
        estimatedTime = '2 minutes'
        break

      default:
        return createValidationError('Unsupported format')
    }

    // In a full implementation, this would:
    // 1. Start background job to generate report
    // 2. Store report in file storage (Vercel Blob, S3, etc.)
    // 3. Return download URL when complete

    // For now, return report data directly
    return NextResponse.json({
      reportId,
      format,
      status: 'complete',
      estimatedTime,
      data: reportData,
      message: 'Report generated successfully',
    })
  } catch (error) {
    console.error('Failed to generate report:', error)
    return createErrorResponse(error, { operation: 'generateReport' }, 500)
  }
}

/**
 * Generate PDF report
 */
async function generatePDFReport(tenantId: string, organizationName: string, abn: string) {
  const reportData = await generatePDFReportData(tenantId, organizationName, abn)
  const html = await generatePDFReportHTML(reportData)

  return {
    type: 'pdf',
    reportData,
    html,
    filename: `Forensic_Tax_Audit_${organizationName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
  }
}

/**
 * Generate Excel report
 */
async function generateExcelReport(tenantId: string, organizationName: string, abn: string) {
  const workbookData = await generateExcelWorkbookData(tenantId, organizationName, abn)
  const csvFiles = await exportWorkbookAsCSVZip(workbookData)

  return {
    type: 'excel',
    workbookData,
    csvFiles,
    filename: `Forensic_Tax_Audit_${organizationName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`,
  }
}

/**
 * Generate amendment schedules report
 */
async function generateAmendmentsReport(tenantId: string) {
  const amendmentSummary = await generateAmendmentSchedules(tenantId)
  const summaryText = generateAmendmentSummaryText(amendmentSummary)

  return {
    type: 'amendments',
    amendmentSummary,
    summaryText,
    filename: `Amendment_Schedules_${new Date().toISOString().split('T')[0]}.json`,
  }
}

/**
 * Generate all reports
 */
async function generateAllReports(tenantId: string, organizationName: string, abn: string) {
  const [pdfReport, excelReport, amendmentsReport] = await Promise.all([
    generatePDFReport(tenantId, organizationName, abn),
    generateExcelReport(tenantId, organizationName, abn),
    generateAmendmentsReport(tenantId),
  ])

  return {
    pdf: pdfReport,
    excel: excelReport,
    amendments: amendmentsReport,
  }
}
