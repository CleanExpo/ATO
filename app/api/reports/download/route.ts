/**
 * GET /api/reports/download?reportId=XXX&format=pdf|excel
 *
 * Download a previously generated report.
 *
 * Query Parameters:
 * - reportId: string (required)
 * - format: 'pdf' | 'excel' (required)
 *
 * Response:
 * - Binary file download (PDF or Excel)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'query' })
    if (isErrorResponse(auth)) return auth

    const searchParams = request.nextUrl.searchParams
    const reportId = searchParams.get('reportId')
    const format = searchParams.get('format')

    // Validate parameters
    if (!reportId) {
      return createValidationError('reportId is required')
    }

    if (!format || !['pdf', 'excel'].includes(format)) {
      return createValidationError('format must be pdf or excel')
    }

    const supabase = await createServiceClient()

    // Get report metadata
    const { data: report, error: reportError } = await supabase
      .from('generated_reports')
      .select('*')
      .eq('report_id', reportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    // Determine file path
    const extension = format === 'pdf' ? 'pdf' : 'xlsx'
    const filePath = `reports/${report.tenant_id}/${reportId}.${extension}`

    // Download from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('reports')
      .download(filePath)

    if (downloadError || !fileData) {
      console.error('Failed to download report:', downloadError)
      return NextResponse.json(
        { error: 'Failed to download report' },
        { status: 500 }
      )
    }

    // Convert blob to buffer
    const buffer = await fileData.arrayBuffer()

    // Set appropriate headers
    const contentType =
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    const filename = `${report.organization_name.replace(/[^a-zA-Z0-9]/g, '_')}_Report.${extension}`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error('Failed to download report:', error)
    return createErrorResponse(error, { operation: 'downloadReport' }, 500)
  }
}
