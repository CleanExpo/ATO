/**
 * POST /api/admin/migrate
 *
 * Run database migration to add analysis columns.
 * This is a one-time endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/middleware/admin-role'

export async function POST(request: NextRequest) {
    // Require admin role - database migrations are critical operations
    const adminCheck = await requireAdminRole();
    if (!adminCheck.isAdmin) {
        return adminCheck.response;
    }

    try {
        const supabase = await createServiceClient()
        
        // Check if columns already exist by trying to select them
        const { error: checkError } = await supabase
            .from('historical_transactions_cache')
            .select('analysis_complete, analysis_result, analyzed_at')
            .limit(1)
        
        if (!checkError) {
            return NextResponse.json({
                success: true,
                message: 'Columns already exist'
            })
        }
        
        // Columns don't exist - we need to add them
        // Since we can't run raw SQL, we'll use RPC or handle via Supabase dashboard
        
        return NextResponse.json({
            success: false,
            message: 'Columns need to be added via Supabase Dashboard',
            sql: `
ALTER TABLE historical_transactions_cache 
ADD COLUMN IF NOT EXISTS analysis_complete boolean DEFAULT NULL,
ADD COLUMN IF NOT EXISTS analysis_result jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS analyzed_at timestamptz DEFAULT NULL;
            `.trim()
        })
        
    } catch (error) {
        console.error('Migration error:', error)
        return NextResponse.json({
            success: false,
            error: String(error)
        }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    // Authenticate user (admin check should be added for production)
    const auth = await requireAuthOnly(request)
    if (isErrorResponse(auth)) return auth

    try {
        const supabase = await createServiceClient()
        
        // Check current table structure
        const { data, error } = await supabase
            .from('historical_transactions_cache')
            .select('*')
            .limit(1)
        
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }
        
        const columns = data && data.length > 0 ? Object.keys(data[0]) : []
        
        return NextResponse.json({
            tableExists: true,
            columns,
            hasAnalysisColumns: columns.includes('analysis_complete')
        })
        
    } catch (error) {
        return NextResponse.json({
            tableExists: false,
            error: String(error)
        }, { status: 500 })
    }
}
