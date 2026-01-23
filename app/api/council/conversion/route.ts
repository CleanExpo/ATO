/**
 * Conversion Tracking API
 *
 * POST: Track a conversion event
 * GET: Get conversion funnel stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthOnly, isErrorResponse } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { CouncilOfLogicOrchestrator } from '@/agents/council/council-orchestrator'
import type { ConversionStage } from '@/agents/council/types'

const VALID_STAGES: ConversionStage[] = [
  'awareness',
  'interest',
  'decision',
  'action',
  'retention'
]

export async function POST(request: NextRequest) {
  // Authenticate user
  const auth = await requireAuthOnly(request)
  if (isErrorResponse(auth)) return auth

  try {
    const body = await request.json()
    const { organisationId, userId, stage, action, value, metadata } = body

    // Validate required fields
    if (!organisationId || !userId || !stage || !action) {
      return NextResponse.json(
        { error: 'organisationId, userId, stage, and action are required' },
        { status: 400 }
      )
    }

    // Validate stage
    if (!VALID_STAGES.includes(stage)) {
      return NextResponse.json(
        { error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}` },
        { status: 400 }
      )
    }

    // Track conversion
    const council = new CouncilOfLogicOrchestrator(organisationId)

    await council.trackConversion({
      organisationId,
      userId,
      stage: stage as ConversionStage,
      action,
      value: value || undefined,
      metadata: metadata || {}
    })

    return NextResponse.json(
      { success: true, message: 'Conversion event tracked' },
      { status: 201 }
    )

  } catch (error: unknown) {
    console.error('Conversion tracking failed:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Authenticate user
  const auth = await requireAuthOnly(request)
  if (isErrorResponse(auth)) return auth

  const organisationId = request.nextUrl.searchParams.get('organisationId')
  const days = parseInt(request.nextUrl.searchParams.get('days') || '30')

  if (!organisationId) {
    return NextResponse.json(
      { error: 'organisationId is required' },
      { status: 400 }
    )
  }

  const supabase = await createServiceClient()

  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get events by stage
    const { data: events, error: eventsError } = await supabase
      .from('conversion_events')
      .select('stage, action, value, created_at')
      .eq('organisation_id', organisationId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (eventsError) {
      console.error('Database error:', eventsError)
      return NextResponse.json({ error: eventsError.message }, { status: 500 })
    }

    // Aggregate by stage
    const stageCounts: Record<ConversionStage, number> = {
      awareness: 0,
      interest: 0,
      decision: 0,
      action: 0,
      retention: 0
    }

    const stageValues: Record<ConversionStage, number> = {
      awareness: 0,
      interest: 0,
      decision: 0,
      action: 0,
      retention: 0
    }

    for (const event of events || []) {
      const stage = event.stage as ConversionStage
      if (stageCounts[stage] !== undefined) {
        stageCounts[stage]++
        if (event.value) {
          stageValues[stage] += parseFloat(event.value)
        }
      }
    }

    // Calculate conversion rates
    const conversionRates: Record<string, number> = {}
    for (let i = 0; i < VALID_STAGES.length - 1; i++) {
      const fromStage = VALID_STAGES[i]
      const toStage = VALID_STAGES[i + 1]
      const fromCount = stageCounts[fromStage]
      const toCount = stageCounts[toStage]

      conversionRates[`${fromStage}_to_${toStage}`] =
        fromCount > 0 ? Math.round((toCount / fromCount) * 10000) / 100 : 0
    }

    // Calculate overall conversion
    const overallConversion =
      stageCounts.awareness > 0
        ? Math.round((stageCounts.action / stageCounts.awareness) * 10000) / 100
        : 0

    return NextResponse.json({
      period: { days, startDate: startDate.toISOString(), endDate: new Date().toISOString() },
      funnel: {
        stages: stageCounts,
        values: stageValues,
        conversionRates,
        overallConversion
      },
      totalEvents: events?.length || 0,
      totalValue: Object.values(stageValues).reduce((a, b) => a + b, 0)
    })

  } catch (error: unknown) {
    console.error('Failed to fetch conversion stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
