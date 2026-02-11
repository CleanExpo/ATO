/**
 * GET /api/organizations/[id]/activity
 *
 * Get activity feed for a specific organization
 *
 * Query params:
 * - limit: number (default: 20, max: 100)
 * - offset: number (default: 0)
 * - action?: string (filter by action type)
 *
 * Returns activity log for the organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params;
    const supabase = await createServiceClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user has access to this organization
    const { data: access, error: accessError } = await supabase
      .from('user_tenant_access')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (accessError || !access) {
      return NextResponse.json(
        { error: 'You do not have access to this organization' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const actionFilter = searchParams.get('action');

    // Build query
    let query = supabase
      .from('organization_activity_log')
      .select(`
        *,
        user:profiles(id, email, full_name)
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply action filter
    if (actionFilter) {
      query = query.eq('action', actionFilter);
    }

    const { data: activities, error: activitiesError } = await query;

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
      return NextResponse.json(
        { error: 'Failed to fetch activity feed' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('organization_activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    if (actionFilter) {
      countQuery = countQuery.eq('action', actionFilter);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting activities:', countError);
    }

    return NextResponse.json({
      activities: activities || [],
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit
    });

  } catch (error) {
    console.error('Organization activity feed error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
