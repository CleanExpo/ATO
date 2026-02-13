---
name: audit-risk-benchmarking
description: Compare entity financial ratios against ATO small business benchmarks to assess audit probability
---

# Audit Risk Benchmarking Skill

Compares a taxpayer's financial ratios (expense/income, labour costs, rent, motor vehicle) against ATO-published small business benchmarks for their ANZSIC industry code. Generates a risk profile without recommending behaviour change.

## When to Use

- Assessing ATO audit probability before lodgement
- Identifying expense ratios that deviate from industry norms
- Preparing documentation for items outside benchmark ranges
- Pre-engagement risk assessment for new clients
- Annual compliance health check

## Key Principle

**ATO benchmarks are DESCRIPTIVE, not NORMATIVE.** Being outside a benchmark is NOT illegal. This skill assesses probability, never recommends adjusting legitimate figures to match benchmarks.

## Benchmark Ratios

| Ratio | Calculation | Source |
|-------|-------------|--------|
| Cost of sales | Cost of sales / Total income | ATO Small Business Benchmarks |
| Total expenses | Total expenses / Total income | ATO Small Business Benchmarks |
| Labour costs | Wages + super / Total income | ATO Small Business Benchmarks |
| Rent | Rent expense / Total income | ATO Small Business Benchmarks |
| Motor vehicle | Motor vehicle / Total income | ATO Small Business Benchmarks |

## Engine Reference

- **Engine**: `lib/analysis/audit-risk-engine.ts`
- **Function**: `assessAuditRisk(tenantId, financialYear, options)`
- **Output type**: `AuditRiskAssessment` — includes risk factors, benchmark comparisons, and recommendations
- **Database**: `audit_risk_benchmarks` table stores cached benchmark data per industry code and FY

## Data Sources

- ATO Small Business Benchmarks: `ato.gov.au/Business/Small-business-benchmarks`
- ATO Compliance Focus Areas: Published annually
- Industry codes: ANZSIC 2006 classification

## Legislation

- TAA 1953, s 263-264 — ATO access and information powers
- TAA 1953, s 8C — Record keeping obligations
