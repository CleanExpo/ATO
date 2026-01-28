-- ================================================================
-- QUICKSTART MIGRATION - QuickBooks + Tax Alerts Only
-- ================================================================
-- This migration only applies the NEW tables that definitely don't exist yet:
-- 1. QuickBooks OAuth tokens table
-- 2. Tax Alerts System (4 tables + seed data)
--
-- Safe to run even if platform columns already exist.
-- ================================================================

BEGIN;

-- ================================================================
-- PART 1: QuickBooks OAuth Tokens Table
-- ================================================================

CREATE TABLE IF NOT EXISTS quickbooks_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- OAuth tokens
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  realm_id TEXT NOT NULL,
  token_type TEXT DEFAULT 'Bearer',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quickbooks_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'quickbooks_tokens' AND policyname = 'Users can access own QuickBooks tokens'
  ) THEN
    CREATE POLICY "Users can access own QuickBooks tokens"
      ON quickbooks_tokens FOR ALL
      USING (auth.uid() = tenant_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quickbooks_tokens_tenant_id ON quickbooks_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quickbooks_tokens_realm_id ON quickbooks_tokens(realm_id);
CREATE INDEX IF NOT EXISTS idx_quickbooks_tokens_expires_at ON quickbooks_tokens(expires_at);

COMMENT ON TABLE quickbooks_tokens IS 'QuickBooks Online OAuth 2.0 tokens for API access';

-- ================================================================
-- PART 2: Tax Alerts System
-- ================================================================

-- Alert Definitions Table
CREATE TABLE IF NOT EXISTS tax_alert_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'rnd_registration_deadline', 'rnd_claim_deadline', 'tax_loss_expiring',
    'div7a_loan_unpaid', 'div7a_minimum_repayment', 'deduction_opportunity',
    'instant_writeoff_threshold', 'bas_lodgment_due', 'tax_return_due',
    'fbt_return_due', 'legislative_change', 'rate_change', 'compliance_warning'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  category TEXT NOT NULL CHECK (category IN ('deadline', 'opportunity', 'compliance', 'legislative', 'financial')),
  advance_notice_days INTEGER,
  conditions JSONB,
  action_url TEXT,
  action_label TEXT,
  legislation_reference TEXT,
  ato_link TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Alert Instances Table
CREATE TABLE IF NOT EXISTS tax_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_definition_id UUID REFERENCES tax_alert_definitions(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  category TEXT NOT NULL,
  financial_year TEXT,
  platform TEXT,
  related_transaction_ids TEXT[],
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'acknowledged', 'dismissed', 'actioned')),
  read_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ,
  action_url TEXT,
  action_label TEXT,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert Preferences Table
CREATE TABLE IF NOT EXISTS tax_alert_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  alerts_enabled BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  in_app_notifications BOOLEAN DEFAULT true,
  rnd_alerts BOOLEAN DEFAULT true,
  deadline_alerts BOOLEAN DEFAULT true,
  opportunity_alerts BOOLEAN DEFAULT true,
  compliance_alerts BOOLEAN DEFAULT true,
  legislative_alerts BOOLEAN DEFAULT true,
  advance_notice_days INTEGER DEFAULT 30,
  digest_frequency TEXT DEFAULT 'daily' CHECK (digest_frequency IN ('realtime', 'daily', 'weekly')),
  notification_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert History Table
