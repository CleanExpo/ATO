/**
 * Supabase Database Types
 *
 * Placeholder types for Supabase database schema.
 * These should be regenerated using: npx supabase gen types typescript
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tax_alert_definitions: {
        Row: any
        Insert: any
        Update: any
      }
      tax_alerts: {
        Row: any
        Insert: any
        Update: any
      }
      [key: string]: {
        Row: any
        Insert: any
        Update: any
      }
    }
    Views: {
      [key: string]: {
        Row: any
      }
    }
    Functions: {
      [key: string]: any
    }
    Enums: {
      [key: string]: string
    }
  }
}
