import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createXeroClient, isTokenExpired, refreshXeroTokens } from '@/lib/xero/client'
import type { TokenSet } from 'xero-node'

// Helper to get valid token set for a tenant
async function getValidTokenSet(tenantId: string): Promise<TokenSet | null> {
    const supabase = await createServiceClient()

    const { data: connection, error } = await supabase
        .from('xero_connections')
        .select('*')
        .eq('tenant_id', tenantId)
        .single()

    if (error || !connection) {
        return null
    }

    const tokenSet: TokenSet = {
        access_token: connection.access_token,
        refresh_token: connection.refresh_token,
        expires_at: connection.expires_at,
        id_token: connection.id_token,
        scope: connection.scope,
        token_type: 'Bearer'
    }

    // Refresh if expired
    if (isTokenExpired(tokenSet)) {
        try {
            const newTokens = await refreshXeroTokens(tokenSet)

            // Update stored tokens
            await supabase
                .from('xero_connections')
                .update({
                    access_token: newTokens.access_token,
                    refresh_token: newTokens.refresh_token,
                    expires_at: newTokens.expires_at,
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
        const tenantId = request.nextUrl.searchParams.get('tenantId')

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 })
        }

        const tokenSet = await getValidTokenSet(tenantId)
        if (!tokenSet) {
            return NextResponse.json({ error: 'No valid connection found' }, { status: 401 })
        }

        const client = createXeroClient()
        client.setTokenSet(tokenSet)

        const response = await client.accountingApi.getAccounts(tenantId)
        const accounts = response.body.accounts || []

        // Categorize accounts for tax analysis
        const categorizedAccounts = accounts.map(account => ({
            code: account.code,
            name: account.name,
            type: account.type,
            class: account.class,
            status: account.status,
            taxType: account.taxType,
            enablePaymentsToAccount: account.enablePaymentsToAccount,
            // Flag potential issues
            flags: {
                needsReview: !account.taxType || account.taxType === 'NONE',
                isExpense: account.class === 'EXPENSE',
                isAsset: account.class === 'ASSET',
                isLiability: account.class === 'LIABILITY',
                isEquity: account.class === 'EQUITY',
                isRevenue: account.class === 'REVENUE'
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
        return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
    }
}
