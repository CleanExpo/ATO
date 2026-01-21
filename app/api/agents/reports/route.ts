import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId')
  const limit = parseInt(searchParams.get('limit') || '100')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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

  } catch (error: any) {
    console.error('Failed to fetch agent reports:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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

  } catch (error: any) {
    console.error('Failed to create agent report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
