-- Migration: Add user_tenant_access table for multi-user support
-- Created: 2026-01-23
-- Purpose: Enable tenant isolation and multi-user authentication

-- =============================================================================
-- User-Tenant Access Control
-- =============================================================================

-- Create the user_tenant_access table
CREATE TABLE IF NOT EXISTS user_tenant_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique user-tenant combinations
    CONSTRAINT unique_user_tenant UNIQUE (user_id, tenant_id)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_tenant_access_user_id
    ON user_tenant_access(user_id);

CREATE INDEX IF NOT EXISTS idx_user_tenant_access_tenant_id
    ON user_tenant_access(tenant_id);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

-- Enable RLS
ALTER TABLE user_tenant_access ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own access records
CREATE POLICY "Users can view own tenant access"
    ON user_tenant_access
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own access records (for OAuth callback)
CREATE POLICY "Users can create own tenant access"
    ON user_tenant_access
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Owners can manage access for their tenants
CREATE POLICY "Owners can manage tenant access"
    ON user_tenant_access
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_tenant_access uta
            WHERE uta.tenant_id = user_tenant_access.tenant_id
            AND uta.user_id = auth.uid()
            AND uta.role = 'owner'
        )
    );

-- =============================================================================
-- Automatic Updated Timestamp
-- =============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_tenant_access_updated_at
    BEFORE UPDATE ON user_tenant_access
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Xero Connections Table Updates
-- =============================================================================

-- Add encrypted token columns if they don't exist
DO $$
BEGIN
    -- Add access_token_encrypted if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'xero_connections'
        AND column_name = 'access_token_encrypted'
    ) THEN
        ALTER TABLE xero_connections
        ADD COLUMN access_token_encrypted TEXT;
    END IF;

    -- Add refresh_token_encrypted if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'xero_connections'
        AND column_name = 'refresh_token_encrypted'
    ) THEN
        ALTER TABLE xero_connections
        ADD COLUMN refresh_token_encrypted TEXT;
    END IF;
END $$;

-- =============================================================================
-- Comments for Documentation
-- =============================================================================

COMMENT ON TABLE user_tenant_access IS
    'Maps users to Xero tenants they can access, with role-based permissions';

COMMENT ON COLUMN user_tenant_access.role IS
    'User role: owner (full control), admin (read/write), viewer (read only)';

COMMENT ON COLUMN user_tenant_access.tenant_id IS
    'Xero tenant ID (organisation ID)';

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to check if user has access to tenant
CREATE OR REPLACE FUNCTION has_tenant_access(
    p_user_id UUID,
    p_tenant_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_tenant_access
        WHERE user_id = p_user_id
        AND tenant_id = p_tenant_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's role for a tenant
CREATE OR REPLACE FUNCTION get_tenant_role(
    p_user_id UUID,
    p_tenant_id TEXT
) RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM user_tenant_access
    WHERE user_id = p_user_id
    AND tenant_id = p_tenant_id;

    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Grant Permissions
-- =============================================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON user_tenant_access TO authenticated;

-- Grant usage on functions
GRANT EXECUTE ON FUNCTION has_tenant_access TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_role TO authenticated;
