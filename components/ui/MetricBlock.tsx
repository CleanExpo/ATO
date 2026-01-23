'use client'

import { motion } from 'framer-motion'
import { ReactNode, useEffect, useState, useRef } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface MetricBlockProps {
  /** The numeric value to display */
  value: number | string
  /** Label below the value */
  label: string
  /** Prefix (e.g., "$") */
  prefix?: string
  /** Suffix (e.g., "%") */
  suffix?: string
  /** Color variant */
  variant?: 'default' | 'positive' | 'negative' | 'highlight'
  /** Delta/change value */
  delta?: number
  /** Delta label */
  deltaLabel?: string
  /** Animate the number counting up */
  animate?: boolean
  /** Animation duration in ms */
  duration?: number
  /** Format as currency */
  currency?: boolean
  /** Animation delay */
  delay?: number
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

function formatNumber(value: number, currency: boolean = false): string {
  if (currency) {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }
  return new Intl.NumberFormat('en-AU').format(value)
}

/**
 * MetricBlock - Large number display with label
 *
 * For hero metrics and KPI displays. Uses monospace font
 * for tabular number alignment and optional count-up animation.
 *
 * @example
 * <MetricBlock
 *   value={485200}
 *   label="Potential Recovery"
 *   prefix="$"
 *   variant="positive"
 *   delta={12.5}
 *   animate
 * />
 */
export function MetricBlock({
  value,
  label,
  prefix = '',
  suffix = '',
  variant = 'default',
  delta,
  deltaLabel,
  animate = false,
  duration = 1500,
  currency = false,
  delay = 0,
}: MetricBlockProps) {
  const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value
  const [displayValue, setDisplayValue] = useState(animate ? 0 : numericValue)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!animate) {
      setDisplayValue(numericValue)
      return
    }

    const startAnimation = () => {
      startTimeRef.current = null

      const animateValue = (timestamp: number) => {
        if (startTimeRef.current === null) {
          startTimeRef.current = timestamp
        }

        const elapsed = timestamp - startTimeRef.current
        const progress = Math.min(elapsed / duration, 1)
        const easedProgress = easeOutExpo(progress)

        setDisplayValue(Math.floor(easedProgress * numericValue))

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animateValue)
        } else {
          setDisplayValue(numericValue)
        }
      }

      rafRef.current = requestAnimationFrame(animateValue)
    }

    const timeoutId = setTimeout(startAnimation, delay)

    return () => {
      clearTimeout(timeoutId)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [numericValue, animate, duration, delay])

  const variantClass = variant !== 'default' ? `metric-block__value--${variant}` : ''
  const formattedValue = currency
    ? formatNumber(displayValue, true)
    : `${prefix}${formatNumber(displayValue)}${suffix}`

  return (
    <motion.div
      className="metric-block"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: delay / 1000, ease: [0.23, 1, 0.32, 1] }}
    >
      <span className={`metric-block__value ${variantClass}`.trim()}>
        {formattedValue}
      </span>

      <span className="metric-block__label">{label}</span>

      {delta !== undefined && (
        <span className={`metric-block__delta ${delta >= 0 ? 'metric-block__delta--up' : 'metric-block__delta--down'}`}>
          {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(delta)}%
          {deltaLabel && <span style={{ marginLeft: 4, opacity: 0.7 }}>{deltaLabel}</span>}
        </span>
      )}
    </motion.div>
  )
}

/**
 * MetricRow - Horizontal row of metrics
 */
interface MetricRowProps {
  children: ReactNode
  className?: string
}

export function MetricRow({ children, className = '' }: MetricRowProps) {
  return (
    <div
      className={`layout-cluster ${className}`.trim()}
      style={{ gap: 'var(--space-2xl)' }}
    >
      {children}
    </div>
  )
}
