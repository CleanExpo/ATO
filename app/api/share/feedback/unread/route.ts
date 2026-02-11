/**
 * GET /api/share/feedback/unread
 *
 * Get unread feedback counts for all share links owned by a tenant.
 * Used for dashboard notification badges.
 *
 * Query params:
 * - tenantId: string (required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth';
import type { UnreadFeedbackResponse, UnreadFeedbackCount, FeedbackType } from '@/lib/types/share-feedback';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'query' })
    if (isErrorResponse(auth)) return auth

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return createValidationError('tenantId query parameter is required');
    }

    const supabase = await createServiceClient();

    // Get all shares for this tenant with their feedback counts
    const { data: shares, error: sharesError } = await supabase
      .from('shared_reports')
      .select('id, title')
      .eq('tenant_id', tenantId)
      .eq('is_revoked', false);

    if (sharesError) {
      console.error('Error fetching shares:', sharesError);
      return createErrorResponse(new Error('Failed to fetch shares'), {}, 500);
    }

    if (!shares || shares.length === 0) {
      const response: UnreadFeedbackResponse = {
        counts: [],
        totalUnread: 0,
      };
      return NextResponse.json(response);
    }

    const shareIds = shares.map(s => s.id);

    // Get unread feedback for these shares
    const { data: feedback, error: feedbackError } = await supabase
      .from('share_feedback')
      .select('share_id, author_name, message, created_at, feedback_type')
      .in('share_id', shareIds)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (feedbackError) {
      console.error('Error fetching feedback:', feedbackError);
      return createErrorResponse(new Error('Failed to fetch feedback'), {}, 500);
    }

    // Count unread per share
    const unreadCounts = new Map<string, {
      count: number;
      latest?: {
        authorName: string;
        message: string;
        createdAt: string;
        feedbackType: FeedbackType;
      };
    }>();

    for (const item of feedback || []) {
      const existing = unreadCounts.get(item.share_id);
      if (!existing) {
        unreadCounts.set(item.share_id, {
          count: 1,
          latest: {
            authorName: item.author_name,
            message: item.message,
            createdAt: item.created_at,
            feedbackType: item.feedback_type as FeedbackType,
          },
        });
      } else {
        existing.count++;
      }
    }

    // Build response
    const counts: UnreadFeedbackCount[] = [];
    let totalUnread = 0;

    for (const share of shares) {
      const unreadData = unreadCounts.get(share.id);
      if (unreadData && unreadData.count > 0) {
        counts.push({
          shareId: share.id,
          shareTitle: share.title,
          unreadCount: unreadData.count,
          latestFeedback: unreadData.latest,
        });
        totalUnread += unreadData.count;
      }
    }

    // Sort by unread count descending
    counts.sort((a, b) => b.unreadCount - a.unreadCount);

    const response: UnreadFeedbackResponse = {
      counts,
      totalUnread,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/share/feedback/unread:', error);
    return createErrorResponse(error, {}, 500);
  }
}
