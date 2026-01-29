-- ================================================================
-- Enhanced Multi-Tenant Support for Accounting Firms
-- ================================================================
-- Purpose: Enable accounting firms to manage multiple client organizations
-- with proper role-based access control and organization management
-- Date: 2026-01-28

-- ================================================================
-- 1. Organizations Table
-- ================================================================
-- Stores organization metadata separate from Xero tenants
-- Allows for organizations that may not yet have Xero connected

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  abn TEXT,
  industry TEXT,
  business_size TEXT CHECK (business_size IN ('micro', 'small', 'medium', 'large')),

  -- Xero connection (nullable - may not be connected yet)
  xero_tenant_id TEXT UNIQUE,
  xero_connected_at TIMESTAMPTZ,

  -- Organization settings
  settings JSONB DEFAULT '{}'::jsonb,

  -- Billing and subscription (for future use)
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'trial', 'suspended', 'cancelled')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete
);

-- Indexes
CREATE INDEX idx_organizations_xero_tenant_id ON organizations(xero_tenant_id) WHERE xero_tenant_id IS NOT NULL;
CREATE INDEX idx_organizations_created_at ON organizations(created_at DESC);
CREATE INDEX idx_organizations_deleted_at ON organizations(deleted_at) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE organizations IS 'Organizations (clients) managed by accounting firms';
COMMENT ON COLUMN organizations.xero_tenant_id IS 'Xero tenant ID if connected, NULL if not yet connected';
COMMENT ON COLUMN organizations.settings IS 'JSON settings: { "financial_year_end": "2024-06-30", "tax_preferences": {...} }';

-- ================================================================
-- 2. Enhanced User-Organization Roles
-- ================================================================
-- Enhance the existing user_tenant_access table with accounting firm roles

-- Add new role types for accounting firms
ALTER TABLE user_tenant_access DROP CONSTRAINT IF EXISTS user_tenant_access_role_check;
ALTER TABLE user_tenant_access ADD CONSTRAINT user_tenant_access_role_check
  CHECK (role IN ('owner', 'admin', 'accountant', 'read_only'));

-- Add organization_id column to link to organizations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tenant_access' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE user_tenant_access ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_user_tenant_access_organization_id ON user_tenant_access(organization_id);
  END IF;
END $$;

-- Update comments
COMMENT ON COLUMN user_tenant_access.role IS 'User role: owner (full control), admin (read/write), accountant (tax professional), read_only (view only)';

-- ================================================================
-- 3. Organization Invitations Table
-- ================================================================
-- Secure invitation system for adding users to organizations

CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Invitation details
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'accountant', 'read_only')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),

  -- Token and expiration
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_org_invitations_organization_id ON organization_invitations(organization_id);
CREATE INDEX idx_org_invitations_email ON organization_invitations(email);
CREATE INDEX idx_org_invitations_token ON organization_invitations(token);
CREATE INDEX idx_org_invitations_status ON organization_invitations(status) WHERE status = 'pending';

-- Comments
COMMENT ON TABLE organization_invitations IS 'Pending invitations for users to join organizations';
COMMENT ON COLUMN organization_invitations.token IS 'Unique token for invitation URL (UUID or secure random string)';
COMMENT ON COLUMN organization_invitations.expires_at IS 'Invitation expiration (default: 7 days)';

-- ================================================================
-- 4. Organization Activity Log
-- ================================================================
-- Audit trail for organization changes

CREATE TABLE IF NOT EXISTS organization_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),

  -- Activity details
  action TEXT NOT NULL, -- e.g., 'user_added', 'report_generated', 'settings_updated'
  entity_type TEXT, -- e.g., 'user', 'report', 'settings'
  entity_id TEXT,

  -- Context
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_org_activity_log_organization_id ON organization_activity_log(organization_id);
CREATE INDEX idx_org_activity_log_user_id ON organization_activity_log(user_id);
CREATE INDEX idx_org_activity_log_created_at ON organization_activity_log(created_at DESC);
CREATE INDEX idx_org_activity_log_action ON organization_activity_log(action);

-- Comments
COMMENT ON TABLE organization_activity_log IS 'Audit trail for all organization activities';
COMMENT ON COLUMN organization_activity_log.metadata IS 'JSON metadata: { "old_value": "...", "new_value": "...", "details": {...} }';

-- ================================================================
-- 5. Row Level Security (RLS)
-- ================================================================

-- Organizations table RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users can view organizations they have access to
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
    )
  );

-- Owners and admins can update their organizations
CREATE POLICY "Owners and admins can update organizations"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Owners can create organizations
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Organization Invitations RLS
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- Owners and admins can view invitations for their organizations
CREATE POLICY "Owners and admins can view invitations"
  ON organization_invitations FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Owners and admins can create invitations
CREATE POLICY "Owners and admins can create invitations"
  ON organization_invitations FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Owners and admins can update invitations (revoke)
CREATE POLICY "Owners and admins can update invitations"
  ON organization_invitations FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Activity Log RLS
