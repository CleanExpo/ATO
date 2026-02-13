---
description: End-to-end new client onboarding workflow from Xero connection through first forensic scan and results delivery
---

# New Client Setup Workflow

Orchestrates the complete new client onboarding experience, coordinating multiple agents to take a user from zero to their first actionable tax insight.

## Prerequisites

- User has signed up and verified email
- User has a Xero account with at least one organisation
- Gemini AI API key is configured (for forensic analysis)

## Workflow Steps

### 1. Consent & Connection

Execute the consent flow and Xero OAuth connection.

- Present APP 1 Collection Notice (Privacy Act 1988 compliance)
- Obtain cross-border AI processing consent (APP 8)
- Initiate Xero OAuth flow with READ-ONLY scopes
- Verify connection and list available organisations
- Let user select which organisations to analyse

*Agent: client-onboarding-agent, xero-connector*

### 2. Historical Data Sync

Sync 2-5 financial years of transaction history from Xero.

- Batch sync transactions (50-100 per page)
- Fetch chart of accounts, contacts, bank accounts
- Store in Supabase cache tables (tenant-scoped, RLS-protected)
- Report progress to user (transactions synced / estimated total)

*Agent: xero-auditor*

### 3. Data Quality Assessment

Run data quality checks before investing in AI analysis.

- Score completeness, accuracy, consistency, timeliness, uniqueness
- Flag critical issues (missing contacts, no GST codes, unreconciled items)
- If quality score < 50: recommend Xero cleanup before proceeding
- If quality score ≥ 50: proceed with confidence level caveat

*Agent: data-quality-agent*

### 4. Entity Profile Detection

Determine entity characteristics for personalised analysis.

- Entity type (company, trust, individual, partnership)
- GST registration status and BAS frequency
- Employee/contractor count (SG obligations)
- Financial year history (amendment period calculation)
- Related entities (for group analysis later)

*Agent: client-onboarding-agent, abn-entity-lookup skill*

### 5. First Forensic Scan

Launch the Gemini AI forensic analysis across all synced transactions.

- Batch process transactions (50 per Gemini call)
- Classify across all 16 engines: deductions, R&D, Div 7A, losses, FBT, PSI, etc.
- Generate recommendations with dollar values and legislation references
- Monitor cost and rate limits (15 req/min free tier)

*Agent: xero-auditor (data), forensic-analyzer (AI)*

### 6. Compliance Calendar Initialisation

Set up personalised compliance calendar based on entity profile.

- Calculate relevant deadlines (BAS, SG, income tax, FBT, R&D)
- Apply tax agent vs self-lodger due dates
- Calculate amendment period windows for filed FYs
- Set up initial alert schedule

*Agent: compliance-calendar-agent*

### 7. Results Walkthrough

Present findings and guide user through the platform.

- Show top 3 opportunities by dollar value
- Explain each finding in plain language
- Navigate to relevant dashboard pages
- Suggest next steps: review with accountant, run specific deep-dive analyses
- Offer to generate accountant report

*Agent: client-onboarding-agent*

## Output

```xml
<onboarding_complete>
  <user_id>user_123</user_id>
  <completed_at>2026-02-13T09:25:00+11:00</completed_at>
  <total_duration_minutes>25</total_duration_minutes>

  <organisations_connected>2</organisations_connected>
  <transactions_synced>8450</transactions_synced>
  <financial_years_covered>4</financial_years_covered>

  <data_quality_score>82</data_quality_score>

  <first_scan_results>
    <total_opportunities>15</total_opportunities>
    <total_estimated_value>127500</total_estimated_value>
    <top_opportunity>R&D Tax Offset: $43,500 (Division 355)</top_opportunity>
    <critical_compliance_issues>2</critical_compliance_issues>
  </first_scan_results>

  <calendar_deadlines_set>8</calendar_deadlines_set>
  <amendment_windows_open>3</amendment_windows_open>

  <next_steps>
    <step>Review R&D eligible activities in /dashboard/rnd</step>
    <step>Address Division 7A compliance in /dashboard/accountant/div7a</step>
    <step>Generate accountant report via /dashboard/accountant</step>
  </next_steps>
</onboarding_complete>
```

## Follow-Up Workflows

- `/tax-audit` — Deep-dive forensic audit on specific areas
- `/rnd-assessment` — Detailed R&D Tax Incentive claim preparation
- `/send-to-accountant` — Generate and email professional report
- `/loss-analysis` — Loss carry-forward optimisation
