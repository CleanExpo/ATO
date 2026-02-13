import { createBrowserClient } from '@supabase/ssr'
import { clientConfig } from '@/lib/config/env'

export function createClient() {
  const supabaseUrl = clientConfig.supabase.url
  const supabaseAnonKey = clientConfig.supabase.anonKey

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    )
  }

  try {
    return createBrowserClient(supabaseUrl, supabaseAnonKey)
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
    throw new Error(
      'Supabase client initialization failed. Please check your environment variables.'
    )
  }
}
