/**
 * Centralised single-user mode check.
 *
 * Set SINGLE_USER_MODE=true in environment variables to skip auth
 * and use tenantId from query parameters directly.
 */
import { optionalConfig } from '@/lib/config/env'

export function isSingleUserMode(): boolean {
  return optionalConfig.singleUserMode === 'true'
}
