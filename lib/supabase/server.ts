import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseAdminClient, type SupabaseClient } from '@supabase/supabase-js'

/** Type alias for the Supabase service client used across analysis engines and report generators */
export type SupabaseServiceClient = SupabaseClient
import { cookies } from 'next/headers'
import { clientConfig, serverConfig } from '@/lib/config/env'

/**
 * Timeout wrapper for cookies() to handle cold start race conditions
 */
async function getCookiesWithTimeout(timeoutMs: number = 5000) {
    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Cookies timeout')), timeoutMs)
        )

        const cookiesPromise = cookies()

        return await Promise.race([cookiesPromise, timeoutPromise]) as Awaited<ReturnType<typeof cookies>>
    } catch (error) {
        console.error('Failed to get cookies:', error)
        throw new Error('Failed to initialize cookies. This may be due to a cold start.')
    }
}

export async function createClient() {
    try {
        const cookieStore = await getCookiesWithTimeout()

        return createServerClient(
            clientConfig.supabase.url,
            clientConfig.supabase.anonKey,
            {
                cookies: {
                    async get(name: string) {
                        return cookieStore.get(name)?.value
                    },
                    async set(name: string, value: string, options: CookieOptions) {
                        try {
                            cookieStore.set({ name, value, ...options })
                        } catch (error) {
                            console.error('Failed to set cookie:', name, error)
                        }
                    },
                    async remove(name: string, options: CookieOptions) {
                        try {
                            cookieStore.set({ name, value: '', ...options })
                        } catch (error) {
                            console.error('Failed to remove cookie:', name, error)
                        }
                    },
                },
            }
        )
    } catch (error) {
        console.error('Failed to create Supabase server client:', error)
        throw new Error(
            'Supabase server client initialization failed. Please check your environment variables.'
        )
    }
}

export async function createServiceClient() {
    try {
        const cookieStore = await getCookiesWithTimeout()

        return createServerClient(
            clientConfig.supabase.url,
            serverConfig.supabase.serviceRoleKey,
            {
                cookies: {
                    async get(name: string) {
                        return cookieStore.get(name)?.value
                    },
                    async set(name: string, value: string, options: CookieOptions) {
                        try {
                            cookieStore.set({ name, value, ...options })
                        } catch (error) {
                            console.error('Failed to set cookie:', name, error)
                        }
                    },
                    async remove(name: string, options: CookieOptions) {
                        try {
                            cookieStore.set({ name, value: '', ...options })
                        } catch (error) {
                            console.error('Failed to remove cookie:', name, error)
                        }
                    },
                },
            }
        )
    } catch (error) {
        console.error('Failed to create Supabase service client:', error)
        throw new Error(
            'Supabase service client initialization failed. Please check your environment variables.'
        )
    }
}

/**
 * Create a true admin client that bypasses Row-Level Security (RLS).
 *
 * Uses @supabase/supabase-js createClient directly (NOT @supabase/ssr createServerClient)
 * so the service role key is used for BOTH the apikey AND Authorization headers.
 * This means auth.uid() is NULL and the client operates as service_role, bypassing all RLS.
 *
 * Use this for:
 * - Background jobs (sync, analysis) that run without a user session
 * - Server-side operations that need to read/write across all tenants
 * - Single-user mode where there is no Supabase auth user
 *
 * Do NOT use this for:
 * - Operations where you need the current user's identity (use createServiceClient instead)
 * - Client-side code (use createClient instead)
 */
export function createAdminClient(): SupabaseClient {
    return createSupabaseAdminClient(
        clientConfig.supabase.url,
        serverConfig.supabase.serviceRoleKey,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        }
    )
}
