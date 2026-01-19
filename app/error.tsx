'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log error to console in development
        console.error('Root error boundary caught error:', error)
    }, [error])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">
                        Something went wrong
                    </h1>

                    <p className="text-gray-600 mb-6">
                        An unexpected error occurred. Please try again or return to the homepage.
                    </p>

                    {process.env.NODE_ENV === 'development' && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-left">
                            <p className="text-sm font-mono text-red-800 break-words">
                                {error.message}
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={reset}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            Try Again
                        </button>

                        <Link
                            href="/"
                            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-center"
                        >
                            Go Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
