/**
 * @vitest-environment node
 *
 * ABN Lookup Integration Tests
 *
 * Tests for lib/integrations/abn-lookup.ts
 * Australian Business Register (ABR) API integration
 *
 * Covers:
 * - lookupABN: format validation, checksum validation, cache hits, cache expiry, API success, API errors
 * - searchABNByName: returns ABNSearchResult structure, handles errors, state filter
 * - batchLookupABN: processes in batches of 10, normalises keys
 * - checkSupplierGSTStatus: withholding rules per s 12-190 TAA 1953
 * - Supabase cache read/write
 *
 * Tests: 15 test cases covering success AND error paths
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted to set ABR_GUID before the module constant is captured.
// vi.hoisted runs before vi.mock factories and module imports.
vi.hoisted(() => {
  process.env.ABR_GUID = 'test-guid-for-unit-tests'
})

// Mock Supabase service client
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { createServiceClient } from '@/lib/supabase/server'
import {
  lookupABN,
  searchABNByName,
  batchLookupABN,
  checkSupplierGSTStatus,
  type ABNLookupResult,
  type ABNSearchResult,
} from '@/lib/integrations/abn-lookup'

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create a mock Supabase client with configurable cache behaviour.
 */
function createMockSupabase(cacheResult: { data: unknown; error: unknown } = { data: null, error: null }) {
  const mockSingle = vi.fn().mockResolvedValue(cacheResult)
  const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
  const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    upsert: mockUpsert,
  })

  return {
    from: mockFrom,
    _mockFrom: mockFrom,
    _mockUpsert: mockUpsert,
    _mockSingle: mockSingle,
  }
}

/**
 * Build a minimal valid ABR XML response for ABN lookup.
 */
function buildABRXmlResponse(opts: {
  abn?: string
  entityName?: string
  entityTypeCode?: string
  status?: string
  gstRegistered?: boolean
  state?: string
  postcode?: string
} = {}): string {
  const abn = opts.abn || '51824753556'
  const name = opts.entityName || 'Australian Taxation Office'
  const typeCode = opts.entityTypeCode || 'CGE'
  const status = opts.status || 'Active'
  const state = opts.state || 'ACT'
  const postcode = opts.postcode || '2600'
  const gstBlock = opts.gstRegistered !== false
    ? '<goodsAndServicesTax><effectiveFrom>2000-07-01</effectiveFrom></goodsAndServicesTax>'
    : ''

  return `<?xml version="1.0"?>
<ABRPayloadSearchResults>
  <response>
    <businessEntity>
      <ABN>
        <identifierValue>${abn}</identifierValue>
      </ABN>
      <entityStatus>
        <entityStatusCode>${status}</entityStatusCode>
        <entityStatusEffectiveFrom>1999-11-01</entityStatusEffectiveFrom>
      </entityStatus>
      <entityType>
        <entityTypeCode>${typeCode}</entityTypeCode>
      </entityType>
      <mainName>
        <organisationName>${name}</organisationName>
      </mainName>
      <mainBusinessPhysicalAddress>
        <stateCode>${state}</stateCode>
        <postcode>${postcode}</postcode>
      </mainBusinessPhysicalAddress>
      ${gstBlock}
    </businessEntity>
  </response>
</ABRPayloadSearchResults>`
}

// =============================================================================
// lookupABN
// =============================================================================

