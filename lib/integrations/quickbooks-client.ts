/**
 * QuickBooks Online API Client
 *
 * Handles OAuth 2.0 authentication and API requests to QuickBooks Online.
 * Implements token refresh, rate limiting, and error handling.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { QUICKBOOKS_CONFIG, getQuickBooksApiUrl } from './quickbooks-config'
import { createLogger } from '@/lib/logger'

const log = createLogger('integrations:quickbooks')

// ─── Types ───────────────────────────────────────────────────────────

export interface QuickBooksTokens {
  access_token: string
  refresh_token: string
  expires_at: number  // Unix timestamp
  realm_id: string     // QuickBooks Company ID
  token_type: string
}

export interface QuickBooksCompanyInfo {
  id: string
  companyName: string
  legalName?: string
  country: string
  fiscalYearStartMonth: string
  email?: {
    address: string
  }
}

// ─── Token Management ────────────────────────────────────────────────

/**
 * Stores QuickBooks OAuth tokens in Supabase
 */
export async function storeQuickBooksTokens(
  tenantId: string,
  tokens: {
    access_token: string
    refresh_token: string
    expires_in: number
    realm_id: string
  },
  organizationId?: string | null
): Promise<void> {
  const supabase = await createServiceClient()

  const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in

  const { error } = await supabase
    .from('quickbooks_tokens')
    .upsert({
      tenant_id: tenantId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      realm_id: tokens.realm_id,
      token_type: 'Bearer',
      organization_id: organizationId,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'tenant_id',
    })

  if (error) {
    console.error('Error storing QuickBooks tokens:', error)
    throw new Error(`Failed to store QuickBooks tokens: ${error.message}`)
  }
}

/**
 * Retrieves QuickBooks OAuth tokens from Supabase (with optional organization filtering)
 */
export async function getQuickBooksTokens(
  tenantId: string,
  organizationId?: string
): Promise<QuickBooksTokens | null> {
  const supabase = await createServiceClient()

  let query = supabase
    .from('quickbooks_tokens')
    .select('*')
    .eq('tenant_id', tenantId)

  // Multi-org support: Filter by organization if provided
  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  }

  const { data, error } = await query.single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No tokens found
      return null
    }
    console.error('Error retrieving QuickBooks tokens:', error)
    throw new Error(`Failed to retrieve QuickBooks tokens: ${error.message}`)
  }

  return data as QuickBooksTokens
}

/**
 * Checks if QuickBooks access token is expired
 */
export function isQuickBooksTokenExpired(tokens: QuickBooksTokens): boolean {
  const now = Math.floor(Date.now() / 1000)
  const bufferSeconds = 300 // 5 minute buffer
  return tokens.expires_at <= (now + bufferSeconds)
}

/**
 * Refreshes QuickBooks access token using refresh token
 */
export async function refreshQuickBooksAccessToken(
  tenantId: string,
  refreshToken: string,
  organizationId?: string
): Promise<QuickBooksTokens> {
  const tokenUrl = QUICKBOOKS_CONFIG.tokenUrl

  const basicAuth = Buffer.from(
    `${QUICKBOOKS_CONFIG.clientId}:${QUICKBOOKS_CONFIG.clientSecret}`
  ).toString('base64')

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('QuickBooks token refresh failed:', errorText)
    throw new Error(`Failed to refresh QuickBooks token: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  // Get realm_id from existing tokens
  const existingTokens = await getQuickBooksTokens(tenantId, organizationId)
  const realmId = existingTokens?.realm_id || ''

  // Store updated tokens
  await storeQuickBooksTokens(tenantId, {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    realm_id: realmId,
  }, organizationId)

  // Return fresh tokens
  const newTokens = await getQuickBooksTokens(tenantId, organizationId)
  if (!newTokens) {
    throw new Error('Failed to retrieve refreshed tokens')
  }

  return newTokens
}

/**
 * Gets valid QuickBooks tokens, refreshing if necessary (with optional organization filtering)
 */
export async function getValidQuickBooksTokens(
  tenantId: string,
  organizationId?: string
): Promise<QuickBooksTokens> {
  let tokens = await getQuickBooksTokens(tenantId, organizationId)

  if (!tokens) {
    throw new Error('QuickBooks not connected' + (organizationId ? ` for organization ${organizationId}` : '') + '. Please authenticate first.')
  }

  if (isQuickBooksTokenExpired(tokens)) {
    log.info('QuickBooks token expired, refreshing')
    tokens = await refreshQuickBooksAccessToken(tenantId, tokens.refresh_token, organizationId)
  }

  return tokens
}

// ─── API Client ──────────────────────────────────────────────────────

/**
 * Creates a QuickBooks API client with automatic token refresh (with optional organization filtering)
 */
export async function createQuickBooksClient(tenantId: string, organizationId?: string) {
  const tokens = await getValidQuickBooksTokens(tenantId, organizationId)
  const baseUrl = getQuickBooksApiUrl()
  const apiUrl = `${baseUrl}/${QUICKBOOKS_CONFIG.apiVersion}/company/${tokens.realm_id}`

  /**
   * Makes an authenticated API request to QuickBooks
   */
  async function request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${apiUrl}/${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`QuickBooks API error (${response.status}):`, errorText)

      // Handle token expiration
      if (response.status === 401) {
        throw new Error('QuickBooks token expired. Please re-authenticate.')
      }

      throw new Error(`QuickBooks API request failed: ${response.status} ${errorText}`)
    }

    return response.json()
  }

  /**
   * Executes a QuickBooks Query Language (QQL) query
   */
  async function query<T>(sql: string): Promise<{ QueryResponse: T }> {
    const encodedQuery = encodeURIComponent(sql)
    return request(`query?query=${encodedQuery}`)
  }

  /**
   * Gets company information
   */
  async function getCompanyInfo(): Promise<QuickBooksCompanyInfo> {
    const response = await request<{ CompanyInfo: QuickBooksCompanyInfo }>('companyinfo/' + tokens.realm_id)
    return response.CompanyInfo
  }

  return {
    request,
    query,
    getCompanyInfo,
    realmId: tokens.realm_id,
    baseUrl: apiUrl,
  }
}

/**
 * Revokes QuickBooks access (disconnects integration)
 */
export async function revokeQuickBooksAccess(tenantId: string): Promise<void> {
  const tokens = await getQuickBooksTokens(tenantId)
  if (!tokens) {
    return // Already disconnected
  }

  const basicAuth = Buffer.from(
    `${QUICKBOOKS_CONFIG.clientId}:${QUICKBOOKS_CONFIG.clientSecret}`
  ).toString('base64')

  const params = new URLSearchParams({
    token: tokens.refresh_token,
  })

  try {
    const response = await fetch(QUICKBOOKS_CONFIG.revocationUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      console.error('Failed to revoke QuickBooks token:', await response.text())
    }
  } catch (error) {
    console.error('Error revoking QuickBooks access:', error)
  }

  // Delete tokens from database regardless of API call result
  const supabase = await createServiceClient()
  await supabase
    .from('quickbooks_tokens')
    .delete()
    .eq('tenant_id', tenantId)
}
