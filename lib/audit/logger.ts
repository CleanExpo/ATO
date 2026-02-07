/**
 * Audit Logging System
 *
 * Tracks all admin actions for security monitoring and compliance
 * - Logs admin operations (approve/reject/delete/modify)
 * - Records user details, timestamps, and IP addresses
 * - Provides audit trail for security investigations
 */

import { createServiceClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('audit:logger');

export type AuditAction =
  | 'accountant_application_approved'
  | 'accountant_application_rejected'
  | 'accountant_application_viewed'
  | 'dashboard_reset'
  | 'database_migration'
  | 'audit_log_exported'
  | 'system_stats_viewed'
  | 'admin_role_granted'
  | 'admin_role_revoked'
  | 'purchase_refunded'
  | 'license_deactivated'
  | 'user_account_suspended'
  | 'user_account_unsuspended';

export interface AuditLogEntry {
  action: AuditAction;
  actor_id: string; // Admin user ID
  actor_email?: string; // Admin email
  target_id?: string; // ID of affected resource (user, application, etc.)
  target_type?: string; // Type of resource (user, accountant_application, etc.)
  details?: Record<string, unknown>; // Additional context
  ip_address?: string; // IP address of admin
  user_agent?: string; // Browser user agent
}

/**
 * Log an admin action to the audit trail
 *
 * @param entry - Audit log entry details
 * @returns Success boolean
 */
export async function logAdminAction(
  entry: AuditLogEntry
): Promise<boolean> {
  try {
    const supabase = await createServiceClient();

    const { error } = await supabase.from('admin_audit_log').insert([
      {
        action: entry.action,
        actor_id: entry.actor_id,
        actor_email: entry.actor_email || null,
        target_id: entry.target_id || null,
        target_type: entry.target_type || null,
        details: entry.details || {},
        ip_address: entry.ip_address || null,
        user_agent: entry.user_agent || null,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error('[AUDIT] Failed to log admin action:', error);
      // Don't throw - audit logging failures shouldn't break the operation
      return false;
    }

    // Also log to structured logger for real-time monitoring
    log.info('Admin action logged', {
      action: entry.action,
      actorId: entry.actor_id,
      actorEmail: entry.actor_email || 'unknown',
      details: entry.details,
    });

    return true;
  } catch (error) {
    console.error('[AUDIT] Exception logging admin action:', error);
    return false;
  }
}

/**
 * Extract IP address from Next.js request
 *
 * @param request - Next.js request object
 * @returns IP address or null
 */
export function getIpAddress(request: Request): string | null {
  // Try various headers for IP address
  const headers = new Headers(request.headers);

  // Check X-Forwarded-For (most common in proxied environments)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // X-Forwarded-For can be a comma-separated list, take the first IP
    return forwardedFor.split(',')[0].trim();
  }

  // Check X-Real-IP
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Check CF-Connecting-IP (Cloudflare)
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp;
  }

  return null;
}

/**
 * Get user agent from request
 *
 * @param request - Next.js request object
 * @returns User agent string or null
 */
export function getUserAgent(request: Request): string | null {
  const headers = new Headers(request.headers);
  return headers.get('user-agent');
}

/**
 * Get audit log entries for a specific actor (admin)
 *
 * @param actorId - Admin user ID
 * @param limit - Number of entries to retrieve (default: 50)
 * @returns Array of audit log entries
 */
export async function getAdminAuditHistory(
  actorId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('*')
      .eq('actor_id', actorId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching admin audit history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching admin audit history:', error);
    return [];
  }
}

/**
 * Get audit log entries for a specific target (resource)
 *
 * @param targetId - Resource ID (user, application, etc.)
 * @param limit - Number of entries to retrieve (default: 50)
 * @returns Array of audit log entries
 */
export async function getResourceAuditHistory(
  targetId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('*')
      .eq('target_id', targetId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching resource audit history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching resource audit history:', error);
    return [];
  }
}

/**
 * Get recent admin actions across the system
 *
 * @param limit - Number of entries to retrieve (default: 100)
 * @returns Array of audit log entries
 */
export async function getRecentAdminActions(
  limit: number = 100
): Promise<any[]> {
  try {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent admin actions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching recent admin actions:', error);
    return [];
  }
}
