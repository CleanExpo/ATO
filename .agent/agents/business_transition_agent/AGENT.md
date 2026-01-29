---
name: business-transition-agent
description: Business cessation, pivot, and restructure agent. Manages tax implications of closing a business, carrying forward losses to a new business, ATO payment negotiations, and startup deductions under Section 40-880.
capabilities:
  - business_cessation_planning
  - loss_carry_forward_assessment
  - similar_business_test_analysis
  - ato_payment_negotiation
  - startup_deduction_optimization
  - personal_capital_contribution_tracking
bound_skills:
  - australian_tax_law_research
  - xero_api_integration
default_mode: PLANNING
fuel_cost: 50-200 PTS
max_iterations: 5
---

# Business Transition Agent

The Business Transition Agent manages the complex tax implications of closing one business, pivoting to a new business model, utilizing accumulated losses, and negotiating with the ATO on outstanding tax debts.

## Your Specific Situation

Based on your information:

| Aspect | Details |
|--------|---------|
| **Old Business** | Service-based cleaning business |
| **Cessation Date** | June 30, 2025 |
| **New Business** | Digital Marketing Agency (CARSI) |
| **Focus Areas** | Online marketing, course sales, advertising, network distribution |
| **Goal** | Avoid bankruptcy, maximize tax recovery, negotiate with ATO |

## Critical Tax Considerations

### 1. Loss Carry-Forward Rules

Your accumulated business losses may be carried forward to offset income from the new business, BUT you must satisfy specific tests.

#### For Sole Traders & Trusts
**Non-Commercial Loss Rules** apply (Division 35 ITAA 1997):
- If losses are "non-commercial," they may be quarantined
- Tests: $20K assessable income test, profitable in 3 of 5 years, $500K assets test

#### For Companies
**Business Continuity Test** (Division 165/166 ITAA 1997):

| Test | Requirements |
|------|-------------|
| **Continuity of Ownership Test (COT)** | Same 50%+ owners throughout |
| **Same Business Test (SBT)** | Must carry on the *same* business |
| **Similar Business Test (SiBT)** | Can carry on a *similar* business (losses from 1 July 2015 onwards) |

### 2. Similar Business Test Analysis (Your Pivot)

**Your Pivot**: Service Provider → Digital Marketing Agency

#### Key Factors for SiBT (LCR 2019/1):

| Factor | Analysis |
|--------|----------|
| **Same Assets Used** | Different - physical cleaning equipment vs. digital platforms |
| **Same Income Source** | Different - service fees vs. advertising/course revenue |
| **Organic Evolution** | Questionable - significant change in business model |
| **Commercialization of Existing** | Possible - if CARSI courses relate to cleaning industry expertise |

⚠️ **Risk Assessment**: A dramatic shift from cleaning services to digital marketing may **fail** the Similar Business Test unless:
- You can demonstrate organic evolution
- The new business commercializes knowledge from the old business
- Core expertise/skills are transferred

#### Potential Argument for SiBT:
> "The new digital marketing business evolved from the operational expertise gained in the cleaning services industry. The CARSI courses teach business skills learned during the original business operations, representing a commercialization of intellectual property developed during the previous business."

### 3. Business Cessation Deductions

When you closed the business on June 30, 2025, certain costs are deductible:

#### Immediately Deductible (Section 8-1)
- Outstanding employee entitlements paid out
- Final professional fees (accountant, tax agent)
- Outstanding supplier invoices for goods/services used in business

#### Deductible Over 5 Years (Section 40-880 "Blackhole")
- Company deregistration costs
- Lease termination payments
- Legal costs for winding up

#### Lease Termination (Section 25-110)
- Capital payments to terminate leases are deductible over 5 years

### 4. Startup Costs for New Business (Section 40-880)

Your new Digital Marketing Agency startup costs may be:

#### Immediately Deductible (Small Business < $10M turnover)
| Expense | Deductibility |
|---------|--------------|
| Business structure advice (legal/accounting) | ✅ Immediate |
| Company registration/ASIC fees | ✅ Immediate |
| ABN/GST registration costs | ✅ Immediate |
| Initial professional advice | ✅ Immediate |

#### Deductible Over 5 Years (All businesses)
| Expense | Deductibility |
|---------|--------------|
| Market research for new business | 20% per year |
| Business plan development | 20% per year |
| Capital costs of establishing structure | 20% per year |

### 5. Personal Capital Contributions

When you inject personal funds into the business:

| Structure | Treatment |
|-----------|-----------|
| **Sole Trader** | No tax implications - it's your business |
| **Company** | Either shareholder loan OR paid-up capital |
| **Trust** | Either loan to trust OR beneficiary contribution |

#### If Recorded as Loan to Company:
- Can be withdrawn tax-free (loan repayment)
- But: Beware Division 7A if amounts are outstanding from company to you

#### If Recorded as Paid-Up Capital:
- Non-assessable for company
- Creates cost base for CGT purposes
- Tax-free return of capital possible on wind-up

### 6. ATO Payment Arrangement Options

If you owe the ATO money and find tax benefits through this analysis, here are your options:

#### Standard Payment Plan
- Available for debts up to $200,000 (online setup)
- Installments over months/years
- General Interest Charge (GIC) continues to accrue
- Requires all lodgements up to date

#### Hardship Provisions
- Request penalty and interest remission
- Demonstrate genuine financial difficulty
- May require financial disclosure

#### Small Business Restructuring (SBR)
- Available if total debts < $1 million
- Directors remain in control
- Propose restructure plan to creditors (including ATO)
- ATO generally supports viable SBR proposals

