---
description: Assess ATO audit probability based on industry benchmarks, transaction patterns, and compliance focus areas
---

# /audit-risk - Audit Risk Assessment Workflow

Evaluates the likelihood of an ATO audit selection using quantifiable risk factors. ATO benchmarks are DESCRIPTIVE only — this workflow never recommends changing legitimate business behaviour.

## Quick Commands

```bash
/audit-risk                    # Full risk assessment for current FY
/audit-risk FY2023-24          # Specific financial year
/audit-risk [org_id]           # Specific entity
```

## Workflow Steps

### Step 1: Load Entity Profile
- Determine entity type, industry code (ANZSIC), and turnover
- Fetch current financial year data from Xero

### Step 2: Fetch ATO Benchmarks
- Load industry-specific benchmarks from `audit_risk_benchmarks` table
- If not cached, scrape ATO Small Business Benchmarks via `ato_rate_scraping` skill

### Step 3: Calculate Financial Ratios
- Cost of sales / Total income
- Total expenses / Total income
- Labour costs / Total income
- Rent / Total income
- Motor vehicle / Total income

### Step 4: Benchmark Comparison
- Compare each ratio against industry low-high range
- Flag deviations with percentage above/below range
- Note: deviation is NOT illegal — it increases audit probability

### Step 5: Compliance Focus Area Check
- Check against ATO annual compliance focus areas
- Flag high-scrutiny categories (R&D claims, cash economy, etc.)

### Step 6: Transaction Pattern Analysis
- Detect round-number patterns
- Flag large cash transactions
- Identify end-of-FY clustering

### Step 7: Generate Risk Report
- Overall risk score (0-100) with level (low/medium/high/very_high)
- Individual risk factor breakdown
- Documentation recommendations for items outside benchmarks

## Agents Involved

- **audit_risk_assessor** (primary) — runs the assessment
- **data_quality_agent** — pre-assessment data quality check
- **xero_auditor** — provides transaction data
- **rate_change_monitor** — ensures benchmarks are current

## Engine

`lib/analysis/audit-risk-engine.ts` → `assessAuditRisk()`

## API

`POST /api/analysis/audit-risk`
