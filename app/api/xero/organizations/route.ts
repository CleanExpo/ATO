import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth'

// GET /api/xero/organizations - List connected organizations
export async function GET() {
    try {
        const user = await requireUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

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
            .eq('user_id', user.id)
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
