---
name: rnd-eligibility-assessment
description: R&D Tax Incentive eligibility assessment methodology. Evaluates activities against Division 355 criteria, classifies core vs supporting R&D, and calculates refundable tax offsets.
---

# R&D Eligibility Assessment Skill

Systematic methodology for assessing R&D Tax Incentive eligibility under Division 355 ITAA 1997.

## When to Use

Activate this skill when the task requires:
- Evaluating if activities qualify as R&D
- Classifying core vs supporting R&D activities
- Quantifying eligible R&D expenditure
- Calculating potential tax offsets
- Preparing registration documentation

## Division 355 Framework

### Legislative Structure

```
Division 355 - R&D Tax Incentive
├── Subdivision 355-A: Guide
├── Subdivision 355-B: Entitlement to tax offset
│   ├── s 355-100: Tax offset for R&D entities
│   └── s 355-105: Amount of tax offset
├── Subdivision 355-C: Core R&D activities
│   └── s 355-25: Core R&D activity definition
├── Subdivision 355-D: Supporting R&D activities
│   └── s 355-30: Supporting R&D activity definition
├── Subdivision 355-E: Notional deductions
│   ├── s 355-200: R&D expenditure
│   └── s 355-205: Decline in value of R&D assets
└── Subdivision 355-F: Clawback provisions
```

## Core R&D Activity Test (s 355-25)

### The Four Requirements

An activity is a **core R&D activity** if it meets ALL of these:

```
┌──────────────────────────────────────────────────────────────────┐
│ ELEMENT 1: EXPERIMENTAL ACTIVITIES                               │
│                                                                  │
│ "Activities whose outcome cannot be known or determined in       │
│ advance on the basis of current knowledge, information or        │
│ experience, but can only be determined by applying a systematic  │
│ progression of work..."                                          │
│                                                                  │
│ Test Questions:                                                  │
│ □ Is there genuine technical uncertainty?                        │
│ □ Could a competent professional determine the outcome in        │
│   advance using existing knowledge?                              │
│ □ Is experimentation required to resolve the uncertainty?        │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ ELEMENT 2: SYSTEMATIC PROGRESSION OF WORK                        │
│                                                                  │
│ Work that:                                                       │
│ (a) proceeds from hypothesis to experiment                       │
│ (b) involves observation and evaluation                          │
│ (c) leads to logical conclusions                                 │
│                                                                  │
│ Test Questions:                                                  │
│ □ Was there a defined hypothesis or theory?                      │
│ □ Were experiments conducted methodically?                       │
│ □ Were results observed and evaluated?                           │
│ □ Were conclusions drawn from the work?                          │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ ELEMENT 3: PURPOSE - GENERATING NEW KNOWLEDGE                    │
│                                                                  │
│ Conducted for the purpose of generating new knowledge:           │
│ (a) new knowledge in any field                                   │
│ (b) including new or improved materials, products, devices,      │
│     processes or services                                        │
│                                                                  │
│ Test Questions:                                                  │
│ □ Is the outcome new to the field (not just to the company)?     │
│ □ Does it advance technical knowledge?                           │
│ □ Is it creating genuinely new capability?                       │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ ELEMENT 4: SCIENTIFIC METHOD (Principles)                        │
│                                                                  │
│ Based on principles of established science:                      │
│ - Uses scientific or technological principles                    │
│ - Follows rational, logical approach                             │
│ - Documents methodology and findings                             │
│                                                                  │
│ Test Questions:                                                  │
│ □ Is the work based on scientific/technical principles?          │
│ □ Is the methodology documented?                                 │
│ □ Are results recorded systematically?                           │
└──────────────────────────────────────────────────────────────────┘
```

### Exclusions (s 355-25(2))

The following are **NEVER** core R&D activities:

```
❌ Market research, market testing, or sales promotion
❌ Quality control or routine testing
❌ Management studies or efficiency surveys
❌ Research in social sciences, arts, or humanities
❌ Mineral, petroleum, or gas exploration or extraction
❌ Commercial, legal, or administrative aspects of patenting
❌ Activities related to compliance with statutory requirements
❌ Development of internal administrative systems
❌ Developing, modifying, installing commercial software (routine)
```

## Supporting R&D Activity Test (s 355-30)

An activity is a **supporting R&D activity** if:

```
Option 1: DIRECTLY RELATED
  - Directly related to core R&D activities

Option 2: DOMINANT PURPOSE
  - For the dominant purpose of supporting core R&D

Option 3: GOODS AND SERVICES
  - Producing goods or services to be used in core R&D
```

**Note:** Supporting activities must be reasonably proportioned to the core activities they support.

## Assessment Methodology

### Step 1: Activity Identification
```yaml
Activity Template:
  name: "[Descriptive name]"
  description: "[What was done and why]"
  period: "[Date range of activity]"
  personnel: "[Who performed the work]"
  
  technical_uncertainty:
    - "[Uncertainty 1]"
    - "[Uncertainty 2]"
  
  hypothesis: "[Initial hypothesis or theory tested]"
  
  experiments:
    - "[Experiment 1 description]"
    - "[Experiment 2 description]"
  
  observations: "[Key observations from work]"
  
  conclusions: "[Conclusions reached]"
  
  new_knowledge: "[What new knowledge was generated]"
```

