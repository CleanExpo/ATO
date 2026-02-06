-- Migration: Add tenant-scoped RLS policies
-- Date: 2026-02-06
-- Purpose: Replace permissive USING(true) policies with tenant-scoped access
-- on core data tables. Service role (batch-processor) bypasses RLS automatically.

-- ============================================================
-- 0. Create tax_recommendations table (never created in live DB)
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    priority TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')) NOT NULL,
    tax_area TEXT CHECK (tax_area IN ('rnd', 'deductions', 'losses', 'div7a')) NOT NULL,
    financial_year TEXT NOT NULL,
    estimated_benefit DECIMAL(15,2) NOT NULL,
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100) NOT NULL,
    adjusted_benefit DECIMAL(15,2),
    action TEXT NOT NULL,
    ato_forms TEXT[],
    deadline DATE,
    amendment_window TEXT CHECK (amendment_window IN ('open', 'closing_soon', 'closed')),
    description TEXT,
    legislative_reference TEXT,
    supporting_evidence TEXT[],
    documentation_required TEXT[],
    estimated_accounting_cost DECIMAL(15,2),
    net_benefit DECIMAL(15,2),
    transaction_ids TEXT[],
    transaction_count INTEGER,
    status TEXT CHECK (status IN ('identified', 'in_progress', 'completed', 'rejected')) DEFAULT 'identified',
    notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_recommendations_tenant
    ON tax_recommendations(tenant_id);

-- ============================================================
-- Helper function: Get tenant IDs accessible by the current user
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_tenant_ids()
RETURNS SETOF TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT tenant_id FROM xero_connections WHERE user_id = auth.uid()
$$;

-- ============================================================
-- 1. historical_transactions_cache RLS
-- ============================================================
DROP POLICY IF EXISTS "Users can view own tenant transactions" ON historical_transactions_cache;
DROP POLICY IF EXISTS "Service role full access" ON historical_transactions_cache;
DROP POLICY IF EXISTS "Allow all access to historical_transactions_cache" ON historical_transactions_cache;
DROP POLICY IF EXISTS "historical_transactions_cache_select" ON historical_transactions_cache;
DROP POLICY IF EXISTS "historical_transactions_cache_insert" ON historical_transactions_cache;
DROP POLICY IF EXISTS "historical_transactions_cache_update" ON historical_transactions_cache;

CREATE POLICY "tenant_select_historical_transactions"
  ON historical_transactions_cache FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "tenant_insert_historical_transactions"
  ON historical_transactions_cache FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "tenant_update_historical_transactions"
  ON historical_transactions_cache FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

-- ============================================================
-- 2. forensic_analysis_results RLS
-- ============================================================
DROP POLICY IF EXISTS "Users can view own tenant analysis" ON forensic_analysis_results;
DROP POLICY IF EXISTS "Service role full access" ON forensic_analysis_results;
DROP POLICY IF EXISTS "Allow all access to forensic_analysis_results" ON forensic_analysis_results;
DROP POLICY IF EXISTS "forensic_analysis_results_select" ON forensic_analysis_results;
DROP POLICY IF EXISTS "forensic_analysis_results_insert" ON forensic_analysis_results;
DROP POLICY IF EXISTS "forensic_analysis_results_update" ON forensic_analysis_results;
DROP POLICY IF EXISTS "forensic_results_policy" ON forensic_analysis_results;

CREATE POLICY "tenant_select_forensic_analysis"
  ON forensic_analysis_results FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "tenant_insert_forensic_analysis"
  ON forensic_analysis_results FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "tenant_update_forensic_analysis"
  ON forensic_analysis_results FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

-- ============================================================
-- 3. tax_recommendations RLS
-- ============================================================
CREATE POLICY "tenant_select_tax_recommendations"
  ON tax_recommendations FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "tenant_insert_tax_recommendations"
  ON tax_recommendations FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "tenant_update_tax_recommendations"
  ON tax_recommendations FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

-- ============================================================
-- 4. ai_analysis_costs RLS
-- ============================================================
DROP POLICY IF EXISTS "Users can view own tenant costs" ON ai_analysis_costs;
DROP POLICY IF EXISTS "Service role full access" ON ai_analysis_costs;
DROP POLICY IF EXISTS "Allow all access to ai_analysis_costs" ON ai_analysis_costs;
DROP POLICY IF EXISTS "ai_analysis_costs_select" ON ai_analysis_costs;
DROP POLICY IF EXISTS "ai_analysis_costs_insert" ON ai_analysis_costs;

CREATE POLICY "tenant_select_ai_analysis_costs"
  ON ai_analysis_costs FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "tenant_insert_ai_analysis_costs"
  ON ai_analysis_costs FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids()));

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE historical_transactions_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE forensic_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_costs ENABLE ROW LEVEL SECURITY;
