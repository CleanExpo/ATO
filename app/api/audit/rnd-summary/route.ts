import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { createValidationError } from '@/lib/api/errors'

// Single-user mode: Skip auth and use tenantId directly
const SINGLE_USER_MODE = process.env.SINGLE_USER_MODE === 'true' || true

export async function GET(request: NextRequest) {
  let tenantId: string
  let supabase

  if (SINGLE_USER_MODE) {
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
    type Candidate = { primary_category?: string; transaction_amount?: number; financial_year?: string; rnd_confidence?: number; transaction_description?: string; supplier_name?: string }
    const projectMap = new Map<string, { id: string; name: string; transactions: Candidate[]; totalSpend: number; years: Set<string> }>()

    candidates.forEach((c: Candidate) => {
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

      const project = projectMap.get(category)!
      project.transactions.push(c)
      project.totalSpend += Math.abs(c.transaction_amount || 0)
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
      avgConfidence: p.transactions.reduce((sum: number, t: Candidate) => sum + (t.rnd_confidence || 0), 0) / p.transactions.length,
      financialYears: Array.from(p.years).sort(),
      eligibleActivities: p.transactions
        .slice(0, 5)
        .map((t: Candidate) => t.transaction_description || t.supplier_name || 'No description')
        .filter((desc: string, index: number, self: string[]) => self.indexOf(desc) === index)
    }))

    // Calculate totals
    const totalExpenditure = candidates.reduce((sum: number, c: Candidate) => sum + Math.abs(c.transaction_amount || 0), 0)
    const offsetRate = 0.435 // 43.5% R&D offset for companies with turnover < $20M
    const totalOffset = totalExpenditure * offsetRate

    return NextResponse.json({
      totalProjects: projects.length,
      totalEligibleExpenditure: totalExpenditure,
      totalEstimatedOffset: totalOffset,
      offsetRate: offsetRate,
      projects: projects.sort((a, b) => b.totalSpend - a.totalSpend)
    })
  } catch (error: unknown) {
    console.error('Failed to fetch R&D summary:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
