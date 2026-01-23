'use client'

/**
 * Toast Component
 *
 * Individual toast notification with animations.
 * Australian English localisation.
 */

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'
import type { Toast as ToastType, ToastType as ToastVariant } from '@/lib/operations/types'
import { ANIMATION_PRESETS } from '@/lib/operations/types'

interface ToastProps {
  toast: ToastType
  onDismiss: (id: string) => void
}

// Icon and colour mapping
const TOAST_CONFIG: Record<ToastVariant, {
  icon: typeof CheckCircle2
  bgColour: string
  borderColour: string
  iconColour: string
}> = {
  success: {
    icon: CheckCircle2,
    bgColour: 'bg-emerald-50',
    borderColour: 'border-emerald-200',
    iconColour: 'text-emerald-500'
  },
  error: {
    icon: AlertCircle,
    bgColour: 'bg-red-50',
    borderColour: 'border-red-200',
    iconColour: 'text-red-500'
  },
  info: {
    icon: Info,
    bgColour: 'bg-blue-50',
    borderColour: 'border-blue-200',
    iconColour: 'text-blue-500'
  },
  warning: {
    icon: AlertTriangle,
    bgColour: 'bg-amber-50',
    borderColour: 'border-amber-200',
    iconColour: 'text-amber-500'
  }
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const config = TOAST_CONFIG[toast.type]
  const Icon = config.icon

  // Auto-dismiss timer
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id)
      }, toast.duration)

      return () => clearTimeout(timer)
    }
  }, [toast.id, toast.duration, onDismiss])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ type: 'spring', ...ANIMATION_PRESETS.spring.snappy }}
      className={`
        relative w-80 p-4 rounded-xl border shadow-lg backdrop-blur-sm
        ${config.bgColour} ${config.borderColour}
      `}
    >
      {/* Progress bar for auto-dismiss */}
      {toast.duration && toast.duration > 0 && (
        <motion.div
          className="absolute bottom-0 left-0 h-1 rounded-b-xl bg-current opacity-20"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: toast.duration / 1000, ease: 'linear' }}
          style={{ color: config.iconColour.replace('text-', '') }}
        />
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1, ...ANIMATION_PRESETS.spring.bouncy }}
          className={config.iconColour}
        >
          <Icon className="w-5 h-5" />
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm">
            {toast.title}
          </p>
          {toast.message && (
            <p className="text-slate-600 text-sm mt-0.5">
              {toast.message}
            </p>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* Dismiss button */}
        {toast.dismissible !== false && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onDismiss(toast.id)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

export default Toast
