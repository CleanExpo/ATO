-- =====================================================================
-- Migration: 20260129000002_create_notifications
-- Description: Create notifications system for team collaboration
-- Date: 2026-01-29
-- =====================================================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Notification content
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,

    -- Related entities (for linking to specific items)
    related_entity_type TEXT, -- 'member', 'invitation', 'analysis', 'recommendation', 'sync'
    related_entity_id UUID,
    action_url TEXT, -- URL to navigate to when clicking notification

    -- Status tracking
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,

    -- Metadata for additional context
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
    ON notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- RLS Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
    ON notifications
    FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
    ON notifications
    FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policy: Service role can insert notifications
CREATE POLICY "Service role can insert notifications"
    ON notifications
    FOR INSERT
    WITH CHECK (TRUE);

-- Comment on table
COMMENT ON TABLE notifications IS 'User notifications for organization activities and events';
COMMENT ON COLUMN notifications.type IS 'Notification type: invitation_received, member_joined, analysis_complete, sync_failed, etc.';
COMMENT ON COLUMN notifications.related_entity_type IS 'Type of related entity: member, invitation, analysis, recommendation, sync';
COMMENT ON COLUMN notifications.action_url IS 'URL to navigate to when notification is clicked';

-- =====================================================================
-- Helper Functions
-- =====================================================================

-- Function to create notification for user
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
        user_id,
        organization_id,
        type,
        title,
        message,
        related_entity_type,
        related_entity_id,
        action_url,
        metadata
    ) VALUES (
        p_user_id,
        p_organization_id,
        p_type,
        p_title,
        p_message,
        p_related_entity_type,
        p_related_entity_id,
        p_action_url,
        p_metadata
    ) RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count for user
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM notifications
    WHERE user_id = p_user_id
    AND read = FALSE;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE notifications
    SET read = TRUE,
        read_at = NOW()
    WHERE user_id = p_user_id
    AND read = FALSE;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- Notification Triggers
-- =====================================================================

-- Trigger function to create notification when member joins organization
CREATE OR REPLACE FUNCTION notify_member_joined()
RETURNS TRIGGER AS $$
DECLARE
    v_org_name TEXT;
    v_new_member_email TEXT;
    v_admin_user_id UUID;
BEGIN
    -- Get organization name
    SELECT name INTO v_org_name
    FROM organizations
    WHERE id = NEW.organization_id;

    -- Get new member email
    SELECT email INTO v_new_member_email
    FROM auth.users
    WHERE id = NEW.user_id;

    -- Notify all admins and owners in the organization
    FOR v_admin_user_id IN
        SELECT user_id
        FROM user_tenant_access
        WHERE organization_id = NEW.organization_id
        AND role IN ('owner', 'admin')
        AND user_id != NEW.user_id -- Don't notify the new member themselves
    LOOP
        PERFORM create_notification(
            v_admin_user_id,
            NEW.organization_id,
            'member_joined',
            'New Team Member',
            v_new_member_email || ' joined ' || v_org_name,
            'member',
            NEW.user_id,
            '/dashboard/organization/members'
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for member joined notifications
DROP TRIGGER IF EXISTS trigger_notify_member_joined ON user_tenant_access;
CREATE TRIGGER trigger_notify_member_joined
    AFTER INSERT ON user_tenant_access
    FOR EACH ROW
    EXECUTE FUNCTION notify_member_joined();

-- Trigger function to create notification when invitation is accepted
CREATE OR REPLACE FUNCTION notify_invitation_accepted()
RETURNS TRIGGER AS $$
DECLARE
    v_org_name TEXT;
    v_inviter_id UUID;
BEGIN
    -- Only trigger when status changes to accepted
    IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
        -- Get organization name
        SELECT name INTO v_org_name
        FROM organizations
        WHERE id = NEW.organization_id;

        -- Get inviter ID
        v_inviter_id := NEW.invited_by;

        -- Notify the inviter
        IF v_inviter_id IS NOT NULL THEN
            PERFORM create_notification(
                v_inviter_id,
                NEW.organization_id,
                'invitation_accepted',
                'Invitation Accepted',
                NEW.email || ' accepted your invitation to ' || v_org_name,
                'invitation',
                NEW.id,
                '/dashboard/organization/members'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invitation accepted notifications
DROP TRIGGER IF EXISTS trigger_notify_invitation_accepted ON organization_invitations;
CREATE TRIGGER trigger_notify_invitation_accepted
    AFTER UPDATE ON organization_invitations
    FOR EACH ROW
    EXECUTE FUNCTION notify_invitation_accepted();

-- =====================================================================
-- End of Migration
-- =====================================================================
