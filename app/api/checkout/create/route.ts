/**
 * POST /api/checkout/create
 *
 * Create a Stripe checkout session for payment processing
 *
 * Body:
 * - productType: 'comprehensive' | 'core' | 'wholesale_accountant'
 * - wholesaleTier?: 'standard' | 'professional' | 'enterprise' (required if productType is wholesale_accountant)
 * - successUrl?: string (optional, defaults to dashboard)
 * - cancelUrl?: string (optional, defaults to pricing page)
 *
 * Returns: CheckoutSessionResponse
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import {
  stripe,
  PRICING_CONFIG,
  calculateWholesalePrice,
  createOrRetrieveCustomer,
  type LicenseType,
} from '@/lib/stripe/client';

interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.productType) {
      return createValidationError('productType is required');
    }

    const validProductTypes: LicenseType[] = [
      'comprehensive',
      'core',
      'wholesale_accountant',
    ];
    if (!validProductTypes.includes(body.productType)) {
      return createValidationError(
        `productType must be one of: ${validProductTypes.join(', ')}`
      );
    }

    // Validate wholesale tier if productType is wholesale_accountant
    if (body.productType === 'wholesale_accountant') {
      if (!body.wholesaleTier) {
        return createValidationError(
          'wholesaleTier is required for wholesale_accountant productType'
        );
      }

      const validTiers = ['standard', 'professional', 'enterprise'];
      if (!validTiers.includes(body.wholesaleTier)) {
        return createValidationError(
          `wholesaleTier must be one of: ${validTiers.join(', ')}`
        );
      }
    }

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          errorId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return createErrorResponse(
        new Error('Failed to fetch user profile'),
        { userId: user.id },
        500
      );
    }

    // Determine pricing
    let priceAmount: number;
    let productName: string;
    let productDescription: string;

    if (body.productType === 'wholesale_accountant') {
      const baseProduct: 'comprehensive' | 'core' = (body.baseProduct as 'comprehensive' | 'core') || 'comprehensive';
      priceAmount = calculateWholesalePrice(body.wholesaleTier, baseProduct);
      productName = `${PRICING_CONFIG[baseProduct].name} (${body.wholesaleTier} tier)`;
      productDescription = `Wholesale accountant pricing - ${body.wholesaleTier} tier (${
        body.wholesaleTier === 'standard'
          ? '15%'
          : body.wholesaleTier === 'professional'
          ? '25%'
          : '35%'
      } discount)`;
    } else {
      const productType: 'comprehensive' | 'core' = body.productType as 'comprehensive' | 'core';
      const config = PRICING_CONFIG[productType];
      priceAmount = config.price;
      productName = config.name;
      productDescription = config.description;
    }

    // Create or retrieve Stripe customer
    const customer = await createOrRetrieveCustomer(user.email || '', {
      user_id: user.id,
      organization_id: profile.organization_id || '',
      product_type: body.productType,
      wholesale_tier: body.wholesaleTier || '',
    });

    // Determine redirect URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = body.successUrl || `${baseUrl}/dashboard?payment=success`;
    const cancelUrl = body.cancelUrl || `${baseUrl}/dashboard/pricing?payment=cancelled`;

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: priceAmount,
          },
          quantity: 1,
        },
      ],
      success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        organization_id: profile.organization_id || '',
        product_type: body.productType,
        wholesale_tier: body.wholesaleTier || '',
        price_amount: priceAmount.toString(),
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          product_type: body.productType,
        },
      },
    });

    // Log checkout session creation
    console.log(
      `Checkout session created: ${session.id} for user ${user.id} (${productName})`
    );

    const response: CheckoutSessionResponse = {
      sessionId: session.id,
      url: session.url || '',
      message: 'Checkout session created successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return createErrorResponse(
      error as Error,
      { operation: 'create_checkout_session' },
      500
    );
  }
}
