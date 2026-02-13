-- Migration: Create client_pm_assignments table
-- Purpose: Assigns a dedicated Senior PM context to every client organization
-- Date: 2026-02-13

-- =====================================================
-- Table: client_pm_assignments
-- =====================================================

CREATE TABLE IF NOT EXISTS client_pm_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),

  -- PM context (JSON blob for flexible schema evolution)
  pm_context JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Tracking metrics
  last_validation_at TIMESTAMPTZ,
  total_items_validated INTEGER NOT NULL DEFAULT 0,
  total_items_completed INTEGER NOT NULL DEFAULT 0,
  total_savings_identified BIGINT NOT NULL DEFAULT 0, -- AUD cents for precision

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One active PM assignment per organization
  CONSTRAINT unique_active_pm_per_org UNIQUE (organization_id, status)
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_client_pm_assignments_org_id
  ON client_pm_assignments(organization_id);

CREATE INDEX IF NOT EXISTS idx_client_pm_assignments_status
  ON client_pm_assignments(status);

CREATE INDEX IF NOT EXISTS idx_client_pm_assignments_last_validation
  ON client_pm_assignments(last_validation_at)
  WHERE status = 'active';

-- GIN index for querying PM context JSON
CREATE INDEX IF NOT EXISTS idx_client_pm_assignments_context
  ON client_pm_assignments USING GIN (pm_context);

-- =====================================================
-- Row Level Security
-- =====================================================

ALTER TABLE client_pm_assignments ENABLE ROW LEVEL SECURITY;

-- Use standardised tenant access check
CREATE POLICY "pm_assignments_tenant_isolation" ON client_pm_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_tenant_access uta
      WHERE uta.user_id = auth.uid()
        AND uta.organization_id = client_pm_assignments.organization_id
    )
  );

-- Service role bypass for server-side operations
CREATE POLICY "pm_assignments_service_role" ON client_pm_assignments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Trigger: auto-update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_client_pm_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_client_pm_assignments_updated_at
  BEFORE UPDATE ON client_pm_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_client_pm_assignments_updated_at();

-- =====================================================
-- Auto-assign PM on organization creation
-- =====================================================

CREATE OR REPLACE FUNCTION auto_assign_pm_on_org_create()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO client_pm_assignments (organization_id, status, pm_context)
  VALUES (
    NEW.id,
    'active',
    jsonb_build_object(
      'client_profile', jsonb_build_object(
        'industry', COALESCE(NEW.industry, null),
        'financial_year_end', 'June',
        'xero_connected', (NEW.xero_tenant_id IS NOT NULL),
        'accounting_platforms', CASE WHEN NEW.xero_tenant_id IS NOT NULL THEN '["xero"]'::jsonb ELSE '[]'::jsonb END
      ),
      'analysis_preferences', jsonb_build_object(
        'cadence', 'monthly',
        'priority_engines', '["deductions", "rnd", "div7a", "losses"]'::jsonb,
        'excluded_engines', '[]'::jsonb,
        'auto_reanalyse_on_sync', true
      ),
      'compliance_deadlines', '[]'::jsonb,
      'escalation_preference', 'daily_digest',
      'accountant_linked', false,
      'insights_summary', jsonb_build_object(
        'top_opportunities', '[]'::jsonb,
        'risk_areas', '[]'::jsonb,
        'last_analysis_confidence', 0,
        'trend', 'stable'
      )
    )
  )
  ON CONFLICT (organization_id, status) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_auto_assign_pm
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_pm_on_org_create();

-- =====================================================
-- Backfill: Assign PM to existing organizations
-- =====================================================

INSERT INTO client_pm_assignments (organization_id, status, pm_context)
SELECT
  o.id,
  'active',
  jsonb_build_object(
    'client_profile', jsonb_build_object(
      'industry', COALESCE(o.industry, null),
      'financial_year_end', 'June',
      'xero_connected', (o.xero_tenant_id IS NOT NULL),
      'accounting_platforms', CASE WHEN o.xero_tenant_id IS NOT NULL THEN '["xero"]'::jsonb ELSE '[]'::jsonb END
    ),
    'analysis_preferences', jsonb_build_object(
      'cadence', 'monthly',
      'priority_engines', '["deductions", "rnd", "div7a", "losses"]'::jsonb,
      'excluded_engines', '[]'::jsonb,
      'auto_reanalyse_on_sync', true
    ),
    'compliance_deadlines', '[]'::jsonb,
    'escalation_preference', 'daily_digest',
    'accountant_linked', false,
    'insights_summary', jsonb_build_object(
      'top_opportunities', '[]'::jsonb,
      'risk_areas', '[]'::jsonb,
      'last_analysis_confidence', 0,
      'trend', 'stable'
    )
  )
FROM organizations o
WHERE o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM client_pm_assignments cpa
    WHERE cpa.organization_id = o.id AND cpa.status = 'active'
  );
