/**
 * Vitest Test Setup
 *
 * Global setup for all tests including mocks and environment configuration.
 */

import { beforeAll, afterEach, vi, expect } from 'vitest'

// =============================================================================
// Environment Setup
// =============================================================================

// Set test environment variables (NODE_ENV is automatically set by Vitest)
beforeAll(() => {
  const env = process.env as Record<string, string>
  env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  env.XERO_CLIENT_ID = 'test-xero-client-id'
  env.XERO_CLIENT_SECRET = 'test-xero-client-secret'
  env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64) // 32 bytes in hex
})

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
})

// =============================================================================
// Global Mocks
// =============================================================================

// Mock Next.js cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn()
  }))
}))

// Mock Supabase client
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null
      })
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null })
    }))
  }))
}))

// =============================================================================
// Custom Matchers
// =============================================================================

// Add custom matchers for tax calculations
expect.extend({
  toBeWithinTolerance(received: number, expected: number, tolerance = 0.01) {
    const pass = Math.abs(received - expected) <= tolerance
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be within ${tolerance} of ${expected}`
          : `Expected ${received} to be within ${tolerance} of ${expected}`
    }
  },

  toBeValidFinancialYear(received: string) {
    const pass = /^FY\d{4}-\d{2}$/.test(received)
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid financial year`
          : `Expected ${received} to be a valid financial year (FY2024-25)`
    }
  }
})

// =============================================================================
// Type Extensions
// =============================================================================

declare global {
  namespace Vi {
    interface Assertion {
      toBeWithinTolerance(expected: number, tolerance?: number): void
      toBeValidFinancialYear(): void
    }
  }
}

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock Xero transaction for testing
 */
export function createMockTransaction(overrides: Partial<{
  id: string
  date: string
  amount: number
  description: string
  accountCode: string
}> = {}) {
  return {
    id: 'tx-' + Math.random().toString(36).slice(2, 9),
    date: new Date().toISOString(),
    amount: 100.00,
    description: 'Test transaction',
    accountCode: '200',
    ...overrides
  }
}

/**
 * Create a mock analysis result for testing
 */
export function createMockAnalysisResult(overrides: Partial<{
  id: string
  tenantId: string
  category: string
  confidence: number
  estimatedBenefit: number
}> = {}) {
  return {
    id: 'ar-' + Math.random().toString(36).slice(2, 9),
    tenantId: 'test-tenant-id',
    category: 'rnd_candidate',
    confidence: 85,
    estimatedBenefit: 10000,
    ...overrides
  }
}

/**
 * Wait for async operations to complete
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
