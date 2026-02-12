/**
 * Initiate Xero OAuth Flow
 *
 * Redirects user to Xero authorization page
 */

import { NextRequest, NextResponse } from 'next/server'
import { isSingleUserMode } from '@/lib/auth/single-user-check'
import { createClient } from '@/lib/supabase/server'
import { applyRateLimit, RATE_LIMITS } from '@/lib/middleware/apply-rate-limit'
import { serverConfig, sharedConfig } from '@/lib/config/env'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    // Rate limit OAuth initiation (SEC-003)
    const rateLimitResult = applyRateLimit(request, RATE_LIMITS.auth, 'oauth:xero:connect')
    if (rateLimitResult) return rateLimitResult

    // Require authentication (skip in single-user mode)
    if (!isSingleUserMode()) {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }
    }

    try {
        // Check environment variables inline to provide better error messages
        const xeroClientId = serverConfig.xero.clientId
        const xeroClientSecret = serverConfig.xero.clientSecret

        if (!xeroClientId || !xeroClientSecret) {
            console.error('Missing Xero OAuth credentials:', {
                hasClientId: !!xeroClientId,
                hasClientSecret: !!xeroClientSecret,
            })
            return NextResponse.json(
                {
                    error: 'Xero OAuth not configured',
                    details: 'Missing XERO_CLIENT_ID or XERO_CLIENT_SECRET environment variables',
                    debug: {
                        hasClientId: !!xeroClientId,
                        hasClientSecret: !!xeroClientSecret,
                    }
                },
                { status: 500 }
            )
        }

        // Resolve base URL from centralised config
        const baseUrl = sharedConfig.baseUrl

        // Generate random state for CSRF protection
        const state = crypto.randomUUID()

        // Build Xero OAuth URL
        const xeroAuthUrl = new URL('https://login.xero.com/identity/connect/authorize')
        xeroAuthUrl.searchParams.set('response_type', 'code')
        xeroAuthUrl.searchParams.set('client_id', xeroClientId)
        xeroAuthUrl.searchParams.set('redirect_uri', `${baseUrl}/api/auth/xero/callback`)
        xeroAuthUrl.searchParams.set('scope', 'openid profile email accounting.transactions.read accounting.reports.read accounting.contacts.read accounting.settings.read')
        xeroAuthUrl.searchParams.set('state', state)

        // Force re-authentication to show all available organizations
        // This prevents Xero from using cached session and only showing previously selected orgs
        xeroAuthUrl.searchParams.set('prompt', 'login')     // Force Xero login screen
        xeroAuthUrl.searchParams.set('max_age', '0')        // Don't use cached authentication

        // Return the state so client can store it
        return NextResponse.json({
            authUrl: xeroAuthUrl.toString(),
            state,
            debug: {
                forcedReauth: true,
                prompt: 'login',
                note: 'User will see all organizations in Xero selector'
            }
        })
    } catch (error) {
        console.error('Failed to initiate Xero OAuth:', error)
        return NextResponse.json(
            { error: 'Failed to initiate Xero connection' },
            { status: 500 }
        )
    }
}
