/**
 * Forgot Password Page - v8.1 Visual Authority Standard
 *
 * Scientific Luxury Design System with Glassmorphism
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Design Tokens ───────────────────────────────────────────────────

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
} as const

const EASING = [0.19, 1, 0.22, 1] as const

// ─── Forgot Password Page ────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const supabase = createClient()

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setLoading(true)
      setError('')
      setSuccess(false)

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) throw error

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email')
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
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-extralight tracking-tight text-white mb-3"
          >
            Reset Password
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-white/60 font-light"
          >
            Enter your email to receive a password reset link
          </motion.p>
        </div>

        {/* Glassmorphic Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.6, ease: EASING }}
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

          {/* Success Message */}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-5 rounded-sm border-[0.5px]"
              style={{
                borderColor: `${SPECTRAL.emerald}50`,
                backgroundColor: `${SPECTRAL.emerald}10`,
              }}
            >
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 mt-0.5" style={{ color: SPECTRAL.emerald }} />
                <div>
                  <p className="text-sm font-medium text-white/95 mb-1">Check your email</p>
                  <p className="text-sm text-white/70 font-light">
                    We've sent a password reset link to <strong>{email}</strong>. Click the link in
                    the email to reset your password.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {!success && (
            <form onSubmit={handlePasswordReset} className="space-y-6">
              {/* Email Input */}
              <div>
                <label className="block text-xs text-white/60 mb-2 font-light tracking-wide">
                  EMAIL ADDRESS
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="your@email.com"
                    className="w-full pl-12 pr-4 py-3.5 rounded-sm border-[0.5px] bg-transparent text-white/90 text-sm font-light placeholder:text-white/30 focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      boxShadow: `0 0 0 0px ${SPECTRAL.cyan}00`,
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = `${SPECTRAL.cyan}50`
                      e.target.style.boxShadow = `0 0 20px ${SPECTRAL.cyan}20`
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                      e.target.style.boxShadow = `0 0 0 0px ${SPECTRAL.cyan}00`
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-white/40 font-light">
                  You'll receive an email with instructions to reset your password
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-4 rounded-sm text-sm uppercase tracking-[0.2em] font-semibold transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                style={{
                  borderColor: `${SPECTRAL.cyan}50`,
                  color: '#050505',
                  backgroundColor: SPECTRAL.cyan,
                  boxShadow: `0 0 40px ${SPECTRAL.cyan}30`,
                }}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}

          {/* Try Again Button (shown after success) */}
          {success && (
            <button
              onClick={() => {
                setSuccess(false)
                setEmail('')
              }}
              className="w-full mt-4 px-6 py-3 rounded-sm text-sm font-light text-white/70 transition-all duration-300 hover:text-white hover:border-white/20"
              style={{
                borderWidth: '0.5px',
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              Try another email
            </button>
          )}
        </motion.div>

        {/* Back to Login */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-8 text-sm text-white/60 font-light"
        >
          Remember your password?{' '}
          <Link
            href="/auth/login"
            className="font-medium hover:text-white transition-colors"
            style={{ color: SPECTRAL.cyan }}
          >
            Sign In
          </Link>
        </motion.p>

        {/* Back to Home */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
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
