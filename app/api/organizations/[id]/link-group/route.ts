/**
 * Link/Unlink Organization to Group
 *
 * POST /api/organizations/[id]/link-group
 * Link an organization to a group for consolidated analysis and $199 additional pricing
 *
 * DELETE /api/organizations/[id]/link-group
 * Unlink an organization from its group (full pricing applies)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';

// POST - Link organization to group
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const organizationId = params.id;
    const body = await request.json();

    // Validate required fields
    if (!body.groupId || typeof body.groupId !== 'string') {
      return createValidationError('groupId is required and must be a string');
    }

    // Verify user has access to this organization
    const { data: access, error: accessError } = await supabase
      .from('user_tenant_access')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (accessError || !access || access.role !== 'owner') {
      return NextResponse.json(
        { error: 'Organization not found or insufficient permissions' },
        { status: 404 }
      );
    }

    // Verify group exists and user owns it
    const { data: group, error: groupError } = await supabase
      .from('organization_groups')
      .select('id, name')
      .eq('id', body.groupId)
      .eq('owner_id', user.id)
      .single();

    if (groupError || !group) {
      return NextResponse.json(
        { error: 'Organization group not found' },
        { status: 404 }
      );
    }

    // Link organization to group
    const { data: updatedOrg, error: updateError } = await supabase
      .from('organizations')
      .update({
        group_id: body.groupId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organizationId)
      .select()
      .single();

    if (updateError) {
      console.error('Error linking organization to group:', updateError);
      return createErrorResponse(updateError, { operation: 'linkOrgToGroup' }, 500);
    }

    return NextResponse.json({
      organization: updatedOrg,
      group,
      message: `Organization linked to group "${group.name}"`,
    });
  } catch (error) {
    console.error('Error in POST /api/organizations/[id]/link-group:', error);
    return createErrorResponse(error, { operation: 'linkOrgToGroup' }, 500);
  }
}

// DELETE - Unlink organization from group
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const organizationId = params.id;

    // Verify user has access to this organization
    const { data: access, error: accessError } = await supabase
      .from('user_tenant_access')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (accessError || !access || access.role !== 'owner') {
      return NextResponse.json(
        { error: 'Organization not found or insufficient permissions' },
        { status: 404 }
      );
    }

    // Unlink organization from group
    const { data: updatedOrg, error: updateError } = await supabase
      .from('organizations')
      .update({
        group_id: null,
        is_primary_in_group: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organizationId)
      .select()
      .single();

    if (updateError) {
      console.error('Error unlinking organization from group:', updateError);
      return createErrorResponse(updateError, { operation: 'unlinkOrgFromGroup' }, 500);
    }

    return NextResponse.json({
      organization: updatedOrg,
      message: 'Organization unlinked from group (full pricing now applies)',
    });
  } catch (error) {
    console.error('Error in DELETE /api/organizations/[id]/link-group:', error);
    return createErrorResponse(error, { operation: 'unlinkOrgFromGroup' }, 500);
  }
}
