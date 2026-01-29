import { NextRequest, NextResponse } from 'next/server'
import { createXeroClient } from '@/lib/xero/client'
import crypto from 'crypto'

// GET /api/auth/xero - Initiate Xero OAuth flow
// Single-user mode: No authentication required
// Supports ?prompt=login to force account selection for connecting different Xero accounts
export async function GET(request: NextRequest) {
    const baseUrl = request.nextUrl.origin
    const forceLogin = request.nextUrl.searchParams.get('prompt') === 'login'

    try {
        // Generate state for CSRF protection
        const state = crypto.randomUUID()

        // Build the consent URL
        const client = createXeroClient({ state, baseUrl })
        let consentUrl = await client.buildConsentUrl()

        // Add max_age=0 to force Xero to re-authenticate
        // This invalidates the current session and requires a fresh login
        // Allows connecting organizations with different Xero credentials
        if (forceLogin) {
            const url = new URL(consentUrl)
            url.searchParams.set('max_age', '0')
            consentUrl = url.toString()
        }

        // Create response with redirect
        const response = NextResponse.redirect(consentUrl)

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
        return NextResponse.redirect(`${baseUrl}/dashboard?error=Failed to connect to Xero`)
    }
}
