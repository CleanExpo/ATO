'use client'

/**
 * RegistrationStatusCard
 *
 * Shows R&D registration status for a financial year with deadline,
 * urgency indicator, and action button.
 *
 * Scientific Luxury design system.
 * Division 355 ITAA 1997 - R&D Tax Incentive registration tracking.
 */

import { motion } from 'framer-motion'
import {
  type RndRegistrationStatus,
  type DeadlineUrgency,
  RND_STATUS_CONFIG,
  URGENCY_CONFIG,
  formatDeadlineDate,
  formatDaysUntilDeadline,
} from '@/lib/types/rnd-registration'

interface RegistrationStatusCardProps {
  financialYear: string
  registrationStatus: RndRegistrationStatus
  deadlineDate: string
  daysUntilDeadline: number
  urgencyLevel: DeadlineUrgency
  eligibleExpenditure?: number
  estimatedOffset?: number
  ausindustryReference?: string
  onStartRegistration?: () => void
  onViewDetails?: () => void
  className?: string
}

export function RegistrationStatusCard({
  financialYear,
  registrationStatus,
  deadlineDate,
  daysUntilDeadline,
  urgencyLevel,
  eligibleExpenditure,
  estimatedOffset,
  ausindustryReference,
  onStartRegistration,
  onViewDetails,
  className = '',
}: RegistrationStatusCardProps) {
  const statusConfig = RND_STATUS_CONFIG[registrationStatus]
  const urgencyConfig = URGENCY_CONFIG[urgencyLevel]

  const isCompleted = registrationStatus === 'submitted' || registrationStatus === 'approved'
  const isOverdue = urgencyLevel === 'overdue'
  const needsAction = !isCompleted && urgencyLevel !== 'open'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        relative rounded-sm overflow-hidden
        ${className}
      `}
      style={{
        background: urgencyConfig.bgColor,
        border: `0.5px solid ${urgencyConfig.borderColor}`,
      }}
    >
      {/* Urgency indicator bar */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ backgroundColor: urgencyConfig.color }}
      />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3
              className="text-lg font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {financialYear}
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Division 355 R&D Tax Incentive
            </p>
          </div>

          {/* Status badge */}
          <div
            className="px-2 py-1 rounded text-xs font-medium"
            style={{
              background: statusConfig.bgColor,
              border: `0.5px solid ${statusConfig.borderColor}`,
              color: statusConfig.color,
            }}
          >
            <span className="mr-1.5">{statusConfig.icon}</span>
            {statusConfig.label}
          </div>
        </div>

        {/* Deadline info */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2">
            <span
              className="text-2xl font-bold tracking-tight"
              style={{ color: urgencyConfig.color }}
            >
              {formatDaysUntilDeadline(daysUntilDeadline)}
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Deadline: {formatDeadlineDate(deadlineDate)}
          </p>
        </div>

        {/* Financial summary */}
        {(eligibleExpenditure || estimatedOffset) && (
          <div
            className="grid grid-cols-2 gap-4 py-3 mb-4"
            style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            {eligibleExpenditure !== undefined && (
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Eligible Expenditure
                </p>
                <p
                  className="text-lg font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  ${eligibleExpenditure.toLocaleString('en-AU')}
                </p>
              </div>
            )}
            {estimatedOffset !== undefined && (
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Estimated Offset
                </p>
                <p className="text-lg font-semibold" style={{ color: '#00FF88' }}>
                  ${estimatedOffset.toLocaleString('en-AU')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* AusIndustry reference */}
        {ausindustryReference && (
          <div
            className="text-xs py-2 px-3 rounded mb-4"
            style={{
              background: 'rgba(0, 255, 136, 0.1)',
              border: '0.5px solid rgba(0, 255, 136, 0.2)',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>AusIndustry Ref: </span>
            <span style={{ color: '#00FF88' }}>{ausindustryReference}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          {!isCompleted && !isOverdue && onStartRegistration && (
            <button
              onClick={onStartRegistration}
              className="flex-1 py-2 px-4 rounded text-sm font-medium transition-all hover:brightness-110"
              style={{
                background: needsAction
                  ? urgencyConfig.color
                  : 'rgba(136, 85, 255, 0.2)',
                color: needsAction ? '#050505' : '#8855FF',
                border: needsAction ? 'none' : '0.5px solid rgba(136, 85, 255, 0.3)',
              }}
            >
              {registrationStatus === 'not_started'
                ? 'Start Registration'
                : 'Continue Registration'}
            </button>
          )}

          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="py-2 px-4 rounded text-sm font-medium transition-all hover:bg-white/10"
              style={{
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '0.5px solid rgba(255,255,255,0.2)',
              }}
            >
              View Details
            </button>
          )}
        </div>

        {/* Overdue warning */}
        {isOverdue && (
          <div
            className="mt-4 p-3 rounded text-xs"
            style={{
              background: 'rgba(255, 68, 68, 0.1)',
              border: '0.5px solid rgba(255, 68, 68, 0.3)',
              color: '#FF4444',
            }}
          >
            <strong>Registration deadline has passed.</strong> Contact your tax
            advisor to discuss late registration options or amendment
            possibilities.
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default RegistrationStatusCard
