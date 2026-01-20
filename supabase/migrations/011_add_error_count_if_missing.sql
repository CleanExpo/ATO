-- ============================================================================
-- MIGRATION 011: ADD ERROR_COUNT COLUMN IF MISSING
-- ============================================================================
-- Ensures audit_sync_status has error_count column

-- Add error_count column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_sync_status' AND column_name = 'error_count'
    ) THEN
        ALTER TABLE audit_sync_status
        ADD COLUMN error_count INTEGER DEFAULT 0;

        RAISE NOTICE 'Added error_count column to audit_sync_status';
    ELSE
        RAISE NOTICE 'error_count column already exists';
    END IF;
END $$;

-- Add last_error_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_sync_status' AND column_name = 'last_error_at'
    ) THEN
        ALTER TABLE audit_sync_status
        ADD COLUMN last_error_at TIMESTAMPTZ;

        RAISE NOTICE 'Added last_error_at column to audit_sync_status';
    ELSE
        RAISE NOTICE 'last_error_at column already exists';
    END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Migration 011 Complete!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Added error tracking columns to audit_sync_status';
END $$;
