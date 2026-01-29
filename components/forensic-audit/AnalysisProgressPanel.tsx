/**
 * Analysis Progress Panel
 *
 * Enhanced progress display with batch tracking, time estimates,
 * and live statistics. Scientific Luxury design system.
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlatformBadge, type Platform } from '@/components/ui/PlatformBadge'

// ─── Types ───────────────────────────────────────────────────────────

export interface BatchInfo {
  number: number
  total: number
  transactionsInBatch: number
  successCount: number
  failureCount: number
}

export interface TimeEstimate {
  startedAt: Date | null
  elapsedMs: number
  remainingMs: number | null
  averageBatchTimeMs: number | null
}

export interface LiveStats {
  totalAnalyzed: number
  rndCandidates: number
  totalDeductions: number
  division7aItems: number
}

export interface BatchActivity {
  timestamp: Date
  batchNumber: number
  analyzedCount: number
  success: boolean
  duration: number
}

export interface AnalysisProgressPanelProps {
  stage: 'idle' | 'syncing' | 'analyzing' | 'complete' | 'error'
  platform?: Platform
  overallProgress: number
  syncProgress?: number
  batch: BatchInfo | null
  timeEstimate: TimeEstimate
  stats: LiveStats
  recentBatches: BatchActivity[]
  error?: string | null
  onMinimize?: () => void
  isMinimized?: boolean
}

// ─── Design Tokens ───────────────────────────────────────────────────

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
  magenta: '#FF00FF',
  grey: '#6B7280',
} as const

const EASING = {
  outExpo: [0.19, 1, 0.22, 1] as const,
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`
  }
  return `$${amount.toFixed(0)}`
}

// ─── Animated Counter ────────────────────────────────────────────────

function AnimatedCounter({ value, prefix = '', suffix = '' }: {
  value: number
  prefix?: string
  suffix?: string
}) {
  const [displayValue, setDisplayValue] = useState(value)
  const prevValue = useRef(value)

  useEffect(() => {
    if (value === prevValue.current) return

    const duration = 500
    const startTime = Date.now()
    const startValue = prevValue.current
    const diff = value - startValue

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.round(startValue + diff * eased))

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        prevValue.current = value
      }
    }

    requestAnimationFrame(animate)
  }, [value])

  return (
    <span className="tabular-nums">
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  )
}

// ─── Circular Progress Ring ──────────────────────────────────────────

function ProgressRing({ progress, size = 120, strokeWidth = 6, colour }: {
  progress: number
  size?: number
  strokeWidth?: number
  colour: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Background ring */}
      <svg className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colour}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            filter: `drop-shadow(0 0 10px ${colour}60)`,
          }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          key={Math.round(progress)}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-3xl font-light tabular-nums"
          style={{ color: colour }}
        >
          {Math.round(progress)}%
        </motion.span>
      </div>
    </div>
  )
}

// ─── Breathing Orb ───────────────────────────────────────────────────

function BreathingOrb({ colour, size = 'sm' }: { colour: string; size?: 'xs' | 'sm' | 'md' }) {
  const sizes = { xs: 'h-4 w-4', sm: 'h-6 w-6', md: 'h-8 w-8' }
  const dotSizes = { xs: 'h-1 w-1', sm: 'h-1.5 w-1.5', md: 'h-2 w-2' }

  return (
    <motion.div
      className={`${sizes[size]} flex items-center justify-center rounded-full border-[0.5px]`}
      style={{
        borderColor: `${colour}50`,
        backgroundColor: `${colour}10`,
        boxShadow: `0 0 20px ${colour}40`,
      }}
    >
      <motion.div
        className={`${dotSizes[size]} rounded-full`}
        style={{ backgroundColor: colour }}
        animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  )
}

// ─── Component ───────────────────────────────────────────────────────

