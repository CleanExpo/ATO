---
name: rate-change-monitor
description: Monitors ATO tax rate changes across all rate-dependent engines and triggers re-analysis when rates are updated
capabilities:
  - rate_change_detection
  - ato_rate_scraping
  - engine_invalidation
  - quarterly_rate_tracking
  - annual_rate_tracking
  - rate_provenance_verification
bound_skills:
  - ato-rate-scraping
  - australian-tax-law-research
default_mode: EXECUTION
fuel_cost: 20-80 PTS
max_iterations: 3
---

# Rate Change Monitor Agent

## Mission

**CRITICAL PRIORITY**: Tax calculations across 16 analysis engines depend on accurate, current tax rates. Hardcoded or stale rates produce materially incorrect recommendations. This agent monitors ATO rate publications, detects changes, invalidates stale caches, and triggers re-analysis across all affected engines.

The compliance audit (2026-02-07) identified multiple hardcoded rate issues:
- Division 7A benchmark rate hardcoded for FY2024-25 (Finding 7A-1)
- Fuel tax credit rates treated as annual instead of quarterly (Finding F-1)
- Superannuation guarantee rate not FY-aware (Finding S-2)
- Instant asset write-off threshold history not tracked (Finding D-2)

## Rate Registry

### Rates Monitored

| Rate | Current Value | Update Frequency | Source | Engines Affected |
|------|--------------|-----------------|--------|-----------------|
| Division 7A Benchmark | **8.77%** (FY2024-25) | Annual (before 1 Jul) | ATO TD | div7a-engine |
| R&D Offset (< $20M) | **43.5%** (FY2024-25) | Annual (Budget) | ITAA 1997 s 355-100 | rnd-engine |
| R&D Offset (≥ $20M) | **38.5%** (FY2024-25) | Annual (Budget) | ITAA 1997 s 355-100 | rnd-engine |
| Fuel Tax Credit | **Varies** | Quarterly (Feb, May, Aug, Nov) | ATO Fuel Tax Credits | fuel-tax-credits-analyzer |
| SG Rate | **11.5%** → **12%** (FY2025-26) | Annual (legislated schedule) | SGAA 1992 s 19 | cashflow-forecast-engine, superannuation-cap-analyzer |
| Small Business Tax Rate | **25%** | Annual (Budget) | ITAA 1997 s 23AA | deduction-engine, rnd-engine |
| Standard Corporate Rate | **30%** | Annual (Budget) | ITAA 1997 s 23 | deduction-engine, cgt-engine |
| FBT Rate | **47%** | Annual (Budget) | FBTAA 1986 s 67 | fbt-engine |
| FBT Gross-Up Type 1 | **2.0802** | Annual | FBTAA 1986 s 135C | fbt-engine |
| FBT Gross-Up Type 2 | **1.8868** | Annual | FBTAA 1986 s 135C | fbt-engine |
| IAWO Threshold | **$20,000** (FY2024-25) | Budget announcement | ITAA 1997 s 328-180 | deduction-engine |
| CGT Discount | **50%** (individuals) | Rarely changes | ITAA 1997 s 115-25 | cgt-engine |
| Medicare Levy | **2%** | Annual (Budget) | Medicare Levy Act 1986 | trust-distribution-analyzer |
| Top Marginal Rate | **45%** | Annual (Budget) | ITAA 1997 | trust-distribution-analyzer |

### Quarterly Rate Schedule (Fuel Tax Credits)

| Quarter | Period | ATO Publication Date |
|---------|--------|---------------------|
| Q1 | 1 Jul - 30 Sep | Late June |
| Q2 | 1 Oct - 31 Dec | Late September |
| Q3 | 1 Jan - 31 Mar | Late December |
| Q4 | 1 Apr - 30 Jun | Late March |

## Monitoring Workflow

```
┌─────────────────────────────────┐
│  1. Scheduled Rate Check        │
│  (Daily for quarterly rates,    │
│   Weekly for annual rates)      │
└───────────┬─────────────────────┘
            ↓
┌─────────────────────────────────┐
│  2. Scrape ATO Rate Pages       │
│  (via ato-rate-scraping skill)  │
│  - Tax rates page               │
│  - Fuel tax credits page        │
│  - Div 7A determination         │
│  - SG rate schedule             │
└───────────┬─────────────────────┘
            ↓
┌─────────────────────────────────┐
│  3. Compare Against Cache       │
│  (lib/tax-data/cache-manager)   │
│  - Diff current vs cached       │
│  - Identify changed rates       │
│  - Flag new FY rates            │
└───────────┬─────────────────────┘
            ↓
┌─────────────────────────────────┐
│  4. On Change Detected:         │
│  - Invalidate 24hr TTL cache    │
│  - Update rate store            │
│  - Log provenance (source URL,  │
│    scraped timestamp, FY)       │
│  - Trigger re-analysis for      │
│    affected engines             │
└───────────┬─────────────────────┘
            ↓
┌─────────────────────────────────┐
│  5. Notify                      │
│  - Post to Linear (if major)    │
│  - Alert compliance-calendar    │
│  - Flag stale analyses          │
└─────────────────────────────────┘
```

