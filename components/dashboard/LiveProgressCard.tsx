/**
 * Live Progress Card Component
 *
 * Animated progress card with:
 * - Smooth animated progress bar
 * - Animated counter showing current/total
 * - Pulse animation when actively processing
 * - Color-coded border glow
 * - ETA display with countdown
 * - Glassmorphism design matching theme
 */

'use client'

import React, { useEffect, useState } from 'react'

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
    text: 'text-sky-400',
    glow: 'shadow-sky-500/20'
  },
  green: {
    gradient: 'from-emerald-500 to-green-500',
    border: 'border-emerald-500/50',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/20'
  },
  orange: {
    gradient: 'from-amber-500 to-orange-500',
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20'
  },
  purple: {
    gradient: 'from-purple-500 to-pink-500',
    border: 'border-purple-500/50',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    glow: 'shadow-purple-500/20'
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

  // Animate value changes
  useEffect(() => {
    const startValue = displayValue
    const diff = value - startValue
    const duration = 500 // 500ms animation
    const steps = 30
    const stepValue = diff / steps
    const stepDuration = duration / steps

    let currentStep = 0
    const timer = setInterval(() => {
      currentStep++
      if (currentStep <= steps) {
        setDisplayValue(prev => Math.round(prev + stepValue))
      } else {
        setDisplayValue(value)
        clearInterval(timer)
      }
    }, stepDuration)

    return () => clearInterval(timer)
  }, [value])

  return (
    <div
      className={`glass-card p-6 relative overflow-hidden ${
        isAnimating ? `border-2 ${colors.border} ${colors.glow} shadow-lg animate-pulse` : ''
      } ${className}`}
    >
      {/* Background gradient overlay when animating */}
      {isAnimating && (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-5 animate-pulse`}
        />
      )}

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center`}>
              <div className={colors.text}>{icon}</div>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
              {subtitle && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
        </div>

        {/* Counter */}
        <div className="mb-3">
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${colors.text}`}>
              {displayValue.toLocaleString()}
            </span>
            <span className="text-lg text-[var(--text-secondary)]">
              / {total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${colors.gradient} rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-sm">
          <span className={`font-semibold ${colors.text}`}>
            {percentage.toFixed(1)}%
          </span>
          {eta && (
            <span className="text-[var(--text-muted)]">
              ETA: {eta}
            </span>
          )}
        </div>
      </div>

      {/* Pulse ring animation when actively processing */}
      {isAnimating && (
        <div className="absolute -top-2 -right-2">
          <div className={`w-4 h-4 rounded-full ${colors.bg} animate-ping`} />
          <div className={`w-4 h-4 rounded-full ${colors.bg} absolute top-0 right-0`} />
        </div>
      )}
    </div>
  )
}
