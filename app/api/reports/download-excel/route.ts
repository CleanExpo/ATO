import { NextRequest, NextResponse } from 'next/server'
import { generateExcelFromTenant } from '@/lib/reports/excel-generator'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'

export async function GET(request: NextRequest) {
  // Authenticate and validate tenant access
  const auth = await requireAuth(request)
  if (isErrorResponse(auth)) return auth

  const { tenantId } = auth

  try {
    console.log(`Generating Excel workbook for tenant: ${tenantId}`)

    // Generate real Excel workbook with ExcelJS (no 10K limit!)
    const excelBuffer = await generateExcelFromTenant(tenantId)

    console.log(`Excel generated successfully: ${excelBuffer.length} bytes`)

    return new NextResponse(new Uint8Array(excelBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="forensic-audit-${tenantId}-${Date.now()}.xlsx"`,
        'Content-Length': excelBuffer.length.toString()
      }
    })
  } catch (error: unknown) {
    console.error('Excel generation failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to generate Excel file', details: errorMessage },
      { status: 500 }
    )
  }
}
