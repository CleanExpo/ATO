/**
 * GET /api/activity
 *
 * Consolidated activity feed across all organizations the user has access to
 *
 * Query params:
 * - limit: number (default: 20, max: 100)
 * - offset: number (default: 0)
 * - organizationId?: UUID (filter to specific org)
 * - action?: string (filter by action type)
 *
 * Returns paginated activity log with organization context
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const organizationId = searchParams.get('organizationId');
    const actionFilter = searchParams.get('action');

    // Build query
    let query = supabase
      .from('organization_activity_log')
      .select(`
        *,
        organization:organizations(id, name),
        user:profiles(id, email, full_name)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
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
      .select('*', { count: 'exact', head: true });

    if (organizationId) {
      countQuery = countQuery.eq('organization_id', organizationId);
    }
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
    console.error('Activity feed error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/activity
 *
 * Create a new activity log entry
 *
 * Body:
 * - organizationId: UUID (required)
 * - action: string (required) - e.g., 'member_added', 'xero_connected'
 * - entityType?: string - e.g., 'user', 'connection'
 * - entityId?: UUID
 * - metadata?: object - additional context
 *
 * This is typically called internally by other API endpoints
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.organizationId || !body.action) {
      return NextResponse.json(
        { error: 'organizationId and action are required' },
        { status: 400 }
      );
    }

    // Verify user has access to this organization
    const { data: access, error: accessError } = await supabase
      .from('user_tenant_access')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', body.organizationId)
      .single();

    if (accessError || !access) {
      return NextResponse.json(
        { error: 'You do not have access to this organization' },
        { status: 403 }
      );
    }

    // Create activity log entry
    const { data: activity, error: insertError } = await supabase
      .from('organization_activity_log')
      .insert({
        organization_id: body.organizationId,
        user_id: user.id,
        action: body.action,
        entity_type: body.entityType || null,
        entity_id: body.entityId || null,
        metadata: body.metadata || {}
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating activity:', insertError);
      return NextResponse.json(
        { error: 'Failed to create activity log entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      activity,
      message: 'Activity logged successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Activity creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
