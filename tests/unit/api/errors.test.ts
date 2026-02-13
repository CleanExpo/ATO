/**
 * Tests for Standardized API Error Handling (lib/api/errors.ts)
 *
 * Validates:
 * - createErrorResponse() returns correct status code and shape
 * - createErrorResponse() sanitises messages in production
 * - createErrorResponse() includes context only in development
 * - createValidationError() returns 400 with unsanitised message
 * - createAuthError() returns 401
 * - createNotFoundError() returns 404
 * - createRateLimitError() returns 429 with Retry-After header
 * - createServiceUnavailableError() returns 503
 * - Error responses include errorId and timestamp
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock logger
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------

import {
  createErrorResponse,
  createValidationError,
  createAuthError,
  createNotFoundError,
  createRateLimitError,
  createServiceUnavailableError,
  type ApiErrorResponse,
} from '@/lib/api/errors'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function parseBody(response: Response): Promise<ApiErrorResponse> {
  return response.json() as Promise<ApiErrorResponse>
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createErrorResponse', () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv
  })

  it('returns 500 status by default', () => {
    const resp = createErrorResponse(new Error('Something broke'))
    expect(resp.status).toBe(500)
  })

  it('returns custom status code', () => {
    const resp = createErrorResponse('Bad', undefined, 422)
    expect(resp.status).toBe(422)
  })

  it('includes errorId in response body', async () => {
    const resp = createErrorResponse(new Error('test'))
    const body = await parseBody(resp)

    expect(body.errorId).toBeDefined()
    expect(typeof body.errorId).toBe('string')
    expect(body.errorId.length).toBeGreaterThan(0)
  })

  it('includes timestamp in ISO format', async () => {
    const resp = createErrorResponse(new Error('test'))
    const body = await parseBody(resp)

    expect(body.timestamp).toBeDefined()
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('extracts message from Error object', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    const resp = createErrorResponse(new Error('Detailed error'))
    const body = await parseBody(resp)

    expect(body.error).toBe('Detailed error')
  })

  it('uses string directly as error message', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    const resp = createErrorResponse('Direct string error')
    const body = await parseBody(resp)

    expect(body.error).toBe('Direct string error')
  })

  it('uses generic message for unknown error types', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    const resp = createErrorResponse(42)
    const body = await parseBody(resp)

    expect(body.error).toBe('Unknown error occurred')
  })

  it('includes context in development mode', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    const resp = createErrorResponse(new Error('test'), { operation: 'fetchData' })
    const body = await parseBody(resp)

    expect(body.context).toBeDefined()
    expect(body.context!.operation).toBe('fetchData')
  })

  it('excludes context in production mode', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    const resp = createErrorResponse(new Error('test'), { operation: 'fetchData' })
    const body = await parseBody(resp)

    expect(body.context).toBeUndefined()
  })

  // -- Production sanitisation --

  it('sanitises ECONNREFUSED in production', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    const resp = createErrorResponse(new Error('connect ECONNREFUSED 127.0.0.1:5432'))
    const body = await parseBody(resp)

    expect(body.error).toBe('Service temporarily unavailable')
  })

  it('sanitises ETIMEDOUT in production', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    const resp = createErrorResponse(new Error('ETIMEDOUT'))
    const body = await parseBody(resp)

    expect(body.error).toBe('Request timed out')
  })

  it('sanitises ENOTFOUND in production', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    const resp = createErrorResponse(new Error('getaddrinfo ENOTFOUND api.xero.com'))
    const body = await parseBody(resp)

    expect(body.error).toBe('Service not found')
  })

  it('sanitises fetch failed in production', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    const resp = createErrorResponse(new Error('fetch failed'))
    const body = await parseBody(resp)

    expect(body.error).toBe('Network error occurred')
  })

  it('sanitises GOOGLE_AI_API_KEY error in production', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    const resp = createErrorResponse(new Error('Missing GOOGLE_AI_API_KEY'))
    const body = await parseBody(resp)

    expect(body.error).toContain('AI service not configured')
  })

  it('sanitises API key not valid error in production', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    const resp = createErrorResponse(new Error('API key not valid. Please pass a valid API key'))
    const body = await parseBody(resp)

    expect(body.error).toContain('API key is invalid')
  })

  it('returns generic message for unknown errors in production', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    const resp = createErrorResponse(new Error('Internal PostgreSQL cursor error XYZ'))
    const body = await parseBody(resp)

    expect(body.error).toBe('An error occurred while processing your request')
  })

  it('does NOT sanitise in development mode', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    const resp = createErrorResponse(new Error('connect ECONNREFUSED 127.0.0.1:5432'))
    const body = await parseBody(resp)

    expect(body.error).toBe('connect ECONNREFUSED 127.0.0.1:5432')
  })
})

describe('createValidationError', () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv
  })

  it('returns 400 status code', () => {
    const resp = createValidationError('tenantId is required')
    expect(resp.status).toBe(400)
  })

  it('includes the exact message (not sanitised)', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    const resp = createValidationError('tenantId is required and must be a string')
    const body = await parseBody(resp)

    // Validation messages bypass sanitisation per the source code comment
    expect(body.error).toBe('tenantId is required and must be a string')
  })

  it('includes errorId and timestamp', async () => {
    const resp = createValidationError('bad input')
    const body = await parseBody(resp)

    expect(body.errorId).toBeDefined()
    expect(body.timestamp).toBeDefined()
  })

  it('includes context in development mode', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    const resp = createValidationError('bad', { field: 'tenantId' })
    const body = await parseBody(resp)

    expect(body.context).toBeDefined()
    expect(body.context!.type).toBe('validation')
    expect(body.context!.field).toBe('tenantId')
  })

  it('excludes context in production mode', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    const resp = createValidationError('bad', { field: 'tenantId' })
    const body = await parseBody(resp)

    expect(body.context).toBeUndefined()
  })
})

describe('createAuthError', () => {
  it('returns 401 status code', () => {
    const resp = createAuthError()
    expect(resp.status).toBe(401)
  })

  it('uses default message when none provided', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    const resp = createAuthError()
    const body = await parseBody(resp)

    expect(body.error).toBe('Authentication required')
  })

  it('uses custom message', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    const resp = createAuthError('Token expired')
    const body = await parseBody(resp)

    expect(body.error).toBe('Token expired')
  })

  it('includes errorId', async () => {
    const resp = createAuthError()
    const body = await parseBody(resp)

    expect(body.errorId).toBeDefined()
  })
})

describe('createNotFoundError', () => {
  it('returns 404 status code', () => {
    const resp = createNotFoundError('Report')
    expect(resp.status).toBe(404)
  })

  it('includes resource name in message', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    const resp = createNotFoundError('Report')
    const body = await parseBody(resp)

    expect(body.error).toBe('Report not found')
  })

  it('includes resource context in development', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    const resp = createNotFoundError('Tenant', { tenantId: 'abc' })
    const body = await parseBody(resp)

    expect(body.context).toBeDefined()
    expect(body.context!.resource).toBe('Tenant')
    expect(body.context!.tenantId).toBe('abc')
  })
})

describe('createRateLimitError', () => {
  it('returns 429 status code', () => {
    const resp = createRateLimitError()
    expect(resp.status).toBe(429)
  })

  it('sets Retry-After header when retryAfter provided', () => {
    const resp = createRateLimitError(60)

    expect(resp.headers.get('Retry-After')).toBe('60')
  })

  it('does not set Retry-After header when not provided', () => {
    const resp = createRateLimitError()

    expect(resp.headers.get('Retry-After')).toBeNull()
  })

  it('includes errorId', async () => {
    const resp = createRateLimitError(30)
    const body = await parseBody(resp)

    expect(body.errorId).toBeDefined()
  })
})

describe('createServiceUnavailableError', () => {
  it('returns 503 status code', () => {
    const resp = createServiceUnavailableError('Xero')
    expect(resp.status).toBe(503)
  })

  it('includes service name in message', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    const resp = createServiceUnavailableError('Gemini')
    const body = await parseBody(resp)

    expect(body.error).toBe('Gemini service unavailable')
  })
})

describe('error ID uniqueness', () => {
  it('generates unique errorIds across multiple calls', async () => {
    const ids = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const resp = createErrorResponse(new Error('test'))
      const body = await parseBody(resp)
      ids.add(body.errorId)
    }
    expect(ids.size).toBe(50)
  })
})
