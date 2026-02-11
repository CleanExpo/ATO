/**
 * Organization Members API
 *
 * Handles member management for organizations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Validation schema for updating member roles
const updateMemberSchema = z.object({
  role: z.enum(['owner', 'admin', 'accountant', 'read_only']),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/organizations/[id]/members
 *
 * Lists all members of an organization
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to this organization
    const { data: hasAccess } = await supabase
      .from('user_tenant_access')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', id)
      .single()

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this organization' },
        { status: 403 }
      )
    }

    // Get all members with their user details
    const { data: members, error } = await supabase
      .from('user_tenant_access')
      .select(
        `
        user_id,
        role,
        created_at,
        auth.users (
          email,
          raw_user_meta_data,
          last_sign_in_at
        )
      `
      )
      .eq('organization_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching members:', error)
      return NextResponse.json(
        { error: 'Failed to fetch members' },
        { status: 500 }
      )
    }

    // Format response
    // Note: `last_sign_in_at` comes from Supabase auth and reflects the user's most recent
    // sign-in across the platform (not specific to this organization). For per-organization
    // activity tracking, a `user_activity` table with (user_id, organization_id, last_active_at)
    // and middleware to update it on each authenticated request would be needed. The migration
    // would add:
    //   CREATE TABLE user_activity (
    //     user_id UUID REFERENCES auth.users(id),
    //     organization_id UUID REFERENCES organizations(id),
    //     last_active_at TIMESTAMPTZ DEFAULT NOW(),
    //     PRIMARY KEY (user_id, organization_id)
    //   );
    // Until then, `last_sign_in_at` serves as a reasonable proxy for recent activity.
    const formattedMembers = members.map((member: unknown) => {
      const m = member as { user_id: string; role: string; created_at: string; users?: { email?: string; raw_user_meta_data?: Record<string, unknown>; last_sign_in_at?: string } }
      const userMeta = m.users?.raw_user_meta_data || {}
      return {
        userId: m.user_id,
        email: m.users?.email || 'Unknown',
        name: (userMeta as Record<string, unknown>).full_name || (userMeta as Record<string, unknown>).name || null,
        role: m.role,
        joinedAt: m.created_at,
        lastActiveAt: m.users?.last_sign_in_at || null,
      }
    })

    return NextResponse.json({
      members: formattedMembers,
    })
  } catch (error) {
    console.error(
      'Unexpected error in GET /api/organizations/[id]/members:',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/organizations/[id]/members/[userId]
 *
 * Updates a member's role (owners and admins only)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    // Get member user ID from query params
    const { searchParams } = new URL(request.url)
    const memberUserId = searchParams.get('userId')

    if (!memberUserId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user can manage this organization
    const { data: canManage, error: permError } = await supabase.rpc(
      'can_user_manage_organization',
      {
        p_user_id: user.id,
        p_organization_id: id,
        p_required_role: 'admin',
      }
    )

    if (permError || !canManage) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = updateMemberSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const { role } = validation.data

    // Prevent changing the last owner's role
    if (role !== 'owner') {
      const { count } = await supabase
        .from('user_tenant_access')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', id)
        .eq('role', 'owner')

      if (count === 1) {
        const { data: currentMember } = await supabase
          .from('user_tenant_access')
          .select('role')
          .eq('user_id', memberUserId)
          .eq('organization_id', id)
          .single()

        if (currentMember?.role === 'owner') {
          return NextResponse.json(
            {
              error:
                'Cannot change the role of the last owner. Assign another owner first.',
            },
            { status: 400 }
          )
        }
      }
    }

    // Update member role
    const { error: updateError } = await supabase
      .from('user_tenant_access')
      .update({ role })
      .eq('user_id', memberUserId)
      .eq('organization_id', id)

    if (updateError) {
      console.error('Error updating member role:', updateError)
      return NextResponse.json(
        { error: 'Failed to update member role' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase.from('organization_activity_log').insert({
      organization_id: id,
      user_id: user.id,
      action: 'member_role_updated',
      entity_type: 'user',
      entity_id: memberUserId,
      metadata: { newRole: role },
    })

    return NextResponse.json({
      success: true,
      message: 'Member role updated successfully',
    })
  } catch (error) {
    console.error(
      'Unexpected error in PATCH /api/organizations/[id]/members:',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/organizations/[id]/members/[userId]
 *
 * Removes a member from an organization (owners and admins only)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    // Get member user ID from query params
    const { searchParams } = new URL(request.url)
    const memberUserId = searchParams.get('userId')

    if (!memberUserId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user can manage this organization
    const { data: canManage, error: permError } = await supabase.rpc(
      'can_user_manage_organization',
      {
        p_user_id: user.id,
        p_organization_id: id,
        p_required_role: 'admin',
      }
    )

    if (permError || !canManage) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Prevent removing the last owner
    const { count } = await supabase
      .from('user_tenant_access')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', id)
      .eq('role', 'owner')

    if (count === 1) {
      const { data: memberToRemove } = await supabase
        .from('user_tenant_access')
        .select('role')
        .eq('user_id', memberUserId)
        .eq('organization_id', id)
        .single()

      if (memberToRemove?.role === 'owner') {
        return NextResponse.json(
          {
            error:
              'Cannot remove the last owner. Assign another owner first or delete the organization.',
          },
          { status: 400 }
        )
      }
    }

    // Remove member
    const { error: deleteError } = await supabase
      .from('user_tenant_access')
      .delete()
      .eq('user_id', memberUserId)
      .eq('organization_id', id)

    if (deleteError) {
      console.error('Error removing member:', deleteError)
      return NextResponse.json(
        { error: 'Failed to remove member' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase.from('organization_activity_log').insert({
      organization_id: id,
      user_id: user.id,
      action: 'member_removed',
      entity_type: 'user',
      entity_id: memberUserId,
    })

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully',
    })
  } catch (error) {
    console.error(
      'Unexpected error in DELETE /api/organizations/[id]/members:',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
