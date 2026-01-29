/**
 * Council Decisions API
 *
 * POST: Convene the council and get a decision
 * GET: Retrieve past council sessions
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthOnly, isErrorResponse } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { CouncilOfLogicOrchestrator } from '@/agents/council/council-orchestrator'
import type { CouncilContext, CouncilDecisionType } from '@/agents/council/types'

export async function POST(request: NextRequest) {
  // Authenticate user
  const auth = await requireAuthOnly(request)
  if (isErrorResponse(auth)) return auth

  try {
    const body = await request.json()
    const {
      type,
      organisationId,
      userId,
      turing,
      vonNeumann,
      bezier,
      shannon,
      metadata
    } = body as Partial<CouncilContext>

    // Validate required fields
    if (!type || !organisationId) {
      return NextResponse.json(
        { error: 'type and organisationId are required' },
        { status: 400 }
      )
    }

    // Validate decision type
    const validTypes: CouncilDecisionType[] = [
      'monitoring-cycle',
      'user-action',
      'data-sync',
      'analysis-request',
      'report-generation',
      'animation-optimisation',
      'prompt-optimisation'
    ]

    if (!validTypes.includes(type as CouncilDecisionType)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Create council and convene
    const council = new CouncilOfLogicOrchestrator(organisationId)

    const context: CouncilContext = {
      type: type as CouncilDecisionType,
      organisationId,
      userId,
      turing,
      vonNeumann,
      bezier,
      shannon,
      metadata
    }

    const decision = await council.convene(context)

    return NextResponse.json({ decision }, { status: 201 })

  } catch (error: unknown) {
    console.error('Council convene failed:', error)
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
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')
  const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0')

  if (!organisationId) {
    return NextResponse.json(
      { error: 'organisationId is required' },
      { status: 400 }
    )
  }

  const supabase = await createServiceClient()

  try {
    const { data, error, count } = await supabase
      .from('council_sessions')
      .select('*', { count: 'exact' })
      .eq('organisation_id', organisationId)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      sessions: data || [],
      total: count || 0,
      limit,
      offset
    })

  } catch (error: unknown) {
    console.error('Failed to fetch council sessions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
