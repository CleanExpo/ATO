-- Migration: Scoped function for shared report data access
-- Date: 2026-02-08
-- Purpose: Reduce blast radius of public share endpoint (B-4).
--          Instead of the API route using a service-role client to query
--          forensic_analysis_results directly (bypassing all RLS), the route
--          now calls this SECURITY DEFINER function which:
--            1. Validates the share record (exists, not revoked, not expired)
--            2. Scopes the query to the share's tenant_id
--            3. Returns ONLY the columns needed for report generation
--            4. Applies report-type and filter constraints from the share record
--
-- Finding: B-4 in COMPLIANCE_RISK_ASSESSMENT.md

-- ============================================================
-- 1. Scoped function for shared report analysis data
-- ============================================================
CREATE OR REPLACE FUNCTION get_shared_report_analysis(
    p_share_id UUID
)
RETURNS TABLE(
    transaction_date DATE,
    transaction_amount DECIMAL(15,2),
    transaction_description TEXT,
    primary_category TEXT,
    category_confidence DECIMAL(5,2),
    is_rnd_candidate BOOLEAN,
    financial_year TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id TEXT;
    v_report_type TEXT;
    v_filters JSONB;
BEGIN
    -- Validate share record: must exist, not revoked, not expired
    SELECT sr.tenant_id, sr.report_type, sr.filters
    INTO v_tenant_id, v_report_type, v_filters
    FROM shared_reports sr
    WHERE sr.id = p_share_id
      AND sr.is_revoked = false
      AND sr.expires_at > now();

    -- Return empty set if share is invalid, expired, or revoked
    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    -- Return scoped results with only safe columns.
    -- tenant_id is NEVER exposed; it is only used internally for scoping.
    RETURN QUERY
    SELECT
        far.transaction_date,
        far.transaction_amount,
        far.transaction_description,
        far.primary_category,
        far.category_confidence,
        far.is_rnd_candidate,
        far.financial_year
    FROM forensic_analysis_results far
    WHERE far.tenant_id = v_tenant_id::UUID
      -- Apply report type filters
      AND (
          v_report_type IN ('full', 'custom')
          OR (v_report_type = 'rnd' AND far.is_rnd_candidate = true)
          OR (v_report_type = 'deductions' AND far.primary_category IN (
              'business_expense', 'travel', 'professional_development', 'home_office'
          ))
          OR (v_report_type = 'div7a' AND far.primary_category IN (
              'div7a_loan', 'shareholder_loan'
          ))
          OR (v_report_type = 'losses' AND far.primary_category IN (
              'loss', 'carry_forward_loss'
          ))
      )
      -- Apply financial year filter from share filters JSONB
      AND (
          v_filters IS NULL
          OR v_filters->'financialYears' IS NULL
          OR jsonb_array_length(v_filters->'financialYears') = 0
          OR far.financial_year IN (
              SELECT jsonb_array_elements_text(v_filters->'financialYears')
          )
      )
      -- Apply confidence filter from share filters JSONB
      AND (
          v_filters IS NULL
          OR v_filters->>'confidenceLevel' IS NULL
          OR v_filters->>'confidenceLevel' = 'all'
          OR (v_filters->>'confidenceLevel' = 'high' AND far.category_confidence >= 0.8)
          OR (v_filters->>'confidenceLevel' = 'medium' AND far.category_confidence >= 0.6)
          OR (v_filters->>'confidenceLevel' = 'low' AND far.category_confidence >= 0.4)
      )
    ORDER BY far.transaction_date DESC;
END;
$$;

-- Grant execute to service role (API routes use createServiceClient)
-- No anon or authenticated access — this function is only called from server-side
GRANT EXECUTE ON FUNCTION get_shared_report_analysis(UUID) TO service_role;
