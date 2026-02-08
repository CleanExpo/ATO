/**
 * Stripe Client Configuration
 *
 * Handles Stripe API integration for payment processing
 * - Checkout session creation
 * - Subscription management
 * - Customer management
 */

import Stripe from 'stripe';

/**
 * Lazy-initialize Stripe client with secret key
 * This prevents build errors when STRIPE_SECRET_KEY is not available
 */
let stripeInstance: Stripe | null = null;

function getStripeInstance(): Stripe {
  if (!stripeInstance) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY not configured. Payment processing unavailable.');
    }
    stripeInstance = new Stripe(apiKey, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
      appInfo: {
        name: 'ATO Tax Optimizer',
        version: '1.0.0',
        url: 'https://ato-optimizer.com.au',
      },
    });
  }
  return stripeInstance;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Proxy pattern requires dynamic property access
    return (getStripeInstance() as any)[prop];
  },
});

/**
 * Product pricing configuration
 * Prices are in cents (AUD)
 */
export const PRICING_CONFIG = {
  comprehensive: {
    id: 'price_comprehensive',
    name: 'Comprehensive Tax Audit',
    description:
      'Full forensic analysis across all tax categories (R&D, deductions, losses, Div 7A)',
    price: 99500, // $995.00 AUD
    currency: 'aud',
    type: 'one_time' as const,
    includesOrganizations: 1, // Includes 1 organization
  },
  core: {
    id: 'price_core',
    name: 'Core Tax Assessment',
    description: 'R&D Tax Incentive analysis and general deductions review',
    price: 49500, // $495.00 AUD
    currency: 'aud',
    type: 'one_time' as const,
    includesOrganizations: 1, // Includes 1 organization
  },
  wholesale_accountant: {
    id: 'price_wholesale_accountant',
    name: 'Wholesale Accountant Pricing',
    description: 'Variable pricing based on accountant tier (15-35% discount)',
    basePrice: 99500, // Base price before discount
    currency: 'aud',
    type: 'one_time' as const,
    includesOrganizations: 1, // Includes 1 organization
  },
  additional_organization: {
    id: 'price_additional_organization',
    name: 'Additional Organization License',
    description: 'Add another organization to your existing license',
    price: 19900, // $199.00 AUD per additional organization
    currency: 'aud',
    type: 'one_time' as const,
  },
} as const;

/**
 * License types corresponding to purchase tiers
 */
export type LicenseType = 'comprehensive' | 'core' | 'wholesale_accountant' | 'additional_organization';

/**
 * Calculate accountant wholesale pricing with tier discount
 *
 * @param tier - Accountant pricing tier
 * @param baseProduct - Base product (comprehensive or core)
 * @returns Discounted price in cents
 */
export function calculateWholesalePrice(
  tier: 'standard' | 'professional' | 'enterprise',
  baseProduct: 'comprehensive' | 'core'
): number {
  const basePrice = PRICING_CONFIG[baseProduct].price;

  const discountRates = {
    standard: 0.15, // 15% discount
    professional: 0.25, // 25% discount
    enterprise: 0.35, // 35% discount
  };

  const discount = discountRates[tier];
  return Math.round(basePrice * (1 - discount));
}

/**
 * Create a Stripe customer or retrieve existing customer
 *
 * @param email - Customer email address
 * @param metadata - Additional customer metadata (e.g., user_id, organization_id)
 * @returns Stripe customer object
 */
export async function createOrRetrieveCustomer(
  email: string,
  metadata: Record<string, string>
): Promise<Stripe.Customer> {
  // Check if customer already exists
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    // Update metadata if customer exists
    return await stripe.customers.update(existingCustomers.data[0].id, {
      metadata,
    });
  }

  // Create new customer
  return await stripe.customers.create({
    email,
    metadata,
  });
}

/**
 * Format price from cents to AUD display string
 *
 * @param cents - Price in cents
 * @returns Formatted price string (e.g., "$995.00")
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(cents / 100);
}

/**
 * Verify webhook signature to ensure request is from Stripe
 *
 * @param payload - Raw request body
 * @param signature - Stripe signature header
 * @param secret - Webhook secret from Stripe dashboard
 * @returns Parsed webhook event
 * @throws Error if signature verification fails
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Webhook signature verification failed: ${message}`);
  }
}
