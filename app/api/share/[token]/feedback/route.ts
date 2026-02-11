/**
 * GET/POST /api/share/[token]/feedback
 *
 * Manage feedback for a shared report.
 *
 * GET - List all feedback for this share link
 * POST - Create new feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import { isValidTokenFormat, isExpired } from '@/lib/share/token-generator';
import type {
  ShareFeedback,
  CreateFeedbackRequest,
  CreateFeedbackResponse,
  FeedbackWithReplies,
  FeedbackThread,
  ListFeedbackResponse,
  FeedbackType,
} from '@/lib/types/share-feedback';

export const dynamic = 'force-dynamic'

const VALID_FEEDBACK_TYPES: FeedbackType[] = ['comment', 'question', 'approval', 'concern'];

/**
 * GET - List all feedback for a share link
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!isValidTokenFormat(token)) {
      return createValidationError('Invalid token format');
    }

    const supabase = await createServiceClient();

    // Validate share link exists and is accessible
    const { data: share, error: shareError } = await supabase
      .from('shared_reports')
      .select('id, is_revoked, expires_at')
      .eq('token', token)
      .single();

    if (shareError || !share) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    if (share.is_revoked || isExpired(share.expires_at)) {
      return NextResponse.json({ error: 'Share link is no longer accessible' }, { status: 403 });
    }

    // Fetch all feedback for this share
    const { data: feedback, error: feedbackError } = await supabase
      .from('share_feedback')
      .select('*')
      .eq('share_id', share.id)
      .order('created_at', { ascending: true });

    if (feedbackError) {
      console.error('Error fetching feedback:', feedbackError);
      return createErrorResponse(new Error('Failed to fetch feedback'), {}, 500);
    }

    // Organize feedback into threads
    const threads = organizeFeedbackIntoThreads(feedback as ShareFeedback[]);

    const response: ListFeedbackResponse = {
      threads,
      totalCount: feedback?.length || 0,
      unreadCount: feedback?.filter(f => !f.is_read).length || 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/share/[token]/feedback:', error);
    return createErrorResponse(error, {}, 500);
  }
}

/**
 * POST - Create new feedback
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json() as CreateFeedbackRequest;

    if (!isValidTokenFormat(token)) {
      return createValidationError('Invalid token format');
    }

    // Validate required fields
    if (!body.authorName || typeof body.authorName !== 'string' || body.authorName.trim().length === 0) {
      return createValidationError('authorName is required');
    }

    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      return createValidationError('message is required');
    }

    if (!body.feedbackType || !VALID_FEEDBACK_TYPES.includes(body.feedbackType)) {
      return createValidationError(`feedbackType must be one of: ${VALID_FEEDBACK_TYPES.join(', ')}`);
    }

    // Validate email format if provided
    if (body.authorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.authorEmail)) {
      return createValidationError('Invalid email format');
    }

    const supabase = await createServiceClient();

    // Validate share link exists and is accessible
    const { data: share, error: shareError } = await supabase
      .from('shared_reports')
      .select('id, is_revoked, expires_at')
      .eq('token', token)
      .single();

    if (shareError || !share) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    if (share.is_revoked || isExpired(share.expires_at)) {
      return NextResponse.json({ error: 'Share link is no longer accessible' }, { status: 403 });
    }

    // Validate reply_to if provided
    if (body.replyTo) {
      const { data: parentFeedback } = await supabase
        .from('share_feedback')
        .select('id')
        .eq('id', body.replyTo)
        .eq('share_id', share.id)
        .single();

      if (!parentFeedback) {
        return createValidationError('Invalid replyTo feedback ID');
      }
    }

    // Create feedback
    const { data: newFeedback, error: createError } = await supabase
      .from('share_feedback')
      .insert({
        share_id: share.id,
        finding_id: body.findingId || null,
        author_name: body.authorName.trim(),
        author_email: body.authorEmail?.trim() || null,
        message: body.message.trim(),
        feedback_type: body.feedbackType,
        reply_to: body.replyTo || null,
      })
      .select()
      .single();

    if (createError || !newFeedback) {
      console.error('Error creating feedback:', createError);
      return createErrorResponse(new Error('Failed to create feedback'), {}, 500);
    }

    const response: CreateFeedbackResponse = {
      success: true,
      feedback: newFeedback as ShareFeedback,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/share/[token]/feedback:', error);
    return createErrorResponse(error, {}, 500);
  }
}

/**
 * Organize flat feedback list into threaded structure grouped by finding
 */
function organizeFeedbackIntoThreads(feedback: ShareFeedback[]): FeedbackThread[] {
  // Group by finding_id
  const groupedByFinding = new Map<string | null, ShareFeedback[]>();

  for (const item of feedback) {
    const key = item.finding_id;
    if (!groupedByFinding.has(key)) {
      groupedByFinding.set(key, []);
    }
    groupedByFinding.get(key)!.push(item);
  }

  // Convert each group to a thread
  const threads: FeedbackThread[] = [];

  for (const [findingId, items] of groupedByFinding) {
    // Build reply tree
    const rootItems = items.filter(i => !i.reply_to);
    const repliesMap = new Map<string, ShareFeedback[]>();

    for (const item of items) {
      if (item.reply_to) {
        if (!repliesMap.has(item.reply_to)) {
          repliesMap.set(item.reply_to, []);
        }
        repliesMap.get(item.reply_to)!.push(item);
      }
    }

    // Recursively build nested structure
    function buildWithReplies(item: ShareFeedback): FeedbackWithReplies {
      const replies = repliesMap.get(item.id) || [];
      return {
        ...item,
        replies: replies.map(r => buildWithReplies(r)),
      };
    }

    const threadedFeedback = rootItems.map(item => buildWithReplies(item));

    threads.push({
      findingId,
      findingTitle: findingId ? `Finding: ${findingId}` : null,
      feedback: threadedFeedback,
      totalCount: items.length,
      unreadCount: items.filter(i => !i.is_read).length,
    });
  }

  // Sort: general feedback (null finding_id) last, others by most recent activity
  threads.sort((a, b) => {
    if (a.findingId === null && b.findingId !== null) return 1;
    if (a.findingId !== null && b.findingId === null) return -1;
    return 0;
  });

  return threads;
}
