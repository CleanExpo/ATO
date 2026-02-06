/**
 * Global Error Boundary
 *
 * Catches React errors and displays user-friendly error messages.
 */

'use client'

import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    this.setState({
      error,
      errorInfo,
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-[var(--void-elevated)]">
          <div className="glass-card p-8 max-w-2xl w-full">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                  Something went wrong
                </h1>
                <p className="text-[var(--text-secondary)] mb-4">
                  An unexpected error occurred. We've been notified and are looking into it.
                </p>

                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="mb-4">
                    <summary className="cursor-pointer text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-2">
                      Show error details (development only)
                    </summary>
                    <div className="bg-black/20 rounded-lg p-4 font-mono text-xs text-red-400 overflow-auto max-h-64">
                      <div className="mb-2 font-bold">{this.state.error.name}</div>
                      <div className="mb-4">{this.state.error.message}</div>
                      {this.state.error.stack && (
                        <pre className="text-[var(--text-muted)] whitespace-pre-wrap">
                          {this.state.error.stack}
                        </pre>
                      )}
                    </div>
                  </details>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={this.handleReset}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try again
                  </button>
                  <button
                    onClick={() => (window.location.href = '/dashboard')}
                    className="btn btn-secondary"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--border-default)] pt-4 text-sm text-[var(--text-muted)]">
              <p>
                If this problem persists, please contact support with the error details.
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Simpler error fallback component
 */
export function ErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="glass-card p-6 border-l-4 border-l-red-500 bg-red-500/5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-[var(--text-primary)] mb-1">Error Loading Component</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            {error.message || 'An unexpected error occurred'}
          </p>
          <button onClick={reset} className="btn btn-sm btn-secondary flex items-center gap-2">
            <RefreshCw className="w-3 h-3" />
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
