/**
 * Stripe Client-Side Integration
 *
 * Singleton Stripe.js instance for frontend checkout and payment element usage.
 * Uses @stripe/stripe-js (loaded lazily to avoid SSR issues).
 *
 * SECURITY: Only the publishable key is used client-side. The secret key
 * never leaves the server (lib/stripe/client.ts).
 */

import { loadStripe } from '@stripe/stripe-js'
import type { Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null> | null = null

/**
 * Get or create a singleton Stripe.js instance.
 *
 * Uses NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY from environment.
 * Returns null if the key is not configured (allows build without Stripe).
 *
 * @example
 * const stripe = await getStripe()
 * if (stripe) {
 *   // Use stripe instance for payment elements, etc.
 * }
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

    if (!publishableKey) {
      console.warn('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY not set — Stripe checkout disabled')
      stripePromise = Promise.resolve(null)
    } else {
      stripePromise = loadStripe(publishableKey)
    }
  }

  return stripePromise
}

/**
 * Redirect to Stripe Checkout.
 *
 * Calls the /api/checkout/create endpoint to create a session,
 * then redirects the user to Stripe's hosted checkout page.
 *
 * @param productType - 'comprehensive' | 'core' | 'wholesale_accountant'
 * @param wholesaleTier - Required if productType is 'wholesale_accountant'
 * @returns Error message if checkout fails, undefined if redirect succeeds
 */
export async function redirectToCheckout(
  productType: 'comprehensive' | 'core' | 'wholesale_accountant',
  wholesaleTier?: 'standard' | 'professional' | 'enterprise'
): Promise<string | undefined> {
  try {
    // Create checkout session via API
    const response = await fetch('/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productType,
        wholesaleTier,
        successUrl: `${window.location.origin}/dashboard?checkout=success`,
        cancelUrl: `${window.location.origin}/dashboard/pricing?checkout=cancelled`,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return errorData.error || 'Failed to create checkout session'
    }

    const { sessionId, url } = await response.json()

    // Redirect to Stripe Checkout
    // Stripe.js v9+ removed redirectToCheckout — use the session URL directly
    if (url) {
      window.location.href = url
      return undefined
    }

    // Fallback: use Stripe.js to construct checkout URL from session ID
    const stripe = await getStripe()
    if (!stripe) {
      return 'Stripe is not configured. Please contact support.'
    }

    // redirectToCheckout was removed in @stripe/stripe-js v9;
    // cast to access the method if running an older runtime bundle
    const stripeAny = stripe as unknown as {
      redirectToCheckout?: (opts: { sessionId: string }) => Promise<{ error?: { message?: string } }>
    }
    if (typeof stripeAny.redirectToCheckout === 'function') {
      const { error } = await stripeAny.redirectToCheckout({ sessionId })
      if (error) {
        return error.message || 'Checkout redirect failed'
      }
      return undefined
    }

    return 'Checkout redirect not available. Please try again.'
  } catch (err) {
    return `Checkout error: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}
