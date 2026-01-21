-- ============================================================================
-- CONSOLIDATED MIGRATION: New Features (Agent Reports + Tax Rates Cache)
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. AGENT REPORTS TABLE
-- Stores findings and recommendations from autonomous monitoring agents
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'error')),
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Add constraint to ensure JSONB fields are arrays
  CONSTRAINT valid_findings CHECK (jsonb_typeof(findings) = 'array'),
  CONSTRAINT valid_recommendations CHECK (jsonb_typeof(recommendations) = 'array'),
  CONSTRAINT valid_metadata CHECK (jsonb_typeof(metadata) = 'object')
);

-- Create indexes for agent reports
CREATE INDEX IF NOT EXISTS idx_agent_reports_created_at
  ON agent_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_reports_agent_id
  ON agent_reports(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_reports_status
  ON agent_reports(status);

CREATE INDEX IF NOT EXISTS idx_agent_reports_agent_created
  ON agent_reports(agent_id, created_at DESC);

-- Create view for latest agent reports
CREATE OR REPLACE VIEW latest_agent_reports AS
SELECT DISTINCT ON (agent_id)
  id, agent_id, status, findings, recommendations, metadata, created_at
FROM agent_reports
ORDER BY agent_id, created_at DESC;

-- Enable RLS for agent_reports
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;

-- Policy for service role (API access)
CREATE POLICY IF NOT EXISTS "Service role can manage agent reports"
  ON agent_reports
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy for authenticated users (read only)
CREATE POLICY IF NOT EXISTS "Authenticated users can read agent reports"
  ON agent_reports
  FOR SELECT TO authenticated
  USING (true);

-- Add comment
COMMENT ON TABLE agent_reports IS 'Stores findings and recommendations from autonomous monitoring agents. Updated every 5 minutes.';

-- ============================================================================
-- 2. TAX RATES CACHE TABLE
-- Stores fetched tax rates from ATO.gov.au with 24-hour TTL
-- ============================================================================

CREATE TABLE IF NOT EXISTS tax_rates_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rates JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Add constraint to ensure rates is a valid object
  CONSTRAINT valid_rates CHECK (jsonb_typeof(rates) = 'object')
);

-- Create index on created_at for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tax_rates_cache_created_at
  ON tax_rates_cache(created_at DESC);

-- Enable RLS for tax_rates_cache
ALTER TABLE tax_rates_cache ENABLE ROW LEVEL SECURITY;

-- Policy for service role (API access)
CREATE POLICY IF NOT EXISTS "Service role can manage tax rates cache"
  ON tax_rates_cache
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy for authenticated users (read only)
CREATE POLICY IF NOT EXISTS "Authenticated users can read tax rates"
  ON tax_rates_cache
  FOR SELECT TO authenticated
  USING (true);

-- Add comment
COMMENT ON TABLE tax_rates_cache IS 'Caches fetched Australian tax rates from ATO.gov.au. TTL: 24 hours.';

-- ============================================================================
-- 3. CLEANUP FUNCTIONS
-- Automatically delete old cache entries
-- ============================================================================

-- Cleanup old agent reports (keep last 30 days)
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

-- Cleanup old tax rates cache (keep last 7 days)
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
-- 4. VERIFICATION QUERIES
-- Run these to verify the migration succeeded
-- ============================================================================

-- Verify tables exist
DO $$
BEGIN
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
END $$;

-- Verify indexes
DO $$
BEGIN
  RAISE NOTICE 'Indexes created:';
  RAISE NOTICE '  - idx_agent_reports_created_at';
  RAISE NOTICE '  - idx_agent_reports_agent_id';
  RAISE NOTICE '  - idx_agent_reports_status';
  RAISE NOTICE '  - idx_agent_reports_agent_created';
  RAISE NOTICE '  - idx_tax_rates_cache_created_at';
END $$;

-- Verify RLS is enabled
DO $$
BEGIN
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
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- Test insert (will be rolled back if in a transaction)
DO $$
BEGIN
  -- Test agent_reports insert
  INSERT INTO agent_reports (agent_id, status, findings, recommendations)
  VALUES ('test-agent', 'healthy', '[]'::jsonb, '[]'::jsonb);

  DELETE FROM agent_reports WHERE agent_id = 'test-agent';

  RAISE NOTICE '✅ Test insert/delete successful on agent_reports';

  -- Test tax_rates_cache insert
  INSERT INTO tax_rates_cache (rates)
  VALUES ('{"test": true}'::jsonb);

  DELETE FROM tax_rates_cache WHERE rates->>'test' = 'true';

  RAISE NOTICE '✅ Test insert/delete successful on tax_rates_cache';
END $$;

RAISE NOTICE '';
RAISE NOTICE '====================================';
RAISE NOTICE 'Migration completed successfully! ✅';
RAISE NOTICE '====================================';
