-- ============================================================================
-- ATO TAX OPTIMIZER - COMPLETE DATABASE SETUP (CLEAN INSTALL)
-- Run this SINGLE file in Supabase SQL Editor to set up EVERYTHING
-- ============================================================================
-- Date: 2026-01-21
-- This drops and recreates ALL tables for a clean setup
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CLEANUP: Drop all existing tables to ensure clean schema
-- ============================================================================

DROP TABLE IF EXISTS correction_logs CASCADE;
DROP TABLE IF EXISTS data_quality_issues CASCADE;
DROP TABLE IF EXISTS data_quality_scan_status CASCADE;
DROP TABLE IF EXISTS forensic_analysis_results CASCADE;
DROP TABLE IF EXISTS audit_sync_status CASCADE;
DROP TABLE IF EXISTS historical_transactions_cache CASCADE;
DROP TABLE IF EXISTS tax_rates_cache CASCADE;
DROP TABLE IF EXISTS agent_reports CASCADE;
DROP TABLE IF EXISTS government_reference_values CASCADE;
DROP TABLE IF EXISTS tax_audit_findings CASCADE;
DROP TABLE IF EXISTS rnd_activities CASCADE;
DROP TABLE IF EXISTS loss_records CASCADE;
DROP TABLE IF EXISTS shareholder_loans CASCADE;
DROP TABLE IF EXISTS audit_reports CASCADE;
-- Don't drop xero_connections - it has your OAuth tokens!

-- ============================================================================
-- PART 1: HISTORICAL TRANSACTIONS CACHE
-- ============================================================================

CREATE TABLE historical_transactions_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  transaction_type TEXT,
  transaction_date DATE,
  contact_name TEXT,
  description TEXT,
  account_code TEXT,
  account_name TEXT,
  tax_type TEXT,
  amount DECIMAL(15,2),
  line_items JSONB,
  status TEXT,
  is_reconciled BOOLEAN,
  financial_year TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, transaction_id)
);

CREATE INDEX idx_htc_tenant ON historical_transactions_cache(tenant_id);
CREATE INDEX idx_htc_date ON historical_transactions_cache(transaction_date);
CREATE INDEX idx_htc_fy ON historical_transactions_cache(financial_year);

-- ============================================================================
-- PART 2: AUDIT SYNC STATUS
-- ============================================================================

CREATE TABLE audit_sync_status (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id TEXT UNIQUE NOT NULL,
  sync_status TEXT DEFAULT 'idle',
  sync_progress DECIMAL(5,2) DEFAULT 0,
  transactions_synced INTEGER DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  current_year TEXT,
  years_completed TEXT[] DEFAULT ARRAY[]::TEXT[],
  last_sync_at TIMESTAMPTZ,
  sync_started_at TIMESTAMPTZ,
  sync_completed_at TIMESTAMPTZ,
  error_message TEXT,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_sync_tenant ON audit_sync_status(tenant_id);

-- ============================================================================
-- PART 3: FORENSIC ANALYSIS RESULTS
-- ============================================================================

CREATE TABLE forensic_analysis_results (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  analysis_type TEXT NOT NULL,
  analysis_date TIMESTAMPTZ DEFAULT NOW(),
  transactions_analyzed INTEGER DEFAULT 0,
  summary JSONB,
  rnd_candidates JSONB,
  deduction_opportunities JSONB,
  compliance_issues JSONB,
  recommendations JSONB,
  estimated_benefits JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, financial_year, analysis_type)
);

CREATE INDEX idx_forensic_tenant ON forensic_analysis_results(tenant_id);
CREATE INDEX idx_forensic_fy ON forensic_analysis_results(financial_year);

-- ============================================================================
-- PART 4: DATA QUALITY SCAN STATUS (CRITICAL FOR UI!)
-- ============================================================================

CREATE TABLE data_quality_scan_status (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  scan_status TEXT DEFAULT 'idle',
  scan_progress DECIMAL(5,2) DEFAULT 0,
  transactions_scanned INTEGER DEFAULT 0,
  issues_found INTEGER DEFAULT 0,
  issues_auto_corrected INTEGER DEFAULT 0,
  issues_pending_review INTEGER DEFAULT 0,
  wrong_account_count INTEGER DEFAULT 0,
  tax_classification_count INTEGER DEFAULT 0,
  unreconciled_count INTEGER DEFAULT 0,
  misallocated_count INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  total_impact_amount DECIMAL(15,2) DEFAULT 0,
  last_scan_at TIMESTAMPTZ,
  scan_started_at TIMESTAMPTZ,
  scan_completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dq_scan_tenant ON data_quality_scan_status(tenant_id);

-- ============================================================================
-- PART 5: DATA QUALITY ISSUES
-- ============================================================================

CREATE TABLE data_quality_issues (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  current_state JSONB NOT NULL,
  suggested_fix JSONB NOT NULL,
  confidence INTEGER NOT NULL,
  ai_reasoning TEXT,
  impact_amount DECIMAL(15,2),
  status TEXT DEFAULT 'identified',
  identified_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  accountant_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, transaction_id, issue_type)
);

