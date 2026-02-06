-- Migration: Add tenant-scoped RLS policies
-- Date: 2026-02-06
-- Purpose: Replace permissive USING(true) policies with tenant-scoped access
-- on core data tables. Service role (batch-processor) bypasses RLS automatically.

-- Helper function: Get tenant IDs accessible by the current user
CREATE OR REPLACE FUNCTION get_user_tenant_ids()
RETURNS SETOF TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT tenant_id FROM xero_connections WHERE user_id = auth.uid()
  UNION
  SELECT company_file_id FROM myob_connections WHERE user_id = auth.uid()
$$;

-- ============================================================
-- 1. historical_transactions_cache
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
-- 2. forensic_analysis_results
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
-- 3. tax_recommendations
-- ============================================================
DROP POLICY IF EXISTS "Users can view own tenant recommendations" ON tax_recommendations;
DROP POLICY IF EXISTS "Service role full access" ON tax_recommendations;
DROP POLICY IF EXISTS "Allow all access to tax_recommendations" ON tax_recommendations;
DROP POLICY IF EXISTS "tax_recommendations_select" ON tax_recommendations;
DROP POLICY IF EXISTS "tax_recommendations_insert" ON tax_recommendations;
DROP POLICY IF EXISTS "tax_recommendations_update" ON tax_recommendations;

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
-- 4. ai_analysis_costs
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
-- Ensure RLS is enabled on all tables
-- ============================================================
ALTER TABLE historical_transactions_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE forensic_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_costs ENABLE ROW LEVEL SECURITY;
