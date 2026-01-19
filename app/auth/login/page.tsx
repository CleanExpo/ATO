'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Lock, Mail, UserPlus } from 'lucide-react'

type Mode = 'login' | 'signup'

function LoginContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const returnTo = searchParams.get('returnTo') || '/dashboard'

    const [mode, setMode] = useState<Mode>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [info, setInfo] = useState<string | null>(null)

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError(null)
        setInfo(null)
        setLoading(true)

        const supabase = createClient()
        const trimmedEmail = email.trim()

        try {
            if (mode === 'signup') {
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email: trimmedEmail,
                    password,
                })

                if (signUpError) {
                    setError(signUpError.message)
                } else if (!data.session) {
                    setInfo('Check your email to confirm your account, then sign in.')
                } else {
                    router.push(returnTo)
                }
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: trimmedEmail,
                    password,
                })

                if (signInError) {
                    setError(signInError.message)
                } else {
                    router.push(returnTo)
                }
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="w-full max-w-md glass-card p-8">
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center mx-auto mb-4">
                        {mode === 'signup' ? (
                            <UserPlus className="w-7 h-7 text-white" />
                        ) : (
                            <Lock className="w-7 h-7 text-white" />
                        )}
                    </div>
                    <h1 className="text-2xl font-bold mb-2">
                        {mode === 'signup' ? 'Create your account' : 'Welcome back'}
                    </h1>
                    <p className="text-[var(--text-secondary)] text-sm">
                        {mode === 'signup'
                            ? 'Create a secure account to connect Xero.'
                            : 'Sign in to continue your tax optimization workflow.'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-2">
                            Email address
                        </label>
                        <div className="relative">
                            <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                                type="email"
                                className="input pl-11"
                                placeholder="you@company.com"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                                type="password"
                                className="input pl-11"
                                placeholder="••••••••"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                            {error}
                        </div>
                    )}
                    {info && (
                        <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                            {info}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                        {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-[var(--text-secondary)]">
                    {mode === 'signup' ? (
                        <>
                            Already have an account?{' '}
                            <button
                                type="button"
                                className="text-sky-400 hover:text-sky-300"
                                onClick={() => setMode('login')}
                            >
                                Sign in
                            </button>
                        </>
                    ) : (
                        <>
                            Need an account?{' '}
                            <button
                                type="button"
                                className="text-emerald-400 hover:text-emerald-300"
                                onClick={() => setMode('signup')}
                            >
                                Create one
                            </button>
                        </>
                    )}
                </div>

                <div className="mt-8 flex items-center justify-center gap-3 text-sm">
                    <Link href="/" className="btn btn-ghost">
                        Back to home
                    </Link>
                </div>
            </div>
        </div>
    )
}

function LoginFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="glass-card p-8 text-center max-w-md">
                <h1 className="text-xl font-semibold mb-2">Loading...</h1>
                <p className="text-sm text-[var(--text-secondary)]">Preparing the sign-in page.</p>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={<LoginFallback />}>
            <LoginContent />
        </Suspense>
    )
}
