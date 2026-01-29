'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { Suspense } from 'react'

function AuthErrorContent() {
    const searchParams = useSearchParams()
    const message = searchParams.get('message') || 'An error occurred during authentication'

    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="max-w-md w-full text-center">
                <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-10 h-10 text-red-400" />
                </div>

                <h1 className="text-2xl font-bold mb-4">Connection Failed</h1>

                <p className="text-[var(--text-secondary)] mb-8">
                    {message}
                </p>

                <div className="glass-card p-6 text-left mb-8">
                    <h2 className="font-semibold mb-3">Possible Causes:</h2>
                    <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                        <li>• OAuth consent was not granted</li>
                        <li>• The connection request timed out</li>
                        <li>• No Xero organizations are accessible</li>
                        <li>• Session state verification failed</li>
                    </ul>
                </div>

                <div className="flex items-center justify-center gap-4">
                    <Link href="/" className="btn btn-secondary">
                        <ArrowLeft className="w-4 h-4" />
                        Go Home
                    </Link>
                    <Link href="/api/auth/xero" className="btn btn-xero">
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                    </Link>
                </div>
            </div>
        </div>
    )
}

function AuthErrorFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="max-w-md w-full text-center">
                <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-10 h-10 text-red-400" />
                </div>
                <h1 className="text-2xl font-bold mb-4">Loading...</h1>
            </div>
        </div>
    )
}

export default function AuthErrorPage() {
    return (
        <Suspense fallback={<AuthErrorFallback />}>
            <AuthErrorContent />
        </Suspense>
    )
}
