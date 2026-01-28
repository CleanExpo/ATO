/**
 * Add Platform Column to Historical Transactions Cache
 *
 * Supports multi-platform data storage (Xero, MYOB, QuickBooks)
 */

-- Add platform column to historical_transactions_cache
ALTER TABLE historical_transactions_cache
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'xero' CHECK (platform IN ('xero', 'myob', 'quickbooks'));

-- Update comment
COMMENT ON COLUMN historical_transactions_cache.platform IS 'Source accounting platform: xero, myob, or quickbooks';

-- Create index for platform filtering
CREATE INDEX IF NOT EXISTS idx_historical_transactions_platform
    ON historical_transactions_cache(tenant_id, platform, financial_year);

-- Add platform to audit_sync_status
ALTER TABLE audit_sync_status
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'xero' CHECK (platform IN ('xero', 'myob', 'quickbooks'));

-- Make tenant_id + platform unique (users can have multiple platforms)
DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_sync_status_tenant_id_key') THEN
    ALTER TABLE audit_sync_status DROP CONSTRAINT audit_sync_status_tenant_id_key;
  END IF;

  -- Add new constraint if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_sync_status_tenant_platform_unique') THEN
    ALTER TABLE audit_sync_status ADD CONSTRAINT audit_sync_status_tenant_platform_unique UNIQUE(tenant_id, platform);
  END IF;
END $$;

-- Update comment
COMMENT ON COLUMN audit_sync_status.platform IS 'Platform being synced: xero, myob, or quickbooks';

-- Update table comment
COMMENT ON TABLE historical_transactions_cache IS 'Caches 5 years of transactions from multiple accounting platforms (Xero, MYOB, QuickBooks) for forensic tax audit analysis';
