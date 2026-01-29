'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { ReactNode } from 'react'

type Priority = 'critical' | 'high' | 'medium' | 'success' | 'info' | 'xero' | 'ai'

interface DataStripProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  /** Left side label content */
  label?: ReactNode
  /** Main content area */
  children: ReactNode
  /** Right side metric/value content */
  metric?: ReactNode
  /** Priority colour coding */
  priority?: Priority
  /** Enable hover animation */
  interactive?: boolean
  /** Animation delay for staggered lists */
  delay?: number
}

const priorityClasses: Record<Priority, string> = {
  critical: 'data-strip--critical',
  high: 'data-strip--high',
  medium: 'data-strip--medium',
  success: 'data-strip--success',
  info: 'data-strip--info',
  xero: 'data-strip--xero',
  ai: 'data-strip--ai',
}

/**
 * DataStrip - Primary information unit in Scientific Luxury design system
 *
 * Replaces traditional cards with horizontal information bands.
 * Inspired by Iron Man HUD - clean, data-focused, with subtle glow effects.
 *
 * @example
 * <DataStrip
 *   label={<span className="typo-label">R&D Expenditure</span>}
 *   metric={<span className="typo-data-lg">$234,500</span>}
 *   priority="success"
 * >
 *   <span className="typo-subtitle">Division 355 eligible activities</span>
 * </DataStrip>
 */
export function DataStrip({
  label,
  children,
  metric,
  priority,
  interactive = true,
  delay = 0,
  className = '',
  ...motionProps
}: DataStripProps) {
  const priorityClass = priority ? priorityClasses[priority] : ''

  return (
    <motion.div
      className={`data-strip ${priorityClass} ${className}`.trim()}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.23, 1, 0.32, 1], // motion-float
      }}
      whileHover={interactive ? { x: 4, transition: { duration: 0.2 } } : undefined}
      {...motionProps}
    >
      {label && (
        <div className="data-strip__label">
          {label}
        </div>
      )}

      <div className="data-strip__value">
        {children}
      </div>

      {metric && (
        <div className="data-strip__metric">
          {metric}
        </div>
      )}
    </motion.div>
  )
}

/**
 * DataStripGroup - Container for stacked DataStrips with proper spacing
 */
interface DataStripGroupProps {
  children: ReactNode
  className?: string
}

export function DataStripGroup({ children, className = '' }: DataStripGroupProps) {
  return (
    <div className={`layout-stack ${className}`.trim()}>
      {children}
    </div>
  )
}

/**
 * DataStripSkeleton - Loading state for DataStrip
 */
export function DataStripSkeleton() {
  return (
    <div className="data-strip" style={{ opacity: 0.5 }}>
      <div className="data-strip__label">
        <div className="skeleton" style={{ width: 80, height: 12 }} />
      </div>
      <div className="data-strip__value">
        <div className="skeleton" style={{ width: '60%', height: 16 }} />
      </div>
      <div className="data-strip__metric">
        <div className="skeleton" style={{ width: 100, height: 24 }} />
      </div>
    </div>
  )
}
