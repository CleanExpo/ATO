'use client'

/**
 * RegistrationWorkflow
 *
 * Step-by-step R&D Tax Incentive registration process guide.
 * Shows required documents, links to AusIndustry portal, and progress.
 *
 * Scientific Luxury design system.
 * Division 355 ITAA 1997 - R&D Tax Incentive registration workflow.
 */

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  type RndRegistrationStatus,
  RND_STATUS_CONFIG,
} from '@/lib/types/rnd-registration'

interface WorkflowStep {
  id: string
  title: string
  description: string
  documents?: string[]
  links?: { label: string; url: string }[]
  duration?: string
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'prepare',
    title: '1. Prepare Documentation',
    description:
      'Gather all technical documentation and financial records for your R&D activities.',
    documents: [
      'Technical project description (hypothesis, methodology, outcomes)',
      'Expenditure records (invoices, timesheets, contractor agreements)',
      'Four-element test evidence for each R&D activity',
      'Project timeline showing systematic progression',
    ],
    duration: '1-2 weeks',
  },
  {
    id: 'portal',
    title: '2. Access AusIndustry Portal',
    description:
      'Log in to the business.gov.au portal to begin your R&D registration.',
    links: [
      {
        label: 'AusIndustry R&D Tax Incentive Portal',
        url: 'https://www.business.gov.au/grants-and-programs/research-and-development-tax-incentive',
      },
      {
        label: 'R&D Registration Guide',
        url: 'https://www.ato.gov.au/businesses-and-organisations/corporate-tax-measures-and-டிiscentives/research-and-development-tax-incentive',
      },
    ],
    duration: '30 minutes',
  },
  {
    id: 'register',
    title: '3. Complete Registration Form',
    description:
      'Enter your R&D activity details, expenditure, and supporting information.',
    documents: [
      'Business ABN and details',
      'R&D activity descriptions (core and supporting)',
      'Expenditure breakdown by activity type',
      'Overseas activities declaration (if applicable)',
    ],
    duration: '2-4 hours',
  },
  {
    id: 'submit',
    title: '4. Submit and Confirm',
    description:
      'Review your registration, submit to AusIndustry, and save your reference number.',
    documents: [
      'Registration reference number (save this!)',
      'Submission confirmation email',
    ],
    duration: '15 minutes',
  },
  {
    id: 'tax_return',
    title: '5. Lodge Schedule 16N',
    description:
      'Include Schedule 16N (R&D Tax Incentive) with your Company Tax Return.',
    documents: [
      'Schedule 16N - R&D Tax Incentive',
      'Company Tax Return with R&D offset claim',
      'Registered R&D activities reference',
    ],
    duration: 'With tax return',
  },
]

interface RegistrationWorkflowProps {
  currentStatus: RndRegistrationStatus
  financialYear: string
  onUpdateStatus?: (status: RndRegistrationStatus) => void
  className?: string
}