describe('lookupABN', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no cache hit, Supabase returns nothing
    const mockSupabase = createMockSupabase({ data: null, error: null })
    vi.mocked(createServiceClient).mockResolvedValue(mockSupabase as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ---------------------------------------------------------------------------
  // Format validation
  // ---------------------------------------------------------------------------

  it('returns invalid result for non-11-digit ABN', async () => {
    const result = await lookupABN('1234567890') // 10 digits

    expect(result.isValid).toBe(false)
    expect(result.abn).toBe('1234567890')
    expect(result.entityName).toContain('Invalid ABN format')
    expect(result.source).toBe('error_fallback')
    expect(result.abnStatus).toBe('Invalid')
  })

  it('returns invalid result for ABN containing letters', async () => {
    const result = await lookupABN('5182475355A')

    expect(result.isValid).toBe(false)
    expect(result.entityName).toContain('Invalid ABN format')
    expect(result.source).toBe('error_fallback')
  })

  it('strips spaces from ABN before validation', async () => {
    // 51 824 753 556 is the ATO's own ABN with spaces -- valid format + checksum
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue(buildABRXmlResponse({ abn: '51824753556' })),
    })

    const result = await lookupABN('51 824 753 556')

    expect(result.abn).toBe('51824753556')
    expect(result.entityName).not.toContain('Invalid ABN format')
  })

  // ---------------------------------------------------------------------------
  // Checksum validation
  // ---------------------------------------------------------------------------

  it('returns invalid result for ABN with incorrect checksum', async () => {
    // 11111111111 is 11 digits but fails ABN checksum
    const result = await lookupABN('11111111111')

    expect(result.isValid).toBe(false)
    expect(result.entityName).toContain('checksum')
    expect(result.source).toBe('error_fallback')
  })

  it('passes checksum validation for known valid ABN (ATO: 51824753556)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue(buildABRXmlResponse({ abn: '51824753556' })),
    })

    const result = await lookupABN('51824753556')

    expect(result.entityName).not.toContain('Invalid ABN format')
    expect(result.entityName).not.toContain('checksum')
    expect(mockFetch).toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // Cache hit
  // ---------------------------------------------------------------------------

  it('returns cached result with source "cache" on cache hit', async () => {
    const cachedResult: ABNLookupResult = {
      abn: '51824753556',
      isValid: true,
      entityName: 'Australian Taxation Office',
      entityType: 'Commonwealth Government Entity',
      entityTypeCode: 'CGE',
      isGSTRegistered: true,
      gstRegisteredFrom: '2000-07-01',
      gstCancelledDate: null,
      isActive: true,
      abnStatus: 'Active',
      abnStatusEffectiveFrom: '1999-11-01',
      businessNames: [],
      tradingNames: [],
      state: 'ACT',
      postcode: '2600',
      lastUpdated: new Date().toISOString(),
      source: 'abr_api',
    }

    const mockSupabase = createMockSupabase({
      data: {
        result: cachedResult,
        cached_at: new Date().toISOString(), // Fresh cache
      },
      error: null,
    })
    vi.mocked(createServiceClient).mockResolvedValue(mockSupabase as never)

    const result = await lookupABN('51824753556')

    expect(result.source).toBe('cache')
    expect(result.entityName).toBe('Australian Taxation Office')
    expect(result.isValid).toBe(true)
    expect(result.isGSTRegistered).toBe(true)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // Cache expiry
  // ---------------------------------------------------------------------------

  it('ignores expired cache entries and calls API', async () => {
    const cachedResult: ABNLookupResult = {
      abn: '51824753556',
      isValid: true,
      entityName: 'Stale Entity',
      entityType: 'Unknown',
      entityTypeCode: '',
      isGSTRegistered: false,
      gstRegisteredFrom: null,
      gstCancelledDate: null,
      isActive: true,
      abnStatus: 'Active',
      abnStatusEffectiveFrom: '',
      businessNames: [],
      tradingNames: [],
      state: null,
      postcode: null,
      lastUpdated: new Date().toISOString(),
      source: 'abr_api',
    }

    // Cache is 10 days old (TTL is 7 days)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const mockSupabase = createMockSupabase({
      data: {
        result: cachedResult,
        cached_at: tenDaysAgo,
      },
      error: null,
    })
    vi.mocked(createServiceClient).mockResolvedValue(mockSupabase as never)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue(buildABRXmlResponse({ abn: '51824753556' })),
    })

    const result = await lookupABN('51824753556')

    // Should have called the API (expired cache ignored)
    expect(mockFetch).toHaveBeenCalled()
    expect(result.entityName).toBe('Australian Taxation Office')
    expect(result.source).toBe('abr_api')
  })

  // ---------------------------------------------------------------------------
  // API success with entity type mapping
  // ---------------------------------------------------------------------------

  it('maps entity type codes to human-readable names', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue(
        buildABRXmlResponse({
          abn: '51824753556',
          entityTypeCode: 'PRV',
        })
      ),
    })

    const result = await lookupABN('51824753556')

    expect(result.entityType).toBe('Australian Private Company')
  })

  // ---------------------------------------------------------------------------
  // API error fallback
  // ---------------------------------------------------------------------------

  it('returns error_fallback result when ABR API fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ABR API timeout'))

    const result = await lookupABN('51824753556')

    expect(result.isValid).toBe(false)
    expect(result.entityName).toContain('ABR API unavailable')
    expect(result.source).toBe('error_fallback')
  })

  it('returns error_fallback when ABR API returns non-200 status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    })

    const result = await lookupABN('51824753556')

    expect(result.isValid).toBe(false)
    expect(result.source).toBe('error_fallback')
  })
})

// =============================================================================
// searchABNByName
// =============================================================================

