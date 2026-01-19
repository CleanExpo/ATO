---
description: Run a comprehensive Xero data audit to identify tax optimization opportunities
---

# Tax Audit Workflow

This workflow performs a complete audit of your Xero accounting data to identify misclassifications, anomalies, and tax optimization opportunities.

## Prerequisites

1. Xero OAuth 2.0 connection established
2. Access to relevant financial years in Xero
3. Read-only scopes authorized

## Workflow Steps

### 1. Connect to Xero
Ensure Xero API connection is active and tenant ID is available.

### 2. Extract Financial Data
The Xero Auditor agent will extract:
// turbo
- Chart of Accounts
- Trial Balance (per FY)
- Profit & Loss (per FY)
- Balance Sheet
- All bank transactions
- Manual journals
- Invoices and payments
- Fixed asset register

### 3. Analyze Chart of Accounts
Review account structure for:
- Correct account classifications
- Missing tax-relevant accounts
- Proper liability vs equity treatment for director loans

### 4. Audit Transactions
For each financial year, scan transactions for:
- **Misclassifications**: Expenses in wrong categories
- **R&D Indicators**: Transactions that may qualify for R&D offset
- **Anomalies**: Unusual entries requiring review
- **Missing GST**: Transactions without tax codes

### 5. Identify Optimization Opportunities
Flag items including:
- Potential R&D expenditure (→ 43.5% refund)
- Unclaimed deductions
- Asset write-off opportunities
- Incorrectly classified personal contributions

### 6. Generate Audit Report
Produce comprehensive report with:
- Summary of findings
- Priority-ranked action items
- Recommended corrections (for manual implementation)
- Supporting legislation references

## Output

```xml
<tax_audit_report>
  <summary>
    <financial_years_audited>FY2022-23, FY2023-24, FY2024-25</financial_years_audited>
    <total_transactions>X,XXX</total_transactions>
    <issues_identified>XX</issues_identified>
    <potential_savings>$XX,XXX</potential_savings>
  </summary>
  
  <misclassifications priority="high">
    <!-- Transactions requiring reclassification -->
  </misclassifications>
  
  <rnd_candidates priority="critical">
    <!-- Potential R&D expenditure -->
  </rnd_candidates>
  
  <unclaimed_deductions priority="medium">
    <!-- Deductions not being claimed -->
  </unclaimed_deductions>
  
  <recommendations>
    <!-- Prioritized action items -->
  </recommendations>
</tax_audit_report>
```

## Follow-Up Workflows

After completing the tax audit:
- `/rnd-assessment` - Deep dive on R&D candidates
- `/deduction-scan` - Detailed deduction analysis
- `/loss-analysis` - Review loss and capital positions
