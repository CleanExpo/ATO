-- Add organization_id column to xero_connections for multi-org support
-- This links each Xero connection to an organization record

ALTER TABLE xero_connections
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_xero_connections_organization_id
ON xero_connections(organization_id);

-- Add comment for documentation
COMMENT ON COLUMN xero_connections.organization_id IS 'Links this Xero connection to an organization record for multi-org support';
