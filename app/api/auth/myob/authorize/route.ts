/**
 * MYOB OAuth 2.0 Authorization Endpoint
 *
 * Initiates OAuth flow by redirecting to MYOB authorization page
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

const MYOB_AUTH_URL = 'https://secure.myob.com/oauth2/account/authorize'
const MYOB_CLIENT_ID = process.env.MYOB_CLIENT_ID || ''
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/myob/callback`

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

    // Generate cryptographic random state for CSRF protection (B-2 fix)
    const state = crypto.randomUUID()

    // Build authorization URL
    const authUrl = new URL(MYOB_AUTH_URL)
    authUrl.searchParams.set('client_id', MYOB_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'CompanyFile')
    authUrl.searchParams.set('state', state)

    // Store state + userId in httpOnly cookie for server-side verification
    const response = NextResponse.redirect(authUrl.toString())
    response.cookies.set('myob_oauth_state', JSON.stringify({ state, userId: user.id }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    })

    return response
  } catch (error) {
    console.error('MYOB authorization error:', error)
    return NextResponse.redirect(
      new URL('/dashboard?error=myob_auth_failed', request.url)
    )
  }
}
