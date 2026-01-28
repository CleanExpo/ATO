/**
 * QuickBooks OAuth 2.0 Callback Endpoint
 *
 * GET /api/auth/quickbooks/callback
 *
 * Handles OAuth callback from QuickBooks, exchanges code for tokens,
 * and stores tokens securely in Supabase.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { QUICKBOOKS_CONFIG } from '@/lib/integrations/quickbooks-config'
import { storeQuickBooksTokens } from '@/lib/integrations/quickbooks-client'
import { createErrorResponse } from '@/lib/api/errors'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const realmId = searchParams.get('realmId')  // QuickBooks Company ID
    const error = searchParams.get('error')

    // Check for OAuth errors
    if (error) {
      console.error('QuickBooks OAuth error:', error)
      const errorDescription = searchParams.get('error_description')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?quickbooks_error=${encodeURIComponent(errorDescription || error)}`
      )
    }

    // Validate required parameters
    if (!code || !state || !realmId) {
      return NextResponse.json(
        { error: 'Missing required OAuth parameters (code, state, or realmId)' },
        { status: 400 }
      )
    }

    // Decode and validate state parameter
    let stateData: { tenantId: string; timestamp: number }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
    } catch {
      return NextResponse.json(
        { error: 'Invalid state parameter' },
        { status: 400 }
      )
    }

    // Check state timestamp (prevent replay attacks - expire after 10 minutes)
    const stateAge = Date.now() - stateData.timestamp
    if (stateAge > 10 * 60 * 1000) {
      return NextResponse.json(
        { error: 'OAuth state expired. Please try again.' },
        { status: 400 }
      )
    }

    // Verify user is still authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in again.' },
        { status: 401 }
      )
    }

    // Verify tenant ID matches
    if (user.id !== stateData.tenantId) {
      return NextResponse.json(
        { error: 'State mismatch. Possible CSRF attack detected.' },
        { status: 403 }
      )
    }

    // Exchange authorization code for access token
    const tokenUrl = QUICKBOOKS_CONFIG.tokenUrl

    const basicAuth = Buffer.from(
      `${QUICKBOOKS_CONFIG.clientId}:${QUICKBOOKS_CONFIG.clientSecret}`
    ).toString('base64')

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: QUICKBOOKS_CONFIG.redirectUri,
    })

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenParams.toString(),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('QuickBooks token exchange failed:', errorText)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?quickbooks_error=${encodeURIComponent('Token exchange failed')}`
      )
    }

    const tokens = await tokenResponse.json()

    // Store tokens in Supabase
    await storeQuickBooksTokens(user.id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      realm_id: realmId,
    })

    console.log('QuickBooks OAuth successful for tenant:', user.id, 'realmId:', realmId)

    // Redirect to dashboard with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?quickbooks_connected=true&realm_id=${realmId}`
    )

  } catch (error) {
    console.error('QuickBooks OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?quickbooks_error=${encodeURIComponent('Authentication failed')}`
    )
  }
}
