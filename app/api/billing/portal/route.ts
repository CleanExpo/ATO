/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session for self-service billing management.
 * Users can update payment methods, view invoices, and manage their subscription.
 *
 * Auth: Requires authenticated user
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { optionalConfig, sharedConfig } from '@/lib/config/env'
import { createErrorResponse } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const log = createLogger('api:billing:portal')

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get return URL from request body (optional)
    let returnUrl: string
    try {
      const body = await request.json()
      returnUrl = body.returnUrl || ''
    } catch {
      returnUrl = ''
    }

    const baseUrl = optionalConfig.appUrl || sharedConfig.baseUrl
    const resolvedReturnUrl = returnUrl || `${baseUrl}/dashboard/billing`

    // Look up the Stripe customer ID from the profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, organization_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      log.error('Failed to fetch profile for billing portal', { userId: user.id })
      return createErrorResponse(
        new Error('Failed to fetch user profile'),
        { userId: user.id },
        500
      )
    }

    if (!profile.stripe_customer_id) {
      return NextResponse.json(
        {
          error: 'No billing account found',
          message: 'You do not have an active billing account. Please purchase a plan first.',
        },
        { status: 404 }
      )
    }

    // Create Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: resolvedReturnUrl,
    })

    log.info('Billing portal session created', {
      userId: user.id,
      customerId: profile.stripe_customer_id,
    })

    return NextResponse.json({
      url: session.url,
    })
  } catch (error) {
    log.error('Billing portal error:', String(error))
    return createErrorResponse(
      error as Error,
      { operation: 'create_portal_session' },
      500
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/billing/portal',
    description: 'Creates a Stripe Customer Portal session for self-service billing',
  })
}
