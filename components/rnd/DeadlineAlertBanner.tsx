'use client'

/**
 * DeadlineAlertBanner
 *
 * Sticky alert banner at top of R&D pages when deadline < 90 days.
 * Shows urgency levels with dismissible functionality.
 *
 * Scientific Luxury design system.
 * Division 355 ITAA 1997 - R&D Tax Incentive registration deadline alerts.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  type DeadlineUrgency,
  URGENCY_CONFIG,
  formatDeadlineDate,
  formatDaysUntilDeadline,
} from '@/lib/types/rnd-registration'

interface DeadlineData {
  financialYear: string
  deadlineDate: string
  daysUntilDeadline: number
  urgencyLevel: DeadlineUrgency
}

interface DeadlineAlertBannerProps {
  deadlines: DeadlineData[]
  onActionClick?: (financialYear: string) => void
  className?: string
}

// Local storage key for dismissed alerts
const DISMISSED_KEY = 'rnd_deadline_alerts_dismissed'

export function DeadlineAlertBanner({
  deadlines,
  onActionClick,
  className = '',
}: DeadlineAlertBannerProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, string>>({})
  const [isInitialized, setIsInitialized] = useState(false)

  // Load dismissed alerts from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Filter out dismissals older than 24 hours
        const now = new Date().getTime()
        const filtered: Record<string, string> = {}
        for (const [fy, timestamp] of Object.entries(parsed)) {
          if (now - new Date(timestamp as string).getTime() < 24 * 60 * 60 * 1000) {
            filtered[fy] = timestamp as string
          }
        }
        setDismissedAlerts(filtered)
        // Update localStorage with filtered values
        localStorage.setItem(DISMISSED_KEY, JSON.stringify(filtered))
      }
    } catch (e) {
      console.error('Failed to load dismissed alerts:', e)
    }
    setIsInitialized(true)
  }, [])

  // Get the most urgent non-dismissed deadline
  const urgentDeadlines = deadlines.filter((d) => {
    // Only show alerts for urgent (30 days), critical (7 days), or overdue
    if (d.urgencyLevel === 'open' || d.urgencyLevel === 'completed' || d.urgencyLevel === 'approaching') {
      return false
    }
    // Check if dismissed
    if (dismissedAlerts[d.financialYear]) {
      return false
    }
    return true
  })

  // Sort by urgency priority (most urgent first)
  urgentDeadlines.sort((a, b) => {
    const priorityA = URGENCY_CONFIG[a.urgencyLevel].priority
    const priorityB = URGENCY_CONFIG[b.urgencyLevel].priority
    return priorityB - priorityA
  })

  const mostUrgent = urgentDeadlines[0]

  // Handle dismiss
  const handleDismiss = (financialYear: string) => {
    const newDismissed = {
      ...dismissedAlerts,
      [financialYear]: new Date().toISOString(),
    }
    setDismissedAlerts(newDismissed)
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(newDismissed))
    } catch (e) {
      console.error('Failed to save dismissed alerts:', e)
    }
  }

  // Don't render until initialized (prevents hydration mismatch)
  if (!isInitialized) {
    return null
  }

  // Don't render if no urgent deadlines
  if (!mostUrgent) {
    return null
  }

  const urgencyConfig = URGENCY_CONFIG[mostUrgent.urgencyLevel]

  // Determine message based on urgency
  let message = ''
  let icon = ''
  if (mostUrgent.urgencyLevel === 'overdue') {
    message = `R&D registration deadline for ${mostUrgent.financialYear} has passed. Contact your tax advisor about late registration options.`
    icon = '!'
  } else if (mostUrgent.urgencyLevel === 'critical') {
    message = `CRITICAL: Only ${mostUrgent.daysUntilDeadline} days left to register ${mostUrgent.financialYear} R&D activities with AusIndustry.`
    icon = '!'
  } else if (mostUrgent.urgencyLevel === 'urgent') {
    message = `URGENT: ${mostUrgent.daysUntilDeadline} days remaining to register ${mostUrgent.financialYear} R&D activities. Deadline: ${formatDeadlineDate(mostUrgent.deadlineDate)}.`
    icon = '!'
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`rounded-sm overflow-hidden ${className}`}
        style={{
          background: urgencyConfig.bgColor,
          border: `0.5px solid ${urgencyConfig.borderColor}`,
        }}
      >
        <div className="flex items-center gap-4 p-4">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: urgencyConfig.color,
              color: '#050505',
            }}
          >
            <span className="text-lg font-bold">{icon}</span>
          </div>

          {/* Message */}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium"
              style={{ color: urgencyConfig.color }}
            >
              {message}
            </p>
            {urgentDeadlines.length > 1 && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                +{urgentDeadlines.length - 1} more deadline{urgentDeadlines.length > 2 ? 's' : ''} requiring attention
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {onActionClick && (
              <button
                onClick={() => onActionClick(mostUrgent.financialYear)}
                className="py-2 px-4 rounded text-sm font-medium transition-all hover:brightness-110"
                style={{
                  background: urgencyConfig.color,
                  color: '#050505',
                }}
              >
                Take Action
              </button>
            )}

            <button
              onClick={() => handleDismiss(mostUrgent.financialYear)}
              className="py-2 px-3 rounded text-sm transition-all hover:bg-white/10"
              style={{
                color: 'var(--text-muted)',
                border: '0.5px solid rgba(255,255,255,0.2)',
              }}
              title="Dismiss for 24 hours"
            >
              x
            </button>
          </div>
        </div>

        {/* Progress bar showing time urgency */}
        {mostUrgent.urgencyLevel !== 'overdue' && mostUrgent.daysUntilDeadline > 0 && (
          <div className="h-1 bg-black/20">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(5, Math.min(100, (mostUrgent.daysUntilDeadline / 30) * 100))}%` }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="h-full"
              style={{ background: urgencyConfig.color }}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

export default DeadlineAlertBanner
