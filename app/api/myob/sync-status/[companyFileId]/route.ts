/**
 * MYOB Sync Status API
 *
 * GET /api/myob/sync-status/:companyFileId
 *
 * Returns current sync status for MYOB company file
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMYOBSyncStatus } from '@/lib/integrations/myob-historical-fetcher'
import { createErrorResponse } from '@/lib/api/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/myob/sync-status/:companyFileId
 *
 * Get sync progress for MYOB company file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyFileId: string }> }
) {
  try {
    const { companyFileId } = await params

    if (!companyFileId) {
      return NextResponse.json(
        { error: 'companyFileId is required' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns this company file
    const { data: connection, error: connectionError } = await supabase
      .from('myob_connections')
      .select('company_file_id')
      .eq('company_file_id', companyFileId)
      .eq('user_id', user.id)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'MYOB connection not found' },
        { status: 404 }
      )
    }

    // Get sync status
    const syncStatus = await getMYOBSyncStatus(companyFileId)

    if (!syncStatus) {
      // No sync started yet
      return NextResponse.json({
        status: 'idle',
        progress: 0,
        transactionsSynced: 0,
        totalEstimated: 0,
        yearsSynced: [],
        message: 'No sync started yet'
      })
    }

    return NextResponse.json(syncStatus)

  } catch (error) {
    console.error('[MYOB Sync Status] Error:', error)
    return createErrorResponse(error, {
      operation: 'getMYOBSyncStatus',
    }, 500)
  }
}
