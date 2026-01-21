-- Add analysis tracking columns to historical_transactions_cache
-- This enables the chunked analysis endpoint to track progress

ALTER TABLE historical_transactions_cache 
ADD COLUMN IF NOT EXISTS analysis_complete boolean DEFAULT NULL,
ADD COLUMN IF NOT EXISTS analysis_result jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS analyzed_at timestamptz DEFAULT NULL;

-- Create index for faster queries on unanalyzed transactions
CREATE INDEX IF NOT EXISTS idx_htc_analysis_complete 
ON historical_transactions_cache(tenant_id, analysis_complete) 
WHERE analysis_complete IS NULL;

-- Verification
SELECT 
    'analysis_columns_added' as migration,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'historical_transactions_cache' 
     AND column_name IN ('analysis_complete', 'analysis_result', 'analyzed_at')) as columns_added;
