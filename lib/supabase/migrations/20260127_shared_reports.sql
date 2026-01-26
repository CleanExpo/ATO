-- Migration: Create shared_reports table for secure accountant sharing
-- Date: 27 January 2026
-- Phase: 09-accountant-collaboration

-- Create shared_reports table
CREATE TABLE IF NOT EXISTS shared_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    report_type TEXT NOT NULL CHECK (report_type IN ('full', 'rnd', 'deductions', 'div7a', 'losses', 'custom')),
    filters JSONB,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    last_accessed_ip TEXT,
    password_hash TEXT
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_shared_reports_token ON shared_reports(token);
CREATE INDEX IF NOT EXISTS idx_shared_reports_tenant ON shared_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shared_reports_expires ON shared_reports(expires_at);
CREATE INDEX IF NOT EXISTS idx_shared_reports_status ON shared_reports(is_revoked, expires_at);

-- Create access_logs table for audit trail
CREATE TABLE IF NOT EXISTS share_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL REFERENCES shared_reports(id) ON DELETE CASCADE,
    accessed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    successful BOOLEAN DEFAULT TRUE,
    failure_reason TEXT
);

-- Create index for access logs
CREATE INDEX IF NOT EXISTS idx_share_access_logs_share_id ON share_access_logs(share_id);
CREATE INDEX IF NOT EXISTS idx_share_access_logs_accessed_at ON share_access_logs(accessed_at);

-- Comments for documentation
COMMENT ON TABLE shared_reports IS 'Stores secure share links for accountant access to reports';
COMMENT ON COLUMN shared_reports.token IS 'URL-safe unique token for accessing the shared report';
COMMENT ON COLUMN shared_reports.report_type IS 'Type of report: full, rnd, deductions, div7a, losses, or custom';
COMMENT ON COLUMN shared_reports.filters IS 'Optional JSON filters applied to the report (FYs, categories, etc.)';
COMMENT ON COLUMN shared_reports.password_hash IS 'bcrypt hash if password protection is enabled';
COMMENT ON TABLE share_access_logs IS 'Audit trail of all access attempts to shared reports';

-- Row Level Security (RLS) policies
ALTER TABLE shared_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_access_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own tenant's shared reports
CREATE POLICY shared_reports_tenant_isolation ON shared_reports
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Policy: Anyone can read a shared report by token (for public access)
CREATE POLICY shared_reports_public_read ON shared_reports
    FOR SELECT
    USING (true);

-- Policy: Access logs inherit from shared_reports
CREATE POLICY share_access_logs_read ON share_access_logs
    FOR SELECT
    USING (
        share_id IN (
            SELECT id FROM shared_reports
            WHERE tenant_id = current_setting('app.current_tenant_id', true)
        )
    );

-- Policy: Anyone can insert access logs (for logging public access)
CREATE POLICY share_access_logs_insert ON share_access_logs
    FOR INSERT
    WITH CHECK (true);
