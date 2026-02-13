-- Migration 021: Create Organization Groups Tables
-- Purpose: Support multi-organization analysis with linked entity groups
-- Date: 2026-01-30

-- ============================================================================
-- ORGANIZATION GROUPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organization_groups_name ON organization_groups(name);
CREATE INDEX IF NOT EXISTS idx_organization_groups_created_at ON organization_groups(created_at DESC);

-- ============================================================================
-- ORGANIZATION GROUP MEMBERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES organization_groups(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member', -- 'member', 'primary', etc.
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique membership (org can only be in group once)
    UNIQUE(group_id, organization_id)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_org_group_members_group_id ON organization_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_org_group_members_org_id ON organization_group_members(organization_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE organization_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_group_members ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for single-user mode and admin operations)
CREATE POLICY "Service role can manage organization groups"
    ON organization_groups
    FOR ALL
    USING (auth.uid() IS NULL)
    WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Service role can manage group members"
    ON organization_group_members
    FOR ALL
    USING (auth.uid() IS NULL)
    WITH CHECK (auth.uid() IS NULL);

-- Users can view groups they have access to (via their organizations)
CREATE POLICY "Users can view their organization groups"
    ON organization_groups
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_group_members ogm
            INNER JOIN user_tenant_access uta ON uta.organization_id = ogm.organization_id
            WHERE ogm.group_id = organization_groups.id
            AND uta.user_id = auth.uid()
        )
    );

-- Users can view group memberships for their organizations
CREATE POLICY "Users can view group memberships"
    ON organization_group_members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_tenant_access uta
            WHERE uta.organization_id = organization_group_members.organization_id
            AND uta.user_id = auth.uid()
        )
    );

-- Owners can create groups and add members
CREATE POLICY "Owners can create groups and add members"
    ON organization_groups
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_tenant_access uta
            WHERE uta.user_id = auth.uid()
            AND uta.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Owners can add organizations to groups"
    ON organization_group_members
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_tenant_access uta
            WHERE uta.organization_id = organization_group_members.organization_id
            AND uta.user_id = auth.uid()
            AND uta.role IN ('owner', 'admin')
        )
    );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE organization_groups IS 'Groups of related organizations for consolidated analysis';
COMMENT ON TABLE organization_group_members IS 'Links organizations to groups';
COMMENT ON COLUMN organization_groups.settings IS 'JSON settings: pricing_tier, base_price, per_org_price, etc.';
COMMENT ON COLUMN organization_group_members.role IS 'member, primary - indicates role within group';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 021 completed successfully';
    RAISE NOTICE 'Created tables: organization_groups, organization_group_members';
    RAISE NOTICE 'RLS policies enabled for both tables';
END $$;
