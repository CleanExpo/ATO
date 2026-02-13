'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  format,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  generateDeadlines,
  getDeadlineStatus,
  filterByEntityType,
  getDeadlinesForMonth,
  type TaxDeadline,
  type EntityType,
  type DeadlineStatus,
} from '@/lib/tax-data/deadlines'
import { DeadlineCard } from './DeadlineCard'

interface TaxCalendarProps {
  /** Financial year start (calendar year, e.g., 2024 for FY2024-25) */
  fyStartYear?: number
  className?: string
}

const ENTITY_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'company', label: 'Company' },
  { value: 'individual', label: 'Individual' },
  { value: 'trust', label: 'Trust' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'super_fund', label: 'Super Fund' },
]

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const URGENCY_COLOURS: Record<string, string> = {
  ok: 'var(--compliance-ok)',
  approaching: 'var(--compliance-warn)',
  urgent: 'var(--compliance-risk)',
  overdue: 'var(--compliance-risk)',
}

/**
 * TaxCalendar - Interactive monthly calendar with tax deadlines
 *
 * Keyboard navigation: arrow keys for day navigation (WAI-ARIA grid pattern).
 * Entity type filter to show only relevant deadlines.
 */
export function TaxCalendar({
  fyStartYear = new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0),
  className = '',
}: TaxCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('company')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const allDeadlines = useMemo(() => generateDeadlines(fyStartYear), [fyStartYear])
  const filteredDeadlines = useMemo(
    () => filterByEntityType(allDeadlines, selectedEntity),
    [allDeadlines, selectedEntity]
  )

  const monthDeadlines = useMemo(
    () => getDeadlinesForMonth(filteredDeadlines, currentMonth.getFullYear(), currentMonth.getMonth()),
    [filteredDeadlines, currentMonth]
  )

  const selectedDateDeadlines = useMemo(() => {
    if (!selectedDate) return []
    return filteredDeadlines.filter(d => isSameDay(d.date, selectedDate))
  }, [filteredDeadlines, selectedDate])

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const days: Date[] = []
    let day = calStart
    while (day <= calEnd) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [currentMonth])

  const getDeadlinesForDay = useCallback(
    (day: Date): DeadlineStatus[] => {
      return filteredDeadlines
        .filter(d => isSameDay(d.date, day))
        .map(d => getDeadlineStatus(d))
    },
    [filteredDeadlines]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, day: Date) => {
      let newDate: Date | null = null
      switch (e.key) {
        case 'ArrowLeft':
          newDate = addDays(day, -1)
          break
        case 'ArrowRight':
          newDate = addDays(day, 1)
          break
        case 'ArrowUp':
          newDate = addDays(day, -7)
          break
        case 'ArrowDown':
          newDate = addDays(day, 7)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          setSelectedDate(isSameDay(day, selectedDate ?? new Date(0)) ? null : day)
          return
        default:
          return
      }
      if (newDate) {
        e.preventDefault()
        setSelectedDate(newDate)
        if (!isSameMonth(newDate, currentMonth)) {
          setCurrentMonth(startOfMonth(newDate))
        }
        // Focus the new cell
        const cellId = `cal-day-${format(newDate, 'yyyy-MM-dd')}`
        setTimeout(() => document.getElementById(cellId)?.focus(), 0)
      }
    },
    [currentMonth, selectedDate]
  )

  return (
    <div className={className}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="btn btn-ghost"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <h3 className="typo-title" style={{ minWidth: 180, textAlign: 'center' }}>
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="btn btn-ghost"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Entity type filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <label htmlFor="entity-filter" className="typo-label">Entity:</label>
          <select
            id="entity-filter"
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value as EntityType)}
            style={{ minWidth: 140 }}
          >
            {ENTITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-lg)' }}>
        {/* Calendar grid */}
        <div
          role="grid"
          aria-label={`Tax compliance calendar for ${format(currentMonth, 'MMMM yyyy')}`}
        >
          {/* Weekday headers */}
          <div
            role="row"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 'var(--space-xs)' }}
          >
            {WEEKDAYS.map(day => (
              <div
                key={day}
                role="columnheader"
                className="typo-caption"
                style={{ textAlign: 'center', padding: 'var(--space-xs)' }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div
            role="rowgroup"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }}
          >
            {calendarDays.map((day) => {
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isToday = isSameDay(day, new Date())
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
              const dayDeadlines = getDeadlinesForDay(day)
              const dateStr = format(day, 'yyyy-MM-dd')

              return (
                <div
                  key={dateStr}
                  id={`cal-day-${dateStr}`}
                  role="gridcell"
                  tabIndex={isSelected || (isToday && !selectedDate) ? 0 : -1}
                  aria-selected={isSelected}
                  aria-label={`${format(day, 'd MMMM yyyy')}${dayDeadlines.length > 0 ? `. ${dayDeadlines.length} deadline${dayDeadlines.length > 1 ? 's' : ''}.` : ''}`}
                  onClick={() => setSelectedDate(isSelected ? null : day)}
                  onKeyDown={(e) => handleKeyDown(e, day)}
                  style={{
                    padding: 'var(--space-sm)',
                    minHeight: 64,
                    background: isSelected
                      ? 'var(--accent-primary-dim)'
                      : isToday
                      ? 'var(--bg-card-hover)'
                      : 'var(--bg-card)',
                    border: isSelected
                      ? '1px solid var(--accent-primary)'
                      : isToday
                      ? '1px solid var(--border-medium)'
                      : '0.5px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    opacity: isCurrentMonth ? 1 : 0.3,
                    transition: 'background var(--transition-fast), border-color var(--transition-fast)',
                  }}
                >
                  <span
                    className="typo-label"
                    style={{
                      display: 'block',
                      color: isToday ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      fontWeight: isToday ? 600 : 400,
                    }}
                  >
                    {format(day, 'd')}
                  </span>

                  {/* Deadline dots */}
                  {dayDeadlines.length > 0 && (
                    <div style={{ display: 'flex', gap: '3px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {dayDeadlines.slice(0, 3).map((ds, i) => (
                        <span
                          key={i}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: URGENCY_COLOURS[ds.urgency],
                            animation: ds.urgency === 'overdue' ? 'pulse 2s infinite' : undefined,
                          }}
                          aria-hidden="true"
                        />
                      ))}
                      {dayDeadlines.length > 3 && (
                        <span className="typo-caption" style={{ fontSize: '8px' }}>
                          +{dayDeadlines.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar: deadlines for selected date or upcoming */}
        <div>
          <h4 className="typo-label" style={{ marginBottom: 'var(--space-md)' }}>
            {selectedDate
              ? `Deadlines for ${format(selectedDate, 'd MMMM yyyy')}`
              : `Upcoming Deadlines (${format(currentMonth, 'MMMM')})`}
          </h4>

          <div className="layout-stack">
            {(selectedDate ? selectedDateDeadlines : monthDeadlines).length === 0 ? (
              <p className="typo-subtitle" style={{ color: 'var(--text-muted)' }}>
                {selectedDate ? 'No deadlines on this date.' : 'No deadlines this month for the selected entity type.'}
              </p>
            ) : (
              (selectedDate ? selectedDateDeadlines : monthDeadlines).map(d => (
                <DeadlineCard
                  key={d.id}
                  status={getDeadlineStatus(d)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
