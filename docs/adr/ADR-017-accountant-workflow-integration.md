# ADR-017: Accountant Workflow Integration Architecture

**Status**: Proposed
**Date**: 2026-01-30
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
   │ 6-Area  │       │   Smart    │      │  Client  │
   │Dashboard│       │Notification│      │  Report  │
   │         │       │   Engine   │      │ Generator│
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

## Component Design

### 1. Six-Area Dashboard

**Purpose**: Central hub for accountants to review findings across all workflow areas.

**Areas**:
1. **Sundries** (`/dashboard/accountant/sundries`)
   - Miscellaneous transactions flagged for R&D potential
   - Reclassification suggestions

2. **Deductions** (`/dashboard/accountant/deductions`)
   - Section 8-1 deduction scanner
   - Missed deduction opportunities

3. **FBT** (`/dashboard/accountant/fbt`)
   - Fringe Benefits Tax calculator
   - Trigger detection (car benefits, entertainment)

4. **Division 7A** (`/dashboard/accountant/div7a`)
   - Shareholder loan tracker
   - Compliance monitoring (8.77% benchmark)

5. **Documents** (`/dashboard/accountant/documents`)
   - Missing documentation flagging
   - Document requirement generator

6. **Reconciliation** (`/dashboard/accountant/reconciliation`)
   - Forensic anomaly detection
   - Multi-year consistency validation

**Design Pattern**: Each area follows consistent structure:
```tsx
<WorkflowArea
  title="Area Name"
  findings={findings}
  confidenceScorer={scorer}
  legislationLinker={linker}
  onReview={handleReview}
  onApprove={handleApprove}
  onReject={handleReject}
/>
```

---

### 2. Smart Notification Engine

**Purpose**: Alert accountants to high-value findings without requiring constant dashboard checking.

**Notification Triggers**:
- **High Value**: Opportunity > $50,000
- **Compliance Risk**: Non-compliant Division 7A loans, FBT exposure
- **Deadline Approaching**: R&D registration due within 30 days
- **Critical Anomaly**: Forensic analysis detects significant discrepancy

**Notification Channels**:
- **In-App**: Badge count on dashboard nav
- **Email Digest**: Daily/weekly summary (configurable)
- **Future**: SMS/Slack integration (Phase 2)

**Priority Levels**:
- 🔴 **Critical**: Immediate action required (compliance risk)
- 🟠 **High**: High-value opportunity (>$50K)
- 🟡 **Medium**: Standard findings
- 🔵 **Info**: FYI, no action needed

---

### 3. Client Report Generator

**Purpose**: Create customizable, professional reports for client delivery.

**Workflow**:
```
1. Accountant reviews findings in dashboard
2. Selects findings to include in report
3. Previews report with customization options
4. Adds accountant notes/commentary
5. Approves report for sending
6. System generates PDF + sends via email
```

**Report Sections**:
- **Executive Summary**: Key findings and value
- **Detailed Findings**: By category (Deductions, R&D, etc.)
- **Legislation References**: Supporting tax law citations
- **Action Items**: What client should do next
- **Accountant Commentary**: Professional review notes

**Customization Options**:
- Include/exclude specific findings
- Add custom sections
- Adjust tone (formal/conversational)
- Branding (logo, colours)

---

### 4. Confidence Scoring System

**Purpose**: Quantify certainty of recommendations to help accountants prioritize.

**Scoring Algorithm**:
```typescript
interface ConfidenceScore {
  score: number; // 0-100
  level: 'High' | 'Medium' | 'Low';
  factors: ConfidenceFactor[];
}

interface ConfidenceFactor {
  name: string;
  impact: number; // -50 to +50
  reasoning: string;
}
```

**Confidence Factors**:
- **Legislation Match** (+50): Direct match to tax legislation
- **Precedent Cases** (+30): ATO rulings support claim
- **Documentation Quality** (+20): Strong supporting documents
- **Amount Threshold** (-10): Large claims increase risk
- **Complexity** (-20): Novel or complex interpretations
- **Ambiguity** (-30): Unclear application of law

