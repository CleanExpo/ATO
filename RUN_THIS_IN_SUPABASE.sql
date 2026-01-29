-- =====================================================================
-- COPY ALL OF THIS AND RUN IN SUPABASE SQL EDITOR
-- =====================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- CREATE TABLES
-- =====================================================================

-- 1. Organizations
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

-- 2. User tenant access
CREATE TABLE IF NOT EXISTS user_tenant_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'accountant', 'read_only')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- CREATE INDEXES
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_uta_user_id ON user_tenant_access(user_id);
CREATE INDEX IF NOT EXISTS idx_uta_org_id ON user_tenant_access(organization_id);
CREATE INDEX IF NOT EXISTS idx_notif_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(read);

-- =====================================================================
-- ENABLE RLS
-- =====================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenant_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- CREATE HELPER FUNCTIONS (before policies since policies may use them)
-- =====================================================================

CREATE OR REPLACE FUNCTION get_user_organizations()
RETURNS TABLE (
  organization_id UUID,
  name TEXT,
  role TEXT,
  xero_connected BOOLEAN,
  quickbooks_connected BOOLEAN,
  myob_connected BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE user_id = p_user_id AND read = FALSE
  );
END;
$$;

CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notifications
  SET read = TRUE, read_at = NOW()
  WHERE user_id = p_user_id AND read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_organization_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (user_id, organization_id, type, title, message)
  VALUES (p_user_id, p_organization_id, p_type, p_title, p_message)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- =====================================================================
-- CREATE RLS POLICIES
-- =====================================================================

-- Organizations policies
DO $$
BEGIN
  DROP POLICY IF EXISTS pol_org_select ON organizations;
  CREATE POLICY pol_org_select ON organizations
    FOR SELECT
    USING (
      id IN (
        SELECT organization_id
        FROM user_tenant_access
        WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy pol_org_select: %', SQLERRM;
END $$;

-- User tenant access policies
DO $$
BEGIN
  DROP POLICY IF EXISTS pol_uta_select ON user_tenant_access;
  CREATE POLICY pol_uta_select ON user_tenant_access
    FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy pol_uta_select: %', SQLERRM;
END $$;

-- Profiles policies
DO $$
BEGIN
  DROP POLICY IF EXISTS pol_prof_select ON profiles;
  CREATE POLICY pol_prof_select ON profiles
    FOR SELECT
    USING (id = auth.uid());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy pol_prof_select: %', SQLERRM;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS pol_prof_update ON profiles;
  CREATE POLICY pol_prof_update ON profiles
    FOR UPDATE
    USING (id = auth.uid());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy pol_prof_update: %', SQLERRM;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS pol_prof_insert ON profiles;
  CREATE POLICY pol_prof_insert ON profiles
    FOR INSERT
    WITH CHECK (TRUE);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy pol_prof_insert: %', SQLERRM;
END $$;

-- Notifications policies
DO $$
BEGIN
  DROP POLICY IF EXISTS pol_notif_select ON notifications;
  CREATE POLICY pol_notif_select ON notifications
    FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy pol_notif_select: %', SQLERRM;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS pol_notif_update ON notifications;
  CREATE POLICY pol_notif_update ON notifications
    FOR UPDATE
    USING (user_id = auth.uid());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy pol_notif_update: %', SQLERRM;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS pol_notif_delete ON notifications;
  CREATE POLICY pol_notif_delete ON notifications
    FOR DELETE
    USING (user_id = auth.uid());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy pol_notif_delete: %', SQLERRM;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS pol_notif_insert ON notifications;
  CREATE POLICY pol_notif_insert ON notifications
    FOR INSERT
    WITH CHECK (TRUE);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy pol_notif_insert: %', SQLERRM;
END $$;

-- =====================================================================
-- VERIFICATION
-- =====================================================================

SELECT
  '✅ SETUP COMPLETE!' as status,
  COUNT(*) as tables_created
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'organizations',
    'user_tenant_access',
    'profiles',
    'notifications'
  );

-- =====================================================================
-- DONE! You should see "✅ SETUP COMPLETE!" with tables_created = 4
-- =====================================================================
