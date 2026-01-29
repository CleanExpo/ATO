-- Combined Migration Script - All 7 Files
-- Testing all SQL migrations for errors
-- Date: 28 January 2026

-- ============================================
-- File 1: shared_reports
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_shared_reports_token ON shared_reports(token);
CREATE INDEX IF NOT EXISTS idx_shared_reports_tenant ON shared_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shared_reports_expires ON shared_reports(expires_at);
CREATE INDEX IF NOT EXISTS idx_shared_reports_status ON shared_reports(is_revoked, expires_at);

CREATE TABLE IF NOT EXISTS share_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL REFERENCES shared_reports(id) ON DELETE CASCADE,
    accessed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    successful BOOLEAN DEFAULT TRUE,
    failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_share_access_logs_share_id ON share_access_logs(share_id);
CREATE INDEX IF NOT EXISTS idx_share_access_logs_accessed_at ON share_access_logs(accessed_at);

ALTER TABLE shared_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shared_reports_tenant_isolation ON shared_reports;
CREATE POLICY shared_reports_tenant_isolation ON shared_reports
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS shared_reports_public_read ON shared_reports;
CREATE POLICY shared_reports_public_read ON shared_reports
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS share_access_logs_read ON share_access_logs;
CREATE POLICY share_access_logs_read ON share_access_logs
    FOR SELECT
    USING (
        share_id IN (
            SELECT id FROM shared_reports
            WHERE tenant_id = current_setting('app.current_tenant_id', true)
        )
    );

DROP POLICY IF EXISTS share_access_logs_insert ON share_access_logs;
CREATE POLICY share_access_logs_insert ON share_access_logs
    FOR INSERT
    WITH CHECK (true);

