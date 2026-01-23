/**
 * Live Progress Card Component - Scientific Luxury Tier
 *
 * HUD-inspired progress tracking with:
 * - Data strip styling with left accent border
 * - Minimal 2px progress line
 * - JetBrains Mono typography for data
 * - Physics-based spring animations
 * - Scanline effect when processing
 */

'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface LiveProgressCardProps {
  title: string
  value: number // Current value
  total: number // Total target
  percentage: number // 0-100
  icon: React.ReactNode
  color?: 'xero' | 'ai' | 'success' | 'high' | 'info'
  subtitle?: string
  eta?: string
  isAnimating?: boolean
  className?: string
}

const colorConfig = {
  xero: {
    accent: 'var(--accent-xero)',
    dim: 'var(--accent-xero-dim)',
    glow: 'rgba(19, 181, 234, 0.4)',
  },
  ai: {
    accent: 'var(--accent-ai)',
    dim: 'var(--accent-ai-dim)',
    glow: 'rgba(191, 90, 242, 0.4)',
  },
  success: {
    accent: 'var(--signal-success)',
    dim: 'var(--signal-success-glow)',
    glow: 'rgba(48, 209, 88, 0.4)',
  },
  high: {
    accent: 'var(--signal-high)',
    dim: 'var(--signal-high-glow)',
    glow: 'rgba(255, 149, 0, 0.4)',
  },
  info: {
    accent: 'var(--signal-info)',
    dim: 'var(--signal-info-glow)',
    glow: 'rgba(100, 210, 255, 0.4)',
  },
}

export default function LiveProgressCard({
  title,
  value,
  total,
  percentage,
  icon,
  color = 'xero',
  subtitle,
  eta,
  isAnimating = false,
  className = ''
}: LiveProgressCardProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const colors = colorConfig[color]

  // Smooth value animation with easing
  useEffect(() => {
    const startValue = displayValue
    const diff = value - startValue
    const duration = 600
    const startTime = performance.now()

    // Ease out expo for natural deceleration
    const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easeOutExpo(progress)

      setDisplayValue(Math.round(startValue + diff * easedProgress))

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.5,
        ease: [0.23, 1, 0.32, 1],
      }}
      className={`data-strip ${className}`}
      style={{
        borderLeftColor: colors.accent,
        padding: 'var(--space-lg)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated glow overlay when active */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(90deg, ${colors.dim} 0%, transparent 40%)`,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Scanline effect when processing */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            initial={{ top: 0 }}
            animate={{ top: '100%' }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: '2px',
              background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)`,
              opacity: 0.5,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%' }}>
        {/* Header Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            {/* Icon */}
            <motion.div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: colors.dim,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.accent,
              }}
              animate={isAnimating ? {
                scale: [1, 1.05, 1],
              } : {}}
              transition={{
                duration: 1.5,
                repeat: isAnimating ? Infinity : 0,
                ease: 'easeInOut'
              }}
            >
              {icon}
            </motion.div>

            {/* Title & Subtitle */}
            <div>
              <h3 className="typo-label-md" style={{ color: 'var(--lumen-100)', textTransform: 'none', letterSpacing: '0' }}>
                {title}
              </h3>
              {subtitle && (
                <motion.p
                  key={subtitle}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="typo-label"
                  style={{ marginTop: 2 }}
                >
                  {subtitle}
                </motion.p>
              )}
            </div>
          </div>

          {/* Pulse indicator */}
          <AnimatePresence>
            {isAnimating && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                style={{ position: 'relative' }}
              >
                <motion.div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: colors.accent,
                  }}
                  animate={{
                    boxShadow: [
                      `0 0 0 0 ${colors.glow}`,
                      `0 0 0 8px transparent`,
                    ],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Counter Row */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
          <span
            className="typo-data-lg"
            style={{
              color: colors.accent,
              fontWeight: 300,
            }}
          >
            {displayValue.toLocaleString()}
          </span>
          <span className="typo-data" style={{ color: 'var(--lumen-50)' }}>
            / {total.toLocaleString()}
          </span>
        </div>

        {/* Progress Line */}
        <div className="progress-line" style={{ marginBottom: 'var(--space-sm)' }}>
          <motion.div
            className={`progress-line__fill ${isAnimating ? 'progress-line__fill--animated' : ''}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
            transition={{
              duration: 0.6,
              ease: [0.23, 1, 0.32, 1],
            }}
            style={{ background: colors.accent }}
          />
        </div>

        {/* Footer Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="typo-data" style={{ color: colors.accent }}>
            {percentage.toFixed(1)}%
          </span>
          <AnimatePresence mode="wait">
            {eta && (
              <motion.span
                key={eta}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="typo-label"
              >
                ETA {eta}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
