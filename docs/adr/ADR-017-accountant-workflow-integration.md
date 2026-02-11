# ADR-017: Accountant Workflow Integration Architecture

**Status**: Accepted
**Date**: 2026-01-30
**Updated**: 2026-02-11
**Deciders**: Specialist A (Architecture), Senior PM, Tax Agent
**Linear Issue**: [UNI-278](https://linear.app/unite-hub/issue/UNI-278)

---

## Context and Problem Statement

Accountants need an intelligent system that integrates seamlessly with their daily workflow across 6 key areas: Sundries inputs, General deductions (Section 8-1), FBT, Division 7A, Source documents, and Reconciliation. The system must **add value without replacing professional judgment**.

**Core Challenge**: How do we provide AI-powered tax analysis and recommendations while preserving the accountant's role as the final decision-maker?

---

## Decision Drivers

1. **Accountant Authority**: Accountant must retain 100% decision-making power
2. **Daily Workflow Integration**: System must fit into existing work patterns, not disrupt them
3. **Trust & Transparency**: All recommendations must include legislation references and confidence scores
4. **Actionability**: Recommendations must be specific and immediately actionable
5. **Compliance**: Must not create liability for incorrect tax advice
6. **Performance**: Must not slow down accountant's workflow (<2s response times)

---

## Considered Options

### Option 1: Standalone Dashboard (Chosen)
Separate dashboard that accountants check periodically for insights and recommendations.

**Pros**:
- Non-intrusive to existing workflow
- Accountant controls when to review
- Comprehensive view of all findings
- Easy to implement

**Cons**:
- Requires accountants to remember to check
- Might be ignored during busy periods

### Option 2: Xero Add-on Integration
Direct integration into Xero UI with flags and annotations.

**Pros**:
- Zero workflow disruption
- Sees insights during normal work

**Cons**:
- Requires Xero App Store approval (long process)
- Complex integration, higher risk
- Limited control over UI/UX

### Option 3: Email Digest System
Automated emails with findings sent weekly/monthly.

**Pros**:
- Familiar medium (email)
- No login required

**Cons**:
- Email fatigue
- Lacks interactivity
- Difficult to track status

---

## Decision Outcome

**Chosen Option**: **Option 1 - Standalone Dashboard** with smart notifications for high-value findings.

**Rationale**:
- Fastest to implement and test
- Full control over UX
- Can add Xero integration later (Phase 2)
- Notifications solve the "remember to check" problem
- Aligns with existing ATO dashboard architecture

**Implementation Note**: Findings use `organization_id` (UUID FK to `organizations` table) rather than `tenant_id` for scoping. The `tenant_id` (Xero org ID) is resolved to `organization_id` via the `xero_connections` table at generation time. This ensures findings are tied to the platform's organisation model, not directly to Xero tenant identifiers.

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 ACCOUNTANT WORKFLOW SYSTEM                  │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐       ┌─────▼──────┐      ┌────▼─────┐
   │ 6-Area  │       │  Forensic  │      │Accountant│
   │Dashboard│       │ to Findings│      │ Vetting  │
   │         │       │   Mapper   │      │ Pipeline │
   └────┬────┘       └─────┬──────┘      └────┬─────┘
        │                  │                   │
        └──────────────────┼───────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌─────▼──────┐    ┌────▼─────┐
   │ Xero    │      │ Confidence │    │Legislation│
   │Forensic │      │  Scorer    │    │  Linker  │
   │Analyzer │      │            │    │          │
   └────┬────┘      └─────┬──────┘    └────┬─────┘
        │                  │                 │
        └──────────────────┼─────────────────┘
                           │
                      ┌────▼────┐
                      │Supabase │
                      │Database │
                      └─────────┘
```

---

## Forensic-to-Findings Mapper

**Source**: `lib/accountant/forensic-findings-mapper.ts`
**Endpoint**: `POST /api/accountant/findings/generate`

The forensic-to-findings mapper is the bridge between the AI forensic analysis pipeline (Gemini) and the accountant workflow dashboard. It transforms rows from `forensic_analysis_results` into actionable `accountant_findings` records.

### Priority-Based Routing

Each forensic analysis row is routed to exactly one workflow area using a first-match-wins priority system (7 levels):

| Priority | Condition | Workflow Area | Rationale |
|----------|-----------|---------------|-----------|
| 1 | `is_rnd_candidate` OR `meets_div355_criteria` | `sundries` | R&D/Division 355 has highest financial impact (43.5% offset) |
| 2 | `division7a_risk` | `div7a` | Compliance risk — deemed dividends |
| 3 | `fbt_implications` | `fbt` | FBT liability at 47% rate |
| 4 | `requires_documentation` | `documents` | Missing substantiation (s 900-70) |
| 5 | `is_fully_deductible` AND `deduction_confidence < 80` | `deductions` | Low-confidence deductions need review |
| 6 | `category_confidence < 50` | `reconciliation` | Potential misclassification |
| 7 | None of the above | *(skipped)* | Not an actionable finding |

### Confidence Scoring Algorithm

Confidence is calculated as a weighted average of available factors:

| Factor | Weight | Source Field | Positive Threshold |
|--------|--------|-------------|-------------------|
| Category classification | 40% | `category_confidence` | >= 70% |
| R&D eligibility (if applicable) | 25% | `rnd_confidence` | >= 70% |
| Deduction confidence (if available) | 20% | `deduction_confidence` | >= 70% |
| Documentation completeness | 15% | `requires_documentation` | `false` = positive |

**Score formula**: `weighted_sum / total_weight` (normalised across available factors)

**Level thresholds**:
- **High**: score >= 80
- **Medium**: score >= 60
- **Low**: score < 60

### Benefit Estimation Formulas

Each workflow area uses a specific formula to estimate the financial benefit:

| Area | Formula | Legislation |
|------|---------|-------------|
| `sundries` | `claimable_amount * 0.435` | Division 355 ITAA 1997 (43.5% R&D offset) |
| `deductions` | `claimable_amount * 0.25` | s 23AA ITAA 1997 (25% small business rate) |
| `fbt` | `transaction_amount * 0.47` | FBTAA 1986 (47% FBT rate) |
| `div7a` | `transaction_amount * 1.0` | Division 7A ITAA 1936 (full deemed dividend) |
| `documents` | `0` | Compliance item, no direct monetary benefit |
| `reconciliation` | `claimable_amount * 0.25` | Potential misclassification recovery at 25% |

### Deduplication Strategy

Before inserting, the mapper checks for existing findings using a composite key:

```
transaction_id + organization_id + workflow_area
```

This ensures:
- Re-running the mapper is safe (idempotent)
- The same transaction is not flagged twice for the same area
- Different workflow areas for the same transaction are allowed (e.g., an R&D candidate that also requires documentation)

---

## Accountant Vetting Pipeline

**Migration**: `supabase/migrations/20260129_accountant_vetting_system.sql`

The vetting pipeline manages accountant partner onboarding:

### Flow

```
Apply → Verify → Pricing → Onboarded
```

1. **Apply** (`POST /api/accountant/apply`): Accountant submits application with credentials (CPA, CA, RTA, BAS Agent, FTA). Zod-validated. Duplicate detection by email. Activity logged.

2. **Verify** (`GET /api/accountant/verify?email=`): Check if an email belongs to a vetted accountant. Returns `is_vetted` boolean and accountant details.

3. **Pricing** (`GET /api/accountant/pricing?email=`): Returns wholesale vs standard pricing. Vetted accountants receive 50% discount ($495 vs $995).

4. **Application Status** (`GET /api/accountant/application/{id}`): Check application status by UUID.

### Database Tables

- `accountant_applications` — Application lifecycle (`pending → under_review → approved/rejected`)
- `vetted_accountants` — Fast lookup for approved partners with discount rates
- `accountant_activity_log` — Full audit trail

---

## Component Design

### 1. Six-Area Dashboard

**Purpose**: Central hub for accountants to review findings across all workflow areas.

**Areas**:
1. **Sundries** (`/dashboard/accountant/sundries`) — R&D candidates, reclassification suggestions
2. **Deductions** (`/dashboard/accountant/deductions`) — Section 8-1 deduction scanner
3. **FBT** (`/dashboard/accountant/fbt`) — Fringe Benefits Tax calculator
4. **Division 7A** (`/dashboard/accountant/div7a`) — Shareholder loan tracker
5. **Documents** (`/dashboard/accountant/documents`) — Missing documentation flagging
6. **Reconciliation** (`/dashboard/accountant/reconciliation`) — Forensic anomaly detection

### 2. Smart Notification Engine (Planned — Phase 2)

**Purpose**: Alert accountants to high-value findings without requiring constant dashboard checking.

**Status**: Not yet implemented. Currently mitigated by dashboard summary statistics that highlight high-value finding counts.

**Planned Notification Triggers**:
- High Value: Opportunity > $50,000
- Compliance Risk: Non-compliant Division 7A loans, FBT exposure
- Deadline Approaching: R&D registration due within 30 days
- Critical Anomaly: Forensic analysis detects significant discrepancy

### 3. Client Report Generator (Planned — Phase 3)

**Purpose**: Create customisable, professional reports for client delivery.

**Status**: Not yet implemented.

### 4. Confidence Scoring System

**Purpose**: Quantify certainty of recommendations to help accountants prioritise.

**Endpoint**: `POST /api/accountant/confidence-score`

Two scoring approaches are implemented:
- **Mapper confidence**: Weighted multi-factor scoring (see Forensic-to-Findings Mapper section above)
- **Standalone confidence**: Factor-based additive scoring for ad-hoc calculations via the API endpoint

### 5. Legislation Linker

**Purpose**: Provide instant access to relevant tax legislation for every recommendation.

Each finding includes an array of `legislation_refs` with section, act, and relevance description. References are determined by workflow area (see `getLegislationRefs()` in the mapper).

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Accountant findings CRUD | **Implemented** | `GET/POST /api/accountant/findings`, `PATCH /api/accountant/findings/{id}/status` |
| Forensic-to-findings mapper | **Implemented** | `POST /api/accountant/findings/generate`, `lib/accountant/forensic-findings-mapper.ts` |
| Accountant vetting pipeline | **Implemented** | Apply, verify, pricing, application status endpoints |
| Confidence score calculator | **Implemented** | `POST /api/accountant/confidence-score` |
| Finding status workflow | **Implemented** | `pending → approved/rejected/deferred` with email notifications on approval |
| Notification system | **Not implemented** | Planned Phase 2. Current mitigation: dashboard summary stats |
| Report generator | **Not implemented** | Planned Phase 3 |
| Legislation lookup endpoint | **Not implemented** | Planned. Legislation refs are embedded in findings via mapper |

### Implemented API Endpoints (8 total)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/accountant/findings` | List findings with filters |
| `POST` | `/api/accountant/findings` | Create finding |
| `POST` | `/api/accountant/findings/generate` | Run forensic-to-findings mapper |
| `PATCH` | `/api/accountant/findings/{id}/status` | Update finding status (approve/reject/defer) |
| `POST` | `/api/accountant/confidence-score` | Calculate confidence score |
| `POST` | `/api/accountant/apply` | Submit partner application |
| `GET` | `/api/accountant/verify` | Check vetted accountant status |
| `GET` | `/api/accountant/pricing` | Get accountant pricing |
| `GET` | `/api/accountant/application/{id}` | Check application status |

---

## Database Schema

See [accountant-workflow-erd.md](../diagrams/accountant-workflow-erd.md) for the complete ERD.

Key table: `accountant_findings` — uses `organization_id` (UUID FK) for scoping, not `tenant_id`. Status enum: `pending | approved | rejected | deferred`.

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript | Existing stack, SSR support |
| **Styling** | Tailwind CSS 4 | Existing, rapid development |
| **State** | React Query + Context | Server state + local state |
| **Database** | Supabase (PostgreSQL) | Existing, RLS support |
| **AI Analysis** | Google Gemini 2.0 Flash | Existing, forensic analysis |

---

## Risk Assessment

See [accountant-workflow-risk-assessment.md](../risk/accountant-workflow-risk-assessment.md) for the full risk assessment covering the implemented system.

---

## Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Dashboard Load Time | < 2s | User perception threshold |
| Finding Retrieval | < 500ms | Feels instant |
| Confidence Scoring | < 1s | Acceptable for calculation |
| Findings Generation | < 30s | Batch processing of forensic results |

---

## Consequences

### Positive

- **Accountant Efficiency**: Faster identification of opportunities
- **Client Value**: More deductions and credits claimed
- **Risk Reduction**: Compliance monitoring prevents penalties
- **Professional Authority**: Accountant remains decision-maker
- **Scalability**: Dashboard can handle unlimited findings
- **Extensibility**: Easy to add new workflow areas

### Negative

- **Learning Curve**: Accountants need to learn new interface
- **Change Management**: Requires process adjustment
- **Dependency**: Relies on accurate Xero data

---

## Future Enhancements (Out of Scope)

**Phase 2** (Notification System):
- In-app badge notifications for high-value findings
- Email digest (daily/weekly, configurable)
- Slack/Teams integration

**Phase 3** (Report Generator):
- PDF report generation
- Accountant branding and customisation
- Email delivery to clients

**Phase 4** (if successful):
- Xero Add-on integration (direct UI flags)
- Mobile app for on-the-go review
- AI chat assistant for questions
- Multi-tenant agency view

---

## Related Documents

- [UNI-277: Parent Issue](https://linear.app/unite-hub/issue/UNI-277)
- [UNI-278: Architecture & Design](https://linear.app/unite-hub/issue/UNI-278)
- [OpenAPI Spec](../api-specs/accountant-workflow.yaml)
- [System Diagrams](../diagrams/accountant-workflow-system.md)
- [Database ERD](../diagrams/accountant-workflow-erd.md)
- [Risk Assessment](../risk/accountant-workflow-risk-assessment.md)

---

**Status**: Accepted
**Created By**: Specialist A (Architecture & Design)
**Date**: 2026-01-30
**Updated**: 2026-02-11 (synced with implementation per commit 927de1a)