export function AnalysisProgressPanel({
  stage,
  platform = 'xero',
  overallProgress,
  syncProgress,
  batch,
  timeEstimate,
  stats,
  recentBatches,
  error,
  onMinimize,
  isMinimized = false,
}: AnalysisProgressPanelProps) {
  const [elapsed, setElapsed] = useState(timeEstimate.elapsedMs)

  // Update elapsed time every second
  useEffect(() => {
    if (stage !== 'syncing' && stage !== 'analyzing') return

    const interval = setInterval(() => {
      if (timeEstimate.startedAt) {
        setElapsed(Date.now() - timeEstimate.startedAt.getTime())
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [stage, timeEstimate.startedAt])

  // Sync elapsed from prop
  useEffect(() => {
    setElapsed(timeEstimate.elapsedMs)
  }, [timeEstimate.elapsedMs])

  const platformLabel = {
    xero: 'Xero',
    myob: 'MYOB',
    quickbooks: 'QuickBooks',
  }[platform]

  const stageLabel = {
    idle: 'Ready',
    syncing: `Syncing ${platformLabel} Data`,
    analyzing: `Analyzing ${platformLabel} Data`,
    complete: 'Complete',
    error: 'Error',
  }[stage]

  const stageColour = {
    idle: SPECTRAL.grey,
    syncing: SPECTRAL.cyan,
    analyzing: SPECTRAL.magenta,
    complete: SPECTRAL.emerald,
    error: SPECTRAL.red,
  }[stage]

  // Minimized view
  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed bottom-6 right-6 z-50 p-3 border-[0.5px] rounded-sm cursor-pointer backdrop-blur-xl"
        style={{
          borderColor: `${stageColour}30`,
          backgroundColor: 'rgba(5,5,5,0.95)',
        }}
        onClick={onMinimize}
      >
        <div className="flex items-center gap-3">
          <ProgressRing progress={overallProgress} size={48} strokeWidth={4} colour={stageColour} />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: stageColour }}>
                {stageLabel}
              </p>
              <PlatformBadge platform={platform} size="sm" />
            </div>
            {timeEstimate.remainingMs && (
              <p className="text-xs text-white/40 mt-0.5">
                ~{formatDuration(timeEstimate.remainingMs)} left
              </p>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.4, ease: EASING.outExpo }}
      className="w-full max-w-2xl p-4 md:p-6 border-[0.5px] border-white/[0.08] rounded-sm backdrop-blur-xl"
      style={{ backgroundColor: 'rgba(5,5,5,0.9)' }}
    >
      {/* Header with minimize button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BreathingOrb colour={stageColour} size="sm" />
          <div className="flex items-center gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Analysis Progress</p>
              <p className="text-sm font-medium" style={{ color: stageColour }}>{stageLabel}</p>
            </div>
            <PlatformBadge platform={platform} size="sm" showIcon />
          </div>
        </div>
        {onMinimize && (
          <button
            onClick={onMinimize}
            className="p-2 text-white/30 hover:text-white/60 transition-colors"
            title="Minimize"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Main Progress Section - Stacked vertically */}
      <div className="flex flex-col items-center gap-6 mb-6">
        {/* Batch Info - Centered above ring */}
        <div className="text-center">
          {batch && (
            <>
              <p className="text-xs text-white/40 mb-1">Current Batch</p>
              <p className="text-lg font-light text-white">
                <AnimatedCounter value={batch.number} /> of <AnimatedCounter value={batch.total} />
              </p>
              {batch.transactionsInBatch > 0 && (
                <p className="text-xs text-white/30 mt-1">
                  Processing {batch.transactionsInBatch} transactions
                </p>
              )}
              {(batch.successCount > 0 || batch.failureCount > 0) && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-xs" style={{ color: SPECTRAL.emerald }}>
                    {batch.successCount} ok
                  </span>
                  {batch.failureCount > 0 && (
                    <span className="text-xs" style={{ color: SPECTRAL.red }}>
                      {batch.failureCount} failed
                    </span>
                  )}
                </div>
              )}
            </>
          )}
          {!batch && stage === 'syncing' && (
            <p className="text-sm text-white/50">Syncing {platformLabel} historical data...</p>
          )}
        </div>

        {/* Circular Progress - Centered below */}
        <ProgressRing
          progress={stage === 'syncing' ? (syncProgress || 0) : overallProgress}
          size={120}
          strokeWidth={6}
          colour={stageColour}
        />
      </div>

      {/* Time Estimates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 p-3 rounded-sm" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
        <div>
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-1">Started</p>
          <p className="text-sm font-mono text-white/60">
            {timeEstimate.startedAt ? formatTime(timeEstimate.startedAt) : '--:--:--'}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-1">Elapsed</p>
          <p className="text-sm font-mono text-white/60">
            {formatDuration(elapsed)}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-1">Remaining</p>
          <p className="text-sm font-mono" style={{ color: timeEstimate.remainingMs ? SPECTRAL.cyan : 'rgba(255,255,255,0.3)' }}>
            {timeEstimate.remainingMs ? `~${formatDuration(timeEstimate.remainingMs)}` : 'Calculating...'}
          </p>
        </div>
      </div>

      {/* Live Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
        <div className="text-center p-2 rounded-sm" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <p className="text-lg font-light" style={{ color: SPECTRAL.cyan }}>
            <AnimatedCounter value={stats.totalAnalyzed} />
          </p>
          <p className="text-[8px] uppercase tracking-[0.15em] text-white/30">Analyzed</p>
        </div>
        <div className="text-center p-2 rounded-sm" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <p className="text-lg font-light" style={{ color: SPECTRAL.magenta }}>
            <AnimatedCounter value={stats.rndCandidates} />
          </p>
          <p className="text-[8px] uppercase tracking-[0.15em] text-white/30">R&D</p>
        </div>
        <div className="text-center p-2 rounded-sm" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <p className="text-lg font-light" style={{ color: SPECTRAL.emerald }}>
            {formatCurrency(stats.totalDeductions)}
          </p>
          <p className="text-[8px] uppercase tracking-[0.15em] text-white/30">Deductions</p>
        </div>
        <div className="text-center p-2 rounded-sm" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <p className="text-lg font-light" style={{ color: SPECTRAL.red }}>
            <AnimatedCounter value={stats.division7aItems} />
          </p>
          <p className="text-[8px] uppercase tracking-[0.15em] text-white/30">Div 7A</p>
        </div>
      </div>

      {/* Recent Activity Feed */}
      {recentBatches.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-2">Recent Activity</p>
          <div className="max-h-40 md:max-h-48 overflow-y-auto space-y-1">
            <AnimatePresence initial={false}>
              {recentBatches.slice(0, 5).map((activity, idx) => (
                <motion.div
                  key={`${activity.batchNumber}-${activity.timestamp.getTime()}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2, delay: idx * 0.05 }}
                  className="flex items-center gap-2 text-xs py-1 px-2 rounded-sm"
                  style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                >
                  <span className="font-mono text-white/30 text-[10px]">
                    {formatTime(activity.timestamp)}
                  </span>
                  <span className="text-white/50">
                    Batch {activity.batchNumber}
                  </span>
                  <span style={{ color: activity.success ? SPECTRAL.emerald : SPECTRAL.red }}>
                    {activity.analyzedCount} analyzed
                  </span>
                  <span className="text-white/20 text-[10px]">
                    ({(activity.duration / 1000).toFixed(1)}s)
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          className="mt-4 p-3 rounded-sm border-[0.5px] text-sm"
          style={{
            borderColor: `${SPECTRAL.red}30`,
            backgroundColor: `${SPECTRAL.red}08`,
            color: SPECTRAL.red,
          }}
        >
          {error}
        </div>
      )}

      {/* Background Operation Notice */}
      <div className="mt-4 pt-4 border-t border-white/[0.04] flex items-center justify-between">
        <p className="text-[10px] text-white/30">
          Process runs in background. Safe to navigate away.
        </p>
        {timeEstimate.startedAt && (
          <p className="text-[10px] text-white/20">
            Last update: {Math.round((Date.now() - timeEstimate.startedAt.getTime()) / 1000) % 10}s ago
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Exports ─────────────────────────────────────────────────────────

export default AnalysisProgressPanel
