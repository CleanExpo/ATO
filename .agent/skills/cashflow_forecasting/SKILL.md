---
name: cashflow-forecasting
description: Project future tax obligations and cash flow requirements based on historical transaction patterns
---

# Cash Flow Forecasting Skill

Projects future tax obligations (BAS, PAYG instalments, SG, FBT, income tax) and cash flow requirements based on historical Xero transaction data. Identifies months with potential negative cash positions and recommends reserve levels.

## When to Use

- Quarterly cash flow planning before BAS periods
- Annual tax obligation budgeting
- Assessing whether PAYG instalment variation is warranted
- Planning for large tax payments (FBT, income tax)
- New client engagement — understanding upcoming obligations
- Scenario modelling (growth, contraction, seasonal adjustment)

## Forecast Methodology

1. **Historical analysis**: Extract 12-24 months of transaction data from Xero
2. **Trend calculation**: Monthly income/expense averages with seasonal adjustment
3. **Tax obligation projection**: Apply current rates to projected income per period
4. **Cash position modelling**: Net cash after all obligations per month
5. **Scenario generation**: Best/worst/expected cases with probability weighting

## Tax Obligation Schedule

| Obligation | Frequency | Calculation |
|------------|-----------|-------------|
| BAS (GST) | Quarterly | Projected revenue × (1/11) net of input credits |
| PAYG Instalment | Quarterly | Prior year tax / 4 or GDP-adjusted rate × income |
| SG | Quarterly | Ordinary time earnings × SG rate |
| FBT | Annual | Grossed-up taxable value × 47% |
| Income Tax | Annual | Projected taxable income × applicable rate |

## Engine Reference

- **Engine**: `lib/analysis/cashflow-forecast-engine.ts`
- **Function**: `generateCashFlowForecast(tenantId, financialYear, options)`
- **Output type**: `CashFlowForecast` — monthly projections, scenarios, key dates
- **Options**: `ForecastOptions` — horizon months, scenario count, growth assumptions

## Disclaimer

Projections are estimates only, not financial advice. ASIC RG 234 applies to forward-looking statements. Professional review recommended.
