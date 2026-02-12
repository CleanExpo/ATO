/**
 * Tests for Secure Token Generator (lib/share/token-generator.ts)
 *
 * Validates:
 * - Token generation produces correct length and character set
 * - Rejection sampling eliminates modulo bias (B-9 fix)
 * - Token validation accepts valid tokens, rejects invalid
 * - URL building, display truncation, expiry calculations
 *
 * NOTE: This file extends the existing token-generator.test.ts at
 * tests/unit/token-generator.test.ts by adding a statistical bias test
 * and additional edge-case coverage. The original file remains intact;
 * this companion file lives in the share/ subdirectory.
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

// ---------------------------------------------------------------------------
// Character set constant (mirrors source)
// ---------------------------------------------------------------------------
const URL_SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

describe('generateShareToken', () => {
  it('generates a 32-character token by default', () => {
    const token = generateShareToken()
    expect(token).toHaveLength(32)
  })

  it('generates tokens of custom lengths', () => {
    for (const len of [8, 16, 48, 64]) {
      expect(generateShareToken(len)).toHaveLength(len)
    }
  })

  it('contains only URL-safe characters (no ambiguous 0, O, I, l, 1)', () => {
    const token = generateShareToken(512)
    const forbidden = ['0', 'O', 'I', 'l', '1']
    for (const char of token) {
      expect(forbidden).not.toContain(char)
      expect(URL_SAFE_CHARS).toContain(char)
    }
  })

  it('generates unique tokens across 200 calls', () => {
    const tokens = new Set<string>()
    for (let i = 0; i < 200; i++) {
      tokens.add(generateShareToken())
    }
    expect(tokens.size).toBe(200)
  })

  it('passes its own validation', () => {
    for (let i = 0; i < 20; i++) {
      expect(isValidTokenFormat(generateShareToken())).toBe(true)
    }
  })

  it('handles very short tokens (length 1)', () => {
    const token = generateShareToken(1)
    expect(token).toHaveLength(1)
    expect(URL_SAFE_CHARS).toContain(token)
  })

  it('handles very long tokens (length 256)', () => {
    const token = generateShareToken(256)
    expect(token).toHaveLength(256)
  })

  // ---- Statistical bias test (B-9 rejection sampling verification) ----

  it('exhibits no significant modulo bias across characters', () => {
    // Generate a large sample and count character frequencies.
    // With 56 characters and rejection sampling, each character should appear
    // with frequency ~1/56. Without rejection sampling (simple modulo),
    // characters 0-31 would appear ~4/256 and 32-55 would appear ~3/256.
    // The chi-squared test detects this deviation.

    const sampleSize = 50_000
    const token = generateShareToken(sampleSize)
    const counts = new Map<string, number>()
    for (const char of URL_SAFE_CHARS) {
      counts.set(char, 0)
    }
    for (const char of token) {
      counts.set(char, (counts.get(char) || 0) + 1)
    }

    const expected = sampleSize / URL_SAFE_CHARS.length // ~892.86
    let chiSquared = 0
    for (const count of counts.values()) {
      chiSquared += ((count - expected) ** 2) / expected
    }

    // Chi-squared critical value for df=55 at p=0.001 is ~92.0.
    // A biased generator (simple modulo 256 % 56) yields chi-squared ~400+.
    // An unbiased generator should comfortably be below 92.
    expect(chiSquared).toBeLessThan(92)
  })
})

describe('getDisplayToken', () => {
  it('truncates with ellipsis prefix', () => {
    expect(getDisplayToken('ABCDEFGHJKLMNPQRSTUVWXYZabcdef', 6)).toBe('...abcdef')
  })

  it('returns full token when shorter than displayLength', () => {
    expect(getDisplayToken('AB', 6)).toBe('AB')
  })

  it('returns full token when exactly equal to displayLength', () => {
    expect(getDisplayToken('ABCDEF', 6)).toBe('ABCDEF')
  })

  it('defaults to 6 characters', () => {
    const display = getDisplayToken('ABCDEFGHJKLMNPQRSTUVWXYZabcdef')
    expect(display).toBe('...abcdef')
  })
})

describe('buildShareUrl', () => {
  it('builds URL with provided base', () => {
    expect(buildShareUrl('tok123', 'https://example.com')).toBe(
      'https://example.com/share/tok123'
    )
  })

  it('falls back to NEXT_PUBLIC_APP_URL or default', () => {
    const url = buildShareUrl('tok123')
    expect(url).toContain('/share/tok123')
  })

  it('uses the default domain when no base and no env var', () => {
    const original = process.env.NEXT_PUBLIC_APP_URL
    delete process.env.NEXT_PUBLIC_APP_URL
    const url = buildShareUrl('abc')
    expect(url).toBe('https://ato-ai.app/share/abc')
    if (original !== undefined) process.env.NEXT_PUBLIC_APP_URL = original
  })
})

describe('isValidTokenFormat', () => {
  it('accepts valid 32-char token', () => {
    expect(isValidTokenFormat(generateShareToken(32))).toBe(true)
  })

  it('accepts 16-char boundary (minimum)', () => {
    expect(isValidTokenFormat(generateShareToken(16))).toBe(true)
  })

  it('accepts 64-char boundary (maximum)', () => {
    expect(isValidTokenFormat(generateShareToken(64))).toBe(true)
  })

  it('rejects empty string', () => {
    expect(isValidTokenFormat('')).toBe(false)
  })

  it('rejects null and undefined', () => {
    expect(isValidTokenFormat(null as unknown as string)).toBe(false)
    expect(isValidTokenFormat(undefined as unknown as string)).toBe(false)
  })

  it('rejects tokens shorter than 16 characters', () => {
    expect(isValidTokenFormat('ABCDEFGHJKLMNPq')).toBe(false) // 15 chars
  })

  it('rejects tokens longer than 64 characters', () => {
    expect(isValidTokenFormat('A'.repeat(65))).toBe(false)
  })

  it('rejects tokens with forbidden characters (O, 0, I, l, 1)', () => {
    expect(isValidTokenFormat('ABCDEFGHJKLMNOPQRSTUV')).toBe(false) // 'O'
    expect(isValidTokenFormat('ABCDEFGHJKLMN0PQRSTUV')).toBe(false) // '0'
  })

  it('rejects tokens with special characters', () => {
    expect(isValidTokenFormat('ABCDEFGHJKLMN!@#$%RST')).toBe(false)
  })

  it('rejects non-string types', () => {
    expect(isValidTokenFormat(12345 as unknown as string)).toBe(false)
  })
})

describe('calculateExpiryDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-12T00:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('calculates expiry N days from now', () => {
    const expiry = calculateExpiryDate(7)
    expect(new Date(expiry).toISOString().startsWith('2026-02-19')).toBe(true)
  })

  it('returns valid ISO string', () => {
    const expiry = calculateExpiryDate(30)
    expect(expiry).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(() => new Date(expiry)).not.toThrow()
  })

  it('handles 0 days (expires today)', () => {
    const expiry = calculateExpiryDate(0)
    expect(new Date(expiry).toISOString().startsWith('2026-02-12')).toBe(true)
  })
})

describe('isExpired', () => {
  it('returns true for past dates', () => {
    expect(isExpired('2020-01-01T00:00:00.000Z')).toBe(true)
  })

  it('returns false for future dates', () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    expect(isExpired(future.toISOString())).toBe(false)
  })
})

describe('formatTimeRemaining', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-12T12:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Expired" for past dates', () => {
    expect(formatTimeRemaining('2026-02-11T00:00:00.000Z')).toBe('Expired')
  })

  it('shows days remaining', () => {
    expect(formatTimeRemaining('2026-02-15T12:00:00.000Z')).toBe('3 days remaining')
  })

  it('shows singular day', () => {
    expect(formatTimeRemaining('2026-02-13T12:00:00.000Z')).toBe('1 day remaining')
  })

  it('shows hours when less than a day', () => {
    expect(formatTimeRemaining('2026-02-12T18:00:00.000Z')).toBe('6 hours remaining')
  })

  it('shows singular hour', () => {
    expect(formatTimeRemaining('2026-02-12T13:00:00.000Z')).toBe('1 hour remaining')
  })

  it('shows minutes when less than an hour', () => {
    expect(formatTimeRemaining('2026-02-12T12:30:00.000Z')).toBe('30 minutes remaining')
  })

  it('shows singular minute', () => {
    expect(formatTimeRemaining('2026-02-12T12:01:00.000Z')).toBe('1 minute remaining')
  })
})
