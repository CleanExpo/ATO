-- ================================================================
-- ATO TAX OPTIMIZATION - SUPABASE DATABASE SCHEMA
-- ================================================================
-- Run this in your Supabase SQL Editor to create the required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------
-- XERO CONNECTIONS TABLE
-- ----------------------------------------------------------------
-- Stores OAuth tokens and organization details for connected Xero accounts

CREATE TABLE IF NOT EXISTS xero_connections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_name TEXT,
  tenant_type TEXT,
  
  -- OAuth Tokens (encrypted at rest by Supabase)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  id_token TEXT,
  scope TEXT,
  
  -- Organization Details
  organisation_name TEXT,
  organisation_type TEXT,
  country_code TEXT,
  base_currency TEXT,
  financial_year_end_day INTEGER,
  financial_year_end_month INTEGER,
  is_demo_company BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending'
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_xero_connections_tenant_id ON xero_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xero_connections_user_id ON xero_connections(user_id);

-- ----------------------------------------------------------------
-- TAX AUDIT FINDINGS TABLE
-- ----------------------------------------------------------------
-- Stores identified issues and recommendations from audits

CREATE TABLE IF NOT EXISTS tax_audit_findings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES xero_connections(tenant_id) ON DELETE CASCADE,
  
  -- Finding Details
  finding_type TEXT NOT NULL, -- 'misclassification', 'rnd_candidate', 'unclaimed_deduction', 'missing_tax_type'
  priority TEXT NOT NULL, -- 'critical', 'high', 'medium', 'low'
  category TEXT, -- 'R&D', 'Deduction', 'Classification', 'Compliance'
  
  -- Transaction Reference
  transaction_id TEXT,
  transaction_date DATE,
  transaction_description TEXT,
  transaction_amount DECIMAL(15,2),
  
  -- Analysis
  current_classification TEXT,
  recommended_classification TEXT,
  rationale TEXT,
  legislation_reference TEXT,
  
  -- Potential Impact
  estimated_benefit DECIMAL(15,2),
  confidence_level TEXT, -- 'high', 'medium', 'low'
  
  -- Status
  status TEXT DEFAULT 'open', -- 'open', 'reviewed', 'actioned', 'dismissed'
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  financial_year TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tax_findings_tenant ON tax_audit_findings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tax_findings_type ON tax_audit_findings(finding_type);
CREATE INDEX IF NOT EXISTS idx_tax_findings_priority ON tax_audit_findings(priority);
CREATE INDEX IF NOT EXISTS idx_tax_findings_status ON tax_audit_findings(status);

-- ----------------------------------------------------------------
-- R&D ACTIVITIES TABLE
-- ----------------------------------------------------------------
-- Stores identified R&D activities for Division 355 assessment

CREATE TABLE IF NOT EXISTS rnd_activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES xero_connections(tenant_id) ON DELETE CASCADE,
  
  -- Activity Details
  activity_name TEXT NOT NULL,
  activity_description TEXT,
  activity_type TEXT, -- 'core_rnd', 'supporting_rnd', 'not_eligible'
  
  -- Division 355 Assessment
  outcome_unknown BOOLEAN DEFAULT FALSE,
  systematic_approach BOOLEAN DEFAULT FALSE,
  new_knowledge BOOLEAN DEFAULT FALSE,
  scientific_method BOOLEAN DEFAULT FALSE,
  eligibility_score INTEGER, -- 0-4 based on criteria met
  
  -- Financial Details
  start_date DATE,
  end_date DATE,
  financial_year TEXT,
  total_expenditure DECIMAL(15,2),
  eligible_expenditure DECIMAL(15,2),
  estimated_offset DECIMAL(15,2), -- 43.5% of eligible
  
  -- Documentation Status
  documentation_status TEXT, -- 'complete', 'partial', 'missing'
  has_timesheets BOOLEAN DEFAULT FALSE,
  has_project_docs BOOLEAN DEFAULT FALSE,
  
  -- Status
  status TEXT DEFAULT 'identified', -- 'identified', 'assessed', 'documented', 'registered'
  registration_deadline DATE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rnd_activities_tenant ON rnd_activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rnd_activities_type ON rnd_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_rnd_activities_fy ON rnd_activities(financial_year);

-- ----------------------------------------------------------------
-- LOSS RECORDS TABLE
-- ----------------------------------------------------------------
-- Tracks accumulated losses and carry-forward eligibility

