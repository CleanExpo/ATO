/**
 * Root Middleware - API Request Audit Logging
 *
 * Logs every API request as a single structured JSON line to stdout.
 * Edge Runtime compatible - no Node.js APIs, no async I/O for logging.
 * Adds x-request-id header for correlation.
 */

import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: '/api/:path*',
}

export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const start = Date.now()

  // Extract userId from Supabase auth cookie JWT (best-effort, no verification)
  let userId: string | null = null
  try {
    const authCookie =
      request.cookies.get('sb-access-token')?.value ||
      request.cookies.get('sb-auth-token')?.value

    // Also check for the base64-encoded Supabase auth cookie pattern
    if (!authCookie) {
      for (const [name, cookie] of request.cookies) {
        if (name.startsWith('sb-') && name.endsWith('-auth-token')) {
          try {
            const parsed = JSON.parse(cookie.value)
            const token = parsed?.access_token || parsed?.[0]?.access_token
            if (token) {
              const payload = token.split('.')[1]
              if (payload) {
                const decoded = JSON.parse(atob(payload))
                userId = decoded.sub || null
              }
            }
          } catch {
            // Ignore parse failures
          }
          break
        }
      }
    }

    if (authCookie && !userId) {
      const payload = authCookie.split('.')[1]
      if (payload) {
        const decoded = JSON.parse(atob(payload))
        userId = decoded.sub || null
      }
    }
  } catch {
    // JWT decode failed - continue without userId
  }

  // Extract tenantId from query params or path
  const tenantId =
    request.nextUrl.searchParams.get('tenantId') ||
    request.nextUrl.searchParams.get('tenant_id') ||
    null

  // Build log entry
  const entry = {
    level: 'INFO',
    module: 'middleware:api-audit',
    msg: 'API request',
    ts: new Date().toISOString(),
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
    userId,
    tenantId,
    ip: (() => {
      const xff = request.headers.get('x-forwarded-for')
      if (!xff) return null
      const parts = xff.split(',').map(s => s.trim()).filter(Boolean)
      return parts[parts.length - 1] || null
    })(),
  }

  // Emit single JSON line (works in both Edge and Node runtimes)
  console.log(JSON.stringify(entry))

  // Add request ID to response headers
  const response = NextResponse.next()
  response.headers.set('x-request-id', requestId)

  return response
}
