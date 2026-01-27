'use client'

/**
 * ChecklistItem
 *
 * Individual checklist item with checkbox, title, description,
 * legislation reference, mandatory badge, and notes field.
 *
 * Scientific Luxury design system.
 * Division 355 ITAA 1997 - R&D Tax Incentive claim preparation.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type ChecklistItemWithStatus } from '@/lib/types/rnd-checklist'

interface ChecklistItemProps {
  item: ChecklistItemWithStatus
  categoryColor: string
  onToggle: (itemKey: string, isCompleted: boolean) => Promise<void>
  onNotesChange?: (itemKey: string, notes: string) => void
  className?: string
}

export function ChecklistItem({
  item,
  categoryColor,
  onToggle,
  onNotesChange,
  className = '',
}: ChecklistItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [localNotes, setLocalNotes] = useState(item.notes ?? '')

  const handleToggle = async () => {
    setIsUpdating(true)
    try {
      await onToggle(item.itemKey, !item.isCompleted)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleNotesBlur = () => {
    if (onNotesChange && localNotes !== (item.notes ?? '')) {
      onNotesChange(item.itemKey, localNotes)
    }
  }

  return (
    <div
      className={`rounded-sm overflow-hidden transition-all ${className}`}
      style={{
        background: item.isCompleted
          ? 'rgba(0, 255, 136, 0.03)'
          : 'rgba(255, 255, 255, 0.02)',
        border: `0.5px solid ${
          item.isCompleted ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 255, 255, 0.08)'
        }`,
      }}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 p-3">
        {/* Checkbox */}
        <button
          onClick={handleToggle}
          disabled={isUpdating}
          className="mt-0.5 shrink-0 w-5 h-5 rounded-sm flex items-center justify-center transition-all"
          style={{
            border: `1.5px solid ${item.isCompleted ? '#00FF88' : 'rgba(255, 255, 255, 0.3)'}`,
            background: item.isCompleted ? 'rgba(0, 255, 136, 0.15)' : 'transparent',
          }}
          aria-label={`Mark "${item.title}" as ${item.isCompleted ? 'incomplete' : 'completed'}`}
        >
          {isUpdating ? (
            <div
              className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"
              style={{ color: categoryColor }}
            />
          ) : item.isCompleted ? (
            <svg className="w-3 h-3" fill="none" stroke="#00FF88" viewBox="0 0 24 24" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : null}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4
              className={`text-sm font-medium ${item.isCompleted ? 'line-through opacity-60' : ''}`}
              style={{ color: 'var(--text-primary)' }}
            >
              {item.title}
            </h4>
            {item.isMandatory && (
              <span
                className="shrink-0 text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: 'rgba(255, 68, 68, 0.1)',
                  border: '0.5px solid rgba(255, 68, 68, 0.3)',
                  color: '#FF4444',
                }}
              >
                Required
              </span>
            )}
          </div>

          {/* Legislation reference */}
          {item.legislationReference && (
            <span
              className="text-xs font-mono mt-0.5 inline-block"
              style={{ color: categoryColor, opacity: 0.8 }}
            >
              {item.legislationReference}
            </span>
          )}

          {/* Completion info */}
          {item.isCompleted && item.completedAt && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Completed{' '}
              {new Date(item.completedAt).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              {item.completedBy ? ` by ${item.completedBy}` : ''}
            </p>
          )}
        </div>

        {/* Expand button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="shrink-0 p-1 rounded transition-colors hover:bg-white/10"
          style={{ color: 'var(--text-muted)' }}
          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expandable details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="px-3 pb-3 pt-0 ml-8"
              style={{ borderTop: '0.5px solid rgba(255, 255, 255, 0.06)' }}
            >
              {/* Description */}
              {item.description && (
                <p className="text-sm mt-3 mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {item.description}
                </p>
              )}

              {/* Help URL */}
              {item.helpUrl && (
                <a
                  href={item.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs flex items-center gap-1 mb-3 transition-colors hover:brightness-110"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  <span>-&gt;</span>
                  <span>View guidance</span>
                </a>
              )}

              {/* Notes field */}
              <div className="mt-2">
                <label
                  className="text-xs block mb-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Notes
                </label>
                <textarea
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  onBlur={handleNotesBlur}
                  placeholder="Add notes..."
                  rows={2}
                  className="w-full text-sm rounded-sm px-3 py-2 resize-none focus:outline-none"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '0.5px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ChecklistItem
