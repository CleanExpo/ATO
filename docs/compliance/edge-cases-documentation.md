# Edge Cases Documentation - Accountant Workflow System

**Document Version**: 2.0
**Created**: 2026-01-30
**Updated**: 2026-02-11
**Linear Issue**: [UNI-279](https://linear.app/unite-hub/issue/UNI-279)
**Validated By**: Tax Agent (Domain Specialist)
**Financial Year**: FY2024-25 / FY2025-26
**Next Review**: 2026-07-01 (FY2025-26 start)

---

## Document Purpose

This document catalogues edge cases, unusual scenarios, and boundary conditions that the Accountant Workflow System may encounter. Each edge case includes system behavior, compliance considerations, and recommended accountant action.

**Edge Case Categories**:
1. Boundary Conditions (thresholds, limits)
2. Exceptional Scenarios (unusual facts)
3. Ambiguous Situations (unclear application of law)
4. Data Quality Issues (missing/invalid data)
5. Timing Issues (financial year boundaries)

---

## Table of Contents

1. [R&D Tax Incentive Edge Cases](#rd-tax-incentive-edge-cases)
2. [Section 8-1 Deduction Edge Cases](#section-8-1-deduction-edge-cases)
3. [FBT Edge Cases](#fbt-edge-cases)
4. [Division 7A Edge Cases](#division-7a-edge-cases)
5. [Substantiation Edge Cases](#substantiation-edge-cases)
6. [Reconciliation Edge Cases](#reconciliation-edge-cases)
7. [Trust Distribution Edge Cases](#trust-distribution-edge-cases)
8. [Loss Engine Edge Cases](#loss-engine-edge-cases)
9. [CGT Edge Cases](#cgt-edge-cases)
10. [Fuel Tax Credit Edge Cases](#fuel-tax-credit-edge-cases)
11. [Superannuation Edge Cases](#superannuation-edge-cases)
12. [Known Remaining Gaps](#known-remaining-gaps)

---

## R&D Tax Incentive Edge Cases

### Edge Case RD-001: Activity Partially Meets Four-Element Test

**Scenario**: Activity meets 3 of 4 elements of R&D test, borderline on one element.

**Example**:
- Software development project
- ✅ Outcome unknown
- ✅ Systematic progression
- ❓ New knowledge generated (unclear - may just be applying existing frameworks)
- ✅ Scientific method

**System Behavior**:
- Confidence Score: 45-55 (Low)
- Flag as requiring ATO private ruling
- Recommend professional review

**Compliance Consideration**:
All four elements must be met. If uncertain on one element, activity is NOT eligible R&D.

**Accountant Action**:
1. Review technical evidence for disputed element
2. If borderline, recommend NOT claiming (conservative approach)
3. Consider ATO advance finding if high value ($100K+)

**Legislation**: Section 355-25, ITAA 1997

---

### Edge Case RD-002: Aggregated Turnover Exactly $20,000,000

**Scenario**: Company aggregated turnover is exactly $20M (boundary between 43.5% and 38.5% offset rates).

**System Behavior**:
```typescript
if (aggregatedTurnover < 20_000_000) {
  offsetRate = 0.435; // 43.5%
} else {
  offsetRate = 0.385; // 38.5%
}
// Exactly $20M → 38.5% (not <$20M)
```

**Impact**:
- $200K expenditure @ 43.5% = $87,000
- $200K expenditure @ 38.5% = $77,000
- **Difference: $10,000**

**Accountant Action**:
1. Verify aggregated turnover calculation
2. Consider if any affiliated entities missed
3. If borderline, calculate both scenarios for client

**Legislation**: Section 355-105(2), ITAA 1997

---

### Edge Case RD-003: R&D Activity Spans Multiple Financial Years

**Scenario**: R&D project starts in FY2024-25, continues into FY2025-26. Some expenditure incurred in each year.

**System Behavior**:
- Track expenditure by financial year
- Separate R&D registrations required for each FY
- Alert accountant if project crosses FY boundary

**Compliance Consideration**:
- Must register R&D activities for EACH financial year separately
- FY2024-25: Register by 30 April 2026
- FY2025-26: Register by 30 April 2027

**Example**:
```
Project: AI Algorithm Development
Start: 1 May 2024 (FY2023-24)
End: 31 August 2025 (FY2025-26)

FY2023-24: $50K expenditure → Register by 30 Apr 2025
FY2024-25: $150K expenditure → Register by 30 Apr 2026
FY2025-26: $30K expenditure → Register by 30 Apr 2027
```

**Accountant Action**:
1. Track expenditure by FY
2. Set reminders for multiple registration deadlines
3. Ensure R&D activities re-registered each year

---

### Edge Case RD-004: Employee 100% R&D in One FY, 0% in Next FY

**Scenario**: Employee works 100% on R&D in FY2024-25, then moves to 100% non-R&D work in FY2025-26.

**System Behavior**:
- Apportionment changes year-to-year
- Flag significant apportionment changes (>50% swing)
- Alert for documentation justification

**Compliance Consideration**:
Apportionment must reflect actual R&D time. Dramatic changes require strong evidence (timesheets, project records).

**Red Flag**:
ATO may query if apportionment changes dramatically without explanation (concern about manipulation).

**Accountant Action**:
1. Ensure timesheets/project records support apportionment
2. Document reason for change (project completed, new role, etc.)
3. Prepare explanation for ATO if queried

---

### Edge Case RD-005: R&D Conducted Overseas

**Scenario**: Australian company conducts R&D activities overseas (e.g., hiring overseas developers).

**System Behavior**:
- Check if "on behalf of" Australian entity
- Verify eligible overseas finding status
- Reduce confidence score (complex area)

**Compliance Consideration**:
Overseas R&D is only eligible if:
- Conducted on behalf of Australian R&D entity
- Cannot be conducted in Australia
- Pre-approval required if >$20M

**Legislation**: Section 355-210(1), ITAA 1997

**Accountant Action**:
1. Check if overseas R&D pre-approved
2. Verify "on behalf of" relationship
3. Consider NOT claiming if uncertain (high audit risk)

---

### Edge Case RD-006: Refundable Offset Exceeds $4M Cap

**Scenario**: Large R&D expenditure ($12M) generates offset ($5.22M) exceeding the $4M refundable cap.

**System Behavior**:
```typescript
const totalOffset = 12_000_000 * 0.435; // $5,220,000
const refundable = Math.min(totalOffset, 4_000_000); // $4,000,000
const carryForward = totalOffset - refundable; // $1,220,000
```

**Compliance Consideration**:
Section 355-100(3) ITAA 1997 caps the refundable R&D tax offset at $4M per annum (from FY2021-22). The excess becomes a non-refundable offset that can reduce tax liability or carry forward.

**Accountant Action**:
1. Calculate total offset and identify cap impact
2. Determine if non-refundable carry-forward has value (i.e., company has future tax liability)
3. Consider spreading R&D expenditure across years if cap is regularly hit
4. Report both refundable and carry-forward amounts

**Legislation**: Section 355-100(3), ITAA 1997

---

### Edge Case RD-007: Entity at 30% Corporate Rate Claims R&D

**Scenario**: Company pays 30% corporate tax rate (turnover <$20M but >80% passive income, or turnover ≥$50M). R&D offset rate is 48.5%, not 43.5%.

**System Behavior**:
```typescript
const corporateRate = 0.30; // 30% entity
const premium = aggregatedTurnover < 20_000_000 ? 0.185 : 0.085;
const offsetRate = corporateRate + premium; // 48.5% (not 43.5%)
```

**Impact**:
- $200K expenditure @ 43.5% (25% entity) = $87,000
- $200K expenditure @ 48.5% (30% entity) = $97,000
- **Difference: $10,000** additional offset for 30% entities

**Accountant Action**:
1. Verify corporate tax rate (25% base rate or 30% standard)
2. Check both turnover AND passive income tests for base rate entity status
3. Apply correct offset rate based on actual corporate rate

**Legislation**: Section 355-105, ITAA 1997

---

### Edge Case RD-008: R&D Results Commercialised (Clawback)

**Scenario**: Company claimed $200K R&D offset in FY2022-23. In FY2024-25, the resulting IP is sold for $500K.

**System Behavior**:
- Per-project clawback warning generated
- Recommendation to assess clawback obligation
- Warning included in analysis summary

**Compliance Consideration**:
Section 355-450 ITAA 1997: When R&D results are commercialised, the original offset amount attributable to those results is included in assessable income. This effectively "claws back" the tax benefit.

**Accountant Action**:
1. Track R&D projects and their commercialisation status
2. If results sold/licensed, calculate clawback amount
3. Include clawback in assessable income for the year of commercialisation
4. Consider timing of commercialisation events

**Legislation**: Section 355-450, ITAA 1997

---

### Edge Case RD-009: Insufficient Evidence (<3 Items)

**Scenario**: R&D activity claimed with only 1 supporting evidence item (a single timesheet).

**System Behavior**:
- Evidence count checked: minimum 3 items recommended
- Confidence score reduced
- Warning: "Insufficient R&D evidence - minimum 3 supporting items recommended"

**Compliance Consideration**:
While there is no legislative minimum evidence count, ATO audits typically require multiple forms of evidence (technical reports, timesheets, experiment logs, meeting notes) to substantiate each element of the four-element test.

**Accountant Action**:
1. Gather additional evidence (technical reports, project plans, experiment logs)
2. Ensure evidence covers all four elements of the test
3. If evidence is thin, consider not claiming (conservative approach)
4. Prepare evidence bundle for potential ATO audit

**Legislation**: Section 355-25, ITAA 1997 (evidence requirements per ATO guidelines)

---

## Section 8-1 Deduction Edge Cases

### Edge Case DED-001: Expense Exactly $82.50 (Substantiation Threshold)

**Scenario**: Expense is exactly $82.50 (at substantiation threshold).

**System Behavior**:
```typescript
const THRESHOLD = 82.50;

if (expense.amount >= THRESHOLD) {
  // Written evidence required
  requireInvoice = true;
} else {
  requireInvoice = false;
}
// Exactly $82.50 → Invoice required
```

**Accountant Action**:
- Treat as requiring invoice (conservative)
- Small expenses <$10 each, <$200 total still exempt

**Legislation**: Section 900-115, TAA 1953

---

### Edge Case DED-002: Mixed Business and Private Use (50/50 Split)

**Scenario**: Asset used exactly 50% for business, 50% for private (e.g., home office, car).

**System Behavior**:
- Apportion 50/50
- Flag for accountant review (neat apportionment may raise ATO queries)

**Compliance Consideration**:
50/50 splits are common, but should be justified by logbook/time records, not just estimates.

**Red Flag**:
ATO may query if many expenses claimed at exactly 50% (appears too convenient).

**Accountant Action**:
1. Verify apportionment based on actual usage records
2. If estimate, document basis
3. Consider varying slightly based on actual data (e.g., 53% business, 47% private if evidence supports)

---

### Edge Case DED-003: Repair vs Improvement (Borderline)

**Scenario**: Expense is borderline between repair (deductible) and improvement (capital).

**Example**:
- Replace broken roof tiles: Repair ✅
- Replace entire roof with better materials: Improvement ❌
- Replace half the roof: Borderline ❓

**System Behavior**:
- Analyze description for keywords (replace, upgrade, improve, renovate)
- Reduce confidence if ambiguous
- Flag for accountant review

**Compliance Consideration**:
**Repair**: Restores asset to original condition
**Improvement**: Enhances asset beyond original state

**ATO Tests**:
1. Entirety test: Replace entire asset = improvement
2. Functionality test: Adds new function = improvement
3. Value test: Substantially increases value = improvement

**Accountant Action**:
1. Apply ATO tests
2. If borderline, consider splitting (repair portion deductible, improvement capitalized)
3. Document rationale

**Legislation**: Section 8-1, ITAA 1997 + TR 97/23

---

### Edge Case DED-004: Pre-Business Commencement Expenses

**Scenario**: Expense incurred before business commenced (e.g., market research, setup costs).

**System Behavior**:
- Check if business commenced in FY
- Flag if expense date before ABN registration
- Alert for s 40-880 treatment

**Compliance Consideration**:
Pre-business expenses may be:
- Non-deductible (if too remote from income)
- Deductible under s 40-880 (blackhole expenditure)
- Deductible as startup costs (if business operates)

**Accountant Action**:
1. Determine business commencement date
2. Apply s 40-880 if >$150 individual expense or >$5,000 total
3. Amortize over 5 years

**Legislation**: Section 40-880, ITAA 1997

---

### Edge Case DED-005: Expense Incurred on 30 June (Last Day of FY)

**Scenario**: Large expense incurred on 30 June (last day of financial year).

**System Behavior**:
- Flag for timing review (potential date manipulation)
- Check if invoice date matches payment date
- Alert if pattern of 30 June expenses

**Red Flag**:
ATO queries clustering of expenses on 30 June (concern about prepayment or date manipulation).

**Accountant Action**:
1. Verify expense genuinely incurred on 30 June
2. Check invoice date and payment date align
3. If prepayment, check 12-month rule (s 82KZMF)

**Legislation**: Section 8-1, ITAA 1997

---

### Edge Case DED-006: Deduction FY Outside Amendment Period

**Scenario**: System recommends amending FY2020-21 return for a company. The assessment was issued in December 2021, and the 4-year amendment period expires December 2025.

**System Behavior**:
```typescript
const result = checkAmendmentPeriod({
  entityType: 'company',
  financialYear: 'FY2020-21',
  assessmentDate: new Date('2021-12-15')
});
// withinPeriod: false (as of Feb 2026)
// warning: "FY outside 4-year amendment period (s 170 TAA 1953)"
```

**Compliance Consideration**:
Section 170 TAA 1953: Once the amendment period has expired, the Commissioner generally cannot amend the assessment (and neither can the taxpayer request an amendment).

**Exception**: Fraud or evasion has no time limit.

**Accountant Action**:
1. Check assessment date (not just FY end date)
2. If outside period, do NOT recommend amendment
3. If fraud/evasion suspected, amendment period is unlimited
4. Document the limitation for client

**Legislation**: Section 170, TAA 1953

---

### Edge Case DED-007: Base Rate Entity Fails Passive Income Test

**Scenario**: Company has turnover of $30M (<$50M threshold) but 85% passive income (rental income from investment properties).

**System Behavior**:
```typescript
const isBaseRateEntity =
  aggregatedTurnover < 50_000_000 &&
  passiveIncomePercentage <= 80;
// $30M turnover ✅ BUT 85% passive income ❌
// Company pays 30% tax rate, NOT 25%
```

**Impact**:
- If wrongly treated as base rate entity: tax at 25%
- Correct treatment: tax at 30%
- On $500K taxable income: $25,000 underpayment

**Accountant Action**:
1. Calculate passive income percentage (rental, interest, dividends, royalties, net capital gains)
2. If >80%, entity pays 30% corporate rate
3. This also affects R&D offset rate (48.5% instead of 43.5%)
4. Verify both turnover AND passive income tests annually

**Legislation**: Section 23AA, ITAA 1936

---

## FBT Edge Cases

### Edge Case FBT-001: Car Travelled Exactly 15,000 km (Statutory Band Boundary)

**Scenario**: Car travelled exactly 15,000 km (boundary between 20% and 20% statutory rates - no change in FY2024-25).

**System Behavior**:
```typescript
// FY2024-25 statutory rates
const RATES = [
  { min: 0, max: 14_999, rate: 0.20 },
  { min: 15_000, max: 24_999, rate: 0.20 },  // Same rate
  { min: 25_000, max: 40_000, rate: 0.15 },
  { min: 40_001, max: Infinity, rate: 0.10 }
];
// 15,000 km → 20%
```

**Note**: In FY2024-25, both bands are 20%, so no impact. In prior years, this was a boundary.

**Accountant Action**:
- Verify odometer readings
- Document km calculation

---

### Edge Case FBT-002: Benefit Exactly $300 (Minor Benefits Exemption Threshold)

**Scenario**: Benefit provided exactly $300 (at minor benefits exemption threshold).

**System Behavior**:
```typescript
const MINOR_BENEFIT_THRESHOLD = 300;

if (benefit.notionalValue < MINOR_BENEFIT_THRESHOLD) {
  // Exempt if infrequent and irregular
  exempt = true;
} else {
  exempt = false;
}
// Exactly $300 → NOT exempt
```

**Compliance Consideration**:
Minor benefits exemption applies if notional taxable value is **less than** $300 (not equal to).

**Accountant Action**:
- Apply FBT if value ≥$300
- Document value calculation

**Legislation**: Section 58P, FBTAA 1986

---

### Edge Case FBT-003: Loan Interest Rate Exactly 8.77% (Benchmark Rate)

**Scenario**: Employer loan to employee at exactly 8.77% interest (equals benchmark rate for FY2024-25).

**System Behavior**:
```typescript
const BENCHMARK_RATE = 0.0877; // 8.77%

if (loan.interestRate < BENCHMARK_RATE) {
  // Loan fringe benefit arises
  fbtLiability = calculateLoanFBT(loan);
} else {
  // No benefit (interest ≥ benchmark)
  fbtLiability = 0;
}
// Exactly 8.77% → No FBT
```

**Compliance Consideration**:
No FBT if interest rate equals or exceeds benchmark.

**Accountant Action**:
- Ensure loan agreement specifies 8.77% (or variable rate linked to ATO benchmark)
- Verify interest actually charged and paid

**Legislation**: Section 16, FBTAA 1986

---

### Edge Case FBT-004: Car Available for 1 Day vs Full Year

**Scenario**: Car available for employee private use for 1 day vs full year.

**System Behavior**:
- Car FBT applies if available for ANY private use
- Statutory formula uses annual km (no pro-rata for days available)
- Operating cost method pro-rates by days available

**Example**:
```
Car cost: $50,000
Available: 1 day (365 total days)

Statutory method:
Taxable value = $50,000 × 20% × (1/365) = $27 (annual FBT ~$26)

Operating cost method:
Taxable value = Operating costs × private% × (1/365)
```

**Accountant Action**:
- If car available <1 year, consider operating cost method
- Document availability period

**Legislation**: Section 9, FBTAA 1986

---

### Edge Case FBT-005: Entertainment Exactly 50% Business

**Scenario**: Meal entertainment exactly 50% business, 50% private (e.g., client dinner with spouse).

**System Behavior**:
- 50/50 split method available
- Deems 50% exempt, 50% taxable (no calculation needed)

**Compliance Consideration**:
50/50 split method is a statutory simplification. If actual business% differs significantly, may want to use actual method.

**Accountant Action**:
- If primarily business, consider actual method (more than 50% exempt)
- If primarily private, 50/50 method more favorable
- Document business purpose

**Legislation**: Section 37AA, FBTAA 1986

---

## Division 7A Edge Cases

### Edge Case DIV7A-001: Loan Repaid on Lodgment Day (Not Before)

**Scenario**: Shareholder repays loan ON lodgment day, not before.

**System Behavior**:
```typescript
const LODGMENT_DAY = companyTaxReturnLodgmentDate;

if (repaymentDate <= LODGMENT_DAY) {
  // Safe - repaid before or on lodgment day
  deemedDividend = 0;
} else {
  // Too late - deemed dividend
  deemedDividend = loanBalance;
}
```

**Compliance Consideration**:
"Before" lodgment day means on or before. Repayment on lodgment day is acceptable.

**Accountant Action**:
- Recommend repayment well before lodgment day (don't cut it close)
- Document repayment date with bank statement

**Legislation**: Section 109D(3), ITAA 1936

---

### Edge Case DIV7A-002: Interest Paid 1 Day Late

**Scenario**: Required minimum interest payment due 30 June, actually paid 1 July.

**System Behavior**:
- Payment must be made before end of FY
- 1 day late = deemed dividend arises

**Impact**:
```
Loan: $100,000
Required interest: $8,770 (8.77%)
Paid 1 July (FY2025-26) instead of 30 June (FY2024-25)

Deemed dividend (FY2024-25): $8,770
```

**Accountant Action**:
- Alert client to strict deadline
- Recommend setting payment date to 25 June (safety margin)
- If missed, consider declaring actual dividend to avoid Div 7A

**Legislation**: Section 109N, ITAA 1936

---

### Edge Case DIV7A-003: Loan Balance Exactly $0.01

**Scenario**: Loan repaid down to $0.01 remaining balance.

**System Behavior**:
```typescript
if (loanBalance >= 0.01) {
  // Deemed dividend on entire balance
  deemedDividend = loanBalance;
}
// Even $0.01 triggers Div 7A
```

**Compliance Consideration**:
ANY outstanding balance triggers Div 7A. Must be fully repaid (to $0.00).

**Accountant Action**:
- Ensure complete repayment
- Verify bank transfer cleared before lodgment day

---

### Edge Case DIV7A-004: Shareholder Holds 0.01% Shares

**Scenario**: Loan to person holding 0.01% shares (minimal shareholding).

**System Behavior**:
- Division 7A applies to ANY shareholder (no minimum threshold)
- Also applies to associates of shareholders

**Compliance Consideration**:
Even tiny shareholdings (<1%) trigger Div 7A.

**Accountant Action**:
- Identify all shareholders (including minor shareholders)
- Check associates (family members, related entities)

**Legislation**: Section 109D, ITAA 1936

---

### Edge Case DIV7A-005: Amalgamated Loan Created Mid-Year

**Scenario**: Multiple non-complying loans amalgamated into complying loan partway through financial year.

**System Behavior**:
- Amalgamation allowed under s 109NA
- Calculate deemed dividend for period before amalgamation
- New complying loan for remainder of year

**Example**:
```
3 loans totaling $150K
Non-complying for 6 months (Jul-Dec)
Amalgamated into complying 7-year loan on 1 Jan

Deemed dividend: $150K × 8.77% × 6/12 = $6,578
New loan: $150K, complying from 1 Jan
```

**Accountant Action**:
- Calculate part-year deemed dividend
- Ensure written loan agreement dated before lodgment day
- Make minimum repayment for remainder of year

**Legislation**: Section 109NA, ITAA 1936

---

### Edge Case DIV7A-006: Deemed Dividend Exceeds Distributable Surplus

**Scenario**: Total deemed dividend risk ($250,000) exceeds the company's distributable surplus ($150,000).

**System Behavior**:
```typescript
const cappedDividend = Math.min(totalDeemedDividendRisk, distributableSurplus);
// $250,000 risk capped to $150,000 surplus
```

**Compliance Consideration**:
Section 109Y ITAA 1936: A deemed dividend cannot exceed the company's distributable surplus. The surplus is calculated as net assets minus paid-up share capital minus non-commercial loans to the company.

**Accountant Action**:
1. Verify distributable surplus calculation from balance sheet
2. If surplus is low, deemed dividend is naturally capped
3. Consider retaining earnings before distributions to increase surplus
4. Document surplus calculation for ATO compliance

**Legislation**: Section 109Y, ITAA 1936

---

### Edge Case DIV7A-007: Multiple Loans to Same Shareholder (Amalgamation)

**Scenario**: Private company has 3 separate loans to the same director-shareholder totaling $300,000.

**System Behavior**:
- `checkAmalgamationProvisions()` groups loans by shareholder name
- Warning generated: "Multiple loans exist to same shareholder - consider amalgamation under s 109E(8)"
- Each loan assessed independently for minimum repayment but amalgamation flag raised

**Compliance Consideration**:
Section 109E(8) allows multiple loans to be amalgamated into a single complying loan agreement. This can simplify compliance but requires a new written agreement covering the total balance.

**Accountant Action**:
1. Consider amalgamating loans into a single complying agreement
2. Ensure new agreement covers total balance at benchmark rate
3. Calculate minimum repayment on amalgamated balance
4. Document amalgamation decision

**Legislation**: Section 109E(8), ITAA 1936

---

### Edge Case DIV7A-008: Transaction Matches Safe Harbour Keyword

**Scenario**: A $50,000 payment to a director is labelled "Salary - Director" in Xero. The safe harbour exclusion matches the keyword "salary".

**System Behavior**:
```typescript
const SAFE_HARBOUR_KEYWORDS = ['salary', 'wages', 'rent', 'professional fees', ...];
// Transaction description matched → excluded from Div 7A analysis
```

**Compliance Consideration**:
Section 109RB provides safe harbour exclusions for payments at arm's length commercial terms. However, keyword matching alone is not definitive — the payment must genuinely be at market rate.

**Edge Case**: Salary of $500,000 to a director who works 10 hours/week is NOT at arm's length despite matching "salary" keyword.

**Accountant Action**:
1. Verify safe harbour exclusion is genuine (arm's length terms)
2. For large amounts, cross-check against market rate benchmarks
3. Document commercial justification for excluded payments
4. Flag if safe harbour amount appears excessive

**Legislation**: Section 109RB, ITAA 1936

---

### Edge Case DIV7A-009: Written Agreement Status Unknown (Tri-State)

**Scenario**: System cannot determine whether a complying loan agreement exists. The agreement status is "unknown" rather than "yes" or "no".

**System Behavior**:
- Agreement status tracked as tri-state: 'yes' | 'no' | 'unknown'
- When unknown, system assumes non-complying (conservative)
- Warning: "Written agreement status unknown - verify with client"

**Compliance Consideration**:
Without a written agreement, the loan is treated as non-complying. However, the agreement may exist but not be recorded in the accounting system.

**Accountant Action**:
1. Request copy of loan agreement from client
2. If agreement exists, update status and recalculate
3. If no agreement, recommend executing one before lodgment day
4. Document inquiry and response

**Legislation**: Section 109N(2), ITAA 1936

---

## Substantiation Edge Cases

### Edge Case SUB-001: Invoice Lost After Expense Incurred

**Scenario**: Expense incurred, invoice obtained, then invoice lost before tax return lodged.

**System Behavior**:
- Flag as missing substantiation
- Reduce confidence in deduction
- Alert accountant

**Compliance Consideration**:
Taxpayer must obtain and **keep** records. Lost invoices may result in denied deduction.

**Accountant Action**:
1. Request duplicate invoice from supplier
2. If unavailable, obtain statutory declaration
3. Document efforts to obtain evidence
4. Consider excluding deduction if no evidence (conservative)

**Legislation**: Section 262A, ITAA 1936

---

### Edge Case SUB-002: Credit Card Statement Only (No Itemized Receipt)

**Scenario**: Expense paid by credit card, statement shows charge but no itemized receipt.

**System Behavior**:
- Credit card statement alone NOT adequate
- Require itemized invoice/receipt
- Flag as insufficient substantiation

**Compliance Consideration**:
Credit card statement shows payment, not nature of expense. Need itemized receipt.

**Example**:
```
❌ INSUFFICIENT:
Credit card statement: "ABC Suppliers - $250"

✅ SUFFICIENT:
Invoice from ABC Suppliers showing:
- Office supplies (printer paper, pens)
- Amount $250
- Date
```

**Accountant Action**:
- Request itemized receipt from supplier
- If unavailable, exclude deduction

---

### Edge Case SUB-003: Logbook Exactly 12 Weeks (Minimum Requirement)

**Scenario**: Car logbook maintained for exactly 12 weeks (minimum required period).

**System Behavior**:
- 12 weeks = 84 days minimum
- Count from first entry to last entry
- Verify consecutive weeks

**Compliance Consideration**:
Must be 12 **consecutive** weeks. Can't cherry-pick high business-use weeks.

**Accountant Action**:
- Verify logbook covers 84+ consecutive days
- Check entries for all days (including weekends/holidays if car used)
- Recommend maintaining year-round logbook (better evidence)

**Legislation**: Section 28-25, ITAA 1997

---

### Edge Case SUB-004: Travel Exactly 6 Nights (Diary Threshold)

**Scenario**: Business travel for exactly 6 nights away from home.

**System Behavior**:
```typescript
if (nightsAway >= 6) {
  // Travel diary required
  require_diary = true;
}
// Exactly 6 nights → Diary required
```

**Compliance Consideration**:
Travel diary required if ≥6 consecutive nights.

**Accountant Action**:
- Obtain travel diary if 6+ nights
- If 5 nights or less, no diary needed (but still need receipts)

**Legislation**: Section 900-30, TAA 1953

---

### Edge Case SUB-005: Expense Paid in Cash (No EFTPOS Receipt)

**Scenario**: Expense paid in cash, supplier provides handwritten receipt.

**System Behavior**:
- Handwritten receipt acceptable if includes required info
- Flag if excessive cash payments (ATO red flag)

**Compliance Consideration**:
Cash payments are legitimate but raise ATO queries if excessive (concern about undeclared income).

**Required Info on Handwritten Receipt**:
- Supplier name and ABN
- Amount
- Date
- Description of goods/services
- Supplier signature (recommended)

**Accountant Action**:
1. Verify handwritten receipt includes required info
2. If client has pattern of cash payments, recommend EFTPOS/EFT (better audit trail)
3. Document reason for cash payment if unusual

---

## Reconciliation Edge Cases

### Edge Case REC-001: Bank Deposit Exactly Matches Invoice Amount

**Scenario**: Bank deposit of $5,000 exactly matches a $5,000 invoice issued.

**System Behavior**:
- Auto-match deposit to invoice
- Confirm reconciliation

**Edge Case Variation**: Two $5,000 invoices, one $5,000 deposit.

**System Behavior**:
- Cannot auto-match (ambiguous)
- Flag for manual reconciliation
- Accountant must allocate deposit

**Accountant Action**:
- Review customer payment reference
- Match to correct invoice
- Document allocation

---

### Edge Case REC-002: Unreconciled Variance of Exactly $0.01 (Rounding)

**Scenario**: Total deposits $100,000.01, total sales $100,000.00. Variance: $0.01.

**System Behavior**:
- Flag rounding difference
- Variance % = 0.00001% (negligible)
- Auto-approve if <$1 variance

**Compliance Consideration**:
Rounding differences <$1 are acceptable. Document and move on.

**Accountant Action**:
- Accept rounding variance
- Note in reconciliation: "Rounding difference $0.01"

---

### Edge Case REC-003: Large Round-Number Deposit ($100,000) with No Invoice

**Scenario**: Bank deposit of exactly $100,000 with no matching invoice or explanation.

**System Behavior**:
- Flag as high-risk unreconciled
- Alert accountant (potential undeclared income or loan)
- Require explanation

**Red Flag**:
Large round numbers without explanation are ATO audit triggers (concern about cash sales suppression).

**Accountant Action**:
1. Investigate source (customer payment, loan, capital injection, personal deposit)
2. If loan, document loan agreement
3. If sale, create invoice retroactively (with explanation)
4. Never leave unexplained

---

### Edge Case REC-004: Revenue Decreased 100% (Business Ceased)

**Scenario**: FY2023-24 revenue $500K, FY2024-25 revenue $0 (business ceased operations).

**System Behavior**:
- Flag 100% revenue decrease
- Alert for business cessation treatment
- Check for:
  - Outstanding debtors
  - Final tax return
  - Trading stock write-down
  - CGT on business assets

**Compliance Consideration**:
Business cessation has special tax consequences (losses, depreciation balances, trading stock).

**Accountant Action**:
1. Confirm business ceased (not just temporarily inactive)
2. Lodge final tax return
3. Review treatment of:
   - Remaining trading stock (s 70-115)
   - Depreciating assets (sold or retained)
   - Outstanding debtors (bad debts)
   - Tax losses (can't carry forward if business ceased)

**Legislation**: Division 70, ITAA 1997 (Trading stock on cessation)

---

### Edge Case REC-005: First Digit Distribution Exactly Matches Benford's Law

**Scenario**: Transaction first-digit distribution perfectly matches Benford's Law expected distribution.

**System Behavior**:
- No red flag (matches expected pattern)
- However, perfect match may also be suspicious (fabricated to match Benford's)

**Benford's Law Expected Distribution**:
```
First Digit | Expected %
1           | 30.1%
2           | 17.6%
3           | 12.5%
4           | 9.7%
5           | 7.9%
6           | 6.7%
7           | 5.8%
8           | 5.1%
9           | 4.6%
```

**Edge Case**: Actual distribution exactly 30.1%, 17.6%, 12.5%, etc. (too perfect).

**Accountant Action**:
- Perfect match may be coincidence (low transaction count)
- Combined with other red flags, investigate further
- Benford's Law is screening tool, not definitive proof

---

## Trust Distribution Edge Cases

### Edge Case TRUST-001: Distribution to Minor with Family Dealing Exclusion

**Scenario**: Trust distributes $5,000 to a 15-year-old grandchild for school expenses. Section 100A flag raised but family dealing exclusion applies.

**System Behavior**:
- Initial flag: "Distribution to minor beneficiary" (high severity)
- Family dealing exclusion check: s 100A(13) applies (ordinary family purpose)
- Severity downgraded: high → low
- Risk reduction: 40 points applied

**Compliance Consideration**:
TR 2022/4 clarifies that distributions for ordinary family purposes (education, living expenses) between family members are generally excluded from s 100A.

**Accountant Action**:
1. Document family relationship and purpose of distribution
2. Verify distribution is for genuine family purposes
3. Retain evidence (school fee invoices, etc.)

**Legislation**: Section 100A(13), ITAA 1936; TR 2022/4

---

### Edge Case TRUST-002: Undistributed Income Assessed at Wrong Penalty Rate

**Scenario**: Trust fails to distribute all income. Trustee penalty tax calculated at 45% instead of 47%.

**System Behavior**:
- Penalty rate = 45% (top marginal) + 2% (Medicare Levy) = 47%
- System uses 47% as implemented post-audit fix
- Warning if historical data shows 45% used

**Impact**:
- On $100,000 undistributed: $45,000 (wrong) vs $47,000 (correct) = $2,000 underpayment

**Accountant Action**:
1. Always use 47% (45% + 2% Medicare Levy) per s 99A
2. Check historical calculations for 45% error
3. Amend if within amendment period

**Legislation**: Section 99A, ITAA 1936

---

## Loss Engine Edge Cases

### Edge Case LOSS-001: Capital Loss Applied Against Ordinary Income

**Scenario**: Company has $50,000 capital loss and $200,000 ordinary income but no capital gains. Temptation to offset capital loss against ordinary income.

**System Behavior**:
```typescript
// Capital losses can ONLY offset capital gains (s 102-5)
const capitalLossOffset = Math.min(capitalLosses, capitalGains); // $0
const capitalLossCarryForward = capitalLosses - capitalLossOffset; // $50,000 carried forward
// Capital loss does NOT reduce $200,000 ordinary income
```

**Compliance Consideration**:
Section 102-5 ITAA 1997: Capital losses are quarantined and can only offset capital gains. They carry forward indefinitely until used against future capital gains.

**Accountant Action**:
1. Maintain separate tracking of capital and revenue losses
2. Never apply capital losses against ordinary assessable income
3. Carry forward capital losses to future years with capital gains
4. Document capital loss balance in working papers

**Legislation**: Section 102-5, ITAA 1997

---

### Edge Case LOSS-002: Trust Loss Rules Incorrectly Use Division 165

**Scenario**: System applies Division 165 (company COT/SBT rules) to a trust's loss recoupment analysis.

**System Behavior**:
- Entity type check: trust → route to Division 266/267 (NOT Division 165)
- `analyzeTrustLossRecoupment()` applies Schedule 2F ITAA 1936
- Family Trust Election (s 272-75) checked
- Pattern of distributions test (s 269-60) applied

**Compliance Consideration**:
Trust losses are governed by Division 266/267, Schedule 2F, ITAA 1936. Division 165 applies ONLY to companies. Using the wrong rules could allow ineligible loss claims.

**Accountant Action**:
1. Verify entity type before applying loss rules
2. For trusts: check FTE status, distributions test, income injection test
3. For companies: check COT and SBT under Division 165
4. Never mix company and trust loss rules

**Legislation**: Division 266/267, Schedule 2F, ITAA 1936

---

## CGT Edge Cases

### Edge Case CGT-001: Connected Entity Pushes Net Assets Over $6M

**Scenario**: Taxpayer has $4M net assets. Connected family trust has $3M. Aggregated: $7M. Fails Division 152 net asset test.

**System Behavior**:
```typescript
const aggregated = ownAssets + connectedEntityAssets;
// $4M + $3M = $7M > $6M threshold → FAILS
```

**Compliance Consideration**:
Subdivision 152-15 ITAA 1997 requires aggregating assets of the taxpayer, connected entities (s 152-30), and affiliates (s 152-25) for the $6M net asset value test.

**Accountant Action**:
1. Identify ALL connected entities and affiliates
2. Aggregate net assets across all entities
3. If close to threshold, consider restructuring
4. Cliff edge warning: within 10% of $6M ($5.4M-$6M) triggers warning

**Legislation**: Subdivision 152-15, ITAA 1997

---

### Edge Case CGT-002: Collectable Loss Cannot Offset Non-Collectable Gain

**Scenario**: $20,000 loss on art sale. $50,000 gain on share sale. Art loss cannot offset share gain.

**System Behavior**:
```typescript
// Art = collectable. Shares = ordinary CGT asset.
// Collectable losses ONLY offset collectable gains (s 108-10)
const collectableLossApplied = 0; // No collectable gains to offset
const collectableLossCarryForward = 20_000; // Carried forward for future collectable gains
const netCapitalGain = 50_000; // Share gain stands unreduced
```

**Accountant Action**:
1. Classify CGT assets: collectable, personal use, or ordinary
2. Quarantine collectable losses — only apply against future collectable gains
3. Disregard personal use asset losses entirely (s 108-20)
4. Track collectable loss balance separately

**Legislation**: Section 108-10(1), Section 108-20(1), ITAA 1997

---

## Fuel Tax Credit Edge Cases

### Edge Case FTC-001: Rate Changes Mid-Quarter

**Scenario**: Fuel purchased in February uses Q3 rate, but ATO updates rate in late February for the remainder of the quarter.

**System Behavior**:
- `FUEL_TAX_CREDIT_RATES` map provides per-quarter rates
- Transaction date determines applicable quarter/rate
- Fallback to prior quarter if rate for current quarter not yet available

**Compliance Consideration**:
Fuel tax credit rates are updated quarterly by the ATO, typically at the start of each quarter (July, October, January, April). Occasionally, mid-quarter adjustments occur.

**Accountant Action**:
1. Use rate applicable at the date of fuel purchase
2. Verify rate against ATO quarterly rate schedule
3. If mid-quarter change, apportion if significant

**Legislation**: Section 41-5, Fuel Tax Act 2006

---

### Edge Case FTC-002: Heavy Vehicle On-Road vs Off-Road Split

**Scenario**: Heavy vehicle (>4.5t GVM) used 60% on public roads and 40% off-road. Road user charge only applies to on-road portion.

**System Behavior**:
```typescript
const onRoadCredit = litres * 0.6 * (baseRate - roadUserCharge);
const offRoadCredit = litres * 0.4 * baseRate;
const totalCredit = onRoadCredit + offRoadCredit;
```

**Accountant Action**:
1. Determine on-road vs off-road usage split (logbook or estimate)
2. Apply road user charge reduction only to on-road portion
3. Full credit rate applies to off-road portion
4. Document usage split methodology

**Legislation**: Section 43-10, Fuel Tax Act 2006

---

## Superannuation Edge Cases

### Edge Case SUPER-001: SG Rate Straddles Financial Year Change

**Scenario**: Employee's quarterly super is calculated in June 2025 (FY2024-25, 11.5%) but paid in July 2025 (FY2025-26, 12%).

**System Behavior**:
- SG rate determined by the quarter in which the salary was earned, not when super is paid
- Q4 FY2024-25 (Apr-Jun 2025): 11.5% rate applies
- Q1 FY2025-26 (Jul-Sep 2025): 12% rate applies

**Accountant Action**:
1. Apply SG rate for the quarter the salary was earned
2. Not the quarter the super contribution was paid
3. Verify payroll system uses correct rates at FY boundary
4. Alert client about rate increase for planning purposes

**Legislation**: Section 19, SGAA 1992

---

### Edge Case SUPER-002: Carry-Forward with Super Balance Exactly $500,000

**Scenario**: Individual's total super balance at 30 June 2024 is exactly $500,000.

**System Behavior**:
```typescript
const BALANCE_THRESHOLD = 500_000;
if (totalSuperBalance < BALANCE_THRESHOLD) {
  // Eligible for carry-forward
} else {
  // NOT eligible (must be LESS than $500,000)
}
// Exactly $500,000 → NOT eligible
```

**Impact**:
- $499,999: Carry-forward available (up to 5 years unused cap)
- $500,000: No carry-forward. Standard $30,000 cap only.
- Difference could be $20,000+ additional cap

**Accountant Action**:
1. Check total super balance at 30 June of prior year
2. If close to $500,000, consider strategy (contributions timing, pension drawdowns)
3. Exactly $500,000 = NOT eligible (strict less-than test)

**Legislation**: Section 291-20, ITAA 1997

---

## Known Remaining Gaps

The following are known limitations in the current engine implementations that have been identified but not yet resolved:

### GAP-1: Division 7A Fallback Rate Table (7A-1)

**Issue**: The Division 7A engine's fallback benchmark interest rate table only covers rates through FY2024-25. When FY2025-26 begins (1 July 2025), the engine will need the new benchmark rate (published via ATO Tax Determination).

**Current Behavior**: Falls back to FY2024-25 rate (8.77%) if FY2025-26 rate not yet fetched from live data.

**Risk**: Incorrect interest calculations if live rate scraping fails after 30 June 2025.

**Mitigation**: Live rate fetching is the primary mechanism. Fallback only used when live fetch fails. Rate table should be updated when ATO publishes TD 2025/x.

### GAP-2: Part-Year Loan Minimum Repayment Not Pro-Rated (7A-2)

**Issue**: Section 109E(5) ITAA 1936 provides that for loans made part-way through a financial year, the minimum repayment is proportionally reduced. The engine currently calculates full-year minimum repayment for all loans.

**Current Behavior**: Full-year repayment calculated regardless of loan start date.

**Risk**: Overstating minimum repayment shortfall for mid-year loans. This is conservative (may flag false positives) but does not understate risk.

**Mitigation**: Since this is a conservative error (overstating compliance risk rather than understating), it has lower priority. Future enhancement to pro-rate by days remaining in FY.

---

## Appendix: Handling Unknown Edge Cases

### General Approach for Unanticipated Edge Cases

When encountering a scenario not documented:

**1. Conservative Treatment**
- If uncertain, adopt conservative position (less aggressive)
- Reduces audit risk

**2. Legislative Research**
- Search ATO website for guidance
- Review tax rulings and determinations
- Check case law if significant $

**3. Professional Consultation**
- Escalate to senior tax accountant
- Consider tax lawyer for complex issues
- ATO private ruling if high-value ($100K+)

**4. Documentation**
- Document reasoning
- Save research references
- File note of decision

**5. Confidence Scoring**
- Reduce confidence score for unclear scenarios
- Flag for accountant review
- Disclose uncertainty to client

**6. ATO Contact**
If genuinely unclear:
- ATO Advice Line: 13 28 66
- Written ruling request
- Private ruling application (complex/high-value)

---

**Edge Cases Documentation Status**: Complete
**Total Edge Cases Documented**: 50+
**Coverage**: All 11 workflow areas + known gaps
**Next Review**: 2026-07-01 (FY2025-26 start)
**Document Owner**: Tax Agent (Domain Specialist)
