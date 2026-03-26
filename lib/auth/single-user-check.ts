/**
 * Centralised single-user mode check.
 *
 * Set SINGLE_USER_MODE=true in environment variables to skip auth
 * and use tenantId from query parameters directly.
 *
 * Defence in depth: this function unconditionally returns false in
 * production, regardless of the environment variable value.
 */
import { optionalConfig } from '@/lib/config/env'

export function isSingleUserMode(): boolean {
  // Defence in depth: NEVER allow single-user mode in production
  if (process.env.NODE_ENV === 'production') {
    return false
  }
  return optionalConfig.singleUserMode === 'true'
}
