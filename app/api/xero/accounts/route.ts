import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createXeroClient, isTokenExpired, refreshXeroTokens } from '@/lib/xero/client'
import { requireUser } from '@/lib/supabase/auth'
import type { TokenSet } from 'xero-node'
import { Account } from 'xero-node'

// Helper to get valid token set for a tenant
async function getValidTokenSet(tenantId: string, userId: string, baseUrl?: string): Promise<TokenSet | null> {
    const supabase = await createServiceClient()

    const { data: connection, error } = await supabase
        .from('xero_connections')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .single()

    if (error || !connection) {
        return null
    }

    const tokenSet = {
        access_token: connection.access_token,
        refresh_token: connection.refresh_token,
        expires_at: connection.expires_at,
        id_token: connection.id_token,
        scope: connection.scope,
        token_type: 'Bearer'
    } as TokenSet

    // Refresh if expired
    if (isTokenExpired(tokenSet)) {
        try {
            const previousRefreshToken = tokenSet.refresh_token
            const newTokens = await refreshXeroTokens(tokenSet, baseUrl)

            // Update stored tokens
            await supabase
                .from('xero_connections')
                .update({
                    access_token: newTokens.access_token,
                    refresh_token: newTokens.refresh_token,
                    expires_at: newTokens.expires_at,
                    id_token: newTokens.id_token,
                    scope: newTokens.scope,
                    updated_at: new Date().toISOString()
                })
                .eq('refresh_token', previousRefreshToken)
                .eq('user_id', userId)

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
        const baseUrl = request.nextUrl.origin
        const user = await requireUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const tenantId = request.nextUrl.searchParams.get('tenantId')

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 })
        }

        const tokenSet = await getValidTokenSet(tenantId, user.id, baseUrl)
        if (!tokenSet) {
            return NextResponse.json({ error: 'No valid connection found' }, { status: 401 })
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
        return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
    }
}
