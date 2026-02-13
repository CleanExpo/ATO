---
name: historical-trend-analysis
description: Multi-year financial trend comparison, regression detection, and anomaly flagging for tax planning and audit risk assessment
---

# Historical Trend Analysis Skill

Analyses multi-year financial data to identify trends, detect anomalies, and flag year-over-year changes that may indicate audit risk, missed deductions, or tax planning opportunities. Uses Xero historical transaction data and analysis results across multiple financial years.

## When to Use

- Comparing income/expense patterns across 3-5 financial years for trend detection
- Identifying anomalous expense categories that deviate from historical norms
- Detecting revenue growth/decline trends for loss carry-forward planning
- Flagging sudden changes in expense ratios that may trigger ATO benchmarking
- Supporting the Similar Business Test (SBT) with historical consistency evidence
- Assessing amendment worthiness by comparing identified opportunities across FYs
- Providing context for Division 7A compliance (loan balance trends)
- Cash flow forecasting based on historical seasonal patterns

## Analysis Methods

### 1. Year-over-Year (YoY) Comparison

Compare each financial year against the prior year:

| Metric | Calculation | Significance |
|--------|------------|--------------|
| Revenue Growth | (Current - Prior) / Prior × 100 | Loss utilisation, GST threshold |
| Expense Ratio | Total Expenses / Total Revenue | ATO benchmark comparison |
| Category Shift | Category % of Total (current vs prior) | Misclassification detection |
| Net Profit Margin | Net Profit / Revenue × 100 | Loss carry-forward trigger |

### 2. Moving Average

3-year rolling average smooths one-off anomalies:

| Use Case | Window | Alert If |
|----------|--------|----------|
| Revenue trend | 3 years | Current deviates > 20% from average |
| Expense category | 3 years | Category deviates > 30% from average |
| Deduction claims | 3 years | Claims drop > 50% (may indicate missed deductions) |
| Contractor payments | 3 years | Sudden increase > 40% (contractor deeming risk) |

### 3. Anomaly Detection

Flag values that fall outside expected bounds:

| Method | Description | Application |
|--------|------------|-------------|
| Z-score | Standard deviations from mean | Expense category outliers |
| IQR (Interquartile Range) | Values beyond Q1-1.5×IQR or Q3+1.5×IQR | Revenue spikes/dips |
| Percentage change threshold | YoY change exceeding configurable threshold | ATO audit risk triggers |

### 4. Seasonal Pattern Analysis

Identify recurring seasonal patterns in cash flow:

| Pattern | Detection | Use |
|---------|-----------|-----|
| Quarterly spikes | BAS periods showing consistent revenue peaks | Cash flow forecasting |
| Year-end clustering | Expenses concentrated in June | Prepayment detection (s 82KZM) |
| Holiday dips | Consistent revenue drops (Dec/Jan) | Working capital planning |

## Data Sources

| Source | API Endpoint | Fields |
|--------|-------------|--------|
| Historical Transactions | `/api/audit/cached-transactions` | Amount, date, category, account |
| P&L Reports | `/api/xero/reports?reportType=ProfitAndLoss` | Income, expenses by category |
| Year Comparison | `/api/audit/year-comparison` | Pre-computed YoY metrics |
| Analysis Results | `/api/audit/analysis-results` | AI-classified findings per FY |
| Trends | `/api/audit/trends` | Pre-computed trend data |

## Trend Classification

| Trend | Criteria | Tax Implication |
|-------|----------|----------------|
| **Stable Growth** | Revenue growing 5-15% YoY consistently | Healthy; normal deduction patterns |
| **Rapid Growth** | Revenue growing > 30% YoY | May breach SG maximum contribution base; payroll tax threshold risk |
| **Decline** | Revenue falling > 10% YoY | Loss carry-forward planning; consider COT/SBT |
| **Volatile** | Revenue swinging > 25% YoY alternating | Cash flow risk; consider PAYG instalment variation |
| **Flat** | Revenue within ±5% YoY | Stable; check for inflation erosion of real deductions |
| **Seasonal** | Consistent intra-year pattern | Align BAS reporting with cash flow |

## Output Format

```xml
<trend_analysis>
  <entity_id>org_456</entity_id>
  <analysis_period>FY2020-21 to FY2024-25</analysis_period>

  <revenue_trend>
    <classification>stable_growth</classification>
    <average_yoy_growth>8.3</average_yoy_growth>
    <years>
      <year fy="FY2020-21" revenue="850000" />
      <year fy="FY2021-22" revenue="920000" yoy_change="8.2" />
      <year fy="FY2022-23" revenue="1010000" yoy_change="9.8" />
      <year fy="FY2023-24" revenue="1080000" yoy_change="6.9" />
      <year fy="FY2024-25" revenue="1170000" yoy_change="8.3" />
    </years>
  </revenue_trend>

  <anomalies>
    <anomaly>
      <category>Motor Vehicle Expenses</category>
      <financial_year>FY2023-24</financial_year>
      <value>45000</value>
      <three_year_average>28000</three_year_average>
      <deviation_percentage>60.7</deviation_percentage>
      <z_score>2.4</z_score>
      <risk>ATO benchmark deviation — motor vehicle expenses unusually high</risk>
      <recommendation>Verify classification; may include personal use component</recommendation>
    </anomaly>
  </anomalies>

  <sbt_evidence>
    <expense_consistency_score>78</expense_consistency_score>
    <top_categories_stable>true</top_categories_stable>
    <business_type_consistent>true</business_type_consistent>
    <sbt_assessment>likely_satisfied</sbt_assessment>
  </sbt_evidence>
</trend_analysis>
```

## Best Practices

- **Minimum 3 years** of data required for meaningful trend analysis
- **Adjust for inflation** when comparing dollar amounts across years (use CPI)
- **Exclude one-off items** from trend calculations (e.g., asset sales, insurance payouts)
- **Normalise for business changes** — merger/acquisition/restructure events invalidate YoY comparison
- **ATO benchmarks are descriptive** — deviations are informational, not normative (AD-6)
- **Use Xero account codes** for consistent category mapping across years
- **Financial year convention**: Always use FY format (e.g., FY2024-25), never calendar year
