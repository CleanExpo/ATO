/**
 * POST /api/share/feedback/[id]/read
 *
 * Mark a feedback item as read.
 * Requires the user to own the share link (tenant verification).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth';

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request, { tenantIdSource: 'query' })
    if (isErrorResponse(auth)) return auth

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!id) {
      return createValidationError('Feedback ID is required');
    }

    if (!tenantId) {
      return createValidationError('tenantId query parameter is required');
    }

    const supabase = await createServiceClient();

    // Verify feedback exists
    const { data: feedback, error: fetchError } = await supabase
      .from('share_feedback')
      .select('id, is_read, share_id')
      .eq('id', id)
      .single();

    if (fetchError || !feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    // Verify share belongs to this tenant
    const { data: share, error: shareError } = await supabase
      .from('shared_reports')
      .select('tenant_id')
      .eq('id', feedback.share_id)
      .single();

    if (shareError || !share || share.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Already read
    if (feedback.is_read) {
      return NextResponse.json({ success: true, alreadyRead: true });
    }

    // Mark as read
    const { error: updateError } = await supabase
      .from('share_feedback')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error marking feedback as read:', updateError);
      return createErrorResponse(new Error('Failed to update feedback'), {}, 500);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/share/feedback/[id]/read:', error);
    return createErrorResponse(error, {}, 500);
  }
}
