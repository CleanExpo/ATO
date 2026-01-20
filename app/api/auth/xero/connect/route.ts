/**
 * Initiate Xero OAuth Flow
 *
 * Redirects user to Xero authorization page
 */

import { NextRequest, NextResponse } from 'next/server'
import { requiredConfig } from '@/lib/config/env'

export async function GET(request: NextRequest) {
    try {
        // Generate random state for CSRF protection
        const state = crypto.randomUUID()

        // Build Xero OAuth URL
        const xeroAuthUrl = new URL('https://login.xero.com/identity/connect/authorize')
        xeroAuthUrl.searchParams.set('response_type', 'code')
        xeroAuthUrl.searchParams.set('client_id', requiredConfig.xero.clientId)
        xeroAuthUrl.searchParams.set('redirect_uri', requiredConfig.xero.redirectUri)
        xeroAuthUrl.searchParams.set('scope', 'openid profile email accounting.transactions.read accounting.reports.read accounting.contacts.read accounting.settings.read')
        xeroAuthUrl.searchParams.set('state', state)

        // Return the state so client can store it
        return NextResponse.json({
            authUrl: xeroAuthUrl.toString(),
            state,
        })
    } catch (error) {
        console.error('Failed to initiate Xero OAuth:', error)
        return NextResponse.json(
            { error: 'Failed to initiate Xero connection' },
            { status: 500 }
        )
    }
}
