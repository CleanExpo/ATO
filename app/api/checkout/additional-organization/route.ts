/**
 * Additional Organization License Purchase
 *
 * POST /api/checkout/additional-organization
 *
 * Creates Stripe checkout session for purchasing additional organization access
 * Price: $199 AUD per additional organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, PRICING_CONFIG, createOrRetrieveCustomer } from '@/lib/stripe/client';
import { checkOrganizationLicenseCompliance } from '@/lib/middleware/license-verification';

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, name')
      .eq('id', user.id)
      .single();

    const email = profile?.email || user.email;
    if (!email) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

    // Check current organization license status
    const licenseStatus = await checkOrganizationLicenseCompliance(user.id);

    // Calculate how many additional licenses are needed
    const quantity = Math.max(1, licenseStatus.needsAdditionalLicenses);

    // Create or retrieve Stripe customer
    const customer = await createOrRetrieveCustomer(email, {
      user_id: user.id,
      name: profile?.name || '',
    });

    const baseUrl = request.nextUrl.origin;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: PRICING_CONFIG.additional_organization.currency,
            product_data: {
              name: PRICING_CONFIG.additional_organization.name,
              description: PRICING_CONFIG.additional_organization.description,
            },
            unit_amount: PRICING_CONFIG.additional_organization.price,
          },
          quantity,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/dashboard?payment=success&type=additional_organization`,
      cancel_url: `${baseUrl}/dashboard?payment=cancelled`,
      metadata: {
        user_id: user.id,
        product_type: 'additional_organization',
        quantity: quantity.toString(),
      },
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
      quantity,
      totalPrice: PRICING_CONFIG.additional_organization.price * quantity,
    });
  } catch (error) {
    console.error('Failed to create additional organization checkout:', error);
    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
