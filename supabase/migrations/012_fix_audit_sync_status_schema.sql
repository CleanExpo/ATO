-- ============================================================================
-- MIGRATION 012: FIX AUDIT_SYNC_STATUS SCHEMA
-- ============================================================================
-- Add all missing columns to audit_sync_status table

-- Add sync_progress column
ALTER TABLE audit_sync_status ADD COLUMN IF NOT EXISTS sync_progress DECIMAL(5,2) DEFAULT 0;

-- Add error_message column
ALTER TABLE audit_sync_status ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add current_year_syncing column (renamed from current_year)
ALTER TABLE audit_sync_status ADD COLUMN IF NOT EXISTS current_year_syncing TEXT;

-- Add timestamps if missing
ALTER TABLE audit_sync_status ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE audit_sync_status ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Reload schema
NOTIFY pgrst, 'reload schema';
