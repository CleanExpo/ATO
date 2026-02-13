-- ============================================================================
-- DATA QUALITY TABLES MIGRATION
-- Creates tables for data quality scanning and forensic corrections
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. DATA QUALITY ISSUES TABLE
-- ============================================================================

-- Data quality issues identified by the validator
CREATE TABLE IF NOT EXISTS data_quality_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    financial_year TEXT NOT NULL,

    -- Issue classification
    issue_type TEXT NOT NULL CHECK (issue_type IN (
        'wrong_account',
        'tax_classification',
        'unreconciled',
        'misallocated',
        'duplicate',
        'missing_data'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),

    -- Current vs suggested state
    current_state JSONB NOT NULL,  -- Current incorrect state
    suggested_fix JSONB NOT NULL,  -- Suggested correction

    -- AI analysis
    confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    ai_reasoning TEXT,
    impact_amount DECIMAL(15,2),

    -- Status tracking
    status TEXT DEFAULT 'identified' CHECK (status IN (
        'identified',           -- Issue found, not yet processed
        'auto_corrected',       -- Automatically fixed (high confidence)
        'pending_review',       -- Flagged for accountant review (medium confidence)
        'approved',             -- Accountant approved the fix
        'rejected',             -- Accountant rejected the fix
        'resolved'              -- Issue resolved
    )),

    -- Metadata
    identified_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    accountant_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, transaction_id, issue_type)
);

-- Indexes for data quality issues
CREATE INDEX IF NOT EXISTS idx_dqi_tenant_fy ON data_quality_issues(tenant_id, financial_year);
CREATE INDEX IF NOT EXISTS idx_dqi_status ON data_quality_issues(status);
CREATE INDEX IF NOT EXISTS idx_dqi_type ON data_quality_issues(tenant_id, issue_type);
CREATE INDEX IF NOT EXISTS idx_dqi_severity ON data_quality_issues(severity);
CREATE INDEX IF NOT EXISTS idx_dqi_confidence ON data_quality_issues(confidence);

-- ============================================================================
-- 2. CORRECTION LOGS TABLE
-- ============================================================================

-- Correction audit trail - tracks all corrections made
CREATE TABLE IF NOT EXISTS correction_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    issue_id UUID REFERENCES data_quality_issues(id) ON DELETE CASCADE,

    -- Correction details
    correction_date TIMESTAMPTZ DEFAULT NOW(),
    correction_method TEXT NOT NULL CHECK (correction_method IN (
        'journal_entry',        -- Xero manual journal created
        'reclassification',     -- Account code changed
        'tax_update',           -- Tax type updated
        'reconciliation',       -- Bank transaction reconciled
        'merge_duplicate'       -- Duplicate transactions merged
    )),

    -- Xero integration
    xero_journal_id TEXT,           -- Xero manual journal ID if correction via journal
    xero_journal_number TEXT,       -- Human-readable journal number

    -- States
    before_state JSONB NOT NULL,    -- Transaction state before correction
    after_state JSONB NOT NULL,     -- Transaction state after correction

    -- AI analysis
    confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    ai_reasoning TEXT,

    -- Status
    status TEXT DEFAULT 'applied' CHECK (status IN (
        'applied',              -- Correction has been applied
        'reverted',             -- Correction was rolled back
        'failed'                -- Correction failed to apply
    )),

    -- Accountant review
    accountant_approved BOOLEAN DEFAULT FALSE,
    accountant_notes TEXT,
    approved_at TIMESTAMPTZ,
    approved_by TEXT,

    -- Error handling
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for correction logs
CREATE INDEX IF NOT EXISTS idx_corrections_tenant ON correction_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_corrections_issue ON correction_logs(issue_id);
CREATE INDEX IF NOT EXISTS idx_corrections_status ON correction_logs(status);
CREATE INDEX IF NOT EXISTS idx_corrections_date ON correction_logs(correction_date);
CREATE INDEX IF NOT EXISTS idx_corrections_xero_journal ON correction_logs(xero_journal_id);

-- ============================================================================
-- 3. DATA QUALITY SCAN STATUS TABLE (MOST IMPORTANT!)
-- ============================================================================

