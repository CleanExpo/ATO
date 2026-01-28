-- Create generated_reports table for tracking PDF/Excel report generation
-- This table stores metadata for all generated reports including download URLs

CREATE TABLE IF NOT EXISTS generated_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id TEXT NOT NULL UNIQUE,
  tenant_id UUID NOT NULL,
  organization_name TEXT NOT NULL,
  abn TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('pdf', 'excel', 'both')),
  client_friendly BOOLEAN DEFAULT false,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pdf_path TEXT,
  excel_path TEXT,
  email_sent_to TEXT,
  email_sent_at TIMESTAMPTZ,
  download_count INT DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_generated_reports_tenant_id ON generated_reports(tenant_id);
CREATE INDEX idx_generated_reports_report_id ON generated_reports(report_id);
CREATE INDEX idx_generated_reports_generated_at ON generated_reports(generated_at DESC);

-- RLS policies
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to generated_reports"
  ON generated_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow users to view their own tenant's reports
CREATE POLICY "Users can view their tenant's reports"
  ON generated_reports
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM xero_connections WHERE user_id = auth.uid()
    )
  );

-- Function to update download tracking
CREATE OR REPLACE FUNCTION track_report_download(p_report_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE generated_reports
  SET
    download_count = download_count + 1,
    last_downloaded_at = NOW(),
    updated_at = NOW()
  WHERE report_id = p_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on table
COMMENT ON TABLE generated_reports IS 'Tracks all PDF and Excel reports generated for forensic tax audits';
COMMENT ON COLUMN generated_reports.report_id IS 'Unique report identifier in format REP-{timestamp}-{tenant}';
COMMENT ON COLUMN generated_reports.report_type IS 'Type of report: pdf, excel, or both';
COMMENT ON COLUMN generated_reports.client_friendly IS 'Whether this is a simplified client-facing report';
COMMENT ON COLUMN generated_reports.pdf_path IS 'Supabase Storage path for PDF file';
COMMENT ON COLUMN generated_reports.excel_path IS 'Supabase Storage path for Excel file';
