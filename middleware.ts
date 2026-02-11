/**
 * Root Middleware - Supabase Auth Session Refresh + API Audit Logging
 *
 * CRITICAL: This middleware refreshes the Supabase auth session on every request.
 * Without this, server-side auth (getUser) fails because expired tokens are never refreshed.
 * See: https://supabase.com/docs/guides/auth/server-side/nextjs
 *
 * Also protects /dashboard routes (redirects to /auth/login if unauthenticated)
 * and logs API requests for audit purposes.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: [
    // Match all routes except static files and images
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

export async function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID()

  // Create a response that we can modify (pass updated cookies through)
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Update cookies on the request (for downstream server components)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Recreate the response with updated request
          supabaseResponse = NextResponse.next({ request })
          // Set cookies on the response (sent back to browser)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do NOT use getSession() — it reads from cookies without validation.
  // getUser() sends a request to the Supabase Auth server to validate and refresh the token.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect dashboard routes — redirect to login if not authenticated
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith('/dashboard') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // API audit logging
  if (pathname.startsWith('/api/')) {
    let userId: string | null = user?.id ?? null

    const tenantId =
      request.nextUrl.searchParams.get('tenantId') ||
      request.nextUrl.searchParams.get('tenant_id') ||
      null

    const entry = {
      level: 'INFO',
      module: 'middleware:api-audit',
      msg: 'API request',
      ts: new Date().toISOString(),
      requestId,
      method: request.method,
      path: pathname,
      userId,
      tenantId,
      ip: (() => {
        const xff = request.headers.get('x-forwarded-for')
        if (!xff) return null
        const parts = xff.split(',').map(s => s.trim()).filter(Boolean)
        return parts[parts.length - 1] || null
      })(),
    }

    console.log(JSON.stringify(entry))
  }

  // Add request ID to response headers
  supabaseResponse.headers.set('x-request-id', requestId)

  return supabaseResponse
}
