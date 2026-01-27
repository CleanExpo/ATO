'use client'

/**
 * EvidenceUpload
 *
 * Upload component for R&D evidence documents.
 * Integrates with existing document upload system from Phase 9.
 *
 * Scientific Luxury design system.
 * Division 355 ITAA 1997 - R&D evidence documentation.
 */

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  validateFile,
  formatFileSize,
  getFileIcon,
  MAX_FILE_SIZE_LABEL,
  ALLOWED_EXTENSIONS,
} from '@/lib/types/recommendation-documents'
import { type EvidenceElement, getElementDisplayName } from '@/lib/types/rnd-evidence'

interface EvidenceUploadProps {
  element: EvidenceElement
  projectName: string
  tenantId: string
  onUploadComplete: (documentId: string, fileName: string) => void
  disabled?: boolean
  className?: string
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'success' | 'error'

export function EvidenceUpload({
  element,
  projectName,
  tenantId,
  onUploadComplete,
  disabled = false,
  className = '',
}: EvidenceUploadProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!disabled) {
        setState('dragging')
      }
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setState('idle')
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setState('idle')

      if (disabled) return

      const files = e.dataTransfer.files
      if (files.length > 0) {
        handleFileSelect(files[0])
      }
    },
    [disabled]
  )

  const handleFileSelect = (file: File) => {
    const validation = validateFile(file)
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid file')
      setState('error')
      return
    }

    setSelectedFile(file)
    setError(null)
    setState('idle')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setState('uploading')
    setUploadProgress(0)

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90))
    }, 200)

    try {
      // Create form data for upload
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('tenantId', tenantId)
      formData.append('recommendationId', `rnd-evidence-${projectName}`)
      formData.append('description', description || `Evidence for ${getElementDisplayName(element)}`)

      // Upload to recommendation documents endpoint
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      setUploadProgress(100)
      setState('success')

      // Notify parent with document ID
      setTimeout(() => {
        onUploadComplete(data.document.id, selectedFile.name)
        handleReset()
      }, 1000)
    } catch (err) {
      clearInterval(progressInterval)
      setError(err instanceof Error ? err.message : 'Upload failed')
      setState('error')
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setDescription('')
    setError(null)
    setState('idle')
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const icon = selectedFile ? getFileIcon(selectedFile.type) : '|=|'

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !selectedFile && fileInputRef.current?.click()}
        className={`
          relative border rounded-sm p-5 text-center transition-all cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/30'}
        `}
        style={{
          background:
            state === 'dragging'
              ? 'rgba(136, 85, 255, 0.08)'
              : state === 'error'
              ? 'rgba(255, 68, 68, 0.05)'
              : state === 'success'
              ? 'rgba(0, 255, 136, 0.05)'
              : 'rgba(255, 255, 255, 0.02)',
          borderColor:
            state === 'dragging'
              ? 'rgba(136, 85, 255, 0.5)'
              : state === 'error'
              ? 'rgba(255, 68, 68, 0.5)'
              : state === 'success'
              ? 'rgba(0, 255, 136, 0.5)'
              : 'rgba(255, 255, 255, 0.15)',
          borderStyle: 'dashed',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleInputChange}
          accept={ALLOWED_EXTENSIONS.join(',')}
          className="hidden"
          disabled={disabled}
        />

        <AnimatePresence mode="wait">
          {selectedFile ? (
            <motion.div
              key="selected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">{icon}</span>
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {selectedFile.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>

              {/* Description Input */}
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description (optional)"
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 text-sm rounded-sm focus:outline-none"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '0.5px solid rgba(255, 255, 255, 0.15)',
                  color: 'var(--text-primary)',
                }}
                disabled={state === 'uploading'}
              />

              {/* Progress Bar */}
              {state === 'uploading' && (
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255, 255, 255, 0.1)' }}
                >
                  <motion.div
                    className="h-full"
                    style={{ background: '#8855FF' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div
                className="flex items-center justify-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {state === 'uploading' ? (
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Uploading...
                  </span>
                ) : state === 'success' ? (
                  <span className="text-sm flex items-center gap-1" style={{ color: '#00FF88' }}>
                    <span>+</span>
                    Uploaded successfully
                  </span>
                ) : (
                  <>
                    <button
                      onClick={handleReset}
                      className="px-3 py-1.5 text-sm rounded-sm transition-colors hover:bg-white/10"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpload}
                      className="px-3 py-1.5 text-sm rounded-sm font-medium transition-all hover:brightness-110"
                      style={{
                        background: '#8855FF',
                        color: '#FFFFFF',
                      }}
                    >
                      Upload
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <div
                className="w-12 h-12 mx-auto rounded-sm flex items-center justify-center"
                style={{ background: 'rgba(136, 85, 255, 0.1)' }}
              >
                <svg
                  className="w-6 h-6"
                  style={{ color: '#8855FF' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span style={{ color: '#8855FF' }}>Click to upload</span> or drag and drop
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {ALLOWED_EXTENSIONS.join(', ')} up to {MAX_FILE_SIZE_LABEL}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3"
          >
            <p className="text-xs" style={{ color: '#FF4444' }}>
              {error}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default EvidenceUpload
