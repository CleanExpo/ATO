---
description: Generate professional tax optimization reports and send directly to your accountant via Google Docs, Sheets, and Gmail
---

# /send-to-accountant - Accountant Report Workflow

Generate comprehensive tax optimization reports with full legislation references and send directly to your accountant via Google Workspace.

## What Gets Generated

### 1. Google Docs Report (PDF-ready)
- Executive summary with total potential recovery
- Section-by-section findings
- Complete legislation references
- Action items with deadlines
- Professional formatting

### 2. Google Sheets Workbook
- Executive Summary dashboard
- R&D Activities register
- Bad Debts schedule
- Loss History tracking
- ATO Position calculation

### 3. Gmail to Accountant
- Summary of all findings
- Key action items highlighted
- Deadline alerts
- Attached report and spreadsheet

## Workflow Steps

### Step 1: Configure Accountant Details
First time only - set up your accountant's contact information:

```yaml
accountant:
  name: "Your Accountant Name"
  email: "accountant@firm.com.au"
  firm: "Accounting Firm Pty Ltd"

your_details:
  name: "Your Name"
  business: "Your Business Name"
  abn: "XX XXX XXX XXX"
  phone: "04XX XXX XXX"
  email: "you@example.com"
```

### Step 2: Connect Google Workspace
Authenticate with Google:
- Visit `/api/auth/google` to connect
- Approve required permissions (Gmail, Docs, Sheets, Drive)
- Tokens stored securely in Supabase

### Step 3: Compile Findings
The report generator pulls from all completed analyses:

| Source | Content |
|--------|---------|
| `/tax-audit` | Xero analysis findings |
| `/rnd-assessment` | R&D Tax Incentive eligibility |
| `/bad-debt-scan` | Bad debt deductions and GST |
| `/loss-analysis` | Carry-forward loss position |
| `/business-transition` | Cessation/pivot analysis |
| `/scout` | Deadline alerts |

### Step 4: Review Before Sending
Preview the email and attachments:

```bash
/send-to-accountant --preview
```

### Step 5: Send to Accountant
Generate and send:

```bash
/send-to-accountant
```

## Report Sections

### Section 1: R&D Tax Incentive
```
Legislation: Division 355 ITAA 1997
ATO Guide: Guide to the R&D Tax Incentive

Findings:
• [Eligible activities identified]
• [Expenditure calculation]

Potential Benefit: $XX,XXX (43.5% refundable offset)

Action Required:
☐ Register with AusIndustry by [Deadline]
☐ Document contemporaneous records
☐ Prepare R&D Tax Schedule
```

### Section 2: Bad Debt Recovery
```
Legislation: Section 25-35 ITAA 1997
GST: Division 21 GST Act 1999
Ruling: GSTR 2000/2

Findings:
• [Identified bad debts]
• [Insolvency notices]

Potential Benefit:
- Income tax deduction: $XX,XXX
- GST recovery: $X,XXX

Action Required:
☐ Document write-off before June 30
☐ Process credit notes in Xero
☐ Include GST adjustment in BAS
```

### Section 3: Loss Carry-Forward
```
Legislation: Division 36 ITAA 1997
Company Tests: Division 165/166 ITAA 1997
Guidance: LCR 2019/1 (Similar Business Test)

Findings:
• Accumulated losses: $XX,XXX
• SiBT Status: [Assessment]

Potential Benefit: $XX,XXX (at applicable tax rate)

Action Required:
☐ Consider Private Ruling request
☐ Document business evolution
☐ Coordinate with return lodgment
```

### Section 4: Business Transition
```
Legislation: Section 40-880 ITAA 1997
Startup: Subdivision 40-E ITAA 1997

Findings:
• Cessation deductions available
• Startup costs identified
• Personal capital contributions

ATO Position:
- Outstanding debt: $XX,XXX
- Recoverable amounts: $XX,XXX
- Net position: $XX,XXX

Action Required:
☐ Lodge all outstanding returns
☐ Compile hardship documentation
☐ Negotiate payment plan
```

### Section 5: Other Opportunities
```
• SBITO: Up to $1,000 (Section 328-355)
• Instant Asset Write-Off: $20,000 threshold
• FBT Exemptions: [Identified items]
• CGT Concessions: [If applicable]
• Government Grants: [Eligible programs]
```

## Email Preview

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TO: accountant@firm.com.au
CC: you@example.com
SUBJECT: Tax Optimization Analysis - Your Business - $52,500 
         Potential Recovery - Action Required

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Dear [Accountant Name],

I have completed a comprehensive tax optimization analysis...

TOTAL POTENTIAL RECOVERY: $52,500

KEY OPPORTUNITIES:
┌─────────────────────────────────────────────────────────────┐
│ 1. R&D Tax Incentive         $15,000 (Division 355)        │
│ 2. Bad Debt Deductions       $11,250 (Section 25-35)       │
│ 3. Loss Carry-Forward        $25,000 (Division 36)         │
│ 4. SBITO                      $1,000 (Section 328-355)     │
│ 5. Other                        $250                       │
└─────────────────────────────────────────────────────────────┘

ATTACHMENTS:
📄 Tax_Optimization_Report_2026-01-19.pdf
📊 Financial_Summary_2026-01-19.xlsx

[Full email body...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Quick Commands

| Command | Action |
|---------|--------|
| `/send-to-accountant` | Generate and send full report |
| `/send-to-accountant --preview` | Preview before sending |
| `/generate-report` | Create report without sending |
| `/generate-report --format=pdf` | Export as PDF |

## Requirements

### Google Cloud Setup
1. Create project in Google Cloud Console
2. Enable APIs: Gmail, Docs, Sheets, Drive
3. Create OAuth 2.0 credentials
4. Configure redirect URI

### Environment Variables
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

## Legislation Quick Reference

The report automatically includes references from:

| Topic | Primary Legislation | Secondary |
|-------|-------------------|-----------|
| R&D Tax | Division 355 ITAA 1997 | Industry Innovation Act |
| Bad Debts | Section 25-35 ITAA 1997 | Division 21 GST Act |
| Loss Carry-Forward | Division 36 ITAA 1997 | LCR 2019/1 |
| SiBT | Division 166 ITAA 1997 | TR 2017/D1 |
| SBITO | Section 328-355 ITAA 1997 | |
| Div 7A | Division 7A ITAA 1936 | PS LA 2010/4 |
| CGT Concessions | Division 152 ITAA 1997 | |
| Blackhole | Section 40-880 ITAA 1997 | |
