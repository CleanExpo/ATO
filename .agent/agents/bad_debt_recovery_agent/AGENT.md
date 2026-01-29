---
name: bad-debt-recovery-agent
description: Bad debt tax deduction and GST recovery agent. Identifies unpaid invoices from bankrupt/insolvent debtors and manages tax deductions under Section 25-35 ITAA 1997 and GST adjustments under Division 21 GST Act.
capabilities:
  - bad_debt_identification
  - insolvency_tracking
  - gst_adjustment_calculation
  - write_off_documentation
  - recovery_tracking
bound_skills:
  - australian_tax_law_research
  - xero_api_integration
default_mode: PLANNING
fuel_cost: 30-100 PTS
max_iterations: 3
---

# Bad Debt Recovery Agent

The Bad Debt Recovery Agent identifies and manages tax benefits when customers fail to pay invoices due to bankruptcy, insolvency, or inability to recover debt. This agent ensures you claim all entitled deductions and GST recoveries.

## Tax Benefits Available

### 1. Income Tax Deduction (Section 25-35 ITAA 1997)
Write off the full debt amount as a tax deduction against assessable income.

### 2. GST Recovery (Division 21 GST Act 1999)
Claim back the GST component (1/11th) previously remitted to the ATO on unpaid invoices.

## When Debts Become "Bad"

A debt is considered **bad** (not just doubtful) when:

| Trigger Event | Evidence Required |
|--------------|-------------------|
| Customer bankruptcy | Notice of bankruptcy from trustee |
| Company liquidation | Creditor's notice, ASIC records |
| Company receivership | Receiver's advice on expected recovery |
| Untraceable debtor | Evidence of attempts to locate |
| Long-term non-payment | 12+ months overdue (for GST) |
| Deed of arrangement | Formal insolvency arrangement |
| Part X agreement | Personal insolvency agreement |

## Key Eligibility Criteria

### For Income Tax Deduction

| Requirement | Details |
|-------------|---------|
| **Assessable Income** | Debt must have been included in assessable income (accruals basis) |
| **Genuine Debt** | Legal entitlement to receive payment |
| **Actually Bad** | More than doubtful - unlikely to be recovered |
| **Written Off** | Formally written off before end of income year |
| **Not Forgiven** | Must be write-off, not debt forgiveness |

### For GST Recovery

| Requirement | Details |
|-------------|---------|
| **Non-Cash GST** | Must report GST on accruals (non-cash) basis |
| **GST Remitted** | GST was previously paid to ATO for this sale |
| **Unpaid** | Customer hasn't paid (in whole or part) |
| **Bad or 12+ Months** | Debt written off OR overdue for 12+ months |

## Assessment Workflow

### Phase 1: Receivable Analysis
Scan Xero for overdue invoices and insolvency indicators.

```xml
<receivable_scan>
  <overdue_invoices>
    <invoice id="INV-001" customer="ABC Pty Ltd" amount="$11,000" days_overdue="450"/>
    <invoice id="INV-002" customer="XYZ Corp" amount="$5,500" days_overdue="180"/>
    <invoice id="INV-003" customer="Bankrupt Co" amount="$22,000" status="BANKRUPTCY"/>
  </overdue_invoices>
  <insolvency_indicators>
    <indicator type="ASIC_NOTICE" customer="Bankrupt Co" date="2025-09-15"/>
    <indicator type="RETURNED_MAIL" customer="ABC Pty Ltd" date="2025-06-20"/>
  </insolvency_indicators>
</receivable_scan>
```

### Phase 2: Bad Debt Classification
```xml
<bad_debt_assessment>
  <debt>
    <customer>Bankrupt Co</customer>
    <invoice_id>INV-003</invoice_id>
    <total_amount>$22,000</total_amount>
    <gst_component>$2,000</gst_component>
    <ex_gst_amount>$20,000</ex_gst_amount>
    <days_overdue>520</days_overdue>
    <insolvency_status>BANKRUPTCY</insolvency_status>
    <expected_recovery>$0</expected_recovery>
    <bad_debt_amount>$22,000</bad_debt_amount>
  </debt>
  <triggers>
    <trigger type="BANKRUPTCY" date="2025-09-15"/>
    <trigger type="12_MONTHS_OVERDUE" date="2025-08-01"/>
  </triggers>
  <classification>BAD_DEBT</classification>
  <confidence>HIGH</confidence>
</bad_debt_assessment>
```

### Phase 3: Tax Benefit Calculation
```xml
<tax_benefit_calculation>
  <debt_amount>$22,000</debt_amount>
  
  <!-- Income Tax Deduction -->
  <income_tax_deduction>
    <deductible_amount>$22,000</deductible_amount>
    <corporate_tax_rate>25%</corporate_tax_rate>
    <tax_saving>$5,500</tax_saving>
    <legislation>Section 25-35 ITAA 1997</legislation>
  </income_tax_deduction>
  
  <!-- GST Recovery -->
  <gst_adjustment>
    <gst_component>$2,000</gst_component>
    <decreasing_adjustment>$2,000</decreasing_adjustment>
    <cash_recovery>$2,000</cash_recovery>
    <legislation>Division 21 GST Act 1999</legislation>
  </gst_adjustment>
  
  <!-- Combined Benefit -->
  <total_benefit>
    <tax_saving>$5,500</tax_saving>
    <gst_recovery>$2,000</gst_recovery>
    <total>$7,500</total>
  </total_benefit>
</tax_benefit_calculation>
```

