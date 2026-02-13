-- Add rate version tracking to forensic_analysis_results
-- Enables detection of stale analyses when tax rates change
-- All dollar amounts in existing analyses remain valid but can now be flagged
-- for re-analysis when rate versions differ from current rates.

ALTER TABLE forensic_analysis_results
  ADD COLUMN IF NOT EXISTS tax_rate_version TEXT,
  ADD COLUMN IF NOT EXISTS tax_rates_fetched_at TIMESTAMPTZ;

COMMENT ON COLUMN forensic_analysis_results.tax_rate_version IS 'Rate version hash at time of analysis — compare against current rates to detect stale analyses';
COMMENT ON COLUMN forensic_analysis_results.tax_rates_fetched_at IS 'When the tax rates used in this analysis were originally fetched from ATO';

-- Index for efficient stale-analysis queries
CREATE INDEX IF NOT EXISTS idx_forensic_analysis_rate_version
  ON forensic_analysis_results (tax_rate_version)
  WHERE tax_rate_version IS NOT NULL;
