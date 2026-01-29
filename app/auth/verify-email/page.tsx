/**
 * Verify Email Page - v8.1 Visual Authority Standard
 *
 * Scientific Luxury Design System with Glassmorphism
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, CheckCircle, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'

// ─── Design Tokens ───────────────────────────────────────────────────

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
} as const

const EASING = [0.19, 1, 0.22, 1] as const

// ─── Verify Email Page ───────────────────────────────────────────────

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resent, setResent] = useState(false)

  const supabase = createClient()

  const handleResendEmail = async () => {
    if (!email) {
      setError('Email address not found')
      return
    }

    try {
      setLoading(true)
      setError('')
      setResent(false)

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      })

      if (error) throw error

      setResent(true)
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{ background: '#050505' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASING }}
        className="w-full max-w-md"
      >
        {/* Logo/Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6, ease: EASING }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full border-[0.5px] mb-6"
            style={{
              borderColor: `${SPECTRAL.emerald}50`,
              backgroundColor: `${SPECTRAL.emerald}10`,
              boxShadow: `0 0 60px ${SPECTRAL.emerald}30`,
            }}
          >
            <Mail className="w-10 h-10" style={{ color: SPECTRAL.emerald }} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-4xl font-extralight tracking-tight text-white mb-3"
          >
            Check Your Email
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-sm text-white/60 font-light max-w-sm mx-auto"
          >
            We've sent a verification link to{' '}
            {email && <span className="text-white font-medium">{email}</span>}
          </motion.p>
        </div>

        {/* Glassmorphic Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.6, ease: EASING }}
          className="p-8 rounded-sm border-[0.5px]"
          style={{
            borderColor: `${SPECTRAL.cyan}50`,
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            backdropFilter: 'blur(20px)',
            boxShadow: `0 0 60px ${SPECTRAL.cyan}15`,
          }}
        >
          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-sm border-[0.5px]"
              style={{
                borderColor: `${SPECTRAL.red}50`,
                backgroundColor: `${SPECTRAL.red}10`,
              }}
            >
              <p className="text-sm text-white/90">{error}</p>
            </motion.div>
          )}

          {/* Success Message (Resent) */}
          {resent && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-sm border-[0.5px]"
              style={{
                borderColor: `${SPECTRAL.emerald}50`,
                backgroundColor: `${SPECTRAL.emerald}10`,
              }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" style={{ color: SPECTRAL.emerald }} />
                <p className="text-sm text-white/90">Verification email sent successfully!</p>
              </div>
            </motion.div>
          )}

          {/* Instructions */}
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <div
                className="mt-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                style={{
                  backgroundColor: `${SPECTRAL.cyan}20`,
                  color: SPECTRAL.cyan,
                }}
              >
                1
              </div>
              <p className="text-sm text-white/70 font-light">
                Open the email we sent to <strong className="text-white">{email || 'your address'}</strong>
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div
                className="mt-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                style={{
                  backgroundColor: `${SPECTRAL.cyan}20`,
                  color: SPECTRAL.cyan,
                }}
              >
                2
              </div>
              <p className="text-sm text-white/70 font-light">
                Click the verification link in the email
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div
                className="mt-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                style={{
                  backgroundColor: `${SPECTRAL.cyan}20`,
                  color: SPECTRAL.cyan,
                }}
              >
                3
              </div>
              <p className="text-sm text-white/70 font-light">
                You'll be automatically signed in and redirected to your dashboard
              </p>
            </div>
          </div>

          {/* Resend Email Button */}
          <button
            onClick={handleResendEmail}
            disabled={loading || !email}
            className="w-full px-6 py-3.5 rounded-sm border-[0.5px] text-sm font-light text-white/90 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              borderColor: 'rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
            }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Sending...' : 'Resend Verification Email'}
          </button>

          {/* Help Text */}
          <p className="mt-6 text-xs text-white/40 font-light text-center">
            Didn't receive the email? Check your spam folder or click the button above to resend.
          </p>
        </motion.div>

        {/* Back to Login */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center mt-8 text-sm text-white/60 font-light"
        >
          Wrong email address?{' '}
          <Link
            href="/auth/signup"
            className="font-medium hover:text-white transition-colors"
            style={{ color: SPECTRAL.cyan }}
          >
            Sign Up Again
          </Link>
        </motion.p>

        {/* Back to Home */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-6"
        >
          <Link
            href="/"
            className="text-xs text-white/40 hover:text-white/60 transition-colors font-light tracking-wide"
          >
            ← Back to Home
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )
}
