-- Migration: New analysis engine tables
-- Date: 2026-02-07
-- Purpose: Create tables for CGT events, FBT items, ABN lookup cache,
--          audit risk benchmarks, and cashflow forecasts.
-- Engines: cgt-engine, fbt-engine, psi-engine, payg-instalment-engine,
--          payroll-tax-engine, audit-risk-engine, cashflow-forecast-engine
-- Integration: abn-lookup

-- ============================================================
-- 1. CGT Events (cgt-engine.ts)
-- Stores capital gains tax events for analysis
-- ============================================================
CREATE TABLE IF NOT EXISTS cgt_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    financial_year TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'A1', 'C2', 'D1', 'E1', 'H2', 'K6', etc.
    asset_description TEXT NOT NULL,
    asset_category TEXT CHECK (asset_category IN ('real_property', 'shares', 'business_asset', 'collectible', 'personal_use', 'other')),
    acquisition_date DATE,
    disposal_date DATE,
    cost_base DECIMAL(15,2),
    reduced_cost_base DECIMAL(15,2),
    capital_proceeds DECIMAL(15,2),
    capital_gain DECIMAL(15,2),
    capital_loss DECIMAL(15,2),
    -- Discount eligibility
    held_12_months BOOLEAN DEFAULT false,
    discount_percentage DECIMAL(5,2), -- 50% for individuals/trusts, 0% for companies
    discounted_gain DECIMAL(15,2),
    -- Division 152 concessions
    div152_eligible BOOLEAN DEFAULT false,
    div152_concessions_applied TEXT[], -- '15_year', '50_reduction', 'retirement', 'rollover'
    div152_exempt_amount DECIMAL(15,2),
    -- Metadata
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    source_transaction_ids TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cgt_events_tenant_fy ON cgt_events(tenant_id, financial_year);
CREATE INDEX IF NOT EXISTS idx_cgt_events_disposal_date ON cgt_events(disposal_date);

-- ============================================================
-- 2. FBT Items (fbt-engine.ts)
-- Stores fringe benefit items for FBT analysis
-- ============================================================
CREATE TABLE IF NOT EXISTS fbt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    fbt_year TEXT NOT NULL, -- 'FBT2024-25' format (Apr-Mar)
    benefit_category TEXT NOT NULL CHECK (benefit_category IN (
        'car', 'loan', 'expense', 'housing', 'lafha',
        'meal_entertainment', 'property', 'residual'
    )),
    description TEXT NOT NULL,
    taxable_value DECIMAL(15,2) NOT NULL,
    -- Gross-up
    gross_up_type TEXT CHECK (gross_up_type IN ('type1', 'type2')) NOT NULL,
    gross_up_rate DECIMAL(6,4),
    grossed_up_value DECIMAL(15,2),
    -- Exemptions
    is_exempt BOOLEAN DEFAULT false,
    exemption_type TEXT, -- 'minor_benefit', 'otherwise_deductible', 'car_parking_small', etc.
    exemption_reference TEXT, -- Legislative reference
    -- Employee details
    employee_name TEXT,
    employee_id TEXT,
    -- Metadata
    source_transaction_ids TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fbt_items_tenant_year ON fbt_items(tenant_id, fbt_year);
CREATE INDEX IF NOT EXISTS idx_fbt_items_category ON fbt_items(benefit_category);

