import { NextResponse } from 'next/server'
import { generateExcelWorkbook } from '@/lib/reports/excel-generator'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId required' }, { status: 400 })
  }

  try {
    console.log(`Generating Excel workbook for tenant: ${tenantId}`)

    // Generate real Excel workbook with ExcelJS (no 10K limit!)
    const excelBuffer = await generateExcelWorkbook(tenantId)

    console.log(`Excel generated successfully: ${excelBuffer.length} bytes`)

    return new NextResponse(excelBuffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="forensic-audit-${tenantId}-${Date.now()}.xlsx"`,
        'Content-Length': excelBuffer.length.toString()
      }
    })
  } catch (error: any) {
    console.error('Excel generation failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate Excel file', details: error.message },
      { status: 500 }
    )
  }
}
