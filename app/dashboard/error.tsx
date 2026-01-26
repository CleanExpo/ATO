'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Dashboard error:', error)
    }, [error])

    return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#050505' }}>
            <div className="max-w-lg w-full glass-card p-8">
                <div className="text-center">
                    <div className="mb-4">
                        <div className="w-16 h-16 mx-auto rounded-sm flex items-center justify-center" style={{ background: 'rgba(255, 184, 0, 0.1)', border: '0.5px solid rgba(255, 184, 0, 0.2)' }}>
                            <svg
                                className="h-8 w-8"
                                style={{ color: 'var(--color-warning)' }}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                        Dashboard Error
                    </h1>

                    <p className="text-[var(--text-secondary)] mb-6">
                        Unable to load the dashboard. This might be due to a configuration issue or network problem.
                    </p>

                    {process.env.NODE_ENV === 'development' && (
                        <div className="mb-6 p-4 rounded-sm text-left" style={{ background: 'rgba(255, 68, 68, 0.08)', border: '0.5px solid rgba(255, 68, 68, 0.2)' }}>
                            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-error)' }}>Error Details:</p>
                            <p className="text-sm font-mono break-words" style={{ color: 'rgba(255, 68, 68, 0.8)' }}>
                                {error.message}
                            </p>
                        </div>
                    )}

                    <div className="mb-6 p-4 rounded-sm text-left" style={{ background: 'rgba(0, 245, 255, 0.05)', border: '0.5px solid rgba(0, 245, 255, 0.15)' }}>
                        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--accent-primary)' }}>Common Solutions:</p>
                        <ul className="text-sm text-[var(--text-secondary)] space-y-1">
                            <li>• Check that all environment variables are set correctly</li>
                            <li>• Verify your Xero connection is active</li>
                            <li>• Ensure you have a stable internet connection</li>
                            <li>• Try refreshing the page or clearing your browser cache</li>
                        </ul>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={reset}
                            className="btn btn-primary w-full"
                        >
                            Try Again
                        </button>

                        <Link
                            href="/"
                            className="btn btn-secondary w-full text-center"
                        >
                            Go Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
