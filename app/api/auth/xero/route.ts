import { NextRequest, NextResponse } from 'next/server'
import { createXeroClient } from '@/lib/xero/client'
import { requireUser } from '@/lib/supabase/auth'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
    const baseUrl = request.nextUrl.origin
    const user = await requireUser()

    if (!user) {
        const loginUrl = new URL('/auth/login', baseUrl)
        loginUrl.searchParams.set('returnTo', request.nextUrl.pathname)
        return NextResponse.redirect(loginUrl.toString())
    }

    try {
        // Generate state for CSRF protection (keep it simple)
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
        return NextResponse.redirect(`${baseUrl}/auth/error?message=Failed to connect to Xero`)
    }
}
