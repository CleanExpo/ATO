# Project Backlog Prioritisation - Senior PM Assessment

**Date**: 2026-02-06
**Prepared By**: Senior Project Manager (Claude Opus 4.6)
**Sprint Velocity**: Very High (20 issues completed since Jan 20; 6 CRITICAL security fixes in 2 days)

---

## Executive Summary

**Just Completed** (this session):
- Removed Sentry dead code (2 Turbopack build warnings eliminated)
- Implemented Stripe webhook email notifications (purchase confirmation + payment failure)
- Migrated Stripe webhook to structured logger
- Pushed to `main` - build passing clean

**Recent Wins** (last 7 days):
- UNI-476: Production deployment live
- UNI-450-454, 460-462: 8 security/CI fixes (CRITICAL + HIGH)
- UNI-446: OAuth2 PKCE refactor
- UNI-441-445: Shopify, performance, AI, real-time infrastructure

**Current State**:
- **Build**: Clean (0 TS errors, 0 Sentry warnings)
- **Platform Coverage**: Xero + QuickBooks + MYOB (86% Australian SMB market)
- **Multi-Org**: 80% complete (DB, auth, UI - needs final 20%)
- **Security Posture**: Much improved but 2 URGENT items remain
- **Open Issues**: 50 across all projects (many are non-ATO)

---

## ATO-Specific Issue Triage

> Many Linear issues (UNI-387-421) belong to **other projects** (CCW-Online ERP, Unite-Hub).
> Below focuses exclusively on **ATO Tax Optimizer** priorities.

### Tier 0: Security (Complete Before Any Feature Work)

| # | Issue | Priority | Effort | Status |
|---|-------|----------|--------|--------|
| 1 | **UNI-449**: Rotate exposed credentials in .env.local | URGENT | 1-2h | Backlog |
| 2 | **UNI-455**: Add auth to 113 unprotected API routes | HIGH | 2-3 days | Backlog |
| 3 | **UNI-456**: Fix IDOR vulnerabilities in resource access | HIGH | 1-2 days | Backlog |

**UNI-449** is the single most important issue. Credentials committed to repo = CVSS 9.8. Must rotate ALL secrets (Stripe live keys, Supabase service role, Resend, Linear, etc.) before any feature work.

**UNI-455 + UNI-456** together mean the API surface is largely unprotected. These are prerequisites for enterprise sales.

### Tier 1: Critical Path (Highest Business ROI)

| # | Issue | Priority | Effort | Business Impact |
|---|-------|----------|--------|-----------------|
| 4 | **UNI-230**: Enterprise Multi-Organisation | URGENT | 8-12h remaining | Unlocks $50K+ contracts |
| 5 | **UNI-227**: Critical Bug Fixes | HIGH | 1-2 days | User retention |
| 6 | **UNI-222**: Data Quality & Real-Time Charts | HIGH | 3-4 days | User trust |

**UNI-230** remains the top strategic priority. 80% complete, highest ROI per hour invested. Remaining work: org-scoped platform connections, consolidated dashboard, invitation flow (invitation emails now done via Resend).

### Tier 2: Code Quality (Technical Debt)

| # | Issue | Priority | Effort | Notes |
|---|-------|----------|--------|-------|
| 7 | **UNI-459**: Fix 8 empty catch blocks | HIGH | 2-3h | Silent failures |
| 8 | **UNI-457**: Reduce `any` type usage (190 -> <50) | HIGH | 2-3 days | Type safety |
| 9 | **UNI-458**: Remove 901 console.log statements | HIGH | 1-2 days | Partially addressed (Stripe webhook migrated to structured logger) |
| 10 | **UNI-471**: Implement structured logging | MEDIUM | 1-2 days | `lib/logger.ts` exists; need to roll out to all modules |

**Note**: UNI-458 and UNI-471 overlap. Strategy should be: replace console.* with `createLogger()` calls module by module, which solves both simultaneously.

### Tier 3: Revenue Generators (Q1-Q2 2026)

| # | Issue | Priority | Effort | Revenue |
|---|-------|----------|--------|---------|
| 11 | **UNI-237**: GST Optimisation Module | HIGH | 2-3 weeks | $199/customer |
| 12 | **UNI-236**: CGT Module | HIGH | 3-4 weeks | $299/customer |
| 13 | **UNI-235**: Continuous Monitoring | HIGH | 2 weeks | Subscription retention |
| 14 | **UNI-234**: Natural Language Queries | HIGH | 2-3 weeks | Differentiation |

### Tier 4: Platform Polish (Q2 2026)

| # | Issue | Priority | Effort | Notes |
|---|-------|----------|--------|-------|
| 15 | **UNI-470**: Fix API contract mismatches | MEDIUM | 1-2 days | Integration reliability |
| 16 | **UNI-469**: Add transaction boundaries | MEDIUM | 1 day | Data integrity |
| 17 | **UNI-468**: Add health check endpoint | MEDIUM | 2-3h | Monitoring |
| 18 | **UNI-466**: Increase test coverage (5.3% -> 30%) | MEDIUM | 1-2 weeks | Confidence |
| 19 | **UNI-465**: Decompose 5 large pages | MEDIUM | 3-5 days | Maintainability |
| 20 | **UNI-464**: Decompose 10 large components | MEDIUM | 3-5 days | Maintainability |

