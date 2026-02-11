/**
 * MYOB OAuth 2.0 Callback Endpoint
 *
 * Handles OAuth callback from MYOB and exchanges code for tokens
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/logger'
import { encryptTokenForStorage } from '@/lib/xero/token-store'

const log = createLogger('api:auth:myob-callback')

const MYOB_TOKEN_URL = 'https://secure.myob.com/oauth2/v1/authorize'
const MYOB_CLIENT_ID = process.env.MYOB_CLIENT_ID || ''
const MYOB_CLIENT_SECRET = process.env.MYOB_CLIENT_SECRET || ''
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/myob/callback`

/**
 * GET /api/auth/myob/callback
 *
 * Exchanges authorization code for access token and stores in database
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const returnedState = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle authorization errors
    if (error || !code || !returnedState) {
      return NextResponse.redirect(
        new URL(
          `/dashboard?error=myob_auth_failed&reason=${error || 'missing_params'}`,
          request.url
        )
      )
    }

    // Verify CSRF state from httpOnly cookie (B-2 fix)
    const storedCookie = request.cookies.get('myob_oauth_state')?.value
    let storedState: { state: string; userId: string } | null = null
    try {
      storedState = storedCookie ? JSON.parse(storedCookie) : null
    } catch {
      storedState = null
    }

    if (!storedState || storedState.state !== returnedState) {
      return NextResponse.redirect(
        new URL('/dashboard?error=myob_state_mismatch', request.url)
      )
    }

    // Use userId from the verified cookie, not from the URL parameter
    const state = storedState.userId

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

    const selectedCompanyFile = companyFiles[0]

    // If multiple company files, auto-select the first one.
    // FUTURE: Build a company file selection page at /dashboard/myob/select-company
    //   - Display all company files with Name, Id, and Uri
    //   - Store selected file ID in a cookie or query param, then redirect back here
    //   - The OAuth tokens are already obtained at this point, so the selection page
    //     would need to receive them via a short-lived server-side session or encrypted param
    //   - For now, the first company file is always used. Users with multiple company files
    //     should be aware only the first file (alphabetically by MYOB API order) is connected.
    if (companyFiles.length > 1) {
      log.info('Multiple MYOB company files found, auto-selecting first', {
        selectedCompanyName: selectedCompanyFile.Name,
        totalCompanyFiles: companyFiles.length,
        allCompanyFiles: companyFiles.map((f: { Name: string; Id: string }) => ({ name: f.Name, id: f.Id })),
      })
    }

    // Store connection in database
    const supabase = await createServiceClient()

    // Multi-org support: Find or create organization for this MYOB company file
    let organizationId: string | null = null

    try {
      // Check if organization already exists for this MYOB company file
      // Look for existing connection with this company_file_id
      const { data: existingConnection } = await supabase
        .from('myob_connections')
        .select('organization_id')
        .eq('company_file_id', selectedCompanyFile.Id)
        .not('organization_id', 'is', null)
        .single()

      if (existingConnection?.organization_id) {
        organizationId = existingConnection.organization_id
        log.info('Found existing organization for MYOB company', { organizationId })

        // Grant user access if not already granted
        const { data: existingAccess } = await supabase
          .from('user_tenant_access')
          .select('id')
          .eq('user_id', state)
          .eq('organization_id', organizationId)
          .single()

        if (!existingAccess) {
          await supabase.from('user_tenant_access').insert({
            user_id: state,
            organization_id: organizationId,
            tenant_id: null, // MYOB doesn't use tenant_id concept
            role: 'owner',
          })
          log.info('Granted owner access to existing MYOB organization')
        }
      } else {
        // Create new organization for this MYOB company file
        const { data: newOrg, error: orgError } = await supabase
          .from('organizations')
          .insert({
            name: selectedCompanyFile.Name || 'My Organisation',
            settings: {},
            myob_connected: true,
            myob_connected_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (orgError) {
          console.error('Error creating organization for MYOB:', orgError)
        } else if (newOrg) {
          organizationId = newOrg.id
          log.info('Created new organization for MYOB', { organizationId })

          // Grant user owner access to this organization
          await supabase.from('user_tenant_access').insert({
            user_id: state,
            organization_id: organizationId,
            tenant_id: null, // MYOB doesn't use tenant_id concept
            role: 'owner',
          })
          log.info('Granted owner access to new MYOB organization')
        }
      }
    } catch (orgError) {
      // Log error but don't fail the OAuth flow
      console.error('Error setting up organization for MYOB:', orgError)
    }

    // Encrypt tokens before storage (SEC-001)
    const encryptedAccessToken = encryptTokenForStorage(tokens.access_token)
    const encryptedRefreshToken = encryptTokenForStorage(tokens.refresh_token)

    // Store/update connection with organization_id
    const { error: dbError } = await supabase.from('myob_connections').upsert({
      user_id: state,
      company_file_id: selectedCompanyFile.Id,
      company_file_name: selectedCompanyFile.Name,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      api_base_url: selectedCompanyFile.Uri,
      organization_id: organizationId,
    })

    if (dbError) {
      console.error('Failed to store MYOB connection:', dbError)
      return NextResponse.redirect(
        new URL('/dashboard?error=db_storage_failed', request.url)
      )
    }

    // Update organization connection status
    if (organizationId) {
      await supabase
        .from('organizations')
        .update({
          myob_connected: true,
          myob_connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', organizationId)
    }

    log.info('MYOB OAuth successful', { userId: state, companyFileId: selectedCompanyFile.Id, orgId: organizationId })

    // Success! Redirect to dashboard
    const successResponse = NextResponse.redirect(
      new URL('/dashboard?connected=myob&success=true', request.url)
    )
    successResponse.cookies.delete('myob_oauth_state')
    return successResponse
  } catch (error) {
    console.error('MYOB callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard?error=myob_callback_failed', request.url)
    )
  }
}
