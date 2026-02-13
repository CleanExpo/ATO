-- Accountant Findings Table
-- Schema based on docs/diagrams/accountant-workflow-erd.md

-- Create enum types
CREATE TYPE workflow_area_type AS ENUM (
  'sundries',
  'deductions',
  'fbt',
  'div7a',
  'documents',
  'reconciliation'
);

CREATE TYPE confidence_level_type AS ENUM (
  'High',
  'Medium',
  'Low'
);

CREATE TYPE finding_status_type AS ENUM (
  'pending',
  'approved',
  'rejected',
  'deferred'
);

-- Create accountant_findings table
CREATE TABLE IF NOT EXISTS accountant_findings (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Workflow classification
  workflow_area workflow_area_type NOT NULL,
  status finding_status_type NOT NULL DEFAULT 'pending',

  -- Transaction details
  transaction_id TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,

  -- Current vs suggested
  current_classification TEXT,
  suggested_classification TEXT,
  suggested_action TEXT,

  -- Confidence scoring
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  confidence_level confidence_level_type NOT NULL,
  confidence_factors JSONB DEFAULT '[]'::jsonb,

  -- Legislation references
  legislation_refs JSONB DEFAULT '[]'::jsonb,

  -- AI reasoning
  reasoning TEXT NOT NULL,

  -- Financial context
  financial_year TEXT NOT NULL,
  estimated_benefit DECIMAL(15, 2) DEFAULT 0,

  -- Accountant review
  rejection_reason TEXT,
  accountant_notes TEXT,
  approved_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Indexes for common queries
  CONSTRAINT accountant_findings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT accountant_findings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_accountant_findings_workflow_area ON accountant_findings(workflow_area);
CREATE INDEX idx_accountant_findings_status ON accountant_findings(status);
CREATE INDEX idx_accountant_findings_confidence_level ON accountant_findings(confidence_level);
CREATE INDEX idx_accountant_findings_financial_year ON accountant_findings(financial_year);
CREATE INDEX idx_accountant_findings_estimated_benefit ON accountant_findings(estimated_benefit DESC);
CREATE INDEX idx_accountant_findings_created_at ON accountant_findings(created_at DESC);
CREATE INDEX idx_accountant_findings_user_id ON accountant_findings(user_id);
CREATE INDEX idx_accountant_findings_organization_id ON accountant_findings(organization_id);

-- Create composite indexes for common filter combinations
CREATE INDEX idx_accountant_findings_workflow_status ON accountant_findings(workflow_area, status);
CREATE INDEX idx_accountant_findings_org_workflow ON accountant_findings(organization_id, workflow_area);

-- Enable Row Level Security
ALTER TABLE accountant_findings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view findings for their organization
CREATE POLICY "Users can view organization findings"
  ON accountant_findings
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can insert findings for their organization
CREATE POLICY "Users can create organization findings"
  ON accountant_findings
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can update findings for their organization
CREATE POLICY "Users can update organization findings"
  ON accountant_findings
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can delete findings for their organization (admin only in app logic)
CREATE POLICY "Users can delete organization findings"
  ON accountant_findings
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_accountant_findings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accountant_findings_updated_at_trigger
  BEFORE UPDATE ON accountant_findings
  FOR EACH ROW
  EXECUTE FUNCTION update_accountant_findings_updated_at();

-- Add comments for documentation
COMMENT ON TABLE accountant_findings IS 'AI-generated tax findings for accountant review across 6 workflow areas';
COMMENT ON COLUMN accountant_findings.workflow_area IS 'Classification: sundries, deductions, fbt, div7a, documents, reconciliation';
COMMENT ON COLUMN accountant_findings.status IS 'Review status: pending, approved, rejected, deferred';
COMMENT ON COLUMN accountant_findings.confidence_score IS 'AI confidence score 0-100 based on legislation, precedent, documentation, data quality';
COMMENT ON COLUMN accountant_findings.confidence_level IS 'High (80-100), Medium (60-79), Low (0-59)';
COMMENT ON COLUMN accountant_findings.confidence_factors IS 'Array of {factor, impact, weight} objects explaining confidence score';
COMMENT ON COLUMN accountant_findings.legislation_refs IS 'Array of {section, title, url} objects linking to legislation.gov.au';
COMMENT ON COLUMN accountant_findings.estimated_benefit IS 'Estimated tax benefit/savings in dollars';
COMMENT ON COLUMN accountant_findings.approved_at IS 'Timestamp when accountant approved this finding for client report';
