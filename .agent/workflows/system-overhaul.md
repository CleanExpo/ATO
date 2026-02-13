---
description: Complete tax system integrity overhaul driven by Senior Product Manager. Systematically audits and remediates all tax analysis engines, AI prompts, and calculation pipelines.
---

# System Overhaul Workflow

## Prerequisites

1. All 5 tax analysis engines present in `lib/analysis/`
2. AI forensic analyser present in `lib/ai/`
3. At least one Xero organisation connected with cached transaction data
4. Access to ATO rate publications for current FY

## Workflow Steps

### Step 1: Deploy Senior Product Manager
- Activate in VERIFICATION mode
- Bind skills: `tax_compliance_verification`, `tax_fraud_detection`, `australian_tax_law_research`
- Set scope: All engines, all AI prompts, all API routes

### Step 2: Inventory Phase
Map all tax-related code:

| Component | Location | Tax Areas |
|-----------|----------|-----------|
| R&D Engine | `lib/analysis/rnd-engine.ts` | Division 355, 43.5% offset |
| Deduction Engine | `lib/analysis/deduction-engine.ts` | Section 8-1, Division 40, 328 |
| Loss Engine | `lib/analysis/loss-engine.ts` | Division 36, 165 (COT/SBT) |
| Division 7A Engine | `lib/analysis/div7a-engine.ts` | Division 7A, s 109D/109N |
| Reconciliation Engine | `lib/analysis/reconciliation-engine.ts` | Data integrity |
| Forensic Analyser | `lib/ai/forensic-analyzer.ts` | All tax categories |
| Account Classifier | `lib/ai/account-classifier.ts` | Chart of accounts |
| Batch Processor | `lib/ai/batch-processor.ts` | Data pipeline |
| R&D Summary API | `app/api/audit/rnd-summary/route.ts` | R&D aggregation |
| Backfill API | `app/api/audit/backfill-amounts/route.ts` | Data integrity |

### Step 3: Verify Calculations
For each engine, run the Tax Compliance Verification skill:
1. Extract all hardcoded rates and thresholds
2. Cross-reference against ATO publications
3. Validate formulas against legislation
4. Test edge cases
5. Document findings

### Step 4: Remediate Critical Issues
Fix in priority order:

| Priority | Engine | Issue | Fix |
|----------|--------|-------|-----|
| 1 | loss-engine.ts | P&L treats all BANK as expenses | Classify by account type |
| 2 | loss-engine.ts | COT/SBT always returns true | Return 'unknown', flag for review |
| 3 | deduction-engine.ts | Assumes claimed if confidence >= 80% | Remove assumption |
| 4 | deduction-engine.ts | Fixed 25% tax rate | Dynamic rate by entity type |
| 5 | div7a-engine.ts | Opening balance always $0 | Track year-over-year |
| 6 | forensic-analyzer.ts | R&D over-flagging bias | Balanced prompt |
| 7 | rnd-engine.ts | Element test unweighted by amount | Weight by dollar value |
| 8 | account-classifier.ts | Error defaults to correct | Default to unknown |
| 9 | reconciliation-engine.ts | Exact name matching only | Levenshtein distance |

### Step 5: Run Fraud Detection
Apply Tax Fraud Detection skill to each engine output:
- R&D: Verify no routine activities flagged as R&D
- Deductions: Verify no private expenses recommended
- Losses: Verify no artificial loss schemes
- Division 7A: Verify no circular arrangements
- All: Apply Part IVA eight-factor test to high-value recommendations

### Step 6: Add Missing Tax Areas
Identify and document gaps:

| Tax Area | Status | Priority |
|----------|--------|----------|
| Entertainment (50% rule) | Not classified | HIGH |
| Vehicle expenses | Not calculated | HIGH |
| Home office (actual cost) | Not calculated | MEDIUM |
| GST input credits | Not analysed | MEDIUM |
| FBT calculation | Flagged only, not calculated | MEDIUM |
| Superannuation optimisation | Not analysed | LOW |
| CGT concessions | Agent exists, no engine | LOW |
| Section 100A trust arrangements | Agent exists, no engine | LOW |

### Step 7: Re-Verify Post-Fix
After all remediations:
1. Re-run compliance verification on each modified engine
2. Confirm all critical issues resolved
3. Run build to verify no TypeScript errors
4. Test with live Xero data
5. Compare before/after results

### Step 8: Generate Certification Report
Produce final integrity report:
- Engine-by-engine certification status
- Issues found and resolved
- Remaining known limitations
- Recommendations for future improvement
- Professional review requirements

## Output

```xml
<system_overhaul_report>
  <date>YYYY-MM-DD</date>
  <scope>Complete tax system integrity overhaul</scope>

  <engines_reviewed>
    <engine name="..." status="certified|remediated|known_limitation" />
  </engines_reviewed>

  <issues_resolved>
    <issue severity="critical" engine="..." description="..." />
  </issues_resolved>

  <known_limitations>
    <limitation engine="..." description="..." mitigation="..." />
  </known_limitations>

  <certification>
    <status>pass|conditional_pass|fail</status>
    <conditions>What must be true for certification</conditions>
  </certification>
</system_overhaul_report>
```

## Follow-Up Workflows

After overhaul completion:
- `/tax-audit` - Run full audit with corrected engines
- `/rnd-assessment` - Re-evaluate R&D with balanced criteria
- `/deduction-scan` - Re-scan with proper deductibility rules
- `/loss-analysis` - Re-analyse with corrected P&L and COT/SBT
