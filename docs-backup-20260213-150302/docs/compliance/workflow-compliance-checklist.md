# Workflow Compliance Checklist - Accountant Workflow System

**Document Version**: 2.0
**Created**: 2026-01-30
**Updated**: 2026-02-11
**Linear Issue**: [UNI-279](https://linear.app/unite-hub/issue/UNI-279)
**Validated By**: Tax Agent (Domain Specialist)
**Financial Year**: FY2024-25 / FY2025-26
**Next Review**: 2026-07-01 (FY2025-26 start)

---

## Document Purpose

This checklist ensures all AI-generated findings comply with Australian tax legislation before being presented to accountants. Each workflow area has specific compliance criteria that must be met.

**Usage**:
- System runs checklist automatically before creating findings
- Failed checks trigger warnings or reject the finding
- Accountants can view checklist results for each finding

---

## Table of Contents

1. [Sundries (R&D Tax Incentive)](#sundries-rd-tax-incentive)
2. [Deductions (Section 8-1)](#deductions-section-8-1)
3. [Fringe Benefits Tax (FBT)](#fringe-benefits-tax-fbt)
4. [Division 7A](#division-7a)
5. [Source Documents](#source-documents)
6. [Reconciliation](#reconciliation)
7. [Trust Distributions](#trust-distributions)
8. [Tax Losses](#tax-losses)
9. [Capital Gains Tax](#capital-gains-tax)
10. [Fuel Tax Credits](#fuel-tax-credits)
11. [Superannuation](#superannuation)

---

## Sundries (R&D Tax Incentive)

### Four-Element Test Compliance

**Legislation**: Section 355-25, ITAA 1997

#### ✅ Checklist: Core R&D Activity

| # | Criterion | Check | Weight |
|---|-----------|-------|--------|
| **1** | **Outcome Unknown** | Cannot be determined in advance by competent professional | CRITICAL |
| 1.1 | Not routine testing | Activity goes beyond applying existing knowledge | HIGH |
| 1.2 | Genuine uncertainty | Outcome couldn't be predicted beforehand | HIGH |
| 1.3 | Scientific uncertainty | Not commercial or market uncertainty | MEDIUM |
| **2** | **Systematic Progression** | Follows scientific method | CRITICAL |
| 2.1 | Hypothesis formed | Clear hypothesis stated | HIGH |
| 2.2 | Experiment designed | Methodical approach to testing | HIGH |
| 2.3 | Results evaluated | Observations documented and analyzed | MEDIUM |
| 2.4 | Not trial and error | More than random attempts | HIGH |
| **3** | **New Knowledge** | Generates new knowledge | CRITICAL |
| 3.1 | Knowledge generated | Even if result is "doesn't work" | HIGH |
| 3.2 | Beyond existing knowledge | Not applying known solutions | HIGH |
| 3.3 | Documented knowledge | R&D findings recorded | MEDIUM |
| **4** | **Scientific Method** | Based on established science | CRITICAL |
| 4.1 | Scientific principles | Uses principles of science/engineering/IT | HIGH |
| 4.2 | Qualified personnel | Conducted by/under supervision of experts | HIGH |
| 4.3 | Scientific process | Rigorous methodology applied | MEDIUM |

**Scoring**:
- CRITICAL: Must pass all (automatic rejection if failed)
- HIGH: At least 80% must pass
- MEDIUM: At least 60% must pass

**Confidence Score Impact**:
```typescript
function calculateRndConfidence(checks: CheckResults): number {
  const criticalPass = checks.critical.every(c => c.passed);
  if (!criticalPass) return 0; // Reject

  const highPassRate = checks.high.filter(c => c.passed).length / checks.high.length;
  const mediumPassRate = checks.medium.filter(c => c.passed).length / checks.medium.length;

  let confidence = 50; // Base score

  if (highPassRate >= 0.8) confidence += 30;
  if (mediumPassRate >= 0.6) confidence += 20;

  return confidence;
}
```

#### ✅ Checklist: Supporting R&D Activity

| # | Criterion | Check |
|---|-----------|-------|
| 1 | **Directly Related** | Directly related to core R&D activity |
| 1.1 | Core activity identified | Linked to specific core R&D activity |
| 1.2 | Necessary for core | Required for core R&D to proceed |
| 2 | **Excluded Activities** | Not management, administration, or routine |
| 2.1 | Not management | Not general management activities |
| 2.2 | Not admin | Not administrative support |
| 2.3 | Not marketing | Not market research or sales activities |

#### ✅ Checklist: Expenditure Eligibility

| # | Criterion | Check | Legislation |
|---|-----------|-------|-------------|
| 1 | **Incurred on R&D** | Expenditure for R&D activities | s 355-205 |
| 1.1 | Activity registered | R&D activities registered with AusIndustry | CRITICAL |
| 1.2 | Timing correct | Incurred when R&D conducted | HIGH |
| 1.3 | Apportioned correctly | Business vs R&D split documented | HIGH |
| 2 | **Not Excluded** | Not on exclusion list | s 355-210(3) |
| 2.1 | Not interest | Not interest expense | CRITICAL |
| 2.2 | Not core technology | Not core technology acquisition >$50M | CRITICAL |
| 2.3 | Not buildings | Not buildings or expenditure on buildings | CRITICAL |
| 3 | **Offset Rate Correct** | Rate matches turnover | s 355-105 |
| 3.1 | Turnover verified | Aggregated turnover calculated correctly | HIGH |
| 3.2 | Rate applied | 43.5% if <$20M, 38.5% if ≥$20M | CRITICAL |

#### ✅ Checklist: Registration Deadline

| # | Criterion | Check |
|---|-----------|-------|
| 1 | **Registration Due** | 10 months after FY end | CRITICAL |
| 1.1 | FY2024-25 | Deadline 30 April 2026 |
| 1.2 | FY2023-24 | Deadline 30 April 2025 (passed) |
| 2 | **Time Remaining** | Flag if <90 days to deadline | HIGH |

**Automated Alert**:
```typescript
function checkRndDeadline(financialYear: string): {
  deadline: Date;
  daysRemaining: number;
  urgency: 'critical' | 'high' | 'medium' | 'info';
} {
  const fyEnd = parseFinancialYear(financialYear);
  const deadline = addMonths(fyEnd, 10);
  const daysRemaining = differenceInDays(deadline, new Date());

  let urgency: 'critical' | 'high' | 'medium' | 'info';
  if (daysRemaining < 30) urgency = 'critical';
  else if (daysRemaining < 90) urgency = 'high';
  else if (daysRemaining < 180) urgency = 'medium';
  else urgency = 'info';

  return { deadline, daysRemaining, urgency };
}
```

#### ✅ Checklist: R&D Offset Calculation (Post-Audit Updates)

| # | Criterion | Check | Weight |
|---|-----------|-------|--------|
| 1 | **Tiered Offset Rate** | Rate = corporate tax rate + premium (18.5% or 8.5%) | CRITICAL |
| 1.1 | Corporate rate identified | 25% (base rate entity) or 30% (standard) | HIGH |
| 1.2 | Premium correct | 18.5% if turnover <$20M, 8.5% if ≥$20M | CRITICAL |
| 1.3 | 30% entity check | Offset is 48.5% (not 43.5%) for 30% entities with <$20M turnover | HIGH |
| 2 | **$4M Refundable Cap** | Refundable offset capped at $4,000,000 (s 355-100(3)) | CRITICAL |
| 2.1 | Cap applied | If refundable offset exceeds $4M, excess is non-refundable | CRITICAL |
| 2.2 | Carry-forward noted | Excess above cap carries forward as non-refundable offset | MEDIUM |
| 3 | **Evidence Sufficiency** | Minimum 3 supporting evidence items per R&D project | HIGH |
| 3.1 | Evidence count | At least 3 items (technical reports, timesheets, etc.) | HIGH |
| 3.2 | Evidence quality | Each item supports a specific four-element test criterion | MEDIUM |
| 4 | **Clawback Risk** | R&D clawback provisions checked (s 355-450) | HIGH |
| 4.1 | Commercialisation check | Warning if R&D results have been commercialised | HIGH |
| 4.2 | Per-project tracking | Clawback risk assessed per project, not aggregate | MEDIUM |

---

## Deductions (Section 8-1)

### Three-Part Test Compliance

**Legislation**: Section 8-1, ITAA 1997

#### ✅ Checklist: Positive Limbs (At Least One Must Pass)

| # | Criterion | Check | Limb |
|---|-----------|-------|------|
| 1 | **Incurred in Gaining/Producing Income** | Nexus to assessable income | (a) |
| 1.1 | Income connection | Expense related to income-producing activity | HIGH |
| 1.2 | Causation | Expense incurred to earn income | HIGH |
| 1.3 | Not too remote | Direct or indirect connection (not remote) | MEDIUM |
| 2 | **Necessarily Incurred in Business** | Essential for business operations | (b) |
| 2.1 | Business carried on | Taxpayer carries on business | CRITICAL |
| 2.2 | Necessary | Expense essential for business | HIGH |
| 2.3 | Business purpose | For purpose of gaining income | HIGH |

**Scoring**: At least ONE of Limb (a) or Limb (b) must pass ALL checks

#### ✅ Checklist: Negative Limbs (NONE Can Apply)

| # | Criterion | Check | Impact |
|---|-----------|-------|--------|
| 1 | **Not Capital** | Revenue expense, not capital | REJECT if fails |
| 1.1 | Enduring benefit test | Benefit <12 months = revenue | HIGH |
| 1.2 | Asset acquisition | Acquiring asset = capital | HIGH |
| 1.3 | Improvement vs repair | Improvement = capital, repair = revenue | HIGH |
| 2 | **Not Private/Domestic** | Business purpose, not personal | REJECT if fails |
| 2.1 | Business use | Used in income-earning activity | CRITICAL |
| 2.2 | Personal element | No significant personal use | HIGH |
| 2.3 | Apportionment | Business % calculated if mixed use | HIGH |
| 3 | **Not Exempt Income** | Not related to tax-free income | REJECT if fails |
| 3.1 | Income source | Not earning exempt income | HIGH |
| 3.2 | NANE income | Not non-assessable non-exempt | MEDIUM |
| 4 | **Not Specifically Denied** | Not denied by other provision | REJECT if fails |
| 4.1 | Not s 26-5 | Not penalty or fine | CRITICAL |
| 4.2 | Not Div 32 | Not entertainment (unless FBT paid) | HIGH |
| 4.3 | Not s 40-880 | Not leisure facility or boat | MEDIUM |

**Automatic Rejection Triggers**:
```typescript
const AUTOMATIC_REJECT = [
  { expense: 'Penalty', section: '26-5', reason: 'Never deductible' },
  { expense: 'Fine', section: '26-5', reason: 'Never deductible' },
  { expense: 'Traffic fine', section: '26-5', reason: 'Never deductible' },
  { expense: 'Entertainment (no FBT)', section: 'Div 32', reason: 'Only 50% if FBT paid' },
  { expense: 'Leisure facility', section: '40-880', reason: 'Specifically denied' },
  { expense: 'Boat', section: '40-880', reason: 'Specifically denied unless business use' }
];
```

#### ✅ Checklist: Timing

| # | Criterion | Check |
|---|-----------|-------|
| 1 | **Incurred in Year** | Expense incurred in FY claimed | HIGH |
| 1.1 | Accruals basis | Companies use accruals | CRITICAL |
| 1.2 | Not prepaid | Prepaid >12 months not deductible | HIGH |
| 2 | **Invoice Date** | Invoice date in financial year | MEDIUM |

#### ✅ Checklist: Substantiation

| # | Criterion | Check | Legislation |
|---|-----------|-------|-------------|
| 1 | **Written Evidence** | Receipt/invoice if ≥$82.50 | s 900-115 TAA 1953 |
| 1.1 | Supplier name | Document shows supplier | HIGH |
| 1.2 | Amount | Total amount shown | CRITICAL |
| 1.3 | Date | Date of expense | HIGH |
| 1.4 | Description | Nature of goods/services | MEDIUM |
| 2 | **Special Rules** | Motor vehicle, travel, etc. | Various |
| 2.1 | Logbook (if car) | Logbook for 12 weeks if using logbook method | HIGH |
| 2.2 | Travel diary | Diary if travel ≥6 nights | HIGH |

**Warning Levels**:
```typescript
interface SubstantiationCheck {
  hasEvidence: boolean;
  evidenceType: 'invoice' | 'receipt' | 'logbook' | 'diary' | 'none';
  warningLevel: 'critical' | 'high' | 'medium' | 'info';
  message: string;
}

function checkSubstantiation(expense: Expense): SubstantiationCheck {
  if (expense.amount >= 82.50 && !expense.evidence) {
    return {
      hasEvidence: false,
      evidenceType: 'none',
      warningLevel: 'critical',
      message: 'Written evidence required for expenses ≥$82.50. Risk of ATO denial.'
    };
  }

  if (expense.type === 'motor-vehicle' && !expense.logbook) {
    return {
      hasEvidence: false,
      evidenceType: 'none',
      warningLevel: 'high',
      message: 'Logbook required for motor vehicle deductions. Consider cents/km method (<5000km).'
    };
  }

  return {
    hasEvidence: true,
    evidenceType: 'invoice',
    warningLevel: 'info',
    message: 'Substantiation adequate'
  };
}
```

#### ✅ Checklist: Amendment Period & Entity Classification (Post-Audit Updates)

| # | Criterion | Check | Weight |
|---|-----------|-------|--------|
| 1 | **Amendment Period** | Deduction within amendment window (s 170 TAA 1953) | CRITICAL |
| 1.1 | Entity type identified | Individual/small business (2yr) or company/trust (4yr) | CRITICAL |
| 1.2 | Period calculated | Assessment date + amendment period not exceeded | CRITICAL |
| 1.3 | Warning issued | System warns when FY is outside amendment period | HIGH |
| 2 | **Base Rate Entity Test** | Passive income ≤80% for 25% rate (s 23AA) | HIGH |
| 2.1 | Passive income checked | Rental, interest, dividends, royalties ≤80% of assessable income | HIGH |
| 2.2 | Both conditions met | Turnover <$50M AND passive income ≤80% | CRITICAL |
| 2.3 | Warning when unknown | System warns when passive income data unavailable | MEDIUM |

---

## Fringe Benefits Tax (FBT)

### FBT Liability Compliance

**Legislation**: Fringe Benefits Tax Assessment Act 1986

#### ✅ Checklist: Benefit Identification

| # | Criterion | Check |
|---|-----------|-------|
| 1 | **Benefit Provided** | Employer provides benefit to employee/associate | CRITICAL |
| 1.1 | Employer relationship | Benefit from employer | HIGH |
| 1.2 | Employment connection | Benefit connected to employment | HIGH |
| 2 | **Fringe Benefit** | Benefit is a fringe benefit (not salary) | HIGH |
| 2.1 | Not salary | Not ordinary income | HIGH |
| 2.2 | Not expense payment reimbursement | If reimbursement, must exceed deduction | MEDIUM |

#### ✅ Checklist: Car Fringe Benefits

| # | Criterion | Check | Legislation |
|---|-----------|-------|-------------|
| 1 | **Car Definition** | Motor vehicle designed to carry <9 passengers | s 136 |
| 1.1 | Not motorbike | Car, not motorbike | MEDIUM |
| 1.2 | Not commercial vehicle | Not goods-carrying vehicle >1 tonne | MEDIUM |
| 2 | **Private Use** | Available for private use | s 7 |
| 2.1 | Available | Car available for employee private use | HIGH |
| 2.2 | Garaged at home | Car can be garaged at home | MEDIUM |
| 3 | **Valuation Method** | Statutory formula or operating cost | s 9/s 10 |
| 3.1 | Method selected | Employer chooses method | HIGH |
| 3.2 | Calculations correct | Formula applied correctly | CRITICAL |
| 4 | **Exclusions Checked** | Not exempt under s 8 | s 8 |
| 4.1 | Not taxi | Not taxi | MEDIUM |
| 4.2 | Not emergency vehicle | Not police/ambulance/fire | MEDIUM |
| 4.3 | Not pooled | Not pooled car (business use only) | HIGH |

**Statutory Formula Validation**:
```typescript
function validateCarFBT(car: CarBenefit): ValidationResult {
  const checks = [];

  // Check km band
  const kmBands = [
    { min: 0, max: 14_999, rate: 0.20 },
    { min: 15_000, max: 24_999, rate: 0.20 },
    { min: 25_000, max: 40_000, rate: 0.15 },
    { min: 40_001, max: Infinity, rate: 0.10 }
  ];

  const band = kmBands.find(b => car.kmTravelled >= b.min && car.kmTravelled <= b.max);

  checks.push({
    criterion: 'Statutory % correct',
    passed: car.statutoryRate === band?.rate,
    expected: band?.rate,
    actual: car.statutoryRate
  });

  // Check gross-up type
  checks.push({
    criterion: 'Gross-up type',
    passed: car.grossUpType === (car.gstCreditable ? 2.0802 : 1.8868),
    expected: car.gstCreditable ? 'Type 1 (2.0802)' : 'Type 2 (1.8868)',
    actual: car.grossUpType
  });

  return {
    passed: checks.every(c => c.passed),
    checks
  };
}
```

#### ✅ Checklist: Loan Fringe Benefits

| # | Criterion | Check |
|---|-----------|-------|
| 1 | **Loan Provided** | Employer provides loan to employee | HIGH |
| 2 | **Below Benchmark** | Interest <benchmark rate (8.77%) | CRITICAL |
| 2.1 | Benchmark rate correct | Using correct FY rate | CRITICAL |
| 2.2 | Actual rate identified | Interest charged correctly identified | HIGH |
| 3 | **Not Excluded** | Not excluded under s 16(4) | MEDIUM |
| 3.1 | Not <$500 benefit | Taxable value ≥$500 | MEDIUM |

#### ✅ Checklist: Exemptions Applied

| # | Criterion | Check | Legislation |
|---|-----------|-------|-------------|
| 1 | **Minor Benefits** | Notional value <$300, infrequent | s 58P |
| 1.1 | Value <$300 | Benefit value <$300 | HIGH |
| 1.2 | Infrequent | Not regular or systematic | MEDIUM |
| 1.3 | Not cash | Not cash or near-cash | HIGH |
| 2 | **Work-Related Items** | Phone, laptop, software, etc. | s 58X |
| 2.1 | Portable device | Max 1 per FBT year | MEDIUM |
| 2.2 | Work use | Primarily for work | HIGH |
| 3 | **Otherwise Deductible** | Employee would've been able to deduct | s 52 |
| 3.1 | Hypothetical deduction | Employee could've claimed if paid | HIGH |
| 3.2 | Calculation correct | Reduction applied correctly | CRITICAL |

#### ✅ Checklist: FBT Rate & Classification (Post-Audit Updates)

| # | Criterion | Check | Weight |
|---|-----------|-------|--------|
| 1 | **Live Rates** | FBT rate, Type 1 and Type 2 gross-up rates from live data | CRITICAL |
| 1.1 | Rates assigned | Live rates actually assigned to calculation variables | CRITICAL |
| 1.2 | Fallback documented | If using fallback rates, source documented | HIGH |
| 2 | **Type 1/Type 2 Determination** | Per-item GST credit analysis | HIGH |
| 2.1 | Per-item check | Each benefit assessed individually for GST credit eligibility | HIGH |
| 2.2 | Not aggregate | Determination is per-benefit, not aggregated | MEDIUM |
| 2.3 | Xero tax codes | Uses Xero tax code data where available for GST determination | MEDIUM |

---

## Division 7A

### Private Company Loan Compliance

**Legislation**: Division 7A, Part III, ITAA 1936

#### ✅ Checklist: Deemed Dividend Trigger

| # | Criterion | Check | Legislation |
|---|-----------|-------|-------------|
| 1 | **Private Company** | Company is private (not listed) | s 103A |
| 1.1 | Not public | Not listed on stock exchange | CRITICAL |
| 2 | **Shareholder/Associate** | Loan to shareholder or associate | s 109D |
| 2.1 | Shareholder identified | Recipient is shareholder | HIGH |
| 2.2 | Associate identified | Or associate of shareholder | HIGH |
| 3 | **Loan Not Repaid** | Loan not repaid by lodgment day | s 109D(3) |
| 3.1 | Repayment date | Before lodgment day of return | CRITICAL |
| 3.2 | Amount outstanding | Outstanding balance ≥$1 | HIGH |

#### ✅ Checklist: Complying Loan Agreement

| # | Criterion | Check | Legislation |
|---|-----------|-------|-------------|
| 1 | **Written Agreement** | Loan agreement in writing | s 109N(2) |
| 1.1 | Before lodgment | Agreement signed before lodgment day | CRITICAL |
| 1.2 | Amount specified | Loan amount specified | HIGH |
| 1.3 | Term specified | Loan term ≤7 years (unsecured) or ≤25 years (secured) | CRITICAL |
| 2 | **Benchmark Interest** | Interest ≥benchmark rate | s 109N(3) |
| 2.1 | Rate correct | Rate ≥8.77% (FY2024-25) | CRITICAL |
| 2.2 | Interest charged | Interest charged each year | CRITICAL |
| 2.3 | Interest paid | Interest actually paid | CRITICAL |
| 3 | **Minimum Repayments** | Minimum repayment made each year | s 109N(4) |
| 3.1 | Calculation correct | Repayment % correct for year | CRITICAL |
| 3.2 | Payment made | Actual payment ≥minimum | CRITICAL |
| 3.3 | On time | Payment before end of FY | HIGH |

**Critical Validation**:
```typescript
function validateDiv7ALoan(loan: Div7ALoan): {
  compliant: boolean;
  deemedDividend: number;
  issues: string[];
} {
  const issues: string[] = [];
  const BENCHMARK_RATE = 0.0877; // 8.77% for FY2024-25

  // Check interest rate
  if (loan.interestRate < BENCHMARK_RATE) {
    issues.push(`Interest rate ${loan.interestRate}% below benchmark ${BENCHMARK_RATE * 100}%`);
  }

  // Check interest paid
  const requiredInterest = loan.balance * BENCHMARK_RATE;
  if (loan.interestPaid < requiredInterest) {
    const shortfall = requiredInterest - loan.interestPaid;
    issues.push(`Interest shortfall: $${shortfall.toFixed(2)}`);
  }

  // Check minimum repayment
  const REPAYMENT_RATES = [20.3, 23.7, 28.6, 35.6, 47.5, 72.8, 100.0];
  const yearIndex = loan.term - loan.yearsRemaining;
  const requiredRepayment = loan.balance * (REPAYMENT_RATES[yearIndex] / 100);

  if (loan.totalRepayment < requiredRepayment) {
    const shortfall = requiredRepayment - loan.totalRepayment;
    issues.push(`Repayment shortfall: $${shortfall.toFixed(2)}`);
  }

  // Calculate deemed dividend
  const deemedDividend = issues.length > 0
    ? loan.balance  // Entire balance is deemed dividend if non-compliant
    : 0;

  return {
    compliant: issues.length === 0,
    deemedDividend,
    issues
  };
}
```

#### ✅ Checklist: Exclusions

| # | Criterion | Check | Legislation |
|---|-----------|-------|-------------|
| 1 | **Arm's Length** | Transaction at arm's length | s 109K |
| 1.1 | Market terms | Terms equivalent to unrelated party | HIGH |
| 1.2 | Commercial | Genuine commercial transaction | HIGH |
| 2 | **Reasonable Remuneration** | Payment is salary/wages at market rate | s 109J |
| 2.1 | Employment services | For services provided | HIGH |
| 2.2 | Market rate | Remuneration not excessive | HIGH |

#### ✅ Checklist: Division 7A Extended Compliance (Post-Audit Updates)

| # | Criterion | Check | Legislation |
|---|-----------|-------|-------------|
| 1 | **Distributable Surplus Cap** | Deemed dividend ≤ distributable surplus | s 109Y |
| 1.1 | Surplus estimated | Net assets − share capital − loans to company | HIGH |
| 1.2 | Cap applied | Total deemed dividend risk capped by surplus | CRITICAL |
| 1.3 | Unknown surplus warning | Warning when surplus cannot be determined | MEDIUM |
| 2 | **Amalgamated Loans** | Multiple loans to same shareholder grouped | s 109E(8) |
| 2.1 | Shareholder grouping | Loans grouped by recipient shareholder/associate | HIGH |
| 2.2 | Amalgamation warning | Warning when multiple loans exist to same party | HIGH |
| 3 | **Safe Harbour Exclusions** | Commercial payments excluded from Div 7A | s 109RB |
| 3.1 | Keyword matching | Transactions matched against safe harbour terms | MEDIUM |
| 3.2 | Exclusion documented | Safe harbour exclusions noted in analysis | MEDIUM |
| 4 | **Written Agreement Status** | Tri-state tracking of agreement status | s 109N(2) |
| 4.1 | Status recorded | Agreement status: 'yes', 'no', or 'unknown' | HIGH |
| 4.2 | Unknown flagged | When agreement status unknown, flagged for review | HIGH |

---

## Source Documents

### Substantiation Requirements Compliance

**Legislation**: Division 28, Taxation Administration Act 1953

#### ✅ Checklist: Written Evidence

| # | Criterion | Check | Legislation |
|---|-----------|-------|-------------|
| 1 | **Threshold** | Written evidence if expense ≥$82.50 | s 900-115 |
| 1.1 | Amount check | Expense amount (ex GST) ≥$82.50 | CRITICAL |
| 2 | **Document Requirements** | Invoice/receipt with required info | s 900-125 |
| 2.1 | Supplier name | Document shows supplier name | HIGH |
| 2.2 | Amount | Total amount shown | CRITICAL |
| 2.3 | Date | Date of transaction | HIGH |
| 2.4 | Description | Nature of goods/services | MEDIUM |
| 2.5 | ABN (if ≥$82.50) | Supplier ABN shown | MEDIUM |

**Automated Validation**:
```typescript
interface Invoice {
  supplierName: string;
  amount: number;
  date: string;
  description: string;
  abn?: string;
}

function validateInvoice(invoice: Invoice, expenseAmount: number): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!invoice.supplierName) missing.push('Supplier name');
  if (!invoice.amount || invoice.amount === 0) missing.push('Amount');
  if (!invoice.date) missing.push('Date');
  if (!invoice.description) missing.push('Description');

  if (expenseAmount >= 82.50 && !invoice.abn) {
    warnings.push('ABN recommended for expenses ≥$82.50');
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
}
```

#### ✅ Checklist: Motor Vehicle

| # | Criterion | Check | Method |
|---|-----------|-------|--------|
| 1 | **Logbook Method** | Logbook maintained for 12 weeks | Logbook |
| 1.1 | Duration | Minimum 12 consecutive weeks | CRITICAL |
| 1.2 | All journeys | Business journeys recorded | HIGH |
| 1.3 | Details | Date, destination, km, purpose | HIGH |
| 1.4 | Updated | Logbook <5 years old | MEDIUM |
| 2 | **Cents/Km Method** | Max 5,000 km claimed | Cents/km |
| 2.1 | Limit | Total km ≤5,000 | CRITICAL |
| 2.2 | Calculation basis | Can show km calculation | MEDIUM |

#### ✅ Checklist: Travel

| # | Criterion | Check | Legislation |
|---|-----------|-------|-------------|
| 1 | **Travel Diary** | Diary if travel ≥6 nights | s 900-30 |
| 1.1 | Duration | Travel ≥6 nights away from home | HIGH |
| 1.2 | Activities | Business activities recorded | HIGH |
| 1.3 | Times | Start/end times documented | MEDIUM |
| 2 | **Receipts** | All expenses substantiated | s 900-115 |
| 2.1 | Accommodation | Receipts for accommodation | HIGH |
| 2.2 | Meals | Receipts for meals | HIGH |
| 2.3 | Transport | Receipts for transport | HIGH |
| 3 | **Overseas Travel** | Stricter requirements | s 900-30 |
| 3.1 | All expenses | Receipt for every expense (no $82.50 threshold) | CRITICAL |
| 3.2 | Diary | Diary required for ALL overseas travel | CRITICAL |

---

## Reconciliation

### Data Integrity Compliance

**Legislation**: Various

#### ✅ Checklist: Bank Reconciliation

| # | Criterion | Check |
|---|-----------|-------|
| 1 | **All Deposits Explained** | All bank deposits reconciled to income source | HIGH |
| 1.1 | Sales deposits | Match invoices/sales records | HIGH |
| 1.2 | Loan proceeds | Identified as loans (not income) | MEDIUM |
| 1.3 | Personal deposits | Excluded from business income | HIGH |
| 2 | **Variance Tolerance** | Unreconciled variance <5% | MEDIUM |
| 2.1 | Monthly reconciliation | Reconciled at least quarterly | MEDIUM |
| 3 | **Large Deposits Flagged** | Deposits >$10,000 reviewed | MEDIUM |

**Red Flags**:
```typescript
interface BankReconciliation {
  totalDeposits: number;
  reconciledDeposits: number;
  largeDeposits: Array<{ amount: number; explanation: string }>;
}

function checkBankReconciliation(recon: BankReconciliation): {
  compliant: boolean;
  issues: string[];
  redFlags: string[];
} {
  const issues: string[] = [];
  const redFlags: string[] = [];

  // Variance check
  const variance = (recon.totalDeposits - recon.reconciledDeposits) / recon.totalDeposits;
  if (variance > 0.05) {
    issues.push(`Unreconciled variance ${(variance * 100).toFixed(1)}% exceeds 5% threshold`);
  }

  // Large deposit check
  const unexplainedLarge = recon.largeDeposits.filter(d => !d.explanation);
  if (unexplainedLarge.length > 0) {
    redFlags.push(`${unexplainedLarge.length} large deposits (>$10K) without explanation`);
  }

  return {
    compliant: issues.length === 0 && redFlags.length === 0,
    issues,
    redFlags
  };
}
```

#### ✅ Checklist: GST Reconciliation

| # | Criterion | Check |
|---|-----------|-------|
| 1 | **GST on Sales** | All GST collected reported | HIGH |
| 1.1 | GST-inclusive sales | GST calculated correctly (÷11) | CRITICAL |
| 1.2 | GST-free sales | Correctly excluded | MEDIUM |
| 2 | **GST Credits** | Only deductible purchases claimed | HIGH |
| 2.1 | Business purchases | Purchase for business use | HIGH |
| 2.2 | Not private | Private expenses excluded | HIGH |
| 2.3 | Tax invoice | Supplier provides tax invoice if ≥$82.50 | MEDIUM |
| 3 | **BAS Lodgment** | BAS matches accounting system | CRITICAL |
| 3.1 | 1A matches | Sales GST matches system | CRITICAL |
| 3.2 | 1B matches | Purchase GST matches system | CRITICAL |

#### ✅ Checklist: Multi-Year Consistency

| # | Criterion | Check |
|---|-----------|-------|
| 1 | **Revenue Trends** | Year-over-year revenue changes <20% or explained | MEDIUM |
| 1.1 | Revenue variance | Calculate % change | MEDIUM |
| 1.2 | Explanation | Large changes explained (new client, lost client, etc.) | HIGH |
| 2 | **Gross Profit Margin** | GP% consistent (±5 percentage points) | MEDIUM |
| 2.1 | GP% calculated | (Revenue - COGS) / Revenue | MEDIUM |
| 2.2 | Variance | Year-over-year GP% variance | HIGH |
| 3 | **Expense Ratios** | Expenses as % of revenue consistent | LOW |

**Anomaly Detection**:
```typescript
function detectAnomalies(currentYear: FinancialData, priorYear: FinancialData): {
  anomalies: string[];
  riskLevel: 'low' | 'medium' | 'high';
} {
  const anomalies: string[] = [];

  // Revenue variance
  const revenueChange = (currentYear.revenue - priorYear.revenue) / priorYear.revenue;
  if (Math.abs(revenueChange) > 0.20) {
    anomalies.push(`Revenue ${revenueChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(revenueChange * 100).toFixed(1)}%`);
  }

  // Gross profit margin
  const currentGP = (currentYear.revenue - currentYear.cogs) / currentYear.revenue;
  const priorGP = (priorYear.revenue - priorYear.cogs) / priorYear.revenue;
  const gpVariance = Math.abs(currentGP - priorGP);

  if (gpVariance > 0.05) {
    anomalies.push(`Gross profit margin changed by ${(gpVariance * 100).toFixed(1)} percentage points`);
  }

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (anomalies.length >= 3) riskLevel = 'high';
  else if (anomalies.length >= 1) riskLevel = 'medium';

  return { anomalies, riskLevel };
}
```

#### ✅ Checklist: Forensic Patterns

| # | Criterion | Check |
|---|-----------|-------|
| 1 | **Round Numbers** | Excessive round-number transactions flagged | LOW |
| 1.1 | Frequency | >10% of transactions are round ($100, $500, $1000) | MEDIUM |
| 2 | **Duplicates** | Duplicate transactions identified | MEDIUM |
| 2.1 | Same amount/date/supplier | Potential data entry error | HIGH |
| 3 | **Invoice Gaps** | Sequential invoice numbers checked | LOW |
| 3.1 | Missing numbers | Gaps in invoice sequence | MEDIUM |
| 4 | **Benford's Law** | First digit distribution analyzed | LOW |
| 4.1 | Deviation | Significant deviation from Benford's distribution | MEDIUM |

---

## Trust Distributions

### Trust Distribution Compliance

**Legislation**: Section 100A, ITAA 1936; Section 99A, ITAA 1936

#### ✅ Checklist: Section 100A Analysis

| # | Criterion | Check | Weight |
|---|-----------|-------|--------|
| 1 | **Reimbursement Agreement** | Check for s 100A reimbursement agreement | CRITICAL |
| 1.1 | Agreement identified | Distribution linked to reimbursement arrangement | HIGH |
| 1.2 | Benefit identified | Low-tax beneficiary receives distribution | HIGH |
| 2 | **Family Dealing Exclusion** | s 100A(13) ordinary family dealing check | HIGH |
| 2.1 | Family relationship | Beneficiary is family member | MEDIUM |
| 2.2 | Ordinary purpose | Distribution for ordinary family purposes | MEDIUM |
| 2.3 | Severity adjustment | Flag severity downgraded when exclusion applies | HIGH |
| 3 | **Trustee Penalty Rate** | Correct penalty rate applied | CRITICAL |
| 3.1 | Rate = 47% | Top marginal (45%) + Medicare Levy (2%) | CRITICAL |
| 3.2 | Not 45% | Must NOT use 45% alone | HIGH |

---

## Tax Losses

### Loss Compliance

**Legislation**: Division 36, Division 165, ITAA 1997; Division 266/267, ITAA 1936

#### ✅ Checklist: Loss Classification & Utilisation

| # | Criterion | Check | Weight |
|---|-----------|-------|--------|
| 1 | **Capital vs Revenue** | Loss type correctly classified | CRITICAL |
| 1.1 | Capital loss identified | Capital losses only offset capital gains (s 102-5) | CRITICAL |
| 1.2 | Revenue loss identified | Revenue losses offset assessable income | HIGH |
| 1.3 | No cross-offset | Capital losses NOT applied to reduce ordinary income | CRITICAL |
| 2 | **SBT Evidence** | Similar Business Test evidence-based | HIGH |
| 2.1 | Transaction evidence | Expense categories compared across financial years | HIGH |
| 2.2 | 70% threshold | ≥70% consistency = SBT likely satisfied | MEDIUM |
| 2.3 | Below 40% alert | <40% consistency = SBT likely NOT satisfied | HIGH |
| 3 | **Trust Loss Rules** | Correct rules for trusts | CRITICAL |
| 3.1 | Not Division 165 | Trust losses use Division 266/267, NOT Division 165 | CRITICAL |
| 3.2 | FTE considered | Family Trust Election status checked (s 272-75) | HIGH |
| 3.3 | Distribution test | Pattern of distributions test applied (s 269-60) | MEDIUM |

---

## Capital Gains Tax

### CGT Compliance

**Legislation**: Parts 3-1 and 3-3, ITAA 1997

#### ✅ Checklist: CGT Analysis

| # | Criterion | Check | Weight |
|---|-----------|-------|--------|
| 1 | **Connected Entity Test** | Net assets include connected entities | CRITICAL |
| 1.1 | Entities aggregated | Connected entity assets summed per Subdiv 152-15 | CRITICAL |
| 1.2 | Affiliates included | Affiliate assets included in aggregation | HIGH |
| 1.3 | $6M threshold | Aggregated net assets tested against $6M | CRITICAL |
| 1.4 | Cliff edge warning | Warning when within 10% of threshold ($5.4M-$6M) | MEDIUM |
| 1.5 | No entities warning | Warning when no connected entities provided | MEDIUM |
| 2 | **Asset Quarantining** | Collectable/personal use losses handled correctly | CRITICAL |
| 2.1 | Collectable quarantine | Collectable losses only offset collectable gains (s 108-10) | CRITICAL |
| 2.2 | Personal use disregard | Personal use asset losses disregarded entirely (s 108-20) | CRITICAL |
| 2.3 | Category classification | Assets categorised by keyword matching | HIGH |
| 3 | **CGT Discount** | Entity-appropriate discount applied | HIGH |
| 3.1 | Company ineligible | Companies cannot access 50% discount (s 115-25) | CRITICAL |
| 3.2 | 12-month holding | Discount only for assets held ≥12 months | HIGH |

---

## Fuel Tax Credits

### Fuel Tax Compliance

**Legislation**: Fuel Tax Act 2006

#### ✅ Checklist: Fuel Tax Credit Calculation

| # | Criterion | Check | Weight |
|---|-----------|-------|--------|
| 1 | **Quarterly Rates** | Correct rate for quarter of transaction | CRITICAL |
| 1.1 | Rate period matched | Transaction date mapped to correct quarter's rate | CRITICAL |
| 1.2 | Rate source documented | ATO quarterly rate update referenced | HIGH |
| 2 | **Road User Charge** | Deducted for on-road heavy vehicles | HIGH |
| 2.1 | Vehicle classification | Heavy vehicle (>4.5t GVM) vs light vehicle | HIGH |
| 2.2 | Charge deducted | Road user charge subtracted from credit (s 43-10) | CRITICAL |
| 2.3 | Off-road exempt | Off-road use not subject to road user charge | HIGH |

---

## Superannuation

### Superannuation Compliance

**Legislation**: SGAA 1992; Section 291-20, ITAA 1997

#### ✅ Checklist: Superannuation Analysis

| # | Criterion | Check | Weight |
|---|-----------|-------|--------|
| 1 | **SG Rate FY-Aware** | Correct SG rate for financial year | CRITICAL |
| 1.1 | FY2024-25 rate | 11.5% | CRITICAL |
| 1.2 | FY2025-26 rate | 12.0% | CRITICAL |
| 1.3 | Dynamic lookup | Rate determined by `getCurrentFinancialYear()` | HIGH |
| 2 | **Carry-Forward Contributions** | Unused cap carried forward correctly | HIGH |
| 2.1 | 5-year limit | Only amounts from last 5 financial years | HIGH |
| 2.2 | Balance threshold | Total super balance <$500,000 at prior 30 June | CRITICAL |
| 2.3 | From FY2018-19 | Carry-forward only available from FY2018-19 onwards | MEDIUM |
| 2.4 | Cap amount | $30,000 concessional cap (FY2024-25) | HIGH |

---

## Appendix: Compliance Score Calculation

### Overall Compliance Score

```typescript
function calculateComplianceScore(checks: ComplianceChecks): {
  score: number;  // 0-100
  level: 'High' | 'Medium' | 'Low';
  breakdown: {
    critical: { passed: number; total: number };
    high: { passed: number; total: number };
    medium: { passed: number; total: number };
  };
} {
  const criticalPassed = checks.critical.filter(c => c.passed).length;
  const highPassed = checks.high.filter(c => c.passed).length;
  const mediumPassed = checks.medium.filter(c => c.passed).length;

  // Critical checks must ALL pass
  if (criticalPassed < checks.critical.length) {
    return {
      score: 0,
      level: 'Low',
      breakdown: {
        critical: { passed: criticalPassed, total: checks.critical.length },
        high: { passed: highPassed, total: checks.high.length },
        medium: { passed: mediumPassed, total: checks.medium.length }
      }
    };
  }

  // Calculate weighted score
  const highScore = (highPassed / checks.high.length) * 70;
  const mediumScore = (mediumPassed / checks.medium.length) * 30;
  const score = Math.round(highScore + mediumScore);

  let level: 'High' | 'Medium' | 'Low';
  if (score >= 90) level = 'High';
  else if (score >= 70) level = 'Medium';
  else level = 'Low';

  return {
    score,
    level,
    breakdown: {
      critical: { passed: criticalPassed, total: checks.critical.length },
      high: { passed: highPassed, total: checks.high.length },
      medium: { passed: mediumPassed, total: checks.medium.length }
    }
  };
}
```

---

**Checklist Status**: Complete
**Total Checklists**: 11 workflow areas
**Total Checks**: 220+
**Automation**: 100% (all checks automated)
**Next Review**: 2026-07-01 (FY2025-26 start)
**Document Owner**: Tax Agent (Domain Specialist)
