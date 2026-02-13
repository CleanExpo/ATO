-- ============================================================
-- CONSOLIDATED MIGRATION: Create All Missing Tables
-- Date: 2026-02-10
-- Purpose: Create 15 missing tables identified in schema audit
-- Applied to: xwqymjisxmtcmaebcehw.supabase.co
-- ============================================================

-- Pre-flight: Ensure update_updated_at_column() function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. ENUM TYPES (for accountant_findings)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE workflow_area_type AS ENUM (
    'sundries', 'deductions', 'fbt', 'div7a', 'documents', 'reconciliation'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE confidence_level_type AS ENUM ('High', 'Medium', 'Low');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE finding_status_type AS ENUM ('pending', 'approved', 'rejected', 'deferred');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. accountant_findings (10 code refs, 6 dashboard pages)
-- ============================================================
CREATE TABLE IF NOT EXISTS accountant_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_area workflow_area_type NOT NULL,
  status finding_status_type NOT NULL DEFAULT 'pending',
  transaction_id TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  current_classification TEXT,
  suggested_classification TEXT,
  suggested_action TEXT,
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  confidence_level confidence_level_type NOT NULL,
  confidence_factors JSONB DEFAULT '[]'::jsonb,
  legislation_refs JSONB DEFAULT '[]'::jsonb,
  reasoning TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  estimated_benefit DECIMAL(15, 2) DEFAULT 0,
  rejection_reason TEXT,
  accountant_notes TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_af_workflow_area ON accountant_findings(workflow_area);
CREATE INDEX IF NOT EXISTS idx_af_status ON accountant_findings(status);
CREATE INDEX IF NOT EXISTS idx_af_confidence_level ON accountant_findings(confidence_level);
CREATE INDEX IF NOT EXISTS idx_af_financial_year ON accountant_findings(financial_year);
CREATE INDEX IF NOT EXISTS idx_af_estimated_benefit ON accountant_findings(estimated_benefit DESC);
CREATE INDEX IF NOT EXISTS idx_af_created_at ON accountant_findings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_af_user_id ON accountant_findings(user_id);
CREATE INDEX IF NOT EXISTS idx_af_organization_id ON accountant_findings(organization_id);
CREATE INDEX IF NOT EXISTS idx_af_workflow_status ON accountant_findings(workflow_area, status);
CREATE INDEX IF NOT EXISTS idx_af_org_workflow ON accountant_findings(organization_id, workflow_area);

ALTER TABLE accountant_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "af_select" ON accountant_findings FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_tenant_access WHERE user_id = auth.uid()
  ));

CREATE POLICY "af_insert" ON accountant_findings FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM user_tenant_access WHERE user_id = auth.uid()
  ));

CREATE POLICY "af_update" ON accountant_findings FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM user_tenant_access WHERE user_id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM user_tenant_access WHERE user_id = auth.uid()
  ));

CREATE POLICY "af_delete" ON accountant_findings FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM user_tenant_access WHERE user_id = auth.uid()
  ));

CREATE POLICY "af_service" ON accountant_findings FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_accountant_findings_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS accountant_findings_updated_at_trigger ON accountant_findings;
CREATE TRIGGER accountant_findings_updated_at_trigger
  BEFORE UPDATE ON accountant_findings FOR EACH ROW
  EXECUTE FUNCTION update_accountant_findings_updated_at();

-- ============================================================
-- 3. organization_activity_log (13 code refs)
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oal_organization_id ON organization_activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_oal_user_id ON organization_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_oal_created_at ON organization_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oal_action ON organization_activity_log(action);

ALTER TABLE organization_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oal_select" ON organization_activity_log FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_tenant_access WHERE user_id = auth.uid()
  ));

CREATE POLICY "oal_insert" ON organization_activity_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "oal_service" ON organization_activity_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 4. myob_connections (7 code refs)
-- ============================================================
CREATE TABLE IF NOT EXISTS myob_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_file_id TEXT NOT NULL,
  company_file_name TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  api_base_url TEXT NOT NULL,
  country_code TEXT DEFAULT 'AU',
  currency_code TEXT DEFAULT 'AUD',
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  UNIQUE(user_id, company_file_id)
);

