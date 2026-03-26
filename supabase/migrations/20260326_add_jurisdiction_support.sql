-- =============================================================================
-- Migration: Multi-Jurisdiction Support
-- Description: Add jurisdiction infrastructure for AU/NZ/UK tax analysis
-- Date: 26/03/2026
-- =============================================================================

-- ─── Add jurisdiction to organizations ────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS jurisdiction TEXT NOT NULL DEFAULT 'AU';

-- Add check constraint (safe: default 'AU' means all existing rows pass)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'organizations_jurisdiction_check'
    AND table_name = 'organizations'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_jurisdiction_check
      CHECK (jurisdiction IN ('AU', 'NZ', 'UK'));
  END IF;
END $$;

-- Index for jurisdiction filtering
CREATE INDEX IF NOT EXISTS idx_organizations_jurisdiction
  ON public.organizations(jurisdiction);

-- ─── Add jurisdiction to tax_rates_cache ──────────────────────────────

ALTER TABLE public.tax_rates_cache
  ADD COLUMN IF NOT EXISTS jurisdiction TEXT NOT NULL DEFAULT 'AU';

-- ─── Create jurisdiction_tax_rates table ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.jurisdiction_tax_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('AU', 'NZ', 'UK')),
  rate_type TEXT NOT NULL,
  rate_key TEXT NOT NULL,
  rate_value NUMERIC,
  effective_from DATE NOT NULL,
  effective_to DATE,
  source_url TEXT,
  legislative_ref TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(jurisdiction, rate_type, rate_key, effective_from)
);

-- RLS: public read, service_role write
ALTER TABLE public.jurisdiction_tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read jurisdiction rates"
  ON public.jurisdiction_tax_rates FOR SELECT
  USING (true);

CREATE POLICY "Service role write jurisdiction rates"
  ON public.jurisdiction_tax_rates FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jurisdiction_tax_rates_jurisdiction
  ON public.jurisdiction_tax_rates(jurisdiction);

CREATE INDEX IF NOT EXISTS idx_jurisdiction_tax_rates_lookup
  ON public.jurisdiction_tax_rates(jurisdiction, rate_type, rate_key);

-- Updated at trigger
CREATE TRIGGER jurisdiction_tax_rates_updated_at
  BEFORE UPDATE ON public.jurisdiction_tax_rates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Create compliance_calendar table ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.compliance_calendar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('AU', 'NZ', 'UK')),
  deadline_type TEXT NOT NULL,
  deadline_name TEXT NOT NULL,
  description TEXT,
  entity_types TEXT[] DEFAULT '{}',
  due_date DATE NOT NULL,
  financial_year TEXT,
  legislative_ref TEXT,
  notification_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS: public read, service_role write
ALTER TABLE public.compliance_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read compliance calendar"
  ON public.compliance_calendar FOR SELECT
  USING (true);

CREATE POLICY "Service role write compliance calendar"
  ON public.compliance_calendar FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_compliance_calendar_jurisdiction
  ON public.compliance_calendar(jurisdiction);

CREATE INDEX IF NOT EXISTS idx_compliance_calendar_due_date
  ON public.compliance_calendar(due_date);

CREATE INDEX IF NOT EXISTS idx_compliance_calendar_lookup
  ON public.compliance_calendar(jurisdiction, due_date, financial_year);

-- ─── Create rate_change_log table ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_change_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('AU', 'NZ', 'UK')),
  rate_type TEXT NOT NULL,
  rate_key TEXT NOT NULL,
  old_value NUMERIC,
  new_value NUMERIC,
  change_detected_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  source_url TEXT,
  notification_sent BOOLEAN DEFAULT false
);

-- RLS: public read, service_role write
ALTER TABLE public.rate_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read rate change log"
  ON public.rate_change_log FOR SELECT
  USING (true);

CREATE POLICY "Service role write rate change log"
  ON public.rate_change_log FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rate_change_log_jurisdiction
  ON public.rate_change_log(jurisdiction);

CREATE INDEX IF NOT EXISTS idx_rate_change_log_detected_at
  ON public.rate_change_log(change_detected_at DESC);
