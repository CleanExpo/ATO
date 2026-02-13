/**
 * GET /api/accountant/verify
 *
 * Check if current user or email is a vetted accountant
 *
 * Query params:
 * - email?: string (check by email, optional)
 *
 * Returns: { is_vetted: boolean, accountant?: VettedAccountant }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/api/errors';
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth';
import type { VettedAccountant } from '@/lib/types/accountant';

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { skipTenantValidation: true })
    if (isErrorResponse(auth)) return auth

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: 'email query parameter is required',
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email format',
        },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Check if email is vetted accountant
    const { data: accountant, error } = await supabase
      .from('vetted_accountants')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error checking vetted accountant:', error);
      return createErrorResponse(
        new Error('Failed to verify accountant status'),
        { email },
        500
      );
    }

    if (!accountant) {
      return NextResponse.json({
        success: true,
        is_vetted: false,
        message: 'Email is not registered as a vetted accountant',
      });
    }

    // Return vetted accountant data (sanitized)
    const sanitizedAccountant: Partial<VettedAccountant> = {
      id: accountant.id,
      email: accountant.email,
      full_name: accountant.full_name,
      firm_name: accountant.firm_name,
      credential_type: accountant.credential_type,
      wholesale_discount_rate: accountant.wholesale_discount_rate,
      lifetime_discount: accountant.lifetime_discount,
      is_active: accountant.is_active,
    };

    return NextResponse.json({
      success: true,
      is_vetted: true,
      accountant: sanitizedAccountant,
      message: 'Email is verified as a vetted accountant',
    });
  } catch (error) {
    console.error('Unexpected error verifying accountant:', error);
    return createErrorResponse(
      error as Error,
      { operation: 'verify_accountant' },
      500
    );
  }
}
