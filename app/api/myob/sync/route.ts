/**
 * MYOB Historical Data Sync API
 *
 * POST /api/myob/sync
 *
 * Triggers historical data sync for MYOB AccountRight (5 years)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMYOBHistoricalTransactions } from '@/lib/integrations/myob-historical-fetcher'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger'
import { decryptStoredToken } from '@/lib/xero/token-store'

export const dynamic = 'force-dynamic'

const log = createLogger('api:myob:sync')

/**
 * POST /api/myob/sync
 *
 * Start historical data sync for MYOB company file
 *
 * Body:
 * - companyFileId: string (required)
 * - organizationId: string (optional, for multi-org support)
 * - years: number (optional, default: 5)
 * - forceResync: boolean (optional, default: false)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.companyFileId || typeof body.companyFileId !== 'string') {
      return createValidationError('companyFileId is required and must be a string')
    }

    const companyFileId = body.companyFileId
    const organizationId = body.organizationId || undefined
    const years = body.years || 5
    const forceResync = body.forceResync || false

    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get MYOB connection for this company file (with optional organization filtering)
    let query = supabase
      .from('myob_connections')
      .select('*')
      .eq('company_file_id', companyFileId)
      .eq('user_id', user.id)

    // Multi-org support: Filter by organization if provided
    if (organizationId) {
      query = query.eq('organization_id', organizationId)
    }

    const { data: connection, error: connectionError } = await query.single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'MYOB connection not found' },
        { status: 404 }
      )
    }

    // Check if token is expired
    const isExpired = new Date(connection.expires_at) < new Date()
    if (isExpired) {
      return NextResponse.json(
        {
          error: 'MYOB token expired',
          message: 'Please reconnect your MYOB account',
          reconnectUrl: '/api/auth/myob/authorize'
        },
        { status: 401 }
      )
    }

    log.info('Starting historical data sync', { companyFileId })

    // Start sync in background (don't await - let it run async)
    // Decrypt tokens from database (SEC-001)
    fetchMYOBHistoricalTransactions(
      {
        accessToken: decryptStoredToken(connection.access_token),
        refreshToken: decryptStoredToken(connection.refresh_token),
        companyFileId: connection.company_file_id,
        apiBaseUrl: connection.api_base_url,
      },
      {
        years,
        forceResync,
      }
    ).catch(error => {
      console.error('[MYOB Sync] Background sync failed:', error)
    })

    // Return immediately with sync started status
    return NextResponse.json({
      status: 'syncing',
      message: 'MYOB historical data sync started',
      companyFileId,
      years,
      pollUrl: `/api/myob/sync-status/${companyFileId}`,
    })

  } catch (error) {
    console.error('[MYOB Sync] Error:', error)
    return createErrorResponse(error, {
      operation: 'startMYOBSync',
    }, 500)
  }
}
