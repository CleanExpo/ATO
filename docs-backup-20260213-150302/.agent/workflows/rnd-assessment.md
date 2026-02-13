---
description: Evaluate R&D Tax Incentive eligibility and calculate potential refunds
---

# R&D Assessment Workflow

This workflow evaluates your R&D activities for eligibility under Division 355 ITAA 1997 and calculates potential refundable tax offsets.

## Prerequisites

1. Understanding of R&D activities performed
2. Access to Xero data (for expenditure identification)
3. Project documentation (if available)

## Workflow Steps

### 1. Identify Candidate Activities
The R&D Tax Specialist will identify potential R&D activities:
- Review Xero transactions for R&D indicators
- Interview regarding innovation and development work
- Document each candidate activity

### 2. Apply Division 355 Test
For each activity, assess against the four core R&D criteria:

| Criterion | Question |
|-----------|----------|
| Unknown Outcome | Could the outcome be known in advance? |
| Systematic Approach | Was hypothesis-experiment-observation-conclusion followed? |
| New Knowledge | Was new knowledge generated? |
| Scientific Method | Was it based on scientific/technical principles? |

### 3. Classify Activities
Categorize each activity as:
- **Core R&D** - Meets all four criteria
- **Supporting R&D** - Directly supports core activities
- **Not Eligible** - Does not qualify

### 4. Quantify Expenditure
Calculate eligible expenditure per activity:
// turbo
- Salary & wages (× R&D time %)
- Contractor payments
- Direct materials
- Depreciation (R&D assets)
- Overhead allocation

### 5. Calculate Tax Offset
For small business (turnover < $20M):
```
Refundable Offset = Eligible Expenditure × 43.5%
```

### 6. Check Deadlines
Verify registration deadlines:
| Financial Year | Registration Deadline |
|----------------|----------------------|
| FY2023-24 | 30 April 2025 ⚠️ |
| FY2024-25 | 30 April 2026 |

### 7. Generate Assessment Report
Produce comprehensive R&D assessment including:
- Eligible activities with classifications
- Expenditure breakdown by category
- Estimated refund calculations
- Documentation gaps
- Registration guidance

## Output

```xml
<rnd_assessment_report>
  <summary>
    <total_eligible_expenditure>$XX,XXX</total_eligible_expenditure>
    <estimated_refund>$XX,XXX</estimated_refund>
    <activities_eligible>X</activities_eligible>
    <registration_deadline>YYYY-MM-DD</registration_deadline>
  </summary>
  
  <eligible_activities>
    <activity id="RND-001" type="Core R&D" confidence="High">
      <name>Activity Name</name>
      <expenditure>$XX,XXX</expenditure>
      <offset>$X,XXX</offset>
    </activity>
  </eligible_activities>
  
  <financial_year_breakdown>
    <fy year="FY2023-24">
      <expenditure>$XX,XXX</expenditure>
      <offset>$X,XXX</offset>
      <deadline>2025-04-30</deadline>
      <status>Not registered - ACTION REQUIRED</status>
    </fy>
  </financial_year_breakdown>
  
  <documentation_checklist>
    <item required="true" status="missing">Contemporaneous timesheets</item>
    <item required="true" status="partial">Project specifications</item>
  </documentation_checklist>
  
  <next_steps>
    <step priority="1">Register FY2023-24 activities before deadline</step>
    <step priority="2">Implement time tracking for current activities</step>
  </next_steps>
</rnd_assessment_report>
```

## R&D Tax Incentive Quick Reference

| Item | Value |
|------|-------|
| Offset Rate (turnover < $20M) | 43.5% |
| Minimum Expenditure | $20,000/year |
| Registration Deadline | 10 months after FY end |
| Refundable? | Yes (cash refund) |

## Example Calculation

```
Eligible R&D Expenditure: $100,000
Refundable Offset: $100,000 × 43.5% = $43,500

This is a CASH REFUND from the ATO, even if the business is in a loss position!
```

## Follow-Up Actions

1. **Register with AusIndustry** via business.gov.au
2. **Prepare activity descriptions** (max 1,500 words each)
3. **Compile supporting documentation**
4. **Include in company tax return** (R&D schedule)
