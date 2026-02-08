/**
 * Combined Authentication & Tenant Authorization Helper
 *
 * Provides a single function to validate both authentication and tenant access.
 * Use this in API routes that require user auth + tenant ownership validation.
 *
 * @module lib/auth/require-auth
 */

import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware, type AuthResult } from './middleware'
import { requireTenantAccess, createForbiddenResponse } from './tenant-guard'
import { isSingleUserMode } from './single-user-check'

/**
 * Result of authentication and tenant validation
 */
export interface AuthenticatedRequest {
  user: {
    id: string
    email: string | undefined
  }
  tenantId: string
  supabase: AuthResult['supabase']
}

/**
 * Require authentication and tenant access for an API route
 *
 * This is the main helper for protected routes. It:
 * 1. Validates user authentication via Supabase Auth
 * 2. Extracts tenantId from query params or body
 * 3. Validates user has access to the tenant
 *
 * @param request - The Next.js request object
 * @param options - Configuration options
 * @returns AuthenticatedRequest on success, NextResponse (401/403) on failure
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const auth = await requireAuth(request)
 *   if (auth instanceof NextResponse) return auth
 *
 *   const { user, tenantId, supabase } = auth
 *   // ... your logic here
 * }
 * ```
 */
export async function requireAuth(
  request: NextRequest,
  options: {
    tenantIdSource?: 'query' | 'body' | 'params'
    tenantIdParam?: string
    skipTenantValidation?: boolean
  } = {}
): Promise<AuthenticatedRequest | NextResponse> {
  const {
    tenantIdSource = 'query',
    tenantIdParam = 'tenantId',
    skipTenantValidation = false
  } = options

  // Single-user mode: Skip authentication entirely, extract tenantId from request
  if (isSingleUserMode()) {
    let tenantId: string | null = null

    if (tenantIdSource === 'query') {
      tenantId = request.nextUrl.searchParams.get(tenantIdParam)
    } else if (tenantIdSource === 'body') {
      try {
        const body = await request.clone().json()
        tenantId = body[tenantIdParam]
      } catch {
        // Body parsing failed
      }
    }

    return {
      user: { id: 'single-user', email: undefined },
      tenantId: tenantId || '',
      supabase: null as unknown as AuthResult['supabase']
    }
  }

  // Step 1: Authenticate user
  const authResult = await authMiddleware(request)
  if (authResult instanceof NextResponse) {
    return authResult // 401 error
  }

  const { user, supabase } = authResult

  // Step 2: Extract tenant ID
  let tenantId: string | null = null

  if (tenantIdSource === 'query') {
    tenantId = request.nextUrl.searchParams.get(tenantIdParam)
  } else if (tenantIdSource === 'body') {
    try {
      const body = await request.clone().json()
      tenantId = body[tenantIdParam]
    } catch {
      // Body parsing failed, tenantId remains null
    }
  }

  // Step 3: Validate tenant access (unless skipped)
  if (!skipTenantValidation) {
    if (!tenantId) {
      return createForbiddenResponse(`${tenantIdParam} is required`)
    }

    const tenantCheck = await requireTenantAccess(supabase, user.id, tenantId)
    if (tenantCheck instanceof NextResponse) {
      return tenantCheck // 403 error
    }
  }

  return {
    user: {
      id: user.id,
      email: user.email
    },
    tenantId: tenantId || '',
    supabase
  }
}

/**
 * Require authentication only (no tenant validation)
 *
 * Use this for routes that don't require tenant-specific access,
 * like listing user's connected tenants or user profile.
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const auth = await requireAuthOnly(request)
 *   if (auth instanceof NextResponse) return auth
 *
 *   const { user, supabase } = auth
 *   // ... your logic here
 * }
 * ```
 */
export async function requireAuthOnly(
  request: NextRequest
): Promise<AuthResult | NextResponse> {
  if (isSingleUserMode()) {
    return {
      user: { id: 'single-user', email: undefined },
      supabase: null as unknown as AuthResult['supabase']
    }
  }
  return authMiddleware(request)
}

/**
 * Check if result is an error response
 */
export function isErrorResponse(
  result: AuthenticatedRequest | AuthResult | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}

/**
 * Development bypass for testing (NOT exported — internal dev use only)
 *
 * Build-time eliminated: only available when NODE_ENV !== 'production'.
 * This function is intentionally NOT exported to prevent accidental use
 * in production-accessible code paths.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _devBypassAuth(
  request: NextRequest
): Promise<AuthenticatedRequest> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('_devBypassAuth cannot be used in production')
  }

  const tenantId = request.nextUrl.searchParams.get('tenantId') || 'dev-tenant'

  console.warn('⚠️ DEV MODE: Authentication bypassed')

  // Return mock auth result for development
  const { createServiceClient } = await import('@/lib/supabase/server')
  const supabase = await createServiceClient()

  return {
    user: {
      id: 'dev-user-id',
      email: 'dev@example.com'
    },
    tenantId,
    supabase
  }
}
