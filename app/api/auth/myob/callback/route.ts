/**
 * MYOB OAuth 2.0 Callback Endpoint
 *
 * Handles OAuth callback from MYOB and exchanges code for tokens
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const MYOB_TOKEN_URL = 'https://secure.myob.com/oauth2/v1/authorize'
const MYOB_CLIENT_ID = process.env.MYOB_CLIENT_ID || ''
const MYOB_CLIENT_SECRET = process.env.MYOB_CLIENT_SECRET || ''
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL}/api/auth/myob/callback`

/**
 * GET /api/auth/myob/callback
 *
 * Exchanges authorization code for access token and stores in database
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // User ID
    const error = searchParams.get('error')

    // Handle authorization errors
    if (error || !code || !state) {
      return NextResponse.redirect(
        new URL(
          `/dashboard?error=myob_auth_failed&reason=${error || 'missing_params'}`,
          request.url
        )
      )
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(MYOB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: MYOB_CLIENT_ID,
        client_secret: MYOB_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('MYOB token exchange failed:', errorData)
      return NextResponse.redirect(
        new URL('/dashboard?error=myob_token_failed', request.url)
      )
    }

    const tokens = await tokenResponse.json()

    // Fetch company files
    const companyFilesResponse = await fetch(
      'https://api.myob.com/accountright',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'x-myobapi-key': MYOB_CLIENT_ID,
          'x-myobapi-version': 'v2',
        },
      }
    )

    if (!companyFilesResponse.ok) {
      console.error('Failed to fetch MYOB company files')
      return NextResponse.redirect(
        new URL('/dashboard?error=myob_company_files_failed', request.url)
      )
    }

    const companyFiles = await companyFilesResponse.json()

    // If only one company file, select it automatically
    // If multiple, redirect to selection page
    if (!Array.isArray(companyFiles) || companyFiles.length === 0) {
      return NextResponse.redirect(
        new URL('/dashboard?error=no_company_files', request.url)
      )
    }

    let selectedCompanyFile = companyFiles[0]

    // If multiple company files, use the first one or redirect to selection
    if (companyFiles.length > 1) {
      // TODO: Implement company file selection UI
      // For now, use the first one
      console.log(`Multiple MYOB company files found, using first: ${selectedCompanyFile.Name}`)
    }

    // Store connection in database
    const supabase = await createServiceClient()

    const { error: dbError } = await supabase.from('myob_connections').upsert({
      user_id: state,
      company_file_id: selectedCompanyFile.Id,
      company_file_name: selectedCompanyFile.Name,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      api_base_url: selectedCompanyFile.Uri,
    })

    if (dbError) {
      console.error('Failed to store MYOB connection:', dbError)
      return NextResponse.redirect(
        new URL('/dashboard?error=db_storage_failed', request.url)
      )
    }

    // Success! Redirect to dashboard
    return NextResponse.redirect(
      new URL('/dashboard?connected=myob&success=true', request.url)
    )
  } catch (error) {
    console.error('MYOB callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard?error=myob_callback_failed', request.url)
    )
  }
}
