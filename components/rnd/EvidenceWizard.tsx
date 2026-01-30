'use client'

/**
 * EvidenceWizard
 *
 * Four-step wizard for collecting R&D evidence for each element
 * of the Division 355 four-element test.
 *
 * Scientific Luxury design system.
 * Division 355 ITAA 1997 - R&D Tax Incentive evidence collection.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  type EvidenceElement,
  type RndEvidence,
  type RndEvidenceScore,
  type CreateRndEvidenceRequest,
  EVIDENCE_ELEMENTS,
  ELEMENT_CONFIG,
  getScoreLevel,
  dbRowToRndEvidence,
} from '@/lib/types/rnd-evidence'
import { EVIDENCE_GUIDANCE, type EvidenceElementGuidance } from '@/lib/rnd/evidence-guidance'
import { EvidenceElementStep } from './EvidenceElementStep'
import { EvidenceScoreIndicator, EvidenceScoreBadge } from './EvidenceScoreIndicator'

interface EvidenceWizardProps {
  projectName: string
  tenantId: string
  registrationId?: string
  onComplete?: () => void
  onCancel?: () => void
  className?: string
}

interface ElementState {
  evidence: RndEvidence[]
  score: number
  isLoading: boolean
}

export function EvidenceWizard({
  projectName,
  tenantId,
  registrationId,
  onComplete,
  onCancel,
  className = '',
}: EvidenceWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [elementStates, setElementStates] = useState<Record<EvidenceElement, ElementState>>({
    outcome_unknown: { evidence: [], score: 0, isLoading: true },
    systematic_approach: { evidence: [], score: 0, isLoading: true },
    new_knowledge: { evidence: [], score: 0, isLoading: true },
    scientific_method: { evidence: [], score: 0, isLoading: true },
  })
  const [overallScore, setOverallScore] = useState(0)
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  const currentElement = EVIDENCE_ELEMENTS[currentStep]
  const currentConfig = ELEMENT_CONFIG[currentElement]
  const currentGuidance = EVIDENCE_GUIDANCE[currentElement]
  const currentState = elementStates[currentElement]

  // Load evidence and scores on mount
  useEffect(() => {
    loadEvidenceAndScores()
  }, [tenantId, projectName, registrationId])

  const loadEvidenceAndScores = useCallback(async () => {
    setIsInitialLoading(true)

    try {
      // Fetch evidence
      const evidenceParams = new URLSearchParams({
        tenantId,
        projectName,
        ...(registrationId && { registrationId }),
      })

      const evidenceRes = await fetch(`/api/rnd/evidence?${evidenceParams}`)
      if (!evidenceRes.ok) {
        throw new Error('Failed to fetch evidence data')
      }
      const evidenceData = await evidenceRes.json()

      // Fetch scores
      const scoreRes = await fetch(`/api/rnd/evidence/score?${evidenceParams}`)
      if (!scoreRes.ok) {
        throw new Error('Failed to fetch evidence scores')
      }
      const scoreData = await scoreRes.json()

      // Group evidence by element
      const evidenceByElement: Record<EvidenceElement, RndEvidence[]> = {
        outcome_unknown: [],
        systematic_approach: [],
        new_knowledge: [],
        scientific_method: [],
      }

      if (evidenceData.evidence) {
        evidenceData.evidence.forEach((e: RndEvidence) => {
          if (evidenceByElement[e.element]) {
            evidenceByElement[e.element].push(e)
          }
        })
      }

      // Get scores from response
      const projectScore = scoreData.scores?.[0]

      const newStates: Record<EvidenceElement, ElementState> = {
        outcome_unknown: {
          evidence: evidenceByElement.outcome_unknown,
          score: projectScore?.elementBreakdown?.outcome_unknown?.score ?? 0,
          isLoading: false,
        },
        systematic_approach: {
          evidence: evidenceByElement.systematic_approach,
          score: projectScore?.elementBreakdown?.systematic_approach?.score ?? 0,
          isLoading: false,
        },
        new_knowledge: {
          evidence: evidenceByElement.new_knowledge,
          score: projectScore?.elementBreakdown?.new_knowledge?.score ?? 0,
          isLoading: false,
        },
        scientific_method: {
          evidence: evidenceByElement.scientific_method,
          score: projectScore?.elementBreakdown?.scientific_method?.score ?? 0,
          isLoading: false,
        },
      }

      setElementStates(newStates)
      setOverallScore(projectScore?.overallScore ?? 0)
    } catch (error) {
      console.error('Failed to load evidence:', error)
    } finally {
      setIsInitialLoading(false)
    }
  }, [tenantId, projectName, registrationId])

  // Add evidence handler
  const handleAddEvidence = async (request: CreateRndEvidenceRequest) => {
    const response = await fetch('/api/rnd/evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to add evidence')
    }

    // Reload evidence and scores
    await loadEvidenceAndScores()
  }

  // Edit evidence handler (navigate to edit page or show modal)
  const handleEditEvidence = (evidence: RndEvidence) => {
    // For now, log - can expand to show edit modal
    console.log('Edit evidence:', evidence)
  }

  // Delete evidence handler
  const handleDeleteEvidence = async (evidence: RndEvidence) => {
    const response = await fetch(`/api/rnd/evidence/${evidence.id}?tenantId=${tenantId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete evidence')
    }

    // Reload evidence and scores
    await loadEvidenceAndScores()
  }

  const handleNext = () => {
    if (currentStep < EVIDENCE_ELEMENTS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    onComplete?.()
  }

  const isLastStep = currentStep === EVIDENCE_ELEMENTS.length - 1

  if (isInitialLoading) {
    return (
      <div className={`flex items-center justify-center p-12 ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#8855FF' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading evidence...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-sm overflow-hidden ${className}`}
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '0.5px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Header */}
      <div
        className="p-5"
        style={{ borderBottom: '0.5px solid rgba(255, 255, 255, 0.1)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Evidence Collection Wizard
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {projectName} - Division 355 Four-Element Test
            </p>
          </div>
          <EvidenceScoreIndicator
            score={overallScore}
            label="Overall Score"
            size="md"
            variant="circular"
          />
        </div>
      </div>

      {/* Step indicators */}
      <div
        className="px-5 py-3 flex items-center gap-2"
        style={{ background: 'rgba(0, 0, 0, 0.2)' }}
      >
        {EVIDENCE_ELEMENTS.map((element, index) => {
          const config = ELEMENT_CONFIG[element]
          const state = elementStates[element]
          const isActive = index === currentStep
          const isCompleted = index < currentStep
          const scoreLevel = getScoreLevel(state.score)

          return (
            <button
              key={element}
              onClick={() => setCurrentStep(index)}
              className="flex-1 flex flex-col items-center gap-1 py-2 rounded-sm transition-all"
              style={{
                background: isActive ? 'rgba(136, 85, 255, 0.1)' : 'transparent',
                border: isActive ? '0.5px solid rgba(136, 85, 255, 0.3)' : '0.5px solid transparent',
              }}
            >
              {/* Step indicator */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                style={{
                  background: isCompleted || isActive
                    ? scoreLevel.bgColor
                    : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${isCompleted || isActive ? scoreLevel.color : 'rgba(255, 255, 255, 0.1)'}`,
                  color: isCompleted || isActive ? scoreLevel.color : 'var(--text-muted)',
                }}
              >
                {index + 1}
              </div>
              <span
                className="text-xs truncate max-w-full px-1"
                style={{
                  color: isActive ? '#8855FF' : 'var(--text-muted)',
                }}
              >
                {config.shortTitle}
              </span>
            </button>
          )
        })}
      </div>

      {/* Progress bar */}
      <div className="px-5">
        <div
          className="h-0.5 rounded-full overflow-hidden"
          style={{ background: 'rgba(255, 255, 255, 0.1)' }}
        >
          <motion.div
            className="h-full"
            style={{ background: '#8855FF' }}
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / EVIDENCE_ELEMENTS.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentElement}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <EvidenceElementStep
              element={currentElement}
              guidance={currentGuidance}
              evidence={currentState.evidence}
              score={currentState.score}
              projectName={projectName}
              tenantId={tenantId}
              registrationId={registrationId}
              onAddEvidence={handleAddEvidence}
              onEditEvidence={handleEditEvidence}
              onDeleteEvidence={handleDeleteEvidence}
              isLoading={currentState.isLoading}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation footer */}
      <div
        className="p-5 flex items-center justify-between gap-4"
        style={{
          borderTop: '0.5px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded-sm transition-colors hover:bg-white/10"
              style={{ color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="px-4 py-2 text-sm rounded-sm transition-colors hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              border: '0.5px solid rgba(255, 255, 255, 0.2)',
              color: 'var(--text-secondary)',
            }}
          >
            Previous
          </button>

          {isLastStep ? (
            <button
              onClick={handleComplete}
              className="px-5 py-2 text-sm rounded-sm font-medium transition-all hover:brightness-110"
              style={{
                background: '#00FF88',
                color: '#050505',
              }}
            >
              Complete
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-5 py-2 text-sm rounded-sm font-medium transition-all hover:brightness-110"
              style={{
                background: '#8855FF',
                color: '#FFFFFF',
              }}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default EvidenceWizard
