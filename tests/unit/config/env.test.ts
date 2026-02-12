/**
 * Tests for Environment Configuration and Validation (lib/config/env.ts)
 *
 * Validates:
 * - serverConfig throws ConfigurationError for missing required vars
 * - clientConfig throws ConfigurationError for missing/invalid required vars
 * - optionalConfig returns defaults for missing optional vars
 * - GOOGLE_AI_MODEL defaults correctly
 * - sharedConfig resolves base URL from env vars
 * - validateConfiguration() returns structured result
 * - Lazy proxy initialization (config only validated on first access)
 *
 * NOTE: Because env.ts uses module-level lazy singletons (Proxy with cached
 * result), each test that manipulates process.env must re-import the module
 * via vi.importActual or vi.resetModules to get fresh singletons.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the logger to avoid side effects
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
// Helpers
// ---------------------------------------------------------------------------

/** Save and restore process.env around a block */
function withEnv(overrides: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const saved: Record<string, string | undefined> = {}
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key]
  }
  Object.assign(process.env, overrides)
  try {
    const result = fn()
    if (result instanceof Promise) {
      return result.finally(() => {
        for (const [key, val] of Object.entries(saved)) {
          if (val === undefined) delete process.env[key]
          else process.env[key] = val
        }
      })
    }
  } finally {
    for (const [key, val] of Object.entries(saved)) {
      if (val === undefined) delete process.env[key]
      else process.env[key] = val
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('optionalConfig', () => {
  // optionalConfig is evaluated at module load time with getOptionalEnv,
  // but since setup.ts already sets the env vars, we test the values.

  it('returns GOOGLE_AI_MODEL default when env var not set', async () => {
    // Use fresh import to test defaults
    const saved = process.env.GOOGLE_AI_MODEL
    delete process.env.GOOGLE_AI_MODEL

    // Re-import to get fresh module
    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { optionalConfig } = await import('@/lib/config/env')

    expect(optionalConfig.googleAiModel).toBe('gemini-2.0-flash')

    if (saved !== undefined) process.env.GOOGLE_AI_MODEL = saved
  })

  it('uses custom GOOGLE_AI_MODEL when set', async () => {
    process.env.GOOGLE_AI_MODEL = 'gemini-2.5-pro'

    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { optionalConfig } = await import('@/lib/config/env')

    expect(optionalConfig.googleAiModel).toBe('gemini-2.5-pro')

    delete process.env.GOOGLE_AI_MODEL
  })

  it('returns empty string for GOOGLE_AI_API_KEY when not set', async () => {
    const saved = process.env.GOOGLE_AI_API_KEY
    delete process.env.GOOGLE_AI_API_KEY

    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { optionalConfig } = await import('@/lib/config/env')

    expect(optionalConfig.googleAiApiKey).toBe('')

    if (saved !== undefined) process.env.GOOGLE_AI_API_KEY = saved
  })

  it('returns default businessName when not set', async () => {
    const saved = process.env.BUSINESS_NAME
    delete process.env.BUSINESS_NAME

    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { optionalConfig } = await import('@/lib/config/env')

    expect(optionalConfig.businessName).toBe('Your Business')

    if (saved !== undefined) process.env.BUSINESS_NAME = saved
  })
})

describe('serverConfig', () => {
  it('throws ConfigurationError when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    const saved = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { serverConfig } = await import('@/lib/config/env')

    expect(() => serverConfig.supabase).toThrow('SUPABASE_SERVICE_ROLE_KEY')

    if (saved !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = saved
  })

  it('returns service role key when set', async () => {
    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { serverConfig } = await import('@/lib/config/env')

    expect(serverConfig.supabase.serviceRoleKey).toBeTruthy()
  })

  it('returns empty string defaults for optional OAuth configs', async () => {
    const saved = {
      XERO_CLIENT_ID: process.env.XERO_CLIENT_ID,
      MYOB_CLIENT_ID: process.env.MYOB_CLIENT_ID,
      QUICKBOOKS_CLIENT_ID: process.env.QUICKBOOKS_CLIENT_ID,
    }
    delete process.env.XERO_CLIENT_ID
    delete process.env.MYOB_CLIENT_ID
    delete process.env.QUICKBOOKS_CLIENT_ID

    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { serverConfig } = await import('@/lib/config/env')

    expect(serverConfig.myob.clientId).toBe('')
    expect(serverConfig.quickbooks.clientId).toBe('')

    // Restore
    for (const [key, val] of Object.entries(saved)) {
      if (val !== undefined) process.env[key] = val
    }
  })
})

describe('clientConfig', () => {
  it('throws ConfigurationError when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    const saved = process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_URL

    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { clientConfig } = await import('@/lib/config/env')

    expect(() => clientConfig.supabase).toThrow('NEXT_PUBLIC_SUPABASE_URL')

    if (saved !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = saved
  })

  it('throws ConfigurationError when NEXT_PUBLIC_SUPABASE_URL is invalid URL', async () => {
    const saved = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-valid-url'

    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { clientConfig } = await import('@/lib/config/env')

    expect(() => clientConfig.supabase).toThrow('Invalid URL')

    if (saved !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = saved
  })

  it('returns valid supabase config when env vars are set', async () => {
    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { clientConfig } = await import('@/lib/config/env')

    expect(clientConfig.supabase.url).toBe('https://test.supabase.co')
    expect(clientConfig.supabase.anonKey).toBeTruthy()
  })
})

describe('sharedConfig', () => {
  it('uses NEXT_PUBLIC_BASE_URL when set', async () => {
    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { sharedConfig } = await import('@/lib/config/env')

    expect(sharedConfig.baseUrl).toBe('http://localhost:3000')
  })

  it('falls back to VERCEL_URL when NEXT_PUBLIC_BASE_URL is not set', async () => {
    const savedBase = process.env.NEXT_PUBLIC_BASE_URL
    const savedVercel = process.env.VERCEL_URL
    delete process.env.NEXT_PUBLIC_BASE_URL
    process.env.VERCEL_URL = 'my-app.vercel.app'

    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { sharedConfig } = await import('@/lib/config/env')

    expect(sharedConfig.baseUrl).toBe('https://my-app.vercel.app')

    if (savedBase !== undefined) process.env.NEXT_PUBLIC_BASE_URL = savedBase
    if (savedVercel !== undefined) process.env.VERCEL_URL = savedVercel
    else delete process.env.VERCEL_URL
  })

  it('falls back to localhost when no URL env vars set', async () => {
    const savedBase = process.env.NEXT_PUBLIC_BASE_URL
    const savedVercel = process.env.VERCEL_URL
    delete process.env.NEXT_PUBLIC_BASE_URL
    delete process.env.VERCEL_URL

    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { sharedConfig } = await import('@/lib/config/env')

    expect(sharedConfig.baseUrl).toMatch(/^http:\/\/localhost/)

    if (savedBase !== undefined) process.env.NEXT_PUBLIC_BASE_URL = savedBase
    if (savedVercel !== undefined) process.env.VERCEL_URL = savedVercel
  })

  it('reports isProduction correctly', async () => {
    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { sharedConfig } = await import('@/lib/config/env')

    // In test mode, NODE_ENV is 'test'
    expect(sharedConfig.isProduction).toBe(false)
    expect(sharedConfig.isDevelopment).toBe(false)
  })
})

describe('validateConfiguration', () => {
  it('returns valid=true when all required vars are set', async () => {
    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { validateConfiguration } = await import('@/lib/config/env')

    const result = validateConfiguration()

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('includes warnings for missing optional vars', async () => {
    const savedBrave = process.env.BRAVE_API_KEY
    const savedAbn = process.env.BUSINESS_ABN
    delete process.env.BRAVE_API_KEY
    delete process.env.BUSINESS_ABN

    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { validateConfiguration } = await import('@/lib/config/env')

    const result = validateConfiguration()

    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings.some((w: string) => w.includes('BRAVE_API_KEY'))).toBe(true)
    expect(result.warnings.some((w: string) => w.includes('BUSINESS_ABN'))).toBe(true)

    if (savedBrave !== undefined) process.env.BRAVE_API_KEY = savedBrave
    if (savedAbn !== undefined) process.env.BUSINESS_ABN = savedAbn
  })

  it('returns valid=false when required vars are missing', async () => {
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    vi.resetModules()
    vi.mock('@/lib/logger', () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }))
    const { validateConfiguration } = await import('@/lib/config/env')

    const result = validateConfiguration()

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)

    if (savedKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey
  })
})
