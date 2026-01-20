-- ============================================================================
-- MIGRATION 013: RELOAD SCHEMA CACHE
-- ============================================================================
-- Force Supabase PostgREST to reload schema cache to recognize all columns
-- This fixes "Could not find column in schema cache" errors

-- The schema is correct, but PostgREST needs to reload its cache
-- This migration just forces a reload

-- Reload schema
NOTIFY pgrst, 'reload schema';

-- Add comment to track reload
COMMENT ON TABLE historical_transactions_cache IS 'Caches 5 years of Xero transactions for forensic tax audit analysis (schema reloaded 2026-01-20)';
COMMENT ON TABLE audit_sync_status IS 'Tracks historical data sync progress per organization (schema reloaded 2026-01-20)';
