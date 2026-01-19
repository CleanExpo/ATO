---
name: accountant-report-generator
description: Generates professional tax optimization reports and sends them directly to accountants via Google Workspace (Docs, Sheets, Gmail) with full legislation references and action items.
capabilities:
  - google_docs_report_generation
  - google_sheets_financial_summary
  - gmail_direct_send
  - legislation_reference_compilation
  - action_item_tracking
bound_skills:
  - google_workspace_integration
  - australian_tax_law_research
default_mode: EXECUTION
fuel_cost: 30-100 PTS
max_iterations: 2
---

# Accountant Report Generator Agent

The Accountant Report Generator compiles findings from all tax optimization agents into professional reports and sends them directly to your accountant via Google Workspace.

## Output Products

### 1. Google Docs - Professional Report
A comprehensive PDF-ready report including:
- Executive summary with total potential recovery
- Section-by-section findings with legislation references
- Action items with deadlines
- Supporting evidence and calculations
- Disclaimer and professional review requirements

### 2. Google Sheets - Financial Workbook
A multi-sheet workbook containing:
- Executive Summary dashboard
- R&D Activities register
- Bad Debts schedule
- Loss carry-forward history
- ATO Position calculation
- Deductions itemization

### 3. Gmail - Direct to Accountant
Automated email with:
- Summary of findings
- Key action items
- Deadline alerts
- Attached report and spreadsheet
- Professional formatting

## Report Structure

### Cover Page
```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│              TAX OPTIMIZATION ANALYSIS                     │
│                                                            │
│                    [BUSINESS NAME]                         │
│                ABN: XX XXX XXX XXX                         │
│                                                            │
│              Prepared: [DATE]                              │
│              Financial Year: FY2024-25                     │
│                                                            │
│              TOTAL POTENTIAL RECOVERY                      │
│                    $XX,XXX                                 │
│                                                            │
│              Prepared by: ATO Tax Optimization Suite       │
│              For Professional Review By:                   │
│              [ACCOUNTANT NAME]                             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Section Template
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION X: [BENEFIT NAME]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINDINGS:
• [Finding 1]
• [Finding 2]

POTENTIAL BENEFIT:
┌──────────────────────────────────────────┐
│ [Benefit description]: $XX,XXX          │
└──────────────────────────────────────────┘

LEGISLATION REFERENCE:
┌──────────────────────────────────────────┐
│ Primary: [Section/Division]             │
│ Secondary: [Ruling/Guidance]            │
│ ATO Reference: [Link/Reference]         │
└──────────────────────────────────────────┘

ACTION REQUIRED:
☐ [Action 1] - Deadline: [Date]
☐ [Action 2] - Deadline: [Date]

SUPPORTING EVIDENCE:
• Xero transactions: [References]
• Documentation: [List]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Report Sections

### 1. R&D Tax Incentive (Division 355)
**Legislation**: Division 355 ITAA 1997
**ATO Guidance**: Guide to the R&D Tax Incentive

Contents:
- Eligible activities identified
- Core R&D vs Supporting R&D classification
- Expenditure quantification
- Refundable offset calculation (43.5%)
- Registration deadline alert
- Documentation requirements

### 2. Bad Debt Recovery (Section 25-35)
**Legislation**: Section 25-35 ITAA 1997, Division 21 GST Act 1999
**ATO Ruling**: GSTR 2000/2

Contents:
- Identified bad debts
- Income tax deduction value
- GST recovery calculation
- Write-off documentation checklist
- Timing requirements

### 3. Small Business Income Tax Offset
**Legislation**: Section 328-355 ITAA 1997

Contents:
- Eligibility assessment
- Offset calculation (16% up to $1,000)
- Eligible entities

### 4. Loss Carry-Forward Analysis
**Legislation**: Division 36, Division 165/166 ITAA 1997
**ATO Guidance**: LCR 2019/1 (Similar Business Test)

Contents:
- Accumulated losses by year
- Continuity of ownership test
- Similar Business Test assessment
- Private ruling recommendation
- Loss utilization strategy

### 5. Business Transition (if applicable)
**Legislation**: Section 40-880 ITAA 1997, Division 35

Contents:
- Cessation deductions
- Startup cost deductions
- Personal capital contributions
- ATO position calculation
- Negotiation recommendations

### 6. Other Deductions & Concessions
**Various legislation references**

Contents:
- Instant Asset Write-Off
- FBT exemptions
- CGT concessions
- Energy incentives
- Government grants

### 7. ATO Position Summary
Contents:
- Total recoverable amounts
- Outstanding debts
- Net position
- Recommended approach
- Payment plan options

## Email Content

### Subject Line
```
Tax Optimization Analysis - [Business Name] - $[TOTAL] Potential Recovery - Action Required
```

### Body Structure
```
Dear [Accountant Name],

