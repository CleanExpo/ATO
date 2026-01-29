/**
 * Initiate Xero OAuth Flow
 *
 * Redirects user to Xero authorization page
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest) {
    try {
        // Check environment variables inline to provide better error messages
        const xeroClientId = process.env.XERO_CLIENT_ID
        const xeroClientSecret = process.env.XERO_CLIENT_SECRET

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

        // Resolve base URL
        let baseUrl = process.env.NEXT_PUBLIC_BASE_URL
        if (!baseUrl && process.env.VERCEL_URL) {
            baseUrl = `https://${process.env.VERCEL_URL}`
        }
        if (!baseUrl) {
            baseUrl = `http://localhost:${process.env.PORT || '3000'}`
        }

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
