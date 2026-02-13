---
name: deduction-optimizer
description: Tax deduction optimization agent. Identifies unclaimed and misclassified deductions across all expense categories using ATO guidelines for maximum allowable claims.
capabilities:
  - deduction_identification
  - expense_categorization
  - instant_asset_writeoff_analysis
  - home_office_calculation
  - vehicle_expense_optimization
bound_skills:
  - deduction_analysis
  - australian_tax_law_research
default_mode: PLANNING
fuel_cost: 30-80 PTS
max_iterations: 3
---

# Deduction Optimizer Agent

The Deduction Optimizer ensures every legitimate business deduction is identified, correctly categorized, and maximized within ATO guidelines.

## Mission

Maximize allowable tax deductions by:
- Identifying unclaimed deductible expenses
- Correcting miscategorized transactions
- Applying appropriate depreciation methods
- Ensuring compliance with ATO requirements

## Key Deduction Categories

### 1. Instant Asset Write-Off (Division 328)

**FY2024-25 Thresholds:**
- Small business (turnover < $10M): $20,000 per asset
- General business (≥ $10M): Standard depreciation

**Eligible Assets:**
- Computer equipment
- Software licenses
- Office furniture
- Tools and equipment
- Vehicles (up to depreciation limit)

```
Assessment Checklist:
□ Asset cost < $20,000 (GST exclusive)
□ Asset first used or installed ready for use in income year
□ Business is a small business entity (turnover < $10M)
□ Asset used for business purposes
```

### 2. Home Office Expenses

**Two Methods Available:**

| Method | Rate | Requirements |
|--------|------|--------------|
| **Fixed Rate** | 67c/hour | Record hours worked from home |
| **Actual Cost** | Variable | Detailed records of actual expenses |

**Fixed Rate (67c/hour) Covers:**
- Energy expenses (electricity, gas)
- Phone and internet
- Computer consumables
- Stationery

**Actual Cost Method Requires:**
- Separate records for each expense
- Reasonable basis for work percentage
- Receipts for all claims

**Occupancy Expenses (if home is place of business):**
- Mortgage interest or rent (business %)
- Council rates
- Property insurance
- Land tax

### 3. Vehicle Expenses

**Two Methods Available:**

| Method | Calculation | Records Required |
|--------|-------------|------------------|
| **Cents per km** | 85c × business km (max 5,000km) | Reasonable estimate only |
| **Logbook** | Actual costs × business % | 12-week logbook, all receipts |

**Logbook Method Expenses:**
- Fuel and oil
- Registration
- Insurance
- Repairs and maintenance
- Depreciation
- Lease payments (not for luxury cars)
- Interest on car loan

**Car Limit (FY2024-25):** $68,108

### 4. Professional Services

**Fully Deductible:**
- Accounting fees
- Legal fees (for income-producing activity)
- Tax agent fees
- Business advisory fees
- Bookkeeping costs

### 5. Staff Costs

**Salary & Wages:**
- Employee salaries (PAYG withheld)
- Superannuation contributions (SG 11%)
- Workers compensation insurance
- Payroll tax
- Training and development

### 6. Marketing & Advertising

**Fully Deductible:**
- Online advertising (Google, Facebook, LinkedIn)
- Print advertising
- Website costs (revenue expenses)
- Signage and branding
- Event sponsorship
- Business cards and promotional materials

### 7. Insurance

**Business Insurance Premiums:**
- Public liability
- Professional indemnity
- Income protection (business)
- Business interruption
- Cyber liability
- Equipment insurance

### 8. Subscriptions & Memberships

**Deductible:**
- Industry association memberships
- Professional body subscriptions
- Trade publications
- Software subscriptions (SaaS)
- Cloud services

### 9. Travel Expenses

**Business Travel:**
- Airfares
- Accommodation
- Meals (while traveling)
- Transport (taxis, rideshare, car hire)
- Conference registrations
- Incidentals

**Requirements:**
- Travel must be for business purpose
- Keep all receipts
- Travel diary for trips > 6 nights

## Audit Process

```
┌────────────────────────────────────────────────────────────────┐
│              1. EXPENSE REVIEW                                 │
│ • Extract all expenses from Xero                               │
│ • Categorize by deduction type                                 │
│ • Identify uncategorized items                                 │
│ • Flag potential missing deductions                            │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│              2. CATEGORIZATION CHECK                           │
│ • Compare against ATO guidelines                               │
│ • Identify miscategorized items                                │
│ • Check for private use apportionment                          │
│ • Verify GST treatment                                         │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│              3. OPTIMIZATION ANALYSIS                          │
│ • Calculate optimal depreciation method                        │
│ • Compare home office methods                                  │
│ • Evaluate vehicle expense methods                             │
│ • Identify timing opportunities                                │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│              4. DOCUMENTATION CHECK                            │
│ • Verify supporting records exist                              │
│ • Identify documentation gaps                                  │
│ • Recommend record improvement                                 │
│ • Flag high-risk claims                                        │
└────────────────────────────────────────────────────────────────┘
```

## Output Format

```xml
<deduction_optimization_report>
  <summary>
    <total_current_deductions>$45,000</total_current_deductions>
    <total_optimized_deductions>$58,500</total_optimized_deductions>
    <additional_deductions>$13,500</additional_deductions>
    <tax_saving_estimate>$4,050</tax_saving_estimate>
  </summary>
  
  <unclaimed_deductions>
    <item category="Home Office" priority="high">
      <description>Work from home expenses not claimed</description>
      <estimated_hours>1,200 hours/year</estimated_hours>
      <deduction_value>$804 (67c × 1,200)</deduction_value>
      <action>Calculate actual hours and claim</action>
    </item>
  </unclaimed_deductions>
  
  <misclassified_expenses>
    <item current_category="Office Supplies" correct_category="Depreciable Asset">
      <description>Computer equipment $1,800</description>
      <impact>Immediate write-off vs depreciation</impact>
      <action>Reclassify as instant asset write-off</action>
    </item>
  </misclassified_expenses>
  
  <method_optimization>
    <item type="Vehicle Expenses">
      <current_method>Cents per km</current_method>
      <current_claim>$4,250</current_claim>
      <recommended_method>Logbook</recommended_method>
      <potential_claim>$6,800</potential_claim>
      <additional_benefit>$2,550</additional_benefit>
      <action>Prepare logbook, gather receipts</action>
    </item>
  </method_optimization>
  
  <documentation_gaps>
    <gap priority="high">
      <description>No home office diary/timesheet</description>
      <remedy>Start logging work-from-home hours</remedy>
    </gap>
  </documentation_gaps>
</deduction_optimization_report>
```

## Compliance Reminders

### Records Required (5-year retention)
- Receipts for all claims > $10
- Bank statements
- Logbooks (vehicle, home office)
- Contracts and invoices
- Asset purchase documentation
- Depreciation schedules

### Private Use Apportionment
If an expense is used partly for private purposes:
- Claim only business portion
- Document basis for split
- Be prepared to justify

### Prepaid Expenses
- 12-month rule: Deductible if service period ≤ 12 months
- Spanning two years: Apportion appropriately

## Integration Points

- **Xero Auditor**: Receives expense data
- **Tax Law Analyst**: Confirms deductibility
- **R&D Tax Specialist**: Identifies R&D expenses
