-- =====================================================================
-- Migration: 005_create_admin_audit_log
-- Description: Create audit logging table for admin actions
-- Date: 2026-01-29
-- =====================================================================

-- Create admin_audit_log table for security monitoring
CREATE TABLE IF NOT EXISTS admin_audit_log (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Action details
    action TEXT NOT NULL,
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    actor_email TEXT,

    -- Target resource (what was affected)
    target_id TEXT, -- Can be UUID or other identifier
    target_type TEXT, -- Type of resource (user, accountant_application, etc.)

    -- Additional context
    details JSONB DEFAULT '{}'::jsonb,

    -- Request metadata
    ip_address TEXT,
    user_agent TEXT,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_id ON admin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_id ON admin_audit_log(target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_type ON admin_audit_log(target_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);

-- Create composite index for common query pattern (actor + date range)
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_created ON admin_audit_log(actor_id, created_at DESC);

-- Create composite index for target queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_created ON admin_audit_log(target_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
    ON admin_audit_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
    );

-- RLS Policy: Service role can insert audit logs (for system operations)
CREATE POLICY "Service role can insert audit logs"
    ON admin_audit_log
    FOR INSERT
    WITH CHECK (TRUE);

-- RLS Policy: No updates or deletes allowed (immutable audit trail)
-- Audit logs should never be modified or deleted
-- If a log entry is wrong, create a correction entry instead

-- Comment on table
COMMENT ON TABLE admin_audit_log IS 'Immutable audit trail of all admin actions for security monitoring and compliance';

-- Comment on columns
COMMENT ON COLUMN admin_audit_log.action IS 'Type of admin action performed (e.g., accountant_application_approved)';
COMMENT ON COLUMN admin_audit_log.actor_id IS 'Admin user who performed the action (references auth.users)';
COMMENT ON COLUMN admin_audit_log.actor_email IS 'Email of admin user at time of action';
COMMENT ON COLUMN admin_audit_log.target_id IS 'ID of affected resource (user, application, purchase, etc.)';
COMMENT ON COLUMN admin_audit_log.target_type IS 'Type of affected resource (user, accountant_application, purchase, etc.)';
COMMENT ON COLUMN admin_audit_log.details IS 'Additional context about the action (JSON)';
COMMENT ON COLUMN admin_audit_log.ip_address IS 'IP address of admin at time of action';
COMMENT ON COLUMN admin_audit_log.user_agent IS 'Browser user agent string';
COMMENT ON COLUMN admin_audit_log.created_at IS 'Timestamp when action was performed (immutable)';
