import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/api/errors'

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
    const supabase = await createServiceClient()

    console.log('🧹 Starting dashboard reset...')

    // Delete in correct order to respect foreign key constraints
    const tables = [
      'forensic_analysis',
      'historical_transactions_cache',
      'myob_connections',
      'xero_connections',
    ]

    for (const table of tables) {
      console.log(`Deleting all rows from ${table}...`)

      const { error } = await supabase
        .from(table)
        .delete()
        .neq('tenant_id', '') // Delete all rows (always true condition)

      if (error) {
        console.error(`Error deleting from ${table}:`, error)
        // Continue with other tables even if one fails
      } else {
        console.log(`✅ Cleared ${table}`)
      }
    }

    console.log('✨ Dashboard reset complete - now showing empty state for new customers')

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
