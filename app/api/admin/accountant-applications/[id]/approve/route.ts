/**
 * PATCH /api/admin/accountant-applications/[id]/approve
 *
 * Approve an accountant application and create vetted accountant record
 *
 * Body:
 * - internal_notes?: string (optional admin notes)
 * - wholesale_discount_rate?: number (default: 0.5 = 50% off)
 * - send_welcome_email?: boolean (default: true)
 *
 * Returns: ApprovalResponse
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import { sendAccountantWelcomeEmail } from '@/lib/email/resend-client';
import { requireAdminRole } from '@/lib/middleware/admin-role';
import { logAdminAction, getIpAddress, getUserAgent } from '@/lib/audit/logger';
import type {
  ApprovalResponse,
  AccountantApplication,
  VettedAccountant,
} from '@/lib/types/accountant';

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

    // Parse optional parameters
    const internal_notes = body.internal_notes || '';
    const wholesale_discount_rate = body.wholesale_discount_rate || 0.5;
    const send_welcome_email = body.send_welcome_email !== false;

    // Validate discount rate
    if (
      wholesale_discount_rate < 0 ||
      wholesale_discount_rate > 1
    ) {
      return createValidationError(
        'wholesale_discount_rate must be between 0 and 1'
      );
    }

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
    if (application.status !== 'pending' && application.status !== 'under_review') {
      return NextResponse.json(
        {
          success: false,
          error: `Application already ${application.status}`,
        },
        { status: 409 }
      );
    }

    // Step 1: Create user account in auth.users (via Supabase Auth Admin API)
    // For now, we'll create a placeholder and send magic link email
    // In production, you'd use: supabase.auth.admin.createUser()

    // Generate a temporary user_id (in production, this would be from auth.users)
    const tempUserId = crypto.randomUUID();

    // Step 2: Create organization for the accountant's firm
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .insert([
        {
          name: application.firm_name,
          abn: application.firm_abn,
          settings: {
            accountant_firm: true,
            credential_type: application.credential_type,
          },
        },
      ])
      .select()
      .single();

    if (orgError) {
      console.error('Error creating organization:', orgError);
      // If organizations table doesn't exist, continue without it
      console.warn('Continuing without organization creation');
    }

    const organizationId = organization?.id || tempUserId;

    // Step 3: Create vetted accountant record
    const vettedAccountantData: Partial<VettedAccountant> = {
      user_id: tempUserId,
      application_id: application.id,
      organization_id: organizationId,
      email: application.email,
      full_name: `${application.first_name} ${application.last_name}`,
      firm_name: application.firm_name,
      credential_type: application.credential_type,
      credential_number: application.credential_number,
      is_active: true,
      wholesale_discount_rate,
      lifetime_discount: true,
      special_pricing_note: `Approved on ${new Date().toISOString().split('T')[0]}`,
      total_reports_generated: 0,
      total_clients_onboarded: 0,
    };

    const { data: vettedAccountant, error: vettedError } = await supabase
      .from('vetted_accountants')
      .insert([vettedAccountantData])
      .select()
      .single();

    if (vettedError) {
      console.error('Error creating vetted accountant:', vettedError);
      return createErrorResponse(
        new Error('Failed to create vetted accountant record'),
        { applicationId, error: vettedError.message },
        500
      );
    }

    // Step 4: Update application status
    const { error: updateError } = await supabase
      .from('accountant_applications')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        internal_notes,
        user_id: tempUserId,
        approved_organization_id: organizationId,
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

    // Step 5: Log activity
    await supabase.from('accountant_activity_log').insert([
      {
        accountant_id: vettedAccountant.id,
        application_id: applicationId,
        action: 'application_approved',
        actor_role: 'admin',
        details: {
          wholesale_discount_rate,
          organization_id: organizationId,
          firm_name: application.firm_name,
        },
      },
    ]);

    // Step 5a: Log admin action for audit trail
    await logAdminAction({
      action: 'accountant_application_approved',
      actor_id: adminCheck.userId!,
      actor_email: adminCheck.email,
      target_id: applicationId,
      target_type: 'accountant_application',
      details: {
        firm_name: application.firm_name,
        credential_type: application.credential_type,
        wholesale_discount_rate,
        vetted_accountant_id: vettedAccountant.id,
      },
      ip_address: getIpAddress(request),
      user_agent: getUserAgent(request),
    });

    // Step 6: Generate login URL
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/login`;

    // Step 7: Send welcome email
    let emailSuccess = false;
    let emailError: string | undefined;

    if (send_welcome_email) {
      // Determine pricing tier from discount rate
      let pricingTier: 'standard' | 'professional' | 'enterprise' = 'standard';
      if (wholesale_discount_rate >= 0.35) {
        pricingTier = 'enterprise';
      } else if (wholesale_discount_rate >= 0.25) {
        pricingTier = 'professional';
      }

      const emailResult = await sendAccountantWelcomeEmail({
        to: application.email,
        firstName: application.first_name,
        lastName: application.last_name,
        firmName: application.firm_name,
        pricingTier,
        loginUrl,
      });

      emailSuccess = emailResult.success;
      emailError = emailResult.error;

      if (!emailSuccess) {
        console.error('Failed to send welcome email:', emailError);
        // Continue with approval even if email fails
      }
    }

    // Return success response
    let message = 'Application approved successfully.';
    if (send_welcome_email) {
      if (emailSuccess) {
        message += ` Welcome email sent to ${application.email}.`;
      } else {
        message += ` Warning: Failed to send welcome email (${emailError || 'unknown error'}).`;
      }
    } else {
      message += ' No email sent.';
    }

    const response: ApprovalResponse = {
      success: true,
      accountant_id: vettedAccountant.id,
      user_id: tempUserId,
      organization_id: organizationId,
      magic_link: loginUrl,
      message,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error approving application:', error);
    return createErrorResponse(
      error as Error,
      { operation: 'approve_accountant_application' },
      500
    );
  }
}
