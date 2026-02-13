# Reconciliation Analysis & Xero Integration Plan

## Overview

Two major features:
1. **Reconciliation Analysis Engine** - Identify unreconciled items, suggest matches, detect duplicates
2. **Xero Files & Attachments Integration** - Upload reports to Xero Files + attach findings to transactions

---

## Phase 1: Xero OAuth Scope Expansion

### Files to modify:
- `lib/xero/client.ts` - Add `files` and `accounting.attachments` scopes to `XERO_SCOPES`
- `app/api/test/xero-auth/route.ts` - Update test endpoint scopes to match

### New scopes:
```
files                        → Read/write files in Xero Files section
accounting.attachments       → Attach files to invoices/transactions
```

### Impact:
- Existing users will need to **re-authorise** the Xero connection to grant new permissions
- No breaking changes to existing read-only functionality

---

## Phase 2: Reconciliation Analysis Engine

### New file: `lib/analysis/reconciliation-engine.ts`

Following the existing engine pattern (rnd-engine.ts, deduction-engine.ts).

### Capabilities:
1. **Unreconciled Detection** - Bank transactions where `status !== 'AUTHORISED'`
2. **Suggested Matches** - Match unreconciled bank items to invoices by:
   - Amount matching (exact or within tolerance)
   - Date proximity (within 7 days)
   - Reference/description similarity
   - Contact name matching
3. **Duplicate Detection** - Same date + amount + contact within 3 days
4. **Missing Transaction Alerts** - Invoices with no corresponding bank entry
5. **Account Misallocation** - Transactions coded to wrong account based on AI analysis

### Output interfaces:
```typescript
interface ReconciliationSummary {
  totalUnreconciled: number
  unreconciledAmount: number
  suggestedMatches: SuggestedMatch[]
  duplicates: DuplicateGroup[]
  missingTransactions: MissingTransaction[]
  byAccount: AccountReconciliation[]
  byFinancialYear: Record<string, YearReconciliation>
}

interface SuggestedMatch {
  bankTransaction: TransactionRef
  matchedInvoice: TransactionRef
  matchScore: number        // 0-100
  matchReasons: string[]    // ['exact_amount', 'date_within_3_days', 'same_contact']
}

interface DuplicateGroup {
  transactions: TransactionRef[]
  duplicateType: 'exact' | 'probable' | 'possible'
  confidence: number
  totalExposure: number     // Amount at risk from double-counting
}
```

---

## Phase 3: Reconciliation API Endpoints

### New files:
- `app/api/audit/reconciliation/route.ts` - GET: fetch analysis, POST: trigger analysis
- `app/api/audit/reconciliation/status/route.ts` - GET: check progress

### Endpoints:
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/audit/reconciliation?tenantId=xxx` | Fetch reconciliation analysis |
| POST | `/api/audit/reconciliation?tenantId=xxx` | Trigger reconciliation scan |
| GET | `/api/audit/reconciliation/status?tenantId=xxx` | Poll progress |

---

## Phase 4: Reconciliation Dashboard Page

### New file: `app/dashboard/forensic-audit/reconciliation/page.tsx`

### UI Layout:
```
┌─────────────────────────────────────────────────┐
│  Reconciliation Analysis                         │
│  Organisation: DR Qld  |  Last scan: 2 hours ago│
├──────────┬──────────┬──────────┬────────────────┤
│ Unreconciled │ Suggested │ Duplicates │ Missing    │
│   Items      │  Matches  │  Found     │ Entries    │
│    47        │    32     │    5       │    12      │
│  $91,483     │  $78,200  │  $12,400  │  $15,600  │
├──────────────┴──────────┴──────────┴────────────┤
│                                                   │
│  [Tab: Unreconciled] [Matches] [Duplicates]      │
│                                                   │
│  ┌─ Suggested Match ─────────────────────────┐   │
│  │ Bank: $2,091.76 - Disaster Recovery       │   │
│  │ Invoice: INV-0042 - $2,091.76             │   │
│  │ Match Score: 95% (exact amount, same day) │   │
│  │ [View in Xero ↗]                          │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ┌─ Duplicate Alert ─────────────────────────┐   │
│  │ ⚠ 2 transactions: $7,500 to Carsi        │   │
│  │ 01 Jul 2024 & 02 Jul 2024                │   │
│  │ Confidence: 87% | Exposure: $7,500        │   │
│  │ [View Both in Xero ↗]                     │   │
│  └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Components:
- Summary cards (unreconciled count/amount, matches, duplicates, missing)
- Tabbed view switching between categories
- Match cards showing bank item + invoice with confidence score
- Duplicate groups with exposure amount
- Xero deep links for every transaction
- Filter by date range, account, amount range