CREATE INDEX IF NOT EXISTS idx_myob_user_id ON myob_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_myob_company_file_id ON myob_connections(company_file_id);
CREATE INDEX IF NOT EXISTS idx_myob_expires_at ON myob_connections(expires_at);

ALTER TABLE myob_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "myob_select" ON myob_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "myob_insert" ON myob_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "myob_update" ON myob_connections FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "myob_delete" ON myob_connections FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "myob_service" ON myob_connections FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 5. xero_transactions (5 code refs in reanalysis worker + analysis routes)
-- ============================================================
CREATE TABLE IF NOT EXISTS xero_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  date TEXT NOT NULL,
  contact_name TEXT,
  contact_id TEXT,
  total DECIMAL(15, 2) NOT NULL DEFAULT 0,
  description TEXT,
  raw_xero_data JSONB,
  entity_type TEXT,
  account_code TEXT,
  account_name TEXT,
  transaction_type TEXT,
  is_reconciled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_xt_tenant_id ON xero_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xt_contact_id ON xero_transactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_xt_date ON xero_transactions(date);

ALTER TABLE xero_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xt_service" ON xero_transactions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "xt_select" ON xero_transactions FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM xero_connections WHERE user_id = auth.uid()));

-- ============================================================
-- 6. generated_reports (7 code refs)
-- ============================================================
CREATE TABLE IF NOT EXISTS generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  abn TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('pdf', 'excel', 'both')),
  client_friendly BOOLEAN DEFAULT false,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pdf_path TEXT,
  excel_path TEXT,
  email_sent_to TEXT,
  email_sent_at TIMESTAMPTZ,
  download_count INT DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gr_tenant_id ON generated_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gr_report_id ON generated_reports(report_id);
CREATE INDEX IF NOT EXISTS idx_gr_generated_at ON generated_reports(generated_at DESC);

ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gr_service" ON generated_reports FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "gr_select" ON generated_reports FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM xero_connections WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION track_report_download(p_report_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE generated_reports
  SET download_count = download_count + 1,
      last_downloaded_at = NOW(),
      updated_at = NOW()
  WHERE report_id = p_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. xero_contacts (4 code refs)
