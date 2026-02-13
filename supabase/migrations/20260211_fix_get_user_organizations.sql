-- Fix get_user_organizations RPC: remove reference to non-existent deleted_at column
-- The organizations table doesn't have a deleted_at column, causing the function to fail
-- with: "column o.deleted_at does not exist"

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
    (SELECT COUNT(*) FROM user_tenant_access uta2 WHERE uta2.organization_id = o.id) AS member_count
  FROM organizations o
  INNER JOIN user_tenant_access uta ON uta.organization_id = o.id
  WHERE uta.user_id = p_user_id
  ORDER BY o.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
