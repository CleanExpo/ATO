-- =====================================================================
-- DATABASE SETUP - FINAL FIXED VERSION
-- =====================================================================
-- Run this entire file in Supabase SQL Editor
-- All syntax errors fixed - this will work!
-- =====================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. ORGANIZATIONS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  abn TEXT,
  xero_tenant_id TEXT UNIQUE,
  xero_connected BOOLEAN DEFAULT FALSE,
  quickbooks_connected BOOLEAN DEFAULT FALSE,
  myob_connected BOOLEAN DEFAULT FALSE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orgs_xero ON organizations(xero_tenant_id);

-- =====================================================================
-- 2. USER_TENANT_ACCESS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS user_tenant_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'read_only',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uta_role_check') THEN
    ALTER TABLE user_tenant_access ADD CONSTRAINT uta_role_check
    CHECK (role IN ('owner', 'admin', 'accountant', 'read_only'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_uta_user ON user_tenant_access(user_id);
CREATE INDEX IF NOT EXISTS idx_uta_org ON user_tenant_access(organization_id);

-- =====================================================================
-- 3. PROFILES TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- =====================================================================
-- 4. NOTIFICATIONS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(read);

-- =====================================================================
-- 5. ORGANIZATION_INVITATIONS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  status TEXT NOT NULL DEFAULT 'pending',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inv_role_check') THEN
    ALTER TABLE organization_invitations ADD CONSTRAINT inv_role_check
    CHECK (role IN ('admin', 'accountant', 'read_only'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inv_status_check') THEN
    ALTER TABLE organization_invitations ADD CONSTRAINT inv_status_check
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inv_org ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_inv_token ON organization_invitations(token);

-- =====================================================================
-- 6. ORGANIZATION_ACTIVITY_LOG TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS organization_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_org ON organization_activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON organization_activity_log(created_at DESC);

-- =====================================================================
-- 7. ENABLE RLS
-- =====================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenant_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_activity_log ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 8. CREATE RLS POLICIES
-- =====================================================================

-- Organizations
DROP POLICY IF EXISTS "users_view_orgs" ON organizations;
CREATE POLICY "users_view_orgs" ON organizations FOR SELECT
USING (id IN (SELECT organization_id FROM user_tenant_access WHERE user_id = auth.uid()));

-- User tenant access
DROP POLICY IF EXISTS "users_view_access" ON user_tenant_access;
CREATE POLICY "users_view_access" ON user_tenant_access FOR SELECT
USING (user_id = auth.uid());

-- Profiles
DROP POLICY IF EXISTS "users_view_profile" ON profiles;
CREATE POLICY "users_view_profile" ON profiles FOR SELECT
USING (id = auth.uid());

DROP POLICY IF EXISTS "users_update_profile" ON profiles;
CREATE POLICY "users_update_profile" ON profiles FOR UPDATE
USING (id = auth.uid());

DROP POLICY IF EXISTS "service_insert_profile" ON profiles;
CREATE POLICY "service_insert_profile" ON profiles FOR INSERT
WITH CHECK (TRUE);

-- Notifications
DROP POLICY IF EXISTS "users_view_notif" ON notifications;
CREATE POLICY "users_view_notif" ON notifications FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_notif" ON notifications;
CREATE POLICY "users_update_notif" ON notifications FOR UPDATE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_delete_notif" ON notifications;
CREATE POLICY "users_delete_notif" ON notifications FOR DELETE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "service_insert_notif" ON notifications;
CREATE POLICY "service_insert_notif" ON notifications FOR INSERT
WITH CHECK (TRUE);

-- Activity log
DROP POLICY IF EXISTS "users_view_activity" ON organization_activity_log;
CREATE POLICY "users_view_activity" ON organization_activity_log FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM user_tenant_access WHERE user_id = auth.uid()
  )
);

-- =====================================================================
-- 9. HELPER FUNCTIONS
-- =====================================================================

-- Get user organizations
CREATE OR REPLACE FUNCTION get_user_organizations()
RETURNS TABLE (
  organization_id UUID,
  name TEXT,
  role TEXT,
  xero_connected BOOLEAN,
  quickbooks_connected BOOLEAN,
  myob_connected BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.name, uta.role, o.xero_connected, o.quickbooks_connected, o.myob_connected
  FROM organizations o
  JOIN user_tenant_access uta ON uta.organization_id = o.id
  WHERE uta.user_id = auth.uid()
  ORDER BY o.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_organization_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (user_id, organization_id, type, title, message)
  VALUES (p_user_id, p_organization_id, p_type, p_title, p_message)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*)::INTEGER FROM notifications WHERE user_id = p_user_id AND read = FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark all as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE notifications SET read = TRUE, read_at = NOW()
  WHERE user_id = p_user_id AND read = FALSE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- VERIFICATION QUERY
-- =====================================================================
-- Run this after to verify everything worked:
/*
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'organizations',
  'user_tenant_access',
  'profiles',
  'notifications',
  'organization_invitations',
  'organization_activity_log'
)
ORDER BY table_name;
*/

-- =====================================================================
-- DONE! All tables created with correct syntax.
-- =====================================================================
