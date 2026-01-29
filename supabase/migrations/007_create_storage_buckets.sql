/**
 * Migration: Create Storage Buckets and Policies
 *
 * Sets up Supabase Storage buckets for:
 * 1. PDF/Excel reports (reports bucket)
 * 2. Recommendation documents (recommendation-documents bucket)
 *
 * Includes Row Level Security policies for secure access control.
 */

-- =============================================================================
-- REPORTS BUCKET
-- =============================================================================

-- Create reports bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false, -- Private bucket, requires authentication
  52428800, -- 50 MB limit
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for reports bucket

-- Policy: Service role has full access
CREATE POLICY IF NOT EXISTS "Service role has full access to reports"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'reports')
WITH CHECK (bucket_id = 'reports');

-- Policy: Authenticated users can upload to their tenant folder
CREATE POLICY IF NOT EXISTS "Users can upload to their tenant folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reports'
  AND (storage.foldername(name))[1] = 'reports'
  -- Extract tenant_id from path: reports/{tenant_id}/{filename}
  AND (storage.foldername(name))[2] IN (
    SELECT xero_tenant_id::text FROM xero_connections WHERE user_id = auth.uid()
  )
);

-- Policy: Authenticated users can view their tenant's reports
CREATE POLICY IF NOT EXISTS "Users can view their tenant reports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'reports'
  AND (storage.foldername(name))[1] = 'reports'
  AND (storage.foldername(name))[2] IN (
    SELECT xero_tenant_id::text FROM xero_connections WHERE user_id = auth.uid()
  )
);

-- Policy: Authenticated users can update their tenant's reports
CREATE POLICY IF NOT EXISTS "Users can update their tenant reports"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'reports'
  AND (storage.foldername(name))[1] = 'reports'
  AND (storage.foldername(name))[2] IN (
    SELECT xero_tenant_id::text FROM xero_connections WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'reports'
  AND (storage.foldername(name))[1] = 'reports'
  AND (storage.foldername(name))[2] IN (
    SELECT xero_tenant_id::text FROM xero_connections WHERE user_id = auth.uid()
  )
);

-- Policy: Authenticated users can delete their tenant's reports
CREATE POLICY IF NOT EXISTS "Users can delete their tenant reports"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'reports'
  AND (storage.foldername(name))[1] = 'reports'
  AND (storage.foldername(name))[2] IN (
    SELECT xero_tenant_id::text FROM xero_connections WHERE user_id = auth.uid()
  )
);

-- =============================================================================
-- RECOMMENDATION DOCUMENTS BUCKET
-- =============================================================================

-- Create recommendation-documents bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recommendation-documents',
  'recommendation-documents',
  false, -- Private bucket, requires authentication
  10485760, -- 10 MB limit
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for recommendation-documents bucket

-- Policy: Service role has full access
CREATE POLICY IF NOT EXISTS "Service role has full access to recommendation documents"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'recommendation-documents')
WITH CHECK (bucket_id = 'recommendation-documents');

-- Policy: Authenticated users can upload documents
CREATE POLICY IF NOT EXISTS "Authenticated users can upload recommendation documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recommendation-documents'
  AND (storage.foldername(name))[1] = 'recommendations'
);

-- Policy: Authenticated users can view documents for their tenants
CREATE POLICY IF NOT EXISTS "Users can view their tenant recommendation documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'recommendation-documents'
  AND (storage.foldername(name))[1] = 'recommendations'
  -- Extract tenant_id from path: recommendations/{tenant_id}/{recommendation_id}/{filename}
  AND (storage.foldername(name))[2] IN (
    SELECT xero_tenant_id::text FROM xero_connections WHERE user_id = auth.uid()
  )
);

-- Policy: Public access via share tokens
-- This allows access to documents when accessed via valid share link
CREATE POLICY IF NOT EXISTS "Public can view shared recommendation documents"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'recommendation-documents'
  AND (storage.foldername(name))[1] = 'recommendations'
  -- Validation happens in the API layer via share token
  -- This policy allows the download to proceed
);

