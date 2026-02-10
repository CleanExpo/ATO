/**
 * POST /api/reports/generate
 *
 * Generate PDF and/or Excel reports and optionally email them.
 *
 * Body:
 * - tenantId: string (required)
 * - organizationName: string (required)
 * - abn: string (required)
 * - format: 'pdf' | 'excel' | 'both' (default: 'both')
 * - emailTo?: string (optional - if provided, email report)
 * - clientFriendly?: boolean (optional - simplified PDF for clients)
 *
 * Response:
 * - reportId: string
 * - pdfUrl?: string (if format includes PDF)
 * - excelUrl?: string (if format includes Excel)
 * - emailSent?: boolean
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { createServiceClient } from '@/lib/supabase/server'
import { generatePDFReportData, generatePDFReportHTML } from '@/lib/reports/pdf-generator'
import { generateExcelFromTenant } from '@/lib/reports/excel-generator'
import { sendForensicReport } from '@/lib/reports/email-delivery'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:reports:generate')

const generateReportSchema = z.object({
  tenantId: z.string().uuid(),
  organizationName: z.string().min(1),
  abn: z.string().regex(/^\d{11}$/, 'ABN must be 11 digits'),
  format: z.enum(['pdf', 'excel', 'both']).default('both'),
  emailTo: z.string().email().optional(),
  clientFriendly: z.boolean().default(false),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request
    const validation = generateReportSchema.safeParse(body)
    if (!validation.success) {
      return createValidationError(
        validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
      )
    }

    const { tenantId, organizationName, abn, format, emailTo, clientFriendly } = validation.data

    log.info('Generating report', { format, organizationName, tenantId, emailTo })

    const supabase = await createServiceClient()
    let pdfBuffer: Buffer | null = null
    let excelBuffer: Buffer | null = null

    // Generate PDF (as HTML for serverless compatibility - use browser Print > Save as PDF)
    if (format === 'pdf' || format === 'both') {
      const reportData = await generatePDFReportData(tenantId, organizationName, abn)
      const html = await generatePDFReportHTML(reportData)
      pdfBuffer = Buffer.from(html, 'utf-8')
      log.info('Report HTML generated', { bytes: pdfBuffer.length })
    }

    // Generate Excel if requested
    if (format === 'excel' || format === 'both') {
      excelBuffer = await generateExcelFromTenant(tenantId, organizationName, abn)
      log.info('Excel generated', { bytes: excelBuffer.length })
    }

    // Generate report ID
    const reportId = `REP-${Date.now()}-${tenantId.substring(0, 8)}`

    // Upload to Supabase Storage
    const uploadPromises: Promise<{ data: { path: string } | null; error: { message: string } | null }>[] = []
    let pdfUrl: string | undefined
    let excelUrl: string | undefined

    if (pdfBuffer) {
      const pdfPath = `reports/${tenantId}/${reportId}.html`
      uploadPromises.push(
        supabase.storage.from('reports').upload(pdfPath, pdfBuffer, {
          contentType: 'text/html',
          upsert: true,
        })
      )
      pdfUrl = `/api/reports/download/${reportId}.html`
    }

    if (excelBuffer) {
      const excelPath = `reports/${tenantId}/${reportId}.xlsx`
      uploadPromises.push(
        supabase.storage.from('reports').upload(excelPath, excelBuffer, {
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: true,
        })
      )
      excelUrl = `/api/reports/download/${reportId}.xlsx`
    }

    await Promise.all(uploadPromises)
    log.info('Reports uploaded to storage')

    // Store report metadata in database
    await supabase.from('generated_reports').insert({
      report_id: reportId,
      tenant_id: tenantId,
      organization_name: organizationName,
      abn,
      report_type: format,
      client_friendly: clientFriendly,
      generated_at: new Date().toISOString(),
      pdf_path: pdfUrl,
      excel_path: excelUrl,
    })

    // Email if requested
    let emailSent = false
    if (emailTo && (pdfBuffer || excelBuffer)) {
      try {
        const result = await sendForensicReport(
          emailTo,
          organizationName,
          pdfBuffer!,
          excelBuffer || undefined
        )
        emailSent = result.success
        log.info('Email sent', { emailId: result.id })
      } catch (error) {
        console.error('Failed to send email:', error)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      reportId,
      pdfUrl,
      excelUrl,
      emailSent,
      message: `Report generated successfully${emailSent ? ' and emailed' : ''}`,
    })
  } catch (error) {
    console.error('Failed to generate report:', error)
    return createErrorResponse(error, { operation: 'generateReport' }, 500)
  }
}
