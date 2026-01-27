'use client'

/**
 * ChecklistCategory
 *
 * Expandable accordion section for a checklist category,
 * showing category progress and list of items.
 *
 * Scientific Luxury design system.
 * Division 355 ITAA 1997 - R&D Tax Incentive claim preparation.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  type ChecklistCategorySummary,
  CATEGORY_CONFIG,
} from '@/lib/types/rnd-checklist'
import { ChecklistItem } from './ChecklistItem'

interface ChecklistCategoryProps {
  summary: ChecklistCategorySummary
  defaultExpanded?: boolean
  onToggleItem: (itemKey: string, isCompleted: boolean) => Promise<void>
  onNotesChange?: (itemKey: string, notes: string) => void
  className?: string
}

export function ChecklistCategory({
  summary,
  defaultExpanded = false,
  onToggleItem,
  onNotesChange,
  className = '',
}: ChecklistCategoryProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const config = CATEGORY_CONFIG[summary.category]
  const categoryPercent =
    summary.totalItems > 0
      ? Math.round((summary.completedItems / summary.totalItems) * 100)
      : 0

  return (
    <div
      className={`rounded-sm overflow-hidden ${className}`}
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: `0.5px solid ${isExpanded ? config.borderColor : 'rgba(255, 255, 255, 0.1)'}`,
      }}
    >
      {/* Category header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-4 transition-colors hover:bg-white/[0.02]"
      >
        {/* Icon */}
        <span
          className="shrink-0 w-8 h-8 rounded-sm flex items-center justify-center text-sm font-mono"
          style={{
            background: config.bgColor,
            border: `0.5px solid ${config.borderColor}`,
            color: config.color,
          }}
        >
          {config.icon}
        </span>

        {/* Label and description */}
        <div className="flex-1 min-w-0 text-left">
          <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {config.label}
          </h3>
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {config.description}
          </p>
        </div>

        {/* Progress */}
        <div className="shrink-0 flex items-center gap-3">
          <div className="text-right">
            <span className="text-sm font-medium" style={{ color: config.color }}>
              {summary.completedItems}/{summary.totalItems}
            </span>
            <div
              className="h-1 w-16 rounded-full overflow-hidden mt-1"
              style={{ background: 'rgba(255, 255, 255, 0.08)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${categoryPercent}%`,
                  background: config.color,
                }}
              />
            </div>
          </div>

          {/* Chevron */}
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: 'var(--text-muted)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expandable items */}
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
              className="px-4 pb-4 space-y-2"
              style={{ borderTop: `0.5px solid ${config.borderColor}` }}
            >
              <div className="pt-3" />
              {summary.items.map((item) => (
                <ChecklistItem
                  key={item.itemKey}
                  item={item}
                  categoryColor={config.color}
                  onToggle={onToggleItem}
                  onNotesChange={onNotesChange}
                />
              ))}

              {summary.items.length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  No items in this category
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ChecklistCategory
