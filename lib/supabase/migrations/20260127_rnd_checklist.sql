-- R&D Claim Preparation Checklist Schema
-- Plan 10-03: Claim preparation checklist for R&D Tax Incentive
-- Division 355 ITAA 1997

-- Checklist templates (read-only reference data for standard items)
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

-- R&D Checklist items with completion tracking per tenant/registration
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

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_checklist_items_tenant ON rnd_checklist_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_registration ON rnd_checklist_items(registration_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_category ON rnd_checklist_items(category);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_category ON rnd_checklist_templates(category);

-- Seed standard checklist template items
INSERT INTO rnd_checklist_templates (category, item_key, title, description, legislation_reference, is_mandatory, display_order) VALUES
-- Documentation category
('documentation', 'doc_project_plan', 'Project Plan', 'Document describing objectives, hypotheses, methodology, and timeline', 's 355-25 ITAA 1997', TRUE, 1),
('documentation', 'doc_technical_uncertainty', 'Technical Uncertainty Documentation', 'Records of knowledge gaps and uncertainties at project start', 's 355-25(1)(a)', TRUE, 2),
('documentation', 'doc_systematic_approach', 'Systematic Approach Records', 'Evidence of systematic progression of work', 's 355-25(1)(b)', TRUE, 3),
('documentation', 'doc_new_knowledge', 'New Knowledge Evidence', 'Documentation of new knowledge generated', 's 355-25(1)(c)', TRUE, 4),
('documentation', 'doc_scientific_method', 'Scientific Method Records', 'Evidence of scientific/engineering principles used', 's 355-25(1)(d)', TRUE, 5),
('documentation', 'doc_contemporaneous', 'Contemporaneous Records', 'Lab notebooks, development logs, meeting minutes created during R&D activities', 's 355-25', TRUE, 6),
('documentation', 'doc_expenditure', 'Expenditure Records', 'Timesheets, invoices, asset register for R&D activities', 's 355-205', TRUE, 7),
-- Registration category
('registration', 'reg_mygovid', 'myGovID Setup', 'Ensure myGovID is linked to business.gov.au with Standard or Strong identity strength', NULL, TRUE, 1),
('registration', 'reg_activity_description', 'Activity Descriptions', 'Prepare R&D activity descriptions for AusIndustry registration form', 's 27A IRDA', TRUE, 2),
('registration', 'reg_expenditure_estimate', 'Expenditure Estimate', 'Calculate and document estimated R&D expenditure for registration', 's 27J IRDA', TRUE, 3),
('registration', 'reg_submission', 'Submit Registration', 'Submit registration via business.gov.au before the 10-month deadline', 's 27A IRDA', TRUE, 4),
('registration', 'reg_confirmation', 'Registration Confirmation', 'Save AusIndustry registration reference number for tax return', NULL, TRUE, 5),
-- Tax return category
('tax_return', 'tax_schedule_16n', 'Complete Schedule 16N', 'Complete the R&D Tax Incentive Schedule with all required fields', NULL, TRUE, 1),
('tax_return', 'tax_company_return', 'Company Tax Return', 'Include R&D offset claim in company tax return', NULL, TRUE, 2),
('tax_return', 'tax_lodgement', 'Lodge Tax Return', 'Submit tax return with R&D schedule to the ATO', NULL, TRUE, 3),
-- Post-submission category
('post_submission', 'post_records_retention', 'Records Retention', 'Retain all R&D records for a minimum of 5 years from lodgement', 's 262A ITAA 1936', TRUE, 1),
('post_submission', 'post_amendment_period', 'Note Amendment Period', 'Track 4-year amendment period from date of assessment', 's 170 ITAA 1936', FALSE, 2)
ON CONFLICT (item_key) DO NOTHING;
