import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createXeroClient, isTokenExpired, refreshXeroTokens } from '@/lib/xero/client'
import type { TokenSet } from 'xero-node'

// Helper to get valid token set for a tenant
async function getValidTokenSet(tenantId: string): Promise<{ tokenSet: TokenSet; tenantId: string } | null> {
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

            return { tokenSet: newTokens, tenantId }
        } catch (error) {
            console.error('Failed to refresh Xero tokens:', error)
            return null
        }
    }

    return { tokenSet, tenantId }
}

// GET /api/xero/organizations - List connected organizations
export async function GET(request: NextRequest) {
    try {
        const supabase = await createServiceClient()

        const { data: connections, error } = await supabase
            .from('xero_connections')
            .select(`
        tenant_id,
        tenant_name,
        organisation_name,
        organisation_type,
        country_code,
        base_currency,
        is_demo_company,
        connected_at,
        updated_at
      `)
            .order('connected_at', { ascending: false })

        if (error) {
            return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 })
        }

        return NextResponse.json({ connections })
    } catch (error) {
        console.error('Failed to fetch Xero organizations:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
