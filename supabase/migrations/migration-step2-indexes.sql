-- ============================================================================
-- STEP 2: CREATE INDEXES FOR FAST QUERIES
-- ============================================================================

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

-- Success message
SELECT 'Step 2 Complete: All 10+ indexes created successfully!' as status;
