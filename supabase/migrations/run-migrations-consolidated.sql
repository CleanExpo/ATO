-- ============================================================================
-- CONSOLIDATED DATABASE MIGRATIONS (004, 005, 007)
-- Run this entire file in Supabase SQL Editor
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================================================
-- MIGRATION 004: HISTORICAL DATA CACHE
-- ============================================================================

-- Cache raw Xero data for fast re-analysis
CREATE TABLE IF NOT EXISTS historical_transactions_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL, -- 'ACCPAY', 'ACCREC', 'BANK'
  transaction_date DATE NOT NULL,
  transaction_amount DECIMAL(15,2),
  financial_year TEXT NOT NULL,
  raw_data JSONB NOT NULL, -- Full Xero API response
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, transaction_id)
);

-- Track sync status per organization
CREATE TABLE IF NOT EXISTS audit_sync_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL UNIQUE,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT, -- 'idle', 'syncing', 'complete', 'error'
  transactions_synced INTEGER DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  years_synced TEXT[], -- ['FY2024-25', 'FY2023-24', ...]
  current_year TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MIGRATION 005: FORENSIC ANALYSIS RESULTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS forensic_analysis_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  transaction_amount DECIMAL(15,2),

  -- AI Analysis
  primary_category TEXT,
  secondary_categories TEXT[],
  category_confidence INTEGER, -- 0-100

  -- R&D Assessment (Division 355)
  is_rnd_candidate BOOLEAN DEFAULT FALSE,
  meets_div355_criteria BOOLEAN DEFAULT FALSE,
  rnd_activity_type TEXT, -- 'core_rnd', 'supporting_rnd', 'not_eligible'
  rnd_confidence INTEGER,
  rnd_reasoning TEXT,

  -- Division 355 Four-Element Test
  div355_outcome_unknown BOOLEAN,
  div355_systematic_approach BOOLEAN,
  div355_new_knowledge BOOLEAN,
  div355_scientific_method BOOLEAN,

  -- Deduction Analysis (Division 8)
  is_fully_deductible BOOLEAN DEFAULT FALSE,
  deduction_type TEXT,
  claimable_amount DECIMAL(15,2),
  deduction_restrictions TEXT[],
  deduction_confidence INTEGER,

  -- Compliance Flags
  requires_documentation BOOLEAN DEFAULT FALSE,
  fbt_implications BOOLEAN DEFAULT FALSE,
  division7a_risk BOOLEAN DEFAULT FALSE,
  compliance_notes TEXT[],

  -- Metadata
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  ai_model TEXT, -- 'gemini-1.5-flash'

  UNIQUE(tenant_id, transaction_id)
);

-- AI Analysis Cost Tracking
CREATE TABLE IF NOT EXISTS ai_analysis_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL,
  batch_number INTEGER,
  transactions_in_batch INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd DECIMAL(10,6),
  model_used TEXT,
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MIGRATION 007: PERFORMANCE OPTIMIZATION
-- ============================================================================

-- INDEXES FOR FAST QUERIES

-- Historical transactions cache indexes
CREATE INDEX IF NOT EXISTS idx_historical_tx_tenant_fy
  ON historical_transactions_cache(tenant_id, financial_year);

