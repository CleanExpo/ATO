/**
 * Format Toggle Wrapper Component
 *
 * Wraps content with view toggle and smooth transitions
 * - Smooth fade transition between views
 * - Persists preference in localStorage
 * - Shows appropriate download buttons per view
 */

'use client'

import React, { useState } from 'react'
import ViewToggle from './ViewToggle'

interface FormatToggleWrapperProps {
  technicalView: React.ReactNode
  clientView: React.ReactNode
  defaultView?: 'client' | 'accountant'
  persistKey?: string
  className?: string
  showToggle?: boolean
  onViewChange?: (view: 'client' | 'accountant') => void
}

export default function FormatToggleWrapper({
  technicalView,
  clientView,
  defaultView = 'accountant',
  persistKey = 'ato_format_view',
  className = '',
  showToggle = true,
  onViewChange
}: FormatToggleWrapperProps) {
  const [currentView, setCurrentView] = useState<'client' | 'accountant'>(defaultView)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleViewChange = (view: 'client' | 'accountant') => {
    if (view === currentView) return

    // Start fade out
    setIsTransitioning(true)

    // Wait for fade out, then switch view
    setTimeout(() => {
      setCurrentView(view)
      setIsTransitioning(false)
      if (onViewChange) {
        onViewChange(view)
      }
    }, 150)
  }

  return (
    <div className={className}>
      {/* View Toggle */}
      {showToggle && (
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
              Results
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              {currentView === 'client'
                ? 'Simplified overview for business owners'
                : 'Technical details for accountants'}
            </p>
          </div>
          <ViewToggle
            currentView={currentView}
            onChange={handleViewChange}
            persistKey={persistKey}
          />
        </div>
      )}

      {/* Content with Transition */}
      <div
        className={`transition-opacity duration-150 ${
          isTransitioning ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {currentView === 'client' ? clientView : technicalView}
      </div>
    </div>
  )
}
