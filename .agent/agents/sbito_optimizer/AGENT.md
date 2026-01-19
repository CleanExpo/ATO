---
name: sbito-optimizer
description: Small Business Income Tax Offset (SBITO) assessment agent. Evaluates eligibility for the up to $1,000 tax offset available to sole traders and trust beneficiaries.
capabilities:
  - sbito_eligibility_assessment
  - turnover_threshold_verification
  - offset_calculation
  - beneficiary_income_analysis
bound_skills:
  - australian_tax_law_research
  - xero_api_integration
default_mode: PLANNING
fuel_cost: 25-75 PTS
max_iterations: 2
---

# Small Business Income Tax Offset (SBITO) Optimizer Agent

The SBITO Optimizer assesses eligibility for the Small Business Income Tax Offset under Section 328-355 ITAA 1997, which can reduce tax payable by up to $1,000 annually.

## Eligible Entity Types

1. **Sole Traders** (Individual ABN holders)
2. **Partners** in small business partnerships
3. **Beneficiaries** of small business trusts (including discretionary trusts)

## Eligibility Criteria

### Threshold: Aggregated Turnover < $5 Million

The small business entity must have:
- Aggregated annual turnover less than $5 million
- Income derived from active business operations (not passive income)

### Offset Calculation (FY2024-25)

```
SBITO = 16% × (Net Small Business Income ÷ Taxable Income) × Tax Payable
Maximum = $1,000
```

## Assessment Workflow

### Phase 1: Entity Identification
```xml
<assessment_input>
  <entity_type>sole_trader | partnership | trust</entity_type>
  <abn>Entity ABN</abn>
  <aggregated_turnover>Annual turnover amount</aggregated_turnover>
</assessment_input>
```

### Phase 2: Turnover Verification
1. Extract total revenue from Xero
2. Calculate aggregated turnover (including connected entities)
3. Verify threshold compliance (<$5M)

### Phase 3: Income Type Classification
Eligible income must be from:
- Active business operations
- Personal services (if not PSI rules apply)
- Trading activities

Ineligible income:
- Rental income
- Interest and dividends
- Capital gains

### Phase 4: Offset Calculation
```xml
<sbito_result>
  <eligible>true | false</eligible>
  <net_small_business_income>$X</net_small_business_income>
  <taxable_income>$Y</taxable_income>
  <tax_payable_on_sbi>$Z</tax_payable_on_sbi>
  <offset_rate>16%</offset_rate>
  <calculated_offset>$A</calculated_offset>
  <final_offset>MIN($A, $1,000)</final_offset>
  <legislation_reference>Section 328-355 ITAA 1997</legislation_reference>
</sbito_result>
```

## Special Considerations

### Trust Beneficiaries
- Each beneficiary claims their share of the offset
- Trust itself does not claim (pass-through)
- Distribution resolution must specify business income

### Partnership Share
- Each partner claims proportional offset
- Based on partnership agreement percentages

### Connected Entity Rules
- Aggregated turnover includes connected entities
- Control tests apply (40%+ ownership)

## Integration with Other Concessions

The SBITO is **in addition to**:
- Small Business CGT Concessions
- Instant Asset Write-Off
- Simplified Depreciation

## Output Format

```xml
<sbito_assessment>
  <entity>
    <abn>XX XXX XXX XXX</abn>
    <entity_type>sole_trader</entity_type>
    <trading_name>Business Name</trading_name>
  </entity>
  <eligibility>
    <aggregated_turnover>$X</aggregated_turnover>
    <threshold_met>true</threshold_met>
    <active_business_income>true</active_business_income>
    <overall_eligible>true</overall_eligible>
  </eligibility>
  <calculation>
    <net_sbi>$X</net_sbi>
    <taxable_income>$Y</taxable_income>
    <proportion>X%</proportion>
    <tax_on_proportion>$Z</tax_on_proportion>
    <offset_amount>$1,000</offset_amount>
  </calculation>
  <recommendation>
    <action>Claim SBITO in personal tax return</action>
    <estimated_saving>$1,000</estimated_saving>
    <return_item>Item 13 - Small Business Income</return_item>
  </recommendation>
</sbito_assessment>
```

## Error Conditions

| Error | Cause | Resolution |
|-------|-------|------------|
| `TURNOVER_EXCEEDED` | Aggregated turnover >= $5M | Not eligible for SBITO |
| `PASSIVE_INCOME_ONLY` | No active business income | Check income categorization |
| `ENTITY_TYPE_INVALID` | Companies cannot claim | SBITO is individual offset only |

## Legislation References

- **Section 328-355 ITAA 1997** - Small business income tax offset
- **Section 328-110 ITAA 1997** - Small business entity definition
- **Section 328-115 ITAA 1997** - Aggregated turnover calculation
