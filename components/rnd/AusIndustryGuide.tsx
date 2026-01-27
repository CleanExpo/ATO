'use client'

/**
 * AusIndustryGuide
 *
 * Step-by-step registration guide for the R&D Tax Incentive
 * through AusIndustry. Shows each step with tips, pitfalls,
 * estimated time, and external links.
 *
 * Scientific Luxury design system.
 * Division 355 ITAA 1997 - R&D Tax Incentive registration.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AUSINDUSTRY_STEPS,
  calculateTotalEstimatedTime,
  type AusIndustryStep,
} from '@/lib/rnd/ausindustry-steps'

interface AusIndustryGuideProps {
  completedSteps?: number[]
  className?: string
}

export function AusIndustryGuide({
  completedSteps = [],
  className = '',
}: AusIndustryGuideProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  const totalMinutes = calculateTotalEstimatedTime()
  const totalHours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-sm flex items-center justify-center"
            style={{
              background: 'rgba(0, 245, 255, 0.1)',
              border: '0.5px solid rgba(0, 245, 255, 0.3)',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="#00F5FF" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              AusIndustry Registration Guide
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {AUSINDUSTRY_STEPS.length} steps - Estimated {totalHours}h {remainingMinutes}m total
            </p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {AUSINDUSTRY_STEPS.map((step) => {
          const isCompleted = completedSteps.includes(step.step)
          const isExpanded = expandedStep === step.step

          return (
            <StepCard
              key={step.step}
              step={step}
              isCompleted={isCompleted}
              isExpanded={isExpanded}
              onToggle={() =>
                setExpandedStep(isExpanded ? null : step.step)
              }
            />
          )
        })}
      </div>

      {/* Footer note */}
      <div
        className="mt-6 p-4 rounded-sm text-xs leading-relaxed"
        style={{
          background: 'rgba(0, 245, 255, 0.03)',
          border: '0.5px solid rgba(0, 245, 255, 0.15)',
          color: 'var(--text-muted)',
        }}
      >
        <strong style={{ color: '#00F5FF' }}>Important:</strong>{' '}
        R&D registration must be submitted within 10 months after the end of the
        income year (s 27A IRDA 1986). Late registrations may not be accepted.
        Consult a qualified R&D tax advisor for complex claims.
      </div>
    </div>
  )
}

/**
 * Individual step card with expandable details
 */
function StepCard({
  step,
  isCompleted,
  isExpanded,
  onToggle,
}: {
  step: AusIndustryStep
  isCompleted: boolean
  isExpanded: boolean
  onToggle: () => void
}) {
  const stepColor = isCompleted ? '#00FF88' : '#00F5FF'

  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{
        background: isCompleted
          ? 'rgba(0, 255, 136, 0.03)'
          : 'rgba(255, 255, 255, 0.02)',
        border: `0.5px solid ${
          isExpanded
            ? 'rgba(0, 245, 255, 0.3)'
            : isCompleted
              ? 'rgba(0, 255, 136, 0.15)'
              : 'rgba(255, 255, 255, 0.08)'
        }`,
      }}
    >
      {/* Step header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 transition-colors hover:bg-white/[0.02]"
      >
        {/* Step number */}
        <div
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
          style={{
            border: `1.5px solid ${stepColor}`,
            background: isCompleted ? 'rgba(0, 255, 136, 0.15)' : 'transparent',
            color: stepColor,
          }}
        >
          {isCompleted ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            step.step
          )}
        </div>

        {/* Title and description */}
        <div className="flex-1 min-w-0 text-left">
          <h3
            className={`text-sm font-medium ${isCompleted ? 'line-through opacity-60' : ''}`}
            style={{ color: 'var(--text-primary)' }}
          >
            {step.title}
          </h3>
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            ~{step.estimatedMinutes} min
          </p>
        </div>

        {/* Expand indicator */}
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ color: 'var(--text-muted)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable content */}
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
              className="px-4 pb-4 space-y-4"
              style={{ borderTop: '0.5px solid rgba(255, 255, 255, 0.06)' }}
            >
              <div className="pt-3" />

              {/* Description */}
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {step.description}
              </p>

              {/* External link */}
              {step.url && (
                <a
                  href={step.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-sm transition-all hover:brightness-110"
                  style={{
                    background: 'rgba(0, 245, 255, 0.1)',
                    border: '0.5px solid rgba(0, 245, 255, 0.3)',
                    color: '#00F5FF',
                  }}
                >
                  <span>-&gt;</span>
                  <span>Open Portal</span>
                </a>
              )}

              {/* Tips */}
              {step.tips.length > 0 && (
                <div>
                  <h4
                    className="text-xs font-medium uppercase tracking-wider mb-2"
                    style={{ color: '#00FF88' }}
                  >
                    Tips
                  </h4>
                  <ul className="space-y-1.5">
                    {step.tips.map((tip, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <span className="mt-0.5 shrink-0" style={{ color: '#00FF88' }}>+</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pitfalls */}
              {step.pitfalls.length > 0 && (
                <div>
                  <h4
                    className="text-xs font-medium uppercase tracking-wider mb-2"
                    style={{ color: '#FF4444' }}
                  >
                    Common Pitfalls
                  </h4>
                  <ul className="space-y-1.5">
                    {step.pitfalls.map((pitfall, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <span className="mt-0.5 shrink-0" style={{ color: '#FF4444' }}>!</span>
                        <span>{pitfall}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AusIndustryGuide
