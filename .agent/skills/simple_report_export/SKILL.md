---
name: simple-report-export
description: Simple report generation without Google Cloud - uses Gmail App Password or local file export (PDF, Excel, Word-compatible formats)
version: 1.0.0
---

# Simple Report Export Skill

Generate professional tax optimization reports without requiring Google Cloud Console setup.

## Two Methods Available

### Method 1: Gmail App Password (Simple SMTP)
Uses your existing Gmail account with an App Password - no Cloud Console needed.

### Method 2: Local File Export
Generates files locally that you can email manually from any client.

---

## Method 1: Gmail App Password Setup

### Prerequisites
1. A Gmail account (you probably already have one)
2. Two-Factor Authentication (2FA) enabled on your Google account

### Step 1: Enable 2FA (if not already)
1. Go to https://myaccount.google.com/security
2. Click "2-Step Verification"
3. Follow the setup process

### Step 2: Create App Password
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" as the app
3. Select "Other" as the device, name it "ATO Tax App"
4. Click "Generate"
5. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

### Step 3: Add to Environment
```env
# Gmail SMTP (Simple - no Cloud Console needed)
GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop  # No spaces
ACCOUNTANT_EMAIL=accountant@firm.com.au
```

### How It Works
Uses Node.js Nodemailer to send via Gmail SMTP:
```javascript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

await transporter.sendMail({
  from: process.env.GMAIL_USER,
  to: process.env.ACCOUNTANT_EMAIL,
  subject: 'Tax Optimization Analysis - Action Required',
  html: reportContent,
  attachments: [
    { filename: 'Tax_Report.pdf', path: './reports/tax_report.pdf' },
    { filename: 'Financial_Summary.xlsx', path: './reports/summary.xlsx' }
  ]
});
```

---

## Method 2: Local File Export

Generate files locally and email them yourself.

### Generated Files

| File | Format | Use |
|------|--------|-----|
| `Tax_Optimization_Report.docx` | Word | Full report with legislation |
| `Financial_Summary.xlsx` | Excel | Calculations spreadsheet |
| `Tax_Report.pdf` | PDF | Print-ready version |
| `Email_Draft.txt` | Text | Copy-paste into your email |

### Output Location
```
C:\ATO\ato-app\reports\
├── Tax_Optimization_Report_2026-01-19.docx
├── Financial_Summary_2026-01-19.xlsx
├── Tax_Report_2026-01-19.pdf
└── Email_Draft_2026-01-19.txt
```

### Dependencies
```bash
npm install docx exceljs pdfkit nodemailer
```

---

## Configuration

### Environment Variables (.env.local)
```env
# ----------------------------------------------------------------
# SIMPLE EMAIL (Gmail App Password - no Cloud Console needed)
# ----------------------------------------------------------------
# Get App Password from: https://myaccount.google.com/apppasswords

GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password

# ----------------------------------------------------------------
# ACCOUNTANT DETAILS
# ----------------------------------------------------------------

ACCOUNTANT_NAME=Your Accountant Name
ACCOUNTANT_EMAIL=accountant@firm.com.au
ACCOUNTANT_FIRM=Accounting Firm Pty Ltd

# ----------------------------------------------------------------
# YOUR DETAILS
# ----------------------------------------------------------------

BUSINESS_NAME=Your Business Name
BUSINESS_ABN=XX XXX XXX XXX
YOUR_NAME=Your Name
YOUR_PHONE=04XX XXX XXX
```

---

## Workflow Commands

### Export to Local Files
```bash
/export-report
```
Generates Word, Excel, and PDF files in the `reports/` folder.

### Send via Gmail (with App Password)
```bash
/email-accountant
```
Sends email directly via Gmail SMTP.

### Preview Only
```bash
/export-report --preview
```
Shows what will be generated without creating files.

---

## Email Template (Copy-Paste Ready)

When using local export, an email draft is generated:

```
Subject: Tax Optimization Analysis - [Business Name] - $XX,XXX Potential Recovery

Dear [Accountant Name],

Please find attached a comprehensive tax optimization analysis identifying 
$XX,XXX in potential tax benefits for [Business Name].

KEY FINDINGS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. R&D Tax Incentive (Div 355)        $XX,XXX
2. Bad Debt Deductions (S.25-35)      $XX,XXX
3. Loss Carry-Forward (Div 36)        $XX,XXX
4. SBITO (S.328-355)                  $1,000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL POTENTIAL RECOVERY:             $XX,XXX

URGENT DEADLINES:
⚠️ R&D Registration: April 30, 2026
⚠️ Bad Debt Write-off: Before June 30

ATTACHMENTS:
📄 Tax_Optimization_Report.pdf - Full analysis with legislation
📊 Financial_Summary.xlsx - Detailed calculations

Please review and advise on next steps.

Best regards,
[Your Name]
[Phone]

---
Generated by ATO Tax Optimization Suite
```

---

## Comparison

| Feature | Gmail App Password | Local Export |
|---------|-------------------|--------------|
| Setup Complexity | Simple | Very Simple |
| Cloud Console | ❌ Not needed | ❌ Not needed |
| Auto-send | ✅ Yes | ❌ Manual |
| Attachments | ✅ Auto-attached | ✅ You attach |
| Email Client | Gmail | Any |

---

## Recommended: Start with Local Export

For immediate use:
1. Run `/export-report` to generate files
2. Open your email client
3. Attach the files and send

When ready for automation:
1. Create Gmail App Password
2. Add to `.env.local`
3. Run `/email-accountant` for direct send