---

## Phase 5: Xero Files API Integration

### New file: `lib/xero/files-api.ts`

Upload forensic audit reports to Xero's Files section.

### Capabilities:
- Create "ATO Tax Optimizer" folder in Xero Files
- Upload PDF reports (forensic audit, reconciliation)
- Upload HTML reports as backup
- Track uploaded file IDs for future reference

### API Endpoint:
- `POST /api/xero/files/upload-report` - Upload a report to Xero Files

### Flow:
```
Generate Report → Create PDF → Upload to Xero Files folder
                              → Return Xero file URL
                              → Store reference in database
```

---

## Phase 6: Xero Attachments Integration

### New file: `lib/xero/attachments-api.ts`

Attach finding summaries to individual transactions in Xero.

### Capabilities:
- Generate per-transaction finding summary (text/PDF)
- Attach to the source transaction in Xero
- Include: recommendation, legislation reference, action required
- Batch processing with rate limiting (60/min)

### API Endpoint:
- `POST /api/xero/attachments/attach-findings` - Attach findings to transactions

### Attachment Content Example:
```
══════════════════════════════════════
ATO TAX OPTIMIZER - FINDING SUMMARY
══════════════════════════════════════
Transaction: INV-0042 | $2,091.76
Date: 28 Apr 2025 | Contact: Disaster Recovery

RECOMMENDATION: Claim as Professional Fees deduction
Tax Area: Deductions (Section 8-1 ITAA 1997)
Estimated Benefit: $523 (at 25% corporate rate)
Confidence: 83%
Priority: MEDIUM

DOCUMENTATION REQUIRED:
• Invoice copy
• Proof of payment
• Evidence of business purpose

ATO FORM: Company Tax Return
DEADLINE: 30 June 2029

Generated by ATO Tax Optimizer
══════════════════════════════════════
```

### Batch Flow:
```
Select recommendations with transactions
  → For each transaction with findings
    → Generate text summary
    → Upload as attachment via Xero Attachments API
    → Rate limit: 4-second delay between calls
    → Track success/failure
  → Return summary of attached findings
```

---

## Phase 7: Integration - Report Upload Button

### Modify: `app/dashboard/forensic-audit/recommendations/page.tsx`

Add buttons:
- **"Upload Report to Xero"** - Generates PDF and uploads to Xero Files
- **"Attach Findings to Transactions"** - Batch attaches summaries to Xero transactions
- Progress indicator for batch operations

### Modify: `app/dashboard/forensic-audit/reconciliation/page.tsx`

Add button:
- **"Upload Reconciliation Report to Xero"** - Upload reconciliation analysis

---

## Implementation Order

| Step | Phase | Dependency |
|------|-------|------------|
| 1 | Phase 1: OAuth Scopes | None |
| 2 | Phase 2: Reconciliation Engine | None |
| 3 | Phase 3: Reconciliation API | Phase 2 |
| 4 | Phase 4: Reconciliation Dashboard | Phase 3 |
| 5 | Phase 5: Xero Files API | Phase 1 |
| 6 | Phase 6: Xero Attachments API | Phase 1 |
| 7 | Phase 7: Integration buttons | Phases 4-6 |

Phases 1-2 can start in parallel. Phases 5-6 can be built in parallel after Phase 1.

---

## New Files Summary

| File | Purpose |
|------|---------|
| `lib/xero/client.ts` | MODIFY - Add new OAuth scopes |
| `lib/analysis/reconciliation-engine.ts` | NEW - Reconciliation analysis engine |
| `app/api/audit/reconciliation/route.ts` | NEW - Reconciliation API endpoint |
| `app/api/audit/reconciliation/status/route.ts` | NEW - Reconciliation progress |
| `app/dashboard/forensic-audit/reconciliation/page.tsx` | NEW - Reconciliation dashboard |
| `lib/xero/files-api.ts` | NEW - Xero Files upload |
| `lib/xero/attachments-api.ts` | NEW - Xero Attachments |
| `app/api/xero/files/upload-report/route.ts` | NEW - Report upload endpoint |
| `app/api/xero/attachments/attach-findings/route.ts` | NEW - Attachment batch endpoint |
| `app/dashboard/forensic-audit/recommendations/page.tsx` | MODIFY - Add upload buttons |
