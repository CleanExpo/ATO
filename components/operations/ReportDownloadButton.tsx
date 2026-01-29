'use client'

/**
 * Report Download Button
 *
 * Enhanced download button that shows inline progress during report generation.
 * Morphs between idle, generating, and ready states with smooth animations.
 */

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Loader2, CheckCircle2, AlertCircle, FileText, Table } from 'lucide-react'
import { useOperations } from '@/lib/operations/operation-context'
import { ANIMATION_PRESETS } from '@/lib/operations/types'

type ReportType = 'pdf' | 'excel' | 'client-report' | 'amendment-schedules'
type ButtonState = 'idle' | 'generating' | 'ready' | 'error'

interface ReportDownloadButtonProps {
  type: ReportType
  label: string
  onDownload: () => Promise<Blob | void>
  filename?: string
  className?: string
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

const REPORT_CONFIG: Record<ReportType, {
  icon: typeof FileText
  colour: string
  estimatedTime: string
}> = {
  pdf: {
    icon: FileText,
    colour: '#ef4444',
    estimatedTime: '15-30 seconds'
  },
  excel: {
    icon: Table,
    colour: '#22c55e',
    estimatedTime: '1-2 minutes'
  },
  'client-report': {
    icon: FileText,
    colour: '#8b5cf6',
    estimatedTime: '15-30 seconds'
  },
  'amendment-schedules': {
    icon: FileText,
    colour: '#f59e0b',
    estimatedTime: '10-15 seconds'
  }
}

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base'
}

const VARIANT_CLASSES = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800',
  secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50'
}

export function ReportDownloadButton({
  type,
  label,
  onDownload,
  filename,
  className = '',
  variant = 'secondary',
  size = 'md'
}: ReportDownloadButtonProps) {
  const [state, setState] = useState<ButtonState>('idle')
  const [progress, setProgress] = useState(0)
  const { startOperation, updateOperation, completeOperation, toast } = useOperations()

  const config = REPORT_CONFIG[type]

  const handleDownload = useCallback(async () => {
    if (state === 'generating') return

    setState('generating')
    setProgress(0)

    // Start operation tracking
    const operationId = startOperation({
      type: 'report',
      title: `Generating ${label}`,
      subtitle: `Estimated time: ${config.estimatedTime}`,
      progress: 0
    })

    // Simulate progress (actual progress would come from API)
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const next = Math.min(prev + Math.random() * 15, 90)
        updateOperation(operationId, { progress: next })
        return next
      })
    }, 500)

    try {
      const result = await onDownload()

      clearInterval(progressInterval)
      setProgress(100)
      updateOperation(operationId, { progress: 100 })

      // If we got a blob, trigger download
      if (result instanceof Blob) {
        const url = URL.createObjectURL(result)
        const a = document.createElement('a')
        a.href = url
        a.download = filename || `report-${Date.now()}.${type === 'excel' ? 'xlsx' : 'pdf'}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      completeOperation(operationId)
      setState('ready')
      toast.success('Report ready', `${label} has been downloaded`)

      // Reset after showing success
      setTimeout(() => {
        setState('idle')
        setProgress(0)
      }, 2000)

    } catch (error) {
      clearInterval(progressInterval)
      completeOperation(operationId, error instanceof Error ? error.message : 'Download failed')
      setState('error')
      toast.error('Download failed', error instanceof Error ? error.message : 'Please try again')

      // Reset after showing error
      setTimeout(() => {
        setState('idle')
        setProgress(0)
      }, 3000)
    }
  }, [state, type, label, filename, config.estimatedTime, onDownload, startOperation, updateOperation, completeOperation, toast])

  return (
    <motion.button
      onClick={handleDownload}
      disabled={state === 'generating'}
      whileHover={state === 'idle' ? { scale: 1.02 } : {}}
      whileTap={state === 'idle' ? { scale: 0.98 } : {}}
      className={`
        relative overflow-hidden rounded-lg font-medium
        transition-all duration-200 flex items-center gap-2
        disabled:cursor-not-allowed
        ${SIZE_CLASSES[size]}
        ${state === 'idle' ? VARIANT_CLASSES[variant] : ''}
        ${state === 'generating' ? 'bg-slate-100 text-slate-600' : ''}
        ${state === 'ready' ? 'bg-emerald-100 text-emerald-700' : ''}
        ${state === 'error' ? 'bg-red-100 text-red-700' : ''}
        ${className}
      `}
    >
      {/* Progress background */}
      <AnimatePresence>
        {state === 'generating' && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-200"
            style={{ originX: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Content */}
      <span className="relative flex items-center gap-2">
        <AnimatePresence mode="wait">
          {state === 'idle' && (
            <motion.span
              key="idle"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
            >
              <Download className="w-4 h-4" />
            </motion.span>
          )}
          {state === 'generating' && (
            <motion.span
              key="generating"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, rotate: 360 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                opacity: { duration: 0.15 },
                rotate: { duration: 1, repeat: Infinity, ease: 'linear' }
              }}
            >
              <Loader2 className="w-4 h-4" />
            </motion.span>
          )}
          {state === 'ready' && (
            <motion.span
              key="ready"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', ...ANIMATION_PRESETS.spring.bouncy }}
            >
              <CheckCircle2 className="w-4 h-4" />
            </motion.span>
          )}
          {state === 'error' && (
            <motion.span
              key="error"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
            >
              <AlertCircle className="w-4 h-4" />
            </motion.span>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {state === 'idle' && (
            <motion.span
              key="label-idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {label}
            </motion.span>
          )}
          {state === 'generating' && (
            <motion.span
              key="label-generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Generating... {progress.toFixed(0)}%
            </motion.span>
          )}
          {state === 'ready' && (
            <motion.span
              key="label-ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Downloaded
            </motion.span>
          )}
          {state === 'error' && (
            <motion.span
              key="label-error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Failed
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  )
}

export default ReportDownloadButton
