/**
 * ABN Lookup Integration
 *
 * Integrates with the Australian Business Register (ABR) API to validate
 * ABNs and retrieve business details.
 *
 * API: ABR Web Services (https://abr.business.gov.au/abrxmlsearch/)
 * Authentication: GUID-based (requires registration at abr.business.gov.au)
 *
 * Uses:
 * - Validate supplier ABNs for GST withholding compliance
 * - Verify entity type for tax rate determination
 * - Check GST registration status
 * - Cache results in Supabase for performance (ABR responses are public data)
 *
 * Privacy Note:
 * ABR data is publicly available. However, caching and re-serving has
 * different privacy implications under APP 11. Results for sole traders
 * may contain individual names.
 */

import { createServiceClient } from '@/lib/supabase/server'

// ABR API configuration
const ABR_BASE_URL = 'https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx'
const ABR_GUID = process.env.ABR_GUID || ''
const CACHE_TTL_HOURS = 24 * 7 // 7 days cache for ABN data

/**
 * ABN lookup result.
 */
export interface ABNLookupResult {
  abn: string
  isValid: boolean
  entityName: string
  entityType: string // e.g., 'Company', 'Individual/Sole Trader', 'Trust', 'Partnership'
  entityTypeCode: string
  isGSTRegistered: boolean
  gstRegisteredFrom: string | null
  gstCancelledDate: string | null
  isActive: boolean
  abnStatus: string // 'Active' or 'Cancelled'
  abnStatusEffectiveFrom: string
  businessNames: string[]
  tradingNames: string[]
  state: string | null
  postcode: string | null
  lastUpdated: string
  source: 'abr_api' | 'cache' | 'error_fallback'
}

/**
 * ABN search results (search by name).
 */
export interface ABNSearchResult {
  results: Array<{
    abn: string
    entityName: string
    entityType: string
    state: string
    postcode: string
    isActive: boolean
    score: number
  }>
  totalResults: number
  query: string
}

/**
 * Look up an ABN and return entity details.
 * Checks cache first, then calls ABR API.
 *
 * @param abn - The ABN to look up (11-digit number, spaces ignored)
 * @param tenantId - Optional tenant ID for cache scoping
 */
export async function lookupABN(
  abn: string,
  tenantId?: string
): Promise<ABNLookupResult> {
  // Normalise ABN (remove spaces, validate format)
  const normalisedABN = abn.replace(/\s/g, '')

  if (!isValidABNFormat(normalisedABN)) {
    return createInvalidResult(normalisedABN, 'Invalid ABN format. ABN must be 11 digits.')
  }

  // Check ABN checksum
  if (!validateABNChecksum(normalisedABN)) {
    return createInvalidResult(normalisedABN, 'ABN checksum validation failed. Check the number is correct.')
  }

  // Check cache first
  const cached = await getCachedABN(normalisedABN)
  if (cached) {
    return { ...cached, source: 'cache' }
  }

  // Call ABR API
  try {
    const result = await callABRApi(normalisedABN)

    // Cache the result
    await cacheABNResult(normalisedABN, result)

    return result
  } catch (error) {
    console.error('ABR API call failed:', error)
    return createInvalidResult(normalisedABN, 'ABR API unavailable. Please try again later.')
  }
}

/**
 * Search for businesses by name.
 *
 * @param name - Business name to search
 * @param state - Optional state filter
 */
