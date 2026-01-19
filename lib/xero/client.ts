import { XeroClient, TokenSet } from 'xero-node'

// Xero OAuth 2.0 Scopes - READ ONLY
export const XERO_SCOPES = [
    'offline_access',
    'openid',
    'profile',
    'email',
    'accounting.transactions.read',
    'accounting.reports.read',
    'accounting.contacts.read',
    'accounting.settings',
].join(' ')

// Create Xero client instance
export function createXeroClient(): XeroClient {
    return new XeroClient({
        clientId: process.env.XERO_CLIENT_ID!,
        clientSecret: process.env.XERO_CLIENT_SECRET!,
        redirectUris: [`${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/xero/callback`],
        scopes: XERO_SCOPES.split(' '),
        httpTimeout: 30000,
    })
}

// Validate token set structure
export function isValidTokenSet(tokens: unknown): tokens is TokenSet {
    if (!tokens || typeof tokens !== 'object') return false
    const t = tokens as Record<string, unknown>
    return (
        typeof t.access_token === 'string' &&
        typeof t.refresh_token === 'string' &&
        typeof t.expires_at === 'number'
    )
}

// Check if tokens are expired or about to expire (5 min buffer)
export function isTokenExpired(tokens: TokenSet): boolean {
    const expiresAt = tokens.expires_at || 0
    const now = Math.floor(Date.now() / 1000)
    const buffer = 5 * 60 // 5 minutes
    return expiresAt - buffer <= now
}

// Refresh Xero tokens
export async function refreshXeroTokens(tokens: TokenSet): Promise<TokenSet> {
    const client = createXeroClient()
    client.setTokenSet(tokens)
    const newTokens = await client.refreshToken()
    return newTokens
}

// Types for Xero API responses
export interface XeroTenant {
    id: string
    authEventId: string
    tenantId: string
    tenantType: string
    tenantName: string
    createdDateUtc: string
    updatedDateUtc: string
}

export interface XeroOrganization {
    name: string
    legalName?: string
    shortCode: string
    version: string
    organisationType: string
    baseCurrency: string
    countryCode: string
    isDemoCompany: boolean
    organisationStatus: string
    registrationNumber?: string
    taxNumber?: string
    financialYearEndDay: number
    financialYearEndMonth: number
}