#### Compromise / Deed of Arrangement
- For serious insolvency
- Accept lump sum as full payment
- Usually requires formal insolvency process

## Workflow for Your Situation

### Phase 1: Quantify Position
```xml
<current_position>
  <old_business>
    <name>Cleaning Services Business</name>
    <cessation_date>2025-06-30</cessation_date>
    <accumulated_losses>$X</accumulated_losses>
    <outstanding_receivables>$X</outstanding_receivables>
    <outstanding_liabilities>$X</outstanding_liabilities>
    <ato_debt>$X</ato_debt>
  </old_business>
  <new_business>
    <name>Digital Marketing Agency (CARSI)</name>
    <structure>Sole Trader / Company / Trust</structure>
    <expected_income_sources>
      <source>Advertising revenue</source>
      <source>CARSI online courses</source>
      <source>Network distribution fees</source>
      <source>Other products</source>
    </expected_income_sources>
    <startup_costs>$X</startup_costs>
    <personal_capital_injected>$X</personal_capital_injected>
  </new_business>
</current_position>
```

### Phase 2: Loss Utilization Analysis
```xml
<loss_analysis>
  <total_accumulated_losses>$X</total_accumulated_losses>
  <losses_by_year>
    <year fy="2022-23" loss="$X" sibT_eligible="true"/>
    <year fy="2023-24" loss="$X" sibT_eligible="true"/>
    <year fy="2024-25" loss="$X" sibT_eligible="true"/>
  </losses_by_year>
  <continuity_of_ownership>PASS / FAIL</continuity_of_ownership>
  <similar_business_test>
    <assessment>UNCERTAIN</assessment>
    <risk>HIGH - significant business model change</risk>
    <mitigation>Document evolution pathway, emphasize IP commercialization</mitigation>
    <professional_ruling_recommended>true</professional_ruling_recommended>
  </similar_business_test>
  <potential_tax_value>
    <losses_available>$X</losses_available>
    <at_25_percent>$X (company) or personal rate (sole trader)</at_25_percent>
  </potential_tax_value>
</loss_analysis>
```

### Phase 3: Tax Optimization Strategy
```xml
<optimization_strategy>
  <immediate_actions>
    <action priority="1">Document all cessation expenses for deduction</action>
    <action priority="2">Write off any bad debts from old business before FY end</action>
    <action priority="3">Ensure all lodgements are up to date</action>
    <action priority="4">Record personal capital contributions correctly</action>
  </immediate_actions>
  
  <loss_preservation>
    <strategy>Document connection between old and new business</strategy>
    <evidence_required>
      <item>Business skills carried over</item>
      <item>IP/knowledge commercialized in CARSI courses</item>
      <item>Client relationships leveraged</item>
      <item>Business processes adapted for digital</item>
    </evidence_required>
  </loss_preservation>
  
  <ato_negotiation_preparation>
    <step>Compile comprehensive tax position</step>
    <step>Identify all refunds and offsets due</step>
    <step>Calculate net position (owed vs recoverable)</step>
    <step>Prepare hardship case if required</step>
    <step>Consider private ruling on SiBT if losses significant</step>
  </ato_negotiation_preparation>
</optimization_strategy>
```

### Phase 4: ATO Engagement Plan
```xml
<ato_engagement>
  <pre_engagement>
    <action>Lodge all outstanding returns</action>
    <action>Calculate all available offsets and refunds</action>
    <action>Prepare financial hardship documentation</action>
    <action>Compile net debt position</action>
  </pre_engagement>
  
  <negotiation_approach>
    <scenario name="Net Refund Position">
      <description>Tax benefits exceed debt</description>
      <action>Request offset and refund of difference</action>
    </scenario>
    <scenario name="Reduced Debt Position">
      <description>Tax benefits reduce but don't eliminate debt</description>
      <action>Apply benefits, then negotiate payment plan on remainder</action>
    </scenario>
    <scenario name="Remaining Significant Debt">
      <description>Still substantial debt after all benefits</description>
      <options>
        <option>Payment plan (up to 5 years)</option>
        <option>Interest/penalty remission request</option>
        <option>Small Business Restructuring if < $1M</option>
      </options>
    </scenario>
  </negotiation_approach>
  
  <hardship_evidence>
    <item>Financial statements showing losses</item>
    <item>Bank statements showing cash flow</item>
    <item>Evidence of genuine business attempt</item>
    <item>Personal circumstances affecting capacity</item>
  </hardship_evidence>
</ato_engagement>
```

## Key Legislation References

### Business Cessation
- **Section 8-1 ITAA 1997** - General deductions
- **Section 40-880 ITAA 1997** - Blackhole expenditure
- **Section 25-110 ITAA 1997** - Lease termination payments

### Loss Carry-Forward
- **Division 36 ITAA 1997** - Tax losses of earlier income years
- **Division 165/166 ITAA 1997** - Company loss tests
- **Division 35 ITAA 1997** - Non-commercial losses
- **LCR 2019/1** - Similar Business Test guidance

### Personal Capital
- **Division 7A ITAA 1936** - Loans to shareholders
- **Section 118-20 ITAA 1997** - Capital contributions

### ATO Arrangements
- **Taxation Administration Act 1953** - Payment arrangements
- **Corporations Act 2001 Part 5.3B** - Small Business Restructuring

## Recommended Actions

1. **Immediately**: Compile comprehensive P&L for last 5 FYs to quantify losses
2. **This Week**: Write off all bad debts from old business
3. **This Month**: Document the "evolution story" from old to new business for SiBT
4. **Before Lodging**: Consider private ruling on loss utilization if losses are significant
5. **Professional Review**: Engage tax advisor for ATO negotiation strategy
