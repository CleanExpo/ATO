/**
 * GET /api/accountant/application/[id]
 *
 * Get application status by ID
 *
 * Returns: ApplicationStatusResponse
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/api/errors';
import type {
  ApplicationStatusResponse,
  AccountantApplication,
} from '@/lib/types/accountant';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: applicationId } = await params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(applicationId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid application ID format',
        },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Fetch application
    const { data: application, error } = await supabase
      .from('accountant_applications')
      .select('*')
      .eq('id', applicationId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching application:', error);
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

    // Build status message based on current status
    let statusMessage = '';
    let nextSteps = '';

    switch (application.status) {
      case 'pending':
        statusMessage =
          'Your application is pending review. Our team will review it within 24-48 hours.';
        nextSteps =
          'You will receive an email notification once your application has been reviewed.';
        break;

      case 'under_review':
        statusMessage =
          'Your application is currently under review by our team.';
        nextSteps =
          'We are verifying your credentials and firm details. You will hear from us shortly.';
        break;

      case 'approved':
        statusMessage =
          'Congratulations! Your application has been approved.';
        nextSteps =
          'You should have received a welcome email with login instructions. Check your email for access details.';
        break;

      case 'rejected':
        statusMessage = 'Your application was not approved at this time.';
        nextSteps = application.rejection_reason || 'Please contact support for more information.';
        break;

      case 'suspended':
        statusMessage = 'Your account has been suspended.';
        nextSteps = application.suspension_reason || 'Please contact support for assistance.';
        break;

      default:
        statusMessage = 'Application status unknown.';
        nextSteps = 'Please contact support.';
    }

    // Sanitize sensitive fields for response
    const sanitizedApplication: Partial<AccountantApplication> = {
      id: application.id,
      email: application.email,
      first_name: application.first_name,
      last_name: application.last_name,
      firm_name: application.firm_name,
      credential_type: application.credential_type,
      status: application.status,
      created_at: application.created_at,
      updated_at: application.updated_at,
      reviewed_at: application.reviewed_at,
      rejection_reason:
        application.status === 'rejected'
          ? application.rejection_reason
          : undefined,
    };

    const response: ApplicationStatusResponse = {
      application: sanitizedApplication as AccountantApplication,
      status_message: statusMessage,
      next_steps: nextSteps,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error fetching application status:', error);
    return createErrorResponse(
      error as Error,
      { operation: 'get_application_status' },
      500
    );
  }
}
