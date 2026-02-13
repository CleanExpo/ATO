---
name: tax-fraud-detection
description: Detection and prevention of illegal tax avoidance, Part IVA anti-avoidance triggers, circular arrangements, and sham transactions. Ensures all recommendations are legally defensible and do not constitute tax fraud.
---

# Tax Fraud Detection Skill

Proactive detection and prevention capability ensuring no recommendation produced by the Australian Tax Optimizer platform constitutes illegal tax avoidance or would trigger Part IVA anti-avoidance provisions.

## When to Use

Activate this skill when:
- Reviewing tax recommendations for legal defensibility
- Analysing transaction patterns for circular or artificial arrangements
- Assessing R&D claims for legitimacy (not routine activities disguised as R&D)
- Evaluating Division 7A arrangements for sham characteristics
- Checking loss carry-forward for artificial loss generation
- Assessing trust distribution arrangements under Section 100A
- Any recommendation involves > $50,000 in claimed benefits

## Part IVA Anti-Avoidance Framework

### Overview (ITAA 1936, Part IVA)

Part IVA is the general anti-avoidance provision. The Commissioner can cancel a tax benefit if:

1. **A scheme exists** (s 177A) - Very broadly defined; almost any arrangement qualifies
2. **A tax benefit was obtained** (s 177C/CB) - Amount not included in assessable income, or deduction claimed
3. **Dominant purpose was tax benefit** (s 177D) - Assessed objectively, considering 8 factors

### The 8 Factors (s 177D(2))

| Factor | Description | Red Flag |
|--------|-------------|----------|
| (a) | Manner of scheme | Unusual or contrived steps |
| (b) | Form and substance | Form doesn't match economic substance |
| (c) | Time of entry | Arrangement timed around FY boundaries |
| (d) | Result achieved | Result only makes sense if tax benefit obtained |
| (e) | Change in financial position | Parties' positions unchanged except for tax |
| (f) | Change in financial position (others) | Related parties benefit disproportionately |
| (g) | Tax consequences | Scheme designed to exploit specific provisions |
| (h) | Connection between parties | Related party involvement |

## Red Flags

### R&D Tax Incentive Fraud Indicators

| Indicator | Risk Level | Action |
|-----------|------------|--------|
| Routine software development claimed as R&D | HIGH | Verify technical uncertainty existed |
| IT operations/maintenance claimed as R&D | HIGH | Verify systematic investigation occurred |
| Cloud hosting/infrastructure claimed as R&D | MEDIUM | Verify experimental purpose |
| Consulting fees claimed as R&D | MEDIUM | Verify consultant performed R&D activities |
| No technical uncertainty documented | CRITICAL | Cannot claim - Division 355 requires uncertainty |
| Activities completed before registration | HIGH | May indicate retrospective claim |

### Division 7A Fraud Indicators

| Indicator | Risk Level | Action |
|-----------|------------|--------|
| Circular loan arrangements | CRITICAL | Loan → dividend → repayment → new loan |
| Loans at zero interest | HIGH | Deemed dividend unless compliant agreement |
| No written agreement | HIGH | Must exist before lodgment date |
| Loans to associates/related trusts | MEDIUM | Check UPE and sub-trust arrangements |
| Artificially low repayments | MEDIUM | Below minimum yearly repayment |
| Backdated loan agreements | CRITICAL | Fraud indicator |

### Deduction Fraud Indicators

| Indicator | Risk Level | Action |
|-----------|------------|--------|
| Private expenses claimed as business | CRITICAL | No nexus to income production |
| Capital expenditure claimed as revenue | HIGH | Must be capitalised and depreciated |
| Duplicate deductions across entities | CRITICAL | Same expense claimed by multiple entities |
| Inflated amounts vs market value | HIGH | Transfer pricing / Part IVA risk |
| Related party payments above market | HIGH | Non-arm's length dealing |

### Loss Carry-Forward Fraud Indicators

| Indicator | Risk Level | Action |
|-----------|------------|--------|
| Artificial losses via uncommercial deals | CRITICAL | Part IVA cancellation of loss |
| Loss trafficking (company acquisition for losses) | CRITICAL | COT/SBT specifically prevents this |
| Circular transactions generating losses | CRITICAL | Sham arrangement |
| Losses from non-commercial activities | HIGH | Division 35 restrictions apply |
| Losses from tax shelter arrangements | HIGH | Division 245 debt forgiveness rules |

## Process

### Step 1: Scan
Examine the recommendation or transaction pattern:
- Extract all claimed tax benefits (amounts, provisions)
- Identify parties involved (related? associated? independent?)
- Map the arrangement steps chronologically
- Note any unusual timing or structure

### Step 2: Classify
Categorise the arrangement:

| Category | Description | Risk |
|----------|-------------|------|
| Ordinary commercial | Normal business transaction | LOW |
| Tax-effective | Structured for tax efficiency, genuine commercial purpose | LOW-MEDIUM |
| Aggressive | Tax benefit is significant motivation, some commercial substance | MEDIUM-HIGH |
| Artificial | No genuine commercial purpose, designed for tax benefit | HIGH-CRITICAL |
| Sham | Parties never intended to give effect to arrangement | CRITICAL |

### Step 3: Assess
Apply the Part IVA eight-factor test:
- Score each factor 0-10 (0 = no concern, 10 = maximum concern)
- Overall score: Sum / 80 × 100 = percentage risk
- Threshold: > 40% = flag for professional review
- Threshold: > 70% = do not recommend

### Step 4: Report
Generate findings:
- Specific risk identified
- Part IVA factor(s) triggered
- Recommended action (proceed / modify / abandon)
- Legislative basis for concern
- Professional review requirement

## Output Template

```xml
<fraud_assessment>
  <arrangement>Description of arrangement being assessed</arrangement>
  <date>YYYY-MM-DD</date>

  <part_iva_analysis>
    <scheme_exists>true|false</scheme_exists>
    <tax_benefit_amount>$X</tax_benefit_amount>

    <factors>
      <factor id="a" name="Manner of scheme" score="0-10">
        <assessment>Analysis</assessment>
      </factor>
      <!-- Factors b through h -->
    </factors>

    <overall_score>Percentage</overall_score>
    <risk_level>low|medium|high|critical</risk_level>
  </part_iva_analysis>

  <red_flags>
    <flag severity="critical|high|medium|low">
      <description>Specific concern</description>
      <legislation>Relevant provision</legislation>
    </flag>
  </red_flags>

  <recommendation>
    <action>proceed|modify|abandon</action>
    <conditions>What must be true to proceed safely</conditions>
    <professional_review_required>true|false</professional_review_required>
  </recommendation>
</fraud_assessment>
```

## Key Case Law

| Case | Principle | Application |
|------|-----------|-------------|
| FCT v Spotless Services (1996) 186 CLR 404 | Dominant purpose test is objective | Don't rely on stated commercial reasons |
| FCT v Hart [2004] HCA 26 | Part IVA applies to individual steps | Each step of arrangement assessed |
| FCT v Futuris Corporation [2008] HCA 32 | Commissioner's discretion is broad | Part IVA applies broadly |
| Harding v FCT [2019] FCAFC 29 | Interposed entity arrangements | Applicable to trust/company structures |

## Compliance Standards

1. **Never recommend arrangements primarily motivated by tax benefit** - Commercial substance required
2. **Always flag related party transactions** - Non-arm's length risk
3. **Verify R&D activities are genuine** - Not routine operations relabelled
4. **Ensure losses are commercially generated** - Not artificial or circular
5. **Document commercial purpose** - For every recommendation, state the non-tax reason
6. **Conservative approach** - When in doubt, recommend professional review
