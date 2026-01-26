---
name: tax-compliance-verification
description: Systematic verification of tax calculations, rates, thresholds, and legislative references against ATO publications. Ensures every output from the platform is legislatively correct and defensible.
---

# Tax Compliance Verification Skill

Systematic verification capability for all tax calculations, rates, thresholds, and legislative references produced by the Australian Tax Optimizer platform.

## When to Use

Activate this skill when:
- Reviewing or modifying any tax calculation in `lib/analysis/*.ts`
- Verifying AI prompt outputs in `lib/ai/*.ts`
- Validating API responses from `app/api/audit/*.ts`
- Before presenting any tax recommendation to users
- After modifying tax rates, thresholds, or formulas
- During system integrity audits

## Verification Checklist

### 1. Rate Accuracy
Verify every tax rate against ATO publications:

| Check | Source | Action |
|-------|--------|--------|
| Rate matches ATO.gov.au | ato.gov.au/rates | Compare exact value |
| Correct FY applied | Legislation commencement dates | Check effective dates |
| Fallback rate documented | Code comments | Verify fallback is current FY |
| Rate sourced dynamically | `getCurrentTaxRates()` | Prefer dynamic over hardcoded |

### 2. Legislative Reference Accuracy
Verify every citation is correct:

| Check | Standard | Example |
|-------|----------|---------|
| Act name correct | Full name with year | ITAA 1997, not "Income Tax Act" |
| Division correct | Division number | Division 355, not "R&D Division" |
| Section correct | Section number with subsection | s 355-25(1)(a) |
| Ruling current | Not withdrawn or superseded | TR 2019/1 (check ATO legal database) |

### 3. Calculation Formula Verification
For every mathematical formula:

| Check | Process |
|-------|---------|
| Formula matches legislation | Trace formula to specific section |
| Rounding rules correct | ATO rounding guidelines (generally to nearest cent) |
| Order of operations | Verify parentheses match legislative intent |
| Edge cases handled | Zero, negative, null, very large values |
| Entity type considered | Company (25%/30%), trust (marginal), individual |

### 4. Financial Year Handling
Verify FY logic is correct:

| Check | Expected |
|-------|----------|
| FY format | `FY2024-25` (not `FY2025` or `2024-25`) |
| FY boundaries | 1 July to 30 June (not calendar year) |
| FY calculation | `month >= 7 ? currentYear : currentYear - 1` |
| Rate-to-FY mapping | Rate applied to correct FY |
| Amendment period | 2 years (simple) or 4 years (company/trust) |

### 5. Entity Type Handling
Verify entity-specific logic:

| Entity | Tax Rate | Loss Rules | Write-Off |
|--------|----------|------------|-----------|
| Company (base rate) | 25% | COT/SBT (Div 165) | s 328-180 ($20K) |
| Company (standard) | 30% | COT/SBT (Div 165) | s 328-180 ($20K) |
| Trust | Beneficiary marginal rates | SBT only | s 328-180 ($20K) |
| Individual | 0-45% + Medicare 2% | N/A | N/A |
| Partnership | Partner marginal rates | N/A | s 328-180 ($20K) |

## Rate Verification Table (FY2024-25)

### Income Tax Rates

| Rate | Value | Legislation | ATO Source |
|------|-------|-------------|------------|
| Company (base rate entity) | 25% | ITAA 1997, s 23AA | ato.gov.au/rates/company-tax |
| Company (standard) | 30% | ITAA 1997, s 23 | ato.gov.au/rates/company-tax |
| Base rate entity threshold | < $50M turnover | ITAA 1997, s 23AA | ato.gov.au/business |

### R&D Tax Incentive

| Rate | Value | Legislation | ATO Source |
|------|-------|-------------|------------|
| Refundable offset (< $20M) | 43.5% (25% + 18.5%) | ITAA 1997, s 355-100 | ato.gov.au/rnd |
| Non-refundable offset (>= $20M) | 33.5% (25% + 8.5%) | ITAA 1997, s 355-100 | ato.gov.au/rnd |
| Minimum expenditure | $20,000 | ITAA 1997, s 355-25(1) | ato.gov.au/rnd |
| Registration deadline | 10 months post-FY | Industry Research Act | business.gov.au/ausindustry |
| Expenditure cap (clinical) | $150M | ITAA 1997, s 355-100 | ato.gov.au/rnd |

