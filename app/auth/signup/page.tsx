/**
 * Signup Page - v8.1 Visual Authority Standard
 *
 * Scientific Luxury Design System with Glassmorphism
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Chrome, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Design Tokens ───────────────────────────────────────────────────

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
} as const

const EASING = [0.19, 1, 0.22, 1] as const

// ─── Signup Page ─────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const supabase = createClient()

  // Validation
  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!firstName.trim()) errors.firstName = 'First name is required'
    if (!lastName.trim()) errors.lastName = 'Last name is required'

    if (!email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Invalid email format'
    }

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

    if (!acceptedTerms) {
      errors.terms = 'You must accept the terms and conditions'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleGoogleSignUp = async () => {
    try {
      setLoading(true)
      setError('')

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      })

      if (error) throw error
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign up with Google')
      setLoading(false)
    }
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    if (!validateForm()) {
      return
    }

    try {
      setLoading(true)
      setError('')

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })

      if (error) throw error

      // Show success message or redirect to verification page
      router.push('/auth/verify-email')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign up')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex justify-center" style={{ background: '#050505' }}>
      <div className="max-w-[1920px] w-full">
        <div className="min-h-screen flex items-center justify-center px-6 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASING }}
            className="w-full max-w-md"
          >
            {/* Logo/Header */}
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.8, ease: EASING }}
              >
                <p className="text-[11px] uppercase tracking-[0.4em] text-white/40 mb-8 font-medium">
                  Get Started
                </p>
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.8, ease: EASING }}
                className="text-4xl md:text-5xl font-extralight tracking-tight text-white mb-4 leading-tight"
              >
                Create Account
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8, ease: EASING }}
                className="text-base text-white/60 font-light"
              >
                Start optimizing your tax position today
              </motion.p>
            </div>

            {/* Glassmorphic Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.8, ease: EASING }}
              className="p-10 rounded-sm border-[0.5px]"
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

              {/* Google Sign Up */}
              <button
                onClick={handleGoogleSignUp}
                disabled={loading}
                className="w-full mb-8 px-10 py-5 rounded-sm border-[0.5px] text-[12px] uppercase tracking-[0.2em] font-medium text-white/90 transition-all duration-300 hover:scale-105 hover:text-white hover:border-white/[0.3] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                style={{
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                }}
              >
                <Chrome className="w-4 h-4" />
                Continue with Google
              </button>

              {/* Divider */}
              <div className="relative mb-8">
                <div className="absolute inset-0 flex items-center">
                  <div
                    className="w-full border-t-[0.5px]"
                    style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
                  />
                </div>
                <div className="relative flex justify-center">
                  <span
                    className="px-5 text-[11px] uppercase tracking-[0.2em] text-white/30 font-light"
                    style={{ background: 'rgba(5, 5, 5, 0.98)' }}
                  >
                    or continue with email
                  </span>
                </div>
              </div>

              {/* Signup Form */}
              <form onSubmit={handleEmailSignUp} className="space-y-6">
                {/* Name Fields Row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* First Name */}
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.2em] text-white/50 mb-3 font-light">
                      First Name
                    </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="John"
                  className="w-full px-4 py-3.5 rounded-sm border-[0.5px] bg-transparent text-white/90 text-sm font-light placeholder:text-white/30 focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  style={{
                    borderColor: validationErrors.firstName
                      ? `${SPECTRAL.red}50`
                      : 'rgba(255, 255, 255, 0.1)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = `${SPECTRAL.cyan}50`
                    e.target.style.boxShadow = `0 0 20px ${SPECTRAL.cyan}20`
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = validationErrors.firstName
                      ? `${SPECTRAL.red}50`
                      : 'rgba(255, 255, 255, 0.1)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
                {validationErrors.firstName && (
                  <p className="mt-1 text-xs" style={{ color: SPECTRAL.red }}>
                    {validationErrors.firstName}
                  </p>
                )}
              </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.2em] text-white/50 mb-3 font-light">
                      Last Name
                    </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Doe"
                  className="w-full px-4 py-3.5 rounded-sm border-[0.5px] bg-transparent text-white/90 text-sm font-light placeholder:text-white/30 focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  style={{
                    borderColor: validationErrors.lastName
                      ? `${SPECTRAL.red}50`
                      : 'rgba(255, 255, 255, 0.1)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = `${SPECTRAL.cyan}50`
                    e.target.style.boxShadow = `0 0 20px ${SPECTRAL.cyan}20`
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = validationErrors.lastName
                      ? `${SPECTRAL.red}50`
                      : 'rgba(255, 255, 255, 0.1)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
                {validationErrors.lastName && (
                  <p className="mt-1 text-xs" style={{ color: SPECTRAL.red }}>
                    {validationErrors.lastName}
                  </p>
                )}
              </div>
            </div>

                {/* Email Input */}
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.2em] text-white/50 mb-3 font-light">
                    Email Address
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
                    borderColor: validationErrors.email
                      ? `${SPECTRAL.red}50`
                      : 'rgba(255, 255, 255, 0.1)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = `${SPECTRAL.cyan}50`
                    e.target.style.boxShadow = `0 0 20px ${SPECTRAL.cyan}20`
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = validationErrors.email
                      ? `${SPECTRAL.red}50`
                      : 'rgba(255, 255, 255, 0.1)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>
              {validationErrors.email && (
                <p className="mt-1 text-xs" style={{ color: SPECTRAL.red }}>
                  {validationErrors.email}
                </p>
              )}
            </div>

                {/* Password Input */}
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.2em] text-white/50 mb-3 font-light">
                    Password
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
                  <label className="block text-[11px] uppercase tracking-[0.2em] text-white/50 mb-3 font-light">
                    Confirm Password
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

            {/* Terms Acceptance */}
            <div className="flex items-start gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAcceptedTerms(!acceptedTerms)}
                className="mt-0.5 w-5 h-5 rounded-sm border-[0.5px] flex items-center justify-center transition-all"
                style={{
                  borderColor: validationErrors.terms
                    ? `${SPECTRAL.red}50`
                    : acceptedTerms
                    ? `${SPECTRAL.emerald}50`
                    : 'rgba(255, 255, 255, 0.2)',
                  backgroundColor: acceptedTerms ? `${SPECTRAL.emerald}20` : 'transparent',
                }}
              >
                {acceptedTerms && <Check className="w-3.5 h-3.5" style={{ color: SPECTRAL.emerald }} />}
              </button>
              <label className="text-xs text-white/70 font-light leading-relaxed">
                I accept the{' '}
                <Link
                  href="/legal/terms"
                  className="underline hover:text-white transition-colors"
                  style={{ color: SPECTRAL.cyan }}
                >
                  Terms & Conditions
                </Link>{' '}
                and{' '}
                <Link
                  href="/legal/privacy"
                  className="underline hover:text-white transition-colors"
                  style={{ color: SPECTRAL.cyan }}
                >
                  Privacy Policy
                </Link>
              </label>
            </div>
            {validationErrors.terms && (
              <p className="text-xs" style={{ color: SPECTRAL.red }}>
                {validationErrors.terms}
              </p>
            )}

                {/* Sign Up Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-8 px-10 py-5 rounded-sm text-[12px] uppercase tracking-[0.2em] font-semibold border-[0.5px] transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: `${SPECTRAL.cyan}50`,
                    color: '#050505',
                    backgroundColor: SPECTRAL.cyan,
                    boxShadow: `0 0 60px ${SPECTRAL.cyan}30`,
                  }}
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            </motion.div>

            {/* Login Link */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.8 }}
              className="text-center mt-10 text-sm text-white/60 font-light"
            >
              Already have an account?{' '}
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
              transition={{ delay: 0.8, duration: 0.8 }}
              className="text-center mt-8"
            >
              <Link
                href="/"
                className="text-[11px] uppercase tracking-[0.2em] text-white/30 hover:text-white/50 transition-colors font-light"
              >
                ← Back to Home
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
