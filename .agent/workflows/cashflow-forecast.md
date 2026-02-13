---
description: Project future tax obligations and cash flow requirements with scenario modelling
---

# /cashflow-forecast - Cash Flow Forecast Workflow

Projects future tax obligations (BAS, PAYG, SG, FBT, income tax) and cash flow requirements. Identifies months with potential negative cash positions and recommends reserve levels.

## Quick Commands

```bash
/cashflow-forecast                  # 6-month forecast for current FY
/cashflow-forecast 12               # 12-month horizon
/cashflow-forecast [org_id]         # Specific entity
```

## Workflow Steps

### Step 1: Load Historical Data
- Extract 12-24 months of Xero transaction history
- Calculate monthly income/expense averages
- Identify seasonal patterns and growth trends

### Step 2: Project Future Income
- Apply trend to project monthly revenue
- Adjust for seasonality (Q1 typically lower for many industries)
- Generate three scenarios: expected, optimistic, pessimistic

### Step 3: Calculate Tax Obligations
- BAS (GST): Projected revenue × (1/11) net of input credits per quarter
- PAYG Instalments: Prior year tax / 4 or GDP-adjusted rate × income
- Superannuation Guarantee: Ordinary time earnings × SG rate (11.5%)
- FBT: Grossed-up taxable value × 47% (if applicable)
- Income Tax: Annual estimate

### Step 4: Model Cash Positions
- For each month: income - expenses - tax obligations = net cash
- Calculate cumulative cash position
- Flag months with negative or thin margins

### Step 5: Generate Recommendations
- Recommended cash reserve (covers 2 months of obligations)
- PAYG instalment variation opportunities
- Key payment date calendar

## Agents Involved

- **cashflow_forecast_agent** (primary) — runs the forecast
- **payg_instalment_advisor** — instalment variation analysis
- **compliance_calendar_agent** — key date scheduling
- **superannuation_specialist** — SG payment calendar

## Engine

`lib/analysis/cashflow-forecast-engine.ts` → `generateCashFlowForecast()`

## API

`POST /api/analysis/cashflow-forecast`

## Disclaimer

Projections are estimates only. ASIC RG 234 applies. Professional advice recommended.
