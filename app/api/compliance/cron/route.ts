/**
 * POST /api/compliance/cron
 *
 * Weekly compliance check endpoint for tax law monitoring across AU, NZ, and UK.
 *
 * This endpoint should be called by:
 * - Vercel Cron (configured in vercel.json) — weekly Monday 3:00 AM UTC
 * - Or any scheduled task runner
 *
 * Jobs:
 * - all: Run full compliance check (rates + calendar + notifications)
 * - rates: Rate change detection only
 * - calendar: Compliance calendar update only
 *
 * Security: Uses CRON_SECRET for authentication (same as /api/alerts/cron)
 */

import { NextRequest, NextResponse } from 'next/server'
import { runWeeklyComplianceCheck } from '@/lib/compliance/weekly-checker'
import { updateComplianceCalendar } from '@/lib/compliance/calendar-updater'
import { createLogger } from '@/lib/logger'
import { optionalConfig } from '@/lib/config/env'
import { getSupportedJurisdictions } from '@/lib/types/jurisdiction'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60s for multi-jurisdiction checks

const log = createLogger('api:compliance:cron')

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse body to determine which job to run
    let jobType = 'all'
    try {
      const body = await request.json()
      jobType = body.jobType || 'all'
    } catch {
      // No body or invalid JSON — default to 'all'
    }

    log.info(`Compliance cron triggered: jobType=${jobType}`)

    switch (jobType) {
      case 'all': {
        const summary = await runWeeklyComplianceCheck()
        return NextResponse.json({
          success: true,
          jobType: 'all',
          summary: {
            jurisdictions: summary.jurisdictions.map((j) => ({
              jurisdiction: j.jurisdiction,
              rateChanges: j.rateChangesDetected.length,
              upcomingDeadlines: j.upcomingDeadlines.length,
              calendarUpdated: j.calendarUpdated,
              error: j.error,
            })),
            totalRateChanges: summary.totalRateChanges,
            totalUpcomingDeadlines: summary.totalUpcomingDeadlines,
            errors: summary.errors,
            startedAt: summary.startedAt,
            completedAt: summary.completedAt,
          },
        })
      }

      case 'calendar': {
        const jurisdictions = getSupportedJurisdictions()
        const results = await Promise.allSettled(
          jurisdictions.map((j) => updateComplianceCalendar(j))
        )
        return NextResponse.json({
          success: true,
          jobType: 'calendar',
          results: jurisdictions.map((j, i) => ({
            jurisdiction: j,
            success: results[i].status === 'fulfilled',
            deadlines: results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<unknown>).value : null,
            error: results[i].status === 'rejected' ? String((results[i] as PromiseRejectedResult).reason) : null,
          })),
        })
      }

      case 'rates': {
        const summary = await runWeeklyComplianceCheck()
        return NextResponse.json({
          success: true,
          jobType: 'rates',
          rateChanges: summary.jurisdictions.flatMap((j) =>
            j.rateChangesDetected.map((c) => ({
              jurisdiction: c.jurisdiction,
              rateType: c.rateType,
              rateKey: c.rateKey,
              oldValue: c.oldValue,
              newValue: c.newValue,
            }))
          ),
          totalChanges: summary.totalRateChanges,
        })
      }

      default:
        return NextResponse.json(
          { error: `Unknown jobType: ${jobType}. Valid: all, rates, calendar` },
          { status: 400 }
        )
    }
  } catch (error) {
    log.error('Compliance cron error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/compliance/cron',
    schedule: 'Weekly Monday 3:00 AM UTC',
    jurisdictions: getSupportedJurisdictions(),
    description: 'Multi-jurisdiction tax law compliance monitoring',
  })
}
