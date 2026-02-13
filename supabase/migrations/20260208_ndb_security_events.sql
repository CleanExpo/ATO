-- P2-8: Notifiable Data Breaches (NDB) Security Infrastructure
-- Privacy Act 1988, Part IIIC — Notifiable Data Breaches scheme
--
-- Tables:
--   security_events  — logs security-relevant events (failed auth, rate limit, anomalous access)
--   data_breaches    — breach register (all breaches, even non-notifiable per s 26WK)
--
-- Assessment timeline: 30 days from awareness (s 26WH(2))

-- 1. Security Events table
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'auth_failure',
    'rate_limit_exceeded',
    'unauthorized_access',
    'token_compromise',
    'bulk_data_access',
    'suspicious_ip',
    'oauth_anomaly',
    'share_brute_force',
    'data_export',
    'admin_escalation'
  )),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  tenant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  resource_type TEXT,     -- e.g. 'transactions', 'reports', 'connections', 'share_link'
  resource_id TEXT,       -- specific resource identifier
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_tenant ON security_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip_address);
-- Composite index for breach detection queries (recent critical events)
CREATE INDEX IF NOT EXISTS idx_security_events_severity_created
  ON security_events(severity, created_at DESC);

-- 2. Data Breaches register (s 26WK Privacy Act 1988)
CREATE TABLE IF NOT EXISTS data_breaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Discovery and timeline
  discovery_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  estimated_breach_date TIMESTAMPTZ,
  assessment_deadline TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  -- Scope
  breach_type TEXT NOT NULL CHECK (breach_type IN (
    'unauthorized_access',
    'unauthorized_disclosure',
    'loss_of_data',
    'system_compromise'
  )),
  affected_tenant_ids UUID[] DEFAULT '{}',
  affected_record_count INTEGER,
  affected_data_types TEXT[] DEFAULT '{}',  -- e.g. {'email', 'financial_transactions', 'supplier_names', 'addresses'}
  -- Description
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  root_cause TEXT,
  -- Assessment (s 26WH)
  assessment_status TEXT NOT NULL DEFAULT 'detected' CHECK (assessment_status IN (
    'detected',            -- Initial detection, not yet assessed
    'assessing',           -- Under 30-day assessment
    'notifiable',          -- Assessed as likely to cause serious harm
    'not_notifiable',      -- Assessed as not likely to cause serious harm
    'remediated'           -- Breach contained and remediated
  )),
  serious_harm_likely BOOLEAN,  -- NULL = not yet assessed
  assessment_notes TEXT,
  -- OAIC notification (s 26WK(3))
  oaic_notified BOOLEAN NOT NULL DEFAULT FALSE,
  oaic_notification_date TIMESTAMPTZ,
  oaic_reference_id TEXT,
  -- Individual notification (s 26WL)
  individuals_notified BOOLEAN NOT NULL DEFAULT FALSE,
  individuals_notification_date TIMESTAMPTZ,
  notification_method TEXT,  -- e.g. 'email', 'in_app', 'written'
  -- Remediation
  remediation_actions TEXT,
  remediated_at TIMESTAMPTZ,
  -- Metadata
  detected_by TEXT NOT NULL DEFAULT 'automated',  -- 'automated', 'manual', 'user_report', 'third_party'
  related_security_event_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_breaches_status ON data_breaches(assessment_status);
CREATE INDEX IF NOT EXISTS idx_data_breaches_deadline ON data_breaches(assessment_deadline)
  WHERE assessment_status IN ('detected', 'assessing');

-- 3. RLS Policies — admin-only access
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_breaches ENABLE ROW LEVEL SECURITY;

-- Security events: admins can read, service role can insert
CREATE POLICY security_events_admin_read ON security_events
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY security_events_service_insert ON security_events
  FOR INSERT
  WITH CHECK (TRUE);  -- Service role only (RLS bypassed for service role)

-- Data breaches: admins can read and update
CREATE POLICY data_breaches_admin_read ON data_breaches
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY data_breaches_admin_update ON data_breaches
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY data_breaches_service_insert ON data_breaches
  FOR INSERT
  WITH CHECK (TRUE);  -- Service role only

-- 4. Function to count recent security events by type (for anomaly detection)
CREATE OR REPLACE FUNCTION count_security_events(
  p_event_type TEXT,
  p_window_minutes INTEGER DEFAULT 60,
  p_ip_address TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO event_count
  FROM security_events
  WHERE event_type = p_event_type
    AND created_at > now() - (p_window_minutes || ' minutes')::INTERVAL
    AND (p_ip_address IS NULL OR ip_address = p_ip_address)
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);

  RETURN event_count;
END;
$$;

-- 5. Function to check for breaches approaching 30-day assessment deadline
CREATE OR REPLACE FUNCTION get_overdue_breach_assessments()
RETURNS SETOF data_breaches
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM data_breaches
  WHERE assessment_status IN ('detected', 'assessing')
    AND assessment_deadline <= now() + INTERVAL '7 days'
  ORDER BY assessment_deadline ASC;
END;
$$;
