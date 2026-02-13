'use client'

/**
 * EvidenceScoreIndicator
 *
 * Visual indicator showing evidence sufficiency score with colour-coded
 * progress bar and level label.
 *
 * Scientific Luxury design system.
 * Division 355 ITAA 1997 - R&D evidence sufficiency tracking.
 */

import { motion } from 'framer-motion'
import { getScoreLevel, type ScoreLevel } from '@/lib/types/rnd-evidence'

interface EvidenceScoreIndicatorProps {
  score: number
  label?: string
  showLabel?: boolean
  showPercentage?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'bar' | 'circular'
  className?: string
}

export function EvidenceScoreIndicator({
  score,
  label,
  showLabel = true,
  showPercentage = true,
  size = 'md',
  variant = 'bar',
  className = '',
}: EvidenceScoreIndicatorProps) {
  const scoreConfig = getScoreLevel(score)
  const clampedScore = Math.max(0, Math.min(100, score))

  const sizeStyles = {
    sm: { height: 'h-1', text: 'text-xs', padding: 'py-1' },
    md: { height: 'h-2', text: 'text-sm', padding: 'py-2' },
    lg: { height: 'h-3', text: 'text-base', padding: 'py-3' },
  }

  const styles = sizeStyles[size]

  if (variant === 'circular') {
    return (
      <CircularIndicator
        score={clampedScore}
        scoreConfig={scoreConfig}
        label={label}
        showLabel={showLabel}
        showPercentage={showPercentage}
        size={size}
        className={className}
      />
    )
  }

  return (
    <div className={`${className}`}>
      {/* Label row */}
      {(label || showLabel) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className={`${styles.text} font-medium`} style={{ color: 'var(--text-primary)' }}>
              {label}
            </span>
          )}
          <div className="flex items-center gap-2">
            {showPercentage && (
              <span className={`${styles.text} font-medium`} style={{ color: scoreConfig.color }}>
                {clampedScore}%
              </span>
            )}
            {showLabel && (
              <span
                className={`${styles.text} px-2 py-0.5 rounded`}
                style={{
                  background: scoreConfig.bgColor,
                  color: scoreConfig.color,
                  border: `0.5px solid ${scoreConfig.borderColor}`,
                }}
              >
                {scoreConfig.label}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div
        className={`w-full ${styles.height} rounded-full overflow-hidden`}
        style={{ background: 'rgba(255, 255, 255, 0.1)' }}
      >
        <motion.div
          className={`${styles.height} rounded-full`}
          style={{ backgroundColor: scoreConfig.color }}
          initial={{ width: 0 }}
          animate={{ width: `${clampedScore}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

/**
 * Circular score indicator variant
 */
function CircularIndicator({
  score,
  scoreConfig,
  label,
  showLabel,
  showPercentage,
  size,
  className,
}: {
  score: number
  scoreConfig: { color: string; label: string; bgColor: string; borderColor: string }
  label?: string
  showLabel: boolean
  showPercentage: boolean
  size: 'sm' | 'md' | 'lg'
  className: string
}) {
  const sizeConfig = {
    sm: { diameter: 48, strokeWidth: 4, textSize: 'text-xs' },
    md: { diameter: 64, strokeWidth: 5, textSize: 'text-sm' },
    lg: { diameter: 80, strokeWidth: 6, textSize: 'text-base' },
  }

  const config = sizeConfig[size]
  const radius = (config.diameter - config.strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="relative" style={{ width: config.diameter, height: config.diameter }}>
        {/* Background circle */}
        <svg
          className="absolute inset-0"
          width={config.diameter}
          height={config.diameter}
          viewBox={`0 0 ${config.diameter} ${config.diameter}`}
        >
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={config.strokeWidth}
          />
        </svg>

        {/* Progress circle */}
        <svg
          className="absolute inset-0 -rotate-90"
          width={config.diameter}
          height={config.diameter}
          viewBox={`0 0 ${config.diameter} ${config.diameter}`}
        >
          <motion.circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke={scoreConfig.color}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>

        {/* Center text */}
        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`${config.textSize} font-bold`} style={{ color: scoreConfig.color }}>
              {score}
            </span>
          </div>
        )}
      </div>

      {/* Label below */}
      {(label || showLabel) && (
        <div className="text-center">
          {label && (
            <p className={`${config.textSize} font-medium`} style={{ color: 'var(--text-primary)' }}>
              {label}
            </p>
          )}
          {showLabel && (
            <p className={`${config.textSize}`} style={{ color: scoreConfig.color }}>
              {scoreConfig.label}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Compact score badge for inline use
 */
export function EvidenceScoreBadge({
  score,
  className = '',
}: {
  score: number
  className?: string
}) {
  const scoreConfig = getScoreLevel(score)

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${className}`}
      style={{
        background: scoreConfig.bgColor,
        color: scoreConfig.color,
        border: `0.5px solid ${scoreConfig.borderColor}`,
      }}
    >
      <span>{score}%</span>
      <span style={{ color: 'var(--text-muted)' }}>|</span>
      <span>{scoreConfig.label}</span>
    </span>
  )
}

export default EvidenceScoreIndicator
