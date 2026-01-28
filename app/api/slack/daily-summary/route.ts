/**
 * POST /api/slack/daily-summary
 *
 * Generates and sends daily summary report to Slack
 *
 * This endpoint should be called by Vercel Cron daily
 * Requires CRON_SECRET for authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import slack from '@/lib/slack/slack-notifier'

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('CRON_SECRET not configured')
      return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServiceClient()
    const today = new Date()
    const startOfDay = new Date(today.setHours(0, 0, 0, 0))
    const endOfDay = new Date(today.setHours(23, 59, 59, 999))

    // Get user statistics
    const { count: totalUsers } = await supabase
      .from('auth.users')
      .select('*', { count: 'exact', head: true })

    // Get active users today (users who triggered API calls)
    const { data: activeUsers } = await supabase
      .from('forensic_analysis_results')
      .select('tenant_id')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())

    const activeToday = new Set(activeUsers?.map(u => u.tenant_id) || []).size

    // Get new signups today
    const { count: newSignups } = await supabase
      .from('auth.users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())

    // Get analysis statistics
    const { data: analyses } = await supabase
      .from('forensic_analysis_results')
      .select('tenant_id, is_rnd_candidate, adjusted_benefit')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())

    const totalAnalyses = new Set(analyses?.map(a => a.tenant_id) || []).size
    const totalTransactions = analyses?.length || 0
    const totalRndBenefit = analyses?.filter(a => a.is_rnd_candidate).reduce((sum, a) => sum + (a.adjusted_benefit || 0), 0) || 0

    // Get cost statistics
    const { data: costs } = await supabase
      .from('ai_analysis_costs')
      .select('cost_usd')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())

    const totalCostUSD = costs?.reduce((sum, c) => sum + c.cost_usd, 0) || 0

    // Get alert statistics
    const { count: totalAlerts } = await supabase
      .from('tax_alerts')
      .select('*', { count: 'exact', head: true })
      .gte('triggered_at', startOfDay.toISOString())
      .lte('triggered_at', endOfDay.toISOString())

    const { count: criticalAlerts } = await supabase
      .from('tax_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'critical')
      .gte('triggered_at', startOfDay.toISOString())
      .lte('triggered_at', endOfDay.toISOString())

    // Send daily summary to Slack
    await slack.notifyDailySummary({
      date: today.toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', dateStyle: 'full' }),
      users: {
        total: totalUsers || 0,
        active: activeToday,
        newSignups: newSignups || 0
      },
      analysis: {
        totalAnalyses,
        totalTransactions,
        totalRndBenefit,
        totalCostUSD
      },
      alerts: {
        totalAlerts: totalAlerts || 0,
        criticalAlerts: criticalAlerts || 0
      },
      revenue: {
        totalRevenue: 0, // TODO: Integrate with payment system
        newSubscriptions: 0,
        churnedSubscriptions: 0
      },
      errors: {
        totalErrors: 0, // TODO: Integrate with error tracking
        criticalErrors: 0
      }
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        users: { total: totalUsers || 0, active: activeToday, newSignups: newSignups || 0 },
        analysis: { totalAnalyses, totalTransactions, totalRndBenefit, totalCostUSD },
        alerts: { totalAlerts: totalAlerts || 0, criticalAlerts: criticalAlerts || 0 }
      }
    })

  } catch (error) {
    console.error('Error generating daily summary:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate daily summary',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Allow GET for health checks
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/slack/daily-summary',
    description: 'Generates daily summary report for Slack',
    schedule: 'Daily at 6:00 PM AEST (end of business day)'
  })
}
