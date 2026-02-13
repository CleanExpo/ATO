---
name: payg-instalment-optimization
description: PAYG instalment strategy analysis — amount vs rate method, variation penalty risk, GDP adjustment
---

# PAYG Instalment Optimization Skill

Analyses PAYG instalment obligations and optimises the payment strategy. Compares amount method vs rate method, assesses variation penalty risk, and models the impact of GDP-adjusted rates.

## When to Use

- Reviewing quarterly PAYG instalment amounts
- Assessing whether to vary instalments (and penalty risk)
- Comparing amount method vs rate method
- Checking 85% safe harbour threshold
- Modelling scenarios for income fluctuations
- Annual instalment method election

## Methods

### Amount Method (s 45-112)
- ATO calculates instalment based on prior year tax
- Four equal quarterly payments
- Suitable for stable income

### Rate Method (s 45-115)
- ATO provides instalment rate (based on prior year)
- Apply rate to current quarter's instalment income
- Better for volatile or seasonal income
- GDP-adjusted rate may apply

## Variation Rules (s 45-205)

Taxpayers can vary instalment amounts if they believe actual tax will differ from calculated instalments. However:

### 85% Safe Harbour (s 45-235)
- If varied amount is **at least 85%** of actual tax, no penalty applies
- If under 85%, General Interest Charge (GIC) applies on shortfall
- GIC rate: base rate + 7% (compounding daily)

### Variation Risk Assessment

| Scenario | Risk | Recommendation |
|----------|------|---------------|
| Varied to > 85% of actual | None | Safe harbour applies |
| Varied to 75-85% of actual | Low | GIC on small shortfall |
| Varied to < 75% of actual | Medium | Significant GIC exposure |
| Varied to < 50% of actual | High | GIC + potential ATO attention |

## Engine Reference

- **Engine**: `lib/analysis/payg-instalment-engine.ts`
- **Function**: `analyzePAYGInstalments(tenantId, financialYear, options)`
- **Output**: Current method analysis, variation scenarios, penalty risk, recommendations

## Legislation

- TAA 1953, Division 45, Schedule 1 — PAYG instalment rules
- TAA 1953, s 45-112 — Amount method
- TAA 1953, s 45-115 — Rate method
- TAA 1953, s 45-205 — Variation of instalments
- TAA 1953, s 45-235 — Penalty safe harbour (85% rule)
- TAA 1953, s 8AAD — General Interest Charge rate
