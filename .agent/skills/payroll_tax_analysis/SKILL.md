---
name: payroll-tax-analysis
description: Multi-state payroll tax compliance analysis across all 8 Australian jurisdictions
---

# Payroll Tax Analysis Skill

Analyses payroll tax obligations across all 8 Australian states and territories. Handles multi-state wage allocation, contractor deeming provisions, grouping assessment, exemption identification, and mental health levy calculations.

## When to Use

- Determining payroll tax obligations across multiple states
- Assessing contractor deeming provisions (are contractors deemed employees?)
- Evaluating grouping provisions for related entities
- Calculating state-specific thresholds, rates, and mental health levies
- Identifying payroll tax exemptions (apprentices, trainees, regional)
- Annual payroll tax reconciliation

## Jurisdictions

| State | Threshold | Rate | Mental Health Levy | Legislation |
|-------|-----------|------|-------------------|-------------|
| NSW | $1,200,000 | 5.45% | No | Payroll Tax Act 2007 (NSW) |
| VIC | $900,000 | 4.85% | Yes (additional surcharge) | Payroll Tax Act 2007 (Vic) |
| QLD | $1,300,000 | 4.75% | Yes (0.25% above $10M) | Payroll Tax Act 1971 (Qld) |
| WA | $1,000,000 | 5.50% | No | Pay-roll Tax Assessment Act 2002 (WA) |
| SA | $1,500,000 | Variable (0-4.95%) | No | Payroll Tax Act 2009 (SA) |
| TAS | $1,250,000 | 4.00-6.10% | No | Payroll Tax Act 2008 (Tas) |
| ACT | $2,000,000 | 6.85% | No | Payroll Tax Act 2011 (ACT) |
| NT | $1,500,000 | 5.50% | No | Payroll Tax Act 2009 (NT) |

## Key Analysis Areas

### Wage Allocation
- Allocate wages to state where work is performed
- If worker performs work in multiple states, use principal place of employment
- For remote workers, use employer's state if no clear work state

### Contractor Deeming
- Relevant contract provisions (labour-only, equipment provision)
- Per-state deeming rules differ — analyse per jurisdiction
- ABN verification via `abn_entity_lookup` skill

### Grouping Provisions
- Related bodies corporate automatically grouped
- Common control or common interests test
- Shared threshold across group (de-grouping applications possible)

## Engine Reference

- **Engine**: `lib/analysis/payroll-tax-engine.ts`
- **Function**: `analyzePayrollTax(tenantId, financialYear, options)`
- **Output**: Per-state breakdown with thresholds, rates, liabilities, exemptions