-- Policy: Users can delete their tenant's documents
CREATE POLICY IF NOT EXISTS "Users can delete their tenant recommendation documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'recommendation-documents'
  AND (storage.foldername(name))[1] = 'recommendations'
  AND (storage.foldername(name))[2] IN (
    SELECT xero_tenant_id::text FROM xero_connections WHERE user_id = auth.uid()
  )
);

-- =============================================================================
-- STORAGE FUNCTIONS AND UTILITIES
-- =============================================================================

-- Function to get storage usage by tenant
CREATE OR REPLACE FUNCTION get_tenant_storage_usage(p_tenant_id TEXT)
RETURNS TABLE (
  bucket_name TEXT,
  file_count BIGINT,
  total_size_bytes BIGINT,
  total_size_mb NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.bucket_id AS bucket_name,
    COUNT(*) AS file_count,
    SUM(o.metadata->>'size')::BIGINT AS total_size_bytes,
    ROUND((SUM(o.metadata->>'size')::BIGINT / 1048576.0)::NUMERIC, 2) AS total_size_mb
  FROM storage.objects o
  WHERE
    (o.bucket_id = 'reports' AND (storage.foldername(o.name))[2] = p_tenant_id)
    OR (o.bucket_id = 'recommendation-documents' AND (storage.foldername(o.name))[2] = p_tenant_id)
  GROUP BY o.bucket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old reports (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_reports(p_days_old INTEGER DEFAULT 90)
RETURNS TABLE (
  deleted_count INTEGER,
  freed_bytes BIGINT
) AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_freed_bytes BIGINT := 0;
  v_old_date TIMESTAMPTZ;
BEGIN
  v_old_date := NOW() - (p_days_old || ' days')::INTERVAL;

  -- Get count and size of files to delete
  SELECT COUNT(*), SUM((metadata->>'size')::BIGINT)
  INTO v_deleted_count, v_freed_bytes
  FROM storage.objects
  WHERE bucket_id = 'reports'
    AND created_at < v_old_date;

  -- Delete old report files
  DELETE FROM storage.objects
  WHERE bucket_id = 'reports'
    AND created_at < v_old_date;

  -- Also clean up database records
  DELETE FROM generated_reports
  WHERE generated_at < v_old_date;

  RETURN QUERY SELECT v_deleted_count, v_freed_bytes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate storage quota (optional - for future use)
CREATE OR REPLACE FUNCTION check_storage_quota(p_tenant_id TEXT, p_additional_bytes BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_usage BIGINT;
  v_quota_limit BIGINT := 524288000; -- 500 MB default quota
BEGIN
  -- Get current storage usage
  SELECT SUM((metadata->>'size')::BIGINT)
  INTO v_current_usage
  FROM storage.objects
  WHERE
    (bucket_id = 'reports' AND (storage.foldername(name))[2] = p_tenant_id)
    OR (bucket_id = 'recommendation-documents' AND (storage.foldername(name))[2] = p_tenant_id);

  -- Return true if within quota
  RETURN (COALESCE(v_current_usage, 0) + p_additional_bytes) <= v_quota_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS AND DOCUMENTATION
-- =============================================================================

COMMENT ON FUNCTION get_tenant_storage_usage IS 'Returns storage usage statistics for a specific tenant across all buckets';
COMMENT ON FUNCTION cleanup_old_reports IS 'Removes report files older than specified days (default: 90) to manage storage costs';
COMMENT ON FUNCTION check_storage_quota IS 'Validates if a tenant has enough storage quota for additional files (default: 500 MB per tenant)';

-- =============================================================================
-- INDEXES FOR STORAGE METADATA
-- =============================================================================

-- These indexes improve query performance for storage operations
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_id ON storage.objects(bucket_id);
CREATE INDEX IF NOT EXISTS idx_storage_objects_created_at ON storage.objects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storage_objects_name ON storage.objects(name);

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant execute permissions on utility functions to authenticated users
GRANT EXECUTE ON FUNCTION get_tenant_storage_usage TO authenticated;

-- Only service role can execute cleanup functions
GRANT EXECUTE ON FUNCTION cleanup_old_reports TO service_role;
GRANT EXECUTE ON FUNCTION check_storage_quota TO service_role;