### Tier 5: Nice-to-Have (Q2-Q3 2026)

| # | Issue | Priority | Effort | Notes |
|---|-------|----------|--------|-------|
| 21 | **UNI-475**: Address 19 TODO/FIXME comments | LOW | 1-2 days | Cleanup |
| 22 | **UNI-474**: Add ARIA labels to interactive elements | LOW | 1 day | Accessibility |
| 23 | **UNI-473**: Add missing alt texts to images | LOW | 2-3h | Accessibility |
| 24 | **UNI-472**: Replace deprecated packages | LOW | 2-3h | Maintenance |
| 25 | **UNI-233**: Mobile Apps (iOS/Android) | URGENT | 12 weeks | Deferred to Q2-Q3 |

### Non-ATO Issues (Deprioritise / Reassign)

The following issues in the backlog belong to **other projects** and should not block ATO work:

- UNI-387 to UNI-421 (AP2, POS, Inventory, Orders, Containers, Portal Auth, etc.) - **CCW-Online ERP**
- UNI-83 to UNI-87 (Synthex white-label, GBP, content queue) - **Unite-Hub/Synthex**
- UNI-182, UNI-183 (Property Owner Portal, Contractor Directory) - **Unite-Hub**
- UNI-447 (Forensic Audit syntax error) - **CCW-Online**
- UNI-463 (Docker default credentials) - **CCW-Online**

**Recommendation**: Move these to their respective project boards or label them clearly to avoid confusion.

---

## Recommended Sprint Plan

### Sprint 1 (This Week): Security + Quick Wins

**Sprint Goal**: Eliminate critical security exposure, close the Sentry/email gaps

| Day | Task | Issue | Effort |
|-----|------|-------|--------|
| 1 | Rotate ALL exposed credentials | UNI-449 | 1-2h |
| 1-2 | Add auth middleware to unprotected routes | UNI-455 | 8-12h |
| 2-3 | Fix IDOR vulnerabilities | UNI-456 | 4-8h |
| 3 | Fix 8 empty catch blocks | UNI-459 | 2-3h |

**Exit Criteria**: All API routes require auth, resource ownership verified, credentials rotated.

### Sprint 2 (Next Week): Enterprise Multi-Org

**Sprint Goal**: Launch multi-org, enable $50K+ contracts

| Day | Task | Issue | Effort |
|-----|------|-------|--------|
| 1-2 | Add org_id to platform connections, update OAuth callbacks | UNI-230 | 4-6h |
| 3 | Consolidated dashboard + org switcher | UNI-230 | 4-6h |
| 4 | End-to-end testing + deploy | UNI-230 | 2-3h |
| 5 | Bug audit + top 5 fixes | UNI-227 | 4-6h |

**Exit Criteria**: Multi-org 100% complete, enterprise-ready, top bugs squashed.

### Sprint 3 (Week 3-4): Quality + Data

**Sprint Goal**: Production polish, data quality, observability

| Task | Issue | Effort |
|------|-------|--------|
| Structured logging rollout | UNI-458 + UNI-471 | 2-3 days |
| Reduce `any` types | UNI-457 | 2-3 days |
| Data quality + real-time charts | UNI-222 | 3-4 days |
| Health check endpoint | UNI-468 | 2-3h |

---

## Key Metrics

| Metric | Current | Sprint 1 Target | Sprint 2 Target |
|--------|---------|-----------------|-----------------|
| Open CRITICAL issues | 1 (UNI-449) | 0 | 0 |
| Authenticated API routes | ~23% | 100% | 100% |
| Multi-org completion | 80% | 80% | 100% |
| Build warnings | 0 | 0 | 0 |
| Structured logging coverage | ~10% | ~10% | ~50% |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Exposed credentials exploited | HIGH | CRITICAL | **Rotate immediately** (UNI-449) |
| Unauthed API routes accessed | MEDIUM | HIGH | Auth middleware sprint 1 |
| Enterprise deal lost (no multi-org) | MEDIUM | HIGH | Sprint 2 completion |
| Technical debt compounds | LOW | MEDIUM | Dedicated sprint 3 |

---

## Decision Points for Stakeholder

1. **UNI-449 credential rotation**: Should we also rotate the Supabase service role key? This requires updating the Vercel production environment too.
2. **Auth middleware approach**: Global middleware vs per-route checks? Global is faster to implement but less granular.
3. **Multi-org billing**: Stripe integration for per-org billing or flat enterprise pricing?
4. **GST/CGT modules**: Start design in Sprint 3 or defer to Q2?

---

**Prepared By**: Senior Project Manager (Claude Opus 4.6)
**Next Review**: Friday, February 13, 2026
**Last Updated**: 2026-02-06
