/**
 * Organization Invitations API
 *
 * Handles invitation management for organizations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { sendOrganizationInvitationEmail } from '@/lib/email/send-invitation'

export const dynamic = 'force-dynamic'

// Validation schema for creating invitations
const createInvitationSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'accountant', 'read_only'], {
    errorMap: () => ({ message: 'Role must be admin, accountant, or read_only' }),
  }),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/organizations/[id]/invitations
 *
 * Lists all pending invitations for an organization (owners and admins only)
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

    // Get pending invitations
    const { data: invitations, error } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('organization_id', id)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching invitations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch invitations' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expires_at,
        acceptedAt: inv.accepted_at,
        createdAt: inv.created_at,
      })),
    })
  } catch (error) {
    console.error(
      'Unexpected error in GET /api/organizations/[id]/invitations:',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/organizations/[id]/invitations
 *
 * Creates a new invitation for an organization (owners and admins only)
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

    // Parse and validate request body
    const body = await request.json()
    const validation = createInvitationSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const { email, role } = validation.data

    // Use the database function to create invitation
    const { data, error } = await supabase.rpc(
      'create_organization_invitation',
      {
        p_organization_id: id,
        p_email: email,
        p_role: role,
        p_invited_by: user.id,
      }
    )

    if (error || !data) {
      console.error('Error creating invitation:', error)

      // Check for specific error messages from the function
      if (error?.message?.includes('Insufficient permissions')) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      )
    }

    // Parse the JSON response from the database function
    const result = data as {
      success: boolean
      error?: string
      invitation_id?: string
      token?: string
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Generate invitation URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL
    const invitationUrl = `${baseUrl}/invitations/accept?token=${result.token}`

    // Get organization details for email
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', id)
      .single()

    // Get inviter details for email
    const { data: inviter } = await supabase
      .from('auth.users')
      .select('email, raw_user_meta_data')
      .eq('id', user.id)
      .single()

    const inviterName =
      inviter?.raw_user_meta_data?.full_name ||
      inviter?.email?.split('@')[0] ||
      'A team member'

    // Send invitation email using new template system
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const emailResult = await sendOrganizationInvitationEmail({
      to: email,
      invitationData: {
        inviteeName: email.split('@')[0], // Use email prefix as name
        inviterName,
        organizationName: org?.name || 'the organization',
        role,
        invitationUrl,
        expiresAt,
      },
    })

    if (!emailResult.success) {
      console.error('Failed to send invitation email:', emailResult.error)
      // Continue anyway - user can still use the URL manually
    }

    return NextResponse.json(
      {
        invitationId: result.invitation_id,
        invitationUrl,
        email,
        role,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        emailSent: emailResult.success,
        emailError: emailResult.error,
        message: emailResult.success
          ? `Invitation sent to ${email}. They will receive an email with the invitation link.`
          : `Invitation created but email failed to send. Share this URL manually: ${invitationUrl}`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error(
      'Unexpected error in POST /api/organizations/[id]/invitations:',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/organizations/[id]/invitations/[invitationId]
 *
 * Revokes an invitation (owners and admins only)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    // Get invitation ID from query params
    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get('invitationId')

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
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

    // Revoke invitation
    const { error: revokeError } = await supabase
      .from('organization_invitations')
      .update({
        status: 'revoked',
        updated_at: new Date().toISOString(),
      })
      .eq('id', invitationId)
      .eq('organization_id', id)

    if (revokeError) {
      console.error('Error revoking invitation:', revokeError)
      return NextResponse.json(
        { error: 'Failed to revoke invitation' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase.from('organization_activity_log').insert({
      organization_id: id,
      user_id: user.id,
      action: 'invitation_revoked',
      entity_type: 'invitation',
      entity_id: invitationId,
    })

    return NextResponse.json({
      success: true,
      message: 'Invitation revoked successfully',
    })
  } catch (error) {
    console.error(
      'Unexpected error in DELETE /api/organizations/[id]/invitations:',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
