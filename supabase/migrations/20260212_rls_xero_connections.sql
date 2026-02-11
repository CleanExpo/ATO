-- Migration: Enable RLS on xero_connections and fix token table security
-- Fixes: DATA-004 (xero_connections no RLS), DATA-005 (inconsistent RLS patterns)
-- Date: 2026-02-12

-- ============================================================
-- 1. Enable RLS on xero_connections (CRITICAL - stores OAuth tokens)
-- ============================================================
ALTER TABLE IF EXISTS xero_connections ENABLE ROW LEVEL SECURITY;

-- Users can only read their own connections
DROP POLICY IF EXISTS "Users can view own xero connections" ON xero_connections;
CREATE POLICY "Users can view own xero connections"
  ON xero_connections FOR SELECT
  USING (user_id = auth.uid());

-- Users can only update their own connections (token refresh)
DROP POLICY IF EXISTS "Users can update own xero connections" ON xero_connections;
CREATE POLICY "Users can update own xero connections"
  ON xero_connections FOR UPDATE
  USING (user_id = auth.uid());

-- Users can insert their own connections (OAuth callback)
DROP POLICY IF EXISTS "Users can insert own xero connections" ON xero_connections;
CREATE POLICY "Users can insert own xero connections"
  ON xero_connections FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Service role bypass for background operations (token refresh, sync)
DROP POLICY IF EXISTS "Service role full access to xero connections" ON xero_connections;
CREATE POLICY "Service role full access to xero connections"
  ON xero_connections FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 2. Enable RLS on quickbooks_tokens
-- ============================================================
ALTER TABLE IF EXISTS quickbooks_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own quickbooks tokens" ON quickbooks_tokens;
CREATE POLICY "Users can view own quickbooks tokens"
  ON quickbooks_tokens FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own quickbooks tokens" ON quickbooks_tokens;
CREATE POLICY "Users can update own quickbooks tokens"
  ON quickbooks_tokens FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own quickbooks tokens" ON quickbooks_tokens;
CREATE POLICY "Users can insert own quickbooks tokens"
  ON quickbooks_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access to quickbooks tokens" ON quickbooks_tokens;
CREATE POLICY "Service role full access to quickbooks tokens"
  ON quickbooks_tokens FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 3. Enable RLS on audit_sync_status
-- ============================================================
ALTER TABLE IF EXISTS audit_sync_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant-scoped access to audit sync status" ON audit_sync_status;
CREATE POLICY "Tenant-scoped access to audit sync status"
  ON audit_sync_status FOR ALL
  USING (check_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Service role full access to audit sync status" ON audit_sync_status;
CREATE POLICY "Service role full access to audit sync status"
  ON audit_sync_status FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 4. Migrate old-pattern RLS to check_tenant_access() (DATA-005)
-- Tables still using the old xero_connections join pattern
-- ============================================================

-- xero_transactions: migrate from old pattern
DO $$
BEGIN
  -- Drop old policy if exists
  DROP POLICY IF EXISTS "Users can view own xero transactions" ON xero_transactions;
  DROP POLICY IF EXISTS "Users can manage own xero transactions" ON xero_transactions;

  -- Add new standardised policy
  CREATE POLICY "Tenant-scoped access to xero transactions"
    ON xero_transactions FOR ALL
    USING (check_tenant_access(tenant_id));
EXCEPTION
  WHEN undefined_table THEN NULL; -- Table may not exist
END $$;

-- generated_reports: migrate from old pattern
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own generated reports" ON generated_reports;
  DROP POLICY IF EXISTS "Users can manage own generated reports" ON generated_reports;

  CREATE POLICY "Tenant-scoped access to generated reports"
    ON generated_reports FOR ALL
    USING (check_tenant_access(tenant_id));
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- xero_contacts: migrate from old pattern
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own xero contacts" ON xero_contacts;
  DROP POLICY IF EXISTS "Users can manage own xero contacts" ON xero_contacts;

  CREATE POLICY "Tenant-scoped access to xero contacts"
    ON xero_contacts FOR ALL
    USING (check_tenant_access(tenant_id));
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
