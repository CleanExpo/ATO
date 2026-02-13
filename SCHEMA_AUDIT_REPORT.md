# Comprehensive SQL Schema Audit Report

**Date:** 2026-02-10
**Database:** `xwqymjisxmtcmaebcehw.supabase.co` (Supabase/PostgreSQL)
**Live tables found:** 57 (including 4 views)
**Code table references found:** 67 unique table names

---

## Executive Summary

| Category | Count | Severity |
|----------|-------|----------|
| Tables fully operational (in DB + in code) | 42 | -- |
| Tables with indirect/dynamic references | 3 | Low |
| Orphan tables (in DB, no code refs) | 5 + 3 views | Low |
| **MISSING tables (in code, not in DB)** | **15** | **CRITICAL** |
| Tables with missing timestamps | 14 | Medium |
| Table name typo bug | 1 | High |
| Test-only table references (no action needed) | 5 | None |

**The single biggest issue: 15 tables are referenced in production code but DO NOT EXIST in the live database.** Every `.from('missing_table')` call will silently fail and return empty data, which explains the data quality concerns.

---

## CRITICAL: Missing Tables (referenced in code, not in database)

These will cause runtime failures or return empty data silently.

| # | Table Name | Severity | Refs | Key Files |
|---|-----------|----------|------|-----------|
| 1 | `accountant_findings` | CRITICAL | 10 | `app/dashboard/accountant/*/page.tsx` (6 pages), `app/api/accountant/findings/route.ts` |
| 2 | `organization_activity_log` | CRITICAL | 13 | `app/api/organizations/[id]/route.ts`, `app/api/activity/route.ts`, `app/api/admin/` routes |
| 3 | `myob_connections` | CRITICAL | 7 | `app/api/auth/myob/callback/route.ts`, `app/api/myob/*/route.ts`, `lib/ai/batch-processor.ts` |
| 4 | `xero_transactions` | CRITICAL | 5 | `lib/analysis/reanalysis-worker.ts`, `app/api/analysis/trust-distributions/route.ts`, `app/api/analysis/fuel-tax-credits/route.ts` |
| 5 | `generated_reports` | CRITICAL | 7 | `app/api/reports/generate/route.ts`, `app/api/reports/download/route.ts`, `scripts/storage-cleanup.ts` |
| 6 | `xero_contacts` | HIGH | 4 | `app/api/analysis/trust-distributions/route.ts`, `lib/analysis/reanalysis-worker.ts` |
| 7 | `admin_audit_log` | HIGH | 4 | `lib/audit/logger.ts` (all admin audit logging) |
| 8 | `organization_invitations` | HIGH | 3 | `app/api/invitations/accept/route.ts`, `app/api/organizations/[id]/invitations/route.ts` |
| 9 | `council_sessions` | MEDIUM | 3 | `agents/council/council-orchestrator.ts`, `app/api/council/decisions/route.ts` |
| 10 | `conversion_events` | MEDIUM | 3 | `agents/council/council-orchestrator.ts`, `app/api/council/conversion/route.ts` |
| 11 | `advisor_metrics` | MEDIUM | 2 | `agents/council/council-orchestrator.ts` |
| 12 | `abn_lookup_cache` | MEDIUM | 2 | `lib/integrations/abn-lookup.ts` |
| 13 | `consolidated_report_log` | LOW | 1 | `app/api/reports/consolidated/generate/route.ts` |
| 14 | `user_organization_access` | LOW | 1 | `lib/reports/consolidated-report-generator.ts` |
| 15 | `xero_tenants` | LOW | 1 | `app/api/share/[token]/route.ts` |

---

## BUG: Table Name Typo

| Table in DB | Table in Code | File | Line |
|------------|---------------|------|------|
| `fuel_tax_credit_analyses` | `fuel_tax_credits_analyses` (extra 's') | `lib/analysis/reanalysis-worker.ts` | 358 |

The reanalysis worker will silently fail when trying to store fuel tax credit analysis results.

---

## Tables Fully Operational

These 42 tables exist in the live database AND are properly referenced in application code.

