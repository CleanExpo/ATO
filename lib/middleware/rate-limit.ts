/**
 * Rate Limiting Middleware
 *
 * Protects API endpoints from abuse using in-memory rate limiting.
 * For production, consider using Redis or Upstash for distributed rate limiting.
 */

import { NextResponse } from 'next/server'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetAt: number
  }
}

const rateLimitStore: RateLimitStore = {}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  Object.keys(rateLimitStore).forEach((key) => {
    if (rateLimitStore[key].resetAt < now) {
      delete rateLimitStore[key]
    }
  })
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  /**
   * Unique identifier for the request (usually IP address or user ID)
   */
  identifier: string

  /**
   * Maximum number of requests allowed in the window
   * @default 100
   */
  limit?: number

  /**
   * Time window in seconds
   * @default 60
   */
  windowSeconds?: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Check if a request should be rate limited
 *
 * @example
 * const result = rateLimit({
 *   identifier: request.ip || 'anonymous',
 *   limit: 10,
 *   windowSeconds: 60
 * })
 *
 * if (!result.success) {
 *   return NextResponse.json(
 *     { error: 'Too many requests' },
 *     {
 *       status: 429,
 *       headers: {
 *         'X-RateLimit-Limit': result.limit.toString(),
 *         'X-RateLimit-Remaining': result.remaining.toString(),
 *         'X-RateLimit-Reset': result.reset.toString(),
 *       }
 *     }
 *   )
 * }
 */
export function rateLimit(config: RateLimitConfig): RateLimitResult {
  const { identifier, limit = 100, windowSeconds = 60 } = config

  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const key = `${identifier}`

  // Get or create rate limit entry
  if (!rateLimitStore[key] || rateLimitStore[key].resetAt < now) {
    rateLimitStore[key] = {
      count: 0,
      resetAt: now + windowMs,
    }
  }

  const entry = rateLimitStore[key]

  // Increment count
  entry.count++

  // Check if limit exceeded
  const success = entry.count <= limit
  const remaining = Math.max(0, limit - entry.count)

  return {
    success,
    limit,
    remaining,
    reset: Math.floor(entry.resetAt / 1000), // Unix timestamp in seconds
  }
}

/**
 * Create a rate-limited API response
 *
 * @example
 * export async function POST(request: Request) {
 *   const limitResult = rateLimit({
 *     identifier: request.headers.get('x-forwarded-for') || 'anonymous',
 *     limit: 10,
 *     windowSeconds: 60
 *   })
 *
 *   if (!limitResult.success) {
 *     return createRateLimitResponse(limitResult)
 *   }
 *
 *   // Process request...
 * }
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${Math.ceil((result.reset * 1000 - Date.now()) / 1000)} seconds.`,
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.reset.toString(),
        'Retry-After': Math.ceil((result.reset * 1000 - Date.now()) / 1000).toString(),
      },
    }
  )
}

/**
 * Rate limit configurations for different API endpoints
 */
export const RATE_LIMITS = {
  // Authentication endpoints (stricter limits)
  auth: {
    limit: 5,
    windowSeconds: 60, // 5 requests per minute
  },

  // AI analysis endpoints (expensive operations)
  analysis: {
    limit: 10,
    windowSeconds: 60, // 10 requests per minute
  },

  // Data fetching endpoints
  api: {
    limit: 100,
    windowSeconds: 60, // 100 requests per minute
  },

  // Health check endpoint (very permissive)
  health: {
    limit: 1000,
    windowSeconds: 60, // 1000 requests per minute
  },
} as const
