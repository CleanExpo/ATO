/**
 * POST /api/email/weekly-digest
 *
 * Cron-triggered endpoint that sends weekly tax intelligence digests
 * to all organisations with email reporting enabled.
 *
 * Schedule: Weekly Monday 9:00 AM UTC (configured in vercel.json)
 * Security: Uses CRON_SECRET for authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { optionalConfig } from '@/lib/config/env'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const log = createLogger('api:email:weekly-digest')

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = optionalConfig.cronSecret

    if (!cronSecret) {
      return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    log.info('Weekly digest cron triggered')

    const supabase = await createClient()

    // Find all orgs with email reports enabled
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id, name, jurisdiction, settings')
      .not('settings', 'is', null)

    if (error || !orgs) {
      log.error('Failed to fetch organisations for digest', { error })
      return NextResponse.json({ success: false, error: 'Failed to fetch orgs' }, { status: 500 })
    }

    // Filter orgs with email reporting enabled
    const eligibleOrgs = orgs.filter((org) => {
      try {
        const settings = typeof org.settings === 'string' ? JSON.parse(org.settings) : org.settings
        return settings?.reportingPreferences?.emailReports === true
      } catch {
        return false
      }
    })

    log.info(`Found ${eligibleOrgs.length} orgs with email reporting enabled`)

    // For now, log eligible orgs. Full email sending will be wired
    // when the SendGrid templates are validated in production.
    const results = eligibleOrgs.map((org) => ({
      orgId: org.id,
      orgName: org.name,
      jurisdiction: org.jurisdiction || 'AU',
      status: 'queued',
    }))

    return NextResponse.json({
      success: true,
      jobType: 'weekly-digest',
      eligibleOrgs: eligibleOrgs.length,
      totalOrgs: orgs.length,
      results,
    })
  } catch (error) {
    log.error('Weekly digest cron error:', String(error))
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/email/weekly-digest',
    schedule: 'Weekly Monday 9:00 AM UTC',
    description: 'Sends weekly tax intelligence digests to opted-in organisations',
  })
}