-- ============================================
-- File 2: share_feedback
-- ============================================
CREATE TABLE IF NOT EXISTS share_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL REFERENCES shared_reports(id) ON DELETE CASCADE,
    finding_id TEXT,
    author_name TEXT NOT NULL,
    author_email TEXT,
    message TEXT NOT NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('comment', 'question', 'approval', 'concern')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    reply_to UUID REFERENCES share_feedback(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_share_feedback_share_id ON share_feedback(share_id);
CREATE INDEX IF NOT EXISTS idx_share_feedback_finding_id ON share_feedback(share_id, finding_id);
CREATE INDEX IF NOT EXISTS idx_share_feedback_unread ON share_feedback(share_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_share_feedback_created ON share_feedback(created_at DESC);

ALTER TABLE share_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS share_feedback_public_insert ON share_feedback;
CREATE POLICY share_feedback_public_insert ON share_feedback
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS share_feedback_public_read ON share_feedback;
CREATE POLICY share_feedback_public_read ON share_feedback
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS share_feedback_tenant_update ON share_feedback;
CREATE POLICY share_feedback_tenant_update ON share_feedback
    FOR UPDATE
    USING (
        share_id IN (
            SELECT id FROM shared_reports
            WHERE tenant_id = current_setting('app.current_tenant_id', true)
        )
    );

-- ============================================
-- File 3: recommendation_status
-- ============================================
CREATE TABLE IF NOT EXISTS recommendation_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id TEXT NOT NULL,
    share_id UUID REFERENCES shared_reports(id) ON DELETE SET NULL,
    tenant_id TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_rec_status_recommendation ON recommendation_status(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_rec_status_tenant ON recommendation_status(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rec_status_share ON recommendation_status(share_id);
CREATE INDEX IF NOT EXISTS idx_rec_status_created ON recommendation_status(created_at DESC);

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

-- ============================================
-- File 4: recommendation_documents
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_rec_docs_recommendation ON recommendation_documents(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_rec_docs_tenant ON recommendation_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rec_docs_share ON recommendation_documents(share_id);

ALTER TABLE recommendation_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON recommendation_documents;
CREATE POLICY "Allow all for authenticated" ON recommendation_documents
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- File 5: rnd_registration
-- ============================================
CREATE TABLE IF NOT EXISTS rnd_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    financial_year TEXT NOT NULL,
    registration_status TEXT NOT NULL DEFAULT 'not_started' CHECK (registration_status IN (
        'not_started',
        'in_progress',
        'submitted',
        'approved',
        'rejected'
    )),
    ausindustry_reference TEXT,
    submission_date TIMESTAMPTZ,
    approval_date TIMESTAMPTZ,
    deadline_date DATE NOT NULL,
    eligible_expenditure DECIMAL(15,2),
    estimated_offset DECIMAL(15,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, financial_year)
);

CREATE TABLE IF NOT EXISTS rnd_deadline_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    financial_year TEXT NOT NULL,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN (
        '90_days',
        '60_days',
        '30_days',
        '7_days'
    )),
    scheduled_date DATE NOT NULL,
    sent_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, financial_year, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_rnd_reg_tenant ON rnd_registrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rnd_reg_fy ON rnd_registrations(financial_year);
CREATE INDEX IF NOT EXISTS idx_rnd_reg_status ON rnd_registrations(registration_status);
CREATE INDEX IF NOT EXISTS idx_rnd_reg_deadline ON rnd_registrations(deadline_date);

CREATE INDEX IF NOT EXISTS idx_rnd_reminder_tenant ON rnd_deadline_reminders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rnd_reminder_scheduled ON rnd_deadline_reminders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_rnd_reminder_sent ON rnd_deadline_reminders(sent_at);

CREATE OR REPLACE FUNCTION update_rnd_registration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rnd_registration_updated_at ON rnd_registrations;
CREATE TRIGGER rnd_registration_updated_at
    BEFORE UPDATE ON rnd_registrations
    FOR EACH ROW
    EXECUTE FUNCTION update_rnd_registration_timestamp();

CREATE OR REPLACE VIEW rnd_deadline_summary AS
SELECT
    r.id,
    r.tenant_id,
    r.financial_year,
    r.registration_status,
    r.deadline_date,
    r.eligible_expenditure,
    r.estimated_offset,
    r.ausindustry_reference,
    CASE
        WHEN r.registration_status IN ('submitted', 'approved') THEN 'completed'
        WHEN r.deadline_date < CURRENT_DATE THEN 'overdue'
        WHEN r.deadline_date - CURRENT_DATE <= 7 THEN 'critical'
        WHEN r.deadline_date - CURRENT_DATE <= 30 THEN 'urgent'
        WHEN r.deadline_date - CURRENT_DATE <= 90 THEN 'approaching'
        ELSE 'open'
    END AS urgency_level,
    (r.deadline_date - CURRENT_DATE) AS days_until_deadline,
    r.created_at,
    r.updated_at
FROM rnd_registrations r
ORDER BY r.deadline_date ASC;

-- ============================================
-- File 6: rnd_evidence
-- ============================================
CREATE TABLE IF NOT EXISTS rnd_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    registration_id UUID REFERENCES rnd_registrations(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    element TEXT NOT NULL CHECK (element IN (
        'outcome_unknown',
        'systematic_approach',
        'new_knowledge',
        'scientific_method'
    )),
    evidence_type TEXT NOT NULL CHECK (evidence_type IN (
        'document',
        'description',
        'reference'
    )),
    title TEXT NOT NULL,
    description TEXT,
    document_id UUID REFERENCES recommendation_documents(id) ON DELETE SET NULL,
    url TEXT,
    date_created DATE,
    is_contemporaneous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

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

CREATE INDEX IF NOT EXISTS idx_rnd_evidence_tenant ON rnd_evidence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rnd_evidence_registration ON rnd_evidence(registration_id);
CREATE INDEX IF NOT EXISTS idx_rnd_evidence_project ON rnd_evidence(project_name);
CREATE INDEX IF NOT EXISTS idx_rnd_evidence_element ON rnd_evidence(element);
CREATE INDEX IF NOT EXISTS idx_rnd_evidence_document ON rnd_evidence(document_id);

CREATE INDEX IF NOT EXISTS idx_rnd_evidence_scores_tenant ON rnd_evidence_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rnd_evidence_scores_registration ON rnd_evidence_scores(registration_id);
CREATE INDEX IF NOT EXISTS idx_rnd_evidence_scores_project ON rnd_evidence_scores(project_name);

CREATE OR REPLACE FUNCTION update_rnd_evidence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rnd_evidence_updated_at ON rnd_evidence;
CREATE TRIGGER rnd_evidence_updated_at
    BEFORE UPDATE ON rnd_evidence
    FOR EACH ROW
    EXECUTE FUNCTION update_rnd_evidence_timestamp();

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

-- ============================================
-- File 7: rnd_checklist
-- ============================================
CREATE TABLE IF NOT EXISTS rnd_checklist_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    item_key TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    legislation_reference TEXT,
    is_mandatory BOOLEAN DEFAULT TRUE,
    display_order INTEGER,
    help_url TEXT
);

CREATE TABLE IF NOT EXISTS rnd_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    registration_id UUID REFERENCES rnd_registrations(id),
    category TEXT NOT NULL,
    item_key TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    completed_by TEXT,
    notes TEXT,
    document_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, registration_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_tenant ON rnd_checklist_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_registration ON rnd_checklist_items(registration_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_category ON rnd_checklist_items(category);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_category ON rnd_checklist_templates(category);

INSERT INTO rnd_checklist_templates (category, item_key, title, description, legislation_reference, is_mandatory, display_order) VALUES
('documentation', 'doc_project_plan', 'Project Plan', 'Document describing objectives, hypotheses, methodology, and timeline', 's 355-25 ITAA 1997', TRUE, 1),
('documentation', 'doc_technical_uncertainty', 'Technical Uncertainty Documentation', 'Records of knowledge gaps and uncertainties at project start', 's 355-25(1)(a)', TRUE, 2),
('documentation', 'doc_systematic_approach', 'Systematic Approach Records', 'Evidence of systematic progression of work', 's 355-25(1)(b)', TRUE, 3),
('documentation', 'doc_new_knowledge', 'New Knowledge Evidence', 'Documentation of new knowledge generated', 's 355-25(1)(c)', TRUE, 4),
('documentation', 'doc_scientific_method', 'Scientific Method Records', 'Evidence of scientific/engineering principles used', 's 355-25(1)(d)', TRUE, 5),
('documentation', 'doc_contemporaneous', 'Contemporaneous Records', 'Lab notebooks, development logs, meeting minutes created during R&D activities', 's 355-25', TRUE, 6),
('documentation', 'doc_expenditure', 'Expenditure Records', 'Timesheets, invoices, asset register for R&D activities', 's 355-205', TRUE, 7),
('registration', 'reg_mygovid', 'myGovID Setup', 'Ensure myGovID is linked to business.gov.au with Standard or Strong identity strength', NULL, TRUE, 1),
('registration', 'reg_activity_description', 'Activity Descriptions', 'Prepare R&D activity descriptions for AusIndustry registration form', 's 27A IRDA', TRUE, 2),
('registration', 'reg_expenditure_estimate', 'Expenditure Estimate', 'Calculate and document estimated R&D expenditure for registration', 's 27J IRDA', TRUE, 3),
('registration', 'reg_submission', 'Submit Registration', 'Submit registration via business.gov.au before the 10-month deadline', 's 27A IRDA', TRUE, 4),
('registration', 'reg_confirmation', 'Registration Confirmation', 'Save AusIndustry registration reference number for tax return', NULL, TRUE, 5),
('tax_return', 'tax_schedule_16n', 'Complete Schedule 16N', 'Complete the R&D Tax Incentive Schedule with all required fields', NULL, TRUE, 1),
('tax_return', 'tax_company_return', 'Company Tax Return', 'Include R&D offset claim in company tax return', NULL, TRUE, 2),
('tax_return', 'tax_lodgement', 'Lodge Tax Return', 'Submit tax return with R&D schedule to the ATO', NULL, TRUE, 3),
('post_submission', 'post_records_retention', 'Records Retention', 'Retain all R&D records for a minimum of 5 years from lodgement', 's 262A ITAA 1936', TRUE, 1),
('post_submission', 'post_amendment_period', 'Note Amendment Period', 'Track 4-year amendment period from date of assessment', 's 170 ITAA 1936', FALSE, 2)
ON CONFLICT (item_key) DO NOTHING;
