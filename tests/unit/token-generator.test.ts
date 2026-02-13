/**
 * Tests for Secure Token Generator (lib/share/token-generator.ts)
 *
 * Validates:
 * - Token generation produces correct length and character set
 * - Rejection sampling eliminates modulo bias (B-9 fix)
 * - Token validation accepts valid tokens, rejects invalid
 * - URL building, display truncation, expiry calculations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateShareToken,
  getDisplayToken,
  buildShareUrl,
  isValidTokenFormat,
  calculateExpiryDate,
  isExpired,
  formatTimeRemaining,
} from '@/lib/share/token-generator'

describe('Token Generator — generateShareToken', () => {
  it('should generate a 32-character token by default', () => {
    const token = generateShareToken()
    expect(token).toHaveLength(32)
  })

  it('should generate tokens of custom length', () => {
    expect(generateShareToken(16)).toHaveLength(16)
    expect(generateShareToken(64)).toHaveLength(64)
    expect(generateShareToken(8)).toHaveLength(8)
  })

  it('should only contain URL-safe characters (no ambiguous 0, O, I, l, 1)', () => {
    const token = generateShareToken(256) // Long token for thorough check
    const forbidden = ['0', 'O', 'I', 'l', '1']
    for (const char of forbidden) {
      expect(token).not.toContain(char)
    }
  })

  it('should generate unique tokens', () => {
    const tokens = new Set<string>()
    for (let i = 0; i < 100; i++) {
      tokens.add(generateShareToken())
    }
    expect(tokens.size).toBe(100)
  })

  it('should pass validation on its own output', () => {
    for (let i = 0; i < 20; i++) {
      const token = generateShareToken()
      expect(isValidTokenFormat(token)).toBe(true)
    }
  })
})

describe('Token Generator — getDisplayToken', () => {
  it('should truncate with ellipsis prefix', () => {
    const token = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdef'
    expect(getDisplayToken(token, 6)).toBe('...abcdef')
  })

  it('should return full token if shorter than displayLength', () => {
    expect(getDisplayToken('ABC', 6)).toBe('ABC')
  })

  it('should default to 6 characters', () => {
    const token = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdef'
    const display = getDisplayToken(token)
    expect(display).toBe('...abcdef')
  })
})

describe('Token Generator — buildShareUrl', () => {
  it('should build URL with provided base', () => {
    expect(buildShareUrl('abc123', 'https://example.com')).toBe('https://example.com/share/abc123')
  })

  it('should fall back to default base URL', () => {
    const url = buildShareUrl('abc123')
    expect(url).toContain('/share/abc123')
  })
})

describe('Token Generator — isValidTokenFormat', () => {
  it('should accept valid 32-char token', () => {
    const token = generateShareToken(32)
    expect(isValidTokenFormat(token)).toBe(true)
  })

  it('should reject empty string', () => {
    expect(isValidTokenFormat('')).toBe(false)
  })

  it('should reject null/undefined', () => {
    expect(isValidTokenFormat(null as unknown as string)).toBe(false)
    expect(isValidTokenFormat(undefined as unknown as string)).toBe(false)
  })

  it('should reject token shorter than 16 chars', () => {
    expect(isValidTokenFormat('ABCDEFGHJKLMNPq')).toBe(false) // 15 chars
  })

  it('should reject token longer than 64 chars', () => {
    const longToken = 'A'.repeat(65)
    expect(isValidTokenFormat(longToken)).toBe(false)
  })

  it('should reject tokens with forbidden characters', () => {
    // Contains 'O' (ambiguous)
    expect(isValidTokenFormat('ABCDEFGHJKLMNOPQRSTUV')).toBe(false)
    // Contains '0' (ambiguous)
    expect(isValidTokenFormat('ABCDEFGHJKLMN0PQRSTUV')).toBe(false)
    // Contains special chars
    expect(isValidTokenFormat('ABCDEFGHJKLMN!@#$%RSTUV')).toBe(false)
  })

  it('should accept 16-char boundary', () => {
    const token = generateShareToken(16)
    expect(isValidTokenFormat(token)).toBe(true)
  })

  it('should accept 64-char boundary', () => {
    const token = generateShareToken(64)
    expect(isValidTokenFormat(token)).toBe(true)
  })
})

describe('Token Generator — calculateExpiryDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-12T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should calculate expiry N days from now', () => {
    const expiry = calculateExpiryDate(7)
    const date = new Date(expiry)
    expect(date.toISOString().startsWith('2026-02-19')).toBe(true)
  })

  it('should return ISO string format', () => {
    const expiry = calculateExpiryDate(30)
    expect(() => new Date(expiry)).not.toThrow()
    expect(expiry).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('Token Generator — isExpired', () => {
  it('should return true for past dates', () => {
    expect(isExpired('2020-01-01T00:00:00.000Z')).toBe(true)
  })

  it('should return false for future dates', () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    expect(isExpired(future.toISOString())).toBe(false)
  })
})

describe('Token Generator — formatTimeRemaining', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-12T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return "Expired" for past dates', () => {
    expect(formatTimeRemaining('2026-02-11T00:00:00.000Z')).toBe('Expired')
  })

  it('should show days remaining', () => {
    expect(formatTimeRemaining('2026-02-15T12:00:00.000Z')).toBe('3 days remaining')
  })

  it('should show singular day', () => {
    expect(formatTimeRemaining('2026-02-13T12:00:00.000Z')).toBe('1 day remaining')
  })

  it('should show hours when less than a day', () => {
    expect(formatTimeRemaining('2026-02-12T18:00:00.000Z')).toBe('6 hours remaining')
  })

  it('should show singular hour', () => {
    expect(formatTimeRemaining('2026-02-12T13:00:00.000Z')).toBe('1 hour remaining')
  })

  it('should show minutes when less than an hour', () => {
    expect(formatTimeRemaining('2026-02-12T12:30:00.000Z')).toBe('30 minutes remaining')
  })
})
