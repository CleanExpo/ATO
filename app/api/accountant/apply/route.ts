/**
 * POST /api/accountant/apply
 *
 * Submit accountant application for vetting
 *
 * Body: AccountantApplicationFormData
 * Returns: ApplicationSubmissionResponse
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth';
import {
  accountantApplicationFormSchema,
  sanitiseFormData,
} from '@/lib/validation/accountant-application';
import type {
  ApplicationSubmissionResponse,
  AccountantApplication,
} from '@/lib/types/accountant';

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { skipTenantValidation: true })
    if (isErrorResponse(auth)) return auth

    const body = await request.json();

    // Validate request body
    const validation = accountantApplicationFormSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      return createValidationError(
        'Validation failed',
        errors as unknown as Record<string, string[]>
      );
    }

    const formData = sanitiseFormData(validation.data);

    // Create Supabase client (service role for inserting)
    const supabase = await createServiceClient();

    // Check for duplicate email
    const { data: existingApplication, error: checkError } = await supabase
      .from('accountant_applications')
      .select('id, email, status')
      .eq('email', formData.email)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking for existing application:', checkError);
      return createErrorResponse(
        new Error('Failed to check for existing application'),
        { email: formData.email },
        500
      );
    }

    // If application exists and is not rejected, prevent duplicate
    if (
      existingApplication &&
      existingApplication.status !== 'rejected'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'duplicate_application',
          message: `An application already exists for ${formData.email}. Status: ${existingApplication.status}`,
          application_id: existingApplication.id,
        },
        { status: 409 }
      );
    }

    // Get IP address and user agent for metadata
    const ip_address = request.headers.get('x-forwarded-for') ||
                       request.headers.get('x-real-ip') ||
                       'unknown';
    const user_agent = request.headers.get('user-agent') || 'unknown';

    // Prepare application data
    const applicationData: Partial<AccountantApplication> = {
      // Contact Details
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      phone: formData.phone,

      // Firm Details
      firm_name: formData.firm_name,
      firm_abn: formData.firm_abn,
      firm_website: formData.firm_website,
      firm_address: formData.firm_address,

      // Professional Credentials
      credential_type: formData.credential_type,
      credential_number: formData.credential_number,
      credential_issuing_body: formData.credential_issuing_body,
      credential_expiry: formData.credential_expiry,
      years_experience: formData.years_experience,

      // Additional Information
      specializations: formData.specializations,
      client_count: formData.client_count,
      referral_source: formData.referral_source,

      // Status
      status: 'pending',

      // Full Application Data (JSON backup)
      application_data: {
        ...formData,
        submitted_at: new Date().toISOString(),
        agreed_to_terms: formData.agreed_to_terms,
        agreed_to_privacy: formData.agreed_to_privacy,
      },

      // Metadata
      ip_address,
      user_agent,
    };

    // Insert application
    const { data: application, error: insertError } = await supabase
      .from('accountant_applications')
      .insert([applicationData])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting application:', insertError);
      return createErrorResponse(
        new Error('Failed to submit application'),
        { email: formData.email, error: insertError.message },
        500
      );
    }

    // Log activity
    await supabase.from('accountant_activity_log').insert([
      {
        application_id: application.id,
        action: 'application_submitted',
        actor_role: 'self',
        details: {
          credential_type: formData.credential_type,
          firm_name: formData.firm_name,
          years_experience: formData.years_experience,
        },
        ip_address,
        user_agent,
      },
    ]);

    // Return success response
    const response: ApplicationSubmissionResponse = {
      success: true,
      application_id: application.id,
      message:
        'Application submitted successfully. You will receive an email once your application has been reviewed.',
      estimated_review_time: '24-48 hours',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in accountant application:', error);
    return createErrorResponse(
      error as Error,
      { operation: 'submit_accountant_application' },
      500
    );
  }
}
