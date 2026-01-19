'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [checking, setChecking] = useState(true)
    const [authorized, setAuthorized] = useState(false)

    useEffect(() => {
        let cancelled = false
        const supabase = createClient()

        supabase.auth.getSession().then(({ data }) => {
            if (cancelled) return
            const user = data.session?.user
            if (!user) {
                const returnTo = encodeURIComponent(pathname || '/dashboard')
                router.replace(`/auth/login?returnTo=${returnTo}`)
            } else {
                setAuthorized(true)
            }
        }).finally(() => {
            if (!cancelled) setChecking(false)
        })

        return () => { cancelled = true }
    }, [pathname, router])

    if (checking) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="loading-spinner" />
            </div>
        )
    }

    if (!authorized) {
        return null
    }

    return <>{children}</>
}
