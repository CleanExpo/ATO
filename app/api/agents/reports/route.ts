import { NextRequest, NextResponse } from 'next/server'
import { requireAuthOnly, isErrorResponse } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Authenticate user
  const auth = await requireAuthOnly(request)
  if (isErrorResponse(auth)) return auth

  const agentId = request.nextUrl.searchParams.get('agentId')
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100')

  const supabase = await createServiceClient()

  try {
    let query = supabase
      .from('agent_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    // Filter by agent if specified
    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ reports: data || [] })

  } catch (error: unknown) {
    console.error('Failed to fetch agent reports:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Authenticate user
  const auth = await requireAuthOnly(request)
  if (isErrorResponse(auth)) return auth

  const supabase = await createServiceClient()

  try {
    const body = await request.json()
    const { agent_id, status, findings, recommendations, metadata } = body

    // Validate required fields
    if (!agent_id || !status) {
      return NextResponse.json(
        { error: 'agent_id and status are required' },
        { status: 400 }
      )
    }

    // Insert report
    const { data, error } = await supabase
      .from('agent_reports')
      .insert({
        agent_id,
        status,
        findings: findings || [],
        recommendations: recommendations || [],
        metadata: metadata || {}
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ report: data }, { status: 201 })

  } catch (error: unknown) {
    console.error('Failed to create agent report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
