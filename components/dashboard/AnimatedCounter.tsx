/**
 * Animated Counter Component - Scientific Luxury Tier
 *
 * Smooth number animation using requestAnimationFrame
 * - JetBrains Mono monospace font for tabular figures
 * - Configurable duration and easing
 * - Prefix/suffix support for currency, percentages
 * - Color coding for positive/negative values
 * - Physics-based animation with mass
 */

'use client'

import React, { useEffect, useState, useRef } from 'react'

interface AnimatedCounterProps {
  value: number
  duration?: number // Animation duration in ms (default 800)
  prefix?: string // e.g., "$" or "#"
  suffix?: string // e.g., "k" or "%"
  decimals?: number // Number of decimal places
  variant?: 'default' | 'positive' | 'negative' | 'highlight' | 'warning' | 'success' // Color variant
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' // Size variant
  className?: string
  format?: 'number' | 'currency' | 'compact' // Formatting style
  label?: string // Optional label below value
  colorOverride?: string // Custom color override (CSS variable or hex)
}

// Easing function with mass - feels like physical movement
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

// Size to CSS class mapping
const sizeClasses = {
  sm: 'typo-data',
  md: 'typo-data-lg',
  lg: 'typo-data-xl',
  xl: 'typo-display',
  '2xl': 'typo-display',
}

const sizeFontSizes = {
  sm: '1rem',
  md: '2rem',
  lg: 'clamp(2.5rem, 6vw, 4rem)',
  xl: 'clamp(3rem, 8vw, 5rem)',
  '2xl': 'clamp(4rem, 10vw, 6rem)',
}

// Variant to color mapping
const variantColors = {
  default: 'var(--text-primary)',
  positive: 'var(--color-success)',
  negative: 'var(--color-error)',
  highlight: 'var(--accent-primary)',
  warning: 'var(--color-warning)',
  success: 'var(--color-success)',
}

export default function AnimatedCounter({
  value,
  duration = 800,
  prefix = '',
  suffix = '',
  decimals = 0,
  variant = 'default',
  size = 'lg',
  className = '',
  format = 'number',
  label,
  colorOverride,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const [isInitialized, setIsInitialized] = useState(false)
  const frameRef = useRef<number | undefined>(undefined)
  const startTimeRef = useRef<number | undefined>(undefined)
  const startValueRef = useRef(0)

  useEffect(() => {
    // Initialize with current value on mount without animation
    if (!isInitialized) {
      setDisplayValue(value)
      setIsInitialized(true)
      return
    }

    // Start animation when value changes
    startValueRef.current = displayValue
    startTimeRef.current = undefined

    const animate = (currentTime: number) => {
      if (startTimeRef.current === undefined) {
        startTimeRef.current = currentTime
      }

      const elapsed = currentTime - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Apply easing with physics-like feel
      const easedProgress = easeOutExpo(progress)

      // Calculate current value
      const currentValue =
        startValueRef.current + (value - startValueRef.current) * easedProgress

      setDisplayValue(currentValue)

      // Continue animation if not complete
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }

    frameRef.current = requestAnimationFrame(animate)

    // Cleanup
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, isInitialized])

  // Format the display value
  const formatValue = (val: number): string => {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(val)
    }

    if (format === 'compact') {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(decimals)}M`
      }
      if (val >= 1000) {
        return `${(val / 1000).toFixed(decimals)}k`
      }
    }

    return val.toFixed(decimals)
  }

  const formattedValue = formatValue(displayValue)

  // Determine color based on colorOverride, variant, or auto-detect
  const textColor = colorOverride
    ? colorOverride
    : variant === 'default'
      ? (value > 0 ? variantColors.positive : value < 0 ? variantColors.negative : variantColors.default)
      : variantColors[variant]

  return (
    <div className={`metric-block ${className}`.trim()}>
      <span
        className={sizeClasses[size]}
        style={{
          color: textColor,
          fontSize: sizeFontSizes[size],
          fontWeight: 200,
          letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {prefix}
        {formattedValue}
        {suffix}
      </span>

      {label && (
        <span className="typo-label" style={{ marginTop: 'var(--space-xs)' }}>
          {label}
        </span>
      )}
    </div>
  )
}
