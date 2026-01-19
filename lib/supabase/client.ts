import { createBrowserClient } from '@supabase/ssr'
import { clientConfig } from '@/lib/config/env'

export function createClient() {
  try {
    return createBrowserClient(
      clientConfig.supabase.url,
      clientConfig.supabase.anonKey
    )
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
    throw new Error(
      'Supabase client initialization failed. Please check your environment variables.'
    )
  }
}
