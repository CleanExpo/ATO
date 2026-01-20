-- Migration: Fix Audit Tables Schema
-- Date: 2026-01-20
-- Purpose: Add missing columns to audit_sync_status and historical_transactions_cache

-- =====================================================
-- 1. Fix audit_sync_status table
-- =====================================================

-- Add missing total_transactions_estimated column
ALTER TABLE audit_sync_status
ADD COLUMN IF NOT EXISTS total_transactions_estimated INTEGER DEFAULT 0;

-- Add helpful comment
COMMENT ON COLUMN audit_sync_status.total_transactions_estimated IS
'Estimated total number of transactions to sync (used for progress calculation)';

-- =====================================================
-- 2. Fix historical_transactions_cache table
-- =====================================================

-- Add missing contact_name column
ALTER TABLE historical_transactions_cache
ADD COLUMN IF NOT EXISTS contact_name TEXT;

-- Make transaction_id nullable temporarily (for existing data)
ALTER TABLE historical_transactions_cache
ALTER COLUMN transaction_id DROP NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN historical_transactions_cache.contact_name IS
'Name of the contact/supplier for this transaction';

COMMENT ON COLUMN historical_transactions_cache.transaction_id IS
'Xero transaction ID (may be null for some transaction types)';

-- =====================================================
-- 3. Add indexes for better query performance
-- =====================================================

-- Index on financial year for faster filtering
CREATE INDEX IF NOT EXISTS idx_historical_transactions_financial_year
ON historical_transactions_cache(financial_year);

-- Index on tenant_id and transaction_date for date range queries
CREATE INDEX IF NOT EXISTS idx_historical_transactions_tenant_date
ON historical_transactions_cache(tenant_id, transaction_date);

-- Index on sync status for faster status checks (only if status column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_sync_status' AND column_name = 'status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_audit_sync_status_tenant_status
    ON audit_sync_status(tenant_id, status);
  END IF;
END $$;

-- =====================================================
-- 4. Verify changes
-- =====================================================

-- Show the updated schema
DO $$
BEGIN
  RAISE NOTICE 'Schema updates applied successfully!';
  RAISE NOTICE 'audit_sync_status now has total_transactions_estimated column';
  RAISE NOTICE 'historical_transactions_cache now has contact_name column';
  RAISE NOTICE 'transaction_id is now nullable';
END $$;
