'use client'

/**
 * DeadlineTimeline
 *
 * Vertical timeline showing all R&D registration deadlines across financial years.
 * Visual markers for past, approaching (90 days), and urgent (30 days) deadlines.
 *
 * Scientific Luxury design system.
 * Division 355 ITAA 1997 - 10 months after FY end for registration.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  type RndRegistrationStatus,
  type DeadlineUrgency,
  RND_STATUS_CONFIG,
  URGENCY_CONFIG,
  formatDeadlineDate,
  formatDaysUntilDeadline,
} from '@/lib/types/rnd-registration'

interface DeadlineItem {
  financialYear: string
  deadlineDate: string
  daysUntilDeadline: number
  urgencyLevel: DeadlineUrgency
  registrationStatus: RndRegistrationStatus
  eligibleExpenditure?: number
  estimatedOffset?: number
  ausindustryReference?: string
}

interface DeadlineTimelineProps {
  deadlines: DeadlineItem[]
  onSelectDeadline?: (deadline: DeadlineItem) => void
  selectedYear?: string
  className?: string
}

export function DeadlineTimeline({
  deadlines,
  onSelectDeadline,
  selectedYear,
  className = '',
}: DeadlineTimelineProps) {
  const [expandedYear, setExpandedYear] = useState<string | null>(selectedYear || null)

  if (deadlines.length === 0) {
    return (
      <div
        className={`p-6 rounded-sm text-center ${className}`}
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '0.5px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <p style={{ color: 'var(--text-muted)' }}>
          No R&D deadlines found. Run a forensic analysis to identify R&D opportunities.
        </p>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Timeline line */}
      <div
        className="absolute left-4 top-0 bottom-0 w-px"
        style={{ background: 'rgba(255, 255, 255, 0.1)' }}
      />

      <div className="space-y-4">
        {deadlines.map((deadline, index) => (
          <DeadlineTimelineItem
            key={deadline.financialYear}
            deadline={deadline}
            isExpanded={expandedYear === deadline.financialYear}
            isFirst={index === 0}
            isLast={index === deadlines.length - 1}
            onClick={() => {
              setExpandedYear(
                expandedYear === deadline.financialYear
                  ? null
                  : deadline.financialYear
              )
              onSelectDeadline?.(deadline)
            }}
          />
        ))}
      </div>
    </div>
  )
}

interface DeadlineTimelineItemProps {
  deadline: DeadlineItem
  isExpanded: boolean
  isFirst: boolean
  isLast: boolean
  onClick: () => void
}

function DeadlineTimelineItem({
  deadline,
  isExpanded,
  isFirst,
  isLast,
  onClick,
}: DeadlineTimelineItemProps) {
  const statusConfig = RND_STATUS_CONFIG[deadline.registrationStatus]
  const urgencyConfig = URGENCY_CONFIG[deadline.urgencyLevel]
  const isCompleted =
    deadline.registrationStatus === 'submitted' ||
    deadline.registrationStatus === 'approved'

  return (
    <motion.div
      initial={isFirst ? { opacity: 1 } : { opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: isFirst ? 0 : 0.1 }}
      className="relative pl-10"
    >
      {/* Timeline dot */}
      <div className="absolute left-2 top-4 -translate-x-1/2">
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center"
          style={{
            background: isCompleted ? urgencyConfig.color : urgencyConfig.bgColor,
            border: `2px solid ${urgencyConfig.color}`,
            boxShadow: isExpanded ? `0 0 12px ${urgencyConfig.color}40` : 'none',
          }}
        >
          {isCompleted && (
            <span className="text-[8px]" style={{ color: '#050505' }}>
              +
            </span>
          )}
        </div>
      </div>

      {/* Card */}
      <div
        onClick={onClick}
        className="rounded-sm overflow-hidden cursor-pointer transition-all hover:brightness-110"
        style={{
          background: isExpanded
            ? urgencyConfig.bgColor
            : 'rgba(255, 255, 255, 0.03)',
          border: `0.5px solid ${
            isExpanded ? urgencyConfig.borderColor : 'rgba(255, 255, 255, 0.1)'
          }`,
        }}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="text-base font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {deadline.financialYear}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                background: statusConfig.bgColor,
                color: statusConfig.color,
                border: `0.5px solid ${statusConfig.borderColor}`,
              }}
            >
              {statusConfig.label}
            </span>
          </div>

          <div className="text-right">
            <span
              className="text-sm font-medium"
              style={{ color: urgencyConfig.color }}
            >
              {formatDaysUntilDeadline(deadline.daysUntilDeadline)}
            </span>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {formatDeadlineDate(deadline.deadlineDate)}
            </p>
          </div>
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="px-4 pb-4"
                style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)' }}
              >
                <div className="pt-4 grid grid-cols-2 gap-4">
                  {deadline.eligibleExpenditure !== undefined && (
                    <div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Eligible Expenditure
                      </p>
                      <p
                        className="text-lg font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        ${deadline.eligibleExpenditure.toLocaleString('en-AU')}
                      </p>
                    </div>
                  )}
                  {deadline.estimatedOffset !== undefined && (
                    <div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Estimated Offset (43.5%)
                      </p>
                      <p className="text-lg font-semibold" style={{ color: '#00FF88' }}>
                        ${deadline.estimatedOffset.toLocaleString('en-AU')}
                      </p>
                    </div>
                  )}
                </div>

                {deadline.ausindustryReference && (
                  <div
                    className="mt-4 text-xs py-2 px-3 rounded"
                    style={{
                      background: 'rgba(0, 255, 136, 0.1)',
                      border: '0.5px solid rgba(0, 255, 136, 0.2)',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>
                      AusIndustry Ref:{' '}
                    </span>
                    <span style={{ color: '#00FF88' }}>
                      {deadline.ausindustryReference}
                    </span>
                  </div>
                )}

                {/* Status-specific guidance */}
                <div
                  className="mt-4 text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {deadline.urgencyLevel === 'overdue' && (
                    <p className="text-[#FF4444]">
                      Registration deadline has passed. Contact your tax advisor
                      about late registration options.
                    </p>
                  )}
                  {deadline.urgencyLevel === 'critical' && (
                    <p className="text-[#FF4444]">
                      CRITICAL: Only {deadline.daysUntilDeadline} days remaining.
                      Register with AusIndustry immediately.
                    </p>
                  )}
                  {deadline.urgencyLevel === 'urgent' && (
                    <p className="text-[#FF8800]">
                      URGENT: {deadline.daysUntilDeadline} days until deadline.
                      Begin registration process now.
                    </p>
                  )}
                  {deadline.urgencyLevel === 'approaching' && (
                    <p className="text-[#FFB800]">
                      Deadline approaching in {deadline.daysUntilDeadline} days.
                      Plan your registration.
                    </p>
                  )}
                  {deadline.urgencyLevel === 'completed' && (
                    <p className="text-[#00FF88]">
                      Registration {deadline.registrationStatus}. Ensure you lodge
                      Schedule 16N with your Company Tax Return.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default DeadlineTimeline
