-- Add missing transaction columns to forensic_analysis_results table
-- These columns are required by the analysis engines (rnd-engine, deduction-engine, div7a-engine)
-- Run this in Supabase SQL Editor

-- Add transaction_date column (DATE type for date-based queries)
ALTER TABLE forensic_analysis_results
ADD COLUMN IF NOT EXISTS transaction_date DATE;

-- Add transaction_amount column (DECIMAL for monetary values)
ALTER TABLE forensic_analysis_results
ADD COLUMN IF NOT EXISTS transaction_amount DECIMAL(15,2);

-- Add transaction_description column (TEXT for full description)
ALTER TABLE forensic_analysis_results
ADD COLUMN IF NOT EXISTS transaction_description TEXT;

-- Add supplier_name column (TEXT for contact/supplier name)
ALTER TABLE forensic_analysis_results
ADD COLUMN IF NOT EXISTS supplier_name TEXT;

-- Create index for transaction_date queries (used by ORDER BY in analysis engines)
CREATE INDEX IF NOT EXISTS idx_forensic_analysis_transaction_date
    ON forensic_analysis_results(tenant_id, transaction_date);

-- Create index for supplier_name queries (used by Division 7A loan tracking)
CREATE INDEX IF NOT EXISTS idx_forensic_analysis_supplier
    ON forensic_analysis_results(tenant_id, supplier_name);

-- Force PostgREST to reload schema cache (critical for avoiding PGRST204 errors)
NOTIFY pgrst, 'reload schema';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'forensic_analysis_results'
ORDER BY ordinal_position;
