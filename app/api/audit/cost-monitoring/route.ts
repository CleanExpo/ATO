/**
 * GET /api/audit/cost-monitoring
 *
 * Get detailed AI analysis cost breakdown with trends and projections.
 *
 * Query Parameters:
 * - tenantId: string (required)
 * - startDate?: string (optional - ISO date)
 * - endDate?: string (optional - ISO date)
 *
 * Response:
 * - summary: Aggregate cost statistics
 * - breakdown: Cost breakdown by batch
 * - trends: Daily/weekly cost trends
 * - projections: Cost projections based on historical usage
 */

import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/server'
import cacheManager, { CacheTTL } from '@/lib/cache/cache-manager'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const log = createLogger('api:audit:cost-monitoring')

export async function GET(request: NextRequest) {
  try {
    // Authenticate and validate tenant access
    const auth = await requireAuth(request)
    if (isErrorResponse(auth)) return auth

    const { tenantId } = auth
    const startDate = request.nextUrl.searchParams.get('startDate') || undefined
    const endDate = request.nextUrl.searchParams.get('endDate') || undefined

    log.info('Getting cost monitoring data', { tenantId })

    // Cache cost data for 5 minutes (costs update frequently during analysis)
    const cacheKey = `cost-monitoring:${tenantId}:${startDate || 'all'}:${endDate || 'all'}`
    const data = await cacheManager.getOrCompute(
      cacheKey,
      async () => await getCostMonitoringData(tenantId, startDate, endDate),
      CacheTTL.costSummary
    )

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to get cost monitoring data:', error)
    return createErrorResponse(error, { operation: 'getCostMonitoring' }, 500)
  }
}

async function getCostMonitoringData(
  tenantId: string,
  startDate?: string,
  endDate?: string
) {
  const supabase = createAdminClient()

  // Build query with optional date filters
  let query = supabase
    .from('ai_analysis_costs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('analyzed_at', { ascending: false })

  if (startDate) {
    query = query.gte('analyzed_at', startDate)
  }
  if (endDate) {
    query = query.lte('analyzed_at', endDate)
  }

  const { data: costs, error } = await query

  if (error) {
    console.error('Database error fetching costs:', error)
    throw new Error(`Failed to fetch cost data: ${error.message}`)
  }

  if (!costs || costs.length === 0) {
    return {
      summary: {
        totalBatches: 0,
        totalTransactions: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCostUSD: 0,
        averageCostPerBatch: 0,
        averageCostPerTransaction: 0,
        firstAnalysis: null,
        lastAnalysis: null,
      },
      breakdown: [],
      trends: {
        daily: [],
        weekly: [],
      },
      projections: {
        nextBatch: 0,
        next100Transactions: 0,
        next1000Transactions: 0,
      },
    }
  }

  // Calculate summary statistics
  const totalBatches = costs.length
  const totalTransactions = costs.reduce((sum, c) => sum + (c.transactions_in_batch || 0), 0)
  const totalInputTokens = costs.reduce((sum, c) => sum + (c.input_tokens || 0), 0)
  const totalOutputTokens = costs.reduce((sum, c) => sum + (c.output_tokens || 0), 0)
  const totalTokens = totalInputTokens + totalOutputTokens
  const totalCostUSD = costs.reduce((sum, c) => sum + (c.cost_usd || 0), 0)

  const averageCostPerBatch = totalBatches > 0 ? totalCostUSD / totalBatches : 0
  const averageCostPerTransaction = totalTransactions > 0 ? totalCostUSD / totalTransactions : 0

  const firstAnalysis = costs[costs.length - 1]?.analyzed_at || null
  const lastAnalysis = costs[0]?.analyzed_at || null

  // Calculate daily trends
  const dailyTrends = calculateDailyTrends(costs)

  // Calculate weekly trends
  const weeklyTrends = calculateWeeklyTrends(costs)

  // Calculate projections based on average cost per transaction
  const projections = {
    nextBatch: averageCostPerBatch,
    next100Transactions: averageCostPerTransaction * 100,
    next1000Transactions: averageCostPerTransaction * 1000,
  }

  return {
    summary: {
      totalBatches,
      totalTransactions,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalCostUSD: Number(totalCostUSD.toFixed(4)),
      averageCostPerBatch: Number(averageCostPerBatch.toFixed(4)),
      averageCostPerTransaction: Number(averageCostPerTransaction.toFixed(6)),
      firstAnalysis,
      lastAnalysis,
    },
    breakdown: costs.map((c) => ({
      id: c.id,
      analyzedAt: c.analyzed_at,
      transactionsInBatch: c.transactions_in_batch,
      inputTokens: c.input_tokens,
      outputTokens: c.output_tokens,
      totalTokens: (c.input_tokens || 0) + (c.output_tokens || 0),
      costUSD: Number((c.cost_usd || 0).toFixed(4)),
      model: c.model_used,
    })),
    trends: {
      daily: dailyTrends,
      weekly: weeklyTrends,
    },
    projections,
  }
}

interface CostRecord {
    analyzed_at: string
    cost_usd?: number | null
    transactions_in_batch?: number | null
}

function calculateDailyTrends(costs: CostRecord[]) {
  const dailyMap = new Map<string, { cost: number; transactions: number; batches: number }>()

  costs.forEach((c) => {
    const date = new Date(c.analyzed_at).toISOString().split('T')[0]
    const existing = dailyMap.get(date) || { cost: 0, transactions: 0, batches: 0 }

    dailyMap.set(date, {
      cost: existing.cost + (c.cost_usd || 0),
      transactions: existing.transactions + (c.transactions_in_batch || 0),
      batches: existing.batches + 1,
    })
  })

  return Array.from(dailyMap.entries())
    .map(([date, stats]) => ({
      date,
      costUSD: Number(stats.cost.toFixed(4)),
      transactions: stats.transactions,
      batches: stats.batches,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function calculateWeeklyTrends(costs: CostRecord[]) {
  const weeklyMap = new Map<string, { cost: number; transactions: number; batches: number }>()

  costs.forEach((c) => {
    const date = new Date(c.analyzed_at)
    const weekStart = getWeekStart(date)

    const existing = weeklyMap.get(weekStart) || { cost: 0, transactions: 0, batches: 0 }

    weeklyMap.set(weekStart, {
      cost: existing.cost + (c.cost_usd || 0),
      transactions: existing.transactions + (c.transactions_in_batch || 0),
      batches: existing.batches + 1,
    })
  })

  return Array.from(weeklyMap.entries())
    .map(([weekStart, stats]) => ({
      weekStart,
      costUSD: Number(stats.cost.toFixed(4)),
      transactions: stats.transactions,
      batches: stats.batches,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when Sunday
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}