CREATE TABLE IF NOT EXISTS tax_alert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID NOT NULL REFERENCES tax_alerts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'read', 'acknowledged', 'dismissed', 'actioned', 'email_sent', 'email_opened', 'link_clicked')),
  user_agent TEXT,
  ip_address TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tax_alert_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_alert_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_alert_definitions' AND policyname = 'Users can view alert definitions') THEN
    CREATE POLICY "Users can view alert definitions" ON tax_alert_definitions FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_alerts' AND policyname = 'Users can access own alerts') THEN
    CREATE POLICY "Users can access own alerts" ON tax_alerts FOR ALL USING (auth.uid() = tenant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_alert_preferences' AND policyname = 'Users can access own preferences') THEN
    CREATE POLICY "Users can access own preferences" ON tax_alert_preferences FOR ALL USING (auth.uid() = tenant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_alert_history' AND policyname = 'Users can access own alert history') THEN
    CREATE POLICY "Users can access own alert history" ON tax_alert_history FOR ALL USING (auth.uid() = tenant_id);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tax_alerts_tenant_id ON tax_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tax_alerts_status ON tax_alerts(status);
CREATE INDEX IF NOT EXISTS idx_tax_alerts_severity ON tax_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_tax_alerts_due_date ON tax_alerts(due_date);
CREATE INDEX IF NOT EXISTS idx_tax_alerts_triggered_at ON tax_alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_tax_alerts_tenant_status ON tax_alerts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tax_alerts_tenant_unread ON tax_alerts(tenant_id, status) WHERE status = 'unread';
CREATE INDEX IF NOT EXISTS idx_tax_alert_preferences_tenant_id ON tax_alert_preferences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tax_alert_history_alert_id ON tax_alert_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_tax_alert_history_tenant_id ON tax_alert_history(tenant_id);

-- Seed Alert Definitions
INSERT INTO tax_alert_definitions (alert_type, title, description, severity, category, advance_notice_days, action_label, legislation_reference) VALUES
('rnd_registration_deadline', 'R&D Registration Deadline Approaching', 'Your R&D Tax Incentive registration deadline is approaching. Registration must be completed within 10 months of the end of your income year.', 'critical', 'deadline', 60, 'Register for R&D', 'Division 355 ITAA 1997'),
('rnd_claim_deadline', 'R&D Claim Submission Due', 'Submit your R&D Tax Incentive claim before the deadline to claim your 43.5% refundable tax offset.', 'critical', 'deadline', 30, 'Submit R&D Claim', 'Division 355 ITAA 1997'),
('tax_loss_expiring', 'Tax Losses May Expire', 'Your carried-forward tax losses may expire due to ownership or business continuity test failures. Review your loss position to preserve valuable tax benefits.', 'warning', 'compliance', 90, 'Review Loss Position', 'Subdivision 165-A, Subdivision 165-E ITAA 1997'),
('div7a_loan_unpaid', 'Division 7A Loan Repayment Required', 'Unpaid private company loan detected. Make minimum repayment by end of financial year to avoid deemed dividend treatment.', 'warning', 'compliance', 60, 'View Loan Details', 'Division 7A ITAA 1936'),
('div7a_minimum_repayment', 'Division 7A Minimum Repayment Due', 'Minimum loan repayment is due to comply with Division 7A safe harbour provisions. Current benchmark rate: 8.77% (FY2024-25).', 'warning', 'financial', 30, 'Calculate Repayment', 'Section 109N ITAA 1936'),
('deduction_opportunity', 'Unclaimed Tax Deduction Identified', 'Our AI analysis has identified potential unclaimed tax deductions in your transactions. Review and claim these deductions to reduce your tax liability.', 'info', 'opportunity', NULL, 'Review Deductions', 'Section 8-1 ITAA 1997'),
('instant_writeoff_threshold', 'Instant Asset Write-Off Available', 'Assets under $20,000 qualify for immediate deduction. Purchase eligible assets before FY end to claim this year.', 'info', 'opportunity', 60, 'View Eligible Assets', 'Subdivision 328-D ITAA 1997'),
('bas_lodgment_due', 'BAS Lodgment Due', 'Your Business Activity Statement (BAS) is due for lodgment. Avoid penalties by lodging on time.', 'critical', 'deadline', 14, 'Lodge BAS', 'GST Act 1999'),
('tax_return_due', 'Tax Return Lodgment Due', 'Your company tax return is due for lodgment. Lodge by the deadline to avoid late lodgment penalties.', 'critical', 'deadline', 30, 'Lodge Tax Return', 'ITAA 1997'),
('fbt_return_due', 'FBT Return Lodgment Due', 'Fringe Benefits Tax (FBT) return is due for lodgment if you provided fringe benefits to employees.', 'warning', 'deadline', 30, 'Lodge FBT Return', 'FBTAA 1986'),
('legislative_change', 'Tax Law Change Alert', 'Recent changes to Australian tax legislation may affect your business. Review the changes to ensure compliance.', 'info', 'legislative', NULL, 'View Changes', NULL),
('rate_change', 'Tax Rate or Threshold Updated', 'The ATO has updated tax rates or thresholds that may affect your deductions or obligations.', 'info', 'legislative', NULL, 'View Updated Rates', NULL),
('compliance_warning', 'Compliance Issue Detected', 'Our analysis has detected a potential compliance issue that requires your attention. Review and address to avoid ATO penalties.', 'warning', 'compliance', NULL, 'Review Issue', NULL)
ON CONFLICT DO NOTHING;

-- Comments
COMMENT ON TABLE tax_alert_definitions IS 'Master list of alert types and their configurations';
COMMENT ON TABLE tax_alerts IS 'User-specific alert instances triggered by system monitoring';
COMMENT ON TABLE tax_alert_preferences IS 'User preferences for alert delivery and frequency';
COMMENT ON TABLE tax_alert_history IS 'Audit log of all alert-related events';

COMMIT;

-- ================================================================
-- Verification (run separately after migration)
-- ================================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('quickbooks_tokens', 'tax_alerts', 'tax_alert_definitions', 'tax_alert_preferences', 'tax_alert_history')
-- ORDER BY table_name;
