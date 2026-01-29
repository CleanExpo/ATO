/**
 * MYOB OAuth 2.0 Authorization Endpoint
 *
 * Initiates OAuth flow by redirecting to MYOB authorization page
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MYOB_AUTH_URL = 'https://secure.myob.com/oauth2/account/authorize'
const MYOB_CLIENT_ID = process.env.MYOB_CLIENT_ID || ''
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL}/api/auth/myob/callback`

/**
 * GET /api/auth/myob/authorize
 *
 * Redirects to MYOB OAuth authorization page
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.redirect(
        new URL('/login?error=unauthorized', request.url)
      )
    }

    // Build authorization URL
    const authUrl = new URL(MYOB_AUTH_URL)
    authUrl.searchParams.set('client_id', MYOB_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'CompanyFile')
    authUrl.searchParams.set('state', user.id) // Use user ID as state for CSRF protection

    // Redirect to MYOB authorization page
    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    console.error('MYOB authorization error:', error)
    return NextResponse.redirect(
      new URL('/dashboard?error=myob_auth_failed', request.url)
    )
  }
}