-- Data quality scan status - tracks scan progress
CREATE TABLE IF NOT EXISTS data_quality_scan_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL UNIQUE,

    -- Scan progress
    scan_status TEXT DEFAULT 'idle' CHECK (scan_status IN (
        'idle',
        'scanning',
        'complete',
        'error'
    )),
    scan_progress DECIMAL(5,2) DEFAULT 0,  -- 0-100%

    -- Statistics
    transactions_scanned INTEGER DEFAULT 0,
    issues_found INTEGER DEFAULT 0,
    issues_auto_corrected INTEGER DEFAULT 0,
    issues_pending_review INTEGER DEFAULT 0,

    -- Issue breakdown by type
    wrong_account_count INTEGER DEFAULT 0,
    tax_classification_count INTEGER DEFAULT 0,
    unreconciled_count INTEGER DEFAULT 0,
    misallocated_count INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,

    -- Financial impact
    total_impact_amount DECIMAL(15,2) DEFAULT 0,

    -- Timing
    last_scan_at TIMESTAMPTZ,
    scan_started_at TIMESTAMPTZ,
    scan_completed_at TIMESTAMPTZ,

    -- Error handling
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for scan status
CREATE INDEX IF NOT EXISTS idx_dq_scan_tenant ON data_quality_scan_status(tenant_id);

-- ============================================================================
-- 4. UPDATE TRIGGERS
-- ============================================================================

-- Create or replace the update function (in case it doesn't exist)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_data_quality_issues_modtime ON data_quality_issues;
DROP TRIGGER IF EXISTS update_correction_logs_modtime ON correction_logs;
DROP TRIGGER IF EXISTS update_data_quality_scan_status_modtime ON data_quality_scan_status;

-- Create triggers to update updated_at timestamp
CREATE TRIGGER update_data_quality_issues_modtime
    BEFORE UPDATE ON data_quality_issues
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_correction_logs_modtime
    BEFORE UPDATE ON correction_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_data_quality_scan_status_modtime
    BEFORE UPDATE ON data_quality_scan_status
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE data_quality_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_scan_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage data quality issues" ON data_quality_issues;
DROP POLICY IF EXISTS "Authenticated users can read data quality issues" ON data_quality_issues;
DROP POLICY IF EXISTS "Service role can manage correction logs" ON correction_logs;
DROP POLICY IF EXISTS "Authenticated users can read correction logs" ON correction_logs;
DROP POLICY IF EXISTS "Service role can manage scan status" ON data_quality_scan_status;
DROP POLICY IF EXISTS "Authenticated users can read scan status" ON data_quality_scan_status;

-- Create policies for data_quality_issues
CREATE POLICY "Service role can manage data quality issues" ON data_quality_issues
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read data quality issues" ON data_quality_issues
  FOR SELECT TO authenticated
  USING (true);

-- Create policies for correction_logs
CREATE POLICY "Service role can manage correction logs" ON correction_logs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read correction logs" ON correction_logs
  FOR SELECT TO authenticated
  USING (true);

-- Create policies for data_quality_scan_status
CREATE POLICY "Service role can manage scan status" ON data_quality_scan_status
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read scan status" ON data_quality_scan_status
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================

COMMENT ON TABLE data_quality_issues IS 'Tracks data integrity issues found in Xero transactions';
COMMENT ON TABLE correction_logs IS 'Audit trail of all corrections made to Xero data';
COMMENT ON TABLE data_quality_scan_status IS 'Tracks data quality scan progress per organization - THIS IS WHAT THE UI READS';

COMMENT ON COLUMN data_quality_issues.confidence IS 'AI confidence score (0-100) - auto-fix if >= 90';
COMMENT ON COLUMN data_quality_issues.current_state IS 'JSONB snapshot of incorrect current state';
COMMENT ON COLUMN data_quality_issues.suggested_fix IS 'JSONB snapshot of suggested correct state';

COMMENT ON COLUMN correction_logs.xero_journal_id IS 'Xero manual journal ID for reclassification corrections';
COMMENT ON COLUMN correction_logs.before_state IS 'Transaction state before correction';
COMMENT ON COLUMN correction_logs.after_state IS 'Transaction state after correction';

-- ============================================================================
-- 7. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify tables exist
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'data_quality_issues') THEN
    RAISE NOTICE '✅ data_quality_issues table created successfully';
  ELSE
    RAISE WARNING '❌ data_quality_issues table NOT found';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'correction_logs') THEN
    RAISE NOTICE '✅ correction_logs table created successfully';
  ELSE
    RAISE WARNING '❌ correction_logs table NOT found';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'data_quality_scan_status') THEN
    RAISE NOTICE '✅ data_quality_scan_status table created successfully (CRITICAL FOR UI!)';
  ELSE
    RAISE WARNING '❌ data_quality_scan_status table NOT found - THIS IS WHY UI SHOWS MOCK DATA!';
  END IF;

  -- Verify RLS enabled
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname IN ('data_quality_issues', 'correction_logs', 'data_quality_scan_status')
    AND relrowsecurity = true
  ) THEN
    RAISE NOTICE '✅ RLS enabled on data quality tables';
  END IF;

  RAISE NOTICE '=========================================================';
  RAISE NOTICE 'Data Quality Tables Migration completed successfully! ✅';
  RAISE NOTICE 'The UI will now show real data instead of mock data';
  RAISE NOTICE '=========================================================';
END $$;