CREATE TABLE IF NOT EXISTS loss_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES xero_connections(tenant_id) ON DELETE CASCADE,
  
  -- Loss Details
  financial_year TEXT NOT NULL,
  revenue_loss DECIMAL(15,2),
  capital_loss DECIMAL(15,2),
  total_loss DECIMAL(15,2),
  
  -- Carry-Forward Tests
  continuity_of_ownership_satisfied BOOLEAN,
  same_business_test_satisfied BOOLEAN,
  is_eligible_for_carryforward BOOLEAN,
  
  -- Utilization
  amount_utilized DECIMAL(15,2) DEFAULT 0,
  remaining_balance DECIMAL(15,2),
  
  -- Future Value
  future_tax_value DECIMAL(15,2), -- at 25% corporate rate
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loss_records_tenant ON loss_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loss_records_fy ON loss_records(financial_year);

-- ----------------------------------------------------------------
-- SHAREHOLDER LOANS TABLE
-- ----------------------------------------------------------------
-- Tracks Division 7A loan compliance

CREATE TABLE IF NOT EXISTS shareholder_loans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES xero_connections(tenant_id) ON DELETE CASCADE,
  
  -- Loan Details
  shareholder_name TEXT NOT NULL,
  loan_direction TEXT NOT NULL, -- 'to_company', 'from_company'
  original_amount DECIMAL(15,2) NOT NULL,
  current_balance DECIMAL(15,2) NOT NULL,
  
  -- Division 7A Compliance
  has_written_agreement BOOLEAN DEFAULT FALSE,
  agreement_date DATE,
  interest_rate DECIMAL(5,2),
  benchmark_rate DECIMAL(5,2), -- ATO benchmark rate for the year
  loan_term_years INTEGER,
  
  -- Repayment Tracking
  minimum_yearly_repayment DECIMAL(15,2),
  repayments_made_this_fy DECIMAL(15,2) DEFAULT 0,
  is_compliant BOOLEAN,
  
  -- Risk Assessment
  deemed_dividend_risk DECIMAL(15,2),
  compliance_action_required TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  financial_year TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shareholder_loans_tenant ON shareholder_loans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_loans_compliant ON shareholder_loans(is_compliant);

-- ----------------------------------------------------------------
-- AUDIT REPORTS TABLE
-- ----------------------------------------------------------------
-- Stores generated tax audit reports

CREATE TABLE IF NOT EXISTS audit_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES xero_connections(tenant_id) ON DELETE CASCADE,
  
  -- Report Details
  report_type TEXT NOT NULL, -- 'full_audit', 'rnd_assessment', 'deduction_scan', 'loss_analysis'
  report_title TEXT,
  financial_years TEXT[], -- Array of FYs covered
  
  -- Summary Stats
  total_findings INTEGER,
  critical_findings INTEGER,
  estimated_total_benefit DECIMAL(15,2),
  
  -- Content
  summary_json JSONB,
  findings_json JSONB,
  recommendations_json JSONB,
  
  -- Status
  status TEXT DEFAULT 'draft', -- 'draft', 'final', 'archived'
  
  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_reports_tenant ON audit_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_type ON audit_reports(report_type);

-- ----------------------------------------------------------------
-- GOVERNMENT REFERENCE VALUES TABLE
-- ----------------------------------------------------------------
-- Stores official ATO/government rates, thresholds, and citations

CREATE TABLE IF NOT EXISTS government_reference_values (
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

CREATE INDEX IF NOT EXISTS idx_gov_ref_key ON government_reference_values(key);
CREATE INDEX IF NOT EXISTS idx_gov_ref_effective_from ON government_reference_values(effective_from);

-- ----------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------
-- Enable RLS for all tables (configure policies as needed)

ALTER TABLE xero_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rnd_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE loss_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE shareholder_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE government_reference_values ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for API routes)
CREATE POLICY "Service role access" ON xero_connections FOR ALL USING (true);
CREATE POLICY "Service role access" ON tax_audit_findings FOR ALL USING (true);
CREATE POLICY "Service role access" ON rnd_activities FOR ALL USING (true);
CREATE POLICY "Service role access" ON loss_records FOR ALL USING (true);
CREATE POLICY "Service role access" ON shareholder_loans FOR ALL USING (true);
CREATE POLICY "Service role access" ON audit_reports FOR ALL USING (true);
CREATE POLICY "Service role access" ON government_reference_values FOR ALL USING (true);

-- ----------------------------------------------------------------
-- FUNCTIONS
-- ----------------------------------------------------------------

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_xero_connections_updated_at
  BEFORE UPDATE ON xero_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_tax_findings_updated_at
  BEFORE UPDATE ON tax_audit_findings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_rnd_activities_updated_at
  BEFORE UPDATE ON rnd_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_loss_records_updated_at
  BEFORE UPDATE ON loss_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_shareholder_loans_updated_at
  BEFORE UPDATE ON shareholder_loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_government_reference_values_updated_at
  BEFORE UPDATE ON government_reference_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
