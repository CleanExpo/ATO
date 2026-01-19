import { XeroClient, TokenSet } from 'xero-node'

// Xero OAuth 2.0 Scopes - READ ONLY
export const XERO_SCOPES = [
    'offline_access',
    'openid',
    'profile',
    'email',
    'accounting.settings.read',
    'accounting.transactions.read',
    'accounting.reports.read',
    'accounting.contacts.read',
].join(' ')

// Create Xero client instance
// Pass state when handling callback to allow SDK validation
type CreateXeroClientOptions = {
    state?: string
    baseUrl?: string
}

function resolveBaseUrl(override?: string): string {
    let baseUrl =
        override ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.SITE_URL

    if (!baseUrl) {
        const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
        if (vercelProductionUrl) {
            baseUrl = `https://${vercelProductionUrl}`
        } else if (process.env.VERCEL_URL) {
            baseUrl = `https://${process.env.VERCEL_URL}`
        }
    }

    if (!baseUrl) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Missing base URL for Xero redirect. Set NEXT_PUBLIC_BASE_URL or pass baseUrl.')
        }
        baseUrl = 'http://localhost:3000'
    }

    return baseUrl.replace(/\/+$/, '')
}

export function createXeroClient(options: CreateXeroClientOptions = {}): XeroClient {
    // 1. Check for explicit base URL (request origin)
    // 2. Check for configured env base URL(s)
    // 3. Check for Vercel URLs
    // 4. Fallback to localhost for dev
    const baseUrl = resolveBaseUrl(options.baseUrl)

    console.log('Xero Client initialized with Base URL:', baseUrl)

    return new XeroClient({
        clientId: process.env.XERO_CLIENT_ID!,
        clientSecret: process.env.XERO_CLIENT_SECRET!,
        redirectUris: [`${baseUrl}/api/auth/xero/callback`],
        scopes: XERO_SCOPES.split(' '),
        httpTimeout: 30000,
        state: options.state, // Pass state for callback validation
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
export async function refreshXeroTokens(tokens: TokenSet, baseUrl?: string): Promise<TokenSet> {
    const client = createXeroClient({ baseUrl })
    await client.initialize()
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