| # | Table | Timestamps | FKs | Warnings |
|---|-------|-----------|-----|----------|
| 1 | `accountant_activity_log` | created_at only | 2 FKs | Missing updated_at |
| 2 | `accountant_applications` | Both | None | -- |
| 3 | `agent_reports` | Both | None | -- |
| 4 | `ai_analysis_costs` | Neither | None | Missing created_at AND updated_at |
| 5 | `analysis_queue` | Both | 1 FK | -- |
| 6 | `audit_sync_status` | Both | None | -- |
| 7 | `correction_logs` | Both | 1 FK | -- |
| 8 | `data_breaches` | Both | None | -- |
| 9 | `data_quality_issues` | Both | None | -- |
| 10 | `data_quality_scan_status` | Both | None | -- |
| 11 | `forensic_analysis_results` | Both | None | -- |
| 12 | `historical_transactions_cache` | Both | None | -- |
| 13 | `notifications` | created_at only | 1 FK | Missing updated_at |
| 14 | `organization_group_members` | Neither | 2 FKs | Missing created_at AND updated_at (has added_at) |
| 15 | `organization_groups` | Both | None | -- |
| 16 | `organizations` | Both | None | -- |
| 17 | `profiles` | Both | None | -- |
| 18 | `purchases` | created_at only | None | Missing updated_at |
| 19 | `questionnaire_responses` | Both | 1 FK | -- |
| 20 | `questionnaires` | Both | 1 FK | -- |
| 21 | `quickbooks_tokens` | Both | None | -- |
| 22 | `rnd_checklist_items` | created_at only | 1 FK | Missing updated_at |
| 23 | `rnd_checklist_templates` | Neither | None | Missing created_at AND updated_at (reference data) |
| 24 | `rnd_evidence` | Both | 2 FKs | -- |
| 25 | `rnd_evidence_scores` | Neither | 1 FK | Missing created_at AND updated_at (has last_calculated) |
| 26 | `rnd_registrations` | Both | None | -- |
| 27 | `security_events` | created_at only | None | Missing updated_at (append-only log, acceptable) |
| 28 | `share_access_logs` | Neither | 1 FK | Missing created_at AND updated_at (has accessed_at) |
| 29 | `share_feedback` | created_at only | 2 FKs | Missing updated_at |
| 30 | `shared_reports` | created_at only | None | Missing updated_at |
| 31 | `tax_alert_definitions` | Both | None | -- |
| 32 | `tax_alert_history` | created_at only | 1 FK | Missing updated_at (append-only, acceptable) |
| 33 | `tax_alert_preferences` | Both | None | -- |
| 34 | `tax_alerts` | Both | 1 FK | -- |
| 35 | `tax_rates_cache` | created_at only | None | Missing updated_at |
| 36 | `tax_recommendations` | Both | None | -- |
| 37 | `user_tenant_access` | created_at only | 1 FK | Missing updated_at |
| 38 | `vetted_accountants` | Both | 1 FK | -- |
| 39 | `work_queue` | Both | None | -- |
| 40 | `xero_assets` | Both | 1 FK | -- |
| 41 | `xero_connections` | Both | 1 FK | -- |
| 42 | `xero_super_contributions` | Both | 1 FK | -- |

---

## Tables with Indirect/Dynamic References

These exist in DB and are referenced via computed table names in `lib/analysis/reanalysis-worker.ts`.

| # | Table | How Referenced | Status |
|---|-------|--------------|--------|
| 1 | `fuel_tax_credit_analyses` | Dynamic (BUT table name has TYPO - see bug above) | BROKEN |
| 2 | `superannuation_cap_analyses` | Dynamic in reanalysis-worker.ts:364 | OK |
| 3 | `trust_distribution_analyses` | Dynamic in reanalysis-worker.ts:361 | OK |

---

## Orphan Tables (in database, no code references)

These tables exist in the live database but have zero references in any application code.

| # | Table | Type | Columns | Recommendation |
|---|-------|------|---------|---------------|
| 1 | `government_reference_values` | Table | 11 | KEEP - useful reference data, may be needed later |
| 2 | `xero_bas_reports` | Table | 24 | KEEP - BAS data structure ready for future use |
| 3 | `xero_employees` | Table | 16 | KEEP - employee data ready for payroll features |
| 4 | `xero_inventory_items` | Table | 23 | KEEP - inventory tracking ready for future use |
| 5 | `xero_pay_runs` | Table | 17 | KEEP - payroll data ready for future use |
| 6 | `rnd_deadline_reminders` | Table | 8 | KEEP - part of R&D module, may be needed |

### Orphan Views (no action needed)

