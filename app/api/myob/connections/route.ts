/**
 * MYOB Connections API
 *
 * List and manage MYOB AccountRight connections
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/myob/connections
 *
 * List user's MYOB connections
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch MYOB connections
    const { data: connections, error } = await supabase
      .from('myob_connections')
      .select('*')
      .eq('user_id', user.id)
      .order('connected_at', { ascending: false })

    if (error) {
      console.error('Error fetching MYOB connections:', error)
      return NextResponse.json(
        { error: 'Failed to fetch connections' },
        { status: 500 }
      )
    }

    // Return connections with sensitive data redacted
    const sanitizedConnections = connections.map((conn) => ({
      id: conn.id,
      companyFileId: conn.company_file_id,
      companyFileName: conn.company_file_name,
      countryCode: conn.country_code,
      currencyCode: conn.currency_code,
      connectedAt: conn.connected_at,
      lastSyncedAt: conn.last_synced_at,
      expiresAt: conn.expires_at,
      isExpired: new Date(conn.expires_at) < new Date(),
    }))

    return NextResponse.json({
      connections: sanitizedConnections,
      count: sanitizedConnections.length,
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/myob/connections:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/myob/connections
 *
 * Disconnect MYOB connection
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('id')

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete connection
    const { error } = await supabase
      .from('myob_connections')
      .delete()
      .eq('id', connectionId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting MYOB connection:', error)
      return NextResponse.json(
        { error: 'Failed to delete connection' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'MYOB connection disconnected successfully',
    })
  } catch (error) {
    console.error('Unexpected error in DELETE /api/myob/connections:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
