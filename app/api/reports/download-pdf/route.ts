import { NextResponse } from 'next/server'
import { generatePDF, generateClientPDF } from '@/lib/reports/pdf-generator'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')
  const type = searchParams.get('type') || 'technical' // 'technical' or 'client'

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId required' }, { status: 400 })
  }

  try {
    console.log(`Generating ${type} PDF for tenant: ${tenantId}`)

    // Fetch organization details from Xero connection
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${type}-report-${tenantId}-${Date.now()}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })
  } catch (error: any) {
    console.error('PDF generation failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error.message },
      { status: 500 }
    )
  }
}
