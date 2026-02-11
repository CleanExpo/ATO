# Changelog -- v8.4.0: Accountant Workflow System

> **Disclaimer:** This documentation describes an analytical tool and does not constitute tax, financial, or legal advice. All findings and recommendations should be reviewed by a registered tax agent or qualified tax professional before any action is taken.

**Release Date:** February 2026

---

## Added

### Accountant Workflow Intelligence Dashboard

- **Accountant Workflow Hub** (`app/dashboard/accountant/page.tsx`) -- Central landing page with summary statistics (total findings, high-value findings, average confidence), "Generate from Audit" action, export controls, and quick-access grid to all six workflow areas.
- **Six specialised workflow area pages** -- Dedicated pages for Sundries, Deductions (Section 8-1), Fringe Benefits Tax, Division 7A, Source Documents, and Reconciliation at `/dashboard/accountant/<area>`.

### Finding Card Component

- **FindingCard** (`components/accountant/FindingCard.tsx`) -- Interactive card displaying transaction details, AI recommendation, confidence scoring with expandable factors, legislation reference badges, estimated benefit, and inline approve/reject/defer actions with optimistic status updates.
- **ConfidenceBadge** (`components/accountant/ConfidenceBadge.tsx`) -- Colour-coded confidence indicator (High/Medium/Low) with hover tooltip showing interpretation, individual scoring factors with weights, and a scoring guide.
- **LegislationLink** (`components/accountant/LegislationLink.tsx`) -- Clickable legislation reference cards with deep links to legislation.gov.au. Colour-coded by Act (cyan for ITAA 1997, magenta for ITAA 1936, yellow for FBTAA 1986, green for TAA 1953). Includes compact `LegislationBadge` variant for inline display.

### WorkflowFindings Client Component

- **WorkflowFindings** (`components/accountant/WorkflowFindings.tsx`) -- Interactive findings list wrapping FindingCard components with:
  - Status filtering (All / Pending / Approved / Rejected / Deferred)
  - Sort controls (Date / Benefit / Confidence)
  - High-value quick filter ($50,000+ estimated benefit)
  - Optimistic status updates via PATCH API calls
  - Live summary statistics (total findings, pending count, approved count, total estimated benefit)

### Finding Generation from Forensic Audit Results

- **Forensic-to-findings mapper** (`lib/accountant/forensic-findings-mapper.ts`) -- Transforms `forensic_analysis_results` rows into `accountant_findings` records using priority-based workflow routing:
  1. R&D candidate / Division 355 criteria met --> Sundries
  2. Division 7A risk flagged --> Division 7A
  3. FBT implications detected --> FBT
  4. Documentation required (no other flag) --> Source Documents
  5. Fully deductible but low confidence (< 80%) --> Deductions
  6. Low category confidence (< 50%) --> Reconciliation
  7. Default (no match) --> Skipped (not actionable)

### Finding Status Management

- **Status update API** (`app/api/accountant/findings/[id]/status/route.ts`) -- PATCH endpoint supporting approve, reject, defer, and reset-to-pending transitions. Records rejection reason and accountant notes. Sets `approved_at` timestamp on approval. Sends email notification via `sendAlertEmail` when approval occurs and email notifications are enabled for the tenant.
- **Inline rejection reason** -- Reject action displays an inline text input for the rejection reason before confirming. Press Enter or click Confirm to submit.

### Excel Report Generator

- **Accountant report generator** (`lib/reports/accountant-report-generator.ts`) -- Creates Excel workbooks with three sheets:
  - **Summary** -- Organisation details (name, ABN), generation timestamp, financial year, included statuses, workflow area breakdown table (count, estimated benefit, average confidence), totals row, TASA 2009 disclaimer.
  - **Findings Detail** -- One row per finding with 14 columns: Workflow Area, Transaction ID, Date (dd/mm/yyyy), Description, Amount, Estimated Benefit, Confidence (percentage), Level, Status (colour-coded), Suggestion, Legislation, FY, Rejection Reason, Notes. Includes auto-filters.
  - **Legislation References** -- Deduplicated legislation references sorted by reference count (most-referenced first) with Section, Title, URL, and Referenced By columns.

### Notifications

- **High-value finding notifications** -- Findings with estimated benefit >= $50,000 automatically generate `high_value_finding` notifications during finding generation. Title format: "High-Value Finding: $[amount]".
- **Division 7A compliance risk notifications** -- All Division 7A findings automatically generate `compliance_risk` notifications during finding generation. Title format: "Compliance Risk: Division 7A".
- **Background notification creation** -- Notifications are created asynchronously using `after()` from `next/server`, ensuring they do not delay the primary API response.

### Export Functionality

- **Configurable export filters** -- Report export supports filtering by status (checkboxes for approved, pending, rejected, deferred) and workflow area. Default export includes approved findings only.
- **Download as .xlsx** -- Report is downloaded as a binary Excel file with a filename pattern of `accountant-findings-<org-name>-<timestamp>.xlsx`.

### Authentication

- **All accountant API routes authenticated** -- Finding generation, listing, status updates, and report generation all require authentication via `requireAuth()` or `isSingleUserMode()`.
- **`createAdminClient()` for RLS bypass** -- Finding generation and report generation use the synchronous `createAdminClient()` (service role key, no cookies) to bypass Row Level Security when querying across tenants.

---

## Architecture

### Priority-Based Workflow Routing

