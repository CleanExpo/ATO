/**
 * Organization Detail API
 *
 * Handles operations on individual organizations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Validation schema for updating organizations
const updateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  abn: z.string().regex(/^\d{11}$/, 'ABN must be 11 digits').optional(),
  industry: z.string().optional(),
  businessSize: z.enum(['micro', 'small', 'medium', 'large']).optional(),
  settings: z.record(z.any()).optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/organizations/[id]
 *
 * Returns details for a specific organization
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

    // Get organization with RLS check
    const { data: organization, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get user's role for this organization
    const { data: access } = await supabase
      .from('user_tenant_access')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', id)
      .single()

    // Get member count
    const { count: memberCount } = await supabase
      .from('user_tenant_access')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', id)

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        abn: organization.abn,
        industry: organization.industry,
        businessSize: organization.business_size,
        xeroTenantId: organization.xero_tenant_id,
        xeroConnectedAt: organization.xero_connected_at,
        settings: organization.settings,
        subscriptionTier: organization.subscription_tier,
        subscriptionStatus: organization.subscription_status,
        createdAt: organization.created_at,
        updatedAt: organization.updated_at,
        memberCount: memberCount || 0,
        userRole: access?.role || null,
      },
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/organizations/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/organizations/[id]
 *
 * Updates organization details (owners and admins only)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
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
    const validation = updateOrganizationSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const { name, abn, industry, businessSize, settings } = validation.data

    // Build update object
    const updates: Record<string, string | Record<string, unknown>> = {}
    if (name) updates.name = name
    if (abn !== undefined) updates.abn = abn
    if (industry !== undefined) updates.industry = industry
    if (businessSize) updates.business_size = businessSize
    if (settings !== undefined) {
      // Merge settings instead of replacing
      const { data: current } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', id)
        .single()

      updates.settings = { ...current?.settings, ...settings }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Update organization
    const { data: organization, error: updateError } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating organization:', updateError)
      return NextResponse.json(
        { error: 'Failed to update organization' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase.from('organization_activity_log').insert({
      organization_id: id,
      user_id: user.id,
      action: 'organization_updated',
      entity_type: 'organization',
      entity_id: id,
      metadata: updates,
    })

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        abn: organization.abn,
        industry: organization.industry,
        businessSize: organization.business_size,
        xeroTenantId: organization.xero_tenant_id,
        xeroConnectedAt: organization.xero_connected_at,
        settings: organization.settings,
        subscriptionTier: organization.subscription_tier,
        subscriptionStatus: organization.subscription_status,
        createdAt: organization.created_at,
        updatedAt: organization.updated_at,
      },
    })
  } catch (error) {
    console.error('Unexpected error in PATCH /api/organizations/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/organizations/[id]
 *
 * Soft deletes an organization (owners only)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
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

    // Check if user is owner
    const { data: canManage, error: permError } = await supabase.rpc(
      'can_user_manage_organization',
      {
        p_user_id: user.id,
        p_organization_id: id,
        p_required_role: 'owner',
      }
    )

    if (permError || !canManage) {
      return NextResponse.json(
        { error: 'Only owners can delete organizations' },
        { status: 403 }
      )
    }

    // Soft delete (set deleted_at timestamp)
    const { error: deleteError } = await supabase
      .from('organizations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting organization:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete organization' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase.from('organization_activity_log').insert({
      organization_id: id,
      user_id: user.id,
      action: 'organization_deleted',
      entity_type: 'organization',
      entity_id: id,
    })

    return NextResponse.json({
      success: true,
      message: 'Organization deleted successfully',
    })
  } catch (error) {
    console.error('Unexpected error in DELETE /api/organizations/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
