import { NextResponse } from 'next/server'
import { createXeroClient, XERO_SCOPES } from '@/lib/xero/client'
import crypto from 'crypto'

export async function GET() {
    try {
        const client = createXeroClient()

        // Generate state for CSRF protection (keep it simple)
        const state = crypto.randomUUID()

        // Build the consent URL
        const consentUrl = await client.buildConsentUrl()

        // Add state parameter to URL
        const url = new URL(consentUrl)
        url.searchParams.set('state', state)

        // Create response with redirect
        const response = NextResponse.redirect(url.toString())

        // Store state in cookie for verification
        response.cookies.set('xero_oauth_state', state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 10, // 10 minutes
            path: '/'
        })

        return response
    } catch (error) {
        console.error('Failed to initiate Xero OAuth:', error)
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_BASE_URL}/auth/error?message=Failed to connect to Xero`
        )
    }
}