| # | View | Type | Note |
|---|------|------|------|
| 1 | `mv_cost_summary` | Materialized View | Aggregation of ai_analysis_costs |
| 2 | `rnd_deadline_summary` | View | Aggregation of rnd_registrations |
| 3 | `rnd_evidence_summary` | View | Aggregation of rnd_evidence |

---

## Missing Timestamps Summary

### Missing both created_at AND updated_at (excluding views):
- `ai_analysis_costs` (has `analyzed_at` instead)
- `organization_group_members` (has `added_at` instead)
- `rnd_checklist_templates` (reference data, acceptable)
- `rnd_evidence_scores` (has `last_calculated` instead)
- `share_access_logs` (has `accessed_at` instead)

### Missing updated_at only:
- `accountant_activity_log` (append-only log, acceptable)
- `notifications` (should have updated_at for read status)
- `purchases` (should have updated_at for refund tracking)
- `rnd_checklist_items` (should have updated_at)
- `rnd_deadline_reminders` (append-only, acceptable)
- `security_events` (append-only log, acceptable)
- `share_feedback` (should have updated_at for edits)
- `shared_reports` (should have updated_at for revocation tracking)
- `tax_alert_history` (append-only log, acceptable)
- `tax_rates_cache` (has `last_updated` instead)
- `user_tenant_access` (should have updated_at for role changes)

---

## Test-Only Table References (No Action Needed)

These tables are only referenced in test files and don't need to exist in production:

| Table | Test Files |
|-------|-----------|
| `forensic_analysis` | gemini-integration.test.ts, transactions.test.ts, xero-sync.test.ts |
| `sync_progress` | xero-sync.test.ts |
| `transaction_cache` | api-security.test.ts, database-performance.test.ts, transactions.test.ts |
| `transaction_summary` | database-performance.test.ts |
| `transactions` | api-security.test.ts |

Note: `reports` in code is a Supabase **Storage bucket**, not a table reference.

---

## Prioritised Fix List

### Priority 1: CRITICAL - Create missing tables (will cause runtime errors)

1. **`myob_connections`** - MYOB OAuth callback writes here, 7 code references across auth + sync + batch processing
2. **`accountant_findings`** - 6 accountant dashboard pages read from this, 10 total references
3. **`organization_activity_log`** - 13 references across org management, admin, and activity APIs
4. **`xero_transactions`** - 5 references in analysis routes and reanalysis worker (may need to alias to `historical_transactions_cache`)
5. **`generated_reports`** - Report generation and download routes write/read here, 7 references
6. **`xero_contacts`** - Trust distribution analysis and reanalysis worker use this, 4 references
7. **`organization_invitations`** - Invitation accept flow uses this, 3 references (was in QUICKSTART SQL but never migrated)

### Priority 2: HIGH - Create supporting tables

8. **`admin_audit_log`** - All admin audit logging silently fails, 4 references in logger.ts
9. **`abn_lookup_cache`** - ABN lookups can't cache results, 2 references
10. **`council_sessions`** - Agent council features broken, 3 references
11. **`conversion_events`** - Conversion tracking broken, 3 references
12. **`advisor_metrics`** - Advisor performance tracking broken, 2 references

### Priority 3: MEDIUM - Fix bugs + create remaining tables

13. **FIX TYPO**: `fuel_tax_credits_analyses` -> `fuel_tax_credit_analyses` in `lib/analysis/reanalysis-worker.ts:358`
14. **`consolidated_report_log`** - Consolidated report audit trail missing
15. **`user_organization_access`** - Used in consolidated report generator
16. **`xero_tenants`** - Used in share token route

### Priority 4: LOW - Add missing timestamps

17. Add `updated_at` to: `notifications`, `purchases`, `rnd_checklist_items`, `share_feedback`, `shared_reports`, `user_tenant_access`

---

## Architecture Notes

- **No ORM**: All database access is raw Supabase PostgREST calls via `.from()` pattern
- **78 SQL files** exist but many were never applied to live DB (especially `schema.sql` originals: `tax_audit_findings`, `rnd_activities`, `loss_records`, `shareholder_loans`, `audit_reports` are all defined in schema.sql but do NOT exist in live DB)
- **4 views** exist as real tables in PostgREST: `mv_cost_summary`, `recommendation_current_status`, `rnd_deadline_summary`, `rnd_evidence_summary`
- **`xero_transactions`** in code likely should reference `historical_transactions_cache` instead - this may be an intentional separate table or an oversight
- **Row Level Security** is enabled on most tables with service_role bypass policies
