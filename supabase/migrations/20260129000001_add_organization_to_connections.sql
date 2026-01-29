-- ================================================================
-- Add Organization Support to Platform Connections (UNI-230)
-- ================================================================
-- Purpose: Tie Xero, QuickBooks, and MYOB connections to organizations
--          instead of just users, enabling proper multi-org support
-- Date: 2026-01-29
--
-- CRITICAL: This migration enables enterprise multi-org functionality
--           Platform connections will switch when user switches organizations
--
-- DEPENDENCY: Requires migration 20260128000006_enhanced_multi_tenant_support.sql
--             to be applied first (creates organizations table)
-- ================================================================

-- ================================================================
-- 0. Dependency Check - Ensure organizations table exists
-- ================================================================

DO $$
BEGIN
  -- Check if organizations table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'organizations'
  ) THEN
    RAISE EXCEPTION 'organizations table does not exist. Please run migration 20260128000006_enhanced_multi_tenant_support.sql first.';
  END IF;

  -- Verify required columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'organizations.id column missing. Database schema incomplete.';
  END IF;

  RAISE NOTICE 'Dependency check passed: organizations table exists';
END $$;

-- ================================================================
-- 1. Add organization_id to xero_connections
-- ================================================================

-- Add organization_id column (nullable initially for existing connections)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'xero_connections' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE xero_connections
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

    -- Add index for performance
    CREATE INDEX idx_xero_connections_organization_id ON xero_connections(organization_id);

    -- Add comment
    COMMENT ON COLUMN xero_connections.organization_id IS 'Links Xero connection to specific organization for multi-org support';
  END IF;
END $$;

-- ================================================================
-- 2. Add organization_id to quickbooks_tokens
-- ================================================================

-- Add organization_id column (nullable initially for existing connections)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quickbooks_tokens' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE quickbooks_tokens
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

    -- Add index for performance
    CREATE INDEX idx_quickbooks_tokens_organization_id ON quickbooks_tokens(organization_id);

    -- Add comment
    COMMENT ON COLUMN quickbooks_tokens.organization_id IS 'Links QuickBooks connection to specific organization for multi-org support';
  END IF;
END $$;

-- ================================================================
-- 3. Add organization_id to myob_connections
-- ================================================================

-- Add organization_id column (nullable initially for existing connections)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'myob_connections' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE myob_connections
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

    -- Add index for performance
    CREATE INDEX idx_myob_connections_organization_id ON myob_connections(organization_id);

    -- Add comment
    COMMENT ON COLUMN myob_connections.organization_id IS 'Links MYOB connection to specific organization for multi-org support';
  END IF;
END $$;

-- ================================================================
-- 4. Update Unique Constraints
-- ================================================================

-- For xero_connections: One Xero tenant per organization (not per user)
-- Drop old constraint if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'xero_connections_tenant_id_key'
  ) THEN
    ALTER TABLE xero_connections DROP CONSTRAINT xero_connections_tenant_id_key;
  END IF;
END $$;

-- Add new composite unique constraint: one tenant per organization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'xero_connections_organization_tenant_unique'
  ) THEN
    -- Create unique constraint when organization_id is NOT NULL
    CREATE UNIQUE INDEX xero_connections_organization_tenant_unique
      ON xero_connections(organization_id, tenant_id)
      WHERE organization_id IS NOT NULL;
  END IF;
END $$;

-- For myob_connections: One company file per organization (not per user)
-- Drop old constraint if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'myob_connections_user_id_company_file_id_key'
  ) THEN
    ALTER TABLE myob_connections DROP CONSTRAINT myob_connections_user_id_company_file_id_key;
  END IF;
END $$;

-- Add new composite unique constraint: one company file per organization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'myob_connections_organization_company_file_unique'
  ) THEN
    -- Create unique constraint when organization_id is NOT NULL
    CREATE UNIQUE INDEX myob_connections_organization_company_file_unique
      ON myob_connections(organization_id, company_file_id)
      WHERE organization_id IS NOT NULL;
  END IF;
END $$;

-- ================================================================
-- 5. Migrate Existing Connections to Organizations
-- ================================================================

-- For users with existing Xero connections but no organizations:
-- Create a default organization and link the connection

