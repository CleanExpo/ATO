'use client'

/**
 * EmptyState - Standardised empty data display with CTA
 *
 * Shows a friendly empty state message with an action button.
 * Used across dashboard pages for consistent new-user UX.
 */

import Link from 'next/link'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  message: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  actionHref,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`card p-12 text-center ${className}`}>
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ background: 'rgba(0, 245, 255, 0.05)' }}
      >
        {icon || <Inbox className="w-7 h-7" style={{ color: 'var(--accent, #00F5FF)' }} />}
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-white/40 mb-6 max-w-md mx-auto leading-relaxed">{message}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg transition-colors"
          style={{
            background: 'var(--accent, #00F5FF)',
            color: '#050505',
          }}
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg transition-colors"
          style={{
            background: 'var(--accent, #00F5FF)',
            color: '#050505',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export default EmptyState
