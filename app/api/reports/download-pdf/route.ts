import { NextRequest, NextResponse } from 'next/server'
import { generatePDFReportData, generatePDFReportHTML } from '@/lib/reports/pdf-generator'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:reports:download-pdf')

export async function GET(request: NextRequest) {
  // Authenticate and validate tenant access
  const auth = await requireAuth(request)
  if (isErrorResponse(auth)) return auth

  const { tenantId, supabase } = auth

  try {
    log.info('Generating report', { tenantId })

    const { data: xeroOrg } = await supabase
      .from('xero_connections')
      .select('organisation_name, tax_number')
      .eq('tenant_id', tenantId)
      .single()

    const organizationName = xeroOrg?.organisation_name || 'Organization'
    const abn = xeroOrg?.tax_number || 'N/A'

    // Generate print-optimised HTML report (use browser Print > Save as PDF)
    const reportData = await generatePDFReportData(tenantId, organizationName, abn)
    const html = await generatePDFReportHTML(reportData)

    log.info('Report generated as HTML', { tenantId })

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="forensic-report-${tenantId}.html"`,
      }
    })
  } catch (error: unknown) {
    console.error('Report generation failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to generate report', details: errorMessage },
      { status: 500 }
    )
  }
}
