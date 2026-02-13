/**
 * View Toggle Component
 *
 * Switch between Client and Accountant views
 * - Smooth sliding switch animation
 * - Icons for each view
 * - Keyboard accessible
 * - Persistent state (localStorage)
 * - Glassmorphism pill design
 */

'use client'

import React, { useEffect, useState } from 'react'
import { User, Calculator } from 'lucide-react'

interface ViewToggleProps {
  currentView: 'client' | 'accountant'
  onChange: (view: 'client' | 'accountant') => void
  clientLabel?: string
  accountantLabel?: string
  className?: string
  persistKey?: string // localStorage key for persistence
}

export default function ViewToggle({
  currentView,
  onChange,
  clientLabel = 'Client View',
  accountantLabel = 'Accountant View',
  className = '',
  persistKey = 'ato_view_preference'
}: ViewToggleProps) {
  const [localView, setLocalView] = useState(currentView)

  // Load persisted preference on mount
  useEffect(() => {
    if (persistKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(persistKey)
      if (saved === 'client' || saved === 'accountant') {
        setLocalView(saved)
        onChange(saved)
      }
    }
  }, [persistKey, onChange])

  const handleToggle = (view: 'client' | 'accountant') => {
    setLocalView(view)
    onChange(view)

    // Persist preference
    if (persistKey && typeof window !== 'undefined') {
      localStorage.setItem(persistKey, view)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, view: 'client' | 'accountant') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle(view)
    }
  }

  return (
    <div className={`inline-flex items-center ${className}`}>
      <div className="glass-card p-1 flex items-center gap-1 relative">
        {/* Sliding background */}
        <div
          className={`absolute top-1 bottom-1 transition-all duration-300 ease-out
            bg-gradient-to-r from-sky-500 to-blue-500 rounded-lg
            ${localView === 'client' ? 'left-1' : 'left-[calc(50%)]'}
            w-[calc(50%-0.25rem)]`}
        />

        {/* Client View Button */}
        <button
          onClick={() => handleToggle('client')}
          onKeyDown={(e) => handleKeyDown(e, 'client')}
          className={`relative z-10 px-4 py-2 rounded-lg flex items-center gap-2
            transition-colors duration-300 font-medium text-sm
            ${
              localView === 'client'
                ? 'text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          aria-label={clientLabel}
          aria-pressed={localView === 'client'}
        >
          <User className="w-4 h-4" />
          <span>{clientLabel}</span>
        </button>

        {/* Accountant View Button */}
        <button
          onClick={() => handleToggle('accountant')}
          onKeyDown={(e) => handleKeyDown(e, 'accountant')}
          className={`relative z-10 px-4 py-2 rounded-lg flex items-center gap-2
            transition-colors duration-300 font-medium text-sm
            ${
              localView === 'accountant'
                ? 'text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          aria-label={accountantLabel}
          aria-pressed={localView === 'accountant'}
        >
          <Calculator className="w-4 h-4" />
          <span>{accountantLabel}</span>
        </button>
      </div>
    </div>
  )
}
