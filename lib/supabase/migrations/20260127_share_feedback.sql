-- Migration: Create share_feedback table for accountant feedback
-- Date: 27 January 2026
-- Phase: 09-accountant-collaboration (Plan 02)

-- Create share_feedback table
CREATE TABLE IF NOT EXISTS share_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL REFERENCES shared_reports(id) ON DELETE CASCADE,
    finding_id TEXT,                    -- Optional: links to specific finding
    author_name TEXT NOT NULL,
    author_email TEXT,
    message TEXT NOT NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('comment', 'question', 'approval', 'concern')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    reply_to UUID REFERENCES share_feedback(id) ON DELETE CASCADE
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_share_feedback_share_id ON share_feedback(share_id);
CREATE INDEX IF NOT EXISTS idx_share_feedback_finding_id ON share_feedback(share_id, finding_id);
CREATE INDEX IF NOT EXISTS idx_share_feedback_unread ON share_feedback(share_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_share_feedback_created ON share_feedback(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE share_feedback IS 'Stores feedback from accountants on shared reports';
COMMENT ON COLUMN share_feedback.finding_id IS 'Optional reference to a specific finding in the report';
COMMENT ON COLUMN share_feedback.feedback_type IS 'Type of feedback: comment, question, approval, or concern';
COMMENT ON COLUMN share_feedback.reply_to IS 'For threaded conversations, references parent feedback';

-- Row Level Security (RLS) policies
ALTER TABLE share_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert feedback (public access via share token)
CREATE POLICY share_feedback_public_insert ON share_feedback
    FOR INSERT
    WITH CHECK (true);

-- Policy: Anyone can read feedback for a share they have access to
CREATE POLICY share_feedback_public_read ON share_feedback
    FOR SELECT
    USING (true);

-- Policy: Only tenant owner can update (mark as read)
CREATE POLICY share_feedback_tenant_update ON share_feedback
    FOR UPDATE
    USING (
        share_id IN (
            SELECT id FROM shared_reports
            WHERE tenant_id = current_setting('app.current_tenant_id', true)
        )
    );
