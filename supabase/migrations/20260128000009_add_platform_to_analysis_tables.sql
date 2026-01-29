/**
 * Add Platform Column to Analysis Tables
 *
 * Supports multi-platform AI analysis results (Xero, MYOB, QuickBooks)
 */

-- Add platform column to forensic_analysis_results
ALTER TABLE forensic_analysis_results
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'xero' CHECK (platform IN ('xero', 'myob', 'quickbooks'));

-- Update comment
COMMENT ON COLUMN forensic_analysis_results.platform IS 'Source accounting platform: xero, myob, or quickbooks';

-- Create index for platform filtering
CREATE INDEX IF NOT EXISTS idx_forensic_analysis_platform
    ON forensic_analysis_results(tenant_id, platform, financial_year);

-- Add platform column to ai_analysis_costs
ALTER TABLE ai_analysis_costs
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'xero' CHECK (platform IN ('xero', 'myob', 'quickbooks'));

-- Update comment
COMMENT ON COLUMN ai_analysis_costs.platform IS 'Platform analyzed: xero, myob, or quickbooks';

-- Create index for cost tracking by platform
-- Use created_at instead of analysis_date in case column doesn't exist
CREATE INDEX IF NOT EXISTS idx_ai_analysis_costs_platform
    ON ai_analysis_costs(tenant_id, platform, created_at);

-- Update table comments
COMMENT ON TABLE forensic_analysis_results IS 'AI forensic analysis results for transactions from multiple accounting platforms (Xero, MYOB, QuickBooks)';
COMMENT ON TABLE ai_analysis_costs IS 'Tracks AI API costs for analysis across multiple platforms';