-- ============================================================
CREATE TABLE IF NOT EXISTS xero_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES xero_connections(tenant_id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  abn TEXT,
  entity_type TEXT,
  contact_type TEXT NOT NULL DEFAULT 'other',
  is_related_party BOOLEAN DEFAULT FALSE,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  country TEXT,
  phone TEXT,
  mobile TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  accounts_receivable_balance DECIMAL(15, 2) DEFAULT 0,
  accounts_payable_balance DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_xero_data JSONB,
  UNIQUE(tenant_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_xc_tenant ON xero_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_xc_type ON xero_contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_xc_abn ON xero_contacts(abn) WHERE abn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_xc_entity_type ON xero_contacts(entity_type);
CREATE INDEX IF NOT EXISTS idx_xc_related_party ON xero_contacts(is_related_party) WHERE is_related_party = TRUE;
CREATE INDEX IF NOT EXISTS idx_xc_status ON xero_contacts(status);
CREATE INDEX IF NOT EXISTS idx_xc_name ON xero_contacts(name);

ALTER TABLE xero_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xc_select" ON xero_contacts FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM xero_connections WHERE user_id = auth.uid()));

CREATE POLICY "xc_service" ON xero_contacts FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_xero_contacts_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS xero_contacts_updated_at ON xero_contacts;
CREATE TRIGGER xero_contacts_updated_at
  BEFORE UPDATE ON xero_contacts FOR EACH ROW
  EXECUTE FUNCTION update_xero_contacts_updated_at();

-- ============================================================
-- 8. organization_invitations (3 code refs)
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'accountant', 'read_only')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oi_organization_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_oi_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_oi_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_oi_status ON organization_invitations(status) WHERE status = 'pending';

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oi_select" ON organization_invitations FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_tenant_access WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "oi_insert" ON organization_invitations FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM user_tenant_access WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "oi_update" ON organization_invitations FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM user_tenant_access WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "oi_service" ON organization_invitations FOR ALL
  TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_org_invitations_updated_at ON organization_invitations;
CREATE TRIGGER update_org_invitations_updated_at
  BEFORE UPDATE ON organization_invitations FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 9. admin_audit_log (4 code refs)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_email TEXT,
  target_id TEXT,
  target_type TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aal_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_aal_actor_id ON admin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_aal_created_at ON admin_audit_log(created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aal_service" ON admin_audit_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 10. council_sessions (3 code refs)
-- ============================================================
CREATE TABLE IF NOT EXISTS council_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  advisor_recommendations JSONB DEFAULT '[]'::jsonb,
  final_decision TEXT,
  confidence DECIMAL(5, 2),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cs_org_id ON council_sessions(organisation_id);
CREATE INDEX IF NOT EXISTS idx_cs_started_at ON council_sessions(started_at DESC);

ALTER TABLE council_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_service" ON council_sessions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 11. conversion_events (3 code refs)
-- ============================================================
CREATE TABLE IF NOT EXISTS conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('awareness', 'interest', 'decision', 'action', 'retention')),
  action TEXT NOT NULL,
  value DECIMAL(15, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ce_org_id ON conversion_events(organisation_id);
CREATE INDEX IF NOT EXISTS idx_ce_stage ON conversion_events(stage);
CREATE INDEX IF NOT EXISTS idx_ce_created_at ON conversion_events(created_at DESC);

ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ce_service" ON conversion_events FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 12. advisor_metrics (2 code refs)
-- ============================================================
CREATE TABLE IF NOT EXISTS advisor_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor TEXT NOT NULL,
  organisation_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(15, 4),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_am_advisor ON advisor_metrics(advisor);
CREATE INDEX IF NOT EXISTS idx_am_org_id ON advisor_metrics(organisation_id);
CREATE INDEX IF NOT EXISTS idx_am_recorded_at ON advisor_metrics(recorded_at DESC);

ALTER TABLE advisor_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "am_service" ON advisor_metrics FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 13. abn_lookup_cache (2 code refs)
-- ============================================================
CREATE TABLE IF NOT EXISTS abn_lookup_cache (
  abn TEXT PRIMARY KEY,
  result JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE abn_lookup_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "abn_select" ON abn_lookup_cache FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "abn_service" ON abn_lookup_cache FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 14. consolidated_report_log (1 code ref)
-- ============================================================
CREATE TABLE IF NOT EXISTS consolidated_report_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id TEXT NOT NULL,
  accountant_email TEXT NOT NULL,
  report_id TEXT NOT NULL,
  total_clients INTEGER DEFAULT 0,
  successful_reports INTEGER DEFAULT 0,
  failed_reports INTEGER DEFAULT 0,
  total_opportunity DECIMAL(15, 2) DEFAULT 0,
  processing_time_ms INTEGER DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crl_accountant ON consolidated_report_log(accountant_id);
CREATE INDEX IF NOT EXISTS idx_crl_generated_at ON consolidated_report_log(generated_at DESC);

ALTER TABLE consolidated_report_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crl_service" ON consolidated_report_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 15. xero_tenants (1 code ref - share route needs org name)
-- ============================================================
CREATE TABLE IF NOT EXISTS xero_tenants (
  tenant_id TEXT PRIMARY KEY,
  organisation_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE xero_tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xten_select" ON xero_tenants FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "xten_service" ON xero_tenants FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 16. user_organization_access (1 code ref - consolidated reports)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_organization_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'accountant', 'read_only')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_uoa_user_id ON user_organization_access(user_id);
CREATE INDEX IF NOT EXISTS idx_uoa_org_id ON user_organization_access(organization_id);

ALTER TABLE user_organization_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uoa_select" ON user_organization_access FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "uoa_service" ON user_organization_access FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 17. ALTER user_tenant_access (add organization_id if missing)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tenant_access' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE user_tenant_access ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_uta_organization_id ON user_tenant_access(organization_id);
  END IF;
END $$;

ALTER TABLE user_tenant_access DROP CONSTRAINT IF EXISTS user_tenant_access_role_check;
ALTER TABLE user_tenant_access ADD CONSTRAINT user_tenant_access_role_check
  CHECK (role IN ('owner', 'admin', 'accountant', 'read_only'));

-- ============================================================
-- 18. Helper Functions
-- ============================================================

-- Get user organizations
CREATE OR REPLACE FUNCTION get_user_organizations(p_user_id UUID)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  role TEXT,
  xero_connected BOOLEAN,
  member_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    uta.role,
    (o.xero_tenant_id IS NOT NULL) AS xero_connected,
    (SELECT COUNT(*) FROM user_tenant_access uta2 WHERE uta2.organization_id = o.id) AS member_count
  FROM organizations o
  INNER JOIN user_tenant_access uta ON uta.organization_id = o.id
  WHERE uta.user_id = p_user_id
  AND o.deleted_at IS NULL
  ORDER BY o.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check user management permissions
CREATE OR REPLACE FUNCTION can_user_manage_organization(
  p_user_id UUID,
  p_organization_id UUID,
  p_required_role TEXT DEFAULT 'admin'
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  SELECT role INTO v_user_role
  FROM user_tenant_access
  WHERE user_id = p_user_id AND organization_id = p_organization_id;

  IF p_required_role = 'owner' THEN RETURN v_user_role = 'owner';
  ELSIF p_required_role = 'admin' THEN RETURN v_user_role IN ('owner', 'admin');
  ELSIF p_required_role = 'accountant' THEN RETURN v_user_role IN ('owner', 'admin', 'accountant');
  ELSE RETURN v_user_role IS NOT NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accept invitation
CREATE OR REPLACE FUNCTION accept_organization_invitation(p_token TEXT, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_invitation organization_invitations%ROWTYPE;
  v_organization organizations%ROWTYPE;
BEGIN
  SELECT * INTO v_invitation FROM organization_invitations
  WHERE token = p_token AND status = 'pending' AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  SELECT * INTO v_organization FROM organizations WHERE id = v_invitation.organization_id;

  INSERT INTO user_tenant_access (user_id, organization_id, tenant_id, role)
  VALUES (p_user_id, v_invitation.organization_id, v_organization.xero_tenant_id, v_invitation.role)
  ON CONFLICT (user_id, tenant_id) DO UPDATE
  SET role = EXCLUDED.role, organization_id = EXCLUDED.organization_id;

  UPDATE organization_invitations
  SET status = 'accepted', accepted_at = NOW(), accepted_by = p_user_id, updated_at = NOW()
  WHERE id = v_invitation.id;

  INSERT INTO organization_activity_log (organization_id, user_id, action, entity_type, entity_id)
  VALUES (v_invitation.organization_id, p_user_id, 'invitation_accepted', 'user', p_user_id::TEXT);

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id,
    'organization_name', v_organization.name,
    'role', v_invitation.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create invitation
CREATE OR REPLACE FUNCTION create_organization_invitation(
  p_organization_id UUID,
  p_email TEXT,
  p_role TEXT,
  p_invited_by UUID
) RETURNS JSONB AS $$
DECLARE
  v_token TEXT;
  v_invitation_id UUID;
BEGIN
  IF NOT can_user_manage_organization(p_invited_by, p_organization_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO organization_invitations (organization_id, email, role, invited_by, token)
  VALUES (p_organization_id, LOWER(p_email), p_role, p_invited_by, v_token)
  RETURNING id INTO v_invitation_id;

  INSERT INTO organization_activity_log (organization_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (p_organization_id, p_invited_by, 'invitation_created', 'invitation', v_invitation_id::TEXT,
          jsonb_build_object('email', p_email, 'role', p_role));

  RETURN jsonb_build_object('success', true, 'invitation_id', v_invitation_id, 'token', v_token);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 19. Grants
-- ============================================================
GRANT SELECT, INSERT, UPDATE ON organization_invitations TO authenticated;
GRANT SELECT ON organization_activity_log TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_organizations TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_manage_organization TO authenticated;
GRANT EXECUTE ON FUNCTION accept_organization_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION create_organization_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION track_report_download TO authenticated;
