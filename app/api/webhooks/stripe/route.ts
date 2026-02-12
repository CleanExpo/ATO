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
import { sendPurchaseConfirmationEmail, sendPaymentFailureEmail } from '@/lib/email/resend-client';
import { createLogger } from '@/lib/logger';
import { optionalConfig } from '@/lib/config/env';
import Stripe from 'stripe';

const log = createLogger('stripe:webhook');

/**
 * Disable Next.js body parsing so we can verify webhook signature
 * Stripe requires the raw body to verify the signature
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Get webhook secret from environment
    const webhookSecret = optionalConfig.stripeWebhookSecret;
    if (!webhookSecret) {
      log.error('STRIPE_WEBHOOK_SECRET not configured. Cannot verify webhook.');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Get raw body and signature
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      log.error('Missing stripe-signature header');
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
      log.error('Webhook signature verification failed', new Error(message));
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Process event
    log.info('Processing webhook event', { type: event.type, eventId: event.id });

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
        log.info('Unhandled event type', { type: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error('Error processing webhook', error);
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
      log.error('Missing required metadata in checkout session', undefined, { userId, productType });
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
      log.error('Error creating purchase record', purchaseError);
      return;
    }

    log.info('Purchase record created', { purchaseId: purchase.id, userId });

    // Update user profile with license status
    // Note: For additional_organization purchases, we don't update the primary license_type
    if (productType !== 'additional_organization') {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          license_type: productType,
          license_active: true,
          license_activated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileError) {
        log.error('Error updating profile licence status', profileError);
        return;
      }

      log.info('Licence activated', { userId, productType });
    } else {
      log.info('Additional organisation licence purchased', { userId });
    }

    // Send confirmation email
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    if (userData?.user?.email) {
      const baseUrl = optionalConfig.appUrl || 'https://app.ato-optimizer.com';
      const emailResult = await sendPurchaseConfirmationEmail({
        to: userData.user.email,
        productType,
        amountPaid: priceAmount,
        dashboardUrl: `${baseUrl}/dashboard`,
      });
      if (!emailResult.success) {
        log.warn('Failed to send purchase confirmation email', { userId, error: emailResult.error });
      }
    } else {
      log.warn('Could not send purchase confirmation email - no email found', { userId });
    }
  } catch (error) {
    log.error('Error handling checkout completion', error);
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
    log.info('Payment succeeded', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      customer: paymentIntent.customer as string,
    });

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
        log.error('Error updating purchase with payment status', error);
      }
    }
  } catch (error) {
    log.error('Error handling payment succeeded', error);
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
    log.error('Payment failed', undefined, {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      customer: paymentIntent.customer as string,
      lastError: paymentIntent.last_payment_error?.message,
    });

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
        log.error('Error updating purchase with failure status', error);
      }
    }

    // Send payment failure email
    const userId = paymentIntent.metadata?.user_id;
    if (userId) {
      const supabaseForEmail = await createServiceClient();
      const { data: userData } = await supabaseForEmail.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        const baseUrl = optionalConfig.appUrl || 'https://app.ato-optimizer.com';
        const emailResult = await sendPaymentFailureEmail({
          to: userData.user.email,
          pricingUrl: `${baseUrl}/pricing`,
        });
        if (!emailResult.success) {
          log.warn('Failed to send payment failure email', { userId, error: emailResult.error });
        }
      }
    }
  } catch (error) {
    log.error('Error handling payment failed', error);
  }
}