### Phase 4: Write-Off Documentation
```xml
<write_off_documentation>
  <requirements>
    <requirement status="REQUIRED">Written record of write-off decision</requirement>
    <requirement status="REQUIRED">Date of write-off (before FY end)</requirement>
    <requirement status="REQUIRED">Debtor identification</requirement>
    <requirement status="REQUIRED">Debt amount and description</requirement>
    <requirement status="RECOMMENDED">Evidence of collection attempts</requirement>
    <requirement status="RECOMMENDED">Insolvency documentation</requirement>
  </requirements>
  <xero_actions>
    <action>Create credit note or write-off transaction</action>
    <action>Allocate to bad debt expense account</action>
    <action>Record GST adjustment in BAS</action>
    <action>Maintain audit trail documentation</action>
  </xero_actions>
</write_off_documentation>
```

## Important Rules

### Timing Requirements

⚠️ **Critical**: The write-off must be documented **before the end of the income year** in which you claim the deduction.

| Action | Deadline |
|--------|----------|
| Write-off decision | Before 30 June (FY end) |
| Documentation of decision | Before 30 June (FY end) |
| Record in accounting system | Before tax return lodgment |
| GST adjustment claim | In BAS for period of write-off |

### What Does NOT Count as Bad Debt

| Excluded | Reason |
|----------|--------|
| Debt forgiveness | Different tax treatment |
| Debt waiver | Not a bad debt |
| Compromise/settlement | Partial recovery rules apply |
| Debt sold | No longer owned |
| Provision only | Must be actual write-off |

### Cash Basis Businesses

⚠️ If your business reports income on a **cash basis**, you generally **cannot** claim a bad debt deduction because:
- The income was never included in assessable income
- No deduction available for something not previously taxed

However, you may still be able to claim GST adjustments if:
- You report GST on accruals basis (separate from income basis)
- The debt meets bad debt criteria

## Recovery Tracking

If a previously written-off debt is later recovered:

```xml
<recovery_event>
  <original_write_off>
    <date>2024-06-15</date>
    <amount>$11,000</amount>
    <deduction_claimed>$11,000</deduction_claimed>
  </original_write_off>
  <recovery>
    <date>2026-03-10</date>
    <amount_recovered>$3,300</amount_recovered>
    <tax_treatment>Include in assessable income (FY2025-26)</tax_treatment>
    <gst_treatment>Increasing adjustment required</gst_treatment>
  </recovery>
</recovery_event>
```

## GST Adjustment Calculation

### Decreasing Adjustment (Claim Back GST)
```
GST Recovery = Bad Debt Amount × 1/11
```

**Example**:
- Invoice: $11,000 (incl. GST)
- GST Component: $11,000 × 1/11 = $1,000
- GST Recovery: $1,000 (refund on next BAS)

### 12-Month Rule

Even if you haven't formally written off the debt, you can claim a GST decreasing adjustment if:
- The debt has been **overdue for 12 months or more**
- You account for GST on a non-cash basis

This is useful when debts are doubtful but not yet confirmed as bad.

## Output Format

```xml
<bad_debt_report>
  <financial_year>FY2024-25</financial_year>
  <entity>
    <abn>XX XXX XXX XXX</abn>
    <name>Entity Name</name>
    <accounting_basis>ACCRUALS</accounting_basis>
    <gst_basis>NON_CASH</gst_basis>
  </entity>
  
  <identified_bad_debts>
    <debt>
      <customer>Bankrupt Customer Pty Ltd</customer>
      <reason>Liquidation - no assets</reason>
      <total_owing>$33,000</total_owing>
      <write_off_date>2025-06-28</write_off_date>
      <income_deduction>$33,000</income_deduction>
      <gst_recovery>$3,000</gst_recovery>
      <documentation_status>COMPLETE</documentation_status>
    </debt>
  </identified_bad_debts>
  
  <potential_bad_debts>
    <debt>
      <customer>Slow Payer Corp</customer>
      <days_overdue>380</days_overdue>
      <eligible_for_gst_adjustment>true</eligible_for_gst_adjustment>
      <note>12+ months overdue - GST adjustment available</note>
    </debt>
  </potential_bad_debts>
  
  <summary>
    <total_bad_debt_deduction>$33,000</total_bad_debt_deduction>
    <tax_saving_at_25>$8,250</tax_saving_at_25>
    <gst_recovery>$3,000</gst_recovery>
    <total_benefit>$11,250</total_benefit>
  </summary>
  
  <actions_required>
    <action priority="1">Document write-off decision before June 30</action>
    <action priority="2">Process credit notes in Xero</action>
    <action priority="3">Include GST adjustment in June BAS</action>
    <action priority="4">Retain insolvency notices for audit</action>
  </actions_required>
</bad_debt_report>
```

## Xero Integration

### Identifying Candidates
1. Pull all receivables > 90 days overdue
2. Flag invoices > 365 days (GST auto-eligible)
3. Cross-reference with ASIC insolvency notices
4. Check for returned mail indicators

### Processing Write-Offs
1. Create credit note or direct write-off
2. Allocate to "Bad Debt Expense" account (mapped to P&L)
3. Ensure GST is correctly reversed
4. Add notes with supporting evidence

## Legislation References

### Income Tax
- **Section 25-35 ITAA 1997** - Bad debts deduction
- **Section 63(2) ITAA 1936** - Partial recovery rules
- **TD 94/39** - Determining when debts are bad
- **TR 92/18** - Bad debts and insolvency

### GST
- **Division 21 GST Act 1999** - Bad debts adjustments
- **GSTR 2000/2** - GST and bad debts
- **GSTR 2003/8** - Adjustments for partly paid debts

### Insolvency
- **Bankruptcy Act 1966** - Personal insolvency
- **Corporations Act 2001** - Company insolvency
