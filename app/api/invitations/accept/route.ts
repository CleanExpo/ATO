/**
 * Invitation Acceptance API
 *
 * Handles acceptance of organization invitations via token
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Validation schema
const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

/**
 * POST /api/invitations/accept
 *
 * Accepts an organization invitation using the invitation token
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
    const validation = acceptInvitationSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const { token } = validation.data

    // Use the database function to accept invitation
    const { data, error } = await supabase.rpc(
      'accept_organization_invitation',
      {
        p_token: token,
        p_user_id: user.id,
      }
    )

    if (error || !data) {
      console.error('Error accepting invitation:', error)
      return NextResponse.json(
        { error: 'Failed to accept invitation' },
        { status: 500 }
      )
    }

    // Parse the JSON response from the database function
    const result = data as {
      success: boolean
      error?: string
      organization_id?: string
      organization_name?: string
      role?: string
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      organizationId: result.organization_id,
      organizationName: result.organization_name,
      role: result.role,
      message: `Successfully joined ${result.organization_name} as ${result.role}`,
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/invitations/accept:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/invitations/accept?token=...
 *
 * Validates an invitation token without accepting it (for preview)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Extract token from query params
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Get invitation details
    const { data: invitation, error } = await supabase
      .from('organization_invitations')
      .select(
        `
        id,
        email,
        role,
        status,
        expires_at,
        organization_id,
        organizations (
          id,
          name,
          industry
        )
      `
      )
      .eq('token', token)
      .single()

    if (error || !invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404 }
      )
    }

    // Check if invitation is valid
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        {
          error: `This invitation has already been ${invitation.status}`,
          status: invitation.status,
        },
        { status: 400 }
      )
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        {
          error: 'This invitation has expired',
          status: 'expired',
        },
        { status: 400 }
      )
    }

    // Return invitation details
    return NextResponse.json({
      valid: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        organization: {
          id: invitation.organization_id,
          name: (invitation.organizations as { name?: string; industry?: string } | null)?.name,
          industry: (invitation.organizations as { name?: string; industry?: string } | null)?.industry,
        },
        expiresAt: invitation.expires_at,
      },
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/invitations/accept:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