ALTER TABLE organization_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can view activity for their organizations
CREATE POLICY "Users can view organization activity"
  ON organization_activity_log FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
    )
  );

-- Service role can insert activity logs
CREATE POLICY "Service role can insert activity logs"
  ON organization_activity_log FOR INSERT
  WITH CHECK (true);

-- ================================================================
-- 6. Helper Functions
-- ================================================================

-- Function to get user's organizations
CREATE OR REPLACE FUNCTION get_user_organizations(p_user_id UUID)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  role TEXT,
  xero_connected BOOLEAN,
  member_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    uta.role,
    (o.xero_tenant_id IS NOT NULL) AS xero_connected,
    (
      SELECT COUNT(*)
      FROM user_tenant_access uta2
      WHERE uta2.organization_id = o.id
    ) AS member_count
  FROM organizations o
  INNER JOIN user_tenant_access uta ON uta.organization_id = o.id
  WHERE uta.user_id = p_user_id
  AND o.deleted_at IS NULL
  ORDER BY o.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can perform action on organization
CREATE OR REPLACE FUNCTION can_user_manage_organization(
  p_user_id UUID,
  p_organization_id UUID,
  p_required_role TEXT DEFAULT 'admin'
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Get user's role for this organization
  SELECT role INTO v_user_role
  FROM user_tenant_access
  WHERE user_id = p_user_id
  AND organization_id = p_organization_id;

  -- Check if user has required permissions
  IF p_required_role = 'owner' THEN
    RETURN v_user_role = 'owner';
  ELSIF p_required_role = 'admin' THEN
    RETURN v_user_role IN ('owner', 'admin');
  ELSIF p_required_role = 'accountant' THEN
    RETURN v_user_role IN ('owner', 'admin', 'accountant');
  ELSE
    RETURN v_user_role IS NOT NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept invitation
CREATE OR REPLACE FUNCTION accept_organization_invitation(
  p_token TEXT,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_invitation organization_invitations%ROWTYPE;
  v_organization organizations%ROWTYPE;
BEGIN
  -- Get invitation
  SELECT * INTO v_invitation
  FROM organization_invitations
  WHERE token = p_token
  AND status = 'pending'
  AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invitation'
    );
  END IF;

  -- Get organization
  SELECT * INTO v_organization
  FROM organizations
  WHERE id = v_invitation.organization_id;

  -- Add user to organization
  INSERT INTO user_tenant_access (user_id, organization_id, tenant_id, role)
  VALUES (
    p_user_id,
    v_invitation.organization_id,
    v_organization.xero_tenant_id,
    v_invitation.role
  )
  ON CONFLICT (user_id, tenant_id) DO UPDATE
  SET role = EXCLUDED.role,
      organization_id = EXCLUDED.organization_id;

  -- Mark invitation as accepted
  UPDATE organization_invitations
  SET status = 'accepted',
      accepted_at = NOW(),
      accepted_by = p_user_id,
      updated_at = NOW()
  WHERE id = v_invitation.id;

  -- Log activity
  INSERT INTO organization_activity_log (organization_id, user_id, action, entity_type, entity_id)
  VALUES (
    v_invitation.organization_id,
    p_user_id,
    'invitation_accepted',
    'user',
    p_user_id::TEXT
  );

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id,
    'organization_name', v_organization.name,
    'role', v_invitation.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create invitation
CREATE OR REPLACE FUNCTION create_organization_invitation(
  p_organization_id UUID,
  p_email TEXT,
  p_role TEXT,
  p_invited_by UUID
) RETURNS JSONB AS $$
DECLARE
  v_token TEXT;
  v_invitation_id UUID;
BEGIN
  -- Check if user can invite
  IF NOT can_user_manage_organization(p_invited_by, p_organization_id, 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions'
    );
  END IF;

  -- Generate secure token
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Create invitation
  INSERT INTO organization_invitations (
    organization_id,
    email,
    role,
    invited_by,
    token
  ) VALUES (
    p_organization_id,
    LOWER(p_email),
    p_role,
    p_invited_by,
    v_token
  )
  RETURNING id INTO v_invitation_id;

  -- Log activity
  INSERT INTO organization_activity_log (organization_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    p_organization_id,
    p_invited_by,
    'invitation_created',
    'invitation',
    v_invitation_id::TEXT,
    jsonb_build_object('email', p_email, 'role', p_role)
  );

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation_id,
    'token', v_token
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 7. Triggers
-- ================================================================

-- Update updated_at on organizations
CREATE OR REPLACE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on invitations
CREATE OR REPLACE TRIGGER update_org_invitations_updated_at
  BEFORE UPDATE ON organization_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 8. Grants
-- ================================================================

GRANT SELECT, INSERT, UPDATE ON organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON organization_invitations TO authenticated;
GRANT SELECT ON organization_activity_log TO authenticated;

GRANT EXECUTE ON FUNCTION get_user_organizations TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_manage_organization TO authenticated;
GRANT EXECUTE ON FUNCTION accept_organization_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION create_organization_invitation TO authenticated;
