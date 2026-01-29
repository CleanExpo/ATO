-- Migration: Recommendation Status Tracking
-- Created: 2026-01-27
-- Purpose: Track status of recommendations through review workflow

-- Create recommendation_status table
CREATE TABLE IF NOT EXISTS recommendation_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id TEXT NOT NULL, -- References recommendation ID from forensic_analysis_results
    share_id UUID REFERENCES shared_reports(id) ON DELETE SET NULL, -- Optional: if updated via share link
    tenant_id TEXT NOT NULL, -- For tenant-level access
    status TEXT NOT NULL CHECK (status IN (
        'pending_review',
        'under_review',
        'needs_verification',
        'needs_clarification',
        'approved',
        'rejected',
        'implemented'
    )),
    updated_by_name TEXT NOT NULL,
    updated_by_type TEXT NOT NULL CHECK (updated_by_type IN ('owner', 'accountant')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rec_status_recommendation ON recommendation_status(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_rec_status_tenant ON recommendation_status(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rec_status_share ON recommendation_status(share_id);
CREATE INDEX IF NOT EXISTS idx_rec_status_created ON recommendation_status(created_at DESC);

-- Create a view for current status (most recent per recommendation)
CREATE OR REPLACE VIEW recommendation_current_status AS
SELECT DISTINCT ON (recommendation_id)
    id,
    recommendation_id,
    share_id,
    tenant_id,
    status,
    updated_by_name,
    updated_by_type,
    notes,
    created_at
FROM recommendation_status
ORDER BY recommendation_id, created_at DESC;

-- Add RLS policies (if needed in future)
-- ALTER TABLE recommendation_status ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE recommendation_status IS 'Tracks status changes for recommendations through the review workflow';
COMMENT ON COLUMN recommendation_status.status IS 'Current status: pending_review, under_review, needs_verification, needs_clarification, approved, rejected, implemented';
COMMENT ON COLUMN recommendation_status.updated_by_type IS 'Who updated: owner or accountant';
