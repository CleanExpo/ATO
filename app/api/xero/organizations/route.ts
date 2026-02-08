import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/api/errors'
import { requireAuthOnly, isErrorResponse } from '@/lib/auth/require-auth'

// Single-user mode: Skip auth and return all connections
const SINGLE_USER_MODE = process.env.SINGLE_USER_MODE === 'true'

// GET /api/xero/organizations - List connected organizations
// In single-user mode: Returns all connections
// In multi-user mode: Returns only connections user has access to
export async function GET(request: NextRequest) {
    try {
        const supabase = createAdminClient()

        // Single-user mode: Return all connections without auth
        if (SINGLE_USER_MODE) {
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
                console.error('Database error fetching connections:', error)
                return createErrorResponse(error, { operation: 'fetchXeroConnections' }, 500)
            }

            return NextResponse.json({ connections: connections || [] })
        }

        // Multi-user mode: Require authentication
        const auth = await requireAuthOnly(request)
        if (isErrorResponse(auth)) return auth

        const { user } = auth

        // Only return connections the user has access to
        const { data: userAccess } = await supabase
            .from('user_tenant_access')
            .select('tenant_id')
            .eq('user_id', user.id)

        const tenantIds = userAccess?.map(a => a.tenant_id) || []

        // If user has no tenant access, return empty list
        if (tenantIds.length === 0) {
            return NextResponse.json({ connections: [] })
        }

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
            .in('tenant_id', tenantIds)
            .order('connected_at', { ascending: false })

        if (error) {
            console.error('Database error fetching connections:', error)
            return createErrorResponse(error, { operation: 'fetchXeroConnections' }, 500)
        }

        return NextResponse.json({ connections })
    } catch (error) {
        console.error('Failed to fetch Xero organizations:', error)
        return createErrorResponse(error, { operation: 'fetchXeroOrganizations' }, 500)
    }
}
