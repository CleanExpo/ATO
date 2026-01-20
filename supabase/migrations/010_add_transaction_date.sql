-- ============================================================================
-- MIGRATION 010: ADD TRANSACTION_DATE COLUMN
-- ============================================================================
-- Adds missing transaction_date column to forensic_analysis_results table

-- Add transaction_date column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'forensic_analysis_results' AND column_name = 'transaction_date'
    ) THEN
        ALTER TABLE forensic_analysis_results
        ADD COLUMN transaction_date DATE;

        RAISE NOTICE 'Added transaction_date column to forensic_analysis_results';
    ELSE
        RAISE NOTICE 'transaction_date column already exists';
    END IF;
END $$;

-- Create index on transaction_date for fast date range queries
CREATE INDEX IF NOT EXISTS idx_forensic_analysis_transaction_date
    ON forensic_analysis_results(tenant_id, transaction_date);

-- Add comment
COMMENT ON COLUMN forensic_analysis_results.transaction_date IS
    'Transaction date for date-based filtering and year-over-year analysis';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Migration 010 Complete!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Added transaction_date column to forensic_analysis_results';
  RAISE NOTICE 'Created index on transaction_date';
END $$;