CREATE INDEX idx_dqi_tenant_fy ON data_quality_issues(tenant_id, financial_year);
CREATE INDEX idx_dqi_status ON data_quality_issues(status);

-- ============================================================================
-- PART 6: CORRECTION LOGS
-- ============================================================================

CREATE TABLE correction_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  issue_id UUID REFERENCES data_quality_issues(id) ON DELETE CASCADE,
  correction_date TIMESTAMPTZ DEFAULT NOW(),
  correction_method TEXT NOT NULL,
  xero_journal_id TEXT,
  xero_journal_number TEXT,
  before_state JSONB NOT NULL,
  after_state JSONB NOT NULL,
  confidence INTEGER NOT NULL,
  ai_reasoning TEXT,
  status TEXT DEFAULT 'applied',
  accountant_approved BOOLEAN DEFAULT FALSE,
  accountant_notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_corrections_tenant ON correction_logs(tenant_id);
CREATE INDEX idx_corrections_issue ON correction_logs(issue_id);

-- ============================================================================
-- PART 7: TAX RATES CACHE
-- ============================================================================

CREATE TABLE tax_rates_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  rate_type TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  rate_value DECIMAL(10,4) NOT NULL,
  description TEXT,
  source_url TEXT,
  source_title TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rate_type, effective_from)
);

CREATE INDEX idx_tax_rates_type ON tax_rates_cache(rate_type);

-- ============================================================================
-- PART 8: AGENT REPORTS
-- ============================================================================

CREATE TABLE agent_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  summary JSONB,
  details JSONB,
  recommendations JSONB,
  estimated_value DECIMAL(15,2),
  priority TEXT DEFAULT 'medium',
  financial_years TEXT[],
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_reports_tenant ON agent_reports(tenant_id);
CREATE INDEX idx_agent_reports_type ON agent_reports(report_type);

-- ============================================================================
-- PART 9: GOVERNMENT REFERENCE VALUES
-- ============================================================================

CREATE TABLE government_reference_values (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  source_title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  retrieved_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gov_ref_key ON government_reference_values(key);

-- ============================================================================
-- PART 10: UPDATE TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_htc_modtime BEFORE UPDATE ON historical_transactions_cache FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_audit_sync_modtime BEFORE UPDATE ON audit_sync_status FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_forensic_modtime BEFORE UPDATE ON forensic_analysis_results FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_dq_scan_modtime BEFORE UPDATE ON data_quality_scan_status FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_dqi_modtime BEFORE UPDATE ON data_quality_issues FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_corrections_modtime BEFORE UPDATE ON correction_logs FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_agent_reports_modtime BEFORE UPDATE ON agent_reports FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ============================================================================
-- PART 11: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE historical_transactions_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE forensic_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_scan_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE government_reference_values ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access)
CREATE POLICY "Service role full access" ON historical_transactions_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON audit_sync_status FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON forensic_analysis_results FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON data_quality_scan_status FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON data_quality_issues FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON correction_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON tax_rates_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON agent_reports FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON government_reference_values FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anon read policies
CREATE POLICY "Anon read access" ON historical_transactions_cache FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read access" ON audit_sync_status FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read access" ON forensic_analysis_results FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read access" ON data_quality_scan_status FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read access" ON data_quality_issues FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read access" ON correction_logs FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read access" ON tax_rates_cache FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read access" ON agent_reports FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read access" ON government_reference_values FOR SELECT TO anon USING (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT '============================================================' AS message;
SELECT '  ATO TAX OPTIMIZER DATABASE SETUP COMPLETE' AS message;
SELECT '============================================================' AS message;
SELECT 
  COUNT(*) AS tables_created,
  CASE WHEN COUNT(*) >= 9 THEN '✅ SUCCESS!' ELSE '⚠️ Some tables missing' END AS status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'historical_transactions_cache', 'audit_sync_status',
  'forensic_analysis_results', 'data_quality_scan_status', 'data_quality_issues',
  'correction_logs', 'tax_rates_cache', 'agent_reports', 'government_reference_values'
);

SELECT '  Now go to https://ato-blush.vercel.app/dashboard and test!' AS next_step;
