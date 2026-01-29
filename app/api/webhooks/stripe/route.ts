/**
 * POST /api/webhooks/stripe
 *
 * Handle Stripe webhook events
 *
 * Events processed:
 * - checkout.session.completed: Create purchase record and activate license
 * - payment_intent.succeeded: Log successful payment
 * - payment_intent.payment_failed: Log failed payment
 *
 * Returns: 200 OK if processed successfully, 400 for invalid signature
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyWebhookSignature } from '@/lib/stripe/client';
import Stripe from 'stripe';

/**
 * Disable Next.js body parsing so we can verify webhook signature
 * Stripe requires the raw body to verify the signature
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Get webhook secret from environment
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error(
        'STRIPE_WEBHOOK_SECRET not configured. Cannot verify webhook.'
      );
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Get raw body and signature
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing stripe-signature header');
      return NextResponse.json(
        { error: 'Missing signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(body, signature, webhookSecret);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Webhook signature verification failed:', message);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Process event
    console.log(`Processing webhook event: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle successful checkout session completion
 * Create purchase record and activate license
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  try {
    const supabase = await createServiceClient();

    // Extract metadata
    const userId = session.metadata?.user_id;
    const organizationId = session.metadata?.organization_id || null;
    const productType = session.metadata?.product_type;
    const wholesaleTier = session.metadata?.wholesale_tier || null;
    const priceAmount = parseInt(session.metadata?.price_amount || '0', 10);

    if (!userId || !productType) {
      console.error('Missing required metadata in checkout session:', {
        userId,
        productType,
      });
      return;
    }

    // Create purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert([
        {
          user_id: userId,
          organization_id: organizationId,
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent as string,
          stripe_customer_id: session.customer as string,
          product_type: productType,
          wholesale_tier: wholesaleTier,
          amount_paid: priceAmount,
          currency: 'aud',
          payment_status: 'completed',
          license_active: true,
          license_expires_at: null, // One-time purchase, no expiration
        },
      ])
      .select()
      .single();

    if (purchaseError) {
      console.error('Error creating purchase record:', purchaseError);
      return;
    }

    console.log(`Purchase record created: ${purchase.id} for user ${userId}`);

    // Update user profile with license status
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        license_type: productType,
        license_active: true,
        license_activated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating profile license status:', profileError);
      return;
    }

    console.log(`License activated for user ${userId}: ${productType}`);

    // TODO: Send confirmation email to user
    console.log(`TODO: Send purchase confirmation email to user ${userId}`);
  } catch (error) {
    console.error('Error handling checkout completion:', error);
    throw error;
  }
}

/**
 * Handle successful payment intent
 * Log the successful payment
 */
async function handlePaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  try {
    console.log(`Payment succeeded: ${paymentIntent.id}`);
    console.log(`Amount: ${paymentIntent.amount} ${paymentIntent.currency}`);
    console.log(`Customer: ${paymentIntent.customer}`);
    console.log(`Metadata:`, paymentIntent.metadata);

    // Update purchase record if it exists
    if (paymentIntent.id) {
      const supabase = await createServiceClient();
      const { error } = await supabase
        .from('purchases')
        .update({
          payment_status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', paymentIntent.id);

      if (error) {
        console.error('Error updating purchase with payment status:', error);
      }
    }
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

/**
 * Handle failed payment intent
 * Log the failure and update purchase record
 */
async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  try {
    console.error(`Payment failed: ${paymentIntent.id}`);
    console.error(`Amount: ${paymentIntent.amount} ${paymentIntent.currency}`);
    console.error(`Customer: ${paymentIntent.customer}`);
    console.error(`Last error:`, paymentIntent.last_payment_error);

    // Update purchase record if it exists
    if (paymentIntent.id) {
      const supabase = await createServiceClient();
      const { error } = await supabase
        .from('purchases')
        .update({
          payment_status: 'failed',
          failure_reason:
            paymentIntent.last_payment_error?.message ||
            'Payment failed',
        })
        .eq('stripe_payment_intent_id', paymentIntent.id);

      if (error) {
        console.error('Error updating purchase with failure status:', error);
      }
    }

    // TODO: Send payment failure email to user
    const userId = paymentIntent.metadata?.user_id;
    if (userId) {
      console.log(`TODO: Send payment failure email to user ${userId}`);
    }
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}