**Score Interpretation**:
- **90-100 (High)**: Strong legislative support, low risk
- **60-89 (Medium)**: Reasonable claim, standard due diligence needed
- **0-59 (Low)**: Complex case, may require ATO private ruling

---

### 5. Legislation Linker

**Purpose**: Provide instant access to relevant tax legislation for every recommendation.

**Features**:
- **Deep Links**: Direct links to specific sections (e.g., Section 8-1 ITAA 1997)
- **Hover Tooltips**: Quick summary without leaving page
- **Full Text**: Complete section text available
- **Related Provisions**: Links to related legislation
- **ATO Guidance**: Links to relevant ATO rulings and guidance

**Link Format**:
```tsx
<LegislationLink
  section="Section 8-1"
  act="ITAA 1997"
  url="https://www.ato.gov.au/..."
  summary="General deductions for business expenses"
/>
```

---

## Database Schema

### New Tables Required

```sql
-- Accountant workflow findings
CREATE TABLE accountant_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    tenant_id TEXT NOT NULL,
    workflow_area TEXT NOT NULL CHECK (workflow_area IN (
        'sundries', 'deductions', 'fbt', 'div7a', 'documents', 'reconciliation'
    )),
    finding_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15,2),
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    confidence_level TEXT CHECK (confidence_level IN ('High', 'Medium', 'Low')),
    legislation_refs JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'reviewed', 'approved', 'rejected', 'actioned'
    )),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id),
    accountant_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE accountant_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    tenant_id TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'info')),
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    finding_id UUID REFERENCES accountant_findings(id),
    action_url TEXT,
    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client reports
CREATE TABLE client_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    tenant_id TEXT NOT NULL,
    report_type TEXT NOT NULL DEFAULT 'tax_opportunities',
    title TEXT NOT NULL,
    findings JSONB NOT NULL DEFAULT '[]', -- Array of finding IDs
    customization JSONB NOT NULL DEFAULT '{}',
    accountant_commentary TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'reviewed', 'approved', 'sent'
    )),
    generated_pdf_url TEXT,
    sent_at TIMESTAMPTZ,
    sent_to TEXT[], -- Email addresses
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Confidence factors tracking
CREATE TABLE confidence_factors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    finding_id UUID NOT NULL REFERENCES accountant_findings(id),
    factor_name TEXT NOT NULL,
    impact INTEGER NOT NULL,
    reasoning TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_findings_user_tenant ON accountant_findings(user_id, tenant_id);
CREATE INDEX idx_findings_workflow_area ON accountant_findings(workflow_area);
CREATE INDEX idx_findings_status ON accountant_findings(status);
CREATE INDEX idx_notifications_user_unread ON accountant_notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX idx_reports_user_tenant ON client_reports(user_id, tenant_id);
```

---

## API Design

### RESTful Endpoints

```yaml
# Findings
GET    /api/accountant/findings                    # List all findings
GET    /api/accountant/findings/:area              # Findings by area
GET    /api/accountant/findings/:id                # Single finding
POST   /api/accountant/findings/:id/review         # Review finding
POST   /api/accountant/findings/:id/approve        # Approve finding
POST   /api/accountant/findings/:id/reject         # Reject finding

# Notifications
GET    /api/accountant/notifications               # List notifications
POST   /api/accountant/notifications/:id/read      # Mark as read
POST   /api/accountant/notifications/:id/dismiss   # Dismiss notification
GET    /api/accountant/notifications/unread-count  # Badge count

# Reports
GET    /api/accountant/reports                     # List reports
POST   /api/accountant/reports                     # Create draft report
GET    /api/accountant/reports/:id                 # Get report
PUT    /api/accountant/reports/:id                 # Update report
POST   /api/accountant/reports/:id/approve         # Approve for sending
POST   /api/accountant/reports/:id/send            # Send to client

# Confidence Scoring
POST   /api/accountant/confidence-score            # Calculate confidence

# Legislation References
GET    /api/accountant/legislation/:section        # Get legislation details
```

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript | Existing stack, SSR support |
| **Styling** | Tailwind CSS 4 | Existing, rapid development |
| **State** | React Query + Context | Server state + local state |
| **Database** | Supabase (PostgreSQL) | Existing, RLS support |
| **AI Analysis** | Google Gemini 2.0 Flash | Existing, forensic analysis |
| **PDF Generation** | Puppeteer | Existing, full control |
| **Email** | Resend | Existing, reliable delivery |

