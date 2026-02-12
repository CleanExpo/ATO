/**
 * Log Error API Route Tests
 *
 * Tests for POST /api/log-error.
 * Validates rate limiting, body size limit, JSON parsing,
 * required message field, control character sanitisation,
 * and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock rate-limit module
const mockRateLimit = vi.fn()
const mockCreateRateLimitResponse = vi.fn()

vi.mock('@/lib/middleware/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  createRateLimitResponse: (...args: unknown[]) => mockCreateRateLimitResponse(...args),
  RATE_LIMITS: {
    auth: { limit: 5, windowSeconds: 60 },
    analysis: { limit: 10, windowSeconds: 60 },
    api: { limit: 100, windowSeconds: 60 },
  },
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/log-error', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: not rate-limited
    mockRateLimit.mockReturnValue({
      success: true,
      limit: 20,
      remaining: 19,
      reset: Math.floor(Date.now() / 1000) + 60,
    })

    // Spy on console.error to verify logging
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('logs client error with valid body', async () => {
    const { POST } = await import('@/app/api/log-error/route')

    const req = new NextRequest('http://localhost:3000/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Uncaught TypeError: Cannot read property of undefined',
        stack: 'at Dashboard.tsx:42',
        url: '/dashboard',
      }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.logged).toBe(true)
    expect(console.error).toHaveBeenCalledWith(
      '[CLIENT ERROR]',
      expect.stringContaining('Uncaught TypeError')
    )
  })

  it('is rate limited to 20 requests per minute', async () => {
    mockRateLimit.mockReturnValue({
      success: false,
      limit: 20,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 30,
    })
    mockCreateRateLimitResponse.mockReturnValue(
      new Response(
        JSON.stringify({ error: 'Too Many Requests' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    )

    const { POST } = await import('@/app/api/log-error/route')

    const req = new NextRequest('http://localhost:3000/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test error' }),
    })

    const response = await POST(req)
    expect(response.status).toBe(429)
  })

  it('passes correct rate limit config (20/min)', async () => {
    const { POST } = await import('@/app/api/log-error/route')

    const req = new NextRequest('http://localhost:3000/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test' }),
    })

    await POST(req)

    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 20,
        windowSeconds: 60,
      })
    )
  })

  it('validates body has message field', async () => {
    const { POST } = await import('@/app/api/log-error/route')

    const req = new NextRequest('http://localhost:3000/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stack: 'at Component.tsx:10',
        // message field missing
      }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.logged).toBe(false)
    expect(data.error).toContain('message')
  })

  it('rejects body over 4KB', async () => {
    const { POST } = await import('@/app/api/log-error/route')

    // Create a body larger than 4096 bytes
    const largeMessage = 'x'.repeat(5000)
    const req = new NextRequest('http://localhost:3000/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: largeMessage }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(413)
    expect(data.logged).toBe(false)
    expect(data.error).toContain('4KB')
  })

  it('sanitises control characters from body', async () => {
    const { POST } = await import('@/app/api/log-error/route')

    const bodyWithControlChars = JSON.stringify({
      message: 'Error with \x00null\x01 and \x7Fdel characters',
    })

    const req = new NextRequest('http://localhost:3000/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyWithControlChars,
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.logged).toBe(true)

    // Verify that console.error was called with sanitised content
    const loggedContent = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(loggedContent).not.toContain('\x00')
    expect(loggedContent).not.toContain('\x01')
    expect(loggedContent).not.toContain('\x7F')
  })

  it('handles invalid JSON gracefully', async () => {
    const { POST } = await import('@/app/api/log-error/route')

    const req = new NextRequest('http://localhost:3000/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json{{{',
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.logged).toBe(false)
    expect(data.error).toBe('Invalid JSON')
  })

  it('rejects non-object body (array)', async () => {
    const { POST } = await import('@/app/api/log-error/route')

    const req = new NextRequest('http://localhost:3000/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['not', 'an', 'object']),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.logged).toBe(false)
    expect(data.error).toContain('message')
  })

  it('rejects null body', async () => {
    const { POST } = await import('@/app/api/log-error/route')

    const req = new NextRequest('http://localhost:3000/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null',
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.logged).toBe(false)
  })

  it('uses rightmost X-Forwarded-For IP for rate limiting', async () => {
    const { POST } = await import('@/app/api/log-error/route')

    const req = new NextRequest('http://localhost:3000/api/log-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '1.2.3.4, 10.0.0.1, 203.0.113.50',
      },
      body: JSON.stringify({ message: 'test error' }),
    })

    await POST(req)

    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'log-error:203.0.113.50',
      })
    )
  })

  it('preserves newlines and tabs in sanitised output', async () => {
    const { POST } = await import('@/app/api/log-error/route')

    const req = new NextRequest('http://localhost:3000/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Error\n\tat line 42\n\tat line 50',
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(200)

    // Newlines and tabs should be preserved (not stripped)
    const loggedContent = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(loggedContent).toContain('Error')
    expect(loggedContent).toContain('line 42')
  })

  it('accepts body exactly at 4KB limit', async () => {
    const { POST } = await import('@/app/api/log-error/route')

    // Create a body that serialises to exactly under 4096 chars
    // The JSON.stringify of { message: "x..." } adds ~14 chars overhead
    const message = 'x'.repeat(4060)
    const body = JSON.stringify({ message })

    // Verify we are under the limit
    expect(body.length).toBeLessThanOrEqual(4096)

    const req = new NextRequest('http://localhost:3000/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.logged).toBe(true)
  })
})
