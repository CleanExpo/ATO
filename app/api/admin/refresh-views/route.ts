/**
 * POST /api/admin/refresh-views
 *
 * Cron job endpoint to refresh materialized views.
 * Keeps analytics dashboards up-to-date by refreshing
 * mv_rnd_summary, mv_deduction_summary, and mv_cost_summary.
 *
 * Schedule: Daily at 4:00 AM UTC (2:00 PM AEST)
 * Security: Uses CRON_SECRET for authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/logger'
import { optionalConfig } from '@/lib/config/env'

export const dynamic = 'force-dynamic'

const log = createLogger('api:admin:refresh-views')

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = optionalConfig.cronSecret

    if (!cronSecret) {
      log.error('CRON_SECRET not configured')
      return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const supabase = await createServiceClient()
    const results: Record<string, string> = {}

    // Refresh each materialized view
    const views = [
      'mv_rnd_summary',
      'mv_deduction_summary',
      'mv_cost_summary',
    ]

    for (const view of views) {
      try {
        const { error } = await supabase.rpc('refresh_materialized_view', { view_name: view })
        if (error) {
          log.error(`Failed to refresh ${view}`, error)
          results[view] = `error: ${error.message}`
        } else {
          results[view] = 'refreshed'
        }
      } catch (err) {
        log.error(`Exception refreshing ${view}`, err)
        results[view] = `error: ${String(err)}`
      }
    }

    log.info('Materialized view refresh complete', results)

    return NextResponse.json({
      status: 'ok',
      refreshed_at: new Date().toISOString(),
      views: results,
    })
  } catch (error) {
    log.error('Materialized view refresh failed', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/admin/refresh-views',
    description: 'Refreshes materialized views for analytics dashboards',
    schedule: 'Daily at 4:00 AM UTC (2:00 PM AEST)',
  })
}
