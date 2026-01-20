-- ============================================================================
-- STEP 3: CREATE MATERIALIZED VIEWS AND FUNCTIONS
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_mv_cost_tenant
  ON mv_cost_summary(tenant_id);

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

-- Success message
SELECT 'Step 3 Complete: All 3 materialized views and 5 functions created!' as status;
