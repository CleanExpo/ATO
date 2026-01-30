-- Phase 2.1: Create Trust Distribution Analysis table
-- ATODE Integration: Section 100A ITAA 1936 (Trust distribution anti-avoidance), Division 7A ITAA 1936 (UPE deemed dividends)

CREATE TABLE IF NOT EXISTS public.trust_distribution_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.xero_connections(tenant_id) ON DELETE CASCADE,

    -- Trust identification
    trust_entity_id TEXT NOT NULL,
    trust_entity_name TEXT NOT NULL,
    financial_year TEXT NOT NULL, -- "FY2024-25" format

    -- Distribution totals
    total_distributions DECIMAL(15, 2) NOT NULL DEFAULT 0,
    cash_distributions DECIMAL(15, 2) NOT NULL DEFAULT 0,
    upe_distributions DECIMAL(15, 2) NOT NULL DEFAULT 0,

    -- Section 100A compliance
    section_100a_flags_count INTEGER NOT NULL DEFAULT 0,
    critical_flags_count INTEGER NOT NULL DEFAULT 0,
    high_flags_count INTEGER NOT NULL DEFAULT 0,

    -- UPE summary
    total_upe_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    beneficiaries_with_upe INTEGER NOT NULL DEFAULT 0,
    aged_upe_over_2_years INTEGER NOT NULL DEFAULT 0,
    aged_upe_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,

    -- Risk assessment
    overall_risk_level TEXT NOT NULL DEFAULT 'low', -- 'critical', 'high', 'medium', 'low'
    professional_review_required BOOLEAN DEFAULT FALSE,

    -- Compliance summary
    compliance_summary TEXT,

    -- Detailed analysis (JSONB)
    distributions_by_beneficiary JSONB, -- Array of beneficiary distribution details
    section_100a_flags JSONB, -- Array of Section 100A flags

    -- Metadata
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(tenant_id, trust_entity_id, financial_year)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_trust_analyses_tenant ON public.trust_distribution_analyses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trust_analyses_trust ON public.trust_distribution_analyses(trust_entity_id);
CREATE INDEX IF NOT EXISTS idx_trust_analyses_fy ON public.trust_distribution_analyses(financial_year);
CREATE INDEX IF NOT EXISTS idx_trust_analyses_risk ON public.trust_distribution_analyses(overall_risk_level);
CREATE INDEX IF NOT EXISTS idx_trust_analyses_critical ON public.trust_distribution_analyses(critical_flags_count) WHERE critical_flags_count > 0;
CREATE INDEX IF NOT EXISTS idx_trust_analyses_aged_upe ON public.trust_distribution_analyses(aged_upe_over_2_years) WHERE aged_upe_over_2_years > 0;

-- Enable Row Level Security
ALTER TABLE public.trust_distribution_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access analyses for their connected Xero tenants
CREATE POLICY "Users can view their own organisation's trust analyses"
    ON public.trust_distribution_analyses
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.xero_connections
            WHERE user_id = auth.uid()
        )
    );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_trust_distribution_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trust_distribution_analyses_updated_at
    BEFORE UPDATE ON public.trust_distribution_analyses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_trust_distribution_analyses_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.trust_distribution_analyses IS 'Trust distribution analysis results for Section 100A ITAA 1936 compliance. Detects reimbursement agreements, tracks UPE balances, and flags high-risk distributions to non-residents and minors.';
COMMENT ON COLUMN public.trust_distribution_analyses.section_100a_flags_count IS 'Total number of Section 100A compliance flags identified. Flags include: reimbursement agreements, non-resident distributions, minor distributions, excessive UPE.';
COMMENT ON COLUMN public.trust_distribution_analyses.aged_upe_over_2_years IS 'Count of beneficiaries with UPE outstanding for >2 years. Triggers Division 7A deemed dividend analysis if trust owes money to private company.';
COMMENT ON COLUMN public.trust_distribution_analyses.aged_upe_amount IS 'Total dollar amount of UPE outstanding for >2 years. Critical threshold: >$500,000 requires immediate professional review.';
COMMENT ON COLUMN public.trust_distribution_analyses.overall_risk_level IS 'CRITICAL = Reimbursement agreement or aged UPE >$500K, HIGH = Non-resident/minor distributions or UPE >$200K, MEDIUM = UPE >$50K, LOW = No issues.';
COMMENT ON COLUMN public.trust_distribution_analyses.professional_review_required IS 'TRUE if overall_risk_level is CRITICAL or HIGH. Indicates need for tax advisor or lawyer review before lodging tax return.';
COMMENT ON COLUMN public.trust_distribution_analyses.distributions_by_beneficiary IS 'JSONB array of beneficiary details: beneficiary_id, name, type, total_distributed, cash_paid, upe_balance, risk_score, risk_factors.';
COMMENT ON COLUMN public.trust_distribution_analyses.section_100a_flags IS 'JSONB array of Section 100A flags: flag_type, severity, description, beneficiary_id, amount, recommendation.';
