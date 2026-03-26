/**
 * Cookie Consent Banner
 *
 * Client component. Scientific Luxury design system.
 * Fixed to the bottom of the viewport. Uses localStorage
 * to persist the user's choice ('accepted' | 'rejected').
 * Framer Motion slide-up entrance and exit animations.
 */

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Cookie, X } from 'lucide-react'

// ─── Design Tokens ───────────────────────────────────────────────────

const SPECTRAL = {
  cyan: '#00F5FF',
} as const

const EASING = [0.19, 1, 0.22, 1] as const

const STORAGE_KEY = 'cookie-consent'

// ─── Component ───────────────────────────────────────────────────────

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const consent = localStorage.getItem(STORAGE_KEY)
      if (!consent) {
        setVisible(true)
      }
    } catch {
      // localStorage unavailable — show banner as fallback
      setVisible(true)
    }
  }, [])

  const handleConsent = (value: 'accepted' | 'rejected') => {
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Silently fail if localStorage is unavailable
    }
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.6, ease: EASING }}
          className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6"
          role="dialog"
          aria-label="Cookie consent"
        >
          <div
            className="max-w-3xl mx-auto p-5 sm:p-6 border-[0.5px] rounded-sm"
            style={{
              background: 'rgba(10, 10, 10, 0.95)',
              borderColor: 'rgba(255, 255, 255, 0.06)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 -4px 40px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              {/* Icon + Text */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <Cookie
                  className="w-4 h-4 flex-shrink-0 mt-0.5"
                  style={{ color: SPECTRAL.cyan }}
                />
                <div>
                  <p className="text-sm text-white/70 leading-relaxed font-light">
                    We use <strong className="text-white/90 font-medium">essential cookies</strong> for
                    authentication and core functionality. Optional analytics cookies help us improve the
                    platform.{' '}
                    <Link
                      href="/privacy#cookies"
                      className="underline underline-offset-2 hover:text-white/90"
                      style={{ color: SPECTRAL.cyan }}
                    >
                      Learn more
                    </Link>
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto">
                <button
                  onClick={() => handleConsent('rejected')}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-sm text-[11px] uppercase tracking-[0.15em] font-medium text-white/50 border-[0.5px] border-white/[0.08] hover:text-white/70 hover:border-white/[0.15]"
                  style={{ background: 'rgba(255, 255, 255, 0.02)' }}
                >
                  Essential Only
                </button>
                <button
                  onClick={() => handleConsent('accepted')}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-sm text-[11px] uppercase tracking-[0.15em] font-semibold border-[0.5px]"
                  style={{
                    background: SPECTRAL.cyan,
                    color: '#050505',
                    borderColor: `${SPECTRAL.cyan}50`,
                    boxShadow: `0 0 30px ${SPECTRAL.cyan}20`,
                  }}
                >
                  Accept All
                </button>
              </div>

              {/* Close (dismiss = essential only) */}
              <button
                onClick={() => handleConsent('rejected')}
                className="absolute top-3 right-3 sm:static p-1 text-white/20 hover:text-white/40"
                aria-label="Dismiss cookie banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
