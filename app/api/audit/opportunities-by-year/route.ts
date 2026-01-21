import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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
    const byYear = (data || []).reduce((acc, row) => {
      const year = row.financial_year || 'Unknown'
      if (!acc[year]) {
        acc[year] = { name: year, value: 0, count: 0 }
      }
      // Use claimable_amount if available, otherwise transaction_amount
      const benefit = row.claimable_amount || row.transaction_amount || 0
      acc[year].value += benefit
      acc[year].count += 1
      return acc
    }, {} as Record<string, { name: string; value: number; count: number }>)

    return NextResponse.json({
      opportunities: Object.values(byYear).sort((a, b) => a.name.localeCompare(b.name))
    })
  } catch (error: any) {
    console.error('Failed to fetch opportunities by year:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
