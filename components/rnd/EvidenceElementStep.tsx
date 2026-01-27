'use client'

/**
 * EvidenceElementStep
 *
 * Per-element evidence collection step in the wizard.
 * Shows guidance, examples, existing evidence, and add evidence form.
 *
 * Scientific Luxury design system.
 * Division 355 ITAA 1997 - R&D evidence collection per element.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  type EvidenceElement,
  type EvidenceType,
  type RndEvidence,
  type CreateRndEvidenceRequest,
  ELEMENT_CONFIG,
  EVIDENCE_TYPE_LABELS,
  EVIDENCE_TYPE_ICONS,
} from '@/lib/types/rnd-evidence'
import { type EvidenceElementGuidance } from '@/lib/rnd/evidence-guidance'
import { EvidenceItem } from './EvidenceItem'
import { EvidenceUpload } from './EvidenceUpload'
import { EvidenceScoreIndicator } from './EvidenceScoreIndicator'

interface EvidenceElementStepProps {
  element: EvidenceElement
  guidance: EvidenceElementGuidance
  evidence: RndEvidence[]
  score: number
  projectName: string
  tenantId: string
  registrationId?: string
  onAddEvidence: (evidence: CreateRndEvidenceRequest) => Promise<void>
  onEditEvidence: (evidence: RndEvidence) => void
  onDeleteEvidence: (evidence: RndEvidence) => Promise<void>
  isLoading?: boolean
  className?: string
}

type AddMode = 'none' | 'description' | 'document' | 'reference'

export function EvidenceElementStep({
  element,
  guidance,
  evidence,
  score,
  projectName,
  tenantId,
  registrationId,
  onAddEvidence,
  onEditEvidence,
  onDeleteEvidence,
  isLoading = false,
  className = '',
}: EvidenceElementStepProps) {
  const [addMode, setAddMode] = useState<AddMode>('none')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [dateCreated, setDateCreated] = useState('')
  const [isContemporaneous, setIsContemporaneous] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const config = ELEMENT_CONFIG[element]

  const handleSubmit = async (evidenceType: EvidenceType, documentId?: string, docTitle?: string) => {
    if (evidenceType === 'description' && (!title.trim() || !description.trim())) {
      return
    }
    if (evidenceType === 'reference' && (!title.trim() || !url.trim())) {
      return
    }

    setIsSaving(true)
    try {
      const request: CreateRndEvidenceRequest = {
        tenantId,
        registrationId,
        projectName,
        element,
        evidenceType,
        title: evidenceType === 'document' ? (docTitle || title.trim()) : title.trim(),
        description: evidenceType === 'description' ? description.trim() : undefined,
        documentId: evidenceType === 'document' ? documentId : undefined,
        url: evidenceType === 'reference' ? url.trim() : undefined,
        dateCreated: dateCreated || undefined,
        isContemporaneous,
      }

      await onAddEvidence(request)
      resetForm()
    } finally {
      setIsSaving(false)
    }
  }

  const resetForm = () => {
    setAddMode('none')
    setTitle('')
    setDescription('')
    setUrl('')
    setDateCreated('')
    setIsContemporaneous(false)
  }

  const handleDocumentUpload = async (documentId: string, fileName: string) => {
    await handleSubmit('document', documentId, fileName)
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {config.title}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {config.legislationRef}
          </p>
        </div>
        <EvidenceScoreIndicator
          score={score}
          size="sm"
          variant="circular"
          showLabel={false}
        />
      </div>

      {/* Description */}
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {guidance.description}
      </p>

      {/* Guidance sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Examples */}
        <div
          className="p-4 rounded-sm"
          style={{
            background: 'rgba(136, 85, 255, 0.05)',
            border: '0.5px solid rgba(136, 85, 255, 0.2)',
          }}
        >
          <h4 className="text-xs font-medium mb-2" style={{ color: '#8855FF' }}>
            Evidence Examples
          </h4>
          <ul className="space-y-1.5">
            {guidance.examples.map((example, i) => (
              <li key={i} className="text-xs flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: '#8855FF' }}>-</span>
                <span>{example}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Suggested Documents */}
        <div
          className="p-4 rounded-sm"
          style={{
            background: 'rgba(0, 245, 255, 0.05)',
            border: '0.5px solid rgba(0, 245, 255, 0.2)',
          }}
        >
          <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--accent-primary)' }}>
            Suggested Documents
          </h4>
          <ul className="space-y-1.5">
            {guidance.suggestedDocuments.map((doc, i) => (
              <li key={i} className="text-xs flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-primary)' }}>|=|</span>
                <span>{doc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Existing evidence */}
      {evidence.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Collected Evidence ({evidence.length})
          </h4>
          <div className="space-y-2">
            {evidence.map((item) => (
              <EvidenceItem
                key={item.id}
                evidence={item}
                onEdit={onEditEvidence}
                onDelete={onDeleteEvidence}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {/* Add evidence section */}
      <div
        className="rounded-sm overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '0.5px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Add evidence header/buttons */}
        <AnimatePresence mode="wait">
          {addMode === 'none' ? (
            <motion.div
              key="buttons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                Add evidence for this element:
              </p>
              <div className="flex flex-wrap gap-2">
                <AddButton
                  type="description"
                  icon={EVIDENCE_TYPE_ICONS.description}
                  label={EVIDENCE_TYPE_LABELS.description}
                  onClick={() => setAddMode('description')}
                />
                <AddButton
                  type="document"
                  icon={EVIDENCE_TYPE_ICONS.document}
                  label={EVIDENCE_TYPE_LABELS.document}
                  onClick={() => setAddMode('document')}
                />
                <AddButton
                  type="reference"
                  icon={EVIDENCE_TYPE_ICONS.reference}
                  label={EVIDENCE_TYPE_LABELS.reference}
                  onClick={() => setAddMode('reference')}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 space-y-4"
            >
              {/* Form header */}
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Add {EVIDENCE_TYPE_LABELS[addMode as EvidenceType]}
                </h4>
                <button
                  onClick={resetForm}
                  className="text-xs px-2 py-1 rounded transition-colors hover:bg-white/10"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
              </div>

              {/* Description form */}
              {addMode === 'description' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Evidence title"
                    className="w-full px-3 py-2 text-sm rounded-sm focus:outline-none"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '0.5px solid rgba(255, 255, 255, 0.15)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the evidence in detail..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm rounded-sm resize-none focus:outline-none"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '0.5px solid rgba(255, 255, 255, 0.15)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <DateAndContemporaneousRow
                    dateCreated={dateCreated}
                    setDateCreated={setDateCreated}
                    isContemporaneous={isContemporaneous}
                    setIsContemporaneous={setIsContemporaneous}
                  />
                  <button
                    onClick={() => handleSubmit('description')}
                    disabled={!title.trim() || !description.trim() || isSaving}
                    className="w-full py-2 text-sm rounded-sm font-medium transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: '#8855FF',
                      color: '#FFFFFF',
                    }}
                  >
                    {isSaving ? 'Saving...' : 'Add Evidence'}
                  </button>
                </div>
              )}

              {/* Document upload */}
              {addMode === 'document' && (
                <div className="space-y-3">
                  <DateAndContemporaneousRow
                    dateCreated={dateCreated}
                    setDateCreated={setDateCreated}
                    isContemporaneous={isContemporaneous}
                    setIsContemporaneous={setIsContemporaneous}
                  />
                  <EvidenceUpload
                    element={element}
                    projectName={projectName}
                    tenantId={tenantId}
                    onUploadComplete={handleDocumentUpload}
                  />
                </div>
              )}

              {/* Reference URL form */}
              {addMode === 'reference' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Reference title"
                    className="w-full px-3 py-2 text-sm rounded-sm focus:outline-none"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '0.5px solid rgba(255, 255, 255, 0.15)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm rounded-sm focus:outline-none"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '0.5px solid rgba(255, 255, 255, 0.15)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <DateAndContemporaneousRow
                    dateCreated={dateCreated}
                    setDateCreated={setDateCreated}
                    isContemporaneous={isContemporaneous}
                    setIsContemporaneous={setIsContemporaneous}
                  />
                  <button
                    onClick={() => handleSubmit('reference')}
                    disabled={!title.trim() || !url.trim() || isSaving}
                    className="w-full py-2 text-sm rounded-sm font-medium transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: '#8855FF',
                      color: '#FFFFFF',
                    }}
                  >
                    {isSaving ? 'Saving...' : 'Add Reference'}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/**
 * Add evidence type button
 */
function AddButton({
  type,
  icon,
  label,
  onClick,
}: {
  type: string
  icon: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-medium transition-all hover:bg-white/10"
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: '0.5px solid rgba(255, 255, 255, 0.15)',
        color: 'var(--text-secondary)',
      }}
    >
      <span style={{ color: '#8855FF' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

/**
 * Date created and contemporaneous toggle row
 */
function DateAndContemporaneousRow({
  dateCreated,
  setDateCreated,
  isContemporaneous,
  setIsContemporaneous,
}: {
  dateCreated: string
  setDateCreated: (value: string) => void
  isContemporaneous: boolean
  setIsContemporaneous: (value: boolean) => void
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
          Date created (optional)
        </label>
        <input
          type="date"
          value={dateCreated}
          onChange={(e) => setDateCreated(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-sm focus:outline-none"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '0.5px solid rgba(255, 255, 255, 0.15)',
            color: 'var(--text-primary)',
          }}
        />
      </div>
      <div className="flex items-center gap-2 mt-5">
        <button
          type="button"
          onClick={() => setIsContemporaneous(!isContemporaneous)}
          className="w-5 h-5 rounded border flex items-center justify-center transition-colors"
          style={{
            background: isContemporaneous ? 'rgba(0, 255, 136, 0.2)' : 'transparent',
            borderColor: isContemporaneous ? '#00FF88' : 'rgba(255, 255, 255, 0.2)',
          }}
        >
          {isContemporaneous && (
            <span className="text-xs" style={{ color: '#00FF88' }}>
              +
            </span>
          )}
        </button>
        <label className="text-xs cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
          Contemporaneous
        </label>
      </div>
    </div>
  )
}

export default EvidenceElementStep
