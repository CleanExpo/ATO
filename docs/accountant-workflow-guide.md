# Accountant Workflow Intelligence -- User Guide

> **Disclaimer:** This documentation describes an analytical tool and does not constitute tax, financial, or legal advice. All findings and recommendations should be reviewed by a registered tax agent or qualified tax professional before any action is taken. This software is not registered with the Tax Practitioners Board and does not provide tax agent services within the meaning of the Tax Agent Services Act 2009 (TASA).

---

## Table of Contents

1. [Overview](#1-overview)
2. [Getting Started](#2-getting-started)
3. [Workflow Areas](#3-workflow-areas)
4. [Reviewing Findings](#4-reviewing-findings)
5. [Taking Action](#5-taking-action)
6. [Notifications](#6-notifications)
7. [Report Generation](#7-report-generation)
8. [Confidence Scoring](#8-confidence-scoring)
9. [Legislation References](#9-legislation-references)
10. [Frequently Asked Questions](#10-frequently-asked-questions)

---

## 1. Overview

The **Accountant Workflow Intelligence** system is an AI-powered tax analysis dashboard that transforms raw forensic audit data from Xero into structured, actionable findings for accountants and tax professionals.

### What It Does

The system analyses transaction data from connected Xero organisations using AI forensic analysis, then routes each flagged transaction into one of six specialised workflow areas. For each finding, it provides:

- A suggested classification or action
- An AI-generated confidence score
- Relevant Australian legislation references
- An estimated financial benefit (where applicable)

The accountant reviews each finding, decides whether to approve, reject, or defer it, and can then generate a comprehensive Excel report for client delivery.

### Integration with the Forensic Analysis Pipeline

The Accountant Workflow system sits downstream of the Xero forensic analysis pipeline:

1. **Xero Data Sync** -- Historical transactions are cached from connected Xero organisations.
2. **AI Forensic Analysis** -- Gemini AI analyses each transaction for R&D eligibility, deduction confidence, FBT implications, Division 7A risk, documentation gaps, and category accuracy.
3. **Finding Generation** -- The forensic-to-findings mapper (`forensic-findings-mapper`) transforms forensic analysis results into structured accountant findings, routing each to the appropriate workflow area.
4. **Accountant Review** -- Findings are presented for professional review, action, and reporting.

### The Six Workflow Areas

| Area | Description |
|------|-------------|
| **Sundries** | R&D candidates and Division 355 eligible expenditure |
| **Deductions (Section 8-1)** | General deduction eligibility under s 8-1 ITAA 1997 |
| **Fringe Benefits Tax** | FBT liability analysis under FBTAA 1986 |
| **Division 7A** | Private company loans, payments, and deemed dividends |
| **Source Documents** | Missing or insufficient substantiation under s 900-70 |
| **Reconciliation** | GL account misclassifications and low-confidence categorisations |

---

## 2. Getting Started

### Prerequisites

Before using the Accountant Workflow system, ensure the following are in place:

1. **Active Xero Connection** -- At least one Xero organisation must be connected via OAuth. Navigate to `/dashboard/connect` to establish a connection if one does not exist.
2. **Completed Forensic Audit** -- The AI forensic analysis must have run against the connected organisation's transaction data. Visit `/dashboard/forensic-audit` to initiate an analysis if none has been performed.
3. **Authentication** -- You must be logged in with access to the relevant tenant. In single-user mode, authentication is handled automatically.

### Accessing the Dashboard

Navigate to:

```
/dashboard/accountant
```

This is the Accountant Workflow Hub -- the central landing page. From here you can:

- View summary statistics (total findings, high-value findings, average confidence)
- Generate findings from forensic audit results
- Access each of the six workflow areas
- Export findings to an Excel report

### Generating Findings from Forensic Audit Results

1. On the Accountant Workflow Hub, locate the **"Generate from Audit"** section.
2. Ensure a Xero tenant is detected (displayed automatically from your connected organisations).
3. Click **"Generate from Audit"**.
4. The system will process all forensic analysis results and create findings across the six workflow areas.
5. A summary will display showing how many findings were created and how many were skipped (duplicates).

You can safely re-run generation after new forensic analyses. The system deduplicates on the combination of `transaction_id`, `organization_id`, and `workflow_area`, so existing findings are never overwritten.

---

## 3. Workflow Areas

Each workflow area contains findings of a specific type, routed by a priority-based classification system. Routing priority is: R&D/Division 355 > Division 7A > FBT > Source Documents > Deductions > Reconciliation. The first matching rule wins.

### 3.1 Sundries (R&D / Division 355)

**Route condition:** Transaction flagged as an R&D candidate or meeting Division 355 criteria.

**What appears here:**
- Transactions with potential R&D Tax Incentive eligibility
- Expenditure that may qualify under Division 355 ITAA 1997
- Items requiring assessment against the four-element test (outcome unknown, systematic approach, new knowledge, scientific method)

**Key legislation:**
- Division 355 ITAA 1997 -- R&D Tax Incentive
- s 355-25 ITAA 1997 -- Core R&D activities definition

**Typical accountant actions:**
- Verify whether the expenditure relates to genuine R&D activities
- Assess compliance with the four-element test per s 355-25
- Determine eligibility for the 43.5% refundable tax offset (turnover below $20M) or the 38.5% non-refundable offset (turnover $20M or above)
- Consider the $4M annual refundable offset cap (s 355-100(3))

**Estimated benefit calculation:** 43.5% of the claimable amount (R&D offset rate for base rate entities).

### 3.2 Deductions (Section 8-1)

**Route condition:** Transaction is classified as fully deductible but the AI's deduction confidence is below 80%.

**What appears here:**
- Expenditure where the deduction classification is uncertain
- Items requiring verification of the business purpose nexus
- Potential deductions that need professional judgement on eligibility

**Key legislation:**
- s 8-1 ITAA 1997 -- General deductions provision (positive and negative limbs)

**Typical accountant actions:**
- Confirm the expenditure satisfies the positive limb of s 8-1 (incurred in gaining or producing assessable income, or necessarily incurred in carrying on a business)
- Verify the expenditure does not fall within the negative limbs (capital, private, or domestic in nature)
- Check that the financial year is within the amendment period (s 170 TAA 1953)

**Estimated benefit calculation:** 25% of the claimable amount (small business corporate tax rate).

### 3.3 Fringe Benefits Tax (FBT)

**Route condition:** Transaction flagged with FBT implications.

**What appears here:**
- Transactions that may give rise to an FBT liability
- Items requiring Type 1 vs Type 2 classification
- Potential exempt or concessionally-treated benefits

**Key legislation:**
- s 136 FBTAA 1986 -- FBT liability assessment and rate
- s 67 FBTAA 1986 -- Shortfall penalties for incorrect FBT returns

**Typical accountant actions:**
- Determine whether the benefit is a Type 1 (employer entitled to GST credit, gross-up rate 2.0802) or Type 2 (no GST credit, gross-up rate 1.8868)
- Assess whether any FBT exemptions apply (e.g., minor benefits under $300, work-related items)
- Consider car fringe benefit valuation (statutory formula vs operating cost method)

**Estimated benefit calculation:** 47% of the transaction amount (current FBT rate).

### 3.4 Division 7A

**Route condition:** Transaction flagged with Division 7A risk.

**What appears here:**
- Payments, loans, or debt forgiveness by a private company to shareholders or associates
- Items that may be treated as deemed dividends under s 109D ITAA 1936
- Loan compliance issues (minimum repayment shortfalls, benchmark interest rate deviations)

**Key legislation:**
- Division 7A ITAA 1936 -- Deemed dividends from private company payments
- s 109D ITAA 1936 -- Payments and loans treated as dividends
- s 109E ITAA 1936 -- Minimum yearly repayment requirements
- s 109Y ITAA 1936 -- Distributable surplus cap on deemed dividends

**Typical accountant actions:**
- Verify whether the transaction constitutes a loan, payment, or debt forgiveness under Division 7A
- Check minimum repayment obligations and benchmark interest rate compliance
- Assess whether any safe harbour exclusions apply (s 109RB)
- Consider amalgamation of multiple loans to the same shareholder (s 109E(8))

**Estimated benefit calculation:** 100% of the transaction amount (full deemed dividend exposure).

### 3.5 Source Documents

**Route condition:** Transaction flagged as requiring documentation, and no other higher-priority flag applies.

**What appears here:**
- Transactions lacking adequate source documentation
- Items where substantiation is needed to support a deduction claim
- Record-keeping gaps that may expose the client to audit risk

**Key legislation:**
- s 900-70 ITAA 1997 -- Substantiation requirements for deductions
- s 262A ITAA 1936 -- Record-keeping obligations (5-year retention)

**Typical accountant actions:**
- Request the relevant source documents from the client (invoices, receipts, contracts)
- Verify that existing documentation meets substantiation requirements
- Ensure records are retained for the statutory 5-year period (or longer for CGT assets)

**Estimated benefit calculation:** $0 (compliance item, no direct monetary benefit).

### 3.6 Reconciliation

**Route condition:** Category classification confidence is below 50%.

**What appears here:**
- Transactions where the AI is uncertain about the primary category
- Potential GL account misclassifications
- Items that may be allocated to the wrong expense or revenue code

**Key legislation:**
- s 8-1 ITAA 1997 -- Correct classification is necessary for deduction eligibility

**Typical accountant actions:**
- Review the current GL account allocation
- Verify the correct primary category assignment
- Reclassify the transaction in Xero if appropriate

**Estimated benefit calculation:** 25% of the claimable amount (potential recovery from misclassification).

---

## 4. Reviewing Findings

### Understanding Finding Cards

Each finding is presented as a card containing:

| Element | Description |
|---------|-------------|
| **Transaction ID** | The Xero transaction identifier (monospaced, top-left) |
| **Date** | Transaction date |
| **Financial Year** | The FY to which the transaction belongs (e.g., FY2024-25) |
| **Description** | Transaction narration from Xero |
| **Amount** | Absolute transaction value in AUD |
| **Estimated Benefit** | Calculated tax benefit if the finding is acted upon (displayed in green with a dollar icon) |
| **Current Classification** | The existing GL category from Xero |
| **AI Recommendation** | The suggested reclassification or action |
| **Confidence Badge** | Colour-coded score (High/Medium/Low) with expandable factors |
| **Legislation References** | Clickable badges linking to relevant Act sections |
| **Status Badge** | Current review status (Pending, Approved, Rejected, Deferred) |

### Expanding a Finding

Click **"Show Details"** at the bottom of any finding card to reveal:

- **AI Reasoning** -- The full explanation of why the AI flagged this transaction
- **Legislation References (Full View)** -- Detailed list with clickable deep links to legislation.gov.au or the ATO website
- **Confidence Factors** -- Individual factors that contributed to the confidence score, each showing its weight and whether the impact was positive or negative

### Confidence Scoring Methodology

Confidence scores are calculated using a weighted formula with four components:

| Factor | Weight | Description |
|--------|--------|-------------|
| Category classification confidence | 40% | How confident the AI is about the transaction category |
| R&D eligibility confidence | 25% | R&D-specific assessment confidence (if applicable) |
| Deduction confidence | 20% | How confident the AI is about deduction eligibility |
| Documentation completeness | 15% | Whether required source documents are present |

Scores map to levels as follows:

- **High (80--100):** Strong legislative and precedent support
- **Medium (60--79):** Some support; professional review recommended
- **Low (0--59):** Limited support; additional research required

### Legislation Reference Links

Legislation references appear as colour-coded badges:

| Colour | Act |
|--------|-----|
| Cyan | ITAA 1997 |
| Magenta | ITAA 1936 |
| Yellow | FBTAA 1986 |
| Green | TAA 1953 |

Each badge is clickable and opens the relevant section on legislation.gov.au in a new tab.

---

## 5. Taking Action

### Available Actions

For findings in **Pending** status, three actions are available:

#### Approve

Approving a finding marks it for inclusion in the client report. If email notifications are configured for the tenant, an approval notification is sent to the nominated email address.

Click the green **"Approve"** button. The status updates immediately (optimistic update).

#### Reject

Rejecting a finding excludes it from reports. You may optionally provide a reason.

1. Click the magenta **"Reject"** button.
2. A text input appears for the rejection reason (optional but recommended).
3. Press **Enter** or click **"Confirm"** to submit.
4. Click **"Cancel"** to dismiss the rejection input without rejecting.

#### Defer

Deferring a finding sets it aside for later review. Deferred findings remain in the workflow area but are distinguished by a yellow status badge.

Click the yellow **"Defer"** button. The status updates immediately.

### Changing a Decision

You can change the status of any finding at any time. A previously approved finding can be rejected or deferred, and vice versa. The API accepts status transitions in any direction, including returning a finding to **Pending** status.

### Filtering and Sorting

The **WorkflowFindings** component provides the following controls:

#### Status Filters

- **All** -- Show all findings regardless of status
- **Pending** -- Show only findings awaiting review
- **Approved** -- Show only approved findings
- **Rejected** -- Show only rejected findings
- **Deferred** -- Show only deferred findings

#### High-Value Quick Filter

Click the **"High Value"** toggle (dollar sign icon) to show only findings with an estimated benefit of $50,000 or more. This is useful for prioritising significant items.

#### Sort Controls

- **Sort by Date** -- Chronological order (default, as returned by the server)
- **Sort by Benefit** -- Highest estimated benefit first
- **Sort by Confidence** -- Highest confidence score first

---

## 6. Notifications

### Automatic Notification Triggers

The system automatically creates notifications during finding generation for two categories:

1. **High-Value Findings** -- Any finding with an estimated benefit of $50,000 or more triggers a `high_value_finding` notification with the title "High-Value Finding: $[amount]".
2. **Division 7A Compliance Risks** -- Any finding routed to the `div7a` workflow area triggers a `compliance_risk` notification with the title "Compliance Risk: Division 7A".

Up to 20 notifications are created per generation run.

### Where Notifications Appear

- **Notification Bell** -- In-app notifications appear in the notification bell icon in the dashboard header.
- **Email (Optional)** -- If the tenant has email notifications enabled via `tax_alert_preferences` with a `notification_email` configured, approval actions send an email notification to the nominated address.

### Notification Behaviour

Notifications are created in the background using `after()` from `next/server`, ensuring they do not delay the primary API response. If notification creation fails, the finding generation still succeeds -- notification failures are logged but never block the main workflow.

---

## 7. Report Generation

### Generating an Excel Report

1. On the Accountant Workflow Hub (`/dashboard/accountant`), locate the **"Export Findings Report"** section.
2. Click **"Export Report"**.
3. Select which statuses to include using the checkboxes (default: Approved only). Available options: Approved, Pending, Rejected, Deferred.
4. Click **"Download Excel"**.
5. The report is generated server-side and downloaded as an `.xlsx` file.

### Report Structure

The generated Excel workbook contains three sheets:

#### Sheet 1: Summary

- Organisation name and ABN (if provided)
- Generation timestamp
- Financial year scope
- Statuses included
- **Workflow Area Breakdown** table with columns: Workflow Area, Findings Count, Estimated Benefit, Average Confidence
- **Totals** row aggregating all areas
- TASA 2009 disclaimer at the bottom of the sheet

#### Sheet 2: Findings Detail

One row per finding with the following columns:

| Column | Description |
|--------|-------------|
| Workflow Area | Human-readable area name |
| Transaction ID | Xero transaction identifier |
| Date | Transaction date (dd/mm/yyyy format) |
| Description | Transaction narration |
| Amount | Transaction value (AUD, formatted as currency) |
| Est. Benefit | Estimated tax benefit (AUD, formatted as currency) |
| Confidence | Confidence score (percentage format) |
| Level | High, Medium, or Low |
| Status | Current review status (capitalised) |
| Suggestion | Suggested classification or action |
| Legislation | Semicolon-delimited legislation section references |
| FY | Financial year |
| Rejection Reason | Reason provided when rejecting (if any) |
| Notes | Accountant notes (if any) |

Status values are colour-coded: green for Approved, red for Rejected, amber for Deferred.

The sheet includes auto-filters on all columns for easy data manipulation.

#### Sheet 3: Legislation References

Deduplicated list of all legislation references across all included findings:

| Column | Description |
|--------|-------------|
| Section | Legislation section reference |
| Title | Descriptive title |
| URL | Link to legislation.gov.au |
| Referenced By | Count of findings referencing this section |

Sorted by reference count (most-referenced first).

### Filtering Options

When generating via the API, you can filter by:

- **Statuses** -- Which review statuses to include (default: `['approved']`)
- **Workflow Areas** -- Limit to specific areas (default: all)
- **Financial Year** -- Limit to a specific FY

### Disclaimer

Every generated report includes the following disclaimer on the Summary sheet:

> DISCLAIMER: This report is generated by automated software and does not constitute tax, financial, or legal advice. All findings should be reviewed by a registered tax agent before any action is taken.

---

## 8. Confidence Scoring

### How AI Confidence Is Calculated

The confidence score is a weighted average of up to four factors, each contributing a percentage to the final score:

1. **Category Classification Confidence (40% weight)** -- The AI's confidence in the transaction's primary category assignment. A score of 70% or above has a positive impact; below 70% has a negative impact.

2. **R&D Eligibility Confidence (25% weight)** -- Only included when the transaction is flagged as an R&D candidate. Reflects the AI's confidence in Division 355 eligibility. Scores of 70% or above are positive.

3. **Deduction Confidence (20% weight)** -- The AI's assessment of deduction eligibility under s 8-1. Included when a deduction confidence value is available. Scores of 70% or above are positive.

4. **Documentation Completeness (15% weight)** -- A binary assessment: if the transaction requires documentation that is missing, this factor has a negative impact (scored at 30). If documentation appears adequate, the impact is positive (scored at 80).

The final score is the weighted sum divided by the total weight of included factors, rounded to the nearest integer.

### Positive vs Negative Factors

Each factor is classified as either **positive** (supporting the finding) or **negative** (reducing confidence):

- **Positive factors** are displayed with a green indicator dot
- **Negative factors** are displayed with a magenta indicator dot

### When Professional Review Is Recommended

Professional review is particularly important in the following situations:

- **Low confidence (below 60):** The AI analysis has limited supporting evidence. The finding should be treated as a starting point for further investigation, not a conclusion.
- **High-value findings (estimated benefit above $50,000):** Even with high confidence, material amounts warrant manual verification of legislation applicability and calculations.
- **Complex legislation areas:** Division 7A, FBT Type 1/Type 2 classification, and R&D eligibility all involve nuanced legislative tests that AI analysis may not fully capture.

### Limitations

The confidence scoring system is a computational aid designed to help prioritise review effort. It does not replace professional judgement. Key limitations include:

- Scores are based on pattern analysis of transaction data, not legal interpretation
- The system cannot assess facts and circumstances beyond the data available in Xero
- Legislation changes after the system's knowledge cutoff may not be reflected
- Industry-specific nuances may not be fully captured in general-purpose scoring

---

## 9. Legislation References

### How Legislation References Are Sourced

Legislation references are assigned based on the workflow area to which a finding is routed. Each workflow area has a predefined set of relevant legislation sections. These references are not dynamically derived from the transaction content; rather, they represent the legislative framework applicable to that category of finding.

### Key Acts and Sections

#### Income Tax Assessment Act 1997 (ITAA 1997)

| Section | Topic | Workflow Area |
|---------|-------|---------------|
| Division 355 | R&D Tax Incentive -- eligibility, offset calculation | Sundries |
| s 355-25 | Core R&D activities -- four-element test definition | Sundries |
| s 8-1 | General deductions -- positive and negative limbs | Deductions, Reconciliation |
| s 900-70 | Substantiation requirements for deductions | Source Documents |
| s 355-100(3) | $4M annual refundable R&D tax offset cap | Sundries (high-value R&D) |

#### Income Tax Assessment Act 1936 (ITAA 1936)

| Section | Topic | Workflow Area |
|---------|-------|---------------|
| Division 7A | Deemed dividends from private company payments | Division 7A |
| s 109D | Payments and loans treated as dividends | Division 7A |
| s 109E | Minimum yearly repayment requirements | Division 7A |
| s 109Y | Distributable surplus cap | Division 7A |
| s 262A | Record-keeping obligations (5-year retention) | Source Documents |
| s 100A | Trust distribution reimbursement agreements | Related analysis (trust distribution) |

#### Fringe Benefits Tax Assessment Act 1986 (FBTAA 1986)

| Section | Topic | Workflow Area |
|---------|-------|---------------|
| s 136 | FBT liability assessment and rate | Fringe Benefits Tax |
| s 67 | Shortfall penalties for incorrect FBT returns | Fringe Benefits Tax |

#### Tax Agent Services Act 2009 (TASA 2009)

| Section | Topic | Relevance |
|---------|-------|-----------|
| s 50-5 | Penalty for providing unregistered tax agent services | Disclaimer requirement |
| s 90-5 | Definition of "tax agent service" | System classification |

#### Taxation Administration Act 1953 (TAA 1953)

| Section | Topic | Relevance |
|---------|-------|-----------|
| s 170 | Amendment period for assessments | Deduction engine checks |

### Clicking Legislation References

In the finding card UI, legislation references appear as colour-coded badges. Clicking any badge opens the relevant page on legislation.gov.au in a new browser tab. In the expanded detail view, references are displayed as full cards with the section number, descriptive title, and external link icon.

---

## 10. Frequently Asked Questions

### Q1: How are findings generated?

Findings are generated by the forensic-to-findings mapper, which processes the output of AI forensic analysis. Each analysed transaction is evaluated against a priority-based routing system: R&D candidacy is checked first, then Division 7A risk, FBT implications, documentation gaps, deduction confidence, and finally category confidence. If a transaction matches any routing rule, a finding is created in the corresponding workflow area. Transactions that do not match any rule are skipped.

### Q2: Can I undo an approval or rejection?

Yes. You can change the status of any finding at any time. To revert an approved finding, navigate to the relevant workflow area, locate the finding (you may need to change the status filter to "Approved" or "All"), and click **"Reject"** or **"Defer"**. To return a finding to Pending status, use the API directly with `status: 'pending'`.

### Q3: What does "High Value" mean?

A finding is considered "High Value" when its estimated benefit is $50,000 or more. High-value findings automatically generate notifications during finding generation. The "High Value" toggle in the filtering bar shows only these findings, allowing you to focus on the most material items first.

### Q4: How is the estimated benefit calculated?

The estimated benefit depends on the workflow area:

| Area | Calculation |
|------|-------------|
| Sundries (R&D) | 43.5% of claimable amount (R&D tax offset rate) |
| Deductions | 25% of claimable amount (small business corporate tax rate) |
| FBT | 47% of transaction amount (FBT rate exposure) |
| Division 7A | 100% of transaction amount (full deemed dividend risk) |
| Source Documents | $0 (compliance item) |
| Reconciliation | 25% of claimable amount (potential misclassification recovery) |

These are estimates only and may not reflect the actual benefit for every entity. The applicable corporate tax rate, entity type, and specific circumstances all affect the true benefit.

### Q5: Why don't I see any findings?

Common reasons include:

1. **No Xero connection** -- Ensure a Xero organisation is connected at `/dashboard/connect`.
2. **No forensic audit run** -- The AI forensic analysis must have been completed first. Visit `/dashboard/forensic-audit` to run one.
3. **Findings not generated** -- After a forensic audit, you must click "Generate from Audit" on the Accountant Workflow Hub.
4. **No actionable transactions** -- If no transactions match any routing criteria, no findings are created. This is normal for well-classified ledgers.
5. **Filter is hiding results** -- Check whether a status filter or high-value filter is active.

### Q6: Can I customise the report format?

The current report format is fixed as a three-sheet Excel workbook (Summary, Findings Detail, Legislation References). You can customise which findings appear in the report by selecting status filters (Approved, Pending, Rejected, Deferred) and optionally limiting to specific workflow areas or financial years via the API. The report filename includes the organisation name and a timestamp.

### Q7: Is this tax advice?

No. This system is an analytical tool that identifies potential tax implications and estimated benefits based on AI analysis of transaction data. It does not constitute tax advice, financial advice, or legal advice. All findings and recommendations should be reviewed by a registered tax agent or qualified tax professional before any action is taken. The software is not registered with the Tax Practitioners Board and does not provide tax agent services within the meaning of the Tax Agent Services Act 2009.

### Q8: How often should I generate findings?

Generate findings whenever new forensic analysis results become available -- typically after syncing new Xero data and running a forensic audit. The deduplication mechanism ensures that re-running generation does not create duplicate findings. A typical workflow is:

1. Sync latest Xero data (monthly or quarterly)
2. Run forensic audit on new data
3. Generate findings from audit results
4. Review new findings alongside existing ones

### Q9: What happens when I reject a finding?

Rejected findings are excluded from the default report export (which includes only approved findings). The rejection reason, if provided, is stored with the finding and appears in the report if you choose to include rejected findings in the export. Rejected findings remain visible in the workflow area and can be filtered by the "Rejected" status filter.

### Q10: How are duplicate findings handled?

The system prevents duplicate findings using a composite key of `transaction_id`, `organization_id`, and `workflow_area`. If a finding already exists for a given transaction in a given area for a given organisation, the mapper skips it during generation. Within a single generation batch, the same deduplication applies -- ensuring no two findings share the same key even if the source data contains duplicates.

### Q11: What is the difference between "confidence score" and "confidence level"?

The **confidence score** is a numeric value from 0 to 100 representing the weighted average of multiple AI assessment factors. The **confidence level** is a categorical label derived from the score: High (80--100), Medium (60--79), or Low (0--59). Both are displayed on the confidence badge for each finding.

### Q12: Can I add my own notes to a finding?

Yes. When updating a finding's status via the API, you can include an `accountantNotes` field. Notes are stored with the finding and appear in the "Notes" column of the Excel report. The current UI exposes the rejection reason input but additional notes require an API call.

---

> **Disclaimer:** This documentation describes an analytical tool and does not constitute tax, financial, or legal advice. All findings and recommendations should be reviewed by a registered tax agent or qualified tax professional before any action is taken.
