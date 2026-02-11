/**
 * GET /api/accountant/pricing
 *
 * Get pricing information for accountant (vetted vs standard)
 *
 * Query params:
 * - email: string (required)
 *
 * Returns: AccountantPricingResponse
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/api/errors';
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth';
import type { AccountantPricingResponse } from '@/lib/types/accountant';

// Standard pricing (non-accountant)
const STANDARD_PRICE = 995.0;

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

    // Try database function first (faster)
    const { data: pricingData, error: functionError } = await supabase.rpc(
      'get_accountant_pricing',
      {
        check_email: email.toLowerCase(),
      }
    );

    // If function exists and works, use it
    if (!functionError && pricingData && pricingData.length > 0) {
      const pricing = pricingData[0];
      const response: AccountantPricingResponse = {
        is_vetted: pricing.is_vetted,
        discount_rate: pricing.discount_rate,
        final_price: pricing.final_price,
        standard_price: pricing.standard_price,
        message: pricing.is_vetted
          ? `Wholesale pricing: ${Math.round(pricing.discount_rate * 100)}% discount`
          : 'Standard pricing',
      };
      return NextResponse.json(response);
    }

    // Fallback: Query table directly
    const { data: accountant, error } = await supabase
      .from('vetted_accountants')
      .select('wholesale_discount_rate, is_active')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching accountant pricing:', error);
      return createErrorResponse(
        new Error('Failed to fetch pricing'),
        { email },
        500
      );
    }

    // Calculate pricing
    const is_vetted = !!accountant;
    const discount_rate = accountant?.wholesale_discount_rate || 0;
    const final_price = is_vetted
      ? STANDARD_PRICE * (1 - discount_rate)
      : STANDARD_PRICE;

    const response: AccountantPricingResponse = {
      is_vetted,
      discount_rate,
      final_price: Math.round(final_price * 100) / 100, // Round to 2 decimals
      standard_price: STANDARD_PRICE,
      message: is_vetted
        ? `Wholesale pricing: ${Math.round(discount_rate * 100)}% discount (${accountant?.wholesale_discount_rate === 0.5 ? '$495' : `$${final_price}`})`
        : 'Standard pricing ($995)',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error fetching pricing:', error);
    return createErrorResponse(
      error as Error,
      { operation: 'get_accountant_pricing' },
      500
    );
  }
}