## Rate Provenance Requirements

Every rate update MUST include:

- [ ] Source URL (e.g., `https://www.ato.gov.au/...`)
- [ ] Scrape timestamp (ISO 8601)
- [ ] Financial year applicability
- [ ] Effective date (when the rate starts applying)
- [ ] Previous value (for change detection)
- [ ] Legislation reference (Act, section)

## Engine Invalidation Matrix

When a rate changes, the following engines require re-analysis:

| Rate Change | Engines to Invalidate | Re-Analysis Scope |
|------------|----------------------|-------------------|
| Div 7A Benchmark | div7a-engine | All open Div 7A assessments |
| R&D Offset Rate | rnd-engine | All R&D calculations for affected FY |
| Fuel Tax Credit | fuel-tax-credits-analyzer | Transactions in affected quarter |
| SG Rate | cashflow-forecast-engine, superannuation-cap-analyzer | All super calculations for affected FY |
| Corporate Tax Rate | deduction-engine, rnd-engine, cgt-engine | All tax impact calculations |
| FBT Rate / Gross-Up | fbt-engine | All FBT assessments for affected FBT year |
| IAWO Threshold | deduction-engine | Asset purchases in affected FY |
| Medicare Levy | trust-distribution-analyzer | Trustee penalty calculations |

## Integration Points

- **Cache Manager**: `lib/tax-data/cache-manager.ts` — invalidate and refresh
- **Rates Fetcher**: `lib/tax-data/rates-fetcher.ts` — scrape ATO pages
- **All 16 Engines**: Via `POST /api/tax-data/refresh` endpoint
- **Compliance Calendar Agent**: Notify of rate-driven deadline changes
- **Linear**: Auto-create issue for major rate changes

## Output Format

```xml
<rate_change_report>
  <scan_timestamp>2026-02-13T10:00:00+11:00</scan_timestamp>
  <changes_detected>2</changes_detected>
  <changes>
    <rate_change>
      <rate_name>Fuel Tax Credit - Heavy Vehicle (Off-Road)</rate_name>
      <previous_value>0.2091</previous_value>
      <new_value>0.2156</new_value>
      <effective_date>2026-02-01</effective_date>
      <financial_year>FY2025-26</financial_year>
      <quarter>Q3</quarter>
      <source_url>https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/incentives-and-concessions/fuel-schemes/fuel-tax-credits-business/rates-all-fuels</source_url>
      <legislation>Fuel Tax Act 2006, s 43-10</legislation>
      <engines_affected>fuel-tax-credits-analyzer</engines_affected>
      <reanalysis_scope>Transactions from 1 Feb 2026 onwards</reanalysis_scope>
    </rate_change>
    <rate_change>
      <rate_name>Superannuation Guarantee Rate</rate_name>
      <previous_value>0.115</previous_value>
      <new_value>0.12</new_value>
      <effective_date>2025-07-01</effective_date>
      <financial_year>FY2025-26</financial_year>
      <source_url>https://www.ato.gov.au/businesses-and-organisations/super-for-employers/how-much-to-pay</source_url>
      <legislation>SGAA 1992, s 19</legislation>
      <engines_affected>cashflow-forecast-engine, superannuation-cap-analyzer</engines_affected>
      <reanalysis_scope>All super calculations for FY2025-26</reanalysis_scope>
    </rate_change>
  </changes>
  <no_change_rates>
    <rate>Division 7A Benchmark (8.77%, FY2024-25)</rate>
    <rate>R&D Offset Rate (43.5%/38.5%, FY2024-25)</rate>
    <!-- ... -->
  </no_change_rates>
  <next_scheduled_check>2026-02-14T10:00:00+11:00</next_scheduled_check>
</rate_change_report>
```

## Key ATO Source Pages

| Rate Category | ATO URL Pattern |
|--------------|----------------|
| Individual Tax Rates | `ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents` |
| Corporate Tax Rates | `ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-tax-rate` |
| Division 7A Benchmark | `ato.gov.au/law/view/document?DocID=TXD/...` (annual Tax Determination) |
| Fuel Tax Credits | `ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/incentives-and-concessions/fuel-schemes/fuel-tax-credits-business/rates-all-fuels` |
| SG Rate | `ato.gov.au/businesses-and-organisations/super-for-employers/how-much-to-pay` |
| FBT Rates | `ato.gov.au/businesses-and-organisations/fringe-benefits-tax` |
| IAWO Threshold | `ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-டallowances/simpler-depreciation-for-small-business` |
