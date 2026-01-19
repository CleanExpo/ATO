import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()

    if (!data.user) {
        redirect('/auth/login?returnTo=/dashboard')
    }

    return <>{children}</>
}
