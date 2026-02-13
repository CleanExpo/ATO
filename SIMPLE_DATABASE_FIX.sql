-- =====================================================
-- SIMPLE DATABASE FIX - Run this in Supabase SQL Editor
-- =====================================================
-- Copy and paste this entire file into your Supabase SQL Editor and click Run

-- 1. Add missing column to audit_sync_status
ALTER TABLE audit_sync_status
ADD COLUMN IF NOT EXISTS total_transactions_estimated INTEGER DEFAULT 0;

-- 2. Add missing column to historical_transactions_cache
ALTER TABLE historical_transactions_cache
ADD COLUMN IF NOT EXISTS contact_name TEXT;

-- 3. Make transaction_id nullable (some Xero transactions don't have IDs)
ALTER TABLE historical_transactions_cache
ALTER COLUMN transaction_id DROP NOT NULL;

-- 4. Add helpful indexes for better performance
CREATE INDEX IF NOT EXISTS idx_historical_transactions_financial_year
ON historical_transactions_cache(financial_year);

CREATE INDEX IF NOT EXISTS idx_historical_transactions_tenant_date
ON historical_transactions_cache(tenant_id, transaction_date);

-- Done!
SELECT 'Database schema updated successfully!' as status;
