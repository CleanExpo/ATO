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
import { createServiceClient } from '@/lib/supabase/server'
import { QUICKBOOKS_CONFIG } from '@/lib/integrations/quickbooks-config'
import { storeQuickBooksTokens, createQuickBooksClient } from '@/lib/integrations/quickbooks-client'
import { createErrorResponse } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:auth:quickbooks-callback')

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

    // Store tokens initially (without organization_id) so we can fetch company info
    await storeQuickBooksTokens(user.id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      realm_id: realmId,
    }, null)

    // Multi-org support: Find or create organization for this QuickBooks company
    let organizationId: string | null = null

    try {
      const supabaseService = await createServiceClient()

      // Check if organization already exists for this QuickBooks realm
      // Look for existing connection with this realm_id
      const { data: existingConnection } = await supabaseService
        .from('quickbooks_tokens')
        .select('organization_id')
        .eq('realm_id', realmId)
        .not('organization_id', 'is', null)
        .single()

      if (existingConnection?.organization_id) {
        organizationId = existingConnection.organization_id
        log.info('Found existing organization for QuickBooks realm', { organizationId })

        // Grant user access if not already granted
        const { data: existingAccess } = await supabaseService
          .from('user_tenant_access')
          .select('id')
          .eq('user_id', user.id)
          .eq('organization_id', organizationId)
          .single()

        if (!existingAccess) {
          await supabaseService.from('user_tenant_access').insert({
            user_id: user.id,
            organization_id: organizationId,
            tenant_id: realmId,
            role: 'owner',
          })
          log.info('Granted owner access to existing organization')
        }
      } else {
        // Fetch company info from QuickBooks API
        const qbClient = await createQuickBooksClient(user.id)
        const companyInfo = await qbClient.getCompanyInfo()

        // Create new organization for this QuickBooks company
        const { data: newOrg, error: orgError } = await supabaseService
          .from('organizations')
          .insert({
            name: companyInfo.companyName || companyInfo.legalName || 'My Organisation',
            settings: {},
            quickbooks_connected: true,
            quickbooks_connected_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (orgError) {
          console.error('Error creating organization:', orgError)
        } else if (newOrg) {
          organizationId = newOrg.id
          log.info('Created new organization', { organizationId })

          // Grant user owner access to this organization
          await supabaseService.from('user_tenant_access').insert({
            user_id: user.id,
            organization_id: organizationId,
            tenant_id: realmId,
            role: 'owner',
          })
          log.info('Granted owner access to new organization')
        }
      }

      // Update tokens with organization_id
      if (organizationId) {
        await storeQuickBooksTokens(user.id, {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          realm_id: realmId,
        }, organizationId)

        // Update organization connection status
        await supabaseService
          .from('organizations')
          .update({
            quickbooks_connected: true,
            quickbooks_connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', organizationId)
      }
    } catch (orgError) {
      // Log error but don't fail the OAuth flow
      console.error('Error setting up organization for QuickBooks:', orgError)
    }

    log.info('QuickBooks OAuth successful', { tenantId: user.id, realmId, orgId: organizationId })

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
