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

// R&D expense keywords for identification
const RND_KEYWORDS = [
    'research', 'development', 'r&d', 'prototype', 'experiment',
    'software', 'engineering', 'design', 'testing', 'trial',
    'innovation', 'patent', 'technical', 'scientific', 'lab',
    'developer', 'programmer', 'consultant', 'contractor'
]

// GET /api/xero/transactions - Get transactions with R&D flagging
export async function GET(request: NextRequest) {
    try {
        const tenantId = request.nextUrl.searchParams.get('tenantId')
        const fromDate = request.nextUrl.searchParams.get('fromDate')
        const toDate = request.nextUrl.searchParams.get('toDate')
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1')
        const pageSize = 100

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 })
        }

        const tokenSet = await getValidTokenSet(tenantId)
        if (!tokenSet) {
            return NextResponse.json({ error: 'No valid connection found' }, { status: 401 })
        }

        const client = createXeroClient()
        client.setTokenSet(tokenSet)

        // Build where clause for date filtering
        let where = ''
        if (fromDate) {
            where = `Date >= DateTime(${new Date(fromDate).toISOString().split('T')[0]})`
        }
        if (toDate) {
            if (where) where += ' AND '
            where += `Date <= DateTime(${new Date(toDate).toISOString().split('T')[0]})`
        }

        // Fetch bank transactions
        const response = await client.accountingApi.getBankTransactions(
            tenantId,
            undefined, // modifiedAfter
            where || undefined,
            undefined, // order
            page,
            pageSize
        )

        const transactions = response.body.bankTransactions || []

        // Analyze transactions for tax optimization
        const analyzedTransactions = transactions.map(tx => {
            const description = (tx.reference || '') + ' ' + (tx.lineItems?.map(li => li.description).join(' ') || '')
            const lowerDesc = description.toLowerCase()

            // Check for R&D indicators
            const rndScore = RND_KEYWORDS.reduce((score, keyword) => {
                return score + (lowerDesc.includes(keyword) ? 1 : 0)
            }, 0)

            const isRndCandidate = rndScore >= 2

            // Check line items for categorization issues
            const lineItems = tx.lineItems?.map(li => ({
                description: li.description,
                quantity: li.quantity,
                unitAmount: li.unitAmount,
                accountCode: li.accountCode,
                taxType: li.taxType,
                lineAmount: li.lineAmount,
                flags: {
                    missingTaxType: !li.taxType || li.taxType === 'NONE',
                    missingAccount: !li.accountCode
                }
            })) || []

            return {
                id: tx.bankTransactionID,
                type: tx.type,
                date: tx.date,
                reference: tx.reference,
                contact: tx.contact?.name,
                total: tx.total,
                status: tx.status,
                isReconciled: tx.isReconciled,
                lineItems,
                analysis: {
                    isRndCandidate,
                    rndScore,
                    rndKeywordsFound: RND_KEYWORDS.filter(k => lowerDesc.includes(k)),
                    hasMissingTaxTypes: lineItems.some(li => li.flags.missingTaxType),
                    hasMissingAccounts: lineItems.some(li => li.flags.missingAccount),
                    needsReview: isRndCandidate || lineItems.some(li => li.flags.missingTaxType)
                }
            }
        })

        // Summary statistics
        const summary = {
            total: analyzedTransactions.length,
            rndCandidates: analyzedTransactions.filter(t => t.analysis.isRndCandidate).length,
            rndValue: analyzedTransactions
                .filter(t => t.analysis.isRndCandidate)
                .reduce((sum, t) => sum + (t.total || 0), 0),
            needsReview: analyzedTransactions.filter(t => t.analysis.needsReview).length,
            missingTaxTypes: analyzedTransactions.filter(t => t.analysis.hasMissingTaxTypes).length
        }

        return NextResponse.json({
            transactions: analyzedTransactions,
            summary,
            pagination: {
                page,
                pageSize,
                hasMore: transactions.length === pageSize
            }
        })
    } catch (error) {
        console.error('Failed to fetch transactions:', error)
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }
}
