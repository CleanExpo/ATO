/**
 * Authentication Middleware
 *
 * Provides Supabase-based authentication for API routes.
 * Returns 401 for unauthenticated requests.
 *
 * @module lib/auth/middleware
 */

import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'
import { optionalConfig, clientConfig } from '@/lib/config/env'

/**
 * Authentication result returned by authMiddleware
 */
export interface AuthResult {
  user: {
    id: string
    email: string | undefined
    role?: string
  }
  supabase: ReturnType<typeof createServerClient>
}

/**
 * Generate a unique error ID for log correlation
 */
function generateErrorId(): string {
  return `err_${uuidv4().slice(0, 8)}`
}

/**
 * Create an authentication error response
 */
export function createAuthErrorResponse(
  message: string,
  status: 401 | 403 = 401
): NextResponse {
  const errorId = generateErrorId()

  console.error(`[${errorId}] Auth error: ${message}`)

  return NextResponse.json(
    {
      error: message,
      errorId,
      timestamp: new Date().toISOString()
    },
    { status }
  )
}

/**
 * Authentication middleware for API routes
 *
 * Usage:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const auth = await authMiddleware(request)
 *   if (auth instanceof NextResponse) return auth // Error response
 *
 *   // Use auth.user and auth.supabase
 *   const { user, supabase } = auth
 * }
 * ```
 *
 * @param request - The incoming Next.js request
 * @returns AuthResult on success, NextResponse (401) on failure
 */
export async function authMiddleware(
  _request: NextRequest
): Promise<AuthResult | NextResponse> {
  // Single-user mode: Skip authentication entirely
  if (optionalConfig.singleUserMode === 'true') {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const supabase = await createServiceClient()

    return {
      user: {
        id: 'single-user',
        email: 'single-user@local',
        role: 'owner'
      },
      supabase
    }
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
            // Ignore errors in read-only contexts (Server Components)
          }
        },
      }
    }
  )

  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error || !user) {
    return createAuthErrorResponse('Authentication required')
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    },
    supabase
  }
}

/**
 * Check if a value is a NextResponse (error response)
 *
 * Usage:
 * ```typescript
 * const auth = await authMiddleware(request)
 * if (isAuthError(auth)) return auth
 * ```
 */
export function isAuthError(
  result: AuthResult | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}

/**
 * Optional authentication middleware
 *
 * Returns null instead of error response when not authenticated.
 * Useful for routes that work with or without authentication.
 */
export async function optionalAuthMiddleware(
  request: NextRequest
): Promise<AuthResult | null> {
  const result = await authMiddleware(request)
  if (result instanceof NextResponse) {
    return null
  }
  return result
}
