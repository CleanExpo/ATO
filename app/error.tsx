/**
 * Root Error Page
 *
 * Catches errors in the app directory and displays user-friendly error messages.
 * Automatically reports errors to Sentry in production.
 */

'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { reportError, isSentryConfigured } from '@/lib/error-tracking/sentry'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Report error to Sentry in production
    reportError(error, {
      tags: {
        errorBoundary: 'root',
        digest: error.digest || 'none',
      },
      extra: {
        componentStack: error.stack,
        timestamp: new Date().toISOString(),
      },
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Root error boundary caught error:', error);
    }

    // Notify user if Sentry is not configured in production
    if (process.env.NODE_ENV === 'production' && !isSentryConfigured()) {
      console.warn(
        'SENTRY: Error tracking not configured. Set NEXT_PUBLIC_SENTRY_DSN to enable.'
      );
    }
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="glass-card p-8 max-w-2xl w-full border-l-4 border-l-red-500 bg-red-500/5">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Something went wrong
            </h1>
            <p className="text-[var(--text-secondary)] mb-4">
              An unexpected error occurred while loading this page. We've been notified and will look into it.
            </p>

            {process.env.NODE_ENV === 'development' && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-2">
                  Show error details (development only)
                </summary>
                <div className="bg-black/20 rounded-lg p-4 font-mono text-xs text-red-400 overflow-auto max-h-64">
                  <div className="mb-2 font-bold">{error.name}</div>
                  <div className="mb-2">{error.message}</div>
                  {error.digest && (
                    <div className="text-[var(--text-muted)] mb-2">
                      Error ID: {error.digest}
                    </div>
                  )}
                  {error.stack && (
                    <pre className="text-[var(--text-muted)] whitespace-pre-wrap text-xs">
                      {error.stack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={reset}
                className="btn btn-primary flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
              <Link href="/dashboard" className="btn btn-secondary flex items-center gap-2">
                <Home className="w-4 h-4" />
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--border-default)] pt-4 text-sm text-[var(--text-muted)]">
          <p>
            If this problem persists, please contact support with the error ID shown above.
          </p>
        </div>
      </div>
    </div>
  )
}
