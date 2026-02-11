import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createXeroClient, isTokenExpired, refreshXeroTokens } from '@/lib/xero/client'
import { createErrorResponse, createNotFoundError, createValidationError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import type { TokenSet } from 'xero-node'
import { Account } from 'xero-node'
import { isSingleUserMode } from '@/lib/auth/single-user-check'
import { decryptStoredToken, encryptTokenForStorage } from '@/lib/xero/token-store'

// Helper to get valid token set for a tenant (single-user mode)
async function getValidTokenSet(tenantId: string, baseUrl?: string): Promise<TokenSet | null> {
    const supabase = await createServiceClient()

    const { data: connection, error } = await supabase
        .from('xero_connections')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle()

    if (error || !connection) {
        return null
    }

    // Decrypt tokens from database (SEC-001)
    const tokenSet = {
        access_token: decryptStoredToken(connection.access_token),
        refresh_token: decryptStoredToken(connection.refresh_token),
        expires_at: connection.expires_at,
        id_token: connection.id_token,
        scope: connection.scope,
        token_type: 'Bearer'
    } as TokenSet

    // Refresh if expired
    if (isTokenExpired(tokenSet)) {
        try {
            const newTokens = await refreshXeroTokens(tokenSet, baseUrl)

            // Encrypt new tokens before storage (SEC-001)
            await supabase
                .from('xero_connections')
                .update({
                    access_token: encryptTokenForStorage(newTokens.access_token),
                    refresh_token: encryptTokenForStorage(newTokens.refresh_token),
                    expires_at: newTokens.expires_at,
                    id_token: newTokens.id_token,
                    scope: newTokens.scope,
                    updated_at: new Date().toISOString()
                })
                .eq('tenant_id', tenantId)

            return newTokens
        } catch (error) {
            console.error('Failed to refresh Xero tokens:', error)
            return null
        }
    }

    return tokenSet
}

// GET /api/xero/accounts - Get chart of accounts
export async function GET(request: NextRequest) {
    try {
        let tenantId: string

        if (isSingleUserMode()) {
            // Single-user mode: get tenantId from query param
            const queryTenantId = request.nextUrl.searchParams.get('tenantId')
            if (!queryTenantId) {
                return createValidationError('tenantId is required')
            }
            tenantId = queryTenantId
        } else {
            // Multi-user mode: authenticate and validate tenant access
            const auth = await requireAuth(request)
            if (isErrorResponse(auth)) return auth
            tenantId = auth.tenantId
        }

        const baseUrl = request.nextUrl.origin

        const tokenSet = await getValidTokenSet(tenantId, baseUrl)
        if (!tokenSet) {
            return createNotFoundError('Xero connection')
        }

        const client = createXeroClient({ baseUrl })
        client.setTokenSet(tokenSet)

        const response = await client.accountingApi.getAccounts(tenantId)
        const accounts = response.body.accounts || []

        // Categorize accounts for tax analysis
        const categorizedAccounts = accounts.map(account => ({
            code: account.code,
            name: account.name,
            type: account.type,
            class: account._class,
            status: account.status,
            taxType: account.taxType,
            enablePaymentsToAccount: account.enablePaymentsToAccount,
            // Flag potential issues
            flags: {
                needsReview: !account.taxType || account.taxType === 'NONE',
                isExpense: account._class === Account.ClassEnum.EXPENSE,
                isAsset: account._class === Account.ClassEnum.ASSET,
                isLiability: account._class === Account.ClassEnum.LIABILITY,
                isEquity: account._class === Account.ClassEnum.EQUITY,
                isRevenue: account._class === Account.ClassEnum.REVENUE
            }
        }))

        return NextResponse.json({
            accounts: categorizedAccounts,
            summary: {
                total: accounts.length,
                byClass: {
                    expense: categorizedAccounts.filter(a => a.flags.isExpense).length,
                    asset: categorizedAccounts.filter(a => a.flags.isAsset).length,
                    liability: categorizedAccounts.filter(a => a.flags.isLiability).length,
                    equity: categorizedAccounts.filter(a => a.flags.isEquity).length,
                    revenue: categorizedAccounts.filter(a => a.flags.isRevenue).length
                },
                needsReview: categorizedAccounts.filter(a => a.flags.needsReview).length
            }
        })
    } catch (error) {
        console.error('Failed to fetch accounts:', error)
        return createErrorResponse(error, { operation: 'fetchXeroAccounts' }, 500)
    }
}
