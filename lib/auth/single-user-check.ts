/**
 * Centralised single-user mode check.
 *
 * Set SINGLE_USER_MODE=true in environment variables to skip auth
 * and use tenantId from query parameters directly.
 */
export function isSingleUserMode(): boolean {
  return process.env.SINGLE_USER_MODE === 'true'
}
