import { XeroClient, TokenSet } from 'xero-node'
import { serverConfig, sharedConfig } from '@/lib/config/env'
import { withRetry } from '@/lib/xero/retry'

// Xero OAuth 2.0 Scopes
// Read: accounting data | Write: files & attachments only
export const XERO_SCOPES = [
    'offline_access',
    'openid',
    'profile',
    'email',
    'accounting.settings.read',
    'accounting.transactions.read',
    'accounting.reports.read',
    'accounting.contacts.read',
    'accounting.attachments',       // Attach findings to transactions
    'files',                        // Upload reports to Xero Files
].join(' ')

// Create Xero client instance
// Pass state when handling callback to allow SDK validation
type CreateXeroClientOptions = {
    state?: string
    baseUrl?: string
}

function resolveBaseUrl(override?: string): string {
    // Use override if provided, otherwise use validated config
    const baseUrl = override || sharedConfig.baseUrl
    return baseUrl.replace(/\/+$/, '')
}

export function createXeroClient(options: CreateXeroClientOptions = {}): XeroClient {
    const baseUrl = resolveBaseUrl(options.baseUrl)

    console.log('Xero Client initialized with Base URL:', baseUrl)

    try {
        return new XeroClient({
            clientId: serverConfig.xero.clientId,
            clientSecret: serverConfig.xero.clientSecret,
            redirectUris: [`${baseUrl}/api/auth/xero/callback`],
            scopes: XERO_SCOPES.split(' '),
            httpTimeout: 30000,
            state: options.state,
        })
    } catch (error) {
        console.error('Failed to create Xero client:', error)
        throw new Error(
            'Xero client initialization failed. Please check your XERO_CLIENT_ID and XERO_CLIENT_SECRET environment variables.'
        )
    }
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

// Refresh Xero tokens with retry logic
export async function refreshXeroTokens(tokens: TokenSet, baseUrl?: string): Promise<TokenSet> {
    return withRetry(
        async () => {
            const client = createXeroClient({ baseUrl })
            await client.initialize()
            client.setTokenSet(tokens)
            const newTokens = await client.refreshToken()
            return newTokens
        },
        {
            maxAttempts: 3,
            timeoutMs: 30000, // 30 second timeout
            initialBackoffMs: 1000,
            onRetry: (attempt, error) => {
                console.warn(`Retrying Xero token refresh (attempt ${attempt}):`, error)
            },
        }
    )
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
