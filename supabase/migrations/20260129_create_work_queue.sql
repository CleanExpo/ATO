-- =====================================================
-- Work Queue System for Idea Intake Workflow
-- =====================================================
-- Created: 2026-01-29
-- Purpose: Store and manage queued ideas/tasks from capture to execution
-- Pattern: Follows Matt Maher's "do-work" autonomous queue processing pattern
-- Integration: Linear project management + ATO agent routing
--
-- Flow: pending → validating → validated → processing → complete/failed → archived
-- =====================================================

-- Drop table if exists (for development - remove in production)
DROP TABLE IF EXISTS work_queue CASCADE;

-- Create work_queue table
CREATE TABLE work_queue (
    -- Primary key and timestamps
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Queue status tracking
    -- Lifecycle: pending → validating → validated → processing → complete/failed → archived
    status TEXT NOT NULL CHECK (status IN (
        'pending',      -- Initial capture, awaiting PM validation
        'validating',   -- Senior PM is validating
        'validated',    -- Passed validation, ready for execution
        'processing',   -- Currently being executed by work loop
        'complete',     -- Successfully executed
        'failed',       -- Execution failed
        'archived'      -- Completed and archived
    )) DEFAULT 'pending',

    -- Idea/request metadata
    queue_item_type TEXT NOT NULL CHECK (queue_item_type IN (
        'feature',          -- New feature request
        'bug',              -- Bug report or issue
        'improvement',      -- Enhancement to existing feature
        'client_request',   -- Request from client/stakeholder
        'task'              -- General task
    )),
    title TEXT NOT NULL CHECK (length(title) <= 200),
    description TEXT NOT NULL,

    -- Full payload (preserves all user context)
    -- JSON structure: {user_input, context, original_message, etc.}
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- PM validation results
    -- JSON structure from Senior PM Enhanced agent
    validation_result JSONB,
    complexity TEXT CHECK (complexity IN ('simple', 'medium', 'complex')),
    priority TEXT CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
    assigned_agent TEXT,  -- Name of domain agent (e.g., 'rnd-tax-specialist')

    -- Linear integration
    linear_issue_id TEXT,       -- Linear issue ID (e.g., 'abc123')
    linear_issue_identifier TEXT,  -- Linear identifier (e.g., 'UNI-123')
    linear_issue_url TEXT,      -- Full Linear issue URL

    -- Execution tracking
    processed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    error_message TEXT,
    error_count INTEGER NOT NULL DEFAULT 0,

    -- Execution metadata
    screenshots TEXT[],          -- Array of screenshot file paths
    execution_log TEXT,          -- Detailed execution log
    token_usage INTEGER,         -- Estimated PTS/tokens used
    execution_time_seconds INTEGER  -- Time taken to execute
);

-- =====================================================
-- Indexes for performance
-- =====================================================

-- Primary query patterns: filter by status, sort by priority and creation time
CREATE INDEX idx_work_queue_status ON work_queue(status);
CREATE INDEX idx_work_queue_created_at ON work_queue(created_at DESC);
CREATE INDEX idx_work_queue_priority ON work_queue(priority) WHERE priority IS NOT NULL;
CREATE INDEX idx_work_queue_assigned_agent ON work_queue(assigned_agent) WHERE assigned_agent IS NOT NULL;

-- For duplicate detection and Linear synchronization
CREATE INDEX idx_work_queue_linear_issue_id ON work_queue(linear_issue_id) WHERE linear_issue_id IS NOT NULL;
CREATE INDEX idx_work_queue_type ON work_queue(queue_item_type);

-- Composite index for work loop processing (most common query)
-- Get next validated item by priority and creation time
CREATE INDEX idx_work_queue_processing ON work_queue(status, priority, created_at)
WHERE status = 'validated';

-- GIN index for JSON search in payload and validation_result
CREATE INDEX idx_work_queue_payload_gin ON work_queue USING GIN (payload);
CREATE INDEX idx_work_queue_validation_gin ON work_queue USING GIN (validation_result);

