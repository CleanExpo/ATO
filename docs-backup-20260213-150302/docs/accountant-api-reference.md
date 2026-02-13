# Accountant Workflow API Reference

> **Disclaimer:** This documentation describes an analytical tool and does not constitute tax, financial, or legal advice. All findings and recommendations should be reviewed by a registered tax agent or qualified tax professional before any action is taken.

---

## Table of Contents

- [Authentication](#authentication)
- [POST /api/accountant/findings/generate](#post-apiaccountantfindingsgenerate)
- [GET /api/accountant/findings](#get-apiaccountantfindings)
- [POST /api/accountant/findings](#post-apiaccountantfindings)
- [PATCH /api/accountant/findings/[id]/status](#patch-apiaccountantfindingsidstatus)
- [POST /api/accountant/reports/generate](#post-apiaccountantreportsgenerate)
- [Common Types](#common-types)
- [Error Responses](#error-responses)

---

## Authentication

All accountant API endpoints require authentication. The system supports two modes:

1. **Standard Authentication** -- Requires a valid session. The `requireAuth()` middleware validates the user session and, where applicable, verifies tenant access via the `user_tenant_access` table.
2. **Single-User Mode** -- When `SINGLE_USER_MODE` is enabled, authentication is bypassed and the `tenantId` from the request body is used directly.

Unauthenticated requests receive a `401` response:

```json
{
  "error": "Authentication required"
}
```

---

## POST /api/accountant/findings/generate

Transform forensic analysis results into accountant findings across six workflow areas.

### Purpose

This endpoint bridges the AI forensic analysis pipeline and the accountant workflow dashboard. It reads all `forensic_analysis_results` for a given tenant, routes each result to the appropriate workflow area using priority-based classification, deduplicates against existing findings, and inserts new records into `accountant_findings`.

After successful generation, the endpoint creates notifications in the background for high-value findings (estimated benefit >= $50,000) and Division 7A compliance risks.

### Request

```
POST /api/accountant/findings/generate
Content-Type: application/json
```

#### Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenantId` | `string` | Yes | Xero tenant ID for the connected organisation |
| `financialYear` | `string` | No | Financial year filter (e.g., `"FY2024-25"`). Defaults to the current FY if omitted. |

#### Example Request

```bash
curl -X POST http://localhost:3000/api/accountant/findings/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "tenantId": "abc123-def456-ghi789",
    "financialYear": "FY2024-25"
  }'
```

### Response

#### Success (200)

```json
{
  "status": "complete",
  "created": 42,
  "skipped": 15,
  "byArea": {
    "sundries": 8,
    "deductions": 12,
    "fbt": 5,
    "div7a": 3,
    "documents": 10,
    "reconciliation": 4
  },
  "message": "Generated 42 findings from 57 forensic analysis results"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | Always `"complete"` on success |
| `created` | `number` | Number of new findings inserted |
| `skipped` | `number` | Number of results skipped (duplicates or not actionable) |
| `byArea` | `object` | Breakdown of created findings by workflow area |
| `message` | `string` | Human-readable summary |

#### No Forensic Results (200)

When no forensic analysis results exist for the tenant:

```json
{
  "status": "complete",
  "created": 0,
  "skipped": 0,
  "byArea": {
    "sundries": 0,
    "deductions": 0,
    "fbt": 0,
    "div7a": 0,
    "documents": 0,
    "reconciliation": 0
  },
  "message": "No forensic analysis results found. Run a Forensic Audit first."
}
```

### Error Cases

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Missing or non-string `tenantId` | `{ "error": "tenantId is required and must be a string" }` |
| 400 | Invalid JSON body | `{ "error": "Invalid JSON body" }` |
| 400 | No Xero connection for tenant | `{ "error": "No Xero connection found for this tenant. Connect a Xero organisation first." }` |
| 400 | Xero connection has no linked organisation | `{ "error": "Xero connection has no linked organisation. Re-connect your Xero account." }` |
| 401 | Not authenticated | `{ "error": "Authentication required" }` |
| 500 | Database or internal error | `{ "error": "<error message>", "operation": "generateAccountantFindings" }` |

---

## GET /api/accountant/findings

List all accountant findings with optional filters.

### Purpose

Retrieves findings for the authenticated user, with support for filtering by workflow area, confidence level, status, minimum benefit, and financial year.

### Request

```
GET /api/accountant/findings?workflowArea=sundries&status=pending
```

#### Query Parameters

| Parameter | Type | Required | Valid Values | Description |
|-----------|------|----------|--------------|-------------|
| `workflowArea` | `string` | No | `sundries`, `deductions`, `fbt`, `div7a`, `documents`, `reconciliation` | Filter by workflow area |
| `confidenceLevel` | `string` | No | `High`, `Medium`, `Low` | Filter by confidence level |
| `status` | `string` | No | `pending`, `approved`, `rejected`, `deferred` | Filter by review status |
| `minBenefit` | `number` | No | Non-negative integer | Minimum estimated benefit in dollars |
| `financialYear` | `string` | No | e.g., `FY2024-25` | Filter by financial year |

#### Example Requests

```bash
# List all findings
curl http://localhost:3000/api/accountant/findings \
  -H "Cookie: <session-cookie>"

# List pending sundries findings
curl "http://localhost:3000/api/accountant/findings?workflowArea=sundries&status=pending" \
  -H "Cookie: <session-cookie>"

# List high-value findings (>= $50,000 benefit)
curl "http://localhost:3000/api/accountant/findings?minBenefit=50000" \
  -H "Cookie: <session-cookie>"

# List high-confidence deductions for FY2024-25
curl "http://localhost:3000/api/accountant/findings?workflowArea=deductions&confidenceLevel=High&financialYear=FY2024-25" \
  -H "Cookie: <session-cookie>"
```

### Response

#### Success (200)

```json
{
  "findings": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "transactionId": "TXN-001234",
      "date": "2024-11-15",
      "description": "Software development contractor payment",
      "amount": 45000,
      "currentClassification": "Contractor Expenses",
      "suggestedClassification": "R&D Expenditure",
      "suggestedAction": "Review for R&D Tax Incentive eligibility under Division 355 ITAA 1997. Verify four-element test compliance.",
      "confidence": {
        "score": 82,
        "level": "High",
        "factors": [
          {
            "factor": "Category classification confidence: 85%",
            "impact": "positive",
            "weight": 0.4
          },
          {
            "factor": "R&D eligibility confidence: 78%",
            "impact": "positive",
            "weight": 0.25
          },
          {
            "factor": "Documentation appears adequate",
            "impact": "positive",
            "weight": 0.15
          }
        ]
      },
      "legislationRefs": [
        {
          "section": "Division 355",
          "title": "R&D Tax Incentive eligibility and offset calculation",
          "url": "https://www.legislation.gov.au/..."
        },
        {
          "section": "s 355-25",
          "title": "Core R&D activities definition",
          "url": "https://www.legislation.gov.au/..."
        }
      ],
      "reasoning": "AI forensic analysis flagged this transaction for sundries review. R&D assessment: Contractor work involves systematic experimentation on novel software architecture. Primary category: Contractor Expenses.",
      "financialYear": "FY2024-25",
      "estimatedBenefit": 19575,
      "status": "pending",
      "createdAt": "2026-02-10T08:30:00.000Z",
      "updatedAt": "2026-02-10T08:30:00.000Z"
    }
  ],
  "total": 1
}
```

#### Response Fields (per finding)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID of the finding |
| `transactionId` | `string` | Xero transaction identifier |
| `date` | `string` | Transaction date (ISO 8601) |
| `description` | `string` | Transaction narration |
| `amount` | `number` | Transaction amount in AUD |
| `currentClassification` | `string \| null` | Current GL category from Xero |
| `suggestedClassification` | `string \| null` | AI-suggested reclassification |
| `suggestedAction` | `string \| null` | AI-recommended action |
| `confidence.score` | `number` | Weighted confidence score (0--100) |
| `confidence.level` | `string` | `"High"`, `"Medium"`, or `"Low"` |
| `confidence.factors` | `array` | Individual confidence factor details |
| `legislationRefs` | `array` | Relevant legislation references with URLs |
| `reasoning` | `string` | Full AI reasoning text |
| `financialYear` | `string` | Financial year (e.g., `"FY2024-25"`) |
| `estimatedBenefit` | `number` | Estimated tax benefit in AUD |
| `status` | `string` | `"pending"`, `"approved"`, `"rejected"`, or `"deferred"` |
| `createdAt` | `string` | ISO 8601 creation timestamp |
| `updatedAt` | `string` | ISO 8601 last-updated timestamp |

### Error Cases

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Invalid `workflowArea` value | `{ "error": "workflowArea must be one of: sundries, deductions, fbt, div7a, documents, reconciliation" }` |
| 400 | Invalid `confidenceLevel` value | `{ "error": "confidenceLevel must be one of: High, Medium, Low" }` |
| 400 | Invalid `status` value | `{ "error": "status must be one of: pending, approved, rejected, deferred" }` |
| 400 | Invalid `minBenefit` value | `{ "error": "minBenefit must be a non-negative number" }` |
| 401 | Not authenticated | `{ "error": "Authentication required" }` |
| 500 | Database error | `{ "error": "<error message>", "operation": "fetch_accountant_findings" }` |

---

## POST /api/accountant/findings

Create a new finding manually (used by the forensic audit system for programmatic insertion).

### Purpose

Inserts a single finding into `accountant_findings`. This endpoint is primarily used by internal systems rather than direct user interaction. Finding generation from forensic results should use the `/generate` endpoint instead.

### Request

```
POST /api/accountant/findings
Content-Type: application/json
```

#### Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowArea` | `string` | Yes | One of: `sundries`, `deductions`, `fbt`, `div7a`, `documents`, `reconciliation` |
| `transactionId` | `string` | Yes | Xero transaction identifier |
| `transactionDate` | `string` | Yes | Transaction date (ISO 8601 format) |
| `description` | `string` | Yes | Transaction description |
| `amount` | `number` | Yes | Transaction amount in AUD |
| `confidenceScore` | `number` | Yes | Confidence score (0--100) |
| `confidenceLevel` | `string` | Yes | `"High"`, `"Medium"`, or `"Low"` |
| `reasoning` | `string` | Yes | AI reasoning text |
| `financialYear` | `string` | Yes | Financial year (e.g., `"FY2024-25"`) |
| `currentClassification` | `string` | No | Current GL category |
| `suggestedClassification` | `string` | No | Suggested reclassification |
| `suggestedAction` | `string` | No | Recommended action |
| `confidenceFactors` | `array` | No | Array of `{ factor, impact, weight }` objects |
| `legislationRefs` | `array` | No | Array of `{ section, title, url }` objects |
| `estimatedBenefit` | `number` | No | Estimated tax benefit in AUD (defaults to 0) |

#### Example Request

```bash
curl -X POST http://localhost:3000/api/accountant/findings \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "workflowArea": "deductions",
    "transactionId": "TXN-005678",
    "transactionDate": "2024-12-01",
    "description": "Office equipment purchase",
    "amount": 18500,
    "confidenceScore": 72,
    "confidenceLevel": "Medium",
    "reasoning": "Transaction appears to qualify for instant asset write-off under Subdivision 328-D ITAA 1997.",
    "financialYear": "FY2024-25",
    "currentClassification": "Capital Equipment",
    "suggestedClassification": "Instant Asset Write-Off",
    "estimatedBenefit": 4625
  }'
```

### Response

#### Success (201)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "Finding created successfully"
}
```

### Error Cases

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Missing required field | `{ "error": "<fieldName> is required" }` |
| 400 | Invalid `workflowArea` value | `{ "error": "workflowArea must be one of: sundries, deductions, fbt, div7a, documents, reconciliation" }` |
| 400 | Invalid `confidenceLevel` value | `{ "error": "confidenceLevel must be one of: High, Medium, Low" }` |
| 400 | `confidenceScore` out of range | `{ "error": "confidenceScore must be between 0 and 100" }` |
| 401 | Not authenticated | `{ "error": "Authentication required" }` |
| 500 | Database error | `{ "error": "<error message>", "operation": "create_accountant_finding" }` |

---

## PATCH /api/accountant/findings/[id]/status

Update the review status of a finding (approve, reject, defer, or reset to pending).

### Purpose

Implements the accountant review workflow. Supports status transitions in any direction. When a finding is approved and email notifications are enabled for the tenant, an email notification is sent to the configured address.

### Request

```
PATCH /api/accountant/findings/{id}/status
Content-Type: application/json
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` (UUID) | The finding ID |

#### Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | `string` | Yes | New status: `"approved"`, `"rejected"`, `"deferred"`, or `"pending"` |
| `reason` | `string` | No | Reason for rejection (stored as `rejection_reason`) |
| `accountantNotes` | `string` | No | Additional notes from the accountant |

#### Example Requests

```bash
# Approve a finding
curl -X PATCH http://localhost:3000/api/accountant/findings/f47ac10b-58cc-4372-a567-0e02b2c3d479/status \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "status": "approved",
    "accountantNotes": "Confirmed R&D eligibility with client. Four-element test satisfied."
  }'

# Reject a finding with reason
curl -X PATCH http://localhost:3000/api/accountant/findings/f47ac10b-58cc-4372-a567-0e02b2c3d479/status \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "status": "rejected",
    "reason": "Expenditure is routine maintenance, not eligible R&D under Division 355."
  }'

# Defer a finding for later review
curl -X PATCH http://localhost:3000/api/accountant/findings/f47ac10b-58cc-4372-a567-0e02b2c3d479/status \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "status": "deferred"
  }'

# Reset a finding to pending
curl -X PATCH http://localhost:3000/api/accountant/findings/f47ac10b-58cc-4372-a567-0e02b2c3d479/status \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "status": "pending"
  }'
```

### Response

#### Success (200)

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "approved",
  "message": "Finding approved successfully",
  "updatedAt": "2026-02-10T14:22:00.000Z"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID of the updated finding |
| `status` | `string` | New status value |
| `message` | `string` | Confirmation message |
| `updatedAt` | `string` | ISO 8601 timestamp of the update |

### Side Effects

- **Approval:** Sets `approved_at` timestamp. If `tax_alert_preferences` has `email_notifications` enabled for the tenant, sends an email notification to the configured `notification_email`.
- **Rejection:** Stores the `rejection_reason` if provided.
- **All transitions:** Updates `updated_at` timestamp.

### Error Cases

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Missing `status` | `{ "error": "status is required" }` |
| 400 | Invalid `status` value | `{ "error": "status must be one of: approved, rejected, deferred, pending" }` |
| 401 | Not authenticated | `{ "error": "Authentication required" }` |
| 404 | Finding not found | `{ "error": "Finding not found", "findingId": "<id>" }` |
| 500 | Database error | `{ "error": "<error message>", "operation": "update_finding_status" }` |

---

## POST /api/accountant/reports/generate

Generate an Excel report from accountant findings.

### Purpose

Creates a downloadable Excel workbook with three sheets: Summary, Findings Detail, and Legislation References. The response is a binary file download, not JSON.

### Request

```
POST /api/accountant/reports/generate
Content-Type: application/json
```

#### Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenantId` | `string` | Yes | Xero tenant ID |
| `format` | `string` | Yes | Must be `"excel"` |
| `workflowAreas` | `string[]` | No | Filter by areas. Valid values: `sundries`, `deductions`, `fbt`, `div7a`, `documents`, `reconciliation`. Defaults to all areas. |
| `statuses` | `string[]` | No | Filter by statuses. Defaults to `["approved"]`. |
| `financialYear` | `string` | No | Filter by financial year (e.g., `"FY2024-25"`) |
| `organizationName` | `string` | No | Organisation name for the report header |
| `abn` | `string` | No | Australian Business Number for the report header |

#### Example Requests

```bash
# Generate report with approved findings only (default)
curl -X POST http://localhost:3000/api/accountant/reports/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "tenantId": "abc123-def456-ghi789",
    "format": "excel",
    "organizationName": "Acme Pty Ltd",
    "abn": "12 345 678 901"
  }' \
  --output accountant-report.xlsx

# Generate report including all statuses for FY2024-25
curl -X POST http://localhost:3000/api/accountant/reports/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "tenantId": "abc123-def456-ghi789",
    "format": "excel",
    "statuses": ["approved", "pending", "deferred"],
    "financialYear": "FY2024-25",
    "organizationName": "Acme Pty Ltd",
    "abn": "12 345 678 901"
  }' \
  --output accountant-report.xlsx

# Generate report for Division 7A findings only
curl -X POST http://localhost:3000/api/accountant/reports/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "tenantId": "abc123-def456-ghi789",
    "format": "excel",
    "workflowAreas": ["div7a"],
    "statuses": ["approved", "pending"],
    "organizationName": "Acme Pty Ltd"
  }' \
  --output div7a-report.xlsx
```

### Response

#### Success (200)

Binary Excel file with the following HTTP headers:

```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="accountant-findings-Acme-Pty-Ltd-1707564000000.xlsx"
Content-Length: <file-size-in-bytes>
```

The response body is the raw Excel binary data. Use `--output` with curl or handle as a blob in JavaScript.

#### No Matching Findings (404)

When no findings match the specified filters:

```json
{
  "error": "No findings match the specified filters. Try adjusting your criteria."
}
```

### Error Cases

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Missing or non-string `tenantId` | `{ "error": "tenantId is required and must be a string" }` |
| 400 | Invalid JSON body | `{ "error": "Invalid JSON body" }` |
| 400 | `format` is not `"excel"` | `{ "error": "format must be \"excel\"" }` |
| 401 | Not authenticated | `{ "error": "Authentication required" }` |
| 404 | No findings match filters | `{ "error": "No findings match the specified filters. Try adjusting your criteria." }` |
| 500 | Generation or database error | `{ "error": "<error message>", "operation": "generateAccountantReport" }` |

---

## Common Types

### WorkflowArea

```typescript
type WorkflowArea = 'sundries' | 'deductions' | 'fbt' | 'div7a' | 'documents' | 'reconciliation'
```

### FindingStatus

```typescript
type FindingStatus = 'pending' | 'approved' | 'rejected' | 'deferred'
```

### ConfidenceLevel

```typescript
type ConfidenceLevel = 'High' | 'Medium' | 'Low'
```

### ConfidenceFactor

```typescript
interface ConfidenceFactor {
  factor: string        // Description of the factor
  impact: 'positive' | 'negative'  // Whether this supports or undermines confidence
  weight: number        // Weight in the scoring formula (0.0 to 1.0)
}
```

### LegislationRef

```typescript
interface LegislationRef {
  section: string  // e.g., "Division 355", "s 8-1"
  title: string    // e.g., "R&D Tax Incentive eligibility and offset calculation"
  url: string      // Deep link to legislation.gov.au
}
```

### GenerateResult

```typescript
interface GenerateResult {
  status: 'complete'
  created: number
  skipped: number
  byArea: Record<WorkflowArea, number>
  message: string
}
```

---

## Error Responses

All error responses follow a consistent structure:

```json
{
  "error": "Human-readable error message",
  "operation": "operation_name",
  "details": {}
}
```

### Standard HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (new finding) |
| 400 | Validation error (missing/invalid parameters) |
| 401 | Authentication required |
| 404 | Resource not found |
| 500 | Internal server error |

### Validation Errors (400)

Returned when required parameters are missing or invalid. The `error` field contains a specific message indicating which parameter failed validation.

### Authentication Errors (401)

Returned when no valid session is present. In single-user mode, authentication is not required for endpoints that support it.

### Not Found Errors (404)

Returned when a specific finding or resource cannot be located. The response includes the relevant identifier.

### Internal Errors (500)

Returned for unexpected failures including database errors, connection issues, or unhandled exceptions. The error message is sanitised for production but includes an `operation` field for debugging.

---

> **Disclaimer:** This documentation describes an analytical tool and does not constitute tax, financial, or legal advice. All findings and recommendations should be reviewed by a registered tax agent or qualified tax professional before any action is taken.