I have completed a comprehensive tax optimization analysis and identified 
$[TOTAL] in potential tax benefits requiring your professional review.

═══════════════════════════════════════════════════════════════
                     SUMMARY OF FINDINGS
═══════════════════════════════════════════════════════════════

TOTAL POTENTIAL RECOVERY: $XX,XXX

KEY OPPORTUNITIES:
┌─────────────────────────────────────────────────────────────┐
│ 1. R&D Tax Incentive         $XX,XXX (Division 355)        │
│ 2. Bad Debt Deductions       $XX,XXX (Section 25-35)       │
│ 3. Loss Carry-Forward        $XX,XXX (Division 36)         │
│ 4. SBITO                     $1,000  (Section 328-355)     │
│ 5. Other Deductions          $XX,XXX                       │
└─────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════
                     URGENT ACTION ITEMS
═══════════════════════════════════════════════════════════════

⚠️  R&D Registration Deadline: April 30, 2026 (101 days)
⚠️  Bad Debt Write-off Required: Before June 30, 2025
⚠️  Trust Distribution Resolution: Before June 30, 2025

═══════════════════════════════════════════════════════════════
                       ATTACHMENTS
═══════════════════════════════════════════════════════════════

📄 Tax_Optimization_Report_[Date].pdf
   - Full analysis with legislation references
   - Action items and deadlines
   - Supporting documentation

📊 Financial_Summary_[Date].xlsx
   - Detailed calculations
   - R&D activity register
   - Bad debt schedule
   - Loss history

═══════════════════════════════════════════════════════════════
                    QUESTIONS FOR REVIEW
═══════════════════════════════════════════════════════════════

1. Do you agree with the Similar Business Test assessment?
2. Should we request a Private Ruling for loss utilization?
3. What is your recommended ATO engagement strategy?
4. Are there additional opportunities I should consider?

Please let me know your earliest availability to discuss.

Best regards,
[Name]
[Business Name]
[Phone]
[Email]

───────────────────────────────────────────────────────────────
DISCLAIMER: This analysis was prepared using the ATO Tax 
Optimization Suite, an AI-assisted tax analysis tool. All 
findings are indicative only and require professional review 
by a Registered Tax Agent before implementation.
───────────────────────────────────────────────────────────────
```

## Configuration

### Accountant Details
```yaml
accountant:
  name: "Your Accountant Name"
  email: "accountant@firm.com.au"
  firm: "Accounting Firm Pty Ltd"
  
cc:
  - "your.email@example.com"
  
business:
  name: "Your Business Name"
  abn: "XX XXX XXX XXX"
  contact_name: "Your Name"
  phone: "04XX XXX XXX"
  email: "you@example.com"
```

## Usage

### Generate Report Only
```bash
/generate-report
```
Creates Google Doc and Sheet, stores in Drive.

### Send to Accountant
```bash
/send-to-accountant
```
Generates report, spreadsheet, and sends via Gmail.

### Preview Before Sending
```bash
/send-to-accountant --preview
```
Shows report content before sending.

## Integration Points

This agent pulls data from:
- `/tax-audit` findings
- `/rnd-assessment` results
- `/bad-debt-scan` schedule
- `/loss-analysis` calculations
- `/business-transition` position
- `/scout` deadline alerts

All findings are compiled into cohesive, professional documentation suitable for accountant review.