### Division 7A

| Rate | Value | Legislation | ATO Source |
|------|-------|-------------|------------|
| Benchmark interest FY2024-25 | 8.77% | ITAA 1936, s 109N | ato.gov.au/div7a |
| Benchmark interest FY2023-24 | 8.33% | ITAA 1936, s 109N | ato.gov.au/div7a |
| Benchmark interest FY2022-23 | 4.52% | ITAA 1936, s 109N | ato.gov.au/div7a |
| Unsecured loan max term | 7 years | ITAA 1936, s 109N | ato.gov.au/div7a |
| Secured loan max term | 25 years | ITAA 1936, s 109N | ato.gov.au/div7a |

### Small Business Concessions

| Rate | Value | Legislation | ATO Source |
|------|-------|-------------|------------|
| Instant write-off threshold | $20,000 | ITAA 1997, s 328-180 | ato.gov.au/depreciation |
| Simplified depreciation pool | 15% first year, 30% subsequent | ITAA 1997, s 328-185 | ato.gov.au/depreciation |
| SB turnover threshold | < $10M | ITAA 1997, s 328-110 | ato.gov.au/small-business |

### Deduction Rates

| Rate | Value | Legislation | ATO Source |
|------|-------|-------------|------------|
| Home office (fixed rate) | 67c/hour | PCG 2023/1 | ato.gov.au/home-office |
| Vehicle (cents per km) | 85c/km | TD 2024/3 | ato.gov.au/vehicle |
| Vehicle max km | 5,000 km | ITAA 1997, s 28-25 | ato.gov.au/vehicle |
| FBT rate | 47% | FBTAA 1986, s 5B | ato.gov.au/fbt |
| SG rate | 11.5% | SGA 1992, s 19 | ato.gov.au/super |

## Process

### Step 1: Extract
Identify all tax calculations, rates, and thresholds in the target code:
- Hardcoded numeric values
- Rate variables and constants
- Formula expressions
- Conditional logic based on thresholds
- Legislative references in comments or strings

### Step 2: Cross-Reference
For each extracted value:
- Look up current ATO publication
- Verify value matches for applicable FY
- Check if rate is dynamic or hardcoded
- Verify fallback values are current

### Step 3: Validate
For each calculation:
- Trace formula to legislative source
- Test with known good inputs/outputs
- Test edge cases (zero, null, boundary values)
- Verify entity type handling
- Check rounding behaviour

### Step 4: Flag
Categorise findings:
- **PASS**: Calculation verified correct
- **WARN**: Calculation works but has edge case risks
- **FAIL**: Calculation produces incorrect results
- **MISSING**: Required calculation not implemented

### Step 5: Certify
Generate verification report:
- List all checks performed
- Document pass/fail status for each
- Provide specific remediation for failures
- Sign off on overall engine status

## Output Template

```xml
<compliance_verification>
  <target>Engine or file being verified</target>
  <date>YYYY-MM-DD</date>
  <financial_year>FY2024-25</financial_year>

  <checks>
    <check name="R&D offset rate">
      <status>pass|warn|fail|missing</status>
      <expected>0.435</expected>
      <actual>Value found in code</actual>
      <legislation>ITAA 1997, s 355-100</legislation>
      <source>ato.gov.au/rnd</source>
      <notes>Additional context</notes>
    </check>
  </checks>

  <summary>
    <total_checks>N</total_checks>
    <passed>N</passed>
    <warnings>N</warnings>
    <failed>N</failed>
    <missing>N</missing>
  </summary>

  <certification>
    <status>certified|remediation_required</status>
    <confidence>0-100</confidence>
  </certification>
</compliance_verification>
```

## Best Practices

1. **Always verify against primary sources** - ATO.gov.au, not secondary commentary
2. **Check effective dates** - Rates change annually, verify FY applicability
3. **Test boundary conditions** - $19,999 vs $20,000 for instant write-off
4. **Document assumptions** - If a rate cannot be verified, document why
5. **Flag dynamic vs hardcoded** - Prefer dynamic rates from `getCurrentTaxRates()`
6. **Consider entity type** - Same legislation applies differently to companies, trusts, individuals
