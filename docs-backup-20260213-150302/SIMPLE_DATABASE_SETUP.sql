-- =====================================================================
-- SIMPLE DATABASE SETUP - Run this in Supabase SQL Editor
-- =====================================================================
-- This is the SIMPLEST version - just the essentials
-- Copy ALL of this and paste into Supabase SQL Editor, then click RUN
-- =====================================================================

-- Enable extensions (required)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- STEP 1: Create organizations table
-- =====================================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  abn TEXT,

  -- Platform connections
  xero_tenant_id TEXT UNIQUE,
  xero_connected BOOLEAN DEFAULT FALSE,
  quickbooks_connected BOOLEAN DEFAULT FALSE,
  myob_connected BOOLEAN DEFAULT FALSE,

  -- Settings
  settings JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- STEP 2: Create user_tenant_access table
-- =====================================================================
CREATE TABLE IF NOT EXISTS user_tenant_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'read_only',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_tenant_access_role_check'
  ) THEN
    ALTER TABLE user_tenant_access
    ADD CONSTRAINT user_tenant_access_role_check
    CHECK (role IN ('owner', 'admin', 'accountant', 'read_only'));
  END IF;
END $$;

-- =====================================================================
-- STEP 3: Create profiles table
-- =====================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- STEP 4: Create notifications table
-- =====================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- STEP 5: Create indexes
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_organizations_xero_tenant_id ON organizations(xero_tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_access_user_id ON user_tenant_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_access_org_id ON user_tenant_access(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- =====================================================================
-- STEP 6: Enable Row Level Security (RLS)
-- =====================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenant_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- STEP 7: Create RLS Policies
-- =====================================================================

-- Organizations: Users can view orgs they have access to
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id
      FROM user_tenant_access
      WHERE user_id = auth.uid()
    )
  );

-- Profiles: Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Profiles: Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Profiles: Service role can insert
DROP POLICY IF EXISTS "Service can insert profiles" ON profiles;
CREATE POLICY "Service can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (TRUE);

-- Notifications: Users see their own notifications
DROP POLICY IF EXISTS "Users view own notifications" ON notifications;
CREATE POLICY "Users view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Notifications: Users can update their own
DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- User tenant access: Users view their own access
DROP POLICY IF EXISTS "Users view own access" ON user_tenant_access;
CREATE POLICY "Users view own access"
  ON user_tenant_access FOR SELECT
  USING (auth.uid() = user_id);

-- =====================================================================
-- STEP 8: Create helper function
-- =====================================================================
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
  ORDER BY o.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- STEP 9: Create notification helper
-- =====================================================================
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

-- =====================================================================
-- STEP 10: Create unread count function
-- =====================================================================
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*)::INTEGER FROM notifications WHERE user_id = p_user_id AND read = FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- VERIFICATION - Run this to check if everything worked
-- =====================================================================
-- After running this script, run this query to verify:
/*
SELECT
  'organizations' as table_name,
  COUNT(*) as exists
FROM pg_tables
WHERE tablename = 'organizations'
UNION ALL
SELECT 'user_tenant_access', COUNT(*) FROM pg_tables WHERE tablename = 'user_tenant_access'
UNION ALL
SELECT 'profiles', COUNT(*) FROM pg_tables WHERE tablename = 'profiles'
UNION ALL
SELECT 'notifications', COUNT(*) FROM pg_tables WHERE tablename = 'notifications';
*/

-- =====================================================================
-- DONE!
-- =====================================================================
-- If you see 4 rows with count=1 each, everything is set up correctly!
-- You can now use the app without database errors.
