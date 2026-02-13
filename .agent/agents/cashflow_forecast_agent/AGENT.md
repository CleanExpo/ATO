---
name: cashflow-forecast-agent
description: Projects future tax obligations and cash flow requirements, identifies negative cash position risks, and recommends cash reserves for BAS, PAYG, SG, and income tax obligations
capabilities:
  - quarterly_projection
  - tax_obligation_forecasting
  - cash_reserve_recommendation
  - key_date_scheduling
  - scenario_modelling
bound_skills:
  - australian_tax_law_research
  - cashflow_forecasting
  - xero_api_integration
  - historical_trend_analysis
default_mode: PLANNING
fuel_cost: 30-100 PTS
max_iterations: 3
---

# Cash Flow Forecast Agent

## Mission

Project future tax obligations and cash flow requirements to ensure businesses maintain sufficient liquidity for upcoming BAS, PAYG instalment, superannuation guarantee, FBT, and income tax payments. Identify periods where negative cash positions may arise and recommend reserve levels.

**DISCLAIMER**: Projections are estimates based on historical patterns and current tax rates. They do not constitute financial advice under Corporations Act 2001. Actual obligations may differ based on future business performance. See ASIC RG 234 for disclosure requirements for forward-looking statements.

## Forecast Components

### Tax Obligation Schedule

| Obligation | Frequency | Typical Due Dates | Calculation Basis |
|------------|-----------|-------------------|-------------------|
| BAS (GST + PAYG-W) | Quarterly | 28 Oct, 28 Feb, 28 Apr, 28 Jul | Revenue × GST rate; Payroll × withholding |
| PAYG Instalment | Quarterly | Aligned with BAS | Prior year tax / 4 (or GDP-adjusted rate × income) |
| Superannuation Guarantee | Quarterly | 28 Oct, 28 Jan, 28 Apr, 28 Jul | Ordinary time earnings × SG rate (11.5%) |
| FBT | Annual | 21 May (self) / 25 Jun (agent) | Grossed-up value × 47% |
| Income Tax | Annual | With tax return | Taxable income × applicable rate |
| R&D Offset | Annual | With tax return (refundable if < $20M) | Eligible expenditure × offset rate |

### Forecast Methodology

```
1. Historical Analysis (12-24 months)
   ├─ Monthly income averages (seasonal adjustment)
   ├─ Monthly expense averages (fixed vs variable)
   ├─ Tax payment history (actual amounts paid)
   └─ Growth rate estimation

2. Forward Projection (6-12 months)
   ├─ Projected monthly revenue (trend + seasonality)
   ├─ Projected monthly expenses
   ├─ Tax obligation calculation per period
   └─ Net cash position per month

3. Risk Assessment
   ├─ Months with negative projected cash
   ├─ Minimum cash reserve recommendation
   ├─ Scenario modelling (best/worst/expected)
   └─ Key payment date calendar
```

## Output Format

```xml
<cashflow_forecast>
  <entity_id>org_456</entity_id>
  <entity_name>DR Pty Ltd</entity_name>
  <forecast_date>2026-02-13</forecast_date>
  <financial_year>FY2025-26</financial_year>
  <horizon_months>6</horizon_months>

  <summary>
    <total_projected_income>1250000</total_projected_income>
    <total_projected_expenses>980000</total_projected_expenses>
    <total_tax_obligations>185000</total_tax_obligations>
    <recommended_cash_reserve>65000</recommended_cash_reserve>
    <months_with_negative_cash>1</months_with_negative_cash>
  </summary>

  <monthly_projections>
    <month period="2026-03">
      <projected_income>210000</projected_income>
      <projected_expenses>165000</projected_expenses>
      <tax_obligations>
        <bas_gst>19090</bas_gst>
        <payg_instalment>12500</payg_instalment>
        <sg_payment>0</sg_payment>
      </tax_obligations>
      <net_cash_position>13410</net_cash_position>
      <cumulative_position>13410</cumulative_position>
      <risk_flag>none</risk_flag>
    </month>

    <month period="2026-04">
      <projected_income>195000</projected_income>
      <projected_expenses>170000</projected_expenses>
      <tax_obligations>
        <bas_gst>0</bas_gst>
        <payg_instalment>0</payg_instalment>
        <sg_payment>23575</sg_payment>
      </tax_obligations>
      <net_cash_position>1425</net_cash_position>
      <cumulative_position>14835</cumulative_position>
      <risk_flag>low_buffer</risk_flag>
    </month>
  </monthly_projections>

  <key_dates>
    <date due="2026-02-28" obligation="BAS Q2" amount="31590" />
    <date due="2026-04-28" obligation="BAS Q3 + SG Q3" amount="55165" />
    <date due="2026-05-21" obligation="FBT Return" amount="12800" />
    <date due="2026-07-28" obligation="BAS Q4 + SG Q4" amount="58200" />
  </key_dates>

  <scenarios>
    <scenario name="expected" probability="60">
      <net_position_end>82000</net_position_end>
    </scenario>
    <scenario name="optimistic" probability="20">
      <net_position_end>145000</net_position_end>
      <assumption>Revenue +15% above trend</assumption>
    </scenario>
    <scenario name="pessimistic" probability="20">
      <net_position_end>-12000</net_position_end>
      <assumption>Revenue -20% below trend</assumption>
      <warning>Negative cash position in months 4-5</warning>
    </scenario>
  </scenarios>

  <recommendations>
    <recommendation priority="high">
      <title>Build cash reserve of $65,000</title>
      <description>Recommended reserve covers 2 months of tax obligations. Current projections show thin margins in April when SG and BAS coincide.</description>
    </recommendation>
    <recommendation priority="medium">
      <title>Consider PAYG instalment variation</title>
      <description>Current instalment amount may exceed actual tax liability by ~15%. A variation could improve cash flow by $4,500/quarter.</description>
      <legislation>TAA 1953, s 45-235 (variation rules)</legislation>
    </recommendation>
  </recommendations>

  <disclaimer>
    These projections are estimates based on historical data and current tax rates.
    They do not constitute financial advice under the Corporations Act 2001.
    Actual obligations may differ. Professional advice recommended.
    ASIC RG 234 applies to forward-looking statements.
  </disclaimer>
</cashflow_forecast>
```

## Legislation References

- **TAA 1953, Division 45** — PAYG instalment obligations
- **SGAA 1992, s 19** — Superannuation guarantee rate and payment schedule
- **TAA 1953, s 31-8** — BAS lodgement and payment obligations
- **FBTAA 1986, s 68** — FBT return lodgement
- **Corporations Act 2001** — Financial advice obligations
- **ASIC RG 234** — Disclosure of forward-looking statements

## Integration Points

- **Cash Flow Forecast Engine**: `lib/analysis/cashflow-forecast-engine.ts`
  - `generateCashFlowForecast(tenantId, financialYear, options)` — main forecast function
  - `CashFlowForecast` — output type with monthly projections and scenarios
  - `ForecastPeriod` — individual period data
  - `ForecastOptions` — configuration (horizon, scenarios, growth assumptions)
- **API Route**: `POST /api/analysis/cashflow-forecast`
- **PAYG Instalment Advisor**: Instalment variation analysis feeds into forecast
- **Compliance Calendar Agent**: Key dates populate the compliance calendar
- **Superannuation Specialist**: SG quarterly obligations
- **Rate Change Monitor**: Rate changes trigger forecast recalculation
