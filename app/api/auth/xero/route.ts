import { NextRequest, NextResponse } from 'next/server'
import { createXeroClient } from '@/lib/xero/client'
import crypto from 'crypto'

// GET /api/auth/xero - Initiate Xero OAuth flow
// Single-user mode: No authentication required
export async function GET(request: NextRequest) {
    const baseUrl = request.nextUrl.origin

    try {
        // Generate state for CSRF protection
        const state = crypto.randomUUID()

        // Build the consent URL
        const client = createXeroClient({ state, baseUrl })
        const consentUrl = await client.buildConsentUrl()

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
