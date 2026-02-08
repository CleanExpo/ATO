/**
 * QuickBooks Disconnect Endpoint
 *
 * POST /api/auth/quickbooks/disconnect
 *
 * Revokes QuickBooks access and deletes stored tokens.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revokeQuickBooksAccess } from '@/lib/integrations/quickbooks-client'
import { createErrorResponse } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:auth:quickbooks-disconnect')

export async function POST(_request: NextRequest) {
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

    // Revoke QuickBooks access
    await revokeQuickBooksAccess(user.id)

    log.info('QuickBooks disconnected', { tenantId: user.id })

    return NextResponse.json({
      success: true,
      message: 'QuickBooks disconnected successfully',
    })

  } catch (error) {
    console.error('QuickBooks disconnect error:', error)
    return createErrorResponse(error, {
      operation: 'quickbooks_disconnect',
    }, 500)
  }
}
