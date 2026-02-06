/**
 * Global Error Page
 *
 * Catches errors in the root layout. Only used as a last resort.
 * Must be minimal and not rely on any external dependencies.
 */

'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error boundary caught error:', error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
            backgroundColor: '#0a0a0a',
            color: '#e4e4e7',
          }}
        >
          <div
            style={{
              maxWidth: '32rem',
              width: '100%',
              padding: '2rem',
              borderRadius: '1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            </div>

            <h1
              style={{
                fontSize: '1.875rem',
                fontWeight: 'bold',
                marginBottom: '0.5rem',
              }}
            >
              Critical Error
            </h1>

            <p
              style={{
                color: '#a1a1aa',
                marginBottom: '1.5rem',
                lineHeight: '1.6',
              }}
            >
              A critical error occurred that prevented the application from loading.
              We've been notified and are looking into it.
            </p>

            {process.env.NODE_ENV === 'development' && error.message && (
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  marginBottom: '1.5rem',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  color: '#fca5a5',
                  overflowX: 'auto',
                }}
              >
                {error.message}
                {error.digest && (
                  <div style={{ marginTop: '0.5rem', color: '#71717a' }}>
                    Error ID: {error.digest}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={reset}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500',
                }}
              >
                Try again
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#e4e4e7',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500',
                }}
              >
                Go Home
              </button>
            </div>

            <div
              style={{
                marginTop: '1.5rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '0.875rem',
                color: '#71717a',
              }}
            >
              If this problem persists, please contact support.
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
