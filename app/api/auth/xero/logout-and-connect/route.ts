import { NextRequest, NextResponse } from 'next/server'
import { isSingleUserMode } from '@/lib/auth/single-user-check'
import { createClient } from '@/lib/supabase/server'
import { applyRateLimit, RATE_LIMITS } from '@/lib/middleware/apply-rate-limit'

/**
 * GET /api/auth/xero/logout-and-connect
 *
 * Two-step process to allow connecting with different Xero credentials:
 * 1. Redirect to Xero logout endpoint to clear the session
 * 2. Xero logout will redirect back to our OAuth initiation
 *
 * This ensures the user can log in with different credentials.
 */
export async function GET(request: NextRequest) {
  // Rate limit OAuth initiation (SEC-003)
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.auth, 'oauth:xero:logout-connect')
  if (rateLimitResult) return rateLimitResult

  // Require authentication (skip in single-user mode)
  if (!isSingleUserMode()) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
  }

  const baseUrl = request.nextUrl.origin

  // Build the OAuth initiation URL that Xero will redirect to after logout
  const returnUrl = `${baseUrl}/api/auth/xero?prompt=login`

  // Xero logout endpoint with return URL
  const logoutUrl = `https://login.xero.com/identity/user/logout?returnUrl=${encodeURIComponent(returnUrl)}`

  return NextResponse.redirect(logoutUrl)
}
