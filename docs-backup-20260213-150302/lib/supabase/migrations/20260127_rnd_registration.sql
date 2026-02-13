-- Migration: R&D Registration Tracking
-- Created: 2026-01-27
-- Purpose: Track R&D Tax Incentive (Division 355) registration status and deadlines per financial year

-- R&D Registration tracking per tenant per financial year
CREATE TABLE IF NOT EXISTS rnd_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    financial_year TEXT NOT NULL, -- e.g., 'FY2024-25'
    registration_status TEXT NOT NULL DEFAULT 'not_started' CHECK (registration_status IN (
        'not_started',     -- Registration not yet begun
        'in_progress',     -- Currently preparing registration
        'submitted',       -- Submitted to AusIndustry
        'approved',        -- Registration approved by AusIndustry
        'rejected'         -- Registration rejected (can be resubmitted)
    )),
    ausindustry_reference TEXT, -- AusIndustry registration reference number
    submission_date TIMESTAMPTZ,
    approval_date TIMESTAMPTZ,
    deadline_date DATE NOT NULL, -- 10 months after FY end (April 30 of following year)
    eligible_expenditure DECIMAL(15,2), -- Total eligible R&D expenditure
    estimated_offset DECIMAL(15,2), -- 43.5% of eligible expenditure
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, financial_year)
);

-- Registration deadline reminders
CREATE TABLE IF NOT EXISTS rnd_deadline_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    financial_year TEXT NOT NULL,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN (
        '90_days',  -- 90 days before deadline
        '60_days',  -- 60 days before deadline
        '30_days',  -- 30 days before deadline
        '7_days'    -- 7 days before deadline
    )),
    scheduled_date DATE NOT NULL, -- When the reminder should trigger
    sent_at TIMESTAMPTZ, -- When reminder was actually sent (NULL if not yet sent)
    dismissed_at TIMESTAMPTZ, -- When user dismissed the reminder
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, financial_year, reminder_type)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rnd_reg_tenant ON rnd_registrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rnd_reg_fy ON rnd_registrations(financial_year);
CREATE INDEX IF NOT EXISTS idx_rnd_reg_status ON rnd_registrations(registration_status);
CREATE INDEX IF NOT EXISTS idx_rnd_reg_deadline ON rnd_registrations(deadline_date);

CREATE INDEX IF NOT EXISTS idx_rnd_reminder_tenant ON rnd_deadline_reminders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rnd_reminder_scheduled ON rnd_deadline_reminders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_rnd_reminder_sent ON rnd_deadline_reminders(sent_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rnd_registration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp on registration updates
DROP TRIGGER IF EXISTS rnd_registration_updated_at ON rnd_registrations;
CREATE TRIGGER rnd_registration_updated_at
    BEFORE UPDATE ON rnd_registrations
    FOR EACH ROW
    EXECUTE FUNCTION update_rnd_registration_timestamp();

-- View for upcoming deadlines with urgency levels
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

-- Comments for documentation
COMMENT ON TABLE rnd_registrations IS 'Tracks R&D Tax Incentive (Division 355 ITAA 1997) registration status per financial year';
COMMENT ON COLUMN rnd_registrations.registration_status IS 'Status: not_started, in_progress, submitted, approved, rejected';
COMMENT ON COLUMN rnd_registrations.deadline_date IS 'Registration deadline (10 months after FY end, typically April 30)';
COMMENT ON COLUMN rnd_registrations.ausindustry_reference IS 'Reference number from AusIndustry portal upon submission';
COMMENT ON COLUMN rnd_registrations.eligible_expenditure IS 'Total eligible R&D expenditure for this FY';
COMMENT ON COLUMN rnd_registrations.estimated_offset IS 'Estimated 43.5% refundable tax offset';

COMMENT ON TABLE rnd_deadline_reminders IS 'Tracks deadline reminder scheduling and delivery';
COMMENT ON COLUMN rnd_deadline_reminders.reminder_type IS 'Reminder interval: 90_days, 60_days, 30_days, 7_days';
COMMENT ON COLUMN rnd_deadline_reminders.sent_at IS 'Timestamp when reminder was sent (NULL if pending)';
COMMENT ON COLUMN rnd_deadline_reminders.dismissed_at IS 'Timestamp when user dismissed reminder';
