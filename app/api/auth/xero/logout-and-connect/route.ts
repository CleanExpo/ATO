import { NextRequest, NextResponse } from 'next/server'

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
  const baseUrl = request.nextUrl.origin

  // Build the OAuth initiation URL that Xero will redirect to after logout
  const returnUrl = `${baseUrl}/api/auth/xero?prompt=login`

  // Xero logout endpoint with return URL
  const logoutUrl = `https://login.xero.com/identity/user/logout?returnUrl=${encodeURIComponent(returnUrl)}`

  return NextResponse.redirect(logoutUrl)
}
