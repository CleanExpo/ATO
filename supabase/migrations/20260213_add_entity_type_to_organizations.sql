-- Add entity_type to organizations table
-- Supports standard entity types plus SMSF, non-profit, foreign companies.
-- Enables engine-specific logic (CGT discount eligibility, loss carry-forward
-- rules, FBT concessions, etc.) per entity classification.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS entity_type TEXT
    DEFAULT 'unknown'
    CHECK (entity_type IN (
      'individual',
      'company',
      'small_business',
      'trust',
      'partnership',
      'smsf',
      'non_profit',
      'foreign_company',
      'unknown'
    ));

COMMENT ON COLUMN organizations.entity_type IS
  'Tax entity classification: individual, company, small_business, trust, partnership, smsf (Self-Managed Super Fund), non_profit (DGR/TCC exempt), foreign_company (s 6-5 non-resident), unknown';

-- Index for entity-type-based queries
CREATE INDEX IF NOT EXISTS idx_organizations_entity_type
  ON organizations (entity_type);
