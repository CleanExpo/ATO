'use client'

/**
 * Schedule16NHelper
 *
 * Interactive field-by-field guide for completing Schedule 16N
 * (R&D Tax Incentive Schedule) in the company tax return.
 * Shows explanations, legislation references, validation rules,
 * and auto-populated values from analysis.
 *
 * Scientific Luxury design system.
 * Division 355 ITAA 1997 - R&D Tax Incentive.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  SCHEDULE_16N_FIELDS,
  SCHEDULE_16N_SECTIONS,
  getFieldsBySection,
  type Schedule16NField,
  type Schedule16NSection,
} from '@/lib/rnd/schedule-16n-fields'

interface Schedule16NHelperProps {
  /** Pre-populated values from analysis (keyed by autoPopulateFrom) */
  autoValues?: Record<string, string | number>
  className?: string
}

export function Schedule16NHelper({
  autoValues = {},
  className = '',
}: Schedule16NHelperProps) {
  const [expandedSection, setExpandedSection] = useState<Schedule16NSection | null>(
    'entity_details'
  )
  const [expandedField, setExpandedField] = useState<string | null>(null)

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-sm flex items-center justify-center"
            style={{
              background: 'rgba(0, 255, 136, 0.1)',
              border: '0.5px solid rgba(0, 255, 136, 0.3)',
            }}
          >
            <span className="text-lg font-mono" style={{ color: '#00FF88' }}>
              $
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Schedule 16N Guide
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              R&D Tax Incentive Schedule - {SCHEDULE_16N_FIELDS.length} fields across{' '}
              {SCHEDULE_16N_SECTIONS.length} sections
            </p>
          </div>
        </div>
      </div>

      {/* Auto-populated values note */}
      {Object.keys(autoValues).length > 0 && (
        <div
          className="mb-4 p-3 rounded-sm flex items-center gap-2 text-xs"
          style={{
            background: 'rgba(0, 245, 255, 0.05)',
            border: '0.5px solid rgba(0, 245, 255, 0.2)',
            color: '#00F5FF',
          }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            Some fields have been pre-populated from your Xero data and R&D analysis.
            Values shown with a cyan indicator can be auto-filled.
          </span>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-3">
        {SCHEDULE_16N_SECTIONS.map((section) => {
          const fields = getFieldsBySection(section.id)
          const isExpanded = expandedSection === section.id

          return (
            <div
              key={section.id}
              className="rounded-sm overflow-hidden"
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: `0.5px solid ${
                  isExpanded ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 255, 255, 0.08)'
                }`,
              }}
            >
              {/* Section header */}
              <button
                onClick={() =>
                  setExpandedSection(isExpanded ? null : section.id)
                }
                className="w-full flex items-center gap-3 p-4 transition-colors hover:bg-white/[0.02]"
              >
                <span
                  className="shrink-0 text-xs font-mono px-2 py-1 rounded"
                  style={{
                    background: 'rgba(0, 255, 136, 0.1)',
                    color: '#00FF88',
                  }}
                >
                  {section.title.split(' - ')[0]}
                </span>
                <div className="flex-1 text-left min-w-0">
                  <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {section.title.split(' - ').slice(1).join(' - ') || section.title}
                  </h3>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {section.description} ({fields.length} fields)
                  </p>
                </div>
                <svg
                  className={`w-4 h-4 transition-transform shrink-0 ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Section fields */}
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
                      style={{ borderTop: '0.5px solid rgba(255, 255, 255, 0.06)' }}
                    >
                      <div className="pt-3" />
                      {fields.map((field) => (
                        <FieldCard
                          key={field.fieldNumber}
                          field={field}
                          isExpanded={expandedField === field.fieldNumber}
                          onToggle={() =>
                            setExpandedField(
                              expandedField === field.fieldNumber
                                ? null
                                : field.fieldNumber
                            )
                          }
                          autoValue={
                            field.autoPopulateFrom
                              ? autoValues[field.autoPopulateFrom]
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {/* ATO guidance link */}
      <div
        className="mt-6 p-4 rounded-sm flex items-center justify-between"
        style={{
          background: 'rgba(0, 255, 136, 0.03)',
          border: '0.5px solid rgba(0, 255, 136, 0.15)',
        }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            ATO Schedule 16N Instructions
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Official ATO guidance for completing the R&D Tax Incentive Schedule
          </p>
        </div>
        <a
          href="https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/research-and-development-tax-incentive"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-2 px-3 py-1.5 text-xs rounded-sm transition-all hover:brightness-110"
          style={{
            background: 'rgba(0, 255, 136, 0.1)',
            border: '0.5px solid rgba(0, 255, 136, 0.3)',
            color: '#00FF88',
          }}
        >
          <span>-&gt;</span>
          <span>View on ATO</span>
        </a>
      </div>
    </div>
  )
}

/**
 * Individual field card with expandable explanation
 */
function FieldCard({
  field,
  isExpanded,
  onToggle,
  autoValue,
}: {
  field: Schedule16NField
  isExpanded: boolean
  onToggle: () => void
  autoValue?: string | number
}) {
  const hasAutoValue = autoValue !== undefined && autoValue !== null

  const formatAutoValue = (value: string | number): string => {
    if (typeof value === 'number') {
      if (field.dataType === 'currency') {
        return `$${value.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
      }
      return value.toLocaleString('en-AU')
    }
    return String(value)
  }

  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{
        background: 'rgba(0, 0, 0, 0.2)',
        border: `0.5px solid ${
          hasAutoValue ? 'rgba(0, 245, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)'
        }`,
      }}
    >
      {/* Field header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 transition-colors hover:bg-white/[0.02]"
      >
        {/* Field number */}
        <span
          className="shrink-0 text-xs font-mono w-8 text-center"
          style={{ color: '#00FF88' }}
        >
          {field.fieldNumber}
        </span>

        {/* Label */}
        <div className="flex-1 min-w-0 text-left">
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
            {field.label}
          </span>
        </div>

        {/* Auto-populated indicator */}
        {hasAutoValue && (
          <span
            className="shrink-0 text-xs px-2 py-0.5 rounded font-mono"
            style={{
              background: 'rgba(0, 245, 255, 0.1)',
              color: '#00F5FF',
            }}
          >
            {formatAutoValue(autoValue!)}
          </span>
        )}

        {/* Data type badge */}
        <span
          className="shrink-0 text-xs px-1.5 py-0.5 rounded"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            color: 'var(--text-muted)',
          }}
        >
          {field.dataType}
        </span>

        <svg
          className={`w-3.5 h-3.5 transition-transform shrink-0 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ color: 'var(--text-muted)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
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
              className="px-3 pb-3 ml-11 space-y-3"
              style={{ borderTop: '0.5px solid rgba(255, 255, 255, 0.04)' }}
            >
              <div className="pt-2" />

              {/* Description */}
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {field.description}
              </p>

              {/* Help text */}
              <div
                className="p-2.5 rounded-sm text-xs leading-relaxed"
                style={{
                  background: 'rgba(136, 85, 255, 0.05)',
                  border: '0.5px solid rgba(136, 85, 255, 0.15)',
                  color: 'var(--text-secondary)',
                }}
              >
                {field.helpText}
              </div>

              {/* Legislation reference */}
              {field.legislationRef && (
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Legislation:
                  </span>
                  <span
                    className="text-xs font-mono"
                    style={{ color: '#8855FF' }}
                  >
                    {field.legislationRef}
                  </span>
                </div>
              )}

              {/* Validation rules */}
              {field.validationRules && field.validationRules.length > 0 && (
                <div>
                  <span className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
                    Validation:
                  </span>
                  <ul className="space-y-1">
                    {field.validationRules.map((rule, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <span style={{ color: '#FF8800' }}>*</span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Auto-populate source */}
              {field.autoPopulateFrom && (
                <div className="flex items-center gap-2 text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>Source:</span>
                  <span
                    className="font-mono px-1.5 py-0.5 rounded"
                    style={{
                      background: 'rgba(0, 245, 255, 0.08)',
                      color: '#00F5FF',
                    }}
                  >
                    {field.autoPopulateFrom}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Schedule16NHelper
