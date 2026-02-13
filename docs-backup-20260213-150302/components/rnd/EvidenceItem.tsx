'use client'

/**
 * EvidenceItem
 *
 * Individual evidence card showing title, type, date, and actions.
 * Displays contemporaneous badge and document preview link.
 *
 * Scientific Luxury design system.
 * Division 355 ITAA 1997 - R&D evidence documentation.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  type RndEvidence,
  EVIDENCE_TYPE_LABELS,
  EVIDENCE_TYPE_ICONS,
  getElementDisplayName,
} from '@/lib/types/rnd-evidence'

interface EvidenceItemProps {
  evidence: RndEvidence
  onEdit?: (evidence: RndEvidence) => void
  onDelete?: (evidence: RndEvidence) => void
  onViewDocument?: (documentId: string) => void
  showElement?: boolean
  compact?: boolean
  className?: string
}

export function EvidenceItem({
  evidence,
  onEdit,
  onDelete,
  onViewDocument,
  showElement = false,
  compact = false,
  className = '',
}: EvidenceItemProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!onDelete) return

    setIsDeleting(true)
    try {
      await onDelete(evidence)
    } finally {
      setIsDeleting(false)
    }
  }

  const typeIcon = EVIDENCE_TYPE_ICONS[evidence.evidenceType]
  const typeLabel = EVIDENCE_TYPE_LABELS[evidence.evidenceType]

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  if (compact) {
    return (
      <CompactEvidenceItem
        evidence={evidence}
        onEdit={onEdit}
        onDelete={handleDelete}
        isDeleting={isDeleting}
        className={className}
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`rounded-sm overflow-hidden ${className}`}
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '0.5px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {/* Type indicator */}
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs px-1.5 py-0.5 rounded font-mono"
                style={{
                  background: 'rgba(136, 85, 255, 0.15)',
                  color: '#8855FF',
                }}
              >
                {typeIcon}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {typeLabel}
              </span>
              {showElement && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>|</span>
                  <span className="text-xs" style={{ color: 'var(--accent-primary)' }}>
                    {getElementDisplayName(evidence.element)}
                  </span>
                </>
              )}
            </div>

            {/* Title */}
            <h4 className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {evidence.title}
            </h4>
          </div>

          {/* Contemporaneous badge */}
          {evidence.isContemporaneous && (
            <div
              className="shrink-0 px-2 py-0.5 rounded text-xs"
              style={{
                background: 'rgba(0, 255, 136, 0.1)',
                border: '0.5px solid rgba(0, 255, 136, 0.3)',
                color: '#00FF88',
              }}
            >
              Contemporaneous
            </div>
          )}
        </div>

        {/* Description */}
        {evidence.description && (
          <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
            {evidence.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            {evidence.dateCreated && (
              <span>Created: {formatDate(evidence.dateCreated)}</span>
            )}
            {evidence.url && (
              <a
                href={evidence.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 transition-colors hover:brightness-110"
                style={{ color: 'var(--accent-primary)' }}
              >
                <span>-&gt;</span>
                <span>View Reference</span>
              </a>
            )}
            {evidence.documentId && onViewDocument && (
              <button
                onClick={() => onViewDocument(evidence.documentId!)}
                className="flex items-center gap-1 transition-colors hover:brightness-110"
                style={{ color: 'var(--accent-primary)' }}
              >
                <span>|=|</span>
                <span>View Document</span>
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(evidence)}
                className="p-1.5 rounded transition-colors hover:bg-white/10"
                style={{ color: 'var(--text-muted)' }}
                title="Edit"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1.5 rounded transition-colors hover:bg-red-500/20 disabled:opacity-50"
                style={{ color: '#FF4444' }}
                title="Delete"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/**
 * Compact evidence item for lists
 */
function CompactEvidenceItem({
  evidence,
  onEdit,
  onDelete,
  isDeleting,
  className,
}: {
  evidence: RndEvidence
  onEdit?: (evidence: RndEvidence) => void
  onDelete?: () => void
  isDeleting: boolean
  className: string
}) {
  const typeIcon = EVIDENCE_TYPE_ICONS[evidence.evidenceType]

  return (
    <div
      className={`flex items-center gap-3 py-2 px-3 rounded-sm ${className}`}
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '0.5px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <span
        className="text-xs font-mono shrink-0"
        style={{ color: '#8855FF' }}
      >
        {typeIcon}
      </span>

      <span
        className="flex-1 text-sm truncate"
        style={{ color: 'var(--text-primary)' }}
      >
        {evidence.title}
      </span>

      {evidence.isContemporaneous && (
        <span className="text-xs shrink-0" style={{ color: '#00FF88' }}>
          +
        </span>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {onEdit && (
          <button
            onClick={() => onEdit(evidence)}
            className="p-1 rounded transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-1 rounded transition-colors hover:bg-red-500/20 disabled:opacity-50"
            style={{ color: '#FF4444' }}
          >
            {isDeleting ? (
              <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default EvidenceItem
