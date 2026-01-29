-- ============================================================================
-- MIGRATION 008: UPDATE XERO CONNECTIONS TABLE
-- ============================================================================
-- Adds missing columns and indexes to existing xero_connections table

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add is_active column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'xero_connections' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE xero_connections ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;

    -- Add connection_status column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'xero_connections' AND column_name = 'connection_status'
    ) THEN
        ALTER TABLE xero_connections ADD COLUMN connection_status TEXT DEFAULT 'active';
    END IF;

    -- Add last_error column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'xero_connections' AND column_name = 'last_error'
    ) THEN
        ALTER TABLE xero_connections ADD COLUMN last_error TEXT;
    END IF;

    -- Add last_refreshed_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'xero_connections' AND column_name = 'last_refreshed_at'
    ) THEN
        ALTER TABLE xero_connections ADD COLUMN last_refreshed_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Add user_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'xero_connections' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE xero_connections ADD COLUMN user_id UUID;
    END IF;

    -- Add user_email column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'xero_connections' AND column_name = 'user_email'
    ) THEN
        ALTER TABLE xero_connections ADD COLUMN user_email TEXT;
    END IF;

    -- Add token_type column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'xero_connections' AND column_name = 'token_type'
    ) THEN
        ALTER TABLE xero_connections ADD COLUMN token_type TEXT DEFAULT 'Bearer';
    END IF;

    -- Add created_at column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'xero_connections' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE xero_connections ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Update expires_at to BIGINT if it's currently INTEGER
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'xero_connections'
        AND column_name = 'expires_at'
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE xero_connections ALTER COLUMN expires_at TYPE BIGINT;
    END IF;
END $$;

-- Add constraints for connection_status if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'xero_connections_connection_status_check'
    ) THEN
        ALTER TABLE xero_connections
        ADD CONSTRAINT xero_connections_connection_status_check
        CHECK (connection_status IN ('active', 'expired', 'revoked', 'error'));
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_xero_connections_active
  ON xero_connections(is_active, connection_status)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_xero_connections_user
  ON xero_connections(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_xero_connections_status
  ON xero_connections(connection_status);

-- Create or replace function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_xero_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_xero_connections_updated_at ON xero_connections;

CREATE TRIGGER trigger_xero_connections_updated_at
  BEFORE UPDATE ON xero_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_xero_connections_updated_at();

-- Update any NULL values in new columns for existing rows
UPDATE xero_connections
SET
    is_active = TRUE,
    connection_status = 'active',
    last_refreshed_at = COALESCE(last_refreshed_at, updated_at, NOW()),
    token_type = COALESCE(token_type, 'Bearer'),
    created_at = COALESCE(created_at, connected_at, NOW())
WHERE is_active IS NULL OR connection_status IS NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Migration 008 Complete!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Updated xero_connections table with:';
  RAISE NOTICE '  - Added 8 new columns (is_active, connection_status, etc.)';
  RAISE NOTICE '  - Updated expires_at to BIGINT';
  RAISE NOTICE '  - Created 3 new indexes';
  RAISE NOTICE '  - Added updated_at trigger';
  RAISE NOTICE '  - Set default values for existing rows';
END $$;
