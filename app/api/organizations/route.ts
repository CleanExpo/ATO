/**
 * Organizations API
 *
 * Handles organization management for multi-tenant support
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

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
export async function GET(_request: NextRequest) {
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

    // Query user_tenant_access directly (bypasses broken RPC that references
    // non-existent deleted_at column on organizations table)
    const { data: accessRows, error: accessError } = await supabase
      .from('user_tenant_access')
      .select('organization_id, tenant_id, role')
      .eq('user_id', user.id)

    if (accessError) {
      console.error('Error fetching user access:', accessError)
      return NextResponse.json(
        { error: 'Failed to fetch organizations' },
        { status: 500 }
      )
    }

    if (!accessRows || accessRows.length === 0) {
      return NextResponse.json({ organizations: [] })
    }

    // Fetch full organization data
    const orgIds = accessRows.map((r: { organization_id: string }) => r.organization_id)
    const { data: fullOrgs, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .in('id', orgIds)

    if (orgError) {
      console.error('Error fetching org data:', orgError)
      return NextResponse.json(
        { error: 'Failed to fetch organization details' },
        { status: 500 }
      )
    }

    // Build a role lookup from user_tenant_access
    const roleLookup = new Map<string, string>()
    for (const r of accessRows) {
      roleLookup.set(r.organization_id, r.role)
    }

    // Transform snake_case DB rows to camelCase Organization objects
    const organizations = (fullOrgs || []).map((org: Record<string, unknown>) => ({
      id: org.id,
      name: org.name,
      abn: org.abn || undefined,
      industry: org.industry || undefined,
      businessSize: org.business_size || undefined,
      xeroTenantId: org.xero_tenant_id || undefined,
      xeroConnectedAt: org.xero_connected_at || undefined,
      settings: org.settings || {},
      subscriptionTier: org.subscription_tier || 'free',
      subscriptionStatus: org.subscription_status || 'active',
      createdAt: org.created_at,
      updatedAt: org.updated_at,
      // Include the user's role for convenience
      role: roleLookup.get(org.id as string) || undefined,
    }))

    const response = NextResponse.json({ organizations })
    response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=60')
    return response
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
