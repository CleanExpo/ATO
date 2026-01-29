'use client'

/**
 * ClaimChecklist
 *
 * Main container for the R&D claim preparation checklist.
 * Shows four category accordions, overall progress, filter/search,
 * and export functionality.
 *
 * Scientific Luxury design system.
 * Division 355 ITAA 1997 - R&D Tax Incentive claim preparation.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  type ChecklistProgress as ChecklistProgressType,
  type ChecklistFilter,
  type ChecklistCategorySummary,
  CHECKLIST_CATEGORIES,
} from '@/lib/types/rnd-checklist'
import { ChecklistProgress } from './ChecklistProgress'
import { ChecklistCategory } from './ChecklistCategory'
import { ChecklistExport } from './ChecklistExport'

interface ClaimChecklistProps {
  tenantId: string
  registrationId?: string
  className?: string
}

const FILTER_OPTIONS: { value: ChecklistFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'completed', label: 'Completed' },
]

export function ClaimChecklist({
  tenantId,
  registrationId,
  className = '',
}: ClaimChecklistProps) {
  const [progress, setProgress] = useState<ChecklistProgressType | null>(null)
  const [filter, setFilter] = useState<ChecklistFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch checklist data
  const loadChecklist = useCallback(async () => {
    try {
      const params = new URLSearchParams({ tenantId })
      if (registrationId) {
        params.set('registrationId', registrationId)
      }

      const response = await fetch(`/api/rnd/checklist?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load checklist')
      }

      setProgress(data.progress)
      setError(null)
    } catch (err) {
      console.error('Failed to load checklist:', err)
      setError(err instanceof Error ? err.message : 'Failed to load checklist')
    } finally {
      setIsLoading(false)
    }
  }, [tenantId, registrationId])

  useEffect(() => {
    loadChecklist()
  }, [loadChecklist])

  // Toggle item completion
  const handleToggleItem = async (itemKey: string, isCompleted: boolean) => {
    try {
      const response = await fetch(`/api/rnd/checklist/${encodeURIComponent(itemKey)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          registrationId,
          isCompleted,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update item')
      }

      // Reload checklist to get fresh data
      await loadChecklist()
    } catch (err) {
      console.error('Failed to toggle item:', err)
    }
  }

  // Update item notes
  const handleNotesChange = async (itemKey: string, notes: string) => {
    try {
      // We need to also pass the current completion state
      const currentItem = progress?.categories
        .flatMap((c) => c.items)
        .find((i) => i.itemKey === itemKey)

      await fetch(`/api/rnd/checklist/${encodeURIComponent(itemKey)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          registrationId,
          isCompleted: currentItem?.isCompleted ?? false,
          notes,
        }),
      })
    } catch (err) {
      console.error('Failed to update notes:', err)
    }
  }

  // Filter categories based on filter and search
  const getFilteredCategories = (): ChecklistCategorySummary[] => {
    if (!progress) return []

    return progress.categories.map((category) => {
      let filteredItems = [...category.items]

      // Apply completion filter
      if (filter === 'incomplete') {
        filteredItems = filteredItems.filter((i) => !i.isCompleted)
      } else if (filter === 'completed') {
        filteredItems = filteredItems.filter((i) => i.isCompleted)
      }

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        filteredItems = filteredItems.filter(
          (i) =>
            i.title.toLowerCase().includes(query) ||
            i.description?.toLowerCase().includes(query) ||
            i.legislationReference?.toLowerCase().includes(query)
        )
      }

      return {
        ...category,
        items: filteredItems,
      }
    }).filter((c) => c.items.length > 0 || (filter === 'all' && !searchQuery.trim()))
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-12 ${className}`}>
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: '#8855FF' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading checklist...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-6 text-center ${className}`}>
        <p className="text-sm mb-3" style={{ color: '#FF4444' }}>
          {error}
        </p>
        <button
          onClick={() => {
            setIsLoading(true)
            loadChecklist()
          }}
          className="text-sm px-4 py-2 rounded-sm transition-colors hover:bg-white/10"
          style={{
            border: '0.5px solid rgba(255, 255, 255, 0.2)',
            color: 'var(--text-secondary)',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!progress) return null

  const filteredCategories = getFilteredCategories()

  return (
    <div className={className}>
      {/* Header with progress */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <ChecklistProgress
            percentComplete={progress.percentComplete}
            completedItems={progress.completedItems}
            totalItems={progress.totalItems}
            mandatoryPercentComplete={progress.mandatoryPercentComplete}
            mandatoryCompleted={progress.mandatoryCompleted}
            mandatoryItems={progress.mandatoryItems}
            size="md"
          />
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Claim Preparation Checklist
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Division 355 ITAA 1997 - R&D Tax Incentive
            </p>
          </div>
        </div>

        <ChecklistExport tenantId={tenantId} registrationId={registrationId} />
      </div>

      {/* Filter and search bar */}
      <div
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4 p-3 rounded-sm"
        style={{
          background: 'rgba(0, 0, 0, 0.2)',
          border: '0.5px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Filter buttons */}
        <div className="flex items-center gap-1">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className="px-3 py-1.5 text-xs rounded-sm transition-all"
              style={{
                background: filter === option.value
                  ? 'rgba(136, 85, 255, 0.15)'
                  : 'transparent',
                border: `0.5px solid ${
                  filter === option.value
                    ? 'rgba(136, 85, 255, 0.4)'
                    : 'rgba(255, 255, 255, 0.1)'
                }`,
                color: filter === option.value ? '#8855FF' : 'var(--text-muted)',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full text-sm px-3 py-1.5 rounded-sm focus:outline-none"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '0.5px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* Category accordions */}
      <div className="space-y-3">
        {filteredCategories.map((category, index) => (
          <ChecklistCategory
            key={category.category}
            summary={category}
            defaultExpanded={index === 0}
            onToggleItem={handleToggleItem}
            onNotesChange={handleNotesChange}
          />
        ))}

        {filteredCategories.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {searchQuery ? 'No items match your search' : 'No items to display'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ClaimChecklist
