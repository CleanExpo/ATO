-- ============================================================
-- Migration: Composite indexes for common query patterns
-- Date: 2026-02-12
-- Purpose: Add missing composite indexes to high-traffic tables.
--          These indexes target query patterns identified from API
--          routes, RLS policies, and analysis engines that were not
--          covered by the existing single-column or initial composite
--          indexes.
--
-- All indexes use CREATE INDEX IF NOT EXISTS for idempotency.
-- Note: CONCURRENTLY cannot be used inside a transaction block
-- (Supabase migrations run inside a transaction), so standard
-- CREATE INDEX is used here. For zero-downtime on very large
-- tables, run these manually with CONCURRENTLY outside a transaction.
-- ============================================================


-- ============================================================
-- 1. historical_transactions_cache (11K+ rows, most queried table)
-- ============================================================

-- Timeline queries: dashboard "recent transactions", sorted by ingestion time
-- Existing indexes cover (tenant_id, financial_year), (tenant_id, transaction_type),
-- (tenant_id, transaction_date), but NOT (tenant_id, created_at DESC).
CREATE INDEX IF NOT EXISTS idx_htc_tenant_created
  ON historical_transactions_cache(tenant_id, created_at DESC);

-- Transaction status filtering (e.g. pending vs authorised invoices)
-- Existing: none on (tenant_id, status)
CREATE INDEX IF NOT EXISTS idx_htc_tenant_status
  ON historical_transactions_cache(tenant_id, status);


-- ============================================================
-- 2. tax_recommendations (filtered by status constantly)
-- ============================================================

-- Recent recommendations: dashboard queries sorted by creation date
-- Existing indexes cover (tenant_id, priority), (tenant_id, status),
-- (tenant_id, financial_year), but NOT (tenant_id, created_at DESC).
CREATE INDEX IF NOT EXISTS idx_tax_recommendations_tenant_created
  ON tax_recommendations(tenant_id, created_at DESC);


-- ============================================================
-- 3. forensic_analysis_results (core analysis table)
-- ============================================================

-- Analysis history timeline: "when was each transaction last analysed?"
-- Existing indexes cover (tenant_id, financial_year), (tenant_id, primary_category),
-- (tenant_id, transaction_date), but NOT (tenant_id, analyzed_at DESC).
CREATE INDEX IF NOT EXISTS idx_forensic_tenant_analyzed
  ON forensic_analysis_results(tenant_id, analyzed_at DESC);


-- ============================================================
-- 4. security_events (breach detection hot path)
-- ============================================================

-- Anomaly detection: count_security_events() queries by event_type + time window.
-- Existing: single-column idx_security_events_type, idx_security_events_created.
-- This composite eliminates a bitmap AND for the most common breach query.
CREATE INDEX IF NOT EXISTS idx_security_events_type_created
  ON security_events(event_type, created_at DESC);

-- IP-based anomaly detection: rate limit checks and brute-force detection
-- query by ip_address + created_at window.
-- Existing: single-column idx_security_events_ip.
CREATE INDEX IF NOT EXISTS idx_security_events_ip_created
  ON security_events(ip_address, created_at DESC);


-- ============================================================
-- 5. organization_activity_log (audit trail queries)
-- ============================================================

-- Org-scoped audit trail: "show activity for this organization, most recent first"
-- Existing: single-column on organization_id and created_at separately.
CREATE INDEX IF NOT EXISTS idx_oal_org_created
  ON organization_activity_log(organization_id, created_at DESC);


-- ============================================================
-- 6. notifications (user inbox queries)
-- ============================================================

-- User notification timeline: "all notifications for user, newest first"
-- Existing: single-column on user_id and created_at separately,
-- plus (user_id, read) partial index on unread.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);


-- ============================================================
-- 7. analysis_queue (queue processing queries)
-- ============================================================

-- Tenant queue status: "show all queue items for this tenant by status"
-- Existing: single-column on tenant_id and status separately.
CREATE INDEX IF NOT EXISTS idx_analysis_queue_tenant_status
  ON analysis_queue(tenant_id, status);


-- ============================================================
-- 8. accountant_findings (org-scoped finding history)
-- ============================================================

-- Org-scoped timeline: "show findings for this organisation, newest first"
-- Existing: (organization_id, workflow_area) but NOT (organization_id, created_at DESC).
CREATE INDEX IF NOT EXISTS idx_af_org_created
  ON accountant_findings(organization_id, created_at DESC);


-- ============================================================
-- 9. cgt_events (CGT analysis filtering)
-- ============================================================

-- Event type filtering: "show all A1 disposals for this tenant"
-- Existing: (tenant_id, financial_year), (disposal_date) but NOT (tenant_id, event_type).
CREATE INDEX IF NOT EXISTS idx_cgt_events_tenant_type
  ON cgt_events(tenant_id, event_type);


-- ============================================================
-- 10. fbt_items (FBT analysis filtering)
-- ============================================================

-- Gross-up type filtering: Type 1 vs Type 2 classification per tenant
-- Existing: (tenant_id, fbt_year), (benefit_category) but NOT (tenant_id, gross_up_type).
CREATE INDEX IF NOT EXISTS idx_fbt_items_tenant_grossup
  ON fbt_items(tenant_id, gross_up_type);


-- ============================================================
-- 11. generated_reports (report retrieval)
-- ============================================================

-- Tenant report timeline: "show all reports for this tenant, newest first"
-- Existing: single-column on tenant_id and generated_at separately.
CREATE INDEX IF NOT EXISTS idx_gr_tenant_generated
  ON generated_reports(tenant_id, generated_at DESC);


-- ============================================================
-- Verification
-- ============================================================
DO $$
DECLARE
  idx_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE indexname IN (
    'idx_htc_tenant_created',
    'idx_htc_tenant_status',
    'idx_tax_recommendations_tenant_created',
    'idx_forensic_tenant_analyzed',
    'idx_security_events_type_created',
    'idx_security_events_ip_created',
    'idx_oal_org_created',
    'idx_notifications_user_created',
    'idx_analysis_queue_tenant_status',
    'idx_af_org_created',
    'idx_cgt_events_tenant_type',
    'idx_fbt_items_tenant_grossup',
    'idx_gr_tenant_generated'
  );

  RAISE NOTICE '============================================';
  RAISE NOTICE 'Composite index migration complete!';
  RAISE NOTICE 'Created % of 13 expected indexes', idx_count;
  RAISE NOTICE '============================================';
END $$;