export function RegistrationWorkflow({
  currentStatus,
  financialYear,
  onUpdateStatus,
  className = '',
}: RegistrationWorkflowProps) {
  const [activeStep, setActiveStep] = useState<string | null>(null)

  // Map status to completed step index
  const statusToStep: Record<RndRegistrationStatus, number> = {
    not_started: -1,
    in_progress: 2,
    submitted: 3,
    approved: 4,
    rejected: 3, // Back to submit step
  }

  const currentStepIndex = statusToStep[currentStatus]
  const isCompleted = currentStatus === 'approved'

  return (
    <div
      className={`rounded-sm overflow-hidden ${className}`}
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '0.5px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Header */}
      <div
        className="p-5"
        style={{ borderBottom: '0.5px solid rgba(255, 255, 255, 0.1)' }}
      >
        <h3
          className="text-lg font-semibold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Registration Workflow
        </h3>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {financialYear} - Division 355 R&D Tax Incentive
        </p>
      </div>

      {/* Progress bar */}
      <div className="px-5 py-3" style={{ background: 'rgba(0, 0, 0, 0.2)' }}>
        <div className="flex items-center gap-2">
          {WORKFLOW_STEPS.map((step, index) => (
            <div
              key={step.id}
              className="flex-1 h-1 rounded-full"
              style={{
                background:
                  index <= currentStepIndex
                    ? '#00FF88'
                    : 'rgba(255, 255, 255, 0.1)',
              }}
            />
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          {currentStepIndex >= 0
            ? `Step ${currentStepIndex + 1} of ${WORKFLOW_STEPS.length}`
            : 'Not started'}
        </p>
      </div>

      {/* Steps */}
      <div className="divide-y divide-white/5">
        {WORKFLOW_STEPS.map((step, index) => {
          const isStepCompleted = index < currentStepIndex
          const isStepCurrent = index === currentStepIndex
          const isStepExpanded = activeStep === step.id

          return (
            <div key={step.id}>
              <button
                onClick={() =>
                  setActiveStep(isStepExpanded ? null : step.id)
                }
                className="w-full px-5 py-4 flex items-center gap-4 text-left transition-all hover:bg-white/5"
                disabled={isCompleted && index > currentStepIndex}
              >
                {/* Step indicator */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: isStepCompleted
                      ? '#00FF88'
                      : isStepCurrent
                      ? 'rgba(136, 85, 255, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: isStepCurrent
                      ? '2px solid #8855FF'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    color: isStepCompleted ? '#050505' : 'var(--text-secondary)',
                  }}
                >
                  {isStepCompleted ? (
                    <span className="text-sm">+</span>
                  ) : (
                    <span className="text-xs font-medium">{index + 1}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4
                    className="text-sm font-medium"
                    style={{
                      color: isStepCompleted
                        ? '#00FF88'
                        : isStepCurrent
                        ? '#8855FF'
                        : 'var(--text-primary)',
                    }}
                  >
                    {step.title}
                  </h4>
                  {step.duration && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Est. time: {step.duration}
                    </p>
                  )}
                </div>

                {/* Expand indicator */}
                <div
                  className="text-sm transition-transform"
                  style={{
                    color: 'var(--text-muted)',
                    transform: isStepExpanded ? 'rotate(180deg)' : 'none',
                  }}
                >
                  v
                </div>
              </button>

              {/* Expanded content */}
              <AnimatePresence>
                {isStepExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="px-5 pb-4 ml-12"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <p className="text-sm mb-4">{step.description}</p>

                      {/* Documents checklist */}
                      {step.documents && step.documents.length > 0 && (
                        <div className="mb-4">
                          <p
                            className="text-xs font-medium mb-2"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Required Documents:
                          </p>
                          <ul className="space-y-2">
                            {step.documents.map((doc, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-xs"
                              >
                                <span
                                  className="w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0"
                                  style={{
                                    borderColor: 'rgba(255, 255, 255, 0.2)',
                                    background: isStepCompleted
                                      ? 'rgba(0, 255, 136, 0.2)'
                                      : 'transparent',
                                  }}
                                >
                                  {isStepCompleted && (
                                    <span style={{ color: '#00FF88' }}>+</span>
                                  )}
                                </span>
                                <span>{doc}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Evidence Wizard Link - Only show for prepare step */}
                      {step.id === 'prepare' && (
                        <div
                          className="p-3 rounded-sm mb-4"
                          style={{
                            background: 'rgba(136, 85, 255, 0.08)',
                            border: '0.5px solid rgba(136, 85, 255, 0.25)',
                          }}
                        >
                          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                            Use the Evidence Wizard to collect and organise your four-element test documentation:
                          </p>
                          <Link
                            href={`/dashboard/forensic-audit/rnd/evidence?project=${encodeURIComponent(financialYear)}`}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all hover:brightness-110"
                            style={{
                              background: '#8855FF',
                              color: '#FFFFFF',
                            }}
                          >
                            <span>|=|</span>
                            <span>Open Evidence Wizard</span>
                          </Link>
                        </div>
                      )}

                      {/* Links */}
                      {step.links && step.links.length > 0 && (
                        <div className="space-y-2">
                          {step.links.map((link, i) => (
                            <a
                              key={i}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs transition-colors hover:brightness-110"
                              style={{ color: '#00F5FF' }}
                            >
                              <span>-&gt;</span>
                              <span>{link.label}</span>
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Action button for current step */}
                      {isStepCurrent && onUpdateStatus && (
                        <button
                          onClick={() => {
                            if (index === 2) {
                              onUpdateStatus('in_progress')
                            } else if (index === 3) {
                              onUpdateStatus('submitted')
                            } else if (index === 4) {
                              onUpdateStatus('approved')
                            }
                          }}
                          className="mt-4 py-2 px-4 rounded text-sm font-medium transition-all hover:brightness-110"
                          style={{
                            background: '#8855FF',
                            color: '#FFFFFF',
                          }}
                        >
                          Mark as Complete
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {/* Completed state */}
      {isCompleted && (
        <div
          className="p-5"
          style={{
            background: 'rgba(0, 255, 136, 0.1)',
            borderTop: '0.5px solid rgba(0, 255, 136, 0.2)',
          }}
        >
          <p className="text-sm font-medium" style={{ color: '#00FF88' }}>
            + Registration Complete
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {financialYear} R&D activities registered with AusIndustry.
            Remember to lodge Schedule 16N with your Company Tax Return.
          </p>
        </div>
      )}
    </div>
  )
}

export default RegistrationWorkflow