-- ============================================================
-- 3. ABN Lookup Cache (abn-lookup.ts)
-- Caches ABR responses to avoid repeated API calls
-- Public data but cached per APP 11 considerations
-- ============================================================
CREATE TABLE IF NOT EXISTS abn_lookup_cache (
    abn TEXT PRIMARY KEY,
    result JSONB NOT NULL, -- Full ABNLookupResult
    cached_at TIMESTAMPTZ DEFAULT now(),
    -- No tenant_id - ABR data is public
    -- However, RLS should still be applied for cache management
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abn_cache_cached_at ON abn_lookup_cache(cached_at);

-- ============================================================
-- 4. Audit Risk Benchmarks (audit-risk-engine.ts)
-- Stores ATO industry benchmark data for comparison
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_risk_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry_code TEXT NOT NULL,
    industry_name TEXT NOT NULL,
    financial_year TEXT NOT NULL,
    -- Benchmark ranges (as proportions of income)
    cost_of_sales_low DECIMAL(6,4),
    cost_of_sales_high DECIMAL(6,4),
    total_expense_low DECIMAL(6,4),
    total_expense_high DECIMAL(6,4),
    labour_cost_low DECIMAL(6,4),
    labour_cost_high DECIMAL(6,4),
    rent_low DECIMAL(6,4),
    rent_high DECIMAL(6,4),
    motor_vehicle_low DECIMAL(6,4),
    motor_vehicle_high DECIMAL(6,4),
    -- Source
    source_url TEXT,
    last_verified TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(industry_code, financial_year)
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_industry_fy ON audit_risk_benchmarks(industry_code, financial_year);

-- ============================================================
-- 5. Cashflow Forecasts (cashflow-forecast-engine.ts)
-- Stores generated forecasts for retrieval
-- ============================================================
CREATE TABLE IF NOT EXISTS cashflow_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    financial_year TEXT NOT NULL,
    forecast_horizon_months INTEGER NOT NULL,
    -- Summary data
    total_projected_income DECIMAL(15,2),
    total_projected_expenses DECIMAL(15,2),
    total_tax_obligations DECIMAL(15,2),
    recommended_cash_reserve DECIMAL(15,2),
    -- Full forecast data
    forecast_data JSONB NOT NULL, -- Full CashFlowForecast result
    -- Assumptions used
    assumptions JSONB,
    -- Metadata
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    generated_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ, -- Forecasts become stale
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cashflow_tenant_fy ON cashflow_forecasts(tenant_id, financial_year);
CREATE INDEX IF NOT EXISTS idx_cashflow_generated ON cashflow_forecasts(generated_at DESC);

-- ============================================================
-- 6. PSI Analysis Results (psi-engine.ts)
-- Stores PSI classification results
-- ============================================================
CREATE TABLE IF NOT EXISTS psi_analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    financial_year TEXT NOT NULL,
    is_psi_entity BOOLEAN NOT NULL,
    is_psb BOOLEAN NOT NULL,
    psb_determination_required BOOLEAN DEFAULT false,
    -- Test results
    results_test_met BOOLEAN,
    unrelated_clients_test_met BOOLEAN,
    employment_test_met BOOLEAN,
    business_premises_test_met BOOLEAN,
    -- Income breakdown
    total_income DECIMAL(15,2),
    total_psi DECIMAL(15,2),
    primary_client_percentage DECIMAL(5,2),
    -- Full analysis
    analysis_data JSONB NOT NULL,
    -- Metadata
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, financial_year)
);

CREATE INDEX IF NOT EXISTS idx_psi_tenant_fy ON psi_analysis_results(tenant_id, financial_year);

-- ============================================================
-- 7. RLS Policies
-- Tenant-scoped access via user_tenant_access join
-- ============================================================

-- Helper function for tenant access check (if not already created)
CREATE OR REPLACE FUNCTION check_tenant_access(p_tenant_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_tenant_access
    WHERE user_id = auth.uid()
    AND tenant_id = p_tenant_id
  );
$$;

-- CGT Events RLS
ALTER TABLE cgt_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cgt_events_tenant_access ON cgt_events;
CREATE POLICY cgt_events_tenant_access ON cgt_events
    FOR ALL
    USING (check_tenant_access(tenant_id));

-- FBT Items RLS
ALTER TABLE fbt_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fbt_items_tenant_access ON fbt_items;
CREATE POLICY fbt_items_tenant_access ON fbt_items
    FOR ALL
    USING (check_tenant_access(tenant_id));

-- Cashflow Forecasts RLS
ALTER TABLE cashflow_forecasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cashflow_forecasts_tenant_access ON cashflow_forecasts;
CREATE POLICY cashflow_forecasts_tenant_access ON cashflow_forecasts
    FOR ALL
    USING (check_tenant_access(tenant_id));

-- PSI Analysis RLS
ALTER TABLE psi_analysis_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS psi_analysis_tenant_access ON psi_analysis_results;
CREATE POLICY psi_analysis_tenant_access ON psi_analysis_results
    FOR ALL
    USING (check_tenant_access(tenant_id));

-- ABN Lookup Cache - no tenant scoping (public data), but limit to authenticated users
ALTER TABLE abn_lookup_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS abn_cache_authenticated ON abn_lookup_cache;
CREATE POLICY abn_cache_authenticated ON abn_lookup_cache
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Audit Risk Benchmarks - read-only for all authenticated users
ALTER TABLE audit_risk_benchmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS benchmarks_authenticated ON audit_risk_benchmarks;
CREATE POLICY benchmarks_authenticated ON audit_risk_benchmarks
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
