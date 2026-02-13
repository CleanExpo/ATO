'use client'

/**
 * ErrorState - Standardised error display with retry
 *
 * Shows an error message with optional retry button.
 * Used across dashboard pages for consistent error UX.
 */

import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`card p-8 text-center ${className}`}>
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
        style={{ background: 'rgba(248, 113, 113, 0.1)' }}
      >
        <AlertTriangle className="w-6 h-6 text-red-400" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-white/50 mb-6 max-w-md mx-auto">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      )}
    </div>
  )
}

export default ErrorState
