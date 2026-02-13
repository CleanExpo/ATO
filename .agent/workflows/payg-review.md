---
description: PAYG instalment optimisation — compare methods and assess variation risk
---

# /payg-review - PAYG Instalment Optimisation Workflow

Reviews PAYG instalment obligations and optimises the payment strategy. Compares amount vs rate method, assesses variation penalty risk against the 85% safe harbour.

## Quick Commands

```bash
/payg-review                    # Review for current FY
/payg-review FY2023-24          # Specific financial year
/payg-review [org_id]           # Specific entity
```

## Workflow Steps

### Step 1: Identify Current Method
- Load PAYG instalment details from ATO/Xero
- Determine if using amount method (s 45-112) or rate method (s 45-115)
- Extract current instalment amounts/rate

### Step 2: Estimate Actual Tax Liability
- Project current FY taxable income from Xero data
- Apply entity-specific tax rate (25%/30% company, marginal individual)
- Estimate actual tax liability for the year

### Step 3: Compare Instalments vs Actual
- Calculate total instalments if maintained (4 × quarterly amount)
- Compare against estimated actual tax
- Identify overpayment or underpayment

### Step 4: Model Scenarios
- **Continue current**: No change, calculate over/underpayment
- **Vary downward**: Reduce to estimated actual, check 85% safe harbour
- **Switch method**: Compare amount vs rate method outcomes
- **GDP-adjusted**: Apply GDP adjustment to rate method

### Step 5: Assess Variation Risk
- Calculate 85% safe harbour threshold (s 45-235)
- If varied amount >= 85% of actual tax: no penalty (safe)
- If below 85%: calculate GIC exposure on shortfall
- GIC rate: base rate + 7%, compounding daily

### Step 6: Generate Recommendations
- Optimal strategy with projected savings
- Risk assessment for each scenario
- Cash flow impact analysis

## Agents Involved

- **payg_instalment_advisor** (primary) — runs the optimisation
- **cashflow_forecast_agent** — cash flow impact of different strategies

## Engine

`lib/analysis/payg-instalment-engine.ts` → `analyzePAYGInstalments()`

## API

`POST /api/analysis/payg-instalments`
