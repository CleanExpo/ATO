'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { ReactNode } from 'react'

interface HoloPanelProps extends Omit<HTMLMotionProps<'div'>, 'children' | 'title'> {
  /** Panel title */
  title?: ReactNode
  /** Subtitle or description */
  subtitle?: ReactNode
  /** Main content */
  children: ReactNode
  /** Show corner brackets (HUD style) */
  showCorners?: boolean
  /** Enable scanline animation */
  scanline?: boolean
  /** Animation delay */
  delay?: number
}

/**
 * HoloPanel - Premium holographic overlay panel
 *
 * Swiss Poster meets Sci-Fi Interface design.
 * Features gradient borders, corner brackets, and optional scanline effect.
 *
 * @example
 * <HoloPanel
 *   title="Tax Recovery Analysis"
 *   subtitle="FY2024-25 Opportunities"
 *   showCorners
 * >
 *   <div className="metric-block">
 *     <span className="metric-block__value">$485,200</span>
 *     <span className="metric-block__label">Potential Recovery</span>
 *   </div>
 * </HoloPanel>
 */
export function HoloPanel({
  title,
  subtitle,
  children,
  showCorners = true,
  scanline = false,
  delay = 0,
  className = '',
  ...motionProps
}: HoloPanelProps) {
  return (
    <motion.div
      className={`holo-panel ${scanline ? 'scanline' : ''} ${className}`.trim()}
      initial={{ opacity: 0, y: 40, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.23, 1, 0.32, 1],
      }}
      {...motionProps}
    >
      {showCorners && (
        <>
          <span className="holo-panel__corner holo-panel__corner--tl" />
          <span className="holo-panel__corner holo-panel__corner--tr" />
          <span className="holo-panel__corner holo-panel__corner--bl" />
          <span className="holo-panel__corner holo-panel__corner--br" />
        </>
      )}

      {(title || subtitle) && (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          {title && (
            <motion.h2
              className="typo-headline"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: delay + 0.2, duration: 0.5 }}
            >
              {title}
            </motion.h2>
          )}
          {subtitle && (
            <motion.p
              className="typo-subtitle"
              style={{ marginTop: 'var(--space-xs)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.4, duration: 0.5 }}
            >
              {subtitle}
            </motion.p>
          )}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.3, duration: 0.6 }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

/**
 * HoloPanelGrid - Asymmetrical grid container for HoloPanels
 */
interface HoloPanelGridProps {
  children: ReactNode
  /** Grid layout variant */
  layout?: '40-60' | '60-40' | '30-70' | 'equal'
  className?: string
}

export function HoloPanelGrid({
  children,
  layout = '40-60',
  className = ''
}: HoloPanelGridProps) {
  const layoutClass = layout === 'equal'
    ? 'layout-asymmetric'
    : `layout-asymmetric layout-asymmetric--${layout}`

  return (
    <div className={`${layoutClass} ${className}`.trim()}>
      {children}
    </div>
  )
}

/**
 * HoloPanelSkeleton - Loading state for HoloPanel
 */
export function HoloPanelSkeleton({ showCorners = true }: { showCorners?: boolean }) {
  return (
    <div className="holo-panel" style={{ opacity: 0.5 }}>
      {showCorners && (
        <>
          <span className="holo-panel__corner holo-panel__corner--tl" />
          <span className="holo-panel__corner holo-panel__corner--tr" />
          <span className="holo-panel__corner holo-panel__corner--bl" />
          <span className="holo-panel__corner holo-panel__corner--br" />
        </>
      )}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="skeleton" style={{ width: '40%', height: 32, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: '60%', height: 18 }} />
      </div>
      <div className="skeleton" style={{ width: '100%', height: 120 }} />
    </div>
  )
}
