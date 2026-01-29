-- Add missing columns to forensic_analysis_results table
-- Run this in Supabase SQL Editor

-- Essential columns (if table exists but is minimal)
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- Create unique constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'forensic_analysis_results_tenant_transaction_key'
    ) THEN
        ALTER TABLE forensic_analysis_results ADD CONSTRAINT forensic_analysis_results_tenant_transaction_key UNIQUE (tenant_id, transaction_id);
    END IF;
END $$;

-- Categories
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS primary_category TEXT;
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS secondary_categories JSONB DEFAULT '[]';
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS category_confidence DECIMAL(5,2);

-- R&D Assessment
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS is_rnd_candidate BOOLEAN DEFAULT FALSE;
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS meets_div355_criteria BOOLEAN DEFAULT FALSE;
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS rnd_activity_type TEXT;
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS rnd_confidence DECIMAL(5,2);
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS rnd_reasoning TEXT;

-- Four-element test (Division 355)
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS div355_outcome_unknown BOOLEAN;
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS div355_systematic_approach BOOLEAN;
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS div355_new_knowledge BOOLEAN;
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS div355_scientific_method BOOLEAN;

-- Deductions
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS is_fully_deductible BOOLEAN DEFAULT TRUE;
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS deduction_type TEXT;
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS claimable_amount DECIMAL(12,2);
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS deduction_restrictions JSONB DEFAULT '[]';
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS deduction_confidence DECIMAL(5,2);

-- Compliance
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS requires_documentation BOOLEAN DEFAULT FALSE;
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS fbt_implications BOOLEAN DEFAULT FALSE;
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS division7a_risk BOOLEAN DEFAULT FALSE;
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS compliance_notes JSONB DEFAULT '[]';

-- Financial year
ALTER TABLE forensic_analysis_results ADD COLUMN IF NOT EXISTS financial_year TEXT;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_forensic_results_tenant ON forensic_analysis_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_forensic_results_rnd ON forensic_analysis_results(tenant_id, is_rnd_candidate);
CREATE INDEX IF NOT EXISTS idx_forensic_results_fy ON forensic_analysis_results(tenant_id, financial_year);
