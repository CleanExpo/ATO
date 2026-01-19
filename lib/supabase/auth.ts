import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function requireUser(): Promise<User | null> {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
        return null
    }

    return data.user
}
