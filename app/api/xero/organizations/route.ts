import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/api/errors'

// GET /api/xero/organizations - List connected organizations
// Single-user mode: Returns all connections without user filtering
export async function GET() {
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
            console.error('Database error fetching connections:', error)
            return createErrorResponse(error, { operation: 'fetchXeroConnections' }, 500)
        }

        return NextResponse.json({ connections })
    } catch (error) {
        console.error('Failed to fetch Xero organizations:', error)
        return createErrorResponse(error, { operation: 'fetchXeroOrganizations' }, 500)
    }
}