-- Create default organizations for users with Xero connections
INSERT INTO organizations (name, xero_tenant_id, created_at, updated_at)
SELECT
  COALESCE(xc.organisation_name, xc.tenant_name, 'My Organisation') as name,
  xc.tenant_id as xero_tenant_id,
  NOW() as created_at,
  NOW() as updated_at
FROM xero_connections xc
WHERE xc.organization_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.xero_tenant_id = xc.tenant_id
  )
ON CONFLICT (xero_tenant_id) DO NOTHING;

-- Link existing Xero connections to organizations
UPDATE xero_connections xc
SET organization_id = o.id
FROM organizations o
WHERE xc.organization_id IS NULL
  AND xc.tenant_id = o.xero_tenant_id;

-- Create user access for organizations created from Xero connections
INSERT INTO user_tenant_access (user_id, organization_id, tenant_id, role, created_at, updated_at)
SELECT DISTINCT
  COALESCE(xc.user_id, (SELECT id FROM auth.users LIMIT 1)) as user_id,
  o.id as organization_id,
  o.xero_tenant_id as tenant_id,
  'owner' as role,
  NOW() as created_at,
  NOW() as updated_at
FROM xero_connections xc
INNER JOIN organizations o ON xc.tenant_id = o.xero_tenant_id
WHERE NOT EXISTS (
  SELECT 1 FROM user_tenant_access uta
  WHERE uta.user_id = COALESCE(xc.user_id, (SELECT id FROM auth.users LIMIT 1))
    AND uta.organization_id = o.id
);

-- For users with existing MYOB connections but no organizations:
-- Create a default organization and link the connection

-- Create default organizations for users with MYOB connections
INSERT INTO organizations (name, created_at, updated_at)
SELECT DISTINCT
  mc.company_file_name as name,
  NOW() as created_at,
  NOW() as updated_at
FROM myob_connections mc
WHERE mc.organization_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.name = mc.company_file_name
  )
ON CONFLICT DO NOTHING;

-- Link existing MYOB connections to organizations by name matching
UPDATE myob_connections mc
SET organization_id = o.id
FROM organizations o
WHERE mc.organization_id IS NULL
  AND mc.company_file_name = o.name
  AND o.xero_tenant_id IS NULL; -- Prefer orgs without Xero connections

-- Create user access for organizations created from MYOB connections
INSERT INTO user_tenant_access (user_id, organization_id, tenant_id, role, created_at, updated_at)
SELECT DISTINCT
  mc.user_id,
  mc.organization_id,
  NULL as tenant_id, -- MYOB doesn't use tenant_id concept
  'owner' as role,
  NOW() as created_at,
  NOW() as updated_at
FROM myob_connections mc
WHERE mc.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_tenant_access uta
    WHERE uta.user_id = mc.user_id
      AND uta.organization_id = mc.organization_id
  );

-- ================================================================
-- 5. Update RLS Policies for Xero Connections
-- ================================================================

-- Drop old RLS policies
DROP POLICY IF EXISTS "Users can view their own Xero connections" ON xero_connections;
DROP POLICY IF EXISTS "Users can insert their own Xero connections" ON xero_connections;
DROP POLICY IF EXISTS "Users can update their own Xero connections" ON xero_connections;
DROP POLICY IF EXISTS "Users can delete their own Xero connections" ON xero_connections;

-- Create new organization-based RLS policies
CREATE POLICY "Users can view Xero connections for their organizations"
  ON xero_connections FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert Xero connections for their organizations"
  ON xero_connections FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can update Xero connections for their organizations"
  ON xero_connections FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can delete Xero connections for their organizations"
  ON xero_connections FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- ================================================================
-- 6. Update RLS Policies for MYOB Connections
-- ================================================================

-- Drop old RLS policies
DROP POLICY IF EXISTS "Users can only access their own MYOB connections" ON myob_connections;
DROP POLICY IF EXISTS "Users can insert their own MYOB connections" ON myob_connections;
DROP POLICY IF EXISTS "Users can update their own MYOB connections" ON myob_connections;
DROP POLICY IF EXISTS "Users can delete their own MYOB connections" ON myob_connections;

-- Create new organization-based RLS policies
CREATE POLICY "Users can view MYOB connections for their organizations"
  ON myob_connections FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert MYOB connections for their organizations"
  ON myob_connections FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can update MYOB connections for their organizations"
  ON myob_connections FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can delete MYOB connections for their organizations"
  ON myob_connections FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- ================================================================
