-- Migration: Recommendation Documents
-- Created: 27 January 2026
-- Purpose: Store metadata for documents attached to recommendations

-- Create recommendation_documents table
CREATE TABLE IF NOT EXISTS recommendation_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id TEXT NOT NULL,
    share_id UUID REFERENCES shared_reports(id) ON DELETE SET NULL,
    tenant_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_by_name TEXT NOT NULL,
    uploaded_by_type TEXT NOT NULL CHECK (uploaded_by_type IN ('owner', 'accountant')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_rec_docs_recommendation ON recommendation_documents(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_rec_docs_tenant ON recommendation_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rec_docs_share ON recommendation_documents(share_id);

-- Enable Row Level Security
ALTER TABLE recommendation_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users (tenant validation in API)
CREATE POLICY "Allow all for authenticated" ON recommendation_documents
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create storage bucket for recommendation documents (if not exists)
-- Note: This may need to be created manually in Supabase dashboard
-- Bucket name: recommendation-documents
-- Public: false
-- File size limit: 10MB
-- Allowed MIME types: application/pdf, image/jpeg, image/png,
--   application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document,
--   application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

COMMENT ON TABLE recommendation_documents IS 'Stores metadata for documents attached to tax recommendations';
COMMENT ON COLUMN recommendation_documents.recommendation_id IS 'References the recommendation this document supports';
COMMENT ON COLUMN recommendation_documents.share_id IS 'If uploaded via share link, references the shared_reports entry';
COMMENT ON COLUMN recommendation_documents.storage_path IS 'Path in Supabase Storage bucket';
COMMENT ON COLUMN recommendation_documents.uploaded_by_type IS 'Whether uploaded by owner or accountant';
