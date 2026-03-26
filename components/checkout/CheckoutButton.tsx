'use client'

/**
 * CheckoutButton — Stripe Checkout Redirect
 *
 * Calls /api/checkout/create to get a session ID, then redirects
 * the user to Stripe's hosted checkout page.
 *
 * Uses the Scientific Luxury design system: OLED black, spectral accents,
 * Framer Motion animations, rounded-sm corners.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { redirectToCheckout } from '@/lib/stripe/client-side'

interface CheckoutButtonProps {
  productType: 'comprehensive' | 'core' | 'wholesale_accountant'
  wholesaleTier?: 'standard' | 'professional' | 'enterprise'
  label?: string
  className?: string
  variant?: 'primary' | 'secondary'
}

export function CheckoutButton({
  productType,
  wholesaleTier,
  label = 'Get Started',
  className = '',
  variant = 'primary',
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCheckout = async () => {
    setLoading(true)
    setError(null)

    const errorMessage = await redirectToCheckout(productType, wholesaleTier)

    if (errorMessage) {
      setError(errorMessage)
      setLoading(false)
    }
    // If no error, user is being redirected to Stripe — don't reset loading
  }

  const baseStyles =
    variant === 'primary'
      ? 'bg-[#00F5FF]/10 border-[#00F5FF]/30 text-[#00F5FF] hover:bg-[#00F5FF]/20 hover:border-[#00F5FF]/50'
      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.button
        onClick={handleCheckout}
        disabled={loading}
        whileHover={{ scale: loading ? 1 : 1.02 }}
        whileTap={{ scale: loading ? 1 : 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={`
          relative w-full rounded-sm border-[0.5px] px-6 py-3
          text-sm font-medium tracking-wide
          transition-colors duration-200
          disabled:cursor-not-allowed disabled:opacity-50
          ${baseStyles}
          ${className}
        `}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent"
            />
            Processing...
          </span>
        ) : (
          label
        )}
      </motion.button>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-[#FF4444]"
        >
          {error}
        </motion.p>
      )}
    </div>
  )
}
