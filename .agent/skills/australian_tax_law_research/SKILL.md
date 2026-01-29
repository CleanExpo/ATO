---
name: australian-tax-law-research
description: Deep research capability for Australian taxation legislation, ATO rulings, and case law. Provides authoritative legal analysis with full citations for tax optimization decisions.
---

# Australian Tax Law Research Skill

Comprehensive Australian tax law research and analysis capability for the ATO Tax Optimization Agent Suite.

## When to Use

Activate this skill when the task requires:
- Researching specific tax legislation
- Interpreting ATO rulings and guidance
- Analyzing case law precedents
- Verifying tax position defensibility
- Understanding compliance requirements

## Primary Legislation

### Income Tax Assessment Act 1997 (ITAA 1997)

| Division | Topic |
|----------|-------|
| Div 35 | Non-commercial losses |
| Div 36 | Tax losses |
| Div 40 | Capital allowances (depreciation) |
| Div 165 | Company losses - COT and SBT |
| Div 245 | Commercial debt forgiveness |
| Div 328 | Small business entities |
| Div 355 | R&D tax incentive |
| Div 775 | Foreign currency gains/losses |

### Income Tax Assessment Act 1936 (ITAA 1936)

| Section/Division | Topic |
|------------------|-------|
| Division 7A | Private company loans to shareholders |
| Part IVA | Anti-avoidance provisions |

### Other Key Acts

- **A New Tax System (Goods and Services Tax) Act 1999**
- **Taxation Administration Act 1953**
- **Industry Research and Development Act 1986**
- **Superannuation Guarantee (Administration) Act 1992**

## Research Process

### 1. Legislation Search
```
Step 1: Identify relevant Act(s)
Step 2: Navigate to specific Division/Section
Step 3: Extract exact legislative text
Step 4: Check for recent amendments
Step 5: Note commencement and application dates
```

### 2. ATO Guidance Search
```
Step 1: Identify ruling type needed
  - TR: Taxation Ruling (binding)
  - IT: Income Tax Ruling (legacy, some still valid)
  - TD: Taxation Determination (short-form)
  - PCG: Practical Compliance Guideline
  - LCR: Law Companion Ruling
  - ATO ID: Interpretive Decision
  
Step 2: Search ATO legal database
Step 3: Verify ruling is current (check withdrawn/superseded)
Step 4: Extract relevant paragraphs
Step 5: Note any safe harbour provisions
```

### 3. Case Law Search
```
Step 1: Identify relevant tribunal/court
  - AAT: Administrative Appeals Tribunal
  - FC: Federal Court
  - FFC: Full Federal Court
  - HCA: High Court of Australia
  
Step 2: Search legal databases (AustLII, LexisNexis)
Step 3: Extract key ratio decidendi
Step 4: Note any subsequent appeals
Step 5: Assess precedential value
```

## Citation Standards

### Legislation Format
```
[Act Name] [Year], s [Section]([Subsection])([Paragraph])

Examples:
ITAA 1997, s 355-25(1)(a)
ITAA 1936, s 109D(1)
Division 328, ITAA 1997
```

### ATO Ruling Format
```
[Ruling Type] [Year]/[Number]

Examples:
TR 2019/1 - Income tax: research and development activities
TD 2023/1 - Deductibility of cryptocurrency mining costs
PCG 2019/1 - ATO's compliance approach to R&D claims
```

### Case Law Format
```
[Party Names] [Year] [Report Series] [Number]

Examples:
Harding v FCT [2019] FCAFC 29
Moreton Resources Ltd v Innovation Australia [2018] AATA 3378
FCT v Spotless Services Ltd (1996) 186 CLR 404
```

## Key Authoritative Sources

### Primary Sources
| Source | URL | Content |
|--------|-----|---------|
| Federal Register of Legislation | legislation.gov.au | Primary legislation |
| ATO Legal Database | ato.gov.au/law | Rulings and guidance |
| AustLII | austlii.edu.au | Case law |
| High Court | hcourt.gov.au | High Court judgments |

### Secondary Sources
| Source | Use |
|--------|-----|
| CCH iKnow | Comprehensive tax commentary |
| Thomson Reuters Checkpoint | Cross-referenced analysis |
| LexisNexis Tax | Case law and practice notes |
| Business.gov.au | Government program information |

## Research Output Template

```xml
<legal_research>
  <query>[Research question]</query>
  
  <legislation>
    <provision>
      <reference>ITAA 1997, s 355-25(1)</reference>
      <text>[Exact legislative text]</text>
      <application>[How it applies to the situation]</application>
    </provision>
  </legislation>
  
  <ato_guidance>
    <ruling>
      <reference>TR 2019/1</reference>
      <title>[Ruling title]</title>
      <relevant_paragraphs>[Para 45-52]</relevant_paragraphs>
      <key_points>[Summary of relevant points]</key_points>
    </ruling>
  </ato_guidance>
  
  <case_law>
    <case>
      <citation>[Full citation]</citation>
      <ratio>[Key legal principle]</ratio>
      <application>[How case applies]</application>
    </case>
  </case_law>
  
  <conclusion>
    <position>[Legal position]</position>
    <confidence>high|medium|low</confidence>
    <risk_level>low|medium|high|unacceptable</risk_level>
  </conclusion>
</legal_research>
```

## Key Tax Rates (FY2024-25)

| Rate Type | Rate |
|-----------|------|
| Company tax rate (base rate entity) | 25% |
| Company tax rate (other) | 30% |
| R&D offset (turnover < $20M) | 43.5% (25% + 18.5%) |
| R&D offset (turnover ≥ $20M) | 33.5% (25% + 8.5%) |
| Div 7A benchmark interest rate | 8.77% |
| Instant asset write-off threshold | $20,000 |
| Superannuation guarantee | 11% |
| GST rate | 10% |

## Compliance Risk Assessment

| Risk Level | Description | Recommendation |
|------------|-------------|----------------|
| Low | Clear legislation, favorable ATO guidance | Proceed with confidence |
| Medium | Reasonable interpretation, some uncertainty | Document position, consider ruling |
| High | Aggressive interpretation, unfavorable ATO view | Private ruling essential |
| Unacceptable | Likely penalty position, Part IVA risk | Do not proceed |

## Best Practices

1. **Always cite primary sources** - Legislation first, then rulings
2. **Check currency** - Verify legislation/rulings not superseded
3. **Consider context** - Same words may differ by context
4. **Document trail** - Maintain research audit trail
5. **Flag uncertainty** - Note where professional review needed
6. **Conservative default** - When uncertain, err on cautious side
