/**
 * Animated Counter Component
 *
 * Smooth number animation using requestAnimationFrame
 * - Configurable duration and easing
 * - Prefix/suffix support for currency, percentages
 * - Color coding for positive/negative values
 * - Responsive font sizing
 */

'use client'

import React, { useEffect, useState, useRef } from 'react'

interface AnimatedCounterProps {
  value: number
  duration?: number // Animation duration in ms (default 500)
  prefix?: string // e.g., "$" or "#"
  suffix?: string // e.g., "k" or "%"
  decimals?: number // Number of decimal places
  color?: string // Text color class
  className?: string
  format?: 'number' | 'currency' | 'compact' // Formatting style
}

// Easing function for smooth animation
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

export default function AnimatedCounter({
  value,
  duration = 500,
  prefix = '',
  suffix = '',
  decimals = 0,
  color,
  className = '',
  format = 'number'
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

      // Apply easing
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

  // Determine color based on value if not specified
  const textColor =
    color ||
    (value > 0
      ? 'text-emerald-400'
      : value < 0
      ? 'text-red-400'
      : 'text-[var(--text-primary)]')

  return (
    <span className={`${textColor} ${className}`}>
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  )
}
