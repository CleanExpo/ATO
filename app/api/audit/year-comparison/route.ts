/**
 * Year-over-Year Comparison API
 *
 * Provides detailed comparison between two financial years
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { createValidationError } from '@/lib/api/errors'
import { isSingleUserMode } from '@/lib/auth/single-user-check'

interface YearComparison {
  metric: string
  year1Value: number
  year2Value: number
  change: number // Absolute change
  percentageChange: number
  trend: 'improved' | 'declined' | 'stable'
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

  if (isSingleUserMode()) {
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

  // Get years to compare from query params
  const year1 = request.nextUrl.searchParams.get('year1')
  const year2 = request.nextUrl.searchParams.get('year2')

  if (!year1 || !year2) {
    return createValidationError('Both year1 and year2 are required')
  }

  try {
    // Fetch data for both years
    const { data: year1Data, error: error1 } = await supabase
      .from('forensic_analysis_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('financial_year', year1)

    const { data: year2Data, error: error2 } = await supabase
      .from('forensic_analysis_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('financial_year', year2)

    if (error1 || error2) {
      console.error('Database error:', error1 || error2)
      return NextResponse.json(
        { error: (error1 || error2)?.message },
        { status: 500 }
      )
    }

    if (!year1Data || !year2Data) {
      return NextResponse.json(
        { error: 'No data found for one or both years' },
        { status: 404 }
      )
    }

    // Calculate metrics for both years
    const year1Metrics = calculateYearMetrics(year1Data as ForensicResultRow[])
    const year2Metrics = calculateYearMetrics(year2Data as ForensicResultRow[])

    // Build comparison array
    const comparisons: YearComparison[] = [
      createComparison(
        'Total Transactions',
        year1Metrics.totalTransactions,
        year2Metrics.totalTransactions,
        'higher'
      ),
      createComparison(
        'Transaction Volume ($)',
        year1Metrics.totalAmount,
        year2Metrics.totalAmount,
        'higher'
      ),
      createComparison(
        'R&D Candidates',
        year1Metrics.rndCandidates,
        year2Metrics.rndCandidates,
        'higher'
      ),
      createComparison(
        'R&D Potential ($)',
        year1Metrics.rndPotential,
        year2Metrics.rndPotential,
        'higher'
      ),
      createComparison(
        'Deduction Opportunities',
        year1Metrics.deductionCount,
        year2Metrics.deductionCount,
        'higher'
      ),
      createComparison(
        'Deduction Potential ($)',
        year1Metrics.deductionPotential,
        year2Metrics.deductionPotential,
        'higher'
      ),
      createComparison(
        'Average Confidence (%)',
        year1Metrics.averageConfidence,
        year2Metrics.averageConfidence,
        'higher'
      ),
    ]

    // Category analysis - what's new/changed
    const year1Categories = new Set(
      (year1Data as ForensicResultRow[]).map((r: ForensicResultRow) => r.primary_category).filter(Boolean)
    )
    const year2Categories = new Set(
      (year2Data as ForensicResultRow[]).map((r: ForensicResultRow) => r.primary_category).filter(Boolean)
    )

    const newCategories = Array.from(year2Categories).filter(
      (cat) => !year1Categories.has(cat)
    )
    const removedCategories = Array.from(year1Categories).filter(
      (cat) => !year2Categories.has(cat)
    )

    // Top movers - categories with biggest changes
    const categoryChanges = calculateCategoryChanges(year1Data as ForensicResultRow[], year2Data as ForensicResultRow[])

    return NextResponse.json({
      year1: {
        name: year1,
        ...year1Metrics,
      },
      year2: {
        name: year2,
        ...year2Metrics,
      },
      comparisons,
      insights: {
        newCategories,
        removedCategories,
        topMovers: categoryChanges.slice(0, 5),
      },
    })
  } catch (error: unknown) {
    console.error('Failed to compare years:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Calculate metrics for a year's data
 */
function calculateYearMetrics(data: ForensicResultRow[]) {
  const rndCandidates = data.filter((r: ForensicResultRow) => r.is_rnd_candidate)
  const deductions = data.filter(
    (r: ForensicResultRow) => r.primary_category && r.primary_category !== 'Uncategorized'
  )

  return {
    totalTransactions: data.length,
    totalAmount: data.reduce(
      (sum: number, r: ForensicResultRow) => sum + Math.abs(r.transaction_amount || 0),
      0
    ),
    rndCandidates: rndCandidates.length,
    rndPotential: rndCandidates.reduce(
      (sum: number, r: ForensicResultRow) => sum + (r.claimable_amount || r.transaction_amount || 0),
      0
    ),
    deductionCount: deductions.length,
    deductionPotential: deductions.reduce(
      (sum: number, r: ForensicResultRow) => sum + Math.abs(r.transaction_amount || 0) * 0.25,
      0
    ),
    averageConfidence:
      data.reduce((sum: number, r: ForensicResultRow) => sum + (r.confidence_score || 0), 0) / data.length,
  }
}

/**
 * Create a comparison object
 */
function createComparison(
  metric: string,
  year1Value: number,
  year2Value: number,
  improvedDirection: 'higher' | 'lower'
): YearComparison {
  const change = year2Value - year1Value
  const percentageChange =
    year1Value !== 0 ? (change / year1Value) * 100 : year2Value > 0 ? 100 : 0

  let trend: 'improved' | 'declined' | 'stable' = 'stable'
  if (Math.abs(percentageChange) < 5) {
    trend = 'stable'
  } else if (
    (improvedDirection === 'higher' && change > 0) ||
    (improvedDirection === 'lower' && change < 0)
  ) {
    trend = 'improved'
  } else {
    trend = 'declined'
  }

  return {
    metric,
    year1Value,
    year2Value,
    change,
    percentageChange,
    trend,
  }
}

/**
 * Calculate category-level changes
 */
function calculateCategoryChanges(year1Data: ForensicResultRow[], year2Data: ForensicResultRow[]) {
  // Group by category for each year
  const year1ByCategory = new Map<string, number>()
  const year2ByCategory = new Map<string, number>()

  year1Data.forEach((r: ForensicResultRow) => {
    const cat = r.primary_category || 'Uncategorized'
    year1ByCategory.set(
      cat,
      (year1ByCategory.get(cat) || 0) + Math.abs(r.transaction_amount || 0)
    )
  })

  year2Data.forEach((r: ForensicResultRow) => {
    const cat = r.primary_category || 'Uncategorized'
    year2ByCategory.set(
      cat,
      (year2ByCategory.get(cat) || 0) + Math.abs(r.transaction_amount || 0)
    )
  })

  // Calculate changes
  const allCategories = new Set([
    ...year1ByCategory.keys(),
    ...year2ByCategory.keys(),
  ])

  const changes = Array.from(allCategories).map((category) => {
    const year1Amount = year1ByCategory.get(category) || 0
    const year2Amount = year2ByCategory.get(category) || 0
    const change = year2Amount - year1Amount
    const percentageChange = year1Amount !== 0 ? (change / year1Amount) * 100 : 100

    return {
      category,
      year1Amount,
      year2Amount,
      change,
      percentageChange,
    }
  })

  // Sort by absolute percentage change (biggest movers)
  return changes.sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange))
}
