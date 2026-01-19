---
description: Identify unclaimed and misclassified tax deductions for maximum allowable claims
---

# Deduction Scan Workflow

This workflow scans all business expenses to identify unclaimed deductions and misclassified transactions for maximum allowable claims.

## Prerequisites

1. Access to Xero expense data
2. Understanding of business activities
3. Records of home office usage (if applicable)

## Workflow Steps

### 1. Extract Expense Data
From Xero, extract all expense transactions:
// turbo
- Operating expenses
- Asset purchases
- Professional fees
- Travel expenses
- Subscriptions

### 2. Categorize Deductions
Classify expenses into deduction categories:
- **Instant Asset Write-Off** (assets < $20,000)
- **Depreciable Assets** (assets ≥ $20,000)
- **Operating Expenses** (fully deductible)
- **Prepaid Expenses** (12-month rule)
- **Home Office** (fixed rate or actual)
- **Vehicle Expenses** (cents/km or logbook)

### 3. Identify Unclaimed Deductions
Scan for missing claims:
- Home office expenses (67c/hour)
- Vehicle business use
- Professional memberships
- Training and development
- Insurance premiums
- Software subscriptions

### 4. Check Asset Treatment
Review asset purchases:
- Are items < $20,000 instantly written off?
- Are larger assets being depreciated correctly?
- Is the small business pool being used?

### 5. Evaluate Method Optimization
Compare calculation methods:
- **Home Office**: Fixed rate (67c/hour) vs actual cost
- **Vehicle**: Cents per km (85c) vs logbook method
- Recommend optimal method based on circumstances

### 6. Verify Documentation
Check supporting records exist for:
- All claimed expenses
- Home office hours (diary/timesheet)
- Vehicle business use (logbook)
- Private use apportionment

### 7. Generate Deduction Report
Produce comprehensive report including:
- Current vs optimized deductions
- Additional deductions identified
- Method recommendations
- Documentation gaps

## Output

```xml
<deduction_scan_report>
  <summary>
    <current_deductions>$XX,XXX</current_deductions>
    <optimized_deductions>$XX,XXX</optimized_deductions>
    <additional_deductions>$X,XXX</additional_deductions>
    <tax_saving>$X,XXX</tax_saving>
  </summary>
  
  <category_breakdown>
    <category name="Operating Expenses">
      <current>$XX,XXX</current>
      <optimized>$XX,XXX</optimized>
    </category>
    <category name="Home Office">
      <current>$0</current>
      <optimized>$X,XXX</optimized>
      <method>Fixed rate 67c/hour × X,XXX hours</method>
    </category>
    <category name="Vehicle">
      <current>$X,XXX</current>
      <optimized>$X,XXX</optimized>
      <method>Logbook method recommended</method>
    </category>
    <category name="Assets">
      <current>$X,XXX</current>
      <optimized>$X,XXX</optimized>
      <note>X items eligible for instant write-off</note>
    </category>
  </category_breakdown>
  
  <unclaimed_deductions>
    <item category="Home Office" priority="high">
      <description>Work from home expenses not claimed</description>
      <estimated_hours>1,200 hours/year</estimated_hours>
      <deduction>$804</deduction>
      <action>Start tracking hours, claim for eligible periods</action>
    </item>
    <item category="Subscriptions" priority="medium">
      <description>Software subscriptions not claimed</description>
      <annual_cost>$2,400</annual_cost>
      <action>Ensure correctly categorized in Xero</action>
    </item>
  </unclaimed_deductions>
  
  <method_comparisons>
    <comparison type="Home Office">
      <fixed_rate>$804 (1,200 hours × 67c)</fixed_rate>
      <actual_cost>$1,200 (estimated)</actual_cost>
      <recommendation>Consider actual cost method if records available</recommendation>
    </comparison>
    <comparison type="Vehicle">
      <cents_per_km>$4,250 (5,000km × 85c max)</cents_per_km>
      <logbook>$6,800 (estimated)</logbook>
      <recommendation>Start logbook if higher business use expected</recommendation>
    </comparison>
  </method_comparisons>
  
  <documentation_checklist>
    <item required="true" status="missing">Home office hours diary</item>
    <item required="true" status="missing">Vehicle logbook (12 weeks)</item>
    <item required="true" status="complete">Receipt retention (5 years)</item>
  </documentation_checklist>
  
  <recommendations>
    <recommendation priority="1">
      Implement home office hour tracking immediately
    </recommendation>
    <recommendation priority="2">
      Start 12-week vehicle logbook for next FY
    </recommendation>
    <recommendation priority="3">
      Review asset purchases for instant write-off eligibility
    </recommendation>
  </recommendations>
</deduction_scan_report>
```

## Key Deduction Rates (FY2024-25)

| Deduction Type | Rate/Threshold |
|----------------|----------------|
| Instant Asset Write-Off | $20,000 per asset |
| Home Office (fixed rate) | 67c per hour |
| Vehicle (cents per km) | 85c per km (max 5,000km) |
| Car Depreciation Limit | $68,108 |
| Superannuation Guarantee | 11% |

## Common Missed Deductions

| Category | Examples |
|----------|----------|
| **Home Office** | Electricity, internet, phone, stationery |
| **Vehicle** | Fuel, registration, insurance, maintenance |
| **Professional** | Accounting, legal, tax agent fees |
| **Insurance** | Public liability, professional indemnity |
| **Subscriptions** | Software, industry memberships, publications |
| **Training** | Courses, conferences, professional development |

## Follow-Up Actions

1. **Start tracking home office hours** from today
2. **Begin vehicle logbook** for 12-week period
3. **Review Xero categorizations** for accuracy
4. **Ensure receipts retained** for 5 years
