---
description: Review carry-forward losses, shareholder loans, and personal capital contributions
---

# Loss Analysis Workflow

This workflow analyzes accumulated tax losses, personal capital contributions, and shareholder loan positions to optimize tax outcomes.

## Prerequisites

1. Access to Xero Balance Sheet and P&L data
2. Understanding of personal funds contributed
3. Knowledge of ownership structure

## Workflow Steps

### 1. Extract Historical Data
From Xero, extract:
// turbo
- Profit & Loss statements (all financial years)
- Balance Sheet (current)
- Director's loan / Related party loan accounts
- Capital / Equity accounts

### 2. Calculate Accumulated Losses
For each financial year:
- Identify revenue losses
- Identify capital losses
- Calculate total accumulated position

### 3. Test Loss Eligibility
For companies, apply:
- **Continuity of Ownership Test (COT)**
  - Have same persons maintained majority interests?
- **Same Business Test (SBT)** (if COT fails)
  - Is the company carrying on the same business?

### 4. Analyze Personal Contributions
Review personal funds injected into the business:
- How were they recorded in Xero?
- Are they classified as loans or capital?
- Is there documentation for loans?

### 5. Division 7A Assessment
For shareholder loans (FROM shareholder TO company):
- Is there a written loan agreement?
- Are minimum repayments being made?
- What is the Division 7A benchmark interest rate?

For shareholder loans (FROM company TO shareholder):
- Is there compliance with Division 7A?
- Are repayments on track?
- Is there deemed dividend exposure?

### 6. Evaluate Strategies
Analyze options for:
- Timing of loss utilization
- Loan documentation improvements
- Repayment vs forgiveness implications
- Capital vs loan reclassification

### 7. Generate Loss Analysis Report
Produce comprehensive report including:
- Accumulated loss position
- Eligibility for carry-forward
- Personal contribution analysis
- Division 7A compliance status
- Recommended strategies

## Output

```xml
<loss_analysis_report>
  <summary>
    <total_accumulated_losses>$XXX,XXX</total_accumulated_losses>
    <losses_eligible_carryforward>$XXX,XXX</losses_eligible_carryforward>
    <future_tax_value>$XX,XXX</future_tax_value>
    <personal_contributions>$XX,XXX</personal_contributions>
    <division_7a_compliant>Yes|No</division_7a_compliant>
  </summary>
  
  <loss_position>
    <fy year="FY2021-22">
      <revenue_loss>$XX,XXX</revenue_loss>
      <capital_loss>$X,XXX</capital_loss>
      <cot_satisfied>Yes</cot_satisfied>
    </fy>
    <!-- Additional years -->
  </loss_position>
  
  <capital_contributions>
    <contribution date="YYYY-MM-DD" amount="$XX,XXX">
      <current_classification>Suspense</current_classification>
      <recommended_classification>Director Loan</recommended_classification>
      <documentation_required>Loan agreement</documentation_required>
    </contribution>
  </capital_contributions>
  
  <division_7a_status>
    <outstanding_balance>$XX,XXX</outstanding_balance>
    <benchmark_rate>8.77%</benchmark_rate>
    <minimum_repayment>$X,XXX/year</minimum_repayment>
    <compliant>No - no written agreement</compliant>
    <action_required>Execute loan agreement before lodgment</action_required>
  </division_7a_status>
  
  <strategies>
    <strategy priority="1" urgency="high">
      <title>Document Director Loan</title>
      <description>Create complying Division 7A loan agreement</description>
      <benefit>Avoid deemed dividend treatment</benefit>
    </strategy>
    <strategy priority="2" urgency="medium">
      <title>Preserve Loss Position</title>
      <description>Maintain ownership continuity for COT</description>
      <benefit>$XX,XXX future tax saving when profitable</benefit>
    </strategy>
  </strategies>
  
  <professional_review>
    <item>Division 7A loan agreement drafting</item>
    <item>Debt forgiveness implications if loan forgiven</item>
    <item>Same business test if ownership changes</item>
  </professional_review>
</loss_analysis_report>
```

## Key Concepts

### Tax Loss Value
```
Accumulated Losses: $125,000
Corporate Tax Rate: 25%
Future Tax Saving: $125,000 × 25% = $31,250

When the business becomes profitable, these losses
offset income, saving $31,250 in future tax.
```

### Division 7A Compliance
For loans TO company FROM shareholder:
- Document with formal loan agreement
- Include interest rate clause (8.77% FY2024-25)
- Outline repayment terms

For loans FROM company TO shareholder:
- Make minimum yearly repayments
- Execute complying loan agreement
- OR face deemed dividend treatment

### Personal Capital Options

| Option | Tax Treatment | Considerations |
|--------|---------------|----------------|
| **Loan** | Repayable, interest deductible | Division 7A applies |
| **Equity** | Not repayable as such | No interest, no repayment |
| **Forgiveness** | Debt forgiveness rules | May reduce losses |

## Follow-Up Actions

1. **Document any undocumented loans** with written agreements
2. **Review Xero classifications** for accuracy
3. **Consult tax professional** on optimal structure
4. **Plan for profitability** to utilize losses
