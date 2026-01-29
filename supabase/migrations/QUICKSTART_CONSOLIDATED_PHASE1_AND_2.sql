-- =====================================================================
-- QUICKSTART CONSOLIDATED MIGRATION - Phase 1 & 2
-- =====================================================================
-- Purpose: One-click setup for all Phase 1 and 2 tables
-- Run this in Supabase SQL Editor if individual migrations fail
-- Date: 2026-01-29
-- =====================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. ORGANIZATIONS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  abn TEXT,
  industry TEXT,
  business_size TEXT CHECK (business_size IN ('micro', 'small', 'medium', 'large')),

  -- Platform connections
  xero_tenant_id TEXT UNIQUE,
  xero_connected_at TIMESTAMPTZ,
  xero_connected BOOLEAN DEFAULT FALSE,
  quickbooks_connected BOOLEAN DEFAULT FALSE,
  myob_connected BOOLEAN DEFAULT FALSE,

  last_xero_sync TIMESTAMPTZ,
  last_quickbooks_sync TIMESTAMPTZ,
  last_myob_sync TIMESTAMPTZ,

  -- Organization settings
  settings JSONB DEFAULT '{}'::jsonb,

  -- Billing
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'trial', 'suspended', 'cancelled')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_organizations_xero_tenant_id ON organizations(xero_tenant_id) WHERE xero_tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations(created_at DESC);

-- RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view organizations they have access to" ON organizations;
CREATE POLICY "Users can view organizations they have access to"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
    )
  );

-- =====================================================================
-- 2. USER TENANT ACCESS (Enhanced)
-- =====================================================================

-- Ensure user_tenant_access exists
CREATE TABLE IF NOT EXISTS user_tenant_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'read_only' CHECK (role IN ('owner', 'admin', 'accountant', 'read_only')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tenant_access_user_id ON user_tenant_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_access_organization_id ON user_tenant_access(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_access_tenant_id ON user_tenant_access(tenant_id);

ALTER TABLE user_tenant_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_tenant_access
DROP POLICY IF EXISTS "Users can view their own access entries"
  ON user_tenant_access FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage access for organizations they own"
  ON user_tenant_access FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- =====================================================================
-- 3. ORGANIZATION INVITATIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'accountant', 'read_only')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_invitations_organization_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_token ON organization_invitations(token);

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 4. ACTIVITY LOG
-- =====================================================================

CREATE TABLE IF NOT EXISTS organization_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_organization_id ON organization_activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON organization_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON organization_activity_log(created_at DESC);

ALTER TABLE organization_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view activity for their organizations"
  ON organization_activity_log FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
    )
  );

-- =====================================================================
-- 5. PROFILES TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  license_type TEXT CHECK (license_type IN ('comprehensive', 'core', 'wholesale_accountant')),
  license_active BOOLEAN DEFAULT FALSE,
  license_activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Service role can insert profiles"
  ON profiles FOR INSERT WITH CHECK (TRUE);

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- 6. PURCHASES TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  stripe_session_id TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('comprehensive', 'core', 'wholesale_accountant')),
  wholesale_tier TEXT CHECK (wholesale_tier IN ('standard', 'professional', 'enterprise')),
  amount_paid INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'aud',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  failure_reason TEXT,
  license_active BOOLEAN NOT NULL DEFAULT TRUE,
  license_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_organization_id ON purchases(organization_id);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own purchases"
  ON purchases FOR SELECT USING (auth.uid() = user_id);

-- =====================================================================
-- 7. NOTIFICATIONS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  action_url TEXT,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications"
  ON notifications FOR DELETE USING (auth.uid() = user_id);

-- =====================================================================
-- 8. HELPER FUNCTIONS
-- =====================================================================

-- Get user organizations
CREATE OR REPLACE FUNCTION get_user_organizations()
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  role TEXT,
  xero_connected BOOLEAN,
  quickbooks_connected BOOLEAN,
  myob_connected BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    uta.role,
    o.xero_connected,
    o.quickbooks_connected,
    o.myob_connected
  FROM organizations o
  INNER JOIN user_tenant_access uta ON uta.organization_id = o.id
  WHERE uta.user_id = auth.uid()
  AND o.deleted_at IS NULL
  ORDER BY o.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_organization_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_related_entity_type TEXT DEFAULT NULL,
  p_related_entity_id UUID DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id, organization_id, type, title, message,
    related_entity_type, related_entity_id, action_url, metadata
  ) VALUES (
    p_user_id, p_organization_id, p_type, p_title, p_message,
    p_related_entity_type, p_related_entity_id, p_action_url, p_metadata
  ) RETURNING id INTO v_notification_id;
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM notifications
  WHERE user_id = p_user_id AND read = FALSE;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- DONE!
-- =====================================================================
-- Run this query to verify everything was created:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('organizations', 'profiles', 'purchases', 'notifications', 'user_tenant_access', 'organization_invitations', 'organization_activity_log')
-- ORDER BY table_name;
