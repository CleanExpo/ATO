/**
 * Tests for Rate Limiting Middleware (lib/middleware/rate-limit.ts)
 *
 * Validates in-memory rate limiting behaviour:
 * - rateLimit function success/failure within limits
 * - Rate limit exceeded returns failure
 * - Window reset behaviour
 * - createRateLimitResponse returns proper 429 response
 * - RATE_LIMITS configuration values
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  rateLimit,
  createRateLimitResponse,
  RATE_LIMITS,
  type RateLimitConfig,
  type RateLimitResult,
} from '@/lib/middleware/rate-limit'

// =============================================================================
// rateLimit function tests
// =============================================================================

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-12T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return success for first request', () => {
    const result = rateLimit({
      identifier: 'test-first-request-' + Date.now(),
      limit: 10,
      windowSeconds: 60,
    })

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(9)
    expect(result.limit).toBe(10)
  })

  it('should decrement remaining count with each request', () => {
    const id = 'test-decrement-' + Date.now()
    const config: RateLimitConfig = { identifier: id, limit: 5, windowSeconds: 60 }

    const r1 = rateLimit(config)
    expect(r1.remaining).toBe(4)

    const r2 = rateLimit(config)
    expect(r2.remaining).toBe(3)

    const r3 = rateLimit(config)
    expect(r3.remaining).toBe(2)
  })

  it('should return success=true up to the limit', () => {
    const id = 'test-within-limit-' + Date.now()
    const config: RateLimitConfig = { identifier: id, limit: 3, windowSeconds: 60 }

    expect(rateLimit(config).success).toBe(true)  // 1/3
    expect(rateLimit(config).success).toBe(true)  // 2/3
    expect(rateLimit(config).success).toBe(true)  // 3/3
  })

  it('should return success=false when limit exceeded', () => {
    const id = 'test-exceed-' + Date.now()
    const config: RateLimitConfig = { identifier: id, limit: 2, windowSeconds: 60 }

    rateLimit(config)  // 1/2
    rateLimit(config)  // 2/2
    const result = rateLimit(config)  // 3/2 = exceeded

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('should return remaining=0 when at or beyond limit', () => {
    const id = 'test-zero-remaining-' + Date.now()
    const config: RateLimitConfig = { identifier: id, limit: 1, windowSeconds: 60 }

    rateLimit(config)  // 1/1
    const result = rateLimit(config)  // 2/1 = exceeded

    expect(result.remaining).toBe(0)
  })

  it('should use default limit of 100 when not specified', () => {
    const id = 'test-default-limit-' + Date.now()
    const result = rateLimit({ identifier: id })

    expect(result.limit).toBe(100)
    expect(result.remaining).toBe(99)
  })

  it('should use default window of 60 seconds when not specified', () => {
    const id = 'test-default-window-' + Date.now()
    const result = rateLimit({ identifier: id })

    // reset should be ~60 seconds from now
    const expectedResetMin = Math.floor(Date.now() / 1000) + 59
    const expectedResetMax = Math.floor(Date.now() / 1000) + 61
    expect(result.reset).toBeGreaterThanOrEqual(expectedResetMin)
    expect(result.reset).toBeLessThanOrEqual(expectedResetMax)
  })

  it('should reset counter after window expires', () => {
    const id = 'test-window-reset-' + Date.now()
    const config: RateLimitConfig = { identifier: id, limit: 2, windowSeconds: 60 }

    rateLimit(config)  // 1/2
    rateLimit(config)  // 2/2
    const exceeded = rateLimit(config)  // 3/2 = exceeded
    expect(exceeded.success).toBe(false)

    // Advance time past the window
    vi.advanceTimersByTime(61 * 1000)

    // Should reset and succeed again
    const result = rateLimit(config)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it('should track different identifiers independently', () => {
    const config1: RateLimitConfig = {
      identifier: 'user-A-' + Date.now(),
      limit: 1,
      windowSeconds: 60,
    }
    const config2: RateLimitConfig = {
      identifier: 'user-B-' + Date.now(),
      limit: 1,
      windowSeconds: 60,
    }

    rateLimit(config1)  // user-A: 1/1
    const r1 = rateLimit(config1)  // user-A: exceeded
    expect(r1.success).toBe(false)

    // user-B should still be allowed
    const r2 = rateLimit(config2)
    expect(r2.success).toBe(true)
  })

  it('should return reset timestamp in unix seconds', () => {
    const id = 'test-reset-ts-' + Date.now()
    const result = rateLimit({ identifier: id, limit: 10, windowSeconds: 120 })

    // Reset should be approximately 120 seconds from now in unix seconds
    const nowSeconds = Math.floor(Date.now() / 1000)
    expect(result.reset).toBeGreaterThanOrEqual(nowSeconds + 119)
    expect(result.reset).toBeLessThanOrEqual(nowSeconds + 121)
  })
})

// =============================================================================
// createRateLimitResponse tests
// =============================================================================

describe('createRateLimitResponse', () => {
  it('should return a 429 status response', () => {
    const result: RateLimitResult = {
      success: false,
      limit: 10,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    }

    const response = createRateLimitResponse(result)
    expect(response.status).toBe(429)
  })

  it('should include rate limit headers', async () => {
    const result: RateLimitResult = {
      success: false,
      limit: 5,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 30,
    }

    const response = createRateLimitResponse(result)
    expect(response.headers.get('X-RateLimit-Limit')).toBe('5')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy()
    expect(response.headers.get('Retry-After')).toBeTruthy()
  })

  it('should include error message in response body', async () => {
    const result: RateLimitResult = {
      success: false,
      limit: 10,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    }

    const response = createRateLimitResponse(result)
    const body = await response.json()
    expect(body.error).toBe('Too Many Requests')
    expect(body.message).toContain('Rate limit exceeded')
  })

  it('should include retry-after time in seconds', async () => {
    const futureReset = Math.floor(Date.now() / 1000) + 45

    const result: RateLimitResult = {
      success: false,
      limit: 10,
      remaining: 0,
      reset: futureReset,
    }

    const response = createRateLimitResponse(result)
    const retryAfter = parseInt(response.headers.get('Retry-After') || '0')
    // Should be approximately 45 seconds (within tolerance for timing)
    expect(retryAfter).toBeGreaterThan(40)
    expect(retryAfter).toBeLessThanOrEqual(46)
  })
})

// =============================================================================
// RATE_LIMITS configuration tests
// =============================================================================

describe('RATE_LIMITS', () => {
  it('should have auth configuration', () => {
    expect(RATE_LIMITS.auth).toBeDefined()
    expect(RATE_LIMITS.auth.limit).toBe(5)
    expect(RATE_LIMITS.auth.windowSeconds).toBe(60)
  })

  it('should have analysis configuration', () => {
    expect(RATE_LIMITS.analysis).toBeDefined()
    expect(RATE_LIMITS.analysis.limit).toBe(10)
    expect(RATE_LIMITS.analysis.windowSeconds).toBe(60)
  })

  it('should have api configuration', () => {
    expect(RATE_LIMITS.api).toBeDefined()
    expect(RATE_LIMITS.api.limit).toBe(100)
    expect(RATE_LIMITS.api.windowSeconds).toBe(60)
  })

  it('should have health configuration', () => {
    expect(RATE_LIMITS.health).toBeDefined()
    expect(RATE_LIMITS.health.limit).toBe(1000)
    expect(RATE_LIMITS.health.windowSeconds).toBe(60)
  })

  it('auth should be stricter than analysis', () => {
    expect(RATE_LIMITS.auth.limit).toBeLessThan(RATE_LIMITS.analysis.limit)
  })

  it('analysis should be stricter than general api', () => {
    expect(RATE_LIMITS.analysis.limit).toBeLessThan(RATE_LIMITS.api.limit)
  })

  it('health should be most permissive', () => {
    expect(RATE_LIMITS.health.limit).toBeGreaterThan(RATE_LIMITS.api.limit)
    expect(RATE_LIMITS.health.limit).toBeGreaterThan(RATE_LIMITS.analysis.limit)
    expect(RATE_LIMITS.health.limit).toBeGreaterThan(RATE_LIMITS.auth.limit)
  })
})
