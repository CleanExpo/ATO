-- Migration: Standardise RLS helper functions
-- Date: 2026-02-08
-- Purpose: Replace get_user_tenant_ids() with check_tenant_access() per AD-8.
-- The 20260206 migration uses get_user_tenant_ids() (joins xero_connections),
-- while 20260207 uses check_tenant_access() (joins user_tenant_access).
-- This migration standardises all tenant-scoped RLS to check_tenant_access().
-- Finding: B-6 in COMPLIANCE_RISK_ASSESSMENT.md

-- ============================================================
-- 1. Drop old per-operation policies on historical_transactions_cache
-- ============================================================
DROP POLICY IF EXISTS "tenant_select_historical_transactions" ON historical_transactions_cache;
DROP POLICY IF EXISTS "tenant_insert_historical_transactions" ON historical_transactions_cache;
DROP POLICY IF EXISTS "tenant_update_historical_transactions" ON historical_transactions_cache;

CREATE POLICY "historical_transactions_tenant_access" ON historical_transactions_cache
    FOR ALL
    USING (check_tenant_access(tenant_id));

-- ============================================================
-- 2. Drop old per-operation policies on forensic_analysis_results
-- ============================================================
DROP POLICY IF EXISTS "tenant_select_forensic_analysis" ON forensic_analysis_results;
DROP POLICY IF EXISTS "tenant_insert_forensic_analysis" ON forensic_analysis_results;
DROP POLICY IF EXISTS "tenant_update_forensic_analysis" ON forensic_analysis_results;

CREATE POLICY "forensic_analysis_tenant_access" ON forensic_analysis_results
    FOR ALL
    USING (check_tenant_access(tenant_id));

-- ============================================================
-- 3. Drop old per-operation policies on tax_recommendations
-- ============================================================
DROP POLICY IF EXISTS "tenant_select_tax_recommendations" ON tax_recommendations;
DROP POLICY IF EXISTS "tenant_insert_tax_recommendations" ON tax_recommendations;
DROP POLICY IF EXISTS "tenant_update_tax_recommendations" ON tax_recommendations;

CREATE POLICY "tax_recommendations_tenant_access" ON tax_recommendations
    FOR ALL
    USING (check_tenant_access(tenant_id));

-- ============================================================
-- 4. Drop old per-operation policies on ai_analysis_costs
-- ============================================================
DROP POLICY IF EXISTS "tenant_select_ai_analysis_costs" ON ai_analysis_costs;
DROP POLICY IF EXISTS "tenant_insert_ai_analysis_costs" ON ai_analysis_costs;

CREATE POLICY "ai_analysis_costs_tenant_access" ON ai_analysis_costs
    FOR ALL
    USING (check_tenant_access(tenant_id));

-- ============================================================
-- 5. Drop deprecated get_user_tenant_ids() function
-- No remaining policies reference this function after migration.
-- ============================================================
DROP FUNCTION IF EXISTS get_user_tenant_ids();
