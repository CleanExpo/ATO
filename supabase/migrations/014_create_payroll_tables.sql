-- Phase 1.2: Create Payroll tables for caching Xero payroll data
-- ATODE Integration: Superannuation Guarantee (Administration) Act 1992, Division 291 ITAA 1997

-- ============================================================================
-- xero_employees: Employee master data
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.xero_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.xero_connections(tenant_id) ON DELETE CASCADE,

    -- Employee identification
    employee_id TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,

    -- Employment details
    start_date DATE,
    end_date DATE,
    job_title TEXT,
    classification TEXT,
    employee_group_name TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'terminated'

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Raw Xero data (JSONB for future extensibility)
    raw_xero_data JSONB,

    -- Constraints
    UNIQUE(tenant_id, employee_id)
);

-- ============================================================================
-- xero_pay_runs: Payroll transaction summary
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.xero_pay_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.xero_connections(tenant_id) ON DELETE CASCADE,

    -- Pay run identification
    pay_run_id TEXT NOT NULL,

    -- Period details
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    payment_date DATE NOT NULL,

    -- Financial summary
    total_wages DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_tax DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_super DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_net_pay DECIMAL(15, 2) NOT NULL DEFAULT 0,

    -- Additional details
    employee_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'posted'

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Raw Xero data (JSONB for future extensibility)
    raw_xero_data JSONB,

    -- Constraints
    UNIQUE(tenant_id, pay_run_id)
);

-- ============================================================================
-- xero_super_contributions: Superannuation contributions (for Division 291 compliance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.xero_super_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public.xero_connections(tenant_id) ON DELETE CASCADE,

    -- Employee reference
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,

    -- Period details
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    payment_date DATE,

    -- Contribution details
    super_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    contribution_type TEXT NOT NULL DEFAULT 'SG', -- 'SG', 'salary_sacrifice', 'employer_additional'

    -- Super fund details
    super_fund_id TEXT,
    super_fund_name TEXT,
    super_fund_type TEXT, -- 'REGULATED', 'SMSF'

    -- Compliance flags (for Division 291 analysis)
    is_concessional BOOLEAN DEFAULT TRUE, -- Concessional vs non-concessional
    exceeds_cap BOOLEAN DEFAULT FALSE, -- Flags potential Division 291 breach

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Raw Xero data (JSONB for future extensibility)
    raw_xero_data JSONB,

    -- Constraints
    UNIQUE(tenant_id, employee_id, period_start_date, period_end_date, contribution_type)
);

-- ============================================================================
-- Indexes for common queries
-- ============================================================================

-- xero_employees indexes
CREATE INDEX IF NOT EXISTS idx_xero_employees_tenant ON public.xero_employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xero_employees_status ON public.xero_employees(status);
CREATE INDEX IF NOT EXISTS idx_xero_employees_name ON public.xero_employees(last_name, first_name);

-- xero_pay_runs indexes
CREATE INDEX IF NOT EXISTS idx_xero_pay_runs_tenant ON public.xero_pay_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xero_pay_runs_period ON public.xero_pay_runs(period_start_date, period_end_date);
CREATE INDEX IF NOT EXISTS idx_xero_pay_runs_payment_date ON public.xero_pay_runs(payment_date);
CREATE INDEX IF NOT EXISTS idx_xero_pay_runs_status ON public.xero_pay_runs(status);

-- xero_super_contributions indexes
CREATE INDEX IF NOT EXISTS idx_xero_super_contributions_tenant ON public.xero_super_contributions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xero_super_contributions_employee ON public.xero_super_contributions(employee_id);
CREATE INDEX IF NOT EXISTS idx_xero_super_contributions_period ON public.xero_super_contributions(period_start_date, period_end_date);
CREATE INDEX IF NOT EXISTS idx_xero_super_contributions_exceeds_cap ON public.xero_super_contributions(exceeds_cap) WHERE exceeds_cap = TRUE;

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================

ALTER TABLE public.xero_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xero_pay_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xero_super_contributions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies: Users can only access payroll data for their connected Xero tenants
-- ============================================================================

CREATE POLICY "Users can view their own organisation's employees"
    ON public.xero_employees
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.xero_connections
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view their own organisation's pay runs"
    ON public.xero_pay_runs
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.xero_connections
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view their own organisation's super contributions"
    ON public.xero_super_contributions
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.xero_connections
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- Triggers to update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_xero_employees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER xero_employees_updated_at
    BEFORE UPDATE ON public.xero_employees
    FOR EACH ROW
    EXECUTE FUNCTION public.update_xero_employees_updated_at();

CREATE OR REPLACE FUNCTION public.update_xero_pay_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER xero_pay_runs_updated_at
    BEFORE UPDATE ON public.xero_pay_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_xero_pay_runs_updated_at();

CREATE OR REPLACE FUNCTION public.update_xero_super_contributions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER xero_super_contributions_updated_at
    BEFORE UPDATE ON public.xero_super_contributions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_xero_super_contributions_updated_at();

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE public.xero_employees IS 'Cached employee master data from Xero Payroll. Used for superannuation compliance analysis (Division 291 ITAA 1997).';
COMMENT ON TABLE public.xero_pay_runs IS 'Cached payroll transaction summaries from Xero Payroll. Used for wages analysis and superannuation guarantee compliance.';
COMMENT ON TABLE public.xero_super_contributions IS 'Cached superannuation contributions from Xero Payroll. Critical for Division 291 ITAA 1997 compliance (concessional super cap $30,000 FY2024-25).';

COMMENT ON COLUMN public.xero_super_contributions.is_concessional IS 'TRUE = Concessional (pre-tax, subject to Division 291 cap), FALSE = Non-concessional (post-tax, different cap)';
COMMENT ON COLUMN public.xero_super_contributions.exceeds_cap IS 'Flags contributions that exceed concessional super cap ($30,000 FY2024-25). Triggers Division 291 tax analysis.';
COMMENT ON COLUMN public.xero_super_contributions.contribution_type IS 'SG = Superannuation Guarantee (9.5%), salary_sacrifice = Employee-elected pre-tax, employer_additional = Employer voluntary';