CREATE INDEX IF NOT EXISTS idx_historical_tx_date
  ON historical_transactions_cache(transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_historical_tx_type
  ON historical_transactions_cache(tenant_id, transaction_type);

-- Forensic analysis results indexes
CREATE INDEX IF NOT EXISTS idx_forensic_tenant_fy
  ON forensic_analysis_results(tenant_id, financial_year);

CREATE INDEX IF NOT EXISTS idx_forensic_rnd
  ON forensic_analysis_results(tenant_id, is_rnd_candidate)
  WHERE is_rnd_candidate = true;

CREATE INDEX IF NOT EXISTS idx_forensic_deductible
  ON forensic_analysis_results(tenant_id, is_fully_deductible)
  WHERE is_fully_deductible = true;

CREATE INDEX IF NOT EXISTS idx_forensic_category
  ON forensic_analysis_results(tenant_id, primary_category);

CREATE INDEX IF NOT EXISTS idx_forensic_confidence
  ON forensic_analysis_results(tenant_id, category_confidence DESC);

CREATE INDEX IF NOT EXISTS idx_forensic_div7a
  ON forensic_analysis_results(tenant_id, division7a_risk)
  WHERE division7a_risk = true;

-- AI analysis costs indexes
CREATE INDEX IF NOT EXISTS idx_ai_costs_tenant
  ON ai_analysis_costs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ai_costs_date
  ON ai_analysis_costs(analyzed_at DESC);

-- Audit sync status index
CREATE INDEX IF NOT EXISTS idx_sync_status_tenant
  ON audit_sync_status(tenant_id, sync_status);

-- MATERIALIZED VIEWS FOR FAST AGGREGATIONS

-- R&D Summary per tenant and year
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_rnd_summary AS
SELECT
  tenant_id,
  financial_year,
  COUNT(*) AS transaction_count,
  COUNT(*) FILTER (WHERE is_rnd_candidate = true) AS rnd_candidate_count,
  COUNT(*) FILTER (WHERE meets_div355_criteria = true) AS meets_div355_count,
  COUNT(*) FILTER (WHERE rnd_activity_type = 'core_rnd') AS core_rnd_count,
  COUNT(*) FILTER (WHERE rnd_activity_type = 'supporting_rnd') AS supporting_rnd_count,
  SUM(CASE WHEN is_rnd_candidate = true THEN ABS(transaction_amount) ELSE 0 END) AS total_rnd_expenditure,
  AVG(CASE WHEN is_rnd_candidate = true THEN rnd_confidence END) AS avg_rnd_confidence,
  MAX(analyzed_at) AS last_analyzed
FROM forensic_analysis_results
WHERE is_rnd_candidate = true
GROUP BY tenant_id, financial_year;

-- Create indexes on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_rnd_tenant_fy
  ON mv_rnd_summary(tenant_id, financial_year);

-- Deduction Summary per tenant and year
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_deduction_summary AS
SELECT
  tenant_id,
  financial_year,
  primary_category,
  COUNT(*) AS transaction_count,
  COUNT(*) FILTER (WHERE is_fully_deductible = true) AS deductible_count,
  SUM(ABS(transaction_amount)) AS total_amount,
  SUM(claimable_amount) AS total_claimable,
  AVG(deduction_confidence) AS avg_confidence,
  MAX(analyzed_at) AS last_analyzed
FROM forensic_analysis_results
WHERE is_fully_deductible = true
GROUP BY tenant_id, financial_year, primary_category;

-- Create indexes on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_deduction_tenant_fy
  ON mv_deduction_summary(tenant_id, financial_year);

CREATE INDEX IF NOT EXISTS idx_mv_deduction_category
  ON mv_deduction_summary(tenant_id, primary_category);

-- Cost Summary per tenant
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_cost_summary AS
SELECT
  tenant_id,
  COUNT(*) AS total_batches,
  SUM(transactions_in_batch) AS total_transactions,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(cost_usd) AS total_cost_usd,
  AVG(cost_usd) AS avg_cost_per_batch,
  MIN(analyzed_at) AS first_analysis,
  MAX(analyzed_at) AS last_analysis
FROM ai_analysis_costs
GROUP BY tenant_id;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_cost_tenant
  ON mv_cost_summary(tenant_id);

-- DATABASE FUNCTIONS FOR COMMON QUERIES

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rnd_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_deduction_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cost_summary;

  RAISE NOTICE 'All materialized views refreshed successfully';
END;
$$ LANGUAGE plpgsql;

-- Function to refresh views for a specific tenant
CREATE OR REPLACE FUNCTION refresh_tenant_views(p_tenant_id TEXT)
RETURNS void AS $$
BEGIN
  -- For now, refresh all views (selective refresh would require partitioned views)
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rnd_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_deduction_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cost_summary;

  RAISE NOTICE 'Materialized views refreshed for tenant %', p_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- Get tenant analysis summary (optimized)
CREATE OR REPLACE FUNCTION get_tenant_analysis_summary(p_tenant_id TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'tenant_id', p_tenant_id,
    'total_transactions', COUNT(*),
    'analyzed_transactions', COUNT(*) FILTER (WHERE analyzed_at IS NOT NULL),
    'rnd_candidates', COUNT(*) FILTER (WHERE is_rnd_candidate = true),
    'deductible_transactions', COUNT(*) FILTER (WHERE is_fully_deductible = true),
    'avg_confidence', ROUND(AVG(category_confidence), 2),
    'financial_years', json_agg(DISTINCT financial_year ORDER BY financial_year),
    'last_analyzed', MAX(analyzed_at)
  )
  INTO result
  FROM forensic_analysis_results
  WHERE tenant_id = p_tenant_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Get R&D summary using materialized view (fast)
CREATE OR REPLACE FUNCTION get_rnd_summary_fast(p_tenant_id TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'financial_year', financial_year,
      'transaction_count', transaction_count,
      'rnd_candidate_count', rnd_candidate_count,
      'meets_div355_count', meets_div355_count,
      'core_rnd_count', core_rnd_count,
      'total_rnd_expenditure', total_rnd_expenditure,
      'estimated_offset', total_rnd_expenditure * 0.435,
      'avg_confidence', ROUND(avg_rnd_confidence, 2)
    )
    ORDER BY financial_year DESC
  )
  INTO result
  FROM mv_rnd_summary
  WHERE tenant_id = p_tenant_id;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql;

-- Get deduction summary using materialized view (fast)
CREATE OR REPLACE FUNCTION get_deduction_summary_fast(p_tenant_id TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'financial_year', financial_year,
      'category', primary_category,
      'transaction_count', transaction_count,
      'total_amount', total_amount,
      'total_claimable', total_claimable,
      'avg_confidence', ROUND(avg_confidence, 2)
    )
    ORDER BY financial_year DESC, total_claimable DESC
  )
  INTO result
  FROM mv_deduction_summary
  WHERE tenant_id = p_tenant_id;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql;

-- VACUUM AND ANALYZE FOR OPTIMAL PERFORMANCE
-- Note: VACUUM must be run outside transaction block (run manually after migration)
-- You can run these later in a separate query:
-- VACUUM ANALYZE historical_transactions_cache;
-- VACUUM ANALYZE forensic_analysis_results;
-- VACUUM ANALYZE ai_analysis_costs;
-- VACUUM ANALYZE audit_sync_status;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'All migrations completed successfully!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  - 4 tables (historical_transactions_cache, audit_sync_status, forensic_analysis_results, ai_analysis_costs)';
  RAISE NOTICE '  - 10+ indexes for fast queries';
  RAISE NOTICE '  - 3 materialized views for aggregations';
  RAISE NOTICE '  - 5 database functions for common queries';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Run your application: npm run dev';
  RAISE NOTICE '  2. Start historical sync: POST /api/audit/sync-historical';
  RAISE NOTICE '  3. After analysis: SELECT refresh_all_materialized_views();';
END $$;
