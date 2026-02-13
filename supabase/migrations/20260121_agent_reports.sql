-- Migration: Create agent_reports table for autonomous monitoring system
-- Created: 2026-01-21
-- Purpose: Store findings and recommendations from monitoring agents

-- Create agent_reports table
CREATE TABLE IF NOT EXISTS agent_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'error')),
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_agent_reports_created_at ON agent_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_reports_agent_id ON agent_reports(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_reports_status ON agent_reports(status);
CREATE INDEX IF NOT EXISTS idx_agent_reports_agent_created ON agent_reports(agent_id, created_at DESC);

-- Create view for latest reports by agent
CREATE OR REPLACE VIEW latest_agent_reports AS
SELECT DISTINCT ON (agent_id)
  id,
  agent_id,
  status,
  findings,
  recommendations,
  metadata,
  created_at
FROM agent_reports
ORDER BY agent_id, created_at DESC;

-- Add comment
COMMENT ON TABLE agent_reports IS 'Stores findings and recommendations from autonomous monitoring agents';
COMMENT ON COLUMN agent_reports.agent_id IS 'Identifier for the agent (e.g., analysis-monitor, data-quality)';
COMMENT ON COLUMN agent_reports.status IS 'Overall status: healthy, warning, or error';
COMMENT ON COLUMN agent_reports.findings IS 'Array of findings discovered by the agent';
COMMENT ON COLUMN agent_reports.recommendations IS 'Array of recommended actions';
COMMENT ON COLUMN agent_reports.metadata IS 'Additional metadata like execution time, data points analyzed';

-- Optionally: Add RLS policies if needed
-- For now, allow service role full access
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage agent reports" ON agent_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
