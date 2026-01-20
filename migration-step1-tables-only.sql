-- ============================================================================
-- STEP 1: CREATE TABLES ONLY
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cache raw Xero data for fast re-analysis
CREATE TABLE IF NOT EXISTS historical_transactions_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  transaction_amount DECIMAL(15,2),
  financial_year TEXT NOT NULL,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, transaction_id)
);

-- Track sync status per organization
CREATE TABLE IF NOT EXISTS audit_sync_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL UNIQUE,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT,
  transactions_synced INTEGER DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  years_synced TEXT[],
  current_year TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Forensic analysis results
CREATE TABLE IF NOT EXISTS forensic_analysis_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  transaction_amount DECIMAL(15,2),
  primary_category TEXT,
  secondary_categories TEXT[],
  category_confidence INTEGER,
  is_rnd_candidate BOOLEAN DEFAULT FALSE,
  meets_div355_criteria BOOLEAN DEFAULT FALSE,
  rnd_activity_type TEXT,
  rnd_confidence INTEGER,
  rnd_reasoning TEXT,
  div355_outcome_unknown BOOLEAN,
  div355_systematic_approach BOOLEAN,
  div355_new_knowledge BOOLEAN,
  div355_scientific_method BOOLEAN,
  is_fully_deductible BOOLEAN DEFAULT FALSE,
  deduction_type TEXT,
  claimable_amount DECIMAL(15,2),
  deduction_restrictions TEXT[],
  deduction_confidence INTEGER,
  requires_documentation BOOLEAN DEFAULT FALSE,
  fbt_implications BOOLEAN DEFAULT FALSE,
  division7a_risk BOOLEAN DEFAULT FALSE,
  compliance_notes TEXT[],
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  ai_model TEXT,
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

-- Success message
SELECT 'Step 1 Complete: All 4 tables created successfully!' as status;
