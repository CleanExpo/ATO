/**
 * Historical Trends API
 *
 * Provides multi-year trend analysis for tax optimization opportunities
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { createValidationError } from '@/lib/api/errors'

// Single-user mode
const SINGLE_USER_MODE = process.env.SINGLE_USER_MODE === 'true' || true

interface YearlyMetrics {
  financialYear: string
  totalTransactions: number
  totalAmount: number
  rndCandidates: number
  rndPotential: number
  deductionOpportunities: number
  deductionPotential: number
  averageConfidence: number
  topCategories: Array<{ category: string; count: number; amount: number }>
}

interface TrendData {
  metric: string
  data: Array<{ year: string; value: number }>
  change: number // Percentage change from first to last year
  trend: 'increasing' | 'decreasing' | 'stable'
}

// Type for forensic analysis result row
interface ForensicResultRow {
  tenant_id: string
  transaction_id: string
  financial_year: string | null
  is_rnd_candidate: boolean | null
  primary_category: string | null
  transaction_amount: number | null
  claimable_amount: number | null
  confidence_score: number | null
  [key: string]: unknown
}

export async function GET(request: NextRequest) {
  let tenantId: string
  let supabase

  if (SINGLE_USER_MODE) {
    tenantId = request.nextUrl.searchParams.get('tenantId') || ''
    if (!tenantId) {
      return createValidationError('tenantId is required')
    }
    supabase = await createServiceClient()
  } else {
    const auth = await requireAuth(request)
    if (isErrorResponse(auth)) return auth
    tenantId = auth.tenantId
    supabase = auth.supabase
  }

  try {
    // Fetch all analysis results for this tenant
    const { data: results, error } = await supabase
      .from('forensic_analysis_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('financial_year')

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!results || results.length === 0) {
      return NextResponse.json({
        yearlyMetrics: [],
        trends: [],
        summary: {
          yearsAnalyzed: 0,
          totalOpportunity: 0,
          averageYearlyGrowth: 0,
        },
      })
    }

    // Group results by financial year
    const byYear = new Map<string, ForensicResultRow[]>()
    ;(results as ForensicResultRow[]).forEach((row) => {
      const year = row.financial_year || 'Unknown'
      if (!byYear.has(year)) {
        byYear.set(year, [])
      }
      byYear.get(year)!.push(row)
    })

    // Calculate metrics for each year
    const yearlyMetrics: YearlyMetrics[] = []

    for (const [year, yearResults] of Array.from(byYear.entries()).sort()) {
      const rndCandidates = yearResults.filter((r: ForensicResultRow) => r.is_rnd_candidate)
      const deductionCandidates = yearResults.filter(
        (r: ForensicResultRow) => r.primary_category && r.primary_category !== 'Uncategorized'
      )

      // Calculate category breakdown
      const categoryMap = new Map<string, { count: number; amount: number }>()
      yearResults.forEach((r: ForensicResultRow) => {
        const cat = r.primary_category || 'Uncategorized'
        if (!categoryMap.has(cat)) {
          categoryMap.set(cat, { count: 0, amount: 0 })
        }
        const entry = categoryMap.get(cat)!
        entry.count += 1
        entry.amount += Math.abs(r.transaction_amount || 0)
      })

      const topCategories = Array.from(categoryMap.entries())
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)

      yearlyMetrics.push({
        financialYear: year,
        totalTransactions: yearResults.length,
        totalAmount: yearResults.reduce(
          (sum: number, r: ForensicResultRow) => sum + Math.abs(r.transaction_amount || 0),
          0
        ),
        rndCandidates: rndCandidates.length,
        rndPotential: rndCandidates.reduce(
          (sum: number, r: ForensicResultRow) => sum + (r.claimable_amount || r.transaction_amount || 0),
          0
        ),
        deductionOpportunities: deductionCandidates.length,
        deductionPotential: deductionCandidates.reduce(
          (sum: number, r: ForensicResultRow) => sum + Math.abs(r.transaction_amount || 0) * 0.25, // Assume 25% tax rate
          0
        ),
        averageConfidence:
          yearResults.reduce((sum: number, r: ForensicResultRow) => sum + (r.confidence_score || 0), 0) /
          yearResults.length,
        topCategories,
      })
    }

    // Calculate trends
    const trends: TrendData[] = []

    // R&D Spending Trend
    const rndTrend = calculateTrend(
      yearlyMetrics.map((m) => ({ year: m.financialYear, value: m.rndPotential }))
    )
    trends.push({
      metric: 'R&D Spending',
      data: rndTrend.data,
      change: rndTrend.change,
      trend: rndTrend.trend,
    })

    // Total Transaction Volume Trend
    const volumeTrend = calculateTrend(
      yearlyMetrics.map((m) => ({ year: m.financialYear, value: m.totalAmount }))
    )
    trends.push({
      metric: 'Transaction Volume',
      data: volumeTrend.data,
      change: volumeTrend.change,
      trend: volumeTrend.trend,
    })

    // Deduction Opportunities Trend
    const deductionTrend = calculateTrend(
      yearlyMetrics.map((m) => ({
        year: m.financialYear,
        value: m.deductionPotential,
      }))
    )
    trends.push({
      metric: 'Deduction Opportunities',
      data: deductionTrend.data,
      change: deductionTrend.change,
      trend: deductionTrend.trend,
    })

    // Average Confidence Trend
    const confidenceTrend = calculateTrend(
      yearlyMetrics.map((m) => ({
        year: m.financialYear,
        value: m.averageConfidence,
      }))
    )
    trends.push({
      metric: 'Average Confidence',
      data: confidenceTrend.data,
      change: confidenceTrend.change,
      trend: confidenceTrend.trend,
    })

    // Calculate summary statistics
    const totalOpportunity = yearlyMetrics.reduce(
      (sum, m) => sum + m.rndPotential + m.deductionPotential,
      0
    )

    const averageYearlyGrowth =
      yearlyMetrics.length > 1
        ? ((yearlyMetrics[yearlyMetrics.length - 1].totalAmount -
            yearlyMetrics[0].totalAmount) /
            yearlyMetrics[0].totalAmount /
            (yearlyMetrics.length - 1)) *
          100
        : 0

    return NextResponse.json({
      yearlyMetrics,
      trends,
      summary: {
        yearsAnalyzed: yearlyMetrics.length,
        totalOpportunity,
        averageYearlyGrowth,
        firstYear: yearlyMetrics[0]?.financialYear,
        lastYear: yearlyMetrics[yearlyMetrics.length - 1]?.financialYear,
      },
    })
  } catch (error: unknown) {
    console.error('Failed to fetch trends:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Calculate trend from data points
 */
function calculateTrend(data: Array<{ year: string; value: number }>): {
  data: Array<{ year: string; value: number }>
  change: number
  trend: 'increasing' | 'decreasing' | 'stable'
} {
  if (data.length === 0) {
    return { data: [], change: 0, trend: 'stable' }
  }

  // Sort by year
  const sorted = [...data].sort((a, b) => a.year.localeCompare(b.year))

  // Calculate percentage change from first to last
  const firstValue = sorted[0].value || 0
  const lastValue = sorted[sorted.length - 1].value || 0

  const change = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0

  // Determine trend
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
  if (change > 5) {
    trend = 'increasing'
  } else if (change < -5) {
    trend = 'decreasing'
  }

  return { data: sorted, change, trend }
}
