# Accountant Workflow System Diagrams

**Document Version**: 1.1
**Created**: 2026-01-30
**Updated**: 2026-02-11
**Linear Issue**: [UNI-278](https://linear.app/unite-hub/issue/UNI-278)
**ADR**: [ADR-017](../adr/ADR-017-accountant-workflow-integration.md)

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Forensic-to-Findings Pipeline](#forensic-to-findings-pipeline)
3. [Component Architecture](#component-architecture)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Accountant Vetting Flow](#accountant-vetting-flow)
6. [Sequence Diagrams](#sequence-diagrams)
7. [State Machine Diagrams](#state-machine-diagrams)
8. [Deployment Architecture](#deployment-architecture)

---

## System Architecture

### High-Level System Overview

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser]
        MOBILE[Mobile Browser]
    end

    subgraph "Next.js Application (Vercel)"
        APP[Next.js 16 App]
        API[API Routes]
        SSR[Server Components]
    end

    subgraph "Accountant Workflow System"
        DASH[6-Area Dashboard]
        MAPPER[Forensic-to-Findings Mapper]
        VETTING[Accountant Vetting Pipeline]
        CONF[Confidence Scorer]
        LEG[Legislation Linker]
    end

    subgraph "Data Layer"
        XERO[Xero Forensic Analyzer]
        GEMINI[Google Gemini 2.0 Flash]
        DB[(Supabase PostgreSQL)]
    end

    subgraph "External Services"
        XERO_API[Xero API]
        ATO[ATO Legislation DB]
    end

    subgraph "Planned (Phase 2/3)"
        NOTIF[Notification Engine]:::planned
        REPORT[Report Generator]:::planned
    end

    WEB --> APP
    MOBILE --> APP
    APP --> SSR
    APP --> API

    API --> DASH
    API --> MAPPER
    API --> VETTING

    DASH --> CONF
    DASH --> LEG

    MAPPER --> DB
    DASH --> XERO
    XERO --> GEMINI
    XERO --> XERO_API
    GEMINI --> DB

    LEG --> ATO
    CONF --> DB

    classDef planned fill:#374151,stroke:#6b7280,stroke-dasharray: 5 5
    style DASH fill:#3b82f6
    style MAPPER fill:#10b981
    style VETTING fill:#8b5cf6
    style CONF fill:#f59e0b
    style LEG fill:#ec4899
```

---

## Forensic-to-Findings Pipeline

### Pipeline Overview

```mermaid
graph LR
    subgraph "Source"
        FAR[forensic_analysis_results]
    end

    subgraph "Mapper Pipeline"
        DWA[determineWorkflowArea]
        MAP[mapAnalysisToFinding]
        DEDUP[Dedup Check]
        CONF[mapConfidence]
        BEN[estimateBenefit]
    end

    subgraph "Output"
        AF[accountant_findings]
        SKIP[Skipped - not actionable]
        SKIP2[Skipped - duplicate]
    end

    FAR --> DWA
    DWA -->|"area found"| MAP
    DWA -->|"null (no flags)"| SKIP
    MAP --> CONF
    MAP --> BEN
    CONF --> DEDUP
    BEN --> DEDUP
    DEDUP -->|"new key"| AF
    DEDUP -->|"key exists"| SKIP2

    style FAR fill:#6b7280
    style AF fill:#10b981
    style SKIP fill:#ef4444
    style SKIP2 fill:#f59e0b
    style DWA fill:#3b82f6
    style MAP fill:#8b5cf6
```

### Priority Routing Decision Tree

```mermaid
graph TD
    START[Forensic Analysis Row] --> P1{is_rnd_candidate OR<br/>meets_div355_criteria?}
    P1 -->|Yes| SUNDRIES[sundries]
    P1 -->|No| P2{division7a_risk?}
    P2 -->|Yes| DIV7A[div7a]
    P2 -->|No| P3{fbt_implications?}
    P3 -->|Yes| FBT[fbt]
    P3 -->|No| P4{requires_documentation?}
    P4 -->|Yes| DOCS[documents]
    P4 -->|No| P5{is_fully_deductible AND<br/>deduction_confidence < 80?}
    P5 -->|Yes| DEDUCTIONS[deductions]
    P5 -->|No| P6{category_confidence < 50?}
    P6 -->|Yes| RECON[reconciliation]
    P6 -->|No| SKIP[Skip - not actionable]

    style SUNDRIES fill:#3b82f6
    style DIV7A fill:#ef4444
    style FBT fill:#f59e0b
    style DOCS fill:#8b5cf6
    style DEDUCTIONS fill:#10b981
    style RECON fill:#ec4899
    style SKIP fill:#6b7280
```

### Confidence Scoring Flow

```mermaid
graph LR
    subgraph "Input Factors (Weighted)"
        CAT["Category Confidence<br/>Weight: 40%"]
        RND["R&D Confidence<br/>Weight: 25%"]
        DED["Deduction Confidence<br/>Weight: 20%"]
        DOC["Documentation<br/>Weight: 15%"]
    end

    subgraph "Scoring"
        CALC[Weighted Average<br/>sum / total_weight]
        LEVEL{Score Level}
    end

    subgraph "Output"
        HIGH["High (>= 80)"]
        MED["Medium (>= 60)"]
        LOW["Low (< 60)"]
    end

    CAT --> CALC
    RND -->|"if applicable"| CALC
    DED -->|"if available"| CALC
    DOC --> CALC

    CALC --> LEVEL
    LEVEL --> HIGH
    LEVEL --> MED
    LEVEL --> LOW

    style HIGH fill:#10b981
    style MED fill:#f59e0b
    style LOW fill:#ef4444
    style CALC fill:#8b5cf6
```

---

## Component Architecture

### 6-Area Dashboard Architecture

```mermaid
graph TB
    subgraph "Dashboard Container"
        NAV[Navigation Bar]
        SIDEBAR[Workflow Area Sidebar]
        CONTENT[Content Area]
    end

    subgraph "Workflow Area Components"
        SUND[Sundries Component]
        DEDUC[Deductions Component]
        FBT[FBT Component]
        DIV7A[Division 7A Component]
        DOCS[Documents Component]
        RECON[Reconciliation Component]
    end

    subgraph "Shared Components"
        FINDING[FindingCard]
        CONFIDENCE[ConfidenceIndicator]
        LEGISLATION[LegislationLink]
        ACTIONS[ActionButtons]
        FILTER[FilterPanel]
    end

    subgraph "Data Hooks"
        USE_FINDINGS[useFindingsByArea]
        USE_REVIEW[useReviewActions]
    end

    NAV --> SIDEBAR
    SIDEBAR --> SUND
    SIDEBAR --> DEDUC
    SIDEBAR --> FBT
    SIDEBAR --> DIV7A
    SIDEBAR --> DOCS
    SIDEBAR --> RECON

    SUND --> FINDING
    DEDUC --> FINDING
    FBT --> FINDING
    DIV7A --> FINDING
    DOCS --> FINDING
    RECON --> FINDING

    FINDING --> CONFIDENCE
    FINDING --> LEGISLATION
    FINDING --> ACTIONS

    SUND --> USE_FINDINGS
    DEDUC --> USE_FINDINGS
    FBT --> USE_FINDINGS
    DIV7A --> USE_FINDINGS
    DOCS --> USE_FINDINGS
    RECON --> USE_FINDINGS

    ACTIONS --> USE_REVIEW

    style FINDING fill:#3b82f6
    style CONFIDENCE fill:#8b5cf6
    style LEGISLATION fill:#ec4899
```

### Notification Engine Architecture (Planned — Phase 2)

```mermaid
graph LR
    subgraph "Trigger Sources"
        INSERT[New Finding Inserted]
        UPDATE[Finding Updated]
        TIMER[Scheduled Job]
    end

    subgraph "Notification Engine"
        EVALUATOR[Priority Evaluator]:::planned
        TEMPLATE[Message Template Engine]:::planned
        DISPATCHER[Notification Dispatcher]:::planned
    end

    subgraph "Delivery Channels"
        IN_APP[In-App Badge]:::planned
        EMAIL[Email Digest]:::planned
        DB_NOTIF[(DB: accountant_notifications)]:::planned
    end

    INSERT --> EVALUATOR
    UPDATE --> EVALUATOR
    TIMER --> EVALUATOR

    EVALUATOR -->|High Value >$50K| TEMPLATE
    EVALUATOR -->|Compliance Risk| TEMPLATE
    EVALUATOR -->|Deadline <30 days| TEMPLATE
    EVALUATOR -->|Critical Anomaly| TEMPLATE

    TEMPLATE --> DISPATCHER

    DISPATCHER --> IN_APP
    DISPATCHER --> EMAIL
    DISPATCHER --> DB_NOTIF

    classDef planned fill:#374151,stroke:#6b7280,stroke-dasharray: 5 5
```

### Report Generator Architecture (Planned — Phase 3)

```mermaid
graph TB
    subgraph "Report Generation Pipeline"
        SELECT[1. Select Findings]:::planned
        CUSTOMIZE[2. Customize Report]:::planned
        PREVIEW[3. Preview]:::planned
        APPROVE[4. Accountant Approval]:::planned
        GENERATE[5. Generate PDF]:::planned
        SEND[6. Email Client]:::planned
    end

    SELECT --> CUSTOMIZE
    CUSTOMIZE --> PREVIEW
    PREVIEW --> APPROVE
    APPROVE --> GENERATE
    GENERATE --> SEND

    classDef planned fill:#374151,stroke:#6b7280,stroke-dasharray: 5 5
```

---

## Data Flow Diagrams

### Forensic-to-Findings Generation Flow

```mermaid
sequenceDiagram
    participant USER as Accountant
    participant DASH as Dashboard
    participant API as POST /findings/generate
    participant XERO_CONN as xero_connections
    participant FAR as forensic_analysis_results
    participant MAPPER as Forensic Mapper
    participant DB as accountant_findings

    USER->>DASH: Click "Generate Findings"
    DASH->>API: POST /api/accountant/findings/generate<br/>{ tenantId, financialYear? }
    API->>XERO_CONN: Resolve organization_id from tenant_id

    alt No Xero Connection
        XERO_CONN-->>API: null
        API-->>DASH: Error: "Connect Xero first"
    else Connection Found
        XERO_CONN-->>API: { organization_id }
        API->>FAR: SELECT * WHERE tenant_id AND financial_year
        FAR-->>API: Return forensic rows

        API->>DB: SELECT existing findings for dedup
        DB-->>API: Return existing keys

        loop For each forensic row
            API->>MAPPER: determineWorkflowArea(row)
            MAPPER-->>API: area or null

            alt Area is null
                Note over API: Skip (not actionable)
            else Area found
                API->>MAPPER: mapAnalysisToFinding(row, org_id)
                MAPPER-->>API: AccountantFindingInsert
                API->>API: Check dedup key
                alt Duplicate
                    Note over API: Skip (already exists)
                else New finding
                    API->>DB: INSERT accountant_findings (batch)
                end
            end
        end

        API-->>DASH: { status: 'complete', created, skipped, byArea }
    end
```

### Finding Review & Approval Flow

```mermaid
sequenceDiagram
    participant ACC as Accountant
    participant DASH as Dashboard
    participant API as API Routes
    participant DB as Database
    participant EMAIL as Email Notifier

    ACC->>DASH: Navigate to workflow area
    DASH->>API: GET /api/accountant/findings?workflowArea=sundries
    API->>DB: Query findings with filters
    DB-->>API: Return findings
    API-->>DASH: Display findings list

    ACC->>DASH: Review finding details
    Note over ACC,DASH: View: confidence score, legislation refs, reasoning, estimated benefit

    alt Approve
        ACC->>DASH: Click "Approve"
        DASH->>API: PATCH /api/accountant/findings/{id}/status<br/>{ status: 'approved', accountantNotes }
        API->>DB: UPDATE status=approved, approved_at=now()
        API->>EMAIL: Send approval notification (if prefs enabled)
        API-->>DASH: { status: 'approved' }
    else Reject
        ACC->>DASH: Click "Reject"
        DASH->>API: PATCH /api/accountant/findings/{id}/status<br/>{ status: 'rejected', reason }
        API->>DB: UPDATE status=rejected, rejection_reason
        API-->>DASH: { status: 'rejected' }
    else Defer
        ACC->>DASH: Click "Defer"
        DASH->>API: PATCH /api/accountant/findings/{id}/status<br/>{ status: 'deferred' }
        API->>DB: UPDATE status=deferred
        API-->>DASH: { status: 'deferred' }
    end
```

---

## Accountant Vetting Flow

```mermaid
sequenceDiagram
    participant ACC as Accountant
    participant FORM as Application Form
    participant API_APPLY as POST /accountant/apply
    participant API_VERIFY as GET /accountant/verify
    participant API_PRICING as GET /accountant/pricing
    participant DB as Database

    Note over ACC,DB: Step 1: Application
    ACC->>FORM: Fill application (credentials, firm details)
    FORM->>API_APPLY: POST /api/accountant/apply
    API_APPLY->>DB: Check duplicate email
    alt Duplicate exists
        DB-->>API_APPLY: Existing application
        API_APPLY-->>FORM: 409 Conflict
    else New application
        API_APPLY->>DB: INSERT accountant_applications (status=pending)
        API_APPLY->>DB: INSERT accountant_activity_log
        DB-->>API_APPLY: Application created
        API_APPLY-->>FORM: 201 Created { application_id }
    end

    Note over ACC,DB: Step 2: Admin Review (manual)
    Note over DB: Admin reviews and approves via service_role

    Note over ACC,DB: Step 3: Verification
    ACC->>API_VERIFY: GET /api/accountant/verify?email=...
    API_VERIFY->>DB: SELECT FROM vetted_accountants WHERE email AND is_active
    DB-->>API_VERIFY: Accountant record
    API_VERIFY-->>ACC: { is_vetted: true, accountant: {...} }

    Note over ACC,DB: Step 4: Pricing
    ACC->>API_PRICING: GET /api/accountant/pricing?email=...
    API_PRICING->>DB: Query wholesale discount rate
    DB-->>API_PRICING: 50% discount
    API_PRICING-->>ACC: { is_vetted: true, final_price: 495, standard_price: 995 }
```

### Vetting State Machine

```mermaid
stateDiagram-v2
    [*] --> pending: Application Submitted
    pending --> under_review: Admin Opens
    under_review --> approved: Admin Approves
    under_review --> rejected: Admin Rejects
    approved --> suspended: Admin Suspends
    suspended --> approved: Admin Reinstates
    rejected --> [*]: Archived

    note right of approved
        Creates:
        - vetted_accountants record
        - Auth user account
        - Organization link
    end note

    note right of suspended
        Deactivates:
        - is_active = false
        - Wholesale pricing revoked
    end note
```

---

## Sequence Diagrams

### Complete End-to-End Flow

```mermaid
sequenceDiagram
    participant ACC as Accountant
    participant DASH as Dashboard
    participant GEN as Findings Generator
    participant FAR as Forensic Results (Gemini)
    participant DB as Database

    Note over ACC,DB: Phase 1: Forensic Analysis (existing)
    Note over FAR,DB: Gemini analyses Xero transactions → forensic_analysis_results

    Note over ACC,DB: Phase 2: Generate Findings
    ACC->>DASH: Click "Generate Findings"
    DASH->>GEN: POST /api/accountant/findings/generate
    GEN->>DB: Resolve organization_id via xero_connections
    GEN->>DB: Fetch forensic_analysis_results
    GEN->>GEN: Map rows → findings (priority routing, confidence, benefits)
    GEN->>DB: Dedup check + batch INSERT
    GEN-->>DASH: { created: 47, skipped: 12, byArea: {...} }

    Note over ACC,DB: Phase 3: Review Findings
    ACC->>DASH: Browse workflow areas
    DASH->>DB: GET /api/accountant/findings?workflowArea=sundries
    DB-->>DASH: Return findings
    ACC->>DASH: Review + Approve/Reject/Defer
    DASH->>DB: PATCH /api/accountant/findings/{id}/status

    Note over ACC,DB: Phase 4: Notifications (Planned)
    Note over DASH,DB: Phase 2: In-app + email notifications for high-value findings

    Note over ACC,DB: Phase 5: Client Reports (Planned)
    Note over DASH,DB: Phase 3: PDF generation + email delivery
```

---

## State Machine Diagrams

### Finding Status State Machine

```mermaid
stateDiagram-v2
    [*] --> pending: Mapper creates finding

    pending --> approved: Accountant approves
    pending --> rejected: Accountant rejects
    pending --> deferred: Accountant defers

    deferred --> approved: Accountant approves later
    deferred --> rejected: Accountant rejects later
    deferred --> pending: Reset to pending

    approved --> pending: Revert decision

    rejected --> [*]: Archived

    note right of pending
        Default status for all
        mapper-generated findings.
        Requires accountant action.
    end note

    note right of approved
        Records:
        - approved_at timestamp
        - accountant_notes
        Triggers email notification.
    end note

    note right of rejected
        Records:
        - rejection_reason
        Excluded from reporting.
    end note

    note right of deferred
        Accountant needs more
        info before deciding.
    end note
```

---

## Deployment Architecture

### Production Deployment (Vercel)

```mermaid
graph TB
    subgraph "CDN Edge (Global)"
        CDN1[Cloudflare CDN]
        CDN2[Static Assets]
    end

    subgraph "Vercel Edge Network"
        EDGE3[ap-southeast-2 / syd1]
    end

    subgraph "Application Layer (Serverless)"
        SSR[Server Components]
        API[API Routes - 8 accountant endpoints]
        MIDDLEWARE[Middleware + RLS]
    end

    subgraph "Data Layer"
        SUPABASE[(Supabase ap-southeast-2)]
    end

    subgraph "External Services"
        XERO[Xero API]
        GEMINI[Google Gemini]
    end

    CDN1 --> EDGE3
    EDGE3 --> SSR
    SSR --> API
    API --> MIDDLEWARE
    MIDDLEWARE --> SUPABASE
    API --> XERO
    API --> GEMINI

    style EDGE3 fill:#3b82f6
    style SUPABASE fill:#10b981
```

---

## Security Architecture

### RLS Enforcement for Findings

```mermaid
graph TB
    subgraph "API Layer"
        REQ[Incoming Request]
        VERIFY[Verify JWT via Supabase Auth]
        EXTRACT[Extract auth.uid]
    end

    subgraph "Database Layer"
        POLICY["RLS Policy:<br/>organization_id IN<br/>(SELECT organization_id<br/>FROM organization_members<br/>WHERE user_id = auth.uid())"]
        EXECUTE[Execute Query]
    end

    subgraph "Response"
        RETURN[Return Scoped Results]
    end

    REQ --> VERIFY
    VERIFY -->|Valid| EXTRACT
    VERIFY -->|Invalid| RETURN
    EXTRACT --> POLICY
    POLICY --> EXECUTE
    EXECUTE --> RETURN

    style POLICY fill:#ef4444
```

---

**System Diagrams Status**: Updated (v1.1)
**Total Diagrams**: 16
**Key additions**: Forensic-to-Findings Pipeline, Priority Routing Decision Tree, Accountant Vetting Flow
**Changes**: Notification and Report Generator diagrams marked as "Planned (Phase 2/3)"
