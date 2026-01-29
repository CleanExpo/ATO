/**
 * Reset Password Page - v8.1 Visual Authority Standard
 *
 * Scientific Luxury Design System with Glassmorphism
 */

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Lock, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Design Tokens ───────────────────────────────────────────────────

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
} as const

const EASING = [0.19, 1, 0.22, 1] as const

// ─── Reset Password Page ─────────────────────────────────────────────

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const supabase = createClient()

  useEffect(() => {
    // Check if user has valid recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setError('Invalid or expired reset link. Please request a new password reset.')
      }
    })
  }, [supabase.auth])

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!password) {
      errors.password = 'Password is required'
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    } else if (!/(?=.*[a-z])/.test(password)) {
      errors.password = 'Password must contain at least one lowercase letter'
    } else if (!/(?=.*[A-Z])/.test(password)) {
      errors.password = 'Password must contain at least one uppercase letter'
    } else if (!/(?=.*\d)/.test(password)) {
      errors.password = 'Password must contain at least one number'
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    if (!validateForm()) {
      return
    }

    try {
      setLoading(true)
      setError('')

      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) throw error

      setSuccess(true)

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/auth/login')
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to reset password')
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
            {success ? 'Password Reset!' : 'Set New Password'}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-white/60 font-light"
          >
            {success
              ? 'Your password has been successfully reset'
              : 'Choose a strong password for your account'}
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

          {/* Success State */}
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-full border-[0.5px] mb-6"
                style={{
                  borderColor: `${SPECTRAL.emerald}50`,
                  backgroundColor: `${SPECTRAL.emerald}10`,
                  boxShadow: `0 0 40px ${SPECTRAL.emerald}30`,
                }}
              >
                <CheckCircle className="w-8 h-8" style={{ color: SPECTRAL.emerald }} />
              </div>

              <p className="text-lg text-white/90 font-light mb-2">Password Successfully Reset</p>
              <p className="text-sm text-white/60 font-light mb-6">
                You can now sign in with your new password
              </p>

              <Link
                href="/auth/login"
                className="inline-block px-8 py-3 rounded-sm text-sm uppercase tracking-[0.2em] font-semibold transition-all duration-300 hover:scale-[1.02]"
                style={{
                  color: '#050505',
                  backgroundColor: SPECTRAL.emerald,
                  boxShadow: `0 0 40px ${SPECTRAL.emerald}30`,
                }}
              >
                Go to Login
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-6">
              {/* New Password */}
              <div>
                <label className="block text-xs text-white/60 mb-2 font-light tracking-wide">
                  NEW PASSWORD
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3.5 rounded-sm border-[0.5px] bg-transparent text-white/90 text-sm font-light placeholder:text-white/30 focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{
                      borderColor: validationErrors.password
                        ? `${SPECTRAL.red}50`
                        : 'rgba(255, 255, 255, 0.1)',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = `${SPECTRAL.cyan}50`
                      e.target.style.boxShadow = `0 0 20px ${SPECTRAL.cyan}20`
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = validationErrors.password
                        ? `${SPECTRAL.red}50`
                        : 'rgba(255, 255, 255, 0.1)'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>
                {validationErrors.password && (
                  <p className="mt-1 text-xs" style={{ color: SPECTRAL.red }}>
                    {validationErrors.password}
                  </p>
                )}
                <p className="mt-2 text-xs text-white/40 font-light">
                  At least 8 characters with uppercase, lowercase, and numbers
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs text-white/60 mb-2 font-light tracking-wide">
                  CONFIRM NEW PASSWORD
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3.5 rounded-sm border-[0.5px] bg-transparent text-white/90 text-sm font-light placeholder:text-white/30 focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{
                      borderColor: validationErrors.confirmPassword
                        ? `${SPECTRAL.red}50`
                        : 'rgba(255, 255, 255, 0.1)',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = `${SPECTRAL.cyan}50`
                      e.target.style.boxShadow = `0 0 20px ${SPECTRAL.cyan}20`
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = validationErrors.confirmPassword
                        ? `${SPECTRAL.red}50`
                        : 'rgba(255, 255, 255, 0.1)'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>
                {validationErrors.confirmPassword && (
                  <p className="mt-1 text-xs" style={{ color: SPECTRAL.red }}>
                    {validationErrors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Reset Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 px-6 py-4 rounded-sm text-sm uppercase tracking-[0.2em] font-semibold transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: `${SPECTRAL.cyan}50`,
                  color: '#050505',
                  backgroundColor: SPECTRAL.cyan,
                  boxShadow: `0 0 40px ${SPECTRAL.cyan}30`,
                }}
              >
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>
          )}
        </motion.div>

        {/* Back to Login */}
        {!success && (
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
        )}

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
