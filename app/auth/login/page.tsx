/**
 * Login Page - v8.1 Visual Authority Standard
 *
 * Scientific Luxury Design System with Glassmorphism
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mail, Lock, Chrome } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Design Tokens ───────────────────────────────────────────────────

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
} as const

const EASING = [0.19, 1, 0.22, 1] as const

// ─── Login Page ──────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  const handleGoogleSignIn = async () => {
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
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google')
      setLoading(false)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setLoading(true)
      setError('')

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Redirect to dashboard on success
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
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
            Welcome Back
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-white/60 font-light"
          >
            Sign in to access your tax optimization dashboard
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

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full mb-6 px-6 py-4 rounded-sm border-[0.5px] text-sm font-medium text-white/90 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            style={{
              borderColor: `${SPECTRAL.cyan}50`,
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
            }}
          >
            <Chrome className="w-5 h-5" />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div
                className="w-full border-t-[0.5px]"
                style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
              />
            </div>
            <div className="relative flex justify-center text-xs">
              <span
                className="px-4 text-white/40 font-light"
                style={{ background: 'rgba(5, 5, 5, 0.95)' }}
              >
                or continue with email
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailSignIn} className="space-y-5">
            {/* Email Input */}
            <div>
              <label className="block text-xs text-white/60 mb-2 font-light tracking-wide">
                EMAIL
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
                />
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
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-white/60 font-light tracking-wide">
                  PASSWORD
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs font-light hover:text-white transition-colors"
                  style={{ color: SPECTRAL.cyan }}
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="••••••••"
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
            </div>

            {/* Sign In Button */}
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
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </motion.div>

        {/* Sign Up Link */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-8 text-sm text-white/60 font-light"
        >
          Don't have an account?{' '}
          <Link
            href="/auth/signup"
            className="font-medium hover:text-white transition-colors"
            style={{ color: SPECTRAL.cyan }}
          >
            Sign Up
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
