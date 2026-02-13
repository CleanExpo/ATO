/**
 * QuickBooks Online OAuth 2.0 Configuration
 *
 * Implements OAuth 2.0 authorization code flow for QuickBooks Online API access.
 *
 * Setup Instructions:
 * 1. Create app at https://developer.intuit.com/app/developer/myapps
 * 2. Add redirect URI: http://localhost:3000/api/auth/quickbooks/callback
 * 3. Request scope: com.intuit.quickbooks.accounting
 * 4. Add QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET to .env.local
 *
 * API Documentation: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/purchase
 */

import { serverConfig, sharedConfig } from '@/lib/config/env'

export const QUICKBOOKS_CONFIG = {
  // OAuth 2.0 endpoints
  authorizationUrl: 'https://appcenter.intuit.com/connect/oauth2',
  tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  revocationUrl: 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke',

  // API endpoints
  baseUrl: 'https://quickbooks.api.intuit.com',
  sandboxBaseUrl: 'https://sandbox-quickbooks.api.intuit.com',
  apiVersion: 'v3',

  // OAuth scopes
  scopes: [
    'com.intuit.quickbooks.accounting',  // Read/write access to accounting data
  ],

  // Client credentials from environment
  clientId: serverConfig.quickbooks.clientId,
  clientSecret: serverConfig.quickbooks.clientSecret,

  // Redirect URI (must match Intuit app config)
  redirectUri: `${sharedConfig.baseUrl}/api/auth/quickbooks/callback`,

  // Token storage
  tokenTable: 'quickbooks_tokens',

  // Rate limiting (per Intuit documentation)
  rateLimits: {
    requestsPerMinute: 500,  // 500 requests per minute per company
    burstLimit: 100,         // Burst allowance
  },

  // Environment
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
} as const

/**
 * Validates QuickBooks configuration
 */
export function validateQuickBooksConfig(): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!QUICKBOOKS_CONFIG.clientId) {
    errors.push('QUICKBOOKS_CLIENT_ID is not set in environment variables')
  }

  if (!QUICKBOOKS_CONFIG.clientSecret) {
    errors.push('QUICKBOOKS_CLIENT_SECRET is not set in environment variables')
  }

  if (!sharedConfig.baseUrl) {
    errors.push('NEXT_PUBLIC_BASE_URL is not set in environment variables')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Generates the QuickBooks OAuth 2.0 authorization URL
 * @param state CSRF state parameter
 */
export function getQuickBooksAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: QUICKBOOKS_CONFIG.clientId || '',
    redirect_uri: QUICKBOOKS_CONFIG.redirectUri,
    response_type: 'code',
    scope: QUICKBOOKS_CONFIG.scopes.join(' '),
    state,
  })
  return `${QUICKBOOKS_CONFIG.authorizationUrl}?${params.toString()}`
}

/**
 * Gets the appropriate API base URL based on environment
 */
export function getQuickBooksApiUrl(): string {
  return QUICKBOOKS_CONFIG.environment === 'production'
    ? QUICKBOOKS_CONFIG.baseUrl
    : QUICKBOOKS_CONFIG.sandboxBaseUrl
}
