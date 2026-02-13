/**
 * Notifications API
 *
 * Handles user notification management
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/notifications
 *
 * Fetches notifications for the current user with pagination
 *
 * Query params:
 * - limit: number (default: 20, max: 100)
 * - offset: number (default: 0)
 * - unreadOnly: boolean (default: false)
 * - organizationId: UUID (optional - filter by organization)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { skipTenantValidation: true })
    if (isErrorResponse(auth)) return auth

    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20'),
      100
    )
    const offset = parseInt(searchParams.get('offset') || '0')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const organizationId = searchParams.get('organizationId')

    // Build query
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by unread if requested
    if (unreadOnly) {
      query = query.eq('read', false)
    }

    // Filter by organization if provided
    if (organizationId) {
      query = query.eq('organization_id', organizationId)
    }

    const { data: notifications, error, count } = await query

    if (error) {
      console.error('Error fetching notifications:', error)
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      )
    }

    // Get unread count
    const { data: unreadCount } = await supabase.rpc(
      'get_unread_notification_count',
      { p_user_id: user.id }
    )

    return NextResponse.json({
      notifications: notifications || [],
      total: count || 0,
      unreadCount: unreadCount || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications
 *
 * Creates a notification (for internal use / webhooks)
 * Usually notifications are created via database triggers
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { skipTenantValidation: true })
    if (isErrorResponse(auth)) return auth

    const supabase = await createClient()

    // This endpoint should typically only be called by service role
    // For now, we'll allow authenticated users but validate carefully

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      userId,
      organizationId,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
      actionUrl,
      metadata,
    } = body

    // Validate required fields
    if (!userId || !type || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, type, title, message' },
        { status: 400 }
      )
    }

    // Create notification using helper function
    const { data, error } = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_organization_id: organizationId || null,
      p_type: type,
      p_title: title,
      p_message: message,
      p_related_entity_type: relatedEntityType || null,
      p_related_entity_id: relatedEntityId || null,
      p_action_url: actionUrl || null,
      p_metadata: metadata || {},
    })

    if (error) {
      console.error('Error creating notification:', error)
      return NextResponse.json(
        { error: 'Failed to create notification' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        notificationId: data,
        message: 'Notification created successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error in POST /api/notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
