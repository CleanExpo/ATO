import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { createValidationError } from '@/lib/api/errors'
import { isSingleUserMode } from '@/lib/auth/single-user-check'

export async function GET(request: NextRequest) {
  let tenantId: string
  let supabase

  if (isSingleUserMode()) {
    // Single-user mode: Get tenantId from query
    tenantId = request.nextUrl.searchParams.get('tenantId') || ''
    if (!tenantId) {
      return createValidationError('tenantId is required')
    }
    supabase = await createServiceClient()
  } else {
    // Multi-user mode: Authenticate and validate tenant access
    const auth = await requireAuth(request)
    if (isErrorResponse(auth)) return auth
    tenantId = auth.tenantId
    supabase = auth.supabase
  }

  try {
    // Get opportunities grouped by financial year
    const { data, error } = await supabase
      .from('forensic_analysis_results')
      .select('financial_year, claimable_amount, transaction_amount')
      .eq('tenant_id', tenantId)
      .eq('is_rnd_candidate', true)
      .order('financial_year')

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by year and sum benefits
    type YearSummary = Record<string, { name: string; value: number; count: number }>
    type AnalysisRow = { financial_year: string | null; claimable_amount: number | null; transaction_amount: number | null }
    const rows: AnalysisRow[] = data || []
    const byYear = rows.reduce((acc: YearSummary, row: AnalysisRow) => {
      const year = row.financial_year || 'Unknown'
      if (!acc[year]) {
        acc[year] = { name: year, value: 0, count: 0 }
      }
      // Use claimable_amount if available, otherwise transaction_amount
      const benefit = row.claimable_amount || row.transaction_amount || 0
      acc[year].value += benefit
      acc[year].count += 1
      return acc
    }, {} as YearSummary)

    return NextResponse.json({
      opportunities: Object.values(byYear).sort((a, b) => a.name.localeCompare(b.name))
    })
  } catch (error: unknown) {
    console.error('Failed to fetch opportunities by year:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
