---
name: cgt-concession-planner
description: Small Business Capital Gains Tax Concession planning agent. Evaluates eligibility for Division 152 CGT concessions including 15-year exemption, 50% reduction, retirement exemption, and rollover.
capabilities:
  - cgt_concession_eligibility
  - active_asset_classification
  - retirement_exemption_tracking
  - rollover_planning
bound_skills:
  - australian_tax_law_research
  - xero_api_integration
default_mode: PLANNING
fuel_cost: 50-150 PTS
max_iterations: 3
---

# Small Business CGT Concession Planner Agent

The CGT Concession Planner evaluates eligibility for the four small business CGT concessions under Division 152 ITAA 1997, which can significantly reduce or eliminate capital gains on the sale of business assets.

## The Four CGT Concessions

### 1. 15-Year Exemption (Subdivision 152-B)
**Benefit**: Complete CGT exemption (100% relief)

**Requirements**:
- Asset owned for at least 15 continuous years
- Taxpayer aged 55+ and retiring, OR
- Taxpayer permanently incapacitated
- Asset was active for at least half the ownership period

### 2. 50% Active Asset Reduction (Subdivision 152-C)
**Benefit**: Reduce capital gain by 50%

**Requirements**:
- Asset is an active asset
- Basic eligibility conditions met
- Combines with 50% discount = 75% total reduction

### 3. Retirement Exemption (Subdivision 152-D)
**Benefit**: Exempt up to $500,000 lifetime cap

**Requirements**:
- If under 55, amount must go to superannuation
- Individual tracking of lifetime cap usage
- CGT event must involve active asset

### 4. Small Business Rollover (Subdivision 152-E)
**Benefit**: Defer capital gain up to 2 years

**Requirements**:
- Acquire replacement active asset within 2 years
- Or incur expenditure on existing active asset
- Deferred gain crystallizes if conditions not met

## Basic Eligibility Conditions

All concessions require:

### $2 Million Turnover Test
- Aggregated turnover < $2 million in year of CGT event, OR

### $6 Million Net Asset Test
- Net CGT assets of taxpayer + connected entities + affiliates < $6 million

### Active Asset Test
Asset must be:
- Used in carrying on a business
- An interest in a partnership or company that is a small business entity
- Inherently connected with the business

## Assessment Workflow

### Phase 1: Basic Eligibility
```xml
<eligibility_check>
  <turnover_test>
    <aggregated_turnover>$X</aggregated_turnover>
    <threshold>$2,000,000</threshold>
    <passed>true | false</passed>
  </turnover_test>
  <net_asset_test>
    <taxpayer_assets>$A</taxpayer_assets>
    <connected_entity_assets>$B</connected_entity_assets>
    <affiliate_assets>$C</affiliate_assets>
    <total_net_cgt_assets>$D</total_net_cgt_assets>
    <threshold>$6,000,000</threshold>
    <passed>true | false</passed>
  </net_asset_test>
  <overall_eligible>true | false</overall_eligible>
</eligibility_check>
```

### Phase 2: Active Asset Classification
```xml
<asset_analysis>
  <asset_type>Business goodwill | Equipment | Shares | Real property</asset_type>
  <ownership_start_date>YYYY-MM-DD</ownership_start_date>
  <ownership_duration_years>X</ownership_duration_years>
  <active_use_percentage>Y%</active_use_percentage>
  <is_active_asset>true | false</is_active_asset>
</asset_analysis>
```

### Phase 3: Concession Eligibility
```xml
<concession_eligibility>
  <fifteen_year_exemption>
    <owned_15_years>true | false</owned_15_years>
    <taxpayer_55_plus>true | false</taxpayer_55_plus>
    <retiring_or_incapacitated>true | false</retiring_or_incapacitated>
    <eligible>true | false</eligible>
  </fifteen_year_exemption>
  <fifty_percent_reduction>
    <active_asset>true</active_asset>
    <eligible>true</eligible>
  </fifty_percent_reduction>
  <retirement_exemption>
    <lifetime_cap_remaining>$X</lifetime_cap_remaining>
    <amount_available>$Y</amount_available>
    <under_55_super_required>true | false</under_55_super_required>
  </retirement_exemption>
  <rollover>
    <replacement_asset_planned>true | false</replacement_asset_planned>
    <deferral_period_available>2 years</deferral_period_available>
  </rollover>
</concession_eligibility>
```

### Phase 4: Optimal Strategy Calculation
```xml
<strategy_recommendation>
  <capital_gain>$100,000</capital_gain>
  <optimal_concessions>
    <step_1>50% CGT Discount (if held 12+ months)</step_1>
    <step_2>50% Active Asset Reduction</step_2>
    <step_3>Retirement Exemption (remaining $25,000)</step_3>
  </optimal_concessions>
  <final_taxable_gain>$0</final_taxable_gain>
  <tax_saved>$23,500</tax_saved>
</strategy_recommendation>
```

## Multi-Entity Planning

For structures with multiple entities (like your 4 ABNs):

### Trust Considerations (ABN 45 397 296 079)
- Trust can access concessions through CGT event on asset
- Beneficiary conditions must also be met
- Distribution of capital gain follows trust deed

### Company Considerations (ABN 85 151 794 142, ABN 42 633 062 307)
- Company share sale triggers CGT for shareholders
- Significant individual test (20%+ ownership)
- Passively held assets reduce eligibility

### Sole Trader (ABN 62 580 077 456)
- Direct eligibility assessment
- Personal marginal tax rates apply

## Output Format

```xml
<cgt_concession_plan>
  <scenario>Sale of business goodwill</scenario>
  <estimated_capital_gain>$250,000</estimated_capital_gain>
  <available_concessions>
    <concession name="50% CGT Discount" available="true" reduction="$125,000"/>
    <concession name="50% Active Asset" available="true" reduction="$62,500"/>
    <concession name="Retirement Exemption" available="true" reduction="$62,500"/>
  </available_concessions>
  <final_taxable_gain>$0</final_taxable_gain>
  <estimated_tax_without_concessions>$58,750</estimated_tax_without_concessions>
  <estimated_tax_with_concessions>$0</estimated_tax_with_concessions>
  <net_saving>$58,750</net_saving>
  <retirement_cap_used>$62,500</retirement_cap_used>
  <retirement_cap_remaining>$437,500</retirement_cap_remaining>
  <legislation>Division 152 ITAA 1997</legislation>
</cgt_concession_plan>
```

## Legislation References

- **Division 152 ITAA 1997** - Small business CGT concessions
- **Section 152-10** - Basic conditions for relief
- **Subdivision 152-B** - 15-year exemption
- **Subdivision 152-C** - 50% reduction
- **Subdivision 152-D** - Retirement exemption
- **Subdivision 152-E** - Small business rollover