export async function searchABNByName(
  name: string,
  state?: string
): Promise<ABNSearchResult> {
  if (!ABR_GUID) {
    return { results: [], totalResults: 0, query: name }
  }

  try {
    const params = new URLSearchParams({
      name,
      authenticationGuid: ABR_GUID,
      searchWidth: 'typical',
      minimumScore: '80',
      maxSearchResults: '20',
    })

    if (state) {
      params.set('stateCode', state)
    }

    const response = await fetch(
      `${ABR_BASE_URL}/ABRSearchByNameAdvancedSimpleProtocol2017?${params.toString()}`,
      {
        headers: { 'Accept': 'application/xml' },
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!response.ok) {
      throw new Error(`ABR search failed: ${response.status}`)
    }

    const xml = await response.text()
    return parseSearchResponse(xml, name)
  } catch (error) {
    console.error('ABR search failed:', error)
    return { results: [], totalResults: 0, query: name }
  }
}

/**
 * Batch look up multiple ABNs.
 *
 * @param abns - Array of ABNs to look up
 * @param tenantId - Optional tenant ID
 */
export async function batchLookupABN(
  abns: string[],
  tenantId?: string
): Promise<Map<string, ABNLookupResult>> {
  const results = new Map<string, ABNLookupResult>()

  // Process in batches of 10 to avoid rate limiting
  const batchSize = 10
  for (let i = 0; i < abns.length; i += batchSize) {
    const batch = abns.slice(i, i + batchSize)

    const batchResults = await Promise.all(
      batch.map(abn => lookupABN(abn, tenantId))
    )

    batch.forEach((abn, index) => {
      results.set(abn.replace(/\s/g, ''), batchResults[index])
    })

    // Rate limit: 1 second between batches
    if (i + batchSize < abns.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return results
}

/**
 * Check if a supplier has a valid, active ABN with GST registration.
 * Used for GST withholding compliance checks.
 */
export async function checkSupplierGSTStatus(
  abn: string
): Promise<{
  isValid: boolean
  isGSTRegistered: boolean
  shouldWithholdGST: boolean
  note: string
}> {
  const result = await lookupABN(abn)

  if (!result.isValid || !result.isActive) {
    return {
      isValid: false,
      isGSTRegistered: false,
      shouldWithholdGST: true,
      note: 'ABN is invalid or cancelled. Withhold 47% from payments (s 12-190 TAA 1953).',
    }
  }

  if (!result.isGSTRegistered) {
    return {
      isValid: true,
      isGSTRegistered: false,
      shouldWithholdGST: false,
      note: 'ABN valid but not GST registered. No GST credits available on payments to this supplier.',
    }
  }

  return {
    isValid: true,
    isGSTRegistered: true,
    shouldWithholdGST: false,
    note: 'ABN valid and GST registered. GST credits available.',
  }
}

// -- Internal functions --

/**
 * Validate ABN format (11 digits).
 */
function isValidABNFormat(abn: string): boolean {
  return /^\d{11}$/.test(abn)
}

/**
 * Validate ABN using checksum algorithm.
 * ABN checksum: subtract 1 from first digit, apply weights, mod 89 should equal 0.
 */
function validateABNChecksum(abn: string): boolean {
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
  const digits = abn.split('').map(Number)

  // Subtract 1 from first digit
  digits[0] = digits[0] - 1

  let sum = 0
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i]
  }

  return sum % 89 === 0
}

/**
 * Call ABR API to look up an ABN.
 */
async function callABRApi(abn: string): Promise<ABNLookupResult> {
  if (!ABR_GUID) {
    return createInvalidResult(abn, 'ABR GUID not configured. Set ABR_GUID environment variable.')
  }

  const params = new URLSearchParams({
    searchString: abn,
    includeHistoricalDetails: 'N',
    authenticationGuid: ABR_GUID,
  })

  const response = await fetch(
    `${ABR_BASE_URL}/ABRSearchByABN?${params.toString()}`,
    {
      headers: { 'Accept': 'application/xml' },
      signal: AbortSignal.timeout(15000),
    }
  )

  if (!response.ok) {
    throw new Error(`ABR API returned ${response.status}`)
  }

  const xml = await response.text()
  return parseABNResponse(xml, abn)
}

/**
 * Parse ABR XML response for ABN lookup.
 */
function parseABNResponse(xml: string, abn: string): ABNLookupResult {
  // Simple XML parsing (avoid heavy XML parser dependency)
  const getTag = (tag: string): string => {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))
    return match ? match[1].trim() : ''
  }

  const getAttr = (tag: string, attr: string): string => {
    const match = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*/>`))
    return match ? match[1].trim() : ''
  }

  const abnValue = getTag('identifierValue') || abn
  const abnStatus = getTag('entityStatusCode') || 'Unknown'
  const isActive = abnStatus.toLowerCase() === 'active'

  // Entity name - could be individual or non-individual
  let entityName = getTag('organisationName') || getTag('fullName')
  if (!entityName) {
    const givenName = getTag('givenName')
    const familyName = getTag('familyName')
    entityName = [givenName, familyName].filter(Boolean).join(' ') || 'Unknown'
  }

  const entityTypeCode = getTag('entityTypeCode') || ''
  const entityType = mapEntityTypeCode(entityTypeCode)

  // GST registration
  const gstStatusMatch = xml.match(/<goodsAndServicesTax>[\s\S]*?<effectiveFrom>([^<]*)<\/effectiveFrom>[\s\S]*?<\/goodsAndServicesTax>/)
  const isGSTRegistered = xml.includes('<goodsAndServicesTax>') && !xml.includes('<effectiveTo>')
  const gstRegisteredFrom = gstStatusMatch ? gstStatusMatch[1] : null

  // Business names
  const businessNames: string[] = []
  const bnMatches = xml.matchAll(/<businessName>[\s\S]*?<organisationName>([^<]*)<\/organisationName>[\s\S]*?<\/businessName>/g)
  for (const match of bnMatches) {
    if (match[1]) businessNames.push(match[1].trim())
  }

  // State and postcode
  const state = getTag('stateCode') || null
  const postcode = getTag('postcode') || null

  return {
    abn: abnValue,
    isValid: true,
    entityName,
    entityType,
    entityTypeCode,
    isGSTRegistered,
    gstRegisteredFrom,
    gstCancelledDate: null,
    isActive,
    abnStatus,
    abnStatusEffectiveFrom: getTag('entityStatusEffectiveFrom') || '',
    businessNames,
    tradingNames: [],
    state,
    postcode,
    lastUpdated: new Date().toISOString(),
    source: 'abr_api',
  }
}

/**
 * Parse ABR search response.
 */
function parseSearchResponse(xml: string, query: string): ABNSearchResult {
  const results: ABNSearchResult['results'] = []

  const recordMatches = xml.matchAll(/<searchResultsRecord>[\s\S]*?<\/searchResultsRecord>/g)
  for (const match of recordMatches) {
    const record = match[0]
    const getTag = (tag: string): string => {
      const m = record.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))
      return m ? m[1].trim() : ''
    }

    results.push({
      abn: getTag('ABN') || getTag('identifierValue'),
      entityName: getTag('organisationName') || getTag('fullName'),
      entityType: getTag('entityTypeDescription'),
      state: getTag('stateCode'),
      postcode: getTag('postcode'),
      isActive: getTag('entityStatusCode').toLowerCase() === 'active',
      score: parseInt(getTag('score') || '0', 10),
    })
  }

  return {
    results: results.sort((a, b) => b.score - a.score),
    totalResults: results.length,
    query,
  }
}

/**
 * Map entity type code to human-readable type.
 */
function mapEntityTypeCode(code: string): string {
  const map: Record<string, string> = {
    'IND': 'Individual/Sole Trader',
    'PRV': 'Australian Private Company',
    'PUB': 'Australian Public Company',
    'TRT': 'Trust',
    'PTR': 'Partnership',
    'SGE': 'State Government Entity',
    'CGE': 'Commonwealth Government Entity',
    'LGE': 'Local Government Entity',
    'SUP': 'Superannuation Fund',
    'FPT': 'Family Partnership',
    'NPB': 'Non-Profit Organisation',
  }

  return map[code] || code || 'Unknown'
}

/**
 * Get cached ABN result from Supabase.
 */
async function getCachedABN(abn: string): Promise<ABNLookupResult | null> {
  try {
    const supabase = await createServiceClient()

    const { data, error } = await supabase
      .from('abn_lookup_cache')
      .select('result, cached_at')
      .eq('abn', abn)
      .single()

    if (error || !data) return null

    // Check cache TTL
    const cachedAt = new Date(data.cached_at)
    const ttlMs = CACHE_TTL_HOURS * 60 * 60 * 1000
    if (Date.now() - cachedAt.getTime() > ttlMs) {
      return null // Cache expired
    }

    return data.result as ABNLookupResult
  } catch {
    return null // Cache miss or table doesn't exist yet
  }
}

/**
 * Cache ABN result in Supabase.
 */
async function cacheABNResult(abn: string, result: ABNLookupResult): Promise<void> {
  try {
    const supabase = await createServiceClient()

    await supabase
      .from('abn_lookup_cache')
      .upsert({
        abn,
        result,
        cached_at: new Date().toISOString(),
      }, { onConflict: 'abn' })
  } catch (error) {
    // Cache write failure is non-critical
    console.warn('Failed to cache ABN result:', error)
  }
}

function createInvalidResult(abn: string, reason: string): ABNLookupResult {
  return {
    abn,
    isValid: false,
    entityName: reason,
    entityType: 'Unknown',
    entityTypeCode: '',
    isGSTRegistered: false,
    gstRegisteredFrom: null,
    gstCancelledDate: null,
    isActive: false,
    abnStatus: 'Invalid',
    abnStatusEffectiveFrom: '',
    businessNames: [],
    tradingNames: [],
    state: null,
    postcode: null,
    lastUpdated: new Date().toISOString(),
    source: 'error_fallback',
  }
}
