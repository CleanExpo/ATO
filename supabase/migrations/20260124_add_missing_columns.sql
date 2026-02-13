-- ============================================================================
-- ADD MISSING COLUMNS TO HISTORICAL TRANSACTIONS CACHE
-- Run this in Supabase SQL Editor to fix the sync issue
-- ============================================================================

-- Add 'reference' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'historical_transactions_cache'
                   AND column_name = 'reference') THEN
        ALTER TABLE historical_transactions_cache ADD COLUMN reference TEXT;
    END IF;
END $$;

-- Add 'total_amount' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'historical_transactions_cache'
                   AND column_name = 'total_amount') THEN
        ALTER TABLE historical_transactions_cache ADD COLUMN total_amount DECIMAL(15,2);
    END IF;
END $$;

-- Reload the PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'historical_transactions_cache'
ORDER BY ordinal_position;
