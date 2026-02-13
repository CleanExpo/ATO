/**
 * Distributed Rate Limiting via Supabase
 *
 * Uses PostgreSQL atomic operations (INSERT ... ON CONFLICT) for rate limiting
 * that works across serverless function instances. Falls back to in-memory
 * rate limiting if Supabase is unavailable.
 *
 * @see supabase/migrations/20260208_distributed_rate_limit.sql
 * @see Finding B-7 in COMPLIANCE_RISK_ASSESSMENT.md
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit as inMemoryRateLimit, type RateLimitConfig, type RateLimitResult } from './rate-limit'
import { logRateLimitExceeded } from '@/lib/security/security-event-logger'

/**
 * Check rate limit using Supabase-backed distributed store.
 * Falls back to in-memory if Supabase RPC fails.
 */
export async function distributedRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const { identifier, limit = 100, windowSeconds = 60 } = config

  try {
    const supabase = await createServiceClient()

    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: identifier,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })

    if (error || !data || data.length === 0) {
      // Fallback to in-memory if RPC fails
      console.warn('[rate-limit] Supabase RPC failed, using in-memory fallback:', error?.message)
      return inMemoryRateLimit(config)
    }

    const row = data[0] as { allowed: boolean; current_count: number; reset_at: string }

    const result = {
      success: row.allowed,
      limit,
      remaining: Math.max(0, limit - row.current_count),
      reset: Math.floor(new Date(row.reset_at).getTime() / 1000),
    }

    // Log rate limit breaches for NDB detection (P2-8)
    if (!result.success) {
      logRateLimitExceeded(null, identifier, limit).catch(() => {})
    }

    return result
  } catch (err) {
    // Fallback to in-memory on any error
    console.warn('[rate-limit] Distributed rate limit error, using in-memory fallback:', err)
    return inMemoryRateLimit(config)
  }
}

/**
 * Create a rate-limited API response (429 Too Many Requests)
 */
export function createDistributedRateLimitResponse(result: RateLimitResult): NextResponse {
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
 * Rate limit configurations for security-critical endpoints.
 * These use distributed rate limiting for cross-instance enforcement.
 */
export const DISTRIBUTED_RATE_LIMITS = {
  // Share password attempts (brute force prevention)
  sharePassword: {
    limit: 5,
    windowSeconds: 300, // 5 attempts per 5 minutes
  },

  // OAuth endpoints
  oauth: {
    limit: 10,
    windowSeconds: 60, // 10 requests per minute
  },

  // AI analysis (expensive operations)
  analysis: {
    limit: 10,
    windowSeconds: 60, // 10 requests per minute
  },
} as const
