'use client'

import { TaxCalendar } from '@/components/calendar'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'

/**
 * Tax Compliance Calendar Page
 *
 * Interactive calendar showing all Australian tax deadlines
 * filtered by entity type with keyboard navigation (WAI-ARIA grid).
 */
export default function CalendarPage() {
  return (
    <div id="main-content" style={{ paddingBottom: 'var(--space-3xl)' }}>
      {/* Page header */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 className="typo-headline">Tax Compliance Calendar</h1>
        <p className="typo-subtitle" style={{ marginTop: 'var(--space-xs)' }}>
          Key lodgement and payment deadlines for the current financial year
        </p>
      </div>

      <TaxCalendar />

      <TaxDisclaimer sticky />
    </div>
  )
}
