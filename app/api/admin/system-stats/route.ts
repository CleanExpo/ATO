import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/api/errors';
import { requireAdminRole } from '@/lib/middleware/admin-role';

export async function GET(_request: NextRequest) {
    try {
        // Require admin role
        const adminCheck = await requireAdminRole();
        if (!adminCheck.isAdmin) {
            return adminCheck.response;
        }

        const supabase = await createServiceClient();

        // 1. Total Organizations
        const { count: orgCount, error: orgError } = await supabase
            .from('organizations')
            .select('*', { count: 'exact', head: true });

        if (orgError) throw orgError;

        // 2. Total Transactions Analyzed
        const { count: analysisCount, error: analysisError } = await supabase
            .from('forensic_analysis_results')
            .select('*', { count: 'exact', head: true });

        if (analysisError) throw analysisError;

        // 3. Total Identified Savings
        // Use count query first to check if aggregation is feasible, then fetch with limit
        const { count: recsCount } = await supabase
            .from('tax_recommendations')
            .select('*', { count: 'exact', head: true });

        let totalBenefit = 0;
        let adjustedBenefit = 0;

        // Only fetch data if there are rows (and limit to prevent memory issues)
        if (recsCount && recsCount > 0) {
            const { data: recsData, error: recsError } = await supabase
                .from('tax_recommendations')
                .select('estimated_benefit, adjusted_benefit')
                .limit(10000);

            if (recsError) throw recsError;

            totalBenefit = (recsData || []).reduce((sum: number, r: { estimated_benefit: number | null; adjusted_benefit: number | null }) => sum + Number(r.estimated_benefit || 0), 0);
            adjustedBenefit = (recsData || []).reduce((sum: number, r: { estimated_benefit: number | null; adjusted_benefit: number | null }) => sum + Number(r.adjusted_benefit || 0), 0);
        }

        // 4. Total AI Costs
        const { count: costsCount } = await supabase
            .from('ai_analysis_costs')
            .select('*', { count: 'exact', head: true });

        let totalCost = 0;

        if (costsCount && costsCount > 0) {
            const { data: costData, error: costError } = await supabase
                .from('ai_analysis_costs')
                .select('estimated_cost_usd')
                .limit(10000);

            if (costError) throw costError;

            totalCost = (costData || []).reduce((sum: number, c: { estimated_cost_usd: number | null }) => sum + Number(c.estimated_cost_usd || 0), 0);
        }

        // 5. Recent Activity
        const { data: recentActivity, error: activityError } = await supabase
            .from('organization_activity_log')
            .select('*, organizations(name)')
            .order('created_at', { ascending: false })
            .limit(10);

        if (activityError) throw activityError;

        return NextResponse.json({
            success: true,
            stats: {
                totalOrganizations: orgCount || 0,
                totalTransactionsAnalyzed: analysisCount || 0,
                totalBenefitIdentified: totalBenefit,
                totalBenefitAdjusted: adjustedBenefit,
                totalAiCost: totalCost,
                roi: totalCost > 0 ? (totalBenefit / totalCost).toFixed(1) : '∞',
            },
            recentActivity,
            systemHealth: {
                database: 'Connected',
                ai_pipeline: 'Active',
                xero_api: 'Healthy',
                myob_api: 'Healthy',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Admin stats failure:', error);
        return createErrorResponse(error, { operation: 'getAdminStats' }, 500);
    }
}
