/**
 * Tenant Access Guard
 *
 * Validates that a user has access to a specific Xero tenant.
 * Prevents unauthorised cross-tenant data access (IDOR protection).
 *
 * @module lib/auth/tenant-guard
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

/**
 * User role for tenant access
 */
export type TenantRole = 'owner' | 'admin' | 'viewer'

/**
 * Tenant access record
 */
export interface TenantAccess {
  tenantId: string
  role: TenantRole
  createdAt: string
}

/**
 * Generate a unique error ID for log correlation
 */
function generateErrorId(): string {
  return `err_${uuidv4().slice(0, 8)}`
}

/**
 * Create a forbidden error response
 */
export function createForbiddenResponse(message: string): NextResponse {
  const errorId = generateErrorId()

  console.error(`[${errorId}] Access denied: ${message}`)

  return NextResponse.json(
    {
      error: message,
      errorId,
      timestamp: new Date().toISOString()
    },
    { status: 403 }
  )
}

/**
 * Validate that a user has access to a specific tenant
 *
 * @param supabase - Authenticated Supabase client
 * @param userId - The user's ID
 * @param tenantId - The Xero tenant ID to check
 * @returns true if user has access, false otherwise
 */
export async function validateTenantAccess(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<boolean> {
  if (!tenantId || !userId) {
    return false
  }

  const { data, error } = await supabase
    .from('user_tenant_access')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) {
    return false
  }

  return true
}

/**
 * Get user's role for a specific tenant
 *
 * @param supabase - Authenticated Supabase client
 * @param userId - The user's ID
 * @param tenantId - The Xero tenant ID
 * @returns The user's role or null if no access
 */
export async function getTenantRole(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<TenantRole | null> {
  const { data, error } = await supabase
    .from('user_tenant_access')
    .select('role')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) {
    return null
  }

  return data.role as TenantRole
}

/**
 * Get all tenants a user has access to
 *
 * @param supabase - Authenticated Supabase client
 * @param userId - The user's ID
 * @returns Array of tenant access records
 */
export async function getUserTenants(
  supabase: SupabaseClient,
  userId: string
): Promise<TenantAccess[]> {
  const { data, error } = await supabase
    .from('user_tenant_access')
    .select('tenant_id, role, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    return []
  }

  return data.map((record) => ({
    tenantId: record.tenant_id,
    role: record.role as TenantRole,
    createdAt: record.created_at
  }))
}

/**
 * Grant a user access to a tenant
 *
 * @param supabase - Authenticated Supabase client (with service role)
 * @param userId - The user's ID
 * @param tenantId - The Xero tenant ID
 * @param role - The role to grant (default: 'viewer')
 * @returns true if successful, false otherwise
 */
export async function grantTenantAccess(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  role: TenantRole = 'viewer'
): Promise<boolean> {
  const { error } = await supabase.from('user_tenant_access').upsert(
    {
      user_id: userId,
      tenant_id: tenantId,
      role
    },
    {
      onConflict: 'user_id,tenant_id'
    }
  )

  if (error) {
    console.error('Failed to grant tenant access:', error)
    return false
  }

  return true
}

/**
 * Revoke a user's access to a tenant
 *
 * @param supabase - Authenticated Supabase client (with service role)
 * @param userId - The user's ID
 * @param tenantId - The Xero tenant ID
 * @returns true if successful, false otherwise
 */
export async function revokeTenantAccess(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('user_tenant_access')
    .delete()
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('Failed to revoke tenant access:', error)
    return false
  }

  return true
}

/**
 * Middleware helper to validate tenant access in API routes
 *
 * Usage:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const auth = await authMiddleware(request)
 *   if (isAuthError(auth)) return auth
 *
 *   const tenantId = request.nextUrl.searchParams.get('tenantId')
 *   const tenantCheck = await requireTenantAccess(auth.supabase, auth.user.id, tenantId)
 *   if (tenantCheck instanceof NextResponse) return tenantCheck
 *
 *   // User has access to tenant
 * }
 * ```
 */
export async function requireTenantAccess(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string | null
): Promise<true | NextResponse> {
  if (!tenantId) {
    return createForbiddenResponse('tenantId is required')
  }

  const hasAccess = await validateTenantAccess(supabase, userId, tenantId)

  if (!hasAccess) {
    return createForbiddenResponse('Access denied to this tenant')
  }

  return true
}

/**
 * Check if user has admin or owner role for tenant
 */
export async function requireTenantAdmin(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string | null
): Promise<true | NextResponse> {
  if (!tenantId) {
    return createForbiddenResponse('tenantId is required')
  }

  const role = await getTenantRole(supabase, userId, tenantId)

  if (!role || role === 'viewer') {
    return createForbiddenResponse('Admin access required for this operation')
  }

  return true
}
