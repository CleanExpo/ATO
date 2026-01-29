import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminRole } from '@/lib/middleware/admin-role';

export async function GET(request: NextRequest) {
    try {
        // Require admin role - exporting audit logs is sensitive
        const adminCheck = await requireAdminRole();
        if (!adminCheck.isAdmin) {
            return adminCheck.response;
        }

        const supabase = await createServiceClient();

        // Fetch all logs
        const { data: logs, error } = await supabase
            .from('organization_activity_log')
            .select('*, organizations(name)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Convert to CSV
        const headers = ['ID', 'Organization', 'Action', 'Entity Type', 'User ID', 'Timestamp', 'IP Address', 'Metadata'];
        const rows = logs.map(log => [
            log.id,
            log.organizations?.name || 'N/A',
            log.action,
            log.entity_type || 'N/A',
            log.user_id || 'N/A',
            log.created_at,
            log.ip_address || 'N/A',
            JSON.stringify(log.metadata || {})
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="ato-audit-log-${new Date().toISOString().split('T')[0]}.csv"`
            }
        });

    } catch (error) {
        console.error('Audit export failure:', error);
        return NextResponse.json({ error: 'Failed to export audit log' }, { status: 500 });
    }
}
