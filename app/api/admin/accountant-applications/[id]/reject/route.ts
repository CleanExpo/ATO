/**
 * PATCH /api/admin/accountant-applications/[id]/reject
 *
 * Reject an accountant application
 *
 * Body:
 * - rejection_reason: string (required)
 * - internal_notes?: string (optional admin notes)
 * - can_reapply?: boolean (default: true)
 * - reapply_after_days?: number (default: 90)
 *
 * Returns: RejectionResponse
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import { sendAccountantRejectionEmail } from '@/lib/email/resend-client';
import { requireAdminRole } from '@/lib/middleware/admin-role';
import { logAdminAction, getIpAddress, getUserAgent } from '@/lib/audit/logger';
import type { RejectionResponse } from '@/lib/types/accountant';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin role
    const adminCheck = await requireAdminRole();
    if (!adminCheck.isAdmin) {
      return adminCheck.response;
    }

    const { id: applicationId } = await params;
    const body = await request.json();

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(applicationId)) {
      return createValidationError('Invalid application ID format');
    }

    // Validate required fields
    if (!body.rejection_reason || body.rejection_reason.trim().length === 0) {
      return createValidationError('rejection_reason is required');
    }

    if (body.rejection_reason.length < 10) {
      return createValidationError(
        'rejection_reason must be at least 10 characters'
      );
    }

    // Parse optional parameters
    const rejection_reason = body.rejection_reason.trim();
    const internal_notes = body.internal_notes || '';
    const can_reapply = body.can_reapply !== false;
    const reapply_after_days = body.reapply_after_days || 90;

    const supabase = await createServiceClient();

    // Fetch application
    const { data: application, error: fetchError } = await supabase
      .from('accountant_applications')
      .select('*')
      .eq('id', applicationId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching application:', fetchError);
      return createErrorResponse(
        new Error('Failed to fetch application'),
        { applicationId },
        500
      );
    }

    if (!application) {
      return NextResponse.json(
        {
          success: false,
          error: 'Application not found',
        },
        { status: 404 }
      );
    }

    // Check if already processed
    if (
      application.status !== 'pending' &&
      application.status !== 'under_review'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Application already ${application.status}`,
        },
        { status: 409 }
      );
    }

    // Calculate reapply date
    const reapplyDate = new Date();
    reapplyDate.setDate(reapplyDate.getDate() + reapply_after_days);
    const reapply_after = can_reapply
      ? reapplyDate.toISOString()
      : undefined;

    // Update application status
    const { error: updateError } = await supabase
      .from('accountant_applications')
      .update({
        status: 'rejected',
        rejection_reason,
        reviewed_at: new Date().toISOString(),
        internal_notes: internal_notes || application.internal_notes,
      })
      .eq('id', applicationId);

    if (updateError) {
      console.error('Error updating application:', updateError);
      return createErrorResponse(
        new Error('Failed to update application'),
        { applicationId },
        500
      );
    }

    // Log activity
    await supabase.from('accountant_activity_log').insert([
      {
        application_id: applicationId,
        action: 'application_rejected',
        actor_role: 'admin',
        details: {
          rejection_reason,
          can_reapply,
          reapply_after,
          firm_name: application.firm_name,
          credential_type: application.credential_type,
        },
      },
    ]);

    // Log admin action for audit trail
    await logAdminAction({
      action: 'accountant_application_rejected',
      actor_id: adminCheck.userId!,
      actor_email: adminCheck.email,
      target_id: applicationId,
      target_type: 'accountant_application',
      details: {
        firm_name: application.firm_name,
        credential_type: application.credential_type,
        rejection_reason,
        can_reapply,
        reapply_after,
      },
      ip_address: getIpAddress(request) ?? undefined,
      user_agent: getUserAgent(request) ?? undefined,
    });

    // Send rejection email
    const emailResult = await sendAccountantRejectionEmail({
      to: application.email,
      firstName: application.first_name,
      rejectionReason: rejection_reason,
    });

    if (!emailResult.success) {
      console.error('Failed to send rejection email:', emailResult.error);
      // Continue with rejection even if email fails
    }

    // Return response
    let message = 'Application rejected successfully.';
    if (emailResult.success) {
      message += ' Rejection email sent.';
    } else {
      message += ` Warning: Failed to send rejection email (${emailResult.error || 'unknown error'}).`;
    }

    const response: RejectionResponse = {
      success: true,
      message,
      can_reapply,
      reapply_after,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error rejecting application:', error);
    return createErrorResponse(
      error as Error,
      { operation: 'reject_accountant_application' },
      500
    );
  }
}
