-- Complete forensic_analysis_results table setup
-- This matches EXACTLY what the analyze-chunk API expects
-- Run this in Supabase SQL Editor

-- 1. Drop existing table (if any) to start fresh
DROP TABLE IF EXISTS forensic_analysis_results CASCADE;

-- 2. Create table with exact columns the code expects
CREATE TABLE forensic_analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    transaction_id TEXT NOT NULL,
    financial_year TEXT,

    -- Categories (JSONB for arrays as the code sends JSON)
    primary_category TEXT,
    secondary_categories JSONB DEFAULT '[]',
    category_confidence DECIMAL(5,2),

    -- R&D Assessment
    is_rnd_candidate BOOLEAN DEFAULT FALSE,
    meets_div355_criteria BOOLEAN DEFAULT FALSE,
    rnd_activity_type TEXT,
    rnd_confidence DECIMAL(5,2),
    rnd_reasoning TEXT,

    -- Four-element test (Division 355) - NOTE: div355_ prefix!
    div355_outcome_unknown BOOLEAN,
    div355_systematic_approach BOOLEAN,
    div355_new_knowledge BOOLEAN,
    div355_scientific_method BOOLEAN,

    -- Deductions
    is_fully_deductible BOOLEAN DEFAULT TRUE,
    deduction_type TEXT,
    claimable_amount DECIMAL(12,2),
    deduction_restrictions JSONB DEFAULT '[]',
    deduction_confidence DECIMAL(5,2),

    -- Compliance
    requires_documentation BOOLEAN DEFAULT FALSE,
    fbt_implications BOOLEAN DEFAULT FALSE,
    division7a_risk BOOLEAN DEFAULT FALSE,
    compliance_notes JSONB DEFAULT '[]',

    -- Metadata
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint for upsert
    CONSTRAINT forensic_analysis_results_tenant_transaction_key
        UNIQUE (tenant_id, transaction_id)
);

-- 3. Create indexes for common queries
CREATE INDEX idx_forensic_results_tenant
    ON forensic_analysis_results(tenant_id);

CREATE INDEX idx_forensic_results_rnd
    ON forensic_analysis_results(tenant_id, is_rnd_candidate);

CREATE INDEX idx_forensic_results_fy
    ON forensic_analysis_results(tenant_id, financial_year);

CREATE INDEX idx_forensic_results_category
    ON forensic_analysis_results(tenant_id, primary_category);

-- 4. Enable Row Level Security (but allow service role full access)
ALTER TABLE forensic_analysis_results ENABLE ROW LEVEL SECURITY;

-- 5. Policy for service role (full access)
CREATE POLICY "Service role has full access to forensic_analysis_results"
    ON forensic_analysis_results
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 6. Also ensure ai_analysis_costs table doesn't require ai_model (make it nullable)
ALTER TABLE ai_analysis_costs
    ALTER COLUMN ai_model DROP NOT NULL;

-- 7. Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- 8. Verify the table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'forensic_analysis_results'
ORDER BY ordinal_position;
