/**
 * POST /api/xero/files
 *
 * Upload a report to Xero Files section.
 *
 * Body:
 *  - tenantId: string (required)
 *  - reportType: 'forensic-audit' | 'reconciliation' (required)
 *  - format: 'pdf' | 'html' (optional, default: 'pdf')
 *
 * GET /api/xero/files?tenantId=xxx
 *
 * List uploaded reports in Xero.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createValidationError, createErrorResponse } from '@/lib/api/errors'
import { uploadReportToXero, listReportsInXero } from '@/lib/xero/files-api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenantId, reportType, reportContent, fileName } = body

    if (!tenantId || typeof tenantId !== 'string') {
      return createValidationError('tenantId is required')
    }
    if (!reportType || typeof reportType !== 'string') {
      return createValidationError('reportType is required')
    }
    if (!reportContent || typeof reportContent !== 'string') {
      return createValidationError('reportContent is required (base64 encoded)')
    }

    const fileBuffer = Buffer.from(reportContent, 'base64')
    const finalFileName = fileName || `ATO_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`

    const result = await uploadReportToXero({
      tenantId,
      fileName: finalFileName,
      fileContent: fileBuffer,
      mimeType: 'application/pdf',
    })

    if (!result.success) {
      return createErrorResponse(
        new Error(result.error || 'Upload failed'),
        { operation: 'xero-file-upload', tenantId },
        500
      )
    }

    return NextResponse.json({
      status: 'uploaded',
      fileId: result.fileId,
      fileName: result.fileName,
      xeroFileUrl: result.xeroFileUrl,
    })
  } catch (error) {
    return createErrorResponse(error, { operation: 'xero-file-upload' }, 500)
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')

    if (!tenantId) {
      return createValidationError('tenantId is required')
    }

    const files = await listReportsInXero(tenantId)

    return NextResponse.json({
      files,
      count: files.length,
    })
  } catch (error) {
    return createErrorResponse(error, { operation: 'xero-file-list' }, 500)
  }
}
