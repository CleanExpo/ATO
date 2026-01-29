/**
 * Admin Role Authorization Middleware
 *
 * Provides role-based access control (RBAC) for admin-only routes
 * - Verifies user is authenticated
 * - Checks user has admin role in profiles table
 * - Logs unauthorized access attempts for security monitoring
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export interface AdminCheckResult {
  isAdmin: boolean;
  userId?: string;
  email?: string;
  response?: NextResponse;
}

/**
 * Verify user has admin role
 *
 * @param userId - User ID to check admin status for
 * @returns True if user is admin, false otherwise
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile) {
      console.error('Error checking admin status:', error);
      return false;
    }

    return profile.is_admin === true;
  } catch (error) {
    console.error('Exception checking admin status:', error);
    return false;
  }
}

/**
 * Middleware to require admin role for API routes
 *
 * Usage in API route:
 * ```
 * const adminCheck = await requireAdminRole();
 * if (!adminCheck.isAdmin) {
 *   return adminCheck.response;
 * }
 * ```
 *
 * @returns Object with isAdmin flag and optional error response
 */
export async function requireAdminRole(): Promise<AdminCheckResult> {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      // Log unauthorized access attempt
      console.warn('[SECURITY] Unauthorized admin access attempt - no auth token');

      return {
        isAdmin: false,
        response: NextResponse.json(
          {
            error: 'Authentication required',
            errorId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
          { status: 401 }
        ),
      };
    }

    // Check if user has admin role
    const isAdmin = await isUserAdmin(user.id);

    if (!isAdmin) {
      // Log forbidden access attempt with user details
      console.warn(
        `[SECURITY] Forbidden admin access attempt - User ${user.id} (${user.email}) lacks admin role`
      );

      return {
        isAdmin: false,
        userId: user.id,
        email: user.email || undefined,
        response: NextResponse.json(
          {
            error: 'Forbidden',
            message: 'Admin privileges required to access this resource',
            errorId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
          { status: 403 }
        ),
      };
    }

    // Admin access granted
    return {
      isAdmin: true,
      userId: user.id,
      email: user.email || undefined,
    };
  } catch (error) {
    console.error('[SECURITY] Error in admin role verification:', error);
    return {
      isAdmin: false,
      response: NextResponse.json(
        {
          error: 'Authorization check failed',
          errorId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      ),
    };
  }
}

/**
 * Get admin user details (only if admin)
 *
 * @returns Admin user details or null if not admin
 */
export async function getAdminUser(): Promise<{
  id: string;
  email: string;
  isAdmin: boolean;
} | null> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const isAdmin = await isUserAdmin(user.id);

    if (!isAdmin) {
      return null;
    }

    return {
      id: user.id,
      email: user.email || '',
      isAdmin: true,
    };
  } catch (error) {
    console.error('Error getting admin user:', error);
    return null;
  }
}
