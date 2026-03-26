'use client'

/**
 * Dashboard — Billing
 *
 * Shows the current plan, purchase history, and a link to the Stripe
 * Customer Portal for self-service billing management.
 *
 * Design: Scientific Luxury — OLED black, spectral accents, rounded-sm, Framer Motion.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { CreditCard, Receipt, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PaymentRecord {
  id: string
  amount: number
  currency: string
  status: string
  product_type: string
  created_at: string
  stripe_payment_intent_id?: string
}

interface BillingState {
  loading: boolean
  error: string | null
  hasStripeCustomer: boolean
  currentPlan: string | null
  payments: PaymentRecord[]
  portalLoading: boolean
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatAmount(amount: number, currency: string): string {
  const symbol = currency.toUpperCase() === 'GBP' ? '£' : currency.toUpperCase() === 'NZD' ? 'NZ$' : 'A$'
  return `${symbol}${(amount / 100).toFixed(2)}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function planLabel(productType: string): string {
  if (productType === 'comprehensive') return 'Comprehensive Tax Audit'
  if (productType === 'core') return 'Core Tax Audit'
  if (productType === 'wholesale_accountant') return 'Wholesale Accountant'
  return productType
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function SectionHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="text-[#00F5FF]/60">{icon}</span>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">{children}</h2>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-8 text-center text-sm text-white/25">{message}</p>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function BillingPage() {
  const [state, setState] = useState<BillingState>({
    loading: true,
    error: null,
    hasStripeCustomer: false,
    currentPlan: null,
    payments: [],
    portalLoading: false,
  })

  const supabase = createClient()

  const fetchBillingData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setState((prev) => ({ ...prev, loading: false, error: 'Not authenticated' }))
        return
      }

      // Profile for Stripe customer ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .maybeSingle()

      // Payment history
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      const mostRecent = payments?.[0]

      setState((prev) => ({
        ...prev,
        loading: false,
        hasStripeCustomer: Boolean(profile?.stripe_customer_id),
        currentPlan: mostRecent?.product_type ?? null,
        payments: payments ?? [],
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: String(err),
      }))
    }
  }, [supabase])

  useEffect(() => {
    void fetchBillingData()
  }, [fetchBillingData])

  async function openPortal() {
    setState((prev) => ({ ...prev, portalLoading: true }))

    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: window.location.href }),
      })

      if (!res.ok) {
        const body = await res.json()
        setState((prev) => ({
          ...prev,
          portalLoading: false,
          error: body.message || 'Failed to open billing portal',
        }))
        return
      }

      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      setState((prev) => ({
        ...prev,
        portalLoading: false,
        error: String(err),
      }))
    }
  }

  // ── Render ──

  if (state.loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          className="h-6 w-6 rounded-full border-2 border-[#00F5FF] border-t-transparent"
        />
      </div>
    )
  }

  return (
    <div className="space-y-8 py-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Billing</h1>
        <p className="mt-1 text-sm text-white/40">
          Manage your plan and payment history.
        </p>
      </div>

      {/* Error banner */}
      {state.error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-sm border-[0.5px] border-[#FF4444]/30 bg-[#FF4444]/10 px-4 py-3 text-sm text-[#FF4444]"
        >
          {state.error}
        </motion.div>
      )}

      {/* Current Plan */}
      <div className="rounded-sm border-[0.5px] border-white/[0.06] bg-[#0a0a0a] p-6">
        <SectionHeading icon={<CreditCard size={14} />}>Current Plan</SectionHeading>

        {state.currentPlan ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-white">{planLabel(state.currentPlan)}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#00FF88]/70">
                <ShieldCheck size={11} />
                Active
              </p>
            </div>

            {state.hasStripeCustomer && (
              <motion.button
                type="button"
                onClick={() => void openPortal()}
                disabled={state.portalLoading}
                whileHover={{ scale: state.portalLoading ? 1 : 1.02 }}
                whileTap={{ scale: state.portalLoading ? 1 : 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="flex items-center gap-1.5 rounded-sm border-[0.5px] border-[#00F5FF]/30 bg-[#00F5FF]/10 px-4 py-2 text-sm text-[#00F5FF] hover:bg-[#00F5FF]/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state.portalLoading ? (
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <RefreshCw size={13} />
                  </motion.span>
                ) : (
                  <ExternalLink size={13} />
                )}
                Manage Billing
              </motion.button>
            )}
          </div>
        ) : (
          <div>
            <EmptyState message="No active plan. Purchase a plan to get started." />
            <div className="mt-2 flex justify-center">
              <Link
                href="/dashboard/pricing"
                className="rounded-sm border-[0.5px] border-[#00F5FF]/30 bg-[#00F5FF]/10 px-5 py-2.5 text-sm text-[#00F5FF] hover:bg-[#00F5FF]/20"
              >
                View Plans →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="rounded-sm border-[0.5px] border-white/[0.06] bg-[#0a0a0a] p-6">
        <SectionHeading icon={<Receipt size={14} />}>Payment History</SectionHeading>

        {state.payments.length === 0 ? (
          <EmptyState message="No payments on record." />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {state.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="text-sm text-white/80">{planLabel(payment.product_type)}</p>
                  <p className="mt-0.5 text-xs text-white/30">{formatDate(payment.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-sm border-[0.5px] px-2 py-0.5 text-[11px] ${
                      payment.status === 'succeeded' || payment.status === 'completed'
                        ? 'border-[#00FF88]/20 text-[#00FF88]/70'
                        : payment.status === 'pending'
                        ? 'border-[#FFB800]/20 text-[#FFB800]/70'
                        : 'border-[#FF4444]/20 text-[#FF4444]/70'
                    }`}
                  >
                    {payment.status}
                  </span>
                  <span className="text-sm font-medium text-white/70">
                    {formatAmount(payment.amount, payment.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* No plan — prompt */}
      {!state.currentPlan && (
        <div className="rounded-sm border-[0.5px] border-[#FFB800]/15 bg-[#FFB800]/[0.03] p-5">
          <p className="text-sm text-[#FFB800]/70">
            Need a hand getting started?{' '}
            <Link href="/onboarding" className="underline underline-offset-2 hover:text-[#FFB800]">
              Run the onboarding wizard
            </Link>{' '}
            to set up your organisation and choose a plan.
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-white/20">
        Payments processed securely by Stripe. ATO Tax Optimizer does not store card details.
        All prices in AUD unless otherwise stated.
      </p>
    </div>
  )
}
