/**
 * Organizations API
 *
 * Handles organization management for multi-tenant support
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Validation schema for creating organizations
const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  abn: z.string().regex(/^\d{11}$/, 'ABN must be 11 digits').optional(),
  industry: z.string().optional(),
  businessSize: z.enum(['micro', 'small', 'medium', 'large']).optional(),
})

/**
 * GET /api/organizations
 *
 * Returns all organizations the authenticated user has access to
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use the helper function to get user's organizations
    const { data, error } = await supabase.rpc('get_user_organizations', {
      p_user_id: user.id,
    })

    if (error) {
      console.error('Error fetching organizations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch organizations' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      organizations: data || [],
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/organizations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/organizations
 *
 * Creates a new organization and assigns the creator as owner
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = createOrganizationSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const { name, abn, industry, businessSize } = validation.data

    // Create organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name,
        abn,
        industry,
        business_size: businessSize,
        settings: {},
      })
      .select()
      .single()

    if (orgError) {
      console.error('Error creating organization:', orgError)
      return NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      )
    }

    // Assign creator as owner
    const { error: accessError } = await supabase
      .from('user_tenant_access')
      .insert({
        user_id: user.id,
        organization_id: organization.id,
        tenant_id: null, // No Xero connection yet
        role: 'owner',
      })

    if (accessError) {
      console.error('Error assigning owner role:', accessError)
      // Rollback organization creation
      await supabase.from('organizations').delete().eq('id', organization.id)
      return NextResponse.json(
        { error: 'Failed to assign owner role' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase.from('organization_activity_log').insert({
      organization_id: organization.id,
      user_id: user.id,
      action: 'organization_created',
      entity_type: 'organization',
      entity_id: organization.id,
      metadata: {
        name,
        abn,
        industry,
        businessSize,
      },
    })

    return NextResponse.json(
      {
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
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error in POST /api/organizations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
