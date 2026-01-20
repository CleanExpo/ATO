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
    // Get all R&D candidates with their details
    const { data: candidates, error } = await supabase
      .from('forensic_analysis_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_rnd_candidate', true)
      .gte('rnd_confidence', 60)
      .order('rnd_confidence', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({
        totalProjects: 0,
        totalEligibleExpenditure: 0,
        totalEstimatedOffset: 0,
        offsetRate: 0.435,
        projects: []
      })
    }

    // Group by primary_category (project type)
    const projectMap = new Map()

    candidates.forEach(c => {
      const category = c.primary_category || 'Uncategorized'
      if (!projectMap.has(category)) {
        projectMap.set(category, {
          id: category.toLowerCase().replace(/\s+/g, '-'),
          name: category,
          transactions: [],
          totalSpend: 0,
          years: new Set()
        })
      }

      const project = projectMap.get(category)
      project.transactions.push(c)
      project.totalSpend += Math.abs(c.amount || 0)
      if (c.financial_year) {
        project.years.add(c.financial_year)
      }
    })

    // Convert to array and calculate stats
    const projects = Array.from(projectMap.values()).map(p => ({
      id: p.id,
      name: p.name,
      category: p.name,
      totalSpend: p.totalSpend,
      transactionCount: p.transactions.length,
      avgConfidence: p.transactions.reduce((sum: number, t: any) => sum + (t.rnd_confidence || 0), 0) / p.transactions.length,
      financialYears: Array.from(p.years).sort(),
      eligibleActivities: p.transactions
        .slice(0, 5)
        .map((t: any) => t.description || t.supplier || 'No description')
        .filter((desc: string, index: number, self: string[]) => self.indexOf(desc) === index)
    }))

    // Calculate totals
    const totalExpenditure = candidates.reduce((sum, c) => sum + Math.abs(c.amount || 0), 0)
    const offsetRate = 0.435 // 43.5% R&D offset for companies with turnover < $20M
    const totalOffset = totalExpenditure * offsetRate

    return NextResponse.json({
      totalProjects: projects.length,
      totalEligibleExpenditure: totalExpenditure,
      totalEstimatedOffset: totalOffset,
      offsetRate: offsetRate,
      projects: projects.sort((a, b) => b.totalSpend - a.totalSpend)
    })
  } catch (error: any) {
    console.error('Failed to fetch R&D summary:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
