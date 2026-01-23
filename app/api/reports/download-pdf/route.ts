import { NextRequest, NextResponse } from 'next/server'
import { generatePDF, generateClientPDF } from '@/lib/reports/pdf-generator'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'

export async function GET(request: NextRequest) {
  // Authenticate and validate tenant access
  const auth = await requireAuth(request)
  if (isErrorResponse(auth)) return auth

  const { tenantId, supabase } = auth
  const type = request.nextUrl.searchParams.get('type') || 'technical' // 'technical' or 'client'

  try {
    console.log(`Generating ${type} PDF for tenant: ${tenantId}`)

    const { data: xeroOrg } = await supabase
      .from('xero_connections')
      .select('organisation_name, tax_number')
      .eq('tenant_id', tenantId)
      .single()

    const organizationName = xeroOrg?.organisation_name || 'Organization'
    const abn = xeroOrg?.tax_number || 'N/A'

    // Generate PDF using Puppeteer
    let pdfBuffer: Buffer
    if (type === 'client') {
      pdfBuffer = await generateClientPDF(tenantId, organizationName, abn)
    } else {
      pdfBuffer = await generatePDF(tenantId, organizationName, abn)
    }

    console.log(`PDF generated successfully: ${pdfBuffer.length} bytes`)

    // Return as downloadable file
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${type}-report-${tenantId}-${Date.now()}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })
  } catch (error: unknown) {
    console.error('PDF generation failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: errorMessage },
      { status: 500 }
    )
  }
}