### Step 2: Eligibility Scoring
```
For each activity, score against Division 355 criteria:

┌─────────────────────────────────────┬───────┬──────────┐
│ Criterion                           │ Score │ Evidence │
├─────────────────────────────────────┼───────┼──────────┤
│ Unknown outcome?                    │ 0-3   │          │
│ Systematic progression?             │ 0-3   │          │
│ New knowledge purpose?              │ 0-3   │          │
│ Scientific method?                  │ 0-3   │          │
├─────────────────────────────────────┼───────┼──────────┤
│ TOTAL                               │ /12   │          │
└─────────────────────────────────────┴───────┴──────────┘

Scoring Guide:
0 = Does not meet
1 = Partially meets
2 = Meets
3 = Strongly meets

Eligibility Assessment:
10-12: High confidence eligible
7-9:   Likely eligible, document well
4-6:   Uncertain, seek Finding
0-3:   Not eligible
```

### Step 3: Expenditure Calculation
```
R&D Expenditure Categories:

1. SALARY & WAGES
   = (Employee annual salary × R&D time %)
   + Superannuation (11%)
   + Workers compensation
   + Payroll tax

2. CONTRACTOR PAYMENTS
   = Total payments to R&D contractors
   (Must be at arm's length)

3. DIRECT MATERIALS
   = Cost of materials consumed in R&D
   (Not assets, consumables only)

4. DEPRECIATION
   = Decline in value of R&D assets × R&D use %
   (Assets used predominantly for R&D)

5. OVERHEADS
   = Rent × R&D allocation %
   + Utilities × R&D allocation %
   + Other overheads × R&D allocation %

TOTAL R&D EXPENDITURE = Sum of above
```

### Step 4: Offset Calculation
```
For Small Business (Turnover < $20M):

Tax Offset = Total R&D Expenditure × 43.5%

Example:
$100,000 eligible expenditure × 43.5%
= $43,500 refundable tax offset

Note: Refundable means cash refund even if in loss position!
```

## Documentation Requirements

### Contemporaneous Records

The ATO requires records created **at the time** of the R&D:

1. **Project Records**
   - Project plans and specifications
   - Technical design documents
   - Progress reports

2. **Time Records**
   - Timesheets showing R&D hours
   - Project allocation records
   - Team member roles

3. **Experiment Records**
   - Hypothesis statements
   - Test plans and protocols
   - Test results and data
   - Analysis and conclusions

4. **Financial Records**
   - Invoices and receipts
   - Payroll records
   - Asset purchase records

### Registration Documentation

For each R&D activity (max 1,500 words per activity):

```markdown
## [Activity Title]

### Description of Activity
[What R&D was conducted]

### Technical Uncertainty
[What couldn't be known in advance]

### Systematic Progression
[How hypothesis-experiment-observation-conclusion was followed]

### New Knowledge Outcome
[What new knowledge was generated]

### Relationship to Other Activities
[How this relates to other R&D projects if applicable]
```

## Output Format

```xml
<rnd_eligibility_assessment>
  <project id="RND-001">
    <name>[Project Name]</name>
    <period>
      <start>2023-07-01</start>
      <end>2024-06-30</end>
    </period>
    
    <classification>Core R&D | Supporting R&D | Not eligible</classification>
    <confidence>High | Medium | Low</confidence>
    
    <criteria_assessment>
      <unknown_outcome score="3">
        <evidence>[How outcome was uncertain]</evidence>
      </unknown_outcome>
      <systematic_progression score="2">
        <evidence>[How methodology was followed]</evidence>
      </systematic_progression>
      <new_knowledge score="3">
        <evidence>[What new knowledge was generated]</evidence>
      </new_knowledge>
      <scientific_method score="2">
        <evidence>[Scientific basis of work]</evidence>
      </scientific_method>
      <total_score>10</total_score>
    </criteria_assessment>
    
    <expenditure>
      <salary_wages>$45,000</salary_wages>
      <contractors>$15,000</contractors>
      <materials>$5,000</materials>
      <depreciation>$3,000</depreciation>
      <overheads>$7,000</overheads>
      <total>$75,000</total>
    </expenditure>
    
    <tax_offset>
      <rate>43.5%</rate>
      <amount>$32,625</amount>
      <refundable>true</refundable>
    </tax_offset>
    
    <documentation_status>
      <timesheets>Yes | No | Partial</timesheets>
      <project_records>Yes | No | Partial</project_records>
      <experiment_records>Yes | No | Partial</experiment_records>
    </documentation_status>
    
    <recommendations>
      <item priority="high">[Required action]</item>
    </recommendations>
  </project>
</rnd_eligibility_assessment>
```

## Key Precedents

| Case | Principle |
|------|-----------|
| **Moreton Resources** [2018] AATA 3378 | Technical uncertainty must be genuine |
| **Core Surveys** [2008] AATA 989 | Systematic progression is essential |
| **Harding** [2019] FCAFC 29 | Software can be R&D if innovative |
| **AusNet** [2020] AATA 1972 | Routine implementation not R&D |

## Common Pitfalls

| Pitfall | Avoidance |
|---------|-----------|
| No contemporaneous records | Implement time tracking immediately |
| Mixing R&D and non-R&D | Clearly separate activities |
| Over-claiming | Use conservative allocations |
| Missing deadline | Register within 10 months |
| Poor activity descriptions | Use structured format above |
