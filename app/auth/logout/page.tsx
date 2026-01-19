'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LogoutPage() {
    const router = useRouter()

    useEffect(() => {
        const run = async () => {
            const supabase = createClient()
            await supabase.auth.signOut()
            router.push('/')
        }

        run()
    }, [router])

    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="glass-card p-8 text-center max-w-md">
                <div className="w-14 h-14 rounded-2xl bg-slate-500/20 flex items-center justify-center mx-auto mb-4">
                    <LogOut className="w-6 h-6 text-slate-200" />
                </div>
                <h1 className="text-xl font-semibold mb-2">Signing you out</h1>
                <p className="text-sm text-[var(--text-secondary)]">Redirecting to the homepage...</p>
            </div>
        </div>
    )
}
