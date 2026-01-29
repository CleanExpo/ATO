/**
 * Example Form Component with Validation
 *
 * Demonstrates proper form validation using Zod schemas with user-friendly error messages.
 * Can be used as a template for other forms in the application.
 */

'use client'

import { useState } from 'react'
import { z } from 'zod'
import { analyzeRequestSchema } from '@/lib/validation/schemas'
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'

type FormData = z.infer<typeof analyzeRequestSchema>
type FormErrors = Partial<Record<keyof FormData, string>>

interface AnalyzeFormProps {
  tenantId: string
  onSuccess?: (data: FormData) => void
}

export function AnalyzeForm({ tenantId, onSuccess }: AnalyzeFormProps) {
  const [formData, setFormData] = useState<Partial<FormData>>({
    tenantId,
    batchSize: 50,
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string>('')

  /**
   * Validate a single field as user types (real-time validation)
   */
  const validateField = (fieldName: keyof FormData, value: unknown) => {
    try {
      // Validate just this field using Zod's pick
      const fieldSchema = analyzeRequestSchema.pick({ [fieldName]: true } as any)
      fieldSchema.parse({ [fieldName]: value })

      // Clear error for this field
      setErrors((prev) => {
        const updated = { ...prev }
        delete updated[fieldName]
        return updated
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldError = error.errors[0]
        setErrors((prev) => ({
          ...prev,
          [fieldName]: fieldError.message,
        }))
      }
    }
  }

  /**
   * Validate entire form before submission
   */
  const validateForm = (): boolean => {
    try {
      analyzeRequestSchema.parse(formData)
      setErrors({})
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors: FormErrors = {}
        error.errors.forEach((err) => {
          const path = err.path[0] as keyof FormData
          validationErrors[path] = err.message
        })
        setErrors(validationErrors)
      }
      return false
    }
  }

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    setSubmitSuccess(false)

    // Validate form
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      // Submit to API
      const response = await fetch('/api/audit/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        // API returned error
        throw new Error(data.error || 'Failed to start analysis')
      }

      // Success!
      setSubmitSuccess(true)
      if (onSuccess) {
        onSuccess(formData as FormData)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Handle field changes with real-time validation
   */
  const handleChange = (field: keyof FormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    validateField(field, value)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Batch Size */}
      <div>
        <label htmlFor="batchSize" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
          Batch Size
        </label>
        <input
          id="batchSize"
          type="number"
          min={1}
          max={100}
          value={formData.batchSize ?? 50}
          onChange={(e) => handleChange('batchSize', parseInt(e.target.value, 10))}
          className={`
            w-full px-4 py-2 rounded-lg
            bg-[var(--void-elevated)] border
            ${errors.batchSize ? 'border-red-500' : 'border-[var(--border-default)]'}
            text-[var(--text-primary)]
            focus:outline-none focus:ring-2
            ${errors.batchSize ? 'focus:ring-red-500' : 'focus:ring-[var(--accent-primary)]'}
          `}
          disabled={isSubmitting}
        />
        {errors.batchSize && (
          <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.batchSize}
          </p>
        )}
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Number of transactions to analyze per batch (1-100)
        </p>
      </div>

      {/* Business Name (Optional) */}
      <div>
        <label htmlFor="businessName" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
          Business Name <span className="text-[var(--text-muted)]">(Optional)</span>
        </label>
        <input
          id="businessName"
          type="text"
          value={formData.businessName ?? ''}
          onChange={(e) => handleChange('businessName', e.target.value || undefined)}
          className={`
            w-full px-4 py-2 rounded-lg
            bg-[var(--void-elevated)] border
            ${errors.businessName ? 'border-red-500' : 'border-[var(--border-default)]'}
            text-[var(--text-primary)]
            focus:outline-none focus:ring-2
            ${errors.businessName ? 'focus:ring-red-500' : 'focus:ring-[var(--accent-primary)]'}
          `}
          disabled={isSubmitting}
        />
        {errors.businessName && (
          <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.businessName}
          </p>
        )}
      </div>

      {/* Industry (Optional) */}
      <div>
        <label htmlFor="industry" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
          Industry <span className="text-[var(--text-muted)]">(Optional)</span>
        </label>
        <input
          id="industry"
          type="text"
          value={formData.industry ?? ''}
          onChange={(e) => handleChange('industry', e.target.value || undefined)}
          className={`
            w-full px-4 py-2 rounded-lg
            bg-[var(--void-elevated)] border
            ${errors.industry ? 'border-red-500' : 'border-[var(--border-default)]'}
            text-[var(--text-primary)]
            focus:outline-none focus:ring-2
            ${errors.industry ? 'focus:ring-red-500' : 'focus:ring-[var(--accent-primary)]'}
          `}
          disabled={isSubmitting}
        />
        {errors.industry && (
          <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.industry}
          </p>
        )}
      </div>

      {/* ABN (Optional) */}
      <div>
        <label htmlFor="abn" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
          ABN <span className="text-[var(--text-muted)]">(Optional)</span>
        </label>
        <input
          id="abn"
          type="text"
          value={formData.abn ?? ''}
          onChange={(e) => handleChange('abn', e.target.value || undefined)}
          className={`
            w-full px-4 py-2 rounded-lg
            bg-[var(--void-elevated)] border
            ${errors.abn ? 'border-red-500' : 'border-[var(--border-default)]'}
            text-[var(--text-primary)]
            focus:outline-none focus:ring-2
            ${errors.abn ? 'focus:ring-red-500' : 'focus:ring-[var(--accent-primary)]'}
          `}
          disabled={isSubmitting}
        />
        {errors.abn && (
          <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.abn}
          </p>
        )}
      </div>

      {/* Submit Error */}
      {submitError && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-400 mb-1">Submission Failed</p>
              <p className="text-sm text-red-400">{submitError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Submit Success */}
      {submitSuccess && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-400 mb-1">Analysis Started</p>
              <p className="text-sm text-green-400">
                AI analysis is now running. Check the status page for progress.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || submitSuccess}
        className="
          w-full px-6 py-3 rounded-lg
          bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/90
          text-white font-medium
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-2
          transition-colors
        "
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Starting Analysis...
          </>
        ) : submitSuccess ? (
          <>
            <CheckCircle2 className="w-5 h-5" />
            Analysis Started
          </>
        ) : (
          'Start AI Analysis'
        )}
      </button>
    </form>
  )
}
