/**
 * QuickBooks Historical Data Sync Endpoint
 *
 * POST /api/quickbooks/sync
 *
 * Fetches and caches historical transaction data from QuickBooks Online.
 *
 * Body (optional):
 * - startDate: string (YYYY-MM-DD format)
 * - endDate: string (YYYY-MM-DD format)
 * - organizationId: string (for multi-org support)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncQuickBooksHistoricalData } from '@/lib/integrations/quickbooks-historical-fetcher'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in first.' },
        { status: 401 }
      )
    }

    // Parse request body (optional date filters and organization ID)
    let body: {
      startDate?: string
      endDate?: string
      organizationId?: string
    } = {}

    try {
      body = await request.json()
    } catch {
      // Body is optional
    }

    // Validate date formats if provided
    if (body.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.startDate)) {
      return createValidationError('startDate must be in YYYY-MM-DD format')
    }

    if (body.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.endDate)) {
      return createValidationError('endDate must be in YYYY-MM-DD format')
    }

    console.log('Starting QuickBooks sync for tenant:', user.id, body.organizationId ? `org: ${body.organizationId}` : '')

    // Start sync (runs in background)
    const result = await syncQuickBooksHistoricalData(user.id, {
      startDate: body.startDate,
      endDate: body.endDate,
      organizationId: body.organizationId,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Sync failed',
          success: false,
        },
        { status: 500 }
      )
    }

    console.log(`QuickBooks sync complete: ${result.transactionsSynced} transactions`)

    return NextResponse.json({
      success: true,
      transactionsSynced: result.transactionsSynced,
      message: `Successfully synced ${result.transactionsSynced} QuickBooks transactions`,
    })

  } catch (error) {
    console.error('QuickBooks sync error:', error)
    return createErrorResponse(error, {
      operation: 'quickbooks_sync',
    }, 500)
  }
}
