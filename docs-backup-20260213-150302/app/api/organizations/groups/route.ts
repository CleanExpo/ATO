/**
 * Organization Groups API
 *
 * GET /api/organizations/groups
 * List all organization groups for authenticated user
 *
 * POST /api/organizations/groups
 * Create a new organization group
 */

import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import { authMiddleware } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic'

// GET - List organization groups
export async function GET(request: NextRequest) {
  try {
    const auth = await authMiddleware(request);
    if (auth instanceof NextResponse) return auth;

    const { user, supabase } = auth;

    // Get all groups owned by user
    const { data: groups, error: groupsError } = await supabase
      .from('organization_groups')
      .select(`
        id,
        name,
        description,
        enable_consolidated_analysis,
        enable_intercompany_tracking,
        created_at,
        updated_at
      `)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (groupsError) {
      // Return empty gracefully for expected errors:
      // 42P01 = undefined_table, 42703 = undefined_column
      // 22P02 = invalid UUID (single-user mode uses non-UUID user ID)
      if (groupsError.code === '42P01' || groupsError.code === '42703' || groupsError.code === '22P02') {
        return NextResponse.json({ groups: [], total: 0 });
      }
      console.error('Error fetching organization groups:', groupsError);
      return createErrorResponse(groupsError, { operation: 'fetchGroups' }, 500);
    }

    // Get organization counts for each group
    const groupsWithCounts = await Promise.all(
      (groups || []).map(async (group: Record<string, unknown>) => {
        const { data: orgs, error: orgErr } = await supabase
          .from('organizations')
          .select('id, name, xero_tenant_id, is_primary_in_group')
          .eq('group_id', group.id);

        if (orgErr && orgErr.code === '42703') {
          // group_id column doesn't exist yet
          return { ...group, organizationCount: 0, organizations: [] };
        }

        return {
          ...group,
          organizationCount: orgs?.length || 0,
          organizations: orgs || [],
        };
      })
    );

    return NextResponse.json({
      groups: groupsWithCounts,
      total: groupsWithCounts.length,
    });
  } catch (error) {
    console.error('Error in GET /api/organizations/groups:', error);
    return createErrorResponse(error, { operation: 'getGroups' }, 500);
  }
}

// POST - Create new organization group
export async function POST(request: NextRequest) {
  try {
    const auth = await authMiddleware(request);
    if (auth instanceof NextResponse) return auth;

    const { user, supabase } = auth;

    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return createValidationError('name is required and must be a non-empty string');
    }

    // Create group
    const { data: group, error: createError } = await supabase
      .from('organization_groups')
      .insert({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        owner_id: user.id,
        enable_consolidated_analysis: body.enableConsolidatedAnalysis ?? true,
        enable_intercompany_tracking: body.enableIntercompanyTracking ?? true,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating organization group:', createError);
      return createErrorResponse(createError, { operation: 'createGroup' }, 500);
    }

    return NextResponse.json({
      group,
      message: 'Organization group created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/organizations/groups:', error);
    return createErrorResponse(error, { operation: 'createGroup' }, 500);
  }
}
