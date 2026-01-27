-- Migration: R&D Evidence Collection
-- Created: 2026-01-27
-- Purpose: Store evidence items for Division 355 four-element test and track evidence sufficiency scores

-- R&D Evidence items per project per element
CREATE TABLE IF NOT EXISTS rnd_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    registration_id UUID REFERENCES rnd_registrations(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    element TEXT NOT NULL CHECK (element IN (
        'outcome_unknown',     -- Evidence that outcome could not be determined in advance
        'systematic_approach', -- Evidence of systematic progression of work
        'new_knowledge',       -- Evidence of generating new knowledge
        'scientific_method'    -- Evidence of using scientific principles
    )),
    evidence_type TEXT NOT NULL CHECK (evidence_type IN (
        'document',    -- Uploaded file (links to recommendation_documents)
        'description', -- Text-based evidence description
        'reference'    -- External URL reference
    )),
    title TEXT NOT NULL,
    description TEXT,
    document_id UUID REFERENCES recommendation_documents(id) ON DELETE SET NULL,
    url TEXT, -- External URL reference for 'reference' type
    date_created DATE, -- When the evidence was originally created (contemporaneous check)
    is_contemporaneous BOOLEAN DEFAULT FALSE, -- True if created during R&D activity
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Evidence sufficiency scores per project
CREATE TABLE IF NOT EXISTS rnd_evidence_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    registration_id UUID REFERENCES rnd_registrations(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    outcome_unknown_score INTEGER DEFAULT 0 CHECK (outcome_unknown_score >= 0 AND outcome_unknown_score <= 100),
    systematic_approach_score INTEGER DEFAULT 0 CHECK (systematic_approach_score >= 0 AND systematic_approach_score <= 100),
    new_knowledge_score INTEGER DEFAULT 0 CHECK (new_knowledge_score >= 0 AND new_knowledge_score <= 100),
    scientific_method_score INTEGER DEFAULT 0 CHECK (scientific_method_score >= 0 AND scientific_method_score <= 100),
    overall_score INTEGER DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
    last_calculated TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, registration_id, project_name)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rnd_evidence_tenant ON rnd_evidence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rnd_evidence_registration ON rnd_evidence(registration_id);
CREATE INDEX IF NOT EXISTS idx_rnd_evidence_project ON rnd_evidence(project_name);
CREATE INDEX IF NOT EXISTS idx_rnd_evidence_element ON rnd_evidence(element);
CREATE INDEX IF NOT EXISTS idx_rnd_evidence_document ON rnd_evidence(document_id);

CREATE INDEX IF NOT EXISTS idx_rnd_evidence_scores_tenant ON rnd_evidence_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rnd_evidence_scores_registration ON rnd_evidence_scores(registration_id);
CREATE INDEX IF NOT EXISTS idx_rnd_evidence_scores_project ON rnd_evidence_scores(project_name);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rnd_evidence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp on evidence updates
DROP TRIGGER IF EXISTS rnd_evidence_updated_at ON rnd_evidence;
CREATE TRIGGER rnd_evidence_updated_at
    BEFORE UPDATE ON rnd_evidence
    FOR EACH ROW
    EXECUTE FUNCTION update_rnd_evidence_timestamp();

-- View for evidence summary by project and element
CREATE OR REPLACE VIEW rnd_evidence_summary AS
SELECT
    e.tenant_id,
    e.registration_id,
    e.project_name,
    e.element,
    COUNT(*) AS evidence_count,
    COUNT(CASE WHEN e.evidence_type = 'document' THEN 1 END) AS document_count,
    COUNT(CASE WHEN e.is_contemporaneous = TRUE THEN 1 END) AS contemporaneous_count,
    MAX(e.created_at) AS latest_evidence_date
FROM rnd_evidence e
GROUP BY e.tenant_id, e.registration_id, e.project_name, e.element;

-- Comments for documentation
COMMENT ON TABLE rnd_evidence IS 'Stores evidence items for Division 355 four-element test per R&D project';
COMMENT ON COLUMN rnd_evidence.element IS 'Which four-element test criterion: outcome_unknown, systematic_approach, new_knowledge, scientific_method';
COMMENT ON COLUMN rnd_evidence.evidence_type IS 'Type of evidence: document (file upload), description (text), reference (URL)';
COMMENT ON COLUMN rnd_evidence.document_id IS 'References recommendation_documents if evidence is an uploaded file';
COMMENT ON COLUMN rnd_evidence.is_contemporaneous IS 'Whether evidence was created during the R&D activity (stronger for ATO audit)';

COMMENT ON TABLE rnd_evidence_scores IS 'Tracks evidence sufficiency scores per project element';
COMMENT ON COLUMN rnd_evidence_scores.overall_score IS 'Weighted average of all four element scores (0-100)';
COMMENT ON COLUMN rnd_evidence_scores.last_calculated IS 'When the score was last recalculated';