The forensic-to-findings mapper uses a deterministic priority system where the first matching rule wins. This ensures each transaction routes to exactly one workflow area, even when multiple flags are set. Priority order: R&D > Division 7A > FBT > Source Documents > Deductions > Reconciliation.

### Weighted Confidence Scoring

Confidence scores are calculated as a weighted average of available factors:

| Factor | Weight | Threshold |
|--------|--------|-----------|
| Category classification confidence | 40% | >= 70% = positive |
| R&D eligibility confidence | 25% | >= 70% = positive (R&D candidates only) |
| Deduction confidence | 20% | >= 70% = positive |
| Documentation completeness | 15% | Missing docs = negative (30), adequate = positive (80) |

Score-to-level mapping: High (80--100), Medium (60--79), Low (0--59).

### Deduplication on Finding Generation

Finding generation deduplicates using a composite key of `transaction_id` + `organization_id` + `workflow_area`. Both existing database records and within-batch inserts are checked, ensuring re-running generation after new forensic analyses never creates duplicate findings.

### Background Notification Creation

Notifications for high-value and compliance-risk findings are created using `after()` from `next/server`. This pattern keeps the notification logic within the serverless function lifecycle (up to `maxDuration`) whilst returning the API response immediately. Notification failures are logged but never propagate to the caller.

### createAdminClient() for RLS-Bypass Operations

The finding generation and report generation endpoints use `createAdminClient()` -- a synchronous Supabase client that uses the service role key for both `apikey` and `Authorization` headers, bypassing Row Level Security. This is necessary because these operations query data across the `forensic_analysis_results`, `xero_connections`, and `accountant_findings` tables where the session user may not have direct RLS access (particularly in single-user mode).

---

## Legislation References

The following Australian tax legislation sections are referenced by findings across the six workflow areas:

### Income Tax Assessment Act 1997 (ITAA 1997)

| Section | Description | Workflow Area |
|---------|-------------|---------------|
| Division 355 | R&D Tax Incentive -- eligibility and offset calculation | Sundries |
| s 355-25 | Core R&D activities -- four-element test definition | Sundries |
| s 8-1 | General deductions -- positive and negative limbs, business purpose test | Deductions, Reconciliation |
| s 900-70 | Substantiation requirements for deductions | Source Documents |

### Income Tax Assessment Act 1936 (ITAA 1936)

| Section | Description | Workflow Area |
|---------|-------------|---------------|
| Division 7A | Deemed dividends from private company payments to shareholders/associates | Division 7A |
| s 109D | Payments and loans treated as dividends | Division 7A |
| s 262A | Record-keeping obligations (5-year retention) | Source Documents |

### Fringe Benefits Tax Assessment Act 1986 (FBTAA 1986)

| Section | Description | Workflow Area |
|---------|-------------|---------------|
| s 136 | FBT liability assessment and rate | FBT |
| s 67 | Shortfall penalties for incorrect FBT returns | FBT |

---

## Database

### Schema

- **`accountant_findings` table** (`supabase/migrations/20260130000000_create_accountant_findings.sql`) -- Core table with workflow area enum, finding status enum, confidence scoring fields (score, level, factors as JSONB), legislation references (JSONB), estimated benefit, rejection reason, accountant notes, and approval timestamp.
- **Indexes** -- 8 single-column indexes (workflow_area, status, confidence_level, financial_year, estimated_benefit DESC, created_at DESC, user_id, organization_id) plus 2 composite indexes (workflow_area + status, organization_id + workflow_area).
- **Row Level Security** -- Enabled with policies for SELECT, INSERT, UPDATE, and DELETE scoped to organisation membership via `organization_members`.
- **Updated-at trigger** -- Automatic `updated_at` timestamp on all UPDATE operations.

---

## Testing

### Unit Tests -- Forensic Findings Mapper

Tests covering:
- Priority-based workflow routing (R&D > Division 7A > FBT > Documents > Deductions > Reconciliation > skip)
- Confidence score calculation with all four factor weights
- Benefit estimation per workflow area (43.5% R&D, 25% deductions, 47% FBT, 100% Division 7A, $0 documents, 25% reconciliation)
- Deduplication logic (composite key: transaction_id + organization_id + workflow_area)
- Edge cases: null fields, missing amounts, zero-confidence transactions

### Unit Tests -- Accountant Report Generator

Tests covering:
- Excel workbook generation with three sheets (Summary, Findings Detail, Legislation References)
- Data query filtering by workflow area, status, and financial year
- Currency formatting (AUD), date formatting (dd/mm/yyyy), percentage formatting
- Legislation reference deduplication and sorting by reference count
- Disclaimer text presence on Summary sheet
- Status colour-coding (green/red/amber)

### Integration Tests -- API Endpoints

Tests covering:
- `POST /api/accountant/findings/generate` -- successful generation, no Xero connection error, no forensic results, invalid tenantId
- `GET /api/accountant/findings` -- listing with filters, empty results, invalid filter values
- `PATCH /api/accountant/findings/[id]/status` -- approval, rejection with reason, deferral, finding not found, invalid status
- `POST /api/accountant/reports/generate` -- successful Excel download, no matching findings, invalid format, missing tenantId
- Authentication enforcement on all endpoints

---

> **Disclaimer:** This documentation describes an analytical tool and does not constitute tax, financial, or legal advice. All findings and recommendations should be reviewed by a registered tax agent or qualified tax professional before any action is taken.
