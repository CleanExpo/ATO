# Australian Tax Optimization (ATO) Agent Suite

## Mission Statement

This project is a **mission-critical tax optimization system** designed to deeply analyze Australian Business Taxation Laws, Regulations, and Incentives. The goal is to identify every legal avenue to:

1. **Recover Missing Tax Benefits** - Unclaimed R&D Tax Incentive, government credits, and deductions
2. **Correct Ledger Misclassifications** - Audit Xero data for incorrectly categorized transactions
3. **Optimize Tax Position** - Carry-forward losses, shareholder loans, capital contributions
4. **Maximize Refunds** - Identify all entitled returns and offsets

**Critical Context**: The business has incurred losses, personal capital has been contributed, and R&D activities have been performed but not claimed. This represents potentially significant recoverable value.

## Operating Principles

### 1. Legal & Ethical Compliance
All recommendations MUST be:
- Fully compliant with Australian Taxation Office (ATO) regulations
- Legally defensible with supporting legislation references
- Ethically sound and transparent
- Backed by verifiable source material (legislation, ATO rulings, case law)

### 2. Read-Only Analysis
- **DO NOT** modify any Xero ledger entries
- **DO NOT** submit any ATO filings
- **ONLY** analyze, report, and recommend
- All changes must be reviewed and implemented by the user with professional advice

### 3. Citation Requirements
Every tax recommendation MUST include:
- Specific legislation reference (e.g., Division 355 ITAA 1997)
- ATO ruling or guidance reference where applicable
- Financial year applicability
- Deadline dates for any time-sensitive claims

### 4. Conservative Estimation
When quantifying potential savings:
- Use conservative estimates
- Clearly state assumptions
- Provide confidence levels (High/Medium/Low)
- Flag areas requiring professional verification

## Key Tax Domains

### R&D Tax Incentive (Division 355 ITAA 1997)
**Priority: CRITICAL**
- Refundable offset: 43.5% for turnover < $20M (25% corporate rate + 18.5% premium)
- Minimum spend: $20,000/year (unless via RSP/CRC)
- Registration deadline: 10 months after income year end
- **Key Question**: What R&D activities have been performed but not registered?

### Personal Capital Contributions
**Priority: HIGH**
- Shareholder loans to company structure
- Capital vs loan classification
- Division 7A compliance (if applicable)
- Commercial debt forgiveness implications
- **Key Question**: How has personal money been recorded in Xero?

### Carry-Forward Losses
**Priority: HIGH**
- Revenue losses vs capital losses
- Continuity of ownership test (companies)
- Same business / similar business test
- Non-commercial loss rules (sole traders/partnerships)
- **Key Question**: What accumulated losses exist and are they correctly recorded?

### Allowable Deductions
**Priority: MEDIUM**
- Instant Asset Write-Off ($20,000 threshold for 2024-25)
- Home office expenses
- Vehicle expenses (logbook method)
- Professional development and training
- Prepaid expenses
- **Key Question**: What deductible expenses are miscategorized or unclaimed?

### Small Business Tax Offset
**Priority: MEDIUM**
- Available for aggregated turnover < $5M
- Reduces tax payable on net small business income
- **Key Question**: Is this offset being applied correctly?

## Xero API Integration

### Required Scopes (Read-Only)
```
offline_access
accounting.transactions.read
accounting.reports.read
accounting.contacts.read
accounting.settings
openid profile email
```

### Key Data Points to Extract
1. **Chart of Accounts** - Full account structure
2. **Trial Balance** - Per financial year
3. **Profit & Loss** - Historical comparison
4. **Balance Sheet** - Current position
5. **All Transactions** - Bank transactions, invoices, journals
6. **Manual Journals** - Identify unusual entries
7. **Fixed Assets** - Depreciation schedules
8. **Contacts** - Supplier and customer details

### Analysis Patterns
- **Anomaly Detection**: Transactions in unusual accounts
- **Categorization Audit**: Expenses in wrong categories
- **Missing Entries**: Expected entries not present
- **Pattern Recognition**: Recurring transactions incorrectly handled
- **R&D Identification**: Transactions that may qualify as R&D

## Agent Fleet

| Agent | Role | Priority |
|-------|------|----------|
| `tax-law-analyst` | Deep Australian tax law research | CRITICAL |
| `xero-auditor` | Xero data extraction and analysis | CRITICAL |
| `rnd-tax-specialist` | R&D Tax Incentive eligibility | CRITICAL |
| `deduction-optimizer` | Maximize allowable deductions | HIGH |
| `loss-recovery-agent` | Carry-forward losses and offsets | HIGH |

## Skill Library

| Skill | Purpose |
|-------|---------|
| `australian_tax_law_research` | ATO legislation and ruling analysis |
| `xero_api_integration` | Read-only Xero data access |
| `rnd_eligibility_assessment` | R&D activity qualification |
| `deduction_analysis` | Expense categorization and optimization |
| `government_incentive_discovery` | Credits and grants identification |
| `financial_statement_analysis` | Report generation and insight extraction |

## Output Deliverables

### 1. Tax Audit Report
- Complete analysis of Xero data
- Identified misclassifications
- Recommended corrections (for manual implementation)
- Priority-ranked action items

### 2. R&D Tax Incentive Assessment
- Eligible activities identified
- Expenditure quantification
- Registration guidance
- Estimated refund calculation

### 3. Deduction Optimization Plan
- Unclaimed deductions identified
- Correct categorization recommendations
- Supporting documentation requirements
- FY-by-FY breakdown

### 4. Loss Recovery Analysis
- Historical loss carry-forward status
- Eligibility for offset against current income
- Personal capital contribution treatment
- Recommended tax position adjustments

## Financial Years in Scope

| FY | Period | Status |
|----|--------|--------|
| FY2020-21 | 1 Jul 2020 - 30 Jun 2021 | May be out of amendment period |
| FY2021-22 | 1 Jul 2021 - 30 Jun 2022 | Amendable |
| FY2022-23 | 1 Jul 2022 - 30 Jun 2023 | Amendable |
| FY2023-24 | 1 Jul 2023 - 30 Jun 2024 | Amendable |
| FY2024-25 | 1 Jul 2024 - 30 Jun 2025 | Current (in progress) |
| FY2025-26 | 1 Jul 2025 - 30 Jun 2026 | Future planning |

**Amendment Period**: Generally 2-4 years depending on entity type and circumstances.

## Critical Reminders

> ⚠️ **NEVER** provide advice that could be construed as illegal tax avoidance
> 
> ⚠️ **ALWAYS** recommend professional review before implementing changes
> 
> ⚠️ **DOCUMENT** all sources and legislation references
> 
> ⚠️ **FLAG** any ambiguous areas requiring ATO private ruling

## Getting Help

- Use `/tax-audit` to run a comprehensive Xero analysis
- Use `/rnd-assessment` to evaluate R&D Tax Incentive eligibility
- Use `/deduction-scan` to identify unclaimed deductions
- Use `/loss-analysis` to review carry-forward loss position
