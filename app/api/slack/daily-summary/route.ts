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
import type Stripe from 'stripe'

export const dynamic = 'force-dynamic'

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
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

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

    // Fetch revenue stats from Stripe (optional -- skipped if STRIPE_SECRET_KEY not configured)
    let revenueStats = { totalRevenue: 0, newSubscriptions: 0, churnedSubscriptions: 0 };
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const { stripe } = await import('@/lib/stripe/client');
        const startTimestamp = Math.floor(startOfDay.getTime() / 1000);
        const endTimestamp = Math.floor(endOfDay.getTime() / 1000);

        // Fetch today's successful charges
        const charges = await stripe.charges.list({
          created: { gte: startTimestamp, lte: endTimestamp },
          limit: 100,
        });
        const totalRevenue = charges.data
          .filter((c: Stripe.Charge) => c.status === 'succeeded')
          .reduce((sum: number, c: Stripe.Charge) => sum + c.amount, 0);

        // Fetch today's new subscriptions and cancellations
        const subscriptions = await stripe.subscriptions.list({
          created: { gte: startTimestamp, lte: endTimestamp },
          limit: 100,
        });
        const newSubscriptions = subscriptions.data.length;

        // Fetch cancelled subscriptions (canceled_at within today)
        const cancelledSubs = await stripe.subscriptions.list({
          status: 'canceled',
          limit: 100,
        });
        const churnedSubscriptions = cancelledSubs.data.filter(
          (s: Stripe.Subscription) => s.canceled_at && s.canceled_at >= startTimestamp && s.canceled_at <= endTimestamp
        ).length;

        revenueStats = { totalRevenue, newSubscriptions, churnedSubscriptions };
      } catch (stripeError) {
        console.warn('Failed to fetch Stripe revenue stats for daily summary:', stripeError);
        // Continue with zeroed revenue stats rather than failing the entire summary
      }
    }

    // Fetch error stats from security_events table (Sentry not integrated -- using internal error tracking)
    // If a Sentry API integration is needed in future, set SENTRY_API_TOKEN and SENTRY_ORG/PROJECT
    // env vars and use https://sentry.io/api/0/projects/{org}/{project}/issues/?query=&statsPeriod=24h
    let errorStats = { totalErrors: 0, criticalErrors: 0 };
    try {
      const { count: totalErrors } = await supabase
        .from('security_events')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())

      const { count: criticalErrors } = await supabase
        .from('security_events')
        .select('*', { count: 'exact', head: true })
        .in('event_type', ['unauthorized_access', 'bulk_data_access', 'data_export'])
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())

      errorStats = {
        totalErrors: totalErrors || 0,
        criticalErrors: criticalErrors || 0,
      };
    } catch (errorTrackingErr) {
      console.warn('Failed to fetch error stats for daily summary:', errorTrackingErr);
      // security_events table may not exist yet -- continue with zeroed stats
    }

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
      revenue: revenueStats,
      errors: errorStats,
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
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/slack/daily-summary',
    description: 'Generates daily summary report for Slack',
    schedule: 'Daily at 6:00 PM AEST (end of business day)'
  })
}
