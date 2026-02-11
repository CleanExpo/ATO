/**
 * Rate Limiting Helper
 *
 * Convenience wrapper to apply rate limiting to API route handlers.
 * Extracts client IP from request headers and applies the appropriate
 * rate limit configuration.
 *
 * @see SEC-003: Zero rate limiting on any API route
 */

import { NextRequest } from 'next/server'
import { rateLimit, createRateLimitResponse, RATE_LIMITS } from './rate-limit'
import { distributedRateLimit, createDistributedRateLimitResponse, DISTRIBUTED_RATE_LIMITS } from './distributed-rate-limit'

/**
 * Extract client IP from request, using rightmost X-Forwarded-For (B-5 fix)
 */
export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const ips = xff.split(',').map(ip => ip.trim())
    return ips[ips.length - 1] || 'unknown'
  }
  return request.headers.get('x-real-ip') || 'unknown'
}

/**
 * Apply in-memory rate limiting to a route.
 * Returns a Response if rate limited, or null if allowed.
 */
export function applyRateLimit(
  request: NextRequest,
  config: { limit: number; windowSeconds: number },
  prefix: string = ''
) {
  const ip = getClientIp(request)
  const identifier = prefix ? `${prefix}:${ip}` : ip
  const result = rateLimit({ identifier, ...config })
  if (!result.success) {
    return createRateLimitResponse(result)
  }
  return null
}

/**
 * Apply distributed (Supabase-backed) rate limiting to a route.
 * Returns a Response if rate limited, or null if allowed.
 * Falls back to in-memory if Supabase is unavailable.
 */
export async function applyDistributedRateLimit(
  request: NextRequest,
  config: { limit: number; windowSeconds: number },
  prefix: string = ''
) {
  const ip = getClientIp(request)
  const identifier = prefix ? `${prefix}:${ip}` : ip
  const result = await distributedRateLimit({ identifier, ...config })
  if (!result.success) {
    return createDistributedRateLimitResponse(result)
  }
  return null
}

// Re-export configs for convenience
export { RATE_LIMITS, DISTRIBUTED_RATE_LIMITS }
