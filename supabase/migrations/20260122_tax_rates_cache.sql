-- ============================================================================
-- TAX RATES CACHE TABLE
-- Stores fetched tax rates from ATO.gov.au with 24-hour TTL
-- ============================================================================

-- Create tax rates cache table
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

-- Enable RLS
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
-- CLEANUP FUNCTION
-- Automatically delete cache entries older than 7 days
-- ============================================================================

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
