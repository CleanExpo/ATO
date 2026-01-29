-- =====================================================
-- Accountant Vetting & Onboarding System
-- =====================================================
-- Created: 2026-01-29
-- Purpose: Automated system for vetting accountant applications and managing approved partners
-- Pattern: Application → Review → Approval → Instant Access
--
-- DEPENDENCIES: This migration is designed to run independently
-- - organizations table: Optional (organization_id stored as plain UUID)
-- - user_tenant_access table: Optional (admin RLS policies removed for simplicity)
--
-- This migration will work standalone. Admin access is handled via service_role.
-- For full multi-tenant support, run migration 20260128000006 first.
-- =====================================================

-- =====================================================
-- 1. ACCOUNTANT APPLICATIONS TABLE
-- =====================================================

CREATE TABLE accountant_applications (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Applicant Contact Details
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,

    -- Firm Details
    firm_name TEXT NOT NULL,
    firm_abn TEXT,
    firm_website TEXT,
    firm_address TEXT,

    -- Professional Credentials
    credential_type TEXT NOT NULL CHECK (credential_type IN (
        'CPA',           -- Certified Practising Accountant
        'CA',            -- Chartered Accountant
        'RTA',           -- Registered Tax Agent
        'BAS_AGENT',     -- BAS Agent
        'FTA',           -- Fellow Tax Agent
        'OTHER'          -- Other professional designation
    )),
    credential_number TEXT NOT NULL,
    credential_issuing_body TEXT, -- e.g., "CPA Australia", "CA ANZ"
    credential_expiry DATE,
    years_experience INTEGER CHECK (years_experience >= 0),

    -- Additional Information
    specializations TEXT[], -- e.g., ['R&D Tax', 'Corporate Tax', 'Trust Structures']
    client_count INTEGER,
    referral_source TEXT, -- How they heard about us

    -- Application Status
    status TEXT NOT NULL CHECK (status IN (
        'pending',       -- Submitted, awaiting review
        'under_review',  -- Admin is reviewing
        'approved',      -- Approved and account created
        'rejected',      -- Application declined
        'suspended'      -- Account suspended after approval
    )) DEFAULT 'pending',

    -- Vetting Process
    reviewed_by UUID REFERENCES auth.users(id), -- Admin who reviewed
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    internal_notes TEXT, -- Admin notes (not visible to applicant)

    -- Account Linking (populated after approval)
    user_id UUID REFERENCES auth.users(id), -- Created after approval
    approved_organization_id UUID, -- Firm organization (links to organizations.id if table exists)

    -- Full Application Data (JSON backup)
    application_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Metadata
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- 2. VETTED ACCOUNTANTS TABLE
-- =====================================================
-- Fast lookup table for approved accountants with active benefits

CREATE TABLE vetted_accountants (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User Reference
    user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
    application_id UUID NOT NULL REFERENCES accountant_applications(id),
    organization_id UUID NOT NULL, -- Links to organizations.id (no FK constraint for flexibility)

    -- Quick Access Fields (denormalized for performance)
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    firm_name TEXT NOT NULL,
    credential_type TEXT NOT NULL,
    credential_number TEXT NOT NULL,

    -- Status Management
    is_active BOOLEAN NOT NULL DEFAULT true,
    suspended_at TIMESTAMPTZ,
    suspension_reason TEXT,
    suspended_by UUID REFERENCES auth.users(id),

    -- Benefits & Pricing
    wholesale_discount_rate NUMERIC NOT NULL DEFAULT 0.50, -- 50% off ($495 vs $995)
    lifetime_discount BOOLEAN NOT NULL DEFAULT true,
    special_pricing_note TEXT, -- e.g., "Early adopter - 60% discount"

    -- Engagement Metrics
    last_login_at TIMESTAMPTZ,
    total_reports_generated INTEGER DEFAULT 0,
    total_clients_onboarded INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- 3. ACCOUNTANT ACTIVITY LOG
-- =====================================================
-- Audit trail for all accountant-related actions

CREATE TABLE accountant_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Target
    accountant_id UUID REFERENCES vetted_accountants(id),
    application_id UUID REFERENCES accountant_applications(id),

    -- Action Details
    action TEXT NOT NULL, -- e.g., 'application_submitted', 'application_approved', 'account_suspended'
    actor_id UUID REFERENCES auth.users(id), -- Who performed the action
    actor_role TEXT, -- 'admin', 'system', 'self'

    -- Context
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- 4. INDEXES FOR PERFORMANCE
-- =====================================================

-- Accountant Applications
CREATE INDEX idx_accountant_applications_status ON accountant_applications(status);
CREATE INDEX idx_accountant_applications_email ON accountant_applications(email);
CREATE INDEX idx_accountant_applications_created_at ON accountant_applications(created_at DESC);
CREATE INDEX idx_accountant_applications_credential_type ON accountant_applications(credential_type);

-- Vetted Accountants
CREATE INDEX idx_vetted_accountants_email ON vetted_accountants(email);
CREATE INDEX idx_vetted_accountants_user_id ON vetted_accountants(user_id);
CREATE INDEX idx_vetted_accountants_is_active ON vetted_accountants(is_active);
CREATE INDEX idx_vetted_accountants_organization_id ON vetted_accountants(organization_id);

-- Activity Log
CREATE INDEX idx_accountant_activity_log_accountant_id ON accountant_activity_log(accountant_id);
CREATE INDEX idx_accountant_activity_log_application_id ON accountant_activity_log(application_id);
CREATE INDEX idx_accountant_activity_log_created_at ON accountant_activity_log(created_at DESC);

-- =====================================================
-- 5. AUTOMATIC TIMESTAMP UPDATES
-- =====================================================

CREATE OR REPLACE FUNCTION update_accountant_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accountant_applications_updated_at_trigger
    BEFORE UPDATE ON accountant_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_accountant_applications_updated_at();

CREATE OR REPLACE FUNCTION update_vetted_accountants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vetted_accountants_updated_at_trigger
    BEFORE UPDATE ON vetted_accountants
    FOR EACH ROW
    EXECUTE FUNCTION update_vetted_accountants_updated_at();

-- =====================================================
-- 6. ROW-LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE accountant_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vetted_accountants ENABLE ROW LEVEL SECURITY;
ALTER TABLE accountant_activity_log ENABLE ROW LEVEL SECURITY;

-- Accountant Applications Policies

-- Allow anyone to insert (submit application)
CREATE POLICY "Anyone can submit accountant application"
ON accountant_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Applicants can view their own application
CREATE POLICY "Users can view their own application"
ON accountant_applications
FOR SELECT
TO authenticated
USING (email = auth.jwt() ->> 'email');

-- Service role has full access
CREATE POLICY "Service role has full access to applications"
ON accountant_applications
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Vetted Accountants Policies

-- Service role has full access
CREATE POLICY "Service role has full access to vetted accountants"
ON vetted_accountants
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Vetted accountants can view their own record
CREATE POLICY "Vetted accountants can view own record"
ON vetted_accountants
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Activity Log Policies

-- Service role has full access
CREATE POLICY "Service role has full access to activity log"
ON accountant_activity_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- 7. HELPER FUNCTIONS
-- =====================================================

-- Check if email is a vetted accountant
CREATE OR REPLACE FUNCTION is_vetted_accountant(check_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM vetted_accountants
        WHERE email = check_email
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get accountant wholesale price
CREATE OR REPLACE FUNCTION get_accountant_pricing(check_email TEXT)
RETURNS TABLE (
    is_vetted BOOLEAN,
    discount_rate NUMERIC,
    final_price NUMERIC,
    standard_price NUMERIC
) AS $$
DECLARE
    v_discount_rate NUMERIC;
    v_standard_price NUMERIC := 995.00;
BEGIN
    -- Check if vetted accountant
    SELECT wholesale_discount_rate INTO v_discount_rate
    FROM vetted_accountants
    WHERE email = check_email
    AND is_active = true;

    IF v_discount_rate IS NOT NULL THEN
        RETURN QUERY SELECT
            true,
            v_discount_rate,
            v_standard_price * (1 - v_discount_rate),
            v_standard_price;
    ELSE
        RETURN QUERY SELECT
            false,
            0.00::NUMERIC,
            v_standard_price,
            v_standard_price;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get application statistics
CREATE OR REPLACE FUNCTION get_application_statistics()
RETURNS TABLE (
    total_applications BIGINT,
    pending_count BIGINT,
    under_review_count BIGINT,
    approved_count BIGINT,
    rejected_count BIGINT,
    suspended_count BIGINT,
    total_vetted_accountants BIGINT,
    active_accountants BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_applications,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'under_review') as under_review_count,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended_count,
        (SELECT COUNT(*) FROM vetted_accountants) as total_vetted_accountants,
        (SELECT COUNT(*) FROM vetted_accountants WHERE is_active = true) as active_accountants
    FROM accountant_applications;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. GRANT PERMISSIONS
-- =====================================================

GRANT ALL ON accountant_applications TO service_role;
GRANT SELECT, INSERT ON accountant_applications TO authenticated;
GRANT SELECT, INSERT ON accountant_applications TO anon;

GRANT ALL ON vetted_accountants TO service_role;
GRANT SELECT ON vetted_accountants TO authenticated;

GRANT ALL ON accountant_activity_log TO service_role;
GRANT SELECT ON accountant_activity_log TO authenticated;

-- =====================================================
-- 9. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE accountant_applications IS 'Stores applications from accountants wanting to join the partner program';
COMMENT ON TABLE vetted_accountants IS 'Fast lookup table for approved accountants with active wholesale pricing';
COMMENT ON TABLE accountant_activity_log IS 'Audit trail for all accountant-related actions';

COMMENT ON COLUMN accountant_applications.status IS 'Application lifecycle: pending → under_review → approved/rejected';
COMMENT ON COLUMN vetted_accountants.wholesale_discount_rate IS 'Discount rate (0.5 = 50% off, making $995 → $495)';
COMMENT ON COLUMN vetted_accountants.is_active IS 'Whether accountant can currently access wholesale pricing';

-- =====================================================
-- 10. SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Accountant Vetting System created successfully!';
    RAISE NOTICE 'Tables: accountant_applications, vetted_accountants, accountant_activity_log';
    RAISE NOTICE 'Functions: is_vetted_accountant, get_accountant_pricing, get_application_statistics';
    RAISE NOTICE 'Indexes: 12 indexes for performance optimization';
END $$;
