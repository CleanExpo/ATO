# Accountant Workflow Risk Assessment

**Document Version**: 1.1
**Created**: 2026-02-11
**Linear Issue**: [UNI-278](https://linear.app/unite-hub/issue/UNI-278)
**ADR**: [ADR-017](../adr/ADR-017-accountant-workflow-integration.md)
**Assessment Period**: FY2024-25
**Next Review**: 2026-05-11 (quarterly)

---

## 1. Executive Summary

This risk assessment covers risks specific to the **implemented** accountant workflow system: the forensic-to-findings mapper, findings CRUD, accountant vetting pipeline, and the 8 API endpoints currently in production.

**Scope**: Risks arising from the mapper logic, confidence scoring, benefit estimation, deduplication, tenant resolution, and the absence of notification/report features.

**Methodology**: 5x5 likelihood/impact grid aligned with the project compliance audit (2026-02-07). Risks are identified from code review of `lib/accountant/forensic-findings-mapper.ts`, the `accountant_findings` migration, and all `app/api/accountant/**/route.ts` files.

---

## 2. Risk Matrix

```
              LIKELIHOOD
              Rare(1)  Unlikely(2)  Possible(3)  Likely(4)  Almost Certain(5)
IMPACT
Catastrophic(5)  MED      HIGH        HIGH        CRIT       CRIT
Major(4)         MED      MED         HIGH        HIGH       CRIT
Moderate(3)      LOW      MED         MED         HIGH       HIGH
Minor(2)         LOW      LOW         MED         MED        HIGH
Insignificant(1) LOW      LOW         LOW         MED        MED
```

**Rating definitions**:
- **CRITICAL**: Immediate action required. Unacceptable residual risk.
- **HIGH**: Mitigation plan must be in place before feature is used in production.
- **MEDIUM**: Mitigations should be implemented within 30 days.
- **LOW**: Accept and monitor.

---

## 3. Identified Risks

### R-1: Mapper Routes Finding to Wrong Workflow Area

| Field | Value |
|-------|-------|
| **ID** | R-1 |
| **Risk** | Mapper routes finding to wrong workflow area |
| **Likelihood** | Possible (3) |
| **Impact** | Major (4) |
| **Rating** | **HIGH** |
| **Category** | Technical — Mapper Logic |

**Description**: The priority-based routing in `determineWorkflowArea()` uses a first-match-wins strategy. If a transaction triggers multiple flags (e.g., both `is_rnd_candidate` AND `division7a_risk`), only the highest-priority match is used. This could cause an accountant to miss a secondary compliance risk.

**Mitigation**:
1. Priority ordering is explicit and documented (7 levels, first match wins)
2. Accountant can manually review all findings and see the `reasoning` field explaining why a particular area was chosen
3. Human review via approve/reject workflow catches misrouted findings
4. `suggested_action` text includes area-specific guidance that would appear incorrect if misrouted, serving as a natural cross-check

**Residual Risk**: MEDIUM — routing is deterministic and transparent; accountant is final arbiter.

---

### R-2: Confidence Score Misleads Accountant

| Field | Value |
|-------|-------|
| **ID** | R-2 |
| **Risk** | Confidence score misleads accountant into trusting or dismissing a finding incorrectly |
| **Likelihood** | Possible (3) |
| **Impact** | Major (4) |
| **Rating** | **HIGH** |
| **Category** | Technical — Confidence Scoring |

**Description**: The weighted confidence scoring algorithm (category 40%, R&D 25%, deduction 20%, docs 15%) may produce artificially high or low scores depending on which factors are available. A transaction with only one factor available may score based on that single factor's weight, giving false precision.

**Mitigation**:
1. Score is normalised by `total_weight` of available factors (not the theoretical maximum), preventing sparse-factor inflation
2. "Low" label is applied for scores < 60, flagging uncertain findings
3. `confidence_factors` array is stored with each finding, allowing the accountant to inspect the breakdown
4. Professional review flag for findings with `estimated_benefit > $50,000`
5. `confidence_level` is displayed prominently alongside the numeric score

**Residual Risk**: MEDIUM — transparency of factor breakdown allows informed professional judgment.

---

### R-3: Duplicate Findings After Re-Run

| Field | Value |
|-------|-------|
| **ID** | R-3 |
| **Risk** | Re-running the mapper creates duplicate findings |
| **Likelihood** | Unlikely (2) |
| **Impact** | Moderate (3) |
| **Rating** | **MEDIUM** |
| **Category** | Technical — Data Integrity |

**Description**: If the `/api/accountant/findings/generate` endpoint is called multiple times for the same tenant and financial year, duplicate findings could be created, inflating counts and benefit estimates.

**Mitigation**:
1. Composite deduplication key: `transaction_id + organization_id + workflow_area`
2. Existing findings are fetched before insertion; duplicates are skipped (not upserted)
3. Within-batch deduplication prevents duplicates even in a single run
4. The `GenerateResult` response reports `skipped` count so the caller knows how many were deduplicated

**Residual Risk**: LOW — deduplication is implemented at both database and application levels.

---

### R-4: Missing Forensic Data Produces Incomplete Findings

| Field | Value |
|-------|-------|
| **ID** | R-4 |
| **Risk** | Null or missing fields in `forensic_analysis_results` produce findings with misleading defaults |
| **Likelihood** | Possible (3) |
| **Impact** | Moderate (3) |
| **Rating** | **MEDIUM** |
| **Category** | Technical — Data Quality |

**Description**: The forensic analysis pipeline (Gemini AI) may leave fields null (e.g., `category_confidence`, `deduction_confidence`, `transaction_amount`). The mapper uses null-safe defaults (`?? 50`, `?? 0`) which could produce findings that appear more or less confident than warranted.

**Mitigation**:
1. Null-safe defaults are conservative (e.g., `category_confidence ?? 50` defaults to medium, not high)
2. Rows with no actionable flags (no R&D, no Div7A, no FBT, no docs issue, adequate confidence) return `null` from `determineWorkflowArea()` and are skipped entirely
3. `transaction_date` defaults to current date if null, preventing insertion failure
4. The `reasoning` field explicitly names which data was used, enabling review

**Residual Risk**: LOW — null handling is conservative and transparent.

---

### R-5: organization_id Resolution Fails (Disconnected Xero)

| Field | Value |
|-------|-------|
| **ID** | R-5 |
| **Risk** | Mapper fails because `xero_connections` has no matching `organization_id` for the given `tenant_id` |
| **Likelihood** | Unlikely (2) |
| **Impact** | Major (4) |
| **Rating** | **MEDIUM** |
| **Category** | Technical — Integration |

**Description**: The `/api/accountant/findings/generate` endpoint resolves `tenant_id` to `organization_id` via the `xero_connections` table. If the Xero connection has been removed or the `organization_id` column is null, the mapper cannot proceed.

**Mitigation**:
1. Pre-check in the API route: queries `xero_connections` first and returns a clear error: "No Xero connection found for this tenant. Connect a Xero organisation first."
2. Separate error message for null `organization_id`: "Xero connection has no linked organisation. Re-connect your Xero account."
3. Both error paths return HTTP 400 with actionable messages before any mapper logic runs

**Residual Risk**: LOW — fail-fast with clear error messages.

---

### R-6: Benefit Estimation Inaccurate (Wrong Tax Rates)

| Field | Value |
|-------|-------|
| **ID** | R-6 |
| **Risk** | `estimateBenefit()` uses hardcoded tax rates that may not match the applicable financial year |
| **Likelihood** | Possible (3) |
| **Impact** | Major (4) |
| **Rating** | **HIGH** |
| **Category** | Compliance — Tax Accuracy |

**Description**: Benefit estimation uses fixed rates: 43.5% (R&D), 25% (small business), 47% (FBT), 100% (Div7A). These rates are correct for FY2024-25 but may change in future years. The mapper does not check which FY the transaction belongs to before applying rates.

**Mitigation**:
1. Tax rate provenance tracking (AD-5): rates are documented per formula with legislation references in code comments
2. Fallback rates are documented per FY in the codebase (see CLAUDE.md tax rate cheat sheet)
3. All estimated benefits are labelled "Est." in the UI and dashboard
4. `estimated_benefit` is a separate field from `amount`, making it clear this is a calculation, not source data
5. Professional review is expected before any action — the TaxDisclaimer appears on all pages

**Residual Risk**: MEDIUM — rates are correct for current FY; FY-aware rate lookup is tracked for future improvement.

---

### R-7: Accountant Acts on AI Finding Without Professional Review

| Field | Value |
|-------|-------|
| **ID** | R-7 |
| **Risk** | Accountant treats AI-generated findings as definitive advice and acts without professional review |
| **Likelihood** | Possible (3) |
| **Impact** | Catastrophic (5) |
| **Rating** | **CRITICAL** |
| **Category** | Compliance — TASA / Professional Liability |

**Description**: The system generates findings that include dollar estimates, legislation references, and suggested actions. An accountant might approve findings en masse without applying professional judgment, leading to incorrect tax positions for clients.

**Mitigation**:
1. **TaxDisclaimer** component rendered on all accountant dashboard pages (TASA 2009 reference, "not a registered tax/BAS agent" statement)
2. All findings default to `status: 'pending'` — nothing is auto-approved
3. `estimated_benefit` is labelled "Est." throughout the UI
4. Professional review flag: findings with benefit > $50,000 require extra scrutiny (documented in confidence scoring)
5. Explicit approve/reject/defer workflow forces a conscious decision per finding
6. `accountant_notes` field encourages documenting professional reasoning
7. Email notification on approval creates an audit trail

**Residual Risk**: MEDIUM — systemic controls enforce human review, but cannot guarantee quality of that review.

---

### R-8: Multi-Tenant Data Leakage via Findings

| Field | Value |
|-------|-------|
| **ID** | R-8 |
| **Risk** | Findings for one organisation are visible to users of another organisation |
| **Likelihood** | Rare (1) |
| **Impact** | Catastrophic (5) |
| **Rating** | **HIGH** |
| **Category** | Security — Data Isolation |

**Description**: If RLS policies are misconfigured or the admin client is used incorrectly, findings scoped to one `organization_id` could leak to another organisation's users.

**Mitigation**:
1. RLS policies on `accountant_findings` use `organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())`
2. The mapper uses `createAdminClient()` only for cross-table joins (resolving `xero_connections` → `organization_id`), never for returning data to the user
3. All user-facing queries go through the service client with RLS enforced
4. `organization_id` scoping is enforced at the database level, not just the application level

**Residual Risk**: LOW — RLS provides database-level enforcement independent of application logic.

---

### R-9: Stale Findings After Re-Analysis

| Field | Value |
|-------|-------|
| **ID** | R-9 |
| **Risk** | After forensic re-analysis, old findings remain alongside new ones with different conclusions |
| **Likelihood** | Possible (3) |
| **Impact** | Moderate (3) |
| **Rating** | **MEDIUM** |
| **Category** | Operational — Data Lifecycle |

**Description**: If forensic analysis is re-run and produces different results (e.g., after data correction), the existing findings are not updated or replaced. The deduplication logic skips existing findings, so old and new conclusions coexist.

**Mitigation**:
1. Re-running the mapper is safe — deduplication skips existing `transaction_id + organization_id + workflow_area` combinations
2. Accountants can reject stale findings individually via the status workflow
3. Manual refresh: dashboard provides the "Generate Findings" button for explicit re-runs
4. Future enhancement: add a "regenerate" mode that replaces `pending` findings for a given FY

**Residual Risk**: MEDIUM — accountant can manage stale findings manually, but no automated staleness detection.

---

### R-10: Notification System Absence Delays High-Value Finding Review

| Field | Value |
|-------|-------|
| **ID** | R-10 |
| **Risk** | Without notifications, high-value findings sit unreviewed because accountants forget to check the dashboard |
| **Likelihood** | Likely (4) |
| **Impact** | Moderate (3) |
| **Rating** | **HIGH** |
| **Category** | Operational — Feature Gap |

**Description**: The notification system is planned for Phase 2 but is not yet implemented. Accountants must proactively visit the dashboard to discover new findings. High-value findings (>$50K) may be delayed.

**Mitigation**:
1. **Phase 2 priority**: Notification system is the next planned feature
2. **Current mitigation**: Dashboard summary statistics highlight the count and total value of pending high-value findings prominently
3. The "Generate Findings" endpoint returns a summary (`created`, `skipped`, `byArea`) that can be shown to the accountant immediately after generation
4. Email notification is already implemented for finding *approval* (via `sendAlertEmail`), providing a partial notification path

**Residual Risk**: HIGH — until notification system is implemented, discovery relies on accountant discipline.

---

## 4. Compliance Cross-Reference

The following findings from the project compliance audit (2026-02-07) are relevant to the accountant workflow:

| Audit Finding | Relevance to Accountant Workflow | Status |
|---------------|----------------------------------|--------|
| D-1: Entertainment deductibility oversimplified | Mapper does not distinguish entertainment sub-types — routed to `deductions` area for manual review | Tracked |
| D-3: Base rate entity passive income test | Benefit estimation uses flat 25% small business rate — may be incorrect for passive income entities | Tracked |
| T-1: Section 100A family dealing exclusion | Trust findings routed via mapper — family dealing exclusion now implemented in trust analyzer | FIXED |
| T-2: Trustee penalty rate 47% | FBT benefit estimation uses 47% — consistent with corrected trustee rate | FIXED |
| B-1: Share password in POST body | Not directly relevant to findings but affects shared report security | FIXED |
| B-6: RLS function standardised | Findings RLS uses `organization_members` join, consistent with standardised pattern | FIXED |

---

## 5. Residual Risk Summary

After mitigations:

| Rating | Count | Risks |
|--------|-------|-------|
| **HIGH** | 1 | R-10 (notification absence) |
| **MEDIUM** | 5 | R-1, R-2, R-6, R-7, R-9 |
| **LOW** | 4 | R-3, R-4, R-5, R-8 |

**Overall residual risk**: **MEDIUM** — the system is functional and safe for use with accountant oversight, but the absence of notifications (R-10) is the primary gap requiring Phase 2 implementation.

---

## 6. Review Schedule

- **Quarterly review**: Every 90 days or upon major feature additions
- **Triggered review**: When notification system (Phase 2) or report generator (Phase 3) is implemented
- **Annual full reassessment**: Aligned with FY boundary (1 July)

**Next scheduled review**: 2026-05-11

---

**Document Owner**: Specialist A (Architecture)
**Approved By**: Senior PM