---

## Risk Assessment

### High Risk

**Risk**: Accountants don't trust AI recommendations
- **Mitigation**: Always show confidence scores, legislation references, and require explicit approval
- **Mitigation**: Include "Review by qualified accountant required" disclaimers

**Risk**: Incorrect tax advice leads to client penalties
- **Mitigation**: System provides "intelligence" not "advice" - accountant is decision-maker
- **Mitigation**: Tax agent validates all formulas and logic
- **Mitigation**: Confidence scoring flags high-risk recommendations

### Medium Risk

**Risk**: Dashboard becomes "yet another tool to check"
- **Mitigation**: Smart notifications for high-value findings (>$50K)
- **Mitigation**: Email digests for weekly summary
- **Mitigation**: Integration with existing workflow (Phase 2: Xero add-on)

**Risk**: Report generation doesn't match accountant's style
- **Mitigation**: Full customization options (tone, sections, branding)
- **Mitigation**: Accountant can add commentary and edit findings

### Low Risk

**Risk**: Performance issues with large datasets
- **Mitigation**: Pagination, lazy loading, caching
- **Mitigation**: Background processing for analysis

---

## Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Dashboard Load Time | < 2s | User perception threshold |
| Finding Retrieval | < 500ms | Feels instant |
| Confidence Scoring | < 1s | Acceptable for calculation |
| Report Generation | < 10s | Acceptable for complex task |
| Notification Delivery | < 30s | Near real-time |

---

## Consequences

### Positive

✅ **Accountant Efficiency**: Faster identification of opportunities
✅ **Client Value**: More deductions and credits claimed
✅ **Risk Reduction**: Compliance monitoring prevents penalties
✅ **Professional Authority**: Accountant remains decision-maker
✅ **Scalability**: Dashboard can handle unlimited findings
✅ **Extensibility**: Easy to add new workflow areas

### Negative

❌ **Learning Curve**: Accountants need to learn new interface
❌ **Change Management**: Requires process adjustment
❌ **Dependency**: Relies on accurate Xero data

---

## Future Enhancements (Out of Scope)

**Phase 2** (if successful):
- Xero Add-on integration (direct UI flags)
- Mobile app for on-the-go review
- Slack/Teams integration for notifications
- AI chat assistant for questions
- Multi-tenant agency view (supervising accountant)
- Automated workflow triggers (e.g., auto-generate report weekly)

---

## Implementation Plan

See [ACCOUNTANT_WORKFLOW_ORCHESTRATION.md](../../ACCOUNTANT_WORKFLOW_ORCHESTRATION.md) for detailed implementation plan with 6 specialist tasks.

---

## Related Documents

- [UNI-277: Parent Issue](https://linear.app/unite-hub/issue/UNI-277)
- [UNI-278: Architecture & Design](https://linear.app/unite-hub/issue/UNI-278)
- [ACCOUNTANT_WORKFLOW_ORCHESTRATION.md](../../ACCOUNTANT_WORKFLOW_ORCHESTRATION.md)
- [SENIOR_PM_WORKFLOW.md](../../SENIOR_PM_WORKFLOW.md)

---

**Status**: Proposed → Ready for Implementation
**Next Step**: Create OpenAPI specification (UNI-278 deliverable 2)
**Created By**: Specialist A (Architecture & Design)
**Date**: 2026-01-30
