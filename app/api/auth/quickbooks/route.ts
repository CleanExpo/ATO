/**
 * QuickBooks OAuth 2.0 Initiation Endpoint
 *
 * GET /api/auth/quickbooks
 *
 * Initiates QuickBooks Online OAuth 2.0 flow by redirecting user to Intuit authorization page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { QUICKBOOKS_CONFIG } from '@/lib/integrations/quickbooks-config'
import { createErrorResponse } from '@/lib/api/errors'

export async function GET(request: NextRequest) {
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

    // Validate QuickBooks configuration
    if (!QUICKBOOKS_CONFIG.clientId) {
      return NextResponse.json(
        { error: 'QuickBooks not configured. Please set QUICKBOOKS_CLIENT_ID in environment.' },
        { status: 500 }
      )
    }

    // Generate state parameter for CSRF protection
    const state = Buffer.from(
      JSON.stringify({
        tenantId: user.id,
        timestamp: Date.now(),
      })
    ).toString('base64url')

    // Build authorization URL
    const authUrl = new URL(QUICKBOOKS_CONFIG.authorizationUrl)
    authUrl.searchParams.set('client_id', QUICKBOOKS_CONFIG.clientId)
    authUrl.searchParams.set('scope', QUICKBOOKS_CONFIG.scopes.join(' '))
    authUrl.searchParams.set('redirect_uri', QUICKBOOKS_CONFIG.redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', state)

    console.log('QuickBooks OAuth initiated for tenant:', user.id)

    // Redirect to QuickBooks authorization page
    return NextResponse.redirect(authUrl.toString())

  } catch (error) {
    console.error('QuickBooks OAuth initiation error:', error)
    return createErrorResponse(error, {
      operation: 'quickbooks_oauth_init',
    }, 500)
  }
}
