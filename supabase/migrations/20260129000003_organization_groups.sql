/**
 * Organization Groups (Client Groups)
 *
 * Allows linking multiple organizations together as a single client for:
 * - Consolidated pricing ($199 per additional org in same group)
 * - Consolidated analysis (cross-entity fund movements, inter-company transactions)
 * - Consolidated reporting (one report covering all linked entities)
 *
 * Business Logic:
 * - Linked orgs: $995 + $199 per additional = Consolidated analysis
 * - Separate orgs: $995 each = Separate reports
 */

-- Create organization_groups table
CREATE TABLE IF NOT EXISTS organization_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Group details
    name TEXT NOT NULL,
    description TEXT,

    -- Ownership
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Consolidated analysis settings
    enable_consolidated_analysis BOOLEAN DEFAULT TRUE,
    enable_intercompany_tracking BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add group_id to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES organization_groups(id) ON DELETE SET NULL;

-- Add is_primary flag to mark the primary/first organization in a group
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS is_primary_in_group BOOLEAN DEFAULT FALSE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_organization_groups_owner_id ON organization_groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_group_id ON organizations(group_id);
CREATE INDEX IF NOT EXISTS idx_organizations_group_primary ON organizations(group_id, is_primary_in_group) WHERE is_primary_in_group = TRUE;

-- RLS Policies for organization_groups
ALTER TABLE organization_groups ENABLE ROW LEVEL SECURITY;

-- Users can view groups they own
CREATE POLICY "Users can view their organization groups"
    ON organization_groups FOR SELECT
    USING (owner_id = auth.uid());

-- Users can create groups
CREATE POLICY "Users can create organization groups"
    ON organization_groups FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- Users can update their groups
CREATE POLICY "Users can update their organization groups"
    ON organization_groups FOR UPDATE
    USING (owner_id = auth.uid());

-- Users can delete their groups
CREATE POLICY "Users can delete their organization groups"
    ON organization_groups FOR DELETE
    USING (owner_id = auth.uid());

-- Create function to get organization count in a group
CREATE OR REPLACE FUNCTION get_organization_count_in_group(group_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(*)::INTEGER
    FROM organizations
    WHERE group_id = group_uuid;
$$;

-- Create function to get primary organization in a group
CREATE OR REPLACE FUNCTION get_primary_organization_in_group(group_uuid UUID)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT id
    FROM organizations
    WHERE group_id = group_uuid
    AND is_primary_in_group = TRUE
    LIMIT 1;
$$;

-- Create function to automatically set first org in group as primary
CREATE OR REPLACE FUNCTION set_first_org_as_primary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If this is the first org in the group, mark it as primary
    IF NEW.group_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM organizations
            WHERE group_id = NEW.group_id
            AND is_primary_in_group = TRUE
            AND id != NEW.id
        ) THEN
            NEW.is_primary_in_group := TRUE;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_set_first_org_as_primary ON organizations;
CREATE TRIGGER trg_set_first_org_as_primary
    BEFORE INSERT OR UPDATE OF group_id ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION set_first_org_as_primary();

-- Add comments
COMMENT ON TABLE organization_groups IS 'Groups of related organizations for consolidated analysis and pricing';
COMMENT ON COLUMN organization_groups.enable_consolidated_analysis IS 'Enable cross-entity analysis for this group';
COMMENT ON COLUMN organization_groups.enable_intercompany_tracking IS 'Track inter-company transactions and loans';
COMMENT ON COLUMN organizations.group_id IS 'Links organization to a group for consolidated analysis and $199 additional pricing';
COMMENT ON COLUMN organizations.is_primary_in_group IS 'Marks the primary/first organization in a group (base $995 pricing applies)';
