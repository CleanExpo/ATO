/**
 * Auth Confirm Route — handles email verification and password reset callbacks
 *
 * Supabase sends email links in two formats:
 *
 * 1. PKCE flow (default for SSR): ?code=<auth_code>&type=<signup|recovery|invite>
 *    The code must be exchanged server-side via exchangeCodeForSession()
 *
 * 2. Token hash flow: ?token_hash=<hash>&type=<email|recovery>
 *    Used when confirmations happen via OTP or direct token
 *
 * After successful verification, the user is redirected to /dashboard.
 * On failure, they're redirected to /auth/error with an error description.
 *
 * See: https://supabase.com/docs/guides/auth/server-side/nextjs#create-api-endpoint-for-auth-confirmation
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { clientConfig } from '@/lib/config/env'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const redirectTo = searchParams.get('redirect_to') || '/dashboard'

  const baseUrl = request.nextUrl.origin

  // Need either a code or token_hash
  if (!code && !token_hash) {
    return NextResponse.redirect(
      `${baseUrl}/auth/error?error=${encodeURIComponent('Missing verification parameters. Please check your email link.')}`
    )
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    clientConfig.supabase.url,
    clientConfig.supabase.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from Server Component — middleware handles refresh
          }
        },
      },
    }
  )

  // Exchange the code for a session (PKCE flow)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth code exchange failed:', error.message)
      return NextResponse.redirect(
        `${baseUrl}/auth/error?error=${encodeURIComponent(error.message)}`
      )
    }

    // For password recovery, redirect to reset-password page
    if (type === 'recovery') {
      return NextResponse.redirect(`${baseUrl}/auth/reset-password`)
    }

    // Email verified — redirect to dashboard
    return NextResponse.redirect(`${baseUrl}${redirectTo}`)
  }

  // Verify OTP token hash
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'email' | 'recovery' | 'invite' | 'signup',
    })

    if (error) {
      console.error('Token verification failed:', error.message)
      return NextResponse.redirect(
        `${baseUrl}/auth/error?error=${encodeURIComponent(error.message)}`
      )
    }

    if (type === 'recovery') {
      return NextResponse.redirect(`${baseUrl}/auth/reset-password`)
    }

    return NextResponse.redirect(`${baseUrl}${redirectTo}`)
  }

  // Fallback
  return NextResponse.redirect(`${baseUrl}/auth/error?error=${encodeURIComponent('Invalid verification link.')}`)
}
