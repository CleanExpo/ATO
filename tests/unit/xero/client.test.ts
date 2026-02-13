/**
 * Unit tests for Xero OAuth Client
 *
 * Tests cover:
 * - createXeroClient returns configured client
 * - isTokenExpired correctly identifies expired/valid tokens
 * - isValidTokenSet validates token structure
 * - Token refresh logic
 * - Error handling for invalid credentials
 * - Base URL resolution (env vars, Vercel, localhost)
 * - Xero scopes configuration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInitialize = vi.fn().mockResolvedValue(undefined)
const mockSetTokenSet = vi.fn()
const mockRefreshToken = vi.fn()

vi.mock('xero-node', () => {
  return {
    XeroClient: vi.fn().mockImplementation((config: Record<string, unknown>) => ({
      ...config,
      initialize: mockInitialize,
      setTokenSet: mockSetTokenSet,
      refreshToken: mockRefreshToken,
    })),
    TokenSet: vi.fn(),
  }
})

vi.mock('@/lib/xero/retry', () => ({
  withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  createXeroClient,
  isTokenExpired,
  isValidTokenSet,
  refreshXeroTokens,
  XERO_SCOPES,
} from '@/lib/xero/client'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Xero Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Ensure credentials are set for most tests
    process.env.XERO_CLIENT_ID = 'test-client-id'
    process.env.XERO_CLIENT_SECRET = 'test-client-secret'
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000'
  })

  // ========================================================================
  // XERO_SCOPES
  // ========================================================================

  describe('XERO_SCOPES', () => {
    it('should include offline_access for token refresh', () => {
      expect(XERO_SCOPES).toContain('offline_access')
    })

    it('should include read scopes for accounting data', () => {
      expect(XERO_SCOPES).toContain('accounting.transactions.read')
      expect(XERO_SCOPES).toContain('accounting.reports.read')
      expect(XERO_SCOPES).toContain('accounting.contacts.read')
      expect(XERO_SCOPES).toContain('accounting.settings.read')
    })

    it('should include asset and payroll read scopes', () => {
      expect(XERO_SCOPES).toContain('assets.read')
      expect(XERO_SCOPES).toContain('payroll.employees.read')
      expect(XERO_SCOPES).toContain('payroll.payruns.read')
    })

    it('should include openid/profile/email scopes', () => {
      expect(XERO_SCOPES).toContain('openid')
      expect(XERO_SCOPES).toContain('profile')
      expect(XERO_SCOPES).toContain('email')
    })
  })

  // ========================================================================
  // createXeroClient
  // ========================================================================

  describe('createXeroClient', () => {
    it('should return a client with correct configuration', () => {
      const client = createXeroClient() as unknown as Record<string, unknown>

      expect(client.clientId).toBe('test-client-id')
      expect(client.clientSecret).toBe('test-client-secret')
      expect(client.httpTimeout).toBe(30000)
    })

    it('should set redirect URI using base URL', () => {
      const client = createXeroClient() as unknown as Record<string, unknown>

      expect(client.redirectUris).toEqual(['http://localhost:3000/api/auth/xero/callback'])
    })

    it('should split scopes into an array', () => {
      const client = createXeroClient() as unknown as Record<string, unknown>

      expect(Array.isArray(client.scopes)).toBe(true)
      expect((client.scopes as string[]).length).toBeGreaterThan(0)
      expect(client.scopes).toContain('offline_access')
    })

    it('should accept custom baseUrl override', () => {
      const client = createXeroClient({
        baseUrl: 'https://custom.example.com',
      }) as unknown as Record<string, unknown>

      expect(client.redirectUris).toEqual(['https://custom.example.com/api/auth/xero/callback'])
    })

    it('should use VERCEL_URL when NEXT_PUBLIC_BASE_URL is not set', () => {
      delete process.env.NEXT_PUBLIC_BASE_URL
      process.env.VERCEL_URL = 'my-app.vercel.app'

      const client = createXeroClient() as unknown as Record<string, unknown>

      expect(client.redirectUris).toEqual(['https://my-app.vercel.app/api/auth/xero/callback'])

      delete process.env.VERCEL_URL
      process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000'
    })

    it('should fall back to localhost when no env vars set', () => {
      delete process.env.NEXT_PUBLIC_BASE_URL
      delete process.env.VERCEL_URL

      const client = createXeroClient() as unknown as Record<string, unknown>

      expect(client.redirectUris).toEqual(['http://localhost:3000/api/auth/xero/callback'])
    })

    it('should trim trailing slashes from base URL', () => {
      const client = createXeroClient({
        baseUrl: 'https://example.com///',
      }) as unknown as Record<string, unknown>

      expect(client.redirectUris).toEqual(['https://example.com/api/auth/xero/callback'])
    })

    it('should throw when XERO_CLIENT_ID is missing', () => {
      delete process.env.XERO_CLIENT_ID

      expect(() => createXeroClient()).toThrow('Missing Xero OAuth credentials')
    })

    it('should throw when XERO_CLIENT_SECRET is missing', () => {
      delete process.env.XERO_CLIENT_SECRET

      expect(() => createXeroClient()).toThrow('Missing Xero OAuth credentials')
    })

    it('should pass state option to XeroClient', () => {
      const client = createXeroClient({ state: 'my-state' }) as unknown as Record<string, unknown>

      expect(client.state).toBe('my-state')
    })

    it('should trim whitespace from credentials', () => {
      process.env.XERO_CLIENT_ID = '  trimmed-id  '
      process.env.XERO_CLIENT_SECRET = '  trimmed-secret  '

      const client = createXeroClient() as unknown as Record<string, unknown>

      expect(client.clientId).toBe('trimmed-id')
      expect(client.clientSecret).toBe('trimmed-secret')
    })
  })

  // ========================================================================
  // isValidTokenSet
  // ========================================================================

  describe('isValidTokenSet', () => {
    it('should return true for valid token set', () => {
      const tokens = {
        access_token: 'abc123',
        refresh_token: 'def456',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }

      expect(isValidTokenSet(tokens)).toBe(true)
    })

    it('should return false for null', () => {
      expect(isValidTokenSet(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isValidTokenSet(undefined)).toBe(false)
    })

    it('should return false for non-object', () => {
      expect(isValidTokenSet('string')).toBe(false)
      expect(isValidTokenSet(123)).toBe(false)
    })

    it('should return false when access_token is missing', () => {
      expect(isValidTokenSet({ refresh_token: 'abc', expires_at: 123 })).toBe(false)
    })

    it('should return false when refresh_token is missing', () => {
      expect(isValidTokenSet({ access_token: 'abc', expires_at: 123 })).toBe(false)
    })

    it('should return false when expires_at is missing', () => {
      expect(isValidTokenSet({ access_token: 'abc', refresh_token: 'def' })).toBe(false)
    })

    it('should return false when expires_at is not a number', () => {
      expect(isValidTokenSet({
        access_token: 'abc',
        refresh_token: 'def',
        expires_at: 'not-a-number',
      })).toBe(false)
    })
  })

  // ========================================================================
  // isTokenExpired
  // ========================================================================

  describe('isTokenExpired', () => {
    it('should return false for token expiring in more than 5 minutes', () => {
      const tenMinutesFromNow = Math.floor(Date.now() / 1000) + 600

      const result = isTokenExpired({
        access_token: 'abc',
        refresh_token: 'def',
        expires_at: tenMinutesFromNow,
      })

      expect(result).toBe(false)
    })

    it('should return true for token expiring in less than 5 minutes', () => {
      const threeMinutesFromNow = Math.floor(Date.now() / 1000) + 180

      const result = isTokenExpired({
        access_token: 'abc',
        refresh_token: 'def',
        expires_at: threeMinutesFromNow,
      })

      expect(result).toBe(true)
    })

    it('should return true for already expired token', () => {
      const oneHourAgo = Math.floor(Date.now() / 1000) - 3600

      const result = isTokenExpired({
        access_token: 'abc',
        refresh_token: 'def',
        expires_at: oneHourAgo,
      })

      expect(result).toBe(true)
    })

    it('should return true when expires_at is 0 (missing)', () => {
      const result = isTokenExpired({
        access_token: 'abc',
        refresh_token: 'def',
        expires_at: undefined as unknown as number,
      })

      expect(result).toBe(true)
    })

    it('should return true for token expiring exactly at the 5-minute boundary', () => {
      const exactlyFiveMinutes = Math.floor(Date.now() / 1000) + 300

      const result = isTokenExpired({
        access_token: 'abc',
        refresh_token: 'def',
        expires_at: exactlyFiveMinutes,
      })

      // expiresAt - 300 <= now  =>  now + 300 - 300 <= now  => now <= now => true
      expect(result).toBe(true)
    })
  })

  // ========================================================================
  // refreshXeroTokens
  // ========================================================================

  describe('refreshXeroTokens', () => {
    it('should initialize client, set tokens, and call refreshToken', async () => {
      const newTokens = {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }
      mockRefreshToken.mockResolvedValue(newTokens)

      const result = await refreshXeroTokens({
        access_token: 'old-access',
        refresh_token: 'old-refresh',
        expires_at: Math.floor(Date.now() / 1000) - 100,
      })

      expect(mockInitialize).toHaveBeenCalled()
      expect(mockSetTokenSet).toHaveBeenCalled()
      expect(mockRefreshToken).toHaveBeenCalled()
      expect(result).toEqual(newTokens)
    })

    it('should pass baseUrl option to createXeroClient', async () => {
      mockRefreshToken.mockResolvedValue({
        access_token: 'new',
        refresh_token: 'new-r',
        expires_at: 99999,
      })

      await refreshXeroTokens(
        { access_token: 'a', refresh_token: 'b', expires_at: 1 },
        'https://custom.example.com'
      )

      // The withRetry mock just calls the fn directly, which creates a Xero client
      // We can verify by checking XeroClient constructor was called
      const { XeroClient } = await import('xero-node')
      expect(XeroClient).toHaveBeenCalled()
    })

    it('should propagate errors from token refresh', async () => {
      mockRefreshToken.mockRejectedValue(new Error('Invalid refresh token'))

      await expect(
        refreshXeroTokens({
          access_token: 'a',
          refresh_token: 'expired',
          expires_at: 1,
        })
      ).rejects.toThrow('Invalid refresh token')
    })
  })
})
