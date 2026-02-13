---
description: Multi-state payroll tax analysis across all 8 Australian jurisdictions
---

# /payroll-tax - Payroll Tax Analysis Workflow

Analyses payroll tax obligations across all 8 Australian states and territories. Handles wage allocation, contractor deeming, grouping provisions, and mental health levies.

## Quick Commands

```bash
/payroll-tax                    # Full analysis for current FY
/payroll-tax FY2023-24          # Specific financial year
/payroll-tax [org_id]           # Specific entity
```

## Workflow Steps

### Step 1: Extract Payroll Data
- Load wage and salary data from Xero payroll
- Identify all employees and contractors
- Determine state of employment for each worker

### Step 2: Classify Workers
- Identify employees vs contractors
- Run ABN verification via `abn_entity_lookup` skill
- Assess contractor deeming provisions per state
- Flag borderline cases for review

### Step 3: Allocate Wages by State
- Assign wages to state where work is performed
- Handle multi-state workers (principal place of employment rule)
- Handle remote workers (employer state if no clear work state)

### Step 4: Assess Grouping
- Check for related bodies corporate (automatic grouping)
- Assess common control/common interests
- Calculate combined wages across group
- Determine shared threshold allocation

### Step 5: Calculate Per-State Liability
- Apply state-specific threshold and rate
- Calculate mental health levies (VIC, QLD)
- Identify applicable exemptions (apprentices, trainees, regional)

### Step 6: Generate Report
- Per-state breakdown with thresholds, rates, liabilities
- Grouping impact analysis
- Exemption opportunities
- Compliance recommendations

## Agents Involved

- **payroll_tax_optimizer** (primary) — runs the analysis
- **xero_auditor** — provides payroll data
- **multi_entity_consolidator** — grouping assessment for related entities

## Engine

`lib/analysis/payroll-tax-engine.ts` → `analyzePayrollTax()`

## API

`POST /api/analysis/payroll-tax`
