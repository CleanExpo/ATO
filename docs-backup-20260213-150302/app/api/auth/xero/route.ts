import { NextRequest, NextResponse } from 'next/server'
import { createXeroClient } from '@/lib/xero/client'
import crypto from 'crypto'
import { createLogger } from '@/lib/logger'
import { isSingleUserMode } from '@/lib/auth/single-user-check'
import { createClient } from '@/lib/supabase/server'
import { applyRateLimit, RATE_LIMITS } from '@/lib/middleware/apply-rate-limit'
import { serverConfig, sharedConfig } from '@/lib/config/env'

export const dynamic = 'force-dynamic'

const log = createLogger('api:auth:xero')

// GET /api/auth/xero - Initiate Xero OAuth flow
// Single-user mode: No authentication required
// Supports ?prompt=login to force account selection for connecting different Xero accounts
export async function GET(request: NextRequest) {
    // Rate limit OAuth initiation (SEC-003)
    const rateLimitResult = applyRateLimit(request, RATE_LIMITS.auth, 'oauth:xero')
    if (rateLimitResult) return rateLimitResult

    const baseUrl = request.nextUrl.origin
    const forceLogin = request.nextUrl.searchParams.get('prompt') === 'login'

    // Require authentication (skip in single-user mode)
    if (!isSingleUserMode()) {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }
    }

    try {
        // Check environment variables before creating client
        if (!serverConfig.xero.clientId || !serverConfig.xero.clientSecret) {
            console.error('[CRITICAL] Missing Xero OAuth credentials', {
                hasClientId: !!serverConfig.xero.clientId,
                hasClientSecret: !!serverConfig.xero.clientSecret,
            })
            return NextResponse.redirect(
                `${baseUrl}/dashboard?error=${encodeURIComponent('Xero OAuth not configured. Please contact support.')}`
            )
        }

        // Generate state for CSRF protection
        const state = crypto.randomUUID()

        // Build the consent URL
        log.info('Creating Xero client', { baseUrl })
        const client = createXeroClient({ state, baseUrl })

        log.info('Building consent URL')
        let consentUrl = await client.buildConsentUrl()
        log.info('Consent URL built successfully')

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
            secure: sharedConfig.isProduction,
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
