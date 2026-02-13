/**
 * Xero OAuth Callback Page
 *
 * Handles the OAuth redirect from Xero after user authorization
 */

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function XeroCallbackContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
    const [message, setMessage] = useState('Connecting to Xero...')

    useEffect(() => {
        async function handleCallback() {
            try {
                // Get authorization code from URL
                const code = searchParams.get('code')
                const state = searchParams.get('state')
                const error = searchParams.get('error')

                if (error) {
                    throw new Error(`Xero authorization failed: ${error}`)
                }

                if (!code) {
                    throw new Error('No authorization code received from Xero')
                }

                // Verify state to prevent CSRF attacks
                const savedState = sessionStorage.getItem('xero_oauth_state')
                if (!savedState || savedState !== state) {
                    throw new Error('Invalid state parameter - possible CSRF attack')
                }

                setMessage('Exchanging authorization code for tokens...')

                // Exchange code for tokens
                const response = await fetch('/api/auth/xero/callback', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ code }),
                })

                const data = await response.json()

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to connect to Xero')
                }

                setMessage('Successfully connected to Xero!')
                setStatus('success')

                // Clean up state
                sessionStorage.removeItem('xero_oauth_state')

                // Redirect to dashboard after 2 seconds
                setTimeout(() => {
                    router.push('/dashboard/forensic-audit')
                }, 2000)

            } catch (err) {
                console.error('Xero OAuth callback error:', err)
                setStatus('error')
                setMessage(err instanceof Error ? err.message : 'Failed to connect to Xero')
            }
        }

        handleCallback()
    }, [searchParams, router])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
                <div className="text-center">
                    {/* Status Icon */}
                    <div className="mb-6">
                        {status === 'processing' && (
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100">
                                <svg
                                    className="animate-spin h-8 w-8 text-blue-600"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    ></circle>
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                </svg>
                            </div>
                        )}
                        {status === 'success' && (
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
                                <svg
                                    className="h-8 w-8 text-green-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                        )}
                        {status === 'error' && (
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
                                <svg
                                    className="h-8 w-8 text-red-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* Message */}
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">
                        {status === 'processing' && 'Connecting to Xero'}
                        {status === 'success' && 'Connection Successful'}
                        {status === 'error' && 'Connection Failed'}
                    </h1>
                    <p className="text-gray-600 mb-6">{message}</p>

                    {/* Actions */}
                    {status === 'error' && (
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                            Return to Dashboard
                        </button>
                    )}
                    {status === 'success' && (
                        <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function XeroCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
                    <div className="text-center">
                        <div className="mb-6">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100">
                                <svg
                                    className="animate-spin h-8 w-8 text-blue-600"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    ></circle>
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">Loading...</h1>
                        <p className="text-gray-600">Please wait...</p>
                    </div>
                </div>
            </div>
        }>
            <XeroCallbackContent />
        </Suspense>
    )
}