-- 7. Helper Functions
-- ================================================================

-- Function to get connection for current organization
CREATE OR REPLACE FUNCTION get_xero_connection_for_organization(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  tenant_id TEXT,
  tenant_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at BIGINT,
  organization_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    xc.id,
    xc.tenant_id,
    xc.tenant_name,
    xc.access_token,
    xc.refresh_token,
    xc.expires_at,
    xc.organization_id
  FROM xero_connections xc
  WHERE xc.organization_id = p_organization_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get MYOB connection for current organization
CREATE OR REPLACE FUNCTION get_myob_connection_for_organization(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  company_file_id TEXT,
  company_file_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  api_base_url TEXT,
  organization_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.user_id,
    mc.company_file_id,
    mc.company_file_name,
    mc.access_token,
    mc.refresh_token,
    mc.expires_at,
    mc.api_base_url,
    mc.organization_id
  FROM myob_connections mc
  WHERE mc.organization_id = p_organization_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 8. Update Organizations Table with Connection Info
-- ================================================================

-- Add connection status columns to organizations table for quick reference
DO $$
BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'xero_connected'
  ) THEN
    ALTER TABLE organizations ADD COLUMN xero_connected BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'quickbooks_connected'
  ) THEN
    ALTER TABLE organizations ADD COLUMN quickbooks_connected BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'myob_connected'
  ) THEN
    ALTER TABLE organizations ADD COLUMN myob_connected BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add last sync columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'last_xero_sync'
  ) THEN
    ALTER TABLE organizations ADD COLUMN last_xero_sync TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'last_quickbooks_sync'
  ) THEN
    ALTER TABLE organizations ADD COLUMN last_quickbooks_sync TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'last_myob_sync'
  ) THEN
    ALTER TABLE organizations ADD COLUMN last_myob_sync TIMESTAMPTZ;
  END IF;
END $$;

-- Update connection status for existing organizations
UPDATE organizations o
SET xero_connected = EXISTS (
  SELECT 1 FROM xero_connections xc WHERE xc.organization_id = o.id
);

UPDATE organizations o
SET myob_connected = EXISTS (
  SELECT 1 FROM myob_connections mc WHERE mc.organization_id = o.id
);

-- ================================================================
-- 9. Grants
-- ================================================================

GRANT EXECUTE ON FUNCTION get_xero_connection_for_organization TO authenticated;
GRANT EXECUTE ON FUNCTION get_myob_connection_for_organization TO authenticated;

-- ================================================================
-- 10. Comments and Documentation
-- ================================================================

COMMENT ON TABLE xero_connections IS 'Xero OAuth connections linked to organizations for multi-org support';
COMMENT ON TABLE myob_connections IS 'MYOB OAuth connections linked to organizations for multi-org support';

COMMENT ON COLUMN organizations.xero_connected IS 'Quick flag indicating if organization has Xero connected';
COMMENT ON COLUMN organizations.quickbooks_connected IS 'Quick flag indicating if organization has QuickBooks connected (uses xero_connections table)';
COMMENT ON COLUMN organizations.myob_connected IS 'Quick flag indicating if organization has MYOB connected';

-- ================================================================
-- Migration Complete
-- ================================================================

-- Verify migration success
DO $$
DECLARE
  xero_count INTEGER;
  myob_count INTEGER;
  orphan_xero INTEGER;
  orphan_myob INTEGER;
BEGIN
  -- Count connections
  SELECT COUNT(*) INTO xero_count FROM xero_connections;
  SELECT COUNT(*) INTO myob_count FROM myob_connections;

  -- Count orphaned connections (without organization_id)
  SELECT COUNT(*) INTO orphan_xero FROM xero_connections WHERE organization_id IS NULL;
  SELECT COUNT(*) INTO orphan_myob FROM myob_connections WHERE organization_id IS NULL;

  -- Log results
  RAISE NOTICE 'Migration Complete:';
  RAISE NOTICE '- Xero connections: % total, % orphaned', xero_count, orphan_xero;
  RAISE NOTICE '- MYOB connections: % total, % orphaned', myob_count, orphan_myob;

  IF orphan_xero > 0 OR orphan_myob > 0 THEN
    RAISE WARNING 'Some connections are orphaned (not linked to organizations). This is expected for new connections created during migration.';
  END IF;
END $$;
