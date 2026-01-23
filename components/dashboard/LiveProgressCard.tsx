/**
 * Live Progress Card Component
 *
 * Enhanced with Framer Motion for smooth animations:
 * - Spring physics for progress bar
 * - AnimatePresence for entry/exit
 * - Animated counter with easing
 * - Hover micro-interactions
 * - Pulsing glow when active
 */

'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ANIMATION_PRESETS } from '@/lib/operations/types'

interface LiveProgressCardProps {
  title: string
  value: number // Current value
  total: number // Total target
  percentage: number // 0-100
  icon: React.ReactNode
  color?: 'blue' | 'green' | 'orange' | 'purple'
  subtitle?: string
  eta?: string
  isAnimating?: boolean
  className?: string
}

const colorClasses = {
  blue: {
    gradient: 'from-sky-500 to-blue-500',
    border: 'border-sky-500/50',
    bg: 'bg-sky-500/10',
    text: 'text-sky-500',
    glow: 'shadow-sky-500/20',
    hex: '#0ea5e9'
  },
  green: {
    gradient: 'from-emerald-500 to-green-500',
    border: 'border-emerald-500/50',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    glow: 'shadow-emerald-500/20',
    hex: '#10b981'
  },
  orange: {
    gradient: 'from-amber-500 to-orange-500',
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    glow: 'shadow-amber-500/20',
    hex: '#f59e0b'
  },
  purple: {
    gradient: 'from-purple-500 to-violet-500',
    border: 'border-purple-500/50',
    bg: 'bg-purple-500/10',
    text: 'text-purple-500',
    glow: 'shadow-purple-500/20',
    hex: '#8b5cf6'
  }
}

export default function LiveProgressCard({
  title,
  value,
  total,
  percentage,
  icon,
  color = 'blue',
  subtitle,
  eta,
  isAnimating = false,
  className = ''
}: LiveProgressCardProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const colors = colorClasses[color]

  // Smooth value animation with easing
  useEffect(() => {
    const startValue = displayValue
    const diff = value - startValue
    const duration = 500
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
  }, [value])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', ...ANIMATION_PRESETS.spring.gentle }}
      whileHover={{ scale: 1.01 }}
      className={`glass-card p-6 relative overflow-hidden ${
        isAnimating ? `border-2 ${colors.border} ${colors.glow} shadow-lg` : ''
      } ${className}`}
    >
      {/* Animated background gradient overlay when active */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.05 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`absolute inset-0 bg-gradient-to-br ${colors.gradient}`}
          />
        )}
      </AnimatePresence>

      {/* Animated border glow */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            className="absolute inset-0 rounded-2xl"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0.3, 0.6, 0.3],
              boxShadow: [
                `0 0 20px ${colors.hex}30`,
                `0 0 40px ${colors.hex}50`,
                `0 0 20px ${colors.hex}30`
              ]
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div
              className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center`}
              animate={isAnimating ? {
                scale: [1, 1.05, 1],
              } : {}}
              transition={{
                duration: 1.5,
                repeat: isAnimating ? Infinity : 0,
                ease: 'easeInOut'
              }}
            >
              <div className={colors.text}>{icon}</div>
            </motion.div>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
              {subtitle && (
                <motion.p
                  key={subtitle}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-[var(--text-muted)] mt-0.5"
                >
                  {subtitle}
                </motion.p>
              )}
            </div>
          </div>
        </div>

        {/* Counter */}
        <div className="mb-3">
          <div className="flex items-baseline gap-2">
            <motion.span
              key={displayValue}
              className={`text-3xl font-bold ${colors.text}`}
            >
              {displayValue.toLocaleString()}
            </motion.span>
            <span className="text-lg text-[var(--text-secondary)]">
              / {total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2 overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r ${colors.gradient} rounded-full relative overflow-hidden`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
              transition={{ type: 'spring', ...ANIMATION_PRESETS.spring.gentle }}
            >
              {/* Shimmer effect on active progress */}
              {isAnimating && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'linear'
                  }}
                />
              )}
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-sm">
          <motion.span
            className={`font-semibold ${colors.text}`}
            key={percentage.toFixed(1)}
          >
            {percentage.toFixed(1)}%
          </motion.span>
          <AnimatePresence mode="wait">
            {eta && (
              <motion.span
                key={eta}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-[var(--text-muted)]"
              >
                ETA: {eta}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Pulse ring animation when actively processing */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            className="absolute -top-1 -right-1"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
          >
            <motion.div
              className={`w-3 h-3 rounded-full ${colors.bg}`}
              animate={{
                scale: [1, 2, 1],
                opacity: [0.7, 0, 0.7]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeOut'
              }}
            />
            <div
              className={`w-3 h-3 rounded-full absolute top-0 right-0`}
              style={{ backgroundColor: colors.hex }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
