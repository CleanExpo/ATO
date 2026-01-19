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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-lg w-full bg-white shadow-lg rounded-lg p-8">
                <div className="text-center">
                    <div className="mb-4">
                        <svg
                            className="mx-auto h-12 w-12 text-yellow-500"
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

                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        Dashboard Error
                    </h1>

                    <p className="text-gray-600 mb-6">
                        Unable to load the dashboard. This might be due to a configuration issue or network problem.
                    </p>

                    {process.env.NODE_ENV === 'development' && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-left">
                            <p className="text-xs font-semibold text-red-700 mb-1">Error Details:</p>
                            <p className="text-sm font-mono text-red-800 break-words">
                                {error.message}
                            </p>
                        </div>
                    )}

                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded text-left">
                        <p className="text-sm font-semibold text-blue-900 mb-2">Common Solutions:</p>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>• Check that all environment variables are set correctly</li>
                            <li>• Verify your Xero connection is active</li>
                            <li>• Ensure you have a stable internet connection</li>
                            <li>• Try refreshing the page or clearing your browser cache</li>
                        </ul>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={reset}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                        >
                            Try Again
                        </button>

                        <Link
                            href="/"
                            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-center font-medium"
                        >
                            Go Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
