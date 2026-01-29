-- ============================================================================
-- CONSOLIDATED MIGRATION: New Features (Agent Reports + Tax Rates Cache)
-- Fixed version - Compatible with PostgreSQL 13+
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. AGENT REPORTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'error')),
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_findings CHECK (jsonb_typeof(findings) = 'array'),
  CONSTRAINT valid_recommendations CHECK (jsonb_typeof(recommendations) = 'array'),
  CONSTRAINT valid_metadata CHECK (jsonb_typeof(metadata) = 'object')
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_reports_created_at
  ON agent_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_reports_agent_id
  ON agent_reports(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_reports_status
  ON agent_reports(status);

CREATE INDEX IF NOT EXISTS idx_agent_reports_agent_created
  ON agent_reports(agent_id, created_at DESC);

-- Create view
CREATE OR REPLACE VIEW latest_agent_reports AS
SELECT DISTINCT ON (agent_id)
  id, agent_id, status, findings, recommendations, metadata, created_at
FROM agent_reports
ORDER BY agent_id, created_at DESC;

-- Enable RLS
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage agent reports" ON agent_reports;
DROP POLICY IF EXISTS "Authenticated users can read agent reports" ON agent_reports;

-- Create policies (without IF NOT EXISTS)
CREATE POLICY "Service role can manage agent reports" ON agent_reports
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read agent reports" ON agent_reports
  FOR SELECT TO authenticated
  USING (true);

COMMENT ON TABLE agent_reports IS 'Stores findings and recommendations from autonomous monitoring agents. Updated every 5 minutes.';

-- ============================================================================
-- 2. TAX RATES CACHE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tax_rates_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rates JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_rates CHECK (jsonb_typeof(rates) = 'object')
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_tax_rates_cache_created_at
  ON tax_rates_cache(created_at DESC);

-- Enable RLS
ALTER TABLE tax_rates_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage tax rates cache" ON tax_rates_cache;
DROP POLICY IF EXISTS "Authenticated users can read tax rates" ON tax_rates_cache;

-- Create policies (without IF NOT EXISTS)
CREATE POLICY "Service role can manage tax rates cache" ON tax_rates_cache
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read tax rates" ON tax_rates_cache
  FOR SELECT TO authenticated
  USING (true);

COMMENT ON TABLE tax_rates_cache IS 'Caches fetched Australian tax rates from ATO.gov.au. TTL: 24 hours.';

-- ============================================================================
-- 3. CLEANUP FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_agent_reports()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM agent_reports
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

COMMENT ON FUNCTION cleanup_old_agent_reports IS 'Deletes agent reports older than 30 days';

CREATE OR REPLACE FUNCTION cleanup_old_tax_rates_cache()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM tax_rates_cache
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

COMMENT ON FUNCTION cleanup_old_tax_rates_cache IS 'Deletes tax rates cache entries older than 7 days';

-- ============================================================================
-- 4. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify tables exist
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agent_reports') THEN
    RAISE NOTICE '✅ agent_reports table created successfully';
  ELSE
    RAISE WARNING '❌ agent_reports table NOT found';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tax_rates_cache') THEN
    RAISE NOTICE '✅ tax_rates_cache table created successfully';
  ELSE
    RAISE WARNING '❌ tax_rates_cache table NOT found';
  END IF;

  -- Verify RLS enabled
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'agent_reports'
    AND relrowsecurity = true
  ) THEN
    RAISE NOTICE '✅ RLS enabled on agent_reports';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'tax_rates_cache'
    AND relrowsecurity = true
  ) THEN
    RAISE NOTICE '✅ RLS enabled on tax_rates_cache';
  END IF;

  RAISE NOTICE '====================================';
  RAISE NOTICE 'Migration completed successfully! ✅';
  RAISE NOTICE '====================================';
END $$;
