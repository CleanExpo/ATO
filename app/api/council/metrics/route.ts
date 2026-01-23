/**
 * Council Metrics API
 *
 * GET: Get aggregated metrics for the council and advisors
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthOnly, isErrorResponse } from '@/lib/auth/require-auth'
import { CouncilOfLogicOrchestrator } from '@/agents/council/council-orchestrator'

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

  try {
    // Calculate period
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get metrics from council
    const council = new CouncilOfLogicOrchestrator(organisationId)
    const metrics = await council.getMetrics({ start: startDate, end: endDate })

    // Get council status
    const status = council.getStatus()

    return NextResponse.json({
      status,
      metrics,
      period: {
        days,
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    })

  } catch (error: unknown) {
    console.error('Failed to fetch council metrics:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