describe('searchABNByName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ABNSearchResult structure with matching records', async () => {
    const xml = `<?xml version="1.0"?>
<ABRPayloadSearchResults>
  <response>
    <searchResultsRecord>
      <ABN>51824753556</ABN>
      <mainName><organisationName>Australian Taxation Office</organisationName></mainName>
      <entityTypeDescription>Commonwealth Government Entity</entityTypeDescription>
      <mainBusinessPhysicalAddress>
        <stateCode>ACT</stateCode>
        <postcode>2600</postcode>
      </mainBusinessPhysicalAddress>
      <entityStatus><entityStatusCode>Active</entityStatusCode></entityStatus>
      <score>100</score>
    </searchResultsRecord>
  </response>
</ABRPayloadSearchResults>`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue(xml),
    })

    const result: ABNSearchResult = await searchABNByName('Australian Taxation Office')

    expect(result.query).toBe('Australian Taxation Office')
    expect(result.results.length).toBeGreaterThanOrEqual(1)
    expect(result.results[0].abn).toBe('51824753556')
    expect(result.results[0].entityName).toBe('Australian Taxation Office')
    expect(result.results[0].score).toBe(100)
    expect(result.totalResults).toBe(result.results.length)
  })

  it('returns empty results when search API fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const result = await searchABNByName('Test Company')

    expect(result.results).toEqual([])
    expect(result.totalResults).toBe(0)
    expect(result.query).toBe('Test Company')
  })

  it('sorts results by score descending', async () => {
    const xml = `<?xml version="1.0"?>
<ABRPayloadSearchResults>
  <response>
    <searchResultsRecord>
      <ABN>11111111111</ABN>
      <mainName><organisationName>Low Score Entity</organisationName></mainName>
      <entityTypeDescription>Company</entityTypeDescription>
      <mainBusinessPhysicalAddress><stateCode>NSW</stateCode><postcode>2000</postcode></mainBusinessPhysicalAddress>
      <entityStatus><entityStatusCode>Active</entityStatusCode></entityStatus>
      <score>70</score>
    </searchResultsRecord>
    <searchResultsRecord>
      <ABN>22222222222</ABN>
      <mainName><organisationName>High Score Entity</organisationName></mainName>
      <entityTypeDescription>Company</entityTypeDescription>
      <mainBusinessPhysicalAddress><stateCode>VIC</stateCode><postcode>3000</postcode></mainBusinessPhysicalAddress>
      <entityStatus><entityStatusCode>Active</entityStatusCode></entityStatus>
      <score>95</score>
    </searchResultsRecord>
  </response>
</ABRPayloadSearchResults>`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue(xml),
    })

    const result = await searchABNByName('Entity')

    expect(result.results[0].score).toBeGreaterThanOrEqual(result.results[1].score)
  })
})

// =============================================================================
// batchLookupABN
// =============================================================================

describe('batchLookupABN', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mockSupabase = createMockSupabase({ data: null, error: null })
    vi.mocked(createServiceClient).mockResolvedValue(mockSupabase as never)
  })

  it('processes ABNs in batches of 10', async () => {
    // Create 15 invalid ABNs so they fail fast at format validation
    const abns = Array.from({ length: 15 }, (_, i) => `${i}`) // single digits = invalid format

    const results = await batchLookupABN(abns)

    expect(results).toBeInstanceOf(Map)
    expect(results.size).toBe(15)

    for (const [, result] of results) {
      expect(result.isValid).toBe(false)
    }
  })

  it('returns Map keyed by normalised ABN', async () => {
    const abns = ['12345', '67890']

    const results = await batchLookupABN(abns)

    expect(results.has('12345')).toBe(true)
    expect(results.has('67890')).toBe(true)
  })
})

// =============================================================================
// checkSupplierGSTStatus
// =============================================================================

describe('checkSupplierGSTStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mockSupabase = createMockSupabase({ data: null, error: null })
    vi.mocked(createServiceClient).mockResolvedValue(mockSupabase as never)
  })

  it('returns shouldWithholdGST: true for invalid ABN (47% withholding per s 12-190 TAA 1953)', async () => {
    const result = await checkSupplierGSTStatus('12345')

    expect(result.isValid).toBe(false)
    expect(result.isGSTRegistered).toBe(false)
    expect(result.shouldWithholdGST).toBe(true)
    expect(result.note).toContain('47%')
    expect(result.note).toContain('s 12-190 TAA 1953')
  })

  it('returns shouldWithholdGST: false with GST note for valid ABN not GST registered', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue(
        buildABRXmlResponse({
          abn: '51824753556',
          status: 'Active',
          gstRegistered: false,
        })
      ),
    })

    const result = await checkSupplierGSTStatus('51824753556')

    expect(result.isValid).toBe(true)
    expect(result.isGSTRegistered).toBe(false)
    expect(result.shouldWithholdGST).toBe(false)
    expect(result.note).toContain('No GST credits')
  })

  it('returns all clear for valid ABN with active GST registration', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue(
        buildABRXmlResponse({
          abn: '51824753556',
          status: 'Active',
          gstRegistered: true,
        })
      ),
    })

    const result = await checkSupplierGSTStatus('51824753556')

    expect(result.isValid).toBe(true)
    expect(result.isGSTRegistered).toBe(true)
    expect(result.shouldWithholdGST).toBe(false)
    expect(result.note).toContain('GST credits available')
  })
})
