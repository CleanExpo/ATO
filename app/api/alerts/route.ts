/**
 * GET /api/alerts
 *
 * Fetch tax alerts for the authenticated user
 *
 * Query Parameters:
 * - status: 'unread' | 'read' | 'acknowledged' | 'dismissed' | 'actioned' (optional)
 * - severity: 'info' | 'warning' | 'critical' (optional)
 * - category: 'deadline' | 'opportunity' | 'compliance' | 'legislative' | 'financial' (optional)
 * - financialYear: string (optional, e.g., "2024")
 * - platform: 'xero' | 'myob' | 'quickbooks' (optional)
 * - limit: number (optional, default: 50, max: 100)
 *
 * Response:
 * {
 *   alerts: TaxAlert[]
 *   total: number
 *   unreadCount: number
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()

        // Check auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams
        const status = searchParams.get('status')
        const severity = searchParams.get('severity')
        const category = searchParams.get('category')
        const financialYear = searchParams.get('financialYear')
        const platform = searchParams.get('platform')
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

        // Build query
        let query = supabase
            .from('tax_alerts')
            .select('*', { count: 'exact' })
            .eq('tenant_id', user.id)
            .order('triggered_at', { ascending: false })
            .limit(limit)

        if (status) {
            query = query.eq('status', status)
        }

        if (severity) {
            query = query.eq('severity', severity)
        }

        if (category) {
            query = query.eq('category', category)
        }

        if (financialYear) {
            query = query.eq('financial_year', financialYear)
        }

        if (platform) {
            query = query.eq('platform', platform)
        }

        const { data: alerts, error, count } = await query

        if (error) {
            console.error('Error fetching alerts:', error)
            return createErrorResponse(error, { operation: 'fetchAlerts', userId: user.id })
        }

        // Get unread count
        const { count: unreadCount } = await supabase
            .from('tax_alerts')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', user.id)
            .eq('status', 'unread')

        return NextResponse.json({
            alerts: alerts || [],
            total: count || 0,
            unreadCount: unreadCount || 0
        })

    } catch (error) {
        console.error('Error in GET /api/alerts:', error)
        return createErrorResponse(error, { operation: 'getAlerts' })
    }
}
