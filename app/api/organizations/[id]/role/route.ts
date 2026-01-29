/**
 * Organization Role API
 *
 * Returns the authenticated user's role for a specific organization
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/organizations/[id]/role
 *
 * Returns the user's role for the specified organization
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

    // Get user's role for this organization
    const { data, error } = await supabase
      .from('user_tenant_access')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'User does not have access to this organization' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      role: data.role,
      organizationId: id,
    })
  } catch (error) {
    console.error(
      'Unexpected error in GET /api/organizations/[id]/role:',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
