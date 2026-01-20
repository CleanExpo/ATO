-- ============================================================================
-- MIGRATION 009: ADD TRANSACTION_AMOUNT COLUMN
-- ============================================================================
-- Adds missing transaction_amount column to forensic_analysis_results table

-- Add transaction_amount column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'forensic_analysis_results' AND column_name = 'transaction_amount'
    ) THEN
        ALTER TABLE forensic_analysis_results
        ADD COLUMN transaction_amount DECIMAL(15,2);

        RAISE NOTICE 'Added transaction_amount column to forensic_analysis_results';
    ELSE
        RAISE NOTICE 'transaction_amount column already exists';
    END IF;
END $$;

-- Create index on transaction_amount for fast aggregations
CREATE INDEX IF NOT EXISTS idx_forensic_analysis_amount
    ON forensic_analysis_results(tenant_id, transaction_amount)
    WHERE transaction_amount IS NOT NULL;

-- Add comment
COMMENT ON COLUMN forensic_analysis_results.transaction_amount IS
    'Original transaction amount for calculations and aggregations in materialized views';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Migration 009 Complete!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Added transaction_amount column to forensic_analysis_results';
  RAISE NOTICE 'Created index on transaction_amount for fast queries';
END $$;
