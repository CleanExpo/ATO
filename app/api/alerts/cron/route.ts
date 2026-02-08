/**
 * POST /api/alerts/cron
 *
 * Cron job endpoint for scheduled alert checks and email notifications
 *
 * This endpoint should be called by:
 * - Vercel Cron (configured in vercel.json)
 * - Or any scheduled task runner
 *
 * Recommended schedule:
 * - Daily at 8:00 AM AEST for deadline checks
 * - Every 30 minutes for email notifications
 *
 * Security: Uses CRON_SECRET for authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { runScheduledAlertChecks, cleanupOldAlerts } from '@/lib/alerts/scheduled-checker'
import { sendPendingAlertEmails } from '@/lib/alerts/email-notifier'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:alerts:cron')

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

    // Parse body to determine which job to run
    const body = await request.json().catch(() => ({}))
    const jobType = body.jobType || 'all'

    const results: Record<string, unknown> = {}

    // Run scheduled alert checks (deadline-based alerts)
    if (jobType === 'all' || jobType === 'checks') {
      log.info('Running scheduled alert checks')
      await runScheduledAlertChecks()
      results.checks = 'completed'
    }

    // Send pending email notifications
    if (jobType === 'all' || jobType === 'emails') {
      log.info('Sending pending alert emails')
      await sendPendingAlertEmails()
      results.emails = 'completed'
    }

    // Clean up old alerts (weekly)
    if (jobType === 'cleanup') {
      log.info('Cleaning up old alerts')
      await cleanupOldAlerts()
      results.cleanup = 'completed'
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    })

  } catch (error) {
    console.error('Error in alerts cron job:', error)
    return NextResponse.json(
      {
        error: 'Cron job failed',
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
    endpoint: '/api/alerts/cron',
    description: 'Scheduled alert checks and email notifications',
    jobs: [
      { type: 'checks', description: 'Check for deadline-based alerts', schedule: 'Daily at 8:00 AM' },
      { type: 'emails', description: 'Send pending email notifications', schedule: 'Every 30 minutes' },
      { type: 'cleanup', description: 'Clean up old dismissed/actioned alerts', schedule: 'Weekly' }
    ]
  })
}