-- =====================================================
-- Automatic timestamp updates
-- =====================================================

CREATE OR REPLACE FUNCTION update_work_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_queue_updated_at_trigger
    BEFORE UPDATE ON work_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_work_queue_updated_at();

-- =====================================================
-- Row-Level Security (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE work_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "Service role has full access to work_queue"
ON work_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Authenticated users can read all queue items
CREATE POLICY "Authenticated users can read work_queue"
ON work_queue
FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can insert queue items (capture)
CREATE POLICY "Authenticated users can insert work_queue"
ON work_queue
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Only service role can update queue items (validation/processing)
CREATE POLICY "Service role can update work_queue"
ON work_queue
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- Helper Functions
-- =====================================================

-- Get next pending item for validation
CREATE OR REPLACE FUNCTION get_next_pending_queue_item()
RETURNS UUID AS $$
DECLARE
    next_id UUID;
BEGIN
    SELECT id INTO next_id
    FROM work_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    RETURN next_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get next validated item for execution
CREATE OR REPLACE FUNCTION get_next_validated_queue_item()
RETURNS UUID AS $$
DECLARE
    next_id UUID;
BEGIN
    SELECT id INTO next_id
    FROM work_queue
    WHERE status = 'validated'
    ORDER BY
        CASE priority
            WHEN 'P0' THEN 1
            WHEN 'P1' THEN 2
            WHEN 'P2' THEN 3
            WHEN 'P3' THEN 4
            ELSE 5
        END,
        created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    RETURN next_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get queue statistics
CREATE OR REPLACE FUNCTION get_queue_statistics()
RETURNS TABLE (
    total_items BIGINT,
    pending_count BIGINT,
    validating_count BIGINT,
    validated_count BIGINT,
    processing_count BIGINT,
    complete_count BIGINT,
    failed_count BIGINT,
    archived_count BIGINT,
    avg_execution_time_seconds NUMERIC,
    total_token_usage BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'validating') as validating_count,
        COUNT(*) FILTER (WHERE status = 'validated') as validated_count,
        COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
        COUNT(*) FILTER (WHERE status = 'complete') as complete_count,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
        COUNT(*) FILTER (WHERE status = 'archived') as archived_count,
        AVG(execution_time_seconds)::NUMERIC as avg_execution_time_seconds,
        SUM(token_usage)::BIGINT as total_token_usage
    FROM work_queue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE work_queue IS 'Queue system for autonomous idea intake workflow';
COMMENT ON COLUMN work_queue.status IS 'Lifecycle: pending → validating → validated → processing → complete/failed → archived';
COMMENT ON COLUMN work_queue.payload IS 'Full user context preserved from capture (JSON)';
COMMENT ON COLUMN work_queue.validation_result IS 'Senior PM validation output (JSON)';
COMMENT ON COLUMN work_queue.assigned_agent IS 'Domain agent for execution (e.g., rnd-tax-specialist)';
COMMENT ON COLUMN work_queue.linear_issue_id IS 'Linear issue ID from Linear API';
COMMENT ON COLUMN work_queue.linear_issue_identifier IS 'Human-readable Linear identifier (e.g., UNI-123)';
COMMENT ON COLUMN work_queue.screenshots IS 'Array of screenshot file paths for audit trail';
COMMENT ON COLUMN work_queue.execution_log IS 'Detailed execution log from work loop';
COMMENT ON COLUMN work_queue.token_usage IS 'Estimated PTS/tokens consumed during execution';

-- =====================================================
-- Grant permissions
-- =====================================================

GRANT ALL ON work_queue TO service_role;
GRANT SELECT, INSERT ON work_queue TO authenticated;

-- =====================================================
-- Success message
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'Work queue system created successfully!';
    RAISE NOTICE 'Tables: work_queue';
    RAISE NOTICE 'Functions: get_next_pending_queue_item, get_next_validated_queue_item, get_queue_statistics';
    RAISE NOTICE 'Indexes: 8 indexes for performance optimization';
END $$;
