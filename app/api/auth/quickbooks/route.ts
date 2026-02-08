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
import { createLogger } from '@/lib/logger'
import crypto from 'crypto'

const log = createLogger('api:auth:quickbooks')

export async function GET(_request: NextRequest) {
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

    // Generate cryptographic nonce for CSRF protection (B-2 fix)
    const nonce = crypto.randomUUID()

    // State includes user context + unpredictable nonce
    const state = Buffer.from(
      JSON.stringify({
        tenantId: user.id,
        timestamp: Date.now(),
        nonce,
      })
    ).toString('base64url')

    // Build authorization URL
    const authUrl = new URL(QUICKBOOKS_CONFIG.authorizationUrl)
    authUrl.searchParams.set('client_id', QUICKBOOKS_CONFIG.clientId)
    authUrl.searchParams.set('scope', QUICKBOOKS_CONFIG.scopes.join(' '))
    authUrl.searchParams.set('redirect_uri', QUICKBOOKS_CONFIG.redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', state)

    log.info('QuickBooks OAuth initiated', { tenantId: user.id })

    // Store nonce in httpOnly cookie for server-side verification
    const response = NextResponse.redirect(authUrl.toString())
    response.cookies.set('qb_oauth_nonce', nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    })

    return response

  } catch (error) {
    console.error('QuickBooks OAuth initiation error:', error)
    return createErrorResponse(error, {
      operation: 'quickbooks_oauth_init',
    }, 500)
  }
}
