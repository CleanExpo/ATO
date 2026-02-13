/**
 * Tests for Distributed Rate Limiting (lib/middleware/distributed-rate-limit.ts)
 *
 * Validates Supabase-backed distributed rate limiting with in-memory fallback:
 * - distributedRateLimit: success within limit, block on exceeded, fallback on RPC error
 * - createDistributedRateLimitResponse: proper 429 response with headers
 * - DISTRIBUTED_RATE_LIMITS: configuration values
 * - NDB breach logging on rate limit exceeded
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted so mock references are available in vi.mock factories
const { mockRpc, mockInMemoryRateLimit, mockLogRateLimitExceeded } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockInMemoryRateLimit: vi.fn(),
  mockLogRateLimitExceeded: vi.fn().mockResolvedValue(undefined),
}))

// Mock Supabase service client
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn().mockResolvedValue({ rpc: mockRpc }),
}))

// Mock in-memory rate limiter (fallback)
vi.mock('@/lib/middleware/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockInMemoryRateLimit(...args),
}))

// Mock security event logger
vi.mock('@/lib/security/security-event-logger', () => ({
  logRateLimitExceeded: (...args: unknown[]) => mockLogRateLimitExceeded(...args),
}))

import {
  distributedRateLimit,
  createDistributedRateLimitResponse,
  DISTRIBUTED_RATE_LIMITS,
} from '@/lib/middleware/distributed-rate-limit'
import { createServiceClient } from '@/lib/supabase/server'

// =============================================================================
// distributedRateLimit tests
// =============================================================================

describe('distributedRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createServiceClient).mockResolvedValue({ rpc: mockRpc } as never)
    // Re-establish mockResolvedValue after clearAllMocks resets it
    mockLogRateLimitExceeded.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('allows requests within the limit', async () => {
    const resetAt = new Date(Date.now() + 60000).toISOString()
    mockRpc.mockResolvedValue({
      data: [{ allowed: true, current_count: 3, reset_at: resetAt }],
      error: null,
    })

    const result = await distributedRateLimit({
      identifier: 'test-user-1',
      limit: 10,
      windowSeconds: 60,
    })

    expect(result.success).toBe(true)
    expect(result.limit).toBe(10)
    expect(result.remaining).toBe(7) // 10 - 3
    expect(result.reset).toBe(Math.floor(new Date(resetAt).getTime() / 1000))
  })

  it('blocks requests exceeding the limit', async () => {
    const resetAt = new Date(Date.now() + 60000).toISOString()
    mockRpc.mockResolvedValue({
      data: [{ allowed: false, current_count: 11, reset_at: resetAt }],
      error: null,
    })

    const result = await distributedRateLimit({
      identifier: 'test-user-2',
      limit: 10,
      windowSeconds: 60,
    })

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0) // Math.max(0, 10-11) = 0
    expect(result.limit).toBe(10)
  })

  it('calls Supabase RPC with correct parameters', async () => {
    mockRpc.mockResolvedValue({
      data: [{ allowed: true, current_count: 1, reset_at: new Date().toISOString() }],
      error: null,
    })

    await distributedRateLimit({
      identifier: 'share:192.168.1.1',
      limit: 5,
      windowSeconds: 300,
    })

    expect(mockRpc).toHaveBeenCalledWith('check_rate_limit', {
      p_key: 'share:192.168.1.1',
      p_limit: 5,
      p_window_seconds: 300,
    })
  })

  it('uses default limit of 100 when not specified', async () => {
    mockRpc.mockResolvedValue({
      data: [{ allowed: true, current_count: 1, reset_at: new Date().toISOString() }],
      error: null,
    })

    const result = await distributedRateLimit({ identifier: 'test-defaults' })

    expect(result.limit).toBe(100)
    expect(mockRpc).toHaveBeenCalledWith('check_rate_limit', {
      p_key: 'test-defaults',
      p_limit: 100,
      p_window_seconds: 60,
    })
  })

  it('falls back to in-memory rate limiter when Supabase RPC returns error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC function not found' },
    })

    const fallbackResult = { success: true, limit: 10, remaining: 9, reset: 123456 }
    mockInMemoryRateLimit.mockReturnValue(fallbackResult)

    const result = await distributedRateLimit({
      identifier: 'test-fallback-error',
      limit: 10,
      windowSeconds: 60,
    })

    expect(result).toEqual(fallbackResult)
    expect(mockInMemoryRateLimit).toHaveBeenCalledWith({
      identifier: 'test-fallback-error',
      limit: 10,
      windowSeconds: 60,
    })
  })

  it('falls back to in-memory rate limiter when RPC returns empty data', async () => {
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    })

    const fallbackResult = { success: true, limit: 5, remaining: 4, reset: 999999 }
    mockInMemoryRateLimit.mockReturnValue(fallbackResult)

    const result = await distributedRateLimit({
      identifier: 'test-fallback-empty',
      limit: 5,
      windowSeconds: 30,
    })

    expect(result).toEqual(fallbackResult)
    expect(mockInMemoryRateLimit).toHaveBeenCalled()
  })

  it('falls back to in-memory rate limiter on createServiceClient exception', async () => {
    vi.mocked(createServiceClient).mockRejectedValue(new Error('Connection failed'))

    const fallbackResult = { success: true, limit: 10, remaining: 9, reset: 123456 }
    mockInMemoryRateLimit.mockReturnValue(fallbackResult)

    const result = await distributedRateLimit({
      identifier: 'test-fallback-exception',
      limit: 10,
      windowSeconds: 60,
    })

    expect(result).toEqual(fallbackResult)
    expect(mockInMemoryRateLimit).toHaveBeenCalled()
  })

  it('logs rate limit breach for NDB detection when request is blocked', async () => {
    mockRpc.mockResolvedValue({
      data: [{ allowed: false, current_count: 11, reset_at: new Date().toISOString() }],
      error: null,
    })

    await distributedRateLimit({
      identifier: 'attacker-ip',
      limit: 10,
      windowSeconds: 60,
    })

    expect(mockLogRateLimitExceeded).toHaveBeenCalledWith(null, 'attacker-ip', 10)
  })

  it('does NOT log rate limit breach when request is allowed', async () => {
    mockRpc.mockResolvedValue({
      data: [{ allowed: true, current_count: 3, reset_at: new Date().toISOString() }],
      error: null,
    })

    await distributedRateLimit({
      identifier: 'normal-user',
      limit: 10,
      windowSeconds: 60,
    })

    expect(mockLogRateLimitExceeded).not.toHaveBeenCalled()
  })

  it('tracks different identifiers independently via RPC params', async () => {
    mockRpc.mockResolvedValue({
      data: [{ allowed: true, current_count: 1, reset_at: new Date().toISOString() }],
      error: null,
    })

    await distributedRateLimit({ identifier: 'user-A', limit: 5, windowSeconds: 60 })
    await distributedRateLimit({ identifier: 'user-B', limit: 5, windowSeconds: 60 })

    expect(mockRpc).toHaveBeenCalledTimes(2)
    expect(mockRpc).toHaveBeenCalledWith('check_rate_limit', {
      p_key: 'user-A',
      p_limit: 5,
      p_window_seconds: 60,
    })
    expect(mockRpc).toHaveBeenCalledWith('check_rate_limit', {
      p_key: 'user-B',
      p_limit: 5,
      p_window_seconds: 60,
    })
  })

  it('calculates remaining as 0 when current_count exceeds limit', async () => {
    mockRpc.mockResolvedValue({
      data: [{ allowed: false, current_count: 150, reset_at: new Date().toISOString() }],
      error: null,
    })

    const result = await distributedRateLimit({
      identifier: 'heavy-user',
      limit: 100,
      windowSeconds: 60,
    })

    expect(result.remaining).toBe(0) // Math.max(0, 100-150) = 0
  })
})

// =============================================================================
// createDistributedRateLimitResponse tests
// =============================================================================

describe('createDistributedRateLimitResponse', () => {
  it('returns a 429 status response', () => {
    const result = {
      success: false,
      limit: 10,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    }

    const response = createDistributedRateLimitResponse(result)
    expect(response.status).toBe(429)
  })

  it('includes X-RateLimit headers', () => {
    const result = {
      success: false,
      limit: 5,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 30,
    }

    const response = createDistributedRateLimitResponse(result)
    expect(response.headers.get('X-RateLimit-Limit')).toBe('5')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy()
  })

  it('includes Retry-After header with seconds until reset', () => {
    const futureReset = Math.floor(Date.now() / 1000) + 45

    const result = {
      success: false,
      limit: 10,
      remaining: 0,
      reset: futureReset,
    }

    const response = createDistributedRateLimitResponse(result)
    const retryAfter = parseInt(response.headers.get('Retry-After') || '0')
    expect(retryAfter).toBeGreaterThan(40)
    expect(retryAfter).toBeLessThanOrEqual(46)
  })

  it('includes error message in JSON body', async () => {
    const result = {
      success: false,
      limit: 10,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    }

    const response = createDistributedRateLimitResponse(result)
    const body = await response.json()
    expect(body.error).toBe('Too Many Requests')
    expect(body.message).toContain('Rate limit exceeded')
  })
})

// =============================================================================
// DISTRIBUTED_RATE_LIMITS configuration tests
// =============================================================================

describe('DISTRIBUTED_RATE_LIMITS', () => {
  it('has sharePassword configuration for brute force prevention', () => {
    expect(DISTRIBUTED_RATE_LIMITS.sharePassword).toBeDefined()
    expect(DISTRIBUTED_RATE_LIMITS.sharePassword.limit).toBe(5)
    expect(DISTRIBUTED_RATE_LIMITS.sharePassword.windowSeconds).toBe(300)
  })

  it('has oauth configuration', () => {
    expect(DISTRIBUTED_RATE_LIMITS.oauth).toBeDefined()
    expect(DISTRIBUTED_RATE_LIMITS.oauth.limit).toBe(10)
    expect(DISTRIBUTED_RATE_LIMITS.oauth.windowSeconds).toBe(60)
  })

  it('has analysis configuration', () => {
    expect(DISTRIBUTED_RATE_LIMITS.analysis).toBeDefined()
    expect(DISTRIBUTED_RATE_LIMITS.analysis.limit).toBe(10)
    expect(DISTRIBUTED_RATE_LIMITS.analysis.windowSeconds).toBe(60)
  })

  it('sharePassword should be strictest (lowest limit over longest window)', () => {
    expect(DISTRIBUTED_RATE_LIMITS.sharePassword.limit).toBeLessThanOrEqual(
      DISTRIBUTED_RATE_LIMITS.oauth.limit
    )
    expect(DISTRIBUTED_RATE_LIMITS.sharePassword.windowSeconds).toBeGreaterThanOrEqual(
      DISTRIBUTED_RATE_LIMITS.oauth.windowSeconds
    )
  })
})
