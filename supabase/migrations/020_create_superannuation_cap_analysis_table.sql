-- Phase 2.3: Create Superannuation Cap Analysis table
-- ATODE Integration: Division 291 ITAA 1997 (Excess concessional contributions tax)

CREATE TABLE IF NOT EXISTS public.superannuation_cap_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.xero_connections(tenant_id) ON DELETE CASCADE,

    -- Period
    financial_year TEXT NOT NULL, -- "FY2024-25" format

    -- Employee summary
    total_employees_analyzed INTEGER NOT NULL DEFAULT 0,
    employees_with_contributions INTEGER NOT NULL DEFAULT 0,

    -- Contribution totals
    total_concessional_contributions DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_excess_contributions DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_division_291_tax DECIMAL(15, 2) NOT NULL DEFAULT 0,

    -- Breach counts
    employees_breaching_cap INTEGER NOT NULL DEFAULT 0,
    employees_approaching_cap INTEGER NOT NULL DEFAULT 0, -- >80% cap usage

    -- Detailed employee summaries (JSONB)
    employee_summaries JSONB, -- Array of EmployeeSuperSummary objects

    -- Compliance
    compliance_summary TEXT,
    professional_review_required BOOLEAN DEFAULT FALSE,

    -- Metadata
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(tenant_id, financial_year)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_super_cap_analyses_tenant ON public.superannuation_cap_analyses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_super_cap_analyses_fy ON public.superannuation_cap_analyses(financial_year);
CREATE INDEX IF NOT EXISTS idx_super_cap_analyses_breaches ON public.superannuation_cap_analyses(employees_breaching_cap) WHERE employees_breaching_cap > 0;
CREATE INDEX IF NOT EXISTS idx_super_cap_analyses_tax ON public.superannuation_cap_analyses(total_division_291_tax) WHERE total_division_291_tax > 0;
CREATE INDEX IF NOT EXISTS idx_super_cap_analyses_review ON public.superannuation_cap_analyses(professional_review_required) WHERE professional_review_required = TRUE;

-- Enable Row Level Security
ALTER TABLE public.superannuation_cap_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access analyses for their connected Xero tenants
CREATE POLICY "Users can view their own organisation's super cap analyses"
    ON public.superannuation_cap_analyses
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.xero_connections
            WHERE user_id = auth.uid()
        )
    );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.superannuation_cap_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER superannuation_cap_analyses_updated_at
    BEFORE UPDATE ON public.superannuation_cap_analyses
    FOR EACH ROW
    EXECUTE FUNCTION public.superannuation_cap_analyses_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.superannuation_cap_analyses IS 'Superannuation cap breach analysis under Division 291 ITAA 1997. Tracks concessional contributions against annual cap ($30,000 FY2024-25) and calculates Division 291 tax on excess.';
COMMENT ON COLUMN public.superannuation_cap_analyses.total_division_291_tax IS 'Total Division 291 tax payable across all employees. Calculated as excess_contributions × 15% (additional tax on top of 15% already paid in fund = 30% total).';
COMMENT ON COLUMN public.superannuation_cap_analyses.employees_breaching_cap IS 'Count of employees who exceeded concessional cap. Each breach triggers ATO assessment notice and 60-day release period.';
COMMENT ON COLUMN public.superannuation_cap_analyses.employees_approaching_cap IS 'Count of employees using >80% of cap. Early warning to reduce contributions before FY end.';
COMMENT ON COLUMN public.superannuation_cap_analyses.professional_review_required IS 'TRUE if any employees breach cap. Recommend immediate tax advisor consultation to manage excess contributions release.';
COMMENT ON COLUMN public.superannuation_cap_analyses.employee_summaries IS 'JSONB array of employee details: employee_id, name, total_concessional (SG + salary_sacrifice + employer_additional), cap_usage_percentage, excess_contributions, division_291_tax_payable, warnings, recommendations.';
