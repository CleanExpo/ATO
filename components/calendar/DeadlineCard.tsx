'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle, XCircle, FileText, CreditCard, ClipboardList } from 'lucide-react'
import type { DeadlineStatus } from '@/lib/tax-data/deadlines'

interface DeadlineCardProps {
  status: DeadlineStatus
  className?: string
}

const URGENCY_CONFIG = {
  ok: {
    colour: 'var(--compliance-ok)',
    dimColour: 'var(--compliance-ok-dim)',
    icon: CheckCircle,
    label: 'On time',
  },
  approaching: {
    colour: 'var(--compliance-warn)',
    dimColour: 'var(--compliance-warn-dim)',
    icon: Clock,
    label: 'Approaching',
  },
  urgent: {
    colour: 'var(--compliance-risk)',
    dimColour: 'var(--compliance-risk-dim)',
    icon: AlertTriangle,
    label: 'Urgent',
  },
  overdue: {
    colour: 'var(--compliance-risk)',
    dimColour: 'var(--compliance-risk-dim)',
    icon: XCircle,
    label: 'OVERDUE',
  },
}

const TYPE_ICONS = {
  lodgement: FileText,
  payment: CreditCard,
  registration: ClipboardList,
}

/**
 * DeadlineCard - Expandable tax deadline card with countdown
 *
 * Uses icon + colour + text for urgency (never colour alone).
 * Screen reader announces countdown via aria-label.
 */
export function DeadlineCard({ status, className = '' }: DeadlineCardProps) {
  const [expanded, setExpanded] = useState(false)
  const { deadline, daysRemaining, urgency } = status
  const config = URGENCY_CONFIG[urgency]
  const UrgencyIcon = config.icon
  const TypeIcon = TYPE_ICONS[deadline.type]

  const countdownText = daysRemaining < 0
    ? `${Math.abs(daysRemaining)} days overdue`
    : daysRemaining === 0
    ? 'Due today'
    : daysRemaining === 1
    ? '1 day remaining'
    : `${daysRemaining} days remaining`

  return (
    <div
      className={`card ${className}`}
      style={{
        borderLeft: `2px solid ${config.colour}`,
        cursor: 'pointer',
      }}
      role="article"
      aria-label={`${deadline.name}: ${countdownText}. ${config.label}.`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          color: 'inherit',
        }}
        aria-expanded={expanded}
        aria-controls={`deadline-detail-${deadline.id}`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          {/* Type icon */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-full)',
              background: config.dimColour,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TypeIcon size={16} style={{ color: config.colour }} aria-hidden="true" />
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <span className="typo-title" style={{ fontSize: '0.875rem' }}>
                {deadline.name}
              </span>
            </div>
            <span className="typo-caption">
              {format(deadline.date, 'd MMMM yyyy')} &middot; {deadline.type}
            </span>
          </div>

          {/* Countdown + urgency */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexShrink: 0 }}>
            <span
              className="compliance-badge"
              style={{
                background: config.dimColour,
                color: config.colour,
                animation: urgency === 'overdue' ? 'pulse 2s infinite' : undefined,
              }}
            >
              <UrgencyIcon size={10} aria-hidden="true" />
              {config.label}
            </span>
            <span
              className="typo-data"
              style={{ fontSize: '0.75rem', color: config.colour }}
            >
              {countdownText}
            </span>
            {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div
          id={`deadline-detail-${deadline.id}`}
          style={{
            marginTop: 'var(--space-md)',
            paddingTop: 'var(--space-md)',
            borderTop: '0.5px solid var(--border-light)',
          }}
        >
          <p className="typo-subtitle" style={{ marginBottom: 'var(--space-sm)' }}>
            {deadline.description}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
            <div>
              <span className="typo-caption" style={{ display: 'block' }}>Legislation</span>
              <span className="typo-subtitle">{deadline.legislativeRef}</span>
            </div>
            <div>
              <span className="typo-caption" style={{ display: 'block' }}>Applies to</span>
              <span className="typo-subtitle">
                {deadline.entityTypes.map(e => e.replace('_', ' ')).join(', ')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
