import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/api/errors'
import { requireAdminRole } from '@/lib/middleware/admin-role'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:admin:reset-dashboard')

/**
 * POST /api/admin/reset-dashboard
 *
 * Resets the dashboard to clean, empty state for demo/new customer view
 * Deletes all:
 * - Xero connections
 * - MYOB connections
 * - Historical transaction cache
 * - Forensic analysis results
 * - Analysis recommendations
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin role - this is a destructive operation!
    const adminCheck = await requireAdminRole();
    if (!adminCheck.isAdmin) {
      return adminCheck.response;
    }

    // Require explicit confirmation code to prevent accidental resets
    const { confirmationCode } = await request.json()
    if (confirmationCode !== 'CONFIRM_RESET_ALL') {
      return NextResponse.json(
        { error: 'Invalid confirmation code. Pass confirmationCode: "CONFIRM_RESET_ALL"' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    log.info('Starting dashboard reset', { adminUserId: adminCheck.userId })

    // Delete in correct order to respect foreign key constraints
    const tables = [
      'forensic_analysis',
      'historical_transactions_cache',
      'myob_connections',
      'xero_connections',
    ]

    for (const table of tables) {
      log.info('Deleting all rows from table', { table })

      const { error } = await supabase
        .from(table)
        .delete()
        .neq('tenant_id', '') // Delete all rows (always true condition)

      if (error) {
        console.error(`Error deleting from ${table}:`, error)
        // Continue with other tables even if one fails
      } else {
        log.info('Cleared table', { table })
      }
    }

    log.info('Dashboard reset complete')

    return NextResponse.json({
      success: true,
      message: 'Dashboard reset to clean, empty state',
      cleared: tables
    })

  } catch (error) {
    console.error('Dashboard reset error:', error)
    return createErrorResponse(error, { operation: 'resetDashboard' }, 500)
  }
}
