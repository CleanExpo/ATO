/**
 * Migration: Consolidated Report Log
 *
 * Creates table for tracking consolidated report generation by accountants.
 * Used for analytics, usage tracking, and performance monitoring.
 */

-- Create consolidated_report_log table
CREATE TABLE IF NOT EXISTS consolidated_report_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    accountant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    accountant_email TEXT,
    report_id TEXT NOT NULL,
    total_clients INTEGER NOT NULL DEFAULT 0,
    successful_reports INTEGER NOT NULL DEFAULT 0,
    failed_reports INTEGER NOT NULL DEFAULT 0,
    total_opportunity DECIMAL(15, 2) NOT NULL DEFAULT 0,
    processing_time_ms INTEGER NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_consolidated_report_log_accountant_id
    ON consolidated_report_log(accountant_id);

CREATE INDEX IF NOT EXISTS idx_consolidated_report_log_generated_at
    ON consolidated_report_log(generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_consolidated_report_log_report_id
    ON consolidated_report_log(report_id);

-- Enable Row Level Security
ALTER TABLE consolidated_report_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own consolidated report logs
CREATE POLICY "Users can view their own consolidated report logs"
    ON consolidated_report_log FOR SELECT
    USING (auth.uid() = accountant_id);

-- Policy: Admins can view all consolidated report logs
CREATE POLICY "Admins can view all consolidated report logs"
    ON consolidated_report_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
    );

-- Policy: Users can insert their own consolidated report logs
CREATE POLICY "Users can insert their own consolidated report logs"
    ON consolidated_report_log FOR INSERT
    WITH CHECK (auth.uid() = accountant_id);

-- Add comment for documentation
COMMENT ON TABLE consolidated_report_log IS
    'Tracks consolidated report generation for accountants managing multiple client organizations. Used for analytics and usage monitoring.';

COMMENT ON COLUMN consolidated_report_log.accountant_id IS
    'User ID of the accountant who generated the report';

COMMENT ON COLUMN consolidated_report_log.report_id IS
    'Unique identifier for the generated report (format: CONS-{timestamp}-{accountantId})';

COMMENT ON COLUMN consolidated_report_log.total_opportunity IS
    'Total adjusted tax opportunity across all clients in AUD';

COMMENT ON COLUMN consolidated_report_log.processing_time_ms IS
    'Time taken to generate the report in milliseconds';
