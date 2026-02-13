# Legislation Reference Guide - Accountant Workflow System

**Document Version**: 2.0
**Created**: 2026-01-30
**Updated**: 2026-02-11
**Linear Issue**: [UNI-279](https://linear.app/unite-hub/issue/UNI-279)
**Validated By**: Tax Agent (Domain Specialist)
**Financial Year**: FY2024-25 / FY2025-26
**Next Review**: 2026-07-01 (FY2025-26 start)

---

## Document Purpose

This guide provides definitive references to Australian tax legislation used by the Accountant Workflow System. All AI-generated recommendations must cite provisions from this guide.

**Scope**: Six workflow areas - Sundries, Deductions, FBT, Division 7A, Documents, Reconciliation

**Legislation Coverage**:
- Income Tax Assessment Act 1997 (ITAA 1997)
- Income Tax Assessment Act 1936 (ITAA 1936)
- Fringe Benefits Tax Assessment Act 1986 (FBTAA 1986)
- Taxation Administration Act 1953 (TAA 1953)

---

## Table of Contents

1. [Sundries (R&D Tax Incentive)](#sundries-rd-tax-incentive)
2. [Deductions (Section 8-1)](#deductions-section-8-1)
3. [Fringe Benefits Tax (FBT)](#fringe-benefits-tax-fbt)
4. [Division 7A (Private Company Loans)](#division-7a-private-company-loans)
5. [Source Documents](#source-documents)
6. [Reconciliation](#reconciliation)
7. [Trust Distributions (Section 100A)](#trust-distributions-section-100a)
8. [Tax Losses (Division 36 / Division 165 / Division 266)](#tax-losses)
9. [Capital Gains Tax (CGT)](#capital-gains-tax-cgt)
10. [Fuel Tax Credits](#fuel-tax-credits)
11. [Superannuation Guarantee](#superannuation-guarantee)

---

## Sundries (R&D Tax Incentive)

### Division 355 - Research and Development Tax Incentive

**Primary Legislation**: Division 355, Income Tax Assessment Act 1997

#### Subdivision 355-A - Overview

| Section | Title | Summary |
|---------|-------|---------|
| 355-5 | What this Division is about | Overview of R&D tax offset |
| 355-10 | Simplified outline | Flowchart of eligibility |

**ATO Reference**: https://www.ato.gov.au/law/view/document?docid=PAC/19970038/Div355

#### Subdivision 355-B - Entitlement to R&D Tax Offset

| Section | Title | Key Points | Effective Date |
|---------|-------|------------|----------------|
| **355-100** | Who is entitled to R&D tax offset | R&D entity with notional deductions | 1 July 2011 |
| **355-105** | Amount of R&D tax offset | 43.5% for aggregated turnover <$20M, 38.5% otherwise | 1 July 2021 |

**Calculation Formula** (from FY2021-22 onwards):
```
R&D Tax Offset = Notional R&D Deductions × Offset Rate

Where Offset Rate = Corporate Tax Rate + Premium:

| Turnover | Corporate Rate | Premium | Offset Rate | Refundable |
|----------|---------------|---------|-------------|------------|
| < $20M, 25% entity | 25% | 18.5% | 43.5% | Yes (capped at $4M) |
| < $20M, 30% entity | 30% | 18.5% | 48.5% | Yes (capped at $4M) |
| ≥ $20M, 25% entity | 25% | 8.5% | 33.5% | No |
| ≥ $20M, 30% entity | 30% | 8.5% | 38.5% | No |
```

Note: Premium was 13.5%/4.5% before FY2021-22.

**Example**:
```
Eligible R&D Expenditure: $200,000
Company Turnover: $5M (< $20M)
Offset Rate: 43.5%
R&D Tax Offset = $200,000 × 43.5% = $87,000
```

**ATO Reference**: https://www.ato.gov.au/Business/Research-and-development-tax-incentive/

#### Subdivision 355-C - R&D Activities

| Section | Title | Description | Citation |
|---------|-------|-------------|----------|
| **355-20** | Meaning of R&D activities | Core and supporting R&D activities | s 355-20(1) |
| **355-25** | Core R&D activities | Activities with 4-element test | s 355-25(1) |
| **355-30** | Supporting R&D activities | Activities directly related to core | s 355-30(1) |

**Four-Element Test for Core R&D Activities** (s 355-25):

1. **Outcome Unknown** (s 355-25(1)(a))
   - Outcome cannot be determined in advance
   - Based on current knowledge, information, and experience
   - Test: "Could the outcome be known in advance by a competent professional?"

2. **Systematic Progression** (s 355-25(1)(b))
   - Proceeds by systematic progression
   - Hypothesis → Experiment → Observation → Evaluation → Conclusion
   - Not trial and error or routine testing

3. **New Knowledge** (s 355-25(1)(c))
   - Generates new knowledge
   - Goes beyond applying existing knowledge
   - Even if new knowledge is that approach doesn't work

4. **Scientific Method** (s 355-25(1)(d))
   - Based on principles of established science, engineering, or IT
   - Uses scientific method
   - Conducted by or under supervision of persons with relevant expertise

**All four elements must be met for activity to qualify as core R&D.**

**ATO Ruling**: [TR 2023/1](https://www.ato.gov.au/law/view/document?DocID=TXR/TR20231/NAT/ATO/00001) - Meaning of R&D activities

#### Subdivision 355-D - R&D Expenditure

| Section | Title | Deductible Items |
|---------|-------|------------------|
| **355-205** | Deductible R&D expenditure | Expenditure incurred on R&D activities |
| **355-210** | Salary and wages | For R&D activities |
| **355-215** | Decline in value of depreciating asset | Used for R&D purposes |
| **355-225** | Feedstock expenditure | Input materials transformed/processed |

**Excluded Expenditure** (s 355-210(3)):
- Interest
- Core technology acquisition (>$50M)
- Buildings and expenditure on buildings
- Amounts not incurred when R&D conducted

#### Registration Requirements

**Section 27A, Industry Research and Development Act 1986**

**Registration Deadline**:
- 10 months after end of financial year
- For FY2024-25 (ending 30 June 2025), deadline is **30 April 2026**

**Registration Process**:
1. Register R&D activities with AusIndustry
2. Lodge R&D tax incentive schedule with ATO
3. Include in company tax return

**ATO Reference**: https://www.ato.gov.au/Business/Research-and-development-tax-incentive/Registering-for-the-R-D-tax-incentive/

#### Refundable Offset Cap (s 355-100(3))

**Effective**: From FY2021-22

The refundable R&D tax offset is capped at **$4,000,000** per annum (s 355-100(3) ITAA 1997). Any excess above the $4M cap becomes a non-refundable tax offset that can be carried forward.

**Example**:
```
R&D Expenditure: $12,000,000
Offset Rate: 43.5% (turnover < $20M, 25% entity)
Total Offset: $12,000,000 × 43.5% = $5,220,000
Refundable Portion: $4,000,000 (capped)
Non-Refundable Carry-Forward: $1,220,000
```

#### R&D Clawback Provisions (s 355-450)

**Section 355-450**: If R&D results are subsequently commercialised, a clawback of the offset may apply. The clawback amount is included in assessable income in the year of commercialisation.

**Key Points**:
- Applies when R&D entity receives consideration for R&D results
- Amount included = original offset amount attributable to commercialised results
- Must be tracked per-project for accurate clawback assessment

#### Common Exclusions

| Exclusion | Legislation | Reasoning |
|-----------|-------------|-----------|
| Market research | Not s 355-25 | Lacks scientific method |
| Routine testing | Not s 355-25 | Outcome known, not systematic |
| Quality assurance | Not s 355-25 | Applying existing knowledge |
| Cosmetic changes | Not s 355-25 | No new knowledge generated |
| Management activities | s 355-30(2) | Not directly related to core R&D |

---

## Deductions (Section 8-1)

### Section 8-1 - General Deductions

**Primary Legislation**: Section 8-1, Income Tax Assessment Act 1997

#### Section 8-1 - Full Text

**s 8-1(1)**: General rule
> "You can deduct from your assessable income any loss or outgoing to the extent that:
> (a) it is incurred in gaining or producing your assessable income; or
> (b) it is necessarily incurred in carrying on a *business for the purpose of gaining or producing your assessable income."

**s 8-1(2)**: Exceptions
> "However, you cannot deduct a loss or outgoing under this section to the extent that:
> (a) it is a loss or outgoing of capital, or of a capital nature; or
> (b) it is a loss or outgoing of a private or domestic nature; or
> (c) it is incurred in relation to gaining or producing your *exempt income or your *non-assessable non-exempt income; or
> (d) a provision of this Act prevents you from deducting it."

**ATO Reference**: https://www.ato.gov.au/law/view/document?docid=PAC/19970038/8-1

#### Three-Part Test for Deductibility

To be deductible under s 8-1, an expense must satisfy ALL three tests:

**Test 1: Positive Limbs** (at least one must apply)
- **Limb (a)**: Incurred in gaining or producing assessable income
  - Nexus between outgoing and income
  - Example: Advertising to generate sales
- **Limb (b)**: Necessarily incurred in carrying on a business
  - Essential for business operations
  - Example: Business insurance, licensing fees

**Test 2: Negative Limbs** (NONE can apply)
- **Limb (a)**: Not capital or of a capital nature
  - Revenue vs capital distinction
  - Capital: enduring benefit >1 year
  - Revenue: consumed in income-earning process
- **Limb (b)**: Not private or domestic
  - Business purpose, not personal
  - Mixed-use requires apportionment
- **Limb (c)**: Not related to exempt/non-assessable income
  - No deduction for expenses to earn tax-free income
- **Limb (d)**: Not specifically denied by another provision
  - E.g., penalties, fines (s 26-5), entertainment (Div 32)

**Test 3: Timing**
- Incurred in the year claimed (not prepaid >12 months)
- Accruals basis for companies

**ATO Ruling**: [TR 97/7](https://www.ato.gov.au/law/view/document?DocID=TXR/TR977/NAT/ATO/00001) - Income tax: Section 8-1

#### Common Deductible Expenses

| Expense Category | Legislation | Conditions |
|------------------|-------------|------------|
| **Employee wages** | s 8-1(1)(a) | For income-producing work |
| **Rent (business premises)** | s 8-1(1)(b) | Necessarily incurred in business |
| **Utilities** | s 8-1(1)(b) | Business portion only |
| **Advertising** | s 8-1(1)(a) | To generate sales |
| **Professional fees** | s 8-1(1)(a) | Accountant, lawyer (revenue matters) |
| **Insurance** | s 8-1(1)(b) | Business insurance |
| **Interest (business loans)** | s 8-1(1)(a) | On borrowings for income |
| **Repairs & maintenance** | s 8-1(1)(a) | Restores to original state |
| **Bank fees** | s 8-1(1)(a) | Business account |
| **Motor vehicle** | s 8-1(1)(a) | Business use % (logbook or cents/km) |

#### Common Non-Deductible Expenses

| Expense | Reason | Alternative |
|---------|--------|-------------|
| Penalties & fines | s 26-5 | Never deductible |
| Entertainment | Div 32 | 50% deductible only if FBT paid |
| Capital improvements | s 8-1(2)(a) | Depreciation over time |
| Private expenses | s 8-1(2)(b) | Not deductible |
| Legal fees (capital) | s 8-1(2)(a) | Add to cost base of asset |
| Clothing (not uniform) | Private/domestic | Only uniforms/protective |
| Traffic fines | s 26-5 | Never deductible |

#### Specific Deduction Provisions (Override s 8-1)

| Section | Deduction Type | Key Points |
|---------|----------------|------------|
| **25-10** | Bad debts | Must be previously included in assessable income |
| **25-35** | Bad debts (businesses) | Writing off as bad debt |
| **26-5** | Penalties and fines | NOT deductible |
| **30-15** | Gifts and donations | To DGR only |
| **32-5** | Entertainment | 50% deductible if FBT paid |
| **40-25** | Depreciating assets | Decline in value over effective life |
| **328-180** | Instant asset write-off | Immediate deduction if <$20K (small business) |

#### Amendment Period (s 170 TAA 1953)

Deduction claims must be within the amendment period. The period varies by entity type:

| Entity Type | Amendment Period | Legislation |
|-------------|-----------------|-------------|
| Individuals (simple affairs) | 2 years from assessment | s 170(1) TAA 1953 |
| Small business entities | 2 years from assessment | s 170(1) TAA 1953 |
| Companies / Partnerships / Trusts | 4 years from assessment | s 170(1) TAA 1953 |
| Fraud or evasion | Unlimited | s 170(1) TAA 1953 |
| Transfer pricing | 7 years | s 170(1) TAA 1953 |

**System Implementation**: The deduction engine checks `checkAmendmentPeriod()` and warns when a recommended deduction falls outside the entity's amendment window.

---

## Fringe Benefits Tax (FBT)

### Fringe Benefits Tax Assessment Act 1986

**Primary Legislation**: Fringe Benefits Tax Assessment Act 1986 (FBTAA 1986)

**FBT Year**: 1 April to 31 March (not aligned with financial year)
- FBT Year 2024-25: 1 April 2024 to 31 March 2025

**FBT Rate** (FY2024-25): **47%** (s 5B)

**Gross-Up Formula**:
```
Grossed-Up Value = Taxable Value × Gross-Up Rate

Type 1 Gross-Up (GST-creditable): 2.0802
Type 2 Gross-Up (Non-GST-creditable): 1.8868
```

**ATO Reference**: https://www.ato.gov.au/Rates/FBT/

#### Common Fringe Benefits

##### 1. Car Fringe Benefits (Division 2)

**Statutory Formula Method** (s 9):
```
Taxable Value = (Base Value × Statutory %) - Employee Contribution

Where:
- Base Value = Cost price (or lease costs × 5)
- Statutory % = Based on km travelled (20%, 15%, 10%, 7%)
```

**Operating Cost Method** (s 10):
```
Taxable Value = (Operating Costs × Business Use %) - Employee Contribution

Where:
- Operating Costs = Running costs + depreciation
- Business Use % = From logbook (min 12 weeks)
```

**Example**:
```
Car cost: $50,000
Km travelled: 18,000 km
Statutory %: 20% (15,000-24,999 km band)
Employee contribution: $2,000

Taxable Value = ($50,000 × 20%) - $2,000 = $8,000
FBT Liability = $8,000 × 2.0802 × 47% = $7,818
```

##### 2. Expense Payment Benefits (Division 5)

**Section 20**: Expense payment fringe benefit
- Employer pays employee's expense
- Taxable value = amount paid

**Example**: Employer pays employee's gym membership ($1,200)
```
Taxable Value = $1,200
FBT Liability = $1,200 × 2.0802 × 47% = $1,173
```

##### 3. Loan Fringe Benefits (Division 7)

**Section 16**: Loan fringe benefit
- Employer provides loan at below-market interest rate

**Calculation**:
```
Taxable Value = Loan Amount × (Benchmark Rate - Actual Rate) × Days/365

Where:
- Benchmark Rate = 8.77% (FY2024-25, same as Div 7A)
- Actual Rate = Interest charged to employee
```

**Example**:
```
Loan: $100,000
Actual rate: 3%
Benchmark rate: 8.77%
Days: 365

Taxable Value = $100,000 × (8.77% - 3%) × 365/365 = $5,770
FBT Liability = $5,770 × 1.8868 × 47% = $5,119
```

##### 4. Entertainment Benefits (Division 9A)

**Section 32**: Meal entertainment

**50/50 Split Method** (s 37AA):
- Deem 50% exempt, 50% taxable
- Simplifies record-keeping

**Actual Method**:
- Track each entertainment event
- Apportion based on business vs private

**Minor Benefits Exemption** (s 58P):
- Notional taxable value <$300
- Infrequent and irregular
- Not cash or gift certificate

##### 5. Housing Benefits (Division 14)

**Section 26**: Benefit is provision of housing
- Employer provides accommodation

**Taxable Value** (s 26):
- Market rental value - employee contribution

**Exemption** (s 58ZC):
- Remote area housing (subject to conditions)

#### FBT Reductions

| Reduction Type | Legislation | Effect |
|----------------|-------------|--------|
| **Otherwise deductible** | s 52 | Reduces taxable value by employee's hypothetical deduction |
| **Employee contribution** | s 59 | Reduces taxable value dollar-for-dollar |
| **Minor benefits** | s 58P | Exempt if <$300, infrequent |
| **Car parking** | s 58GA | Exempt if <$10.37/day (FY2024-25) |

#### FBT Exemptions

| Benefit Type | Legislation | Conditions |
|--------------|-------------|------------|
| Work-related items | s 58X | Phones, laptops, software |
| Portable electronic devices | s 58X | One per FBT year |
| Protective clothing | s 58X | Occupation-specific |
| Briefcases | s 58X | Used for work |
| Tools of trade | s 58X | Necessary for work |
| Relocation | s 58Y | Job relocation costs |
| Remote area housing | s 58ZC | Eligible remote area |

---

## Division 7A (Private Company Loans)

### Division 7A - Distributions to Shareholders

**Primary Legislation**: Division 7A, Part III, Income Tax Assessment Act 1936

**Purpose**: Prevent tax-free extraction of company profits via loans/forgiven debts

#### Section 109C - Payments Treated as Dividends

**When a payment is a dividend**:
- Private company pays amount to shareholder/associate
- Amount not dividend under s 6
- Amount not excluded by s 109F-109M

**Deemed Dividend** = Payment amount (unless loan meets criteria)

#### Section 109D - Loans Treated as Dividends

**When a loan is a dividend**:
- Private company loans money to shareholder/associate
- Loan not repaid by earlier of:
  - Lodgment day of company tax return (if lodged before due date)
  - Due date of company tax return
- Loan not meets minimum interest requirement (s 109N)

**Deemed Dividend** = Outstanding loan amount

**Exception**: If complying loan agreement in place

#### Section 109N - Minimum Interest Rate (Benchmark)

**FY2024-25 Benchmark Interest Rate**: **8.77%** per annum

**Published**: TD 2024/3 (ATO Determination)

**ATO Reference**: https://www.ato.gov.au/law/view/document?DocID=TXD/TD20243/NAT/ATO/00001

**Calculation**:
```
Minimum Interest = Loan Balance × 8.77% × Days/365

Must be charged and paid each year
```

**Example**:
```
Loan: $100,000 (1 July 2024)
Interest rate: 8.77%
Interest due FY2024-25: $100,000 × 8.77% = $8,770

If actual interest paid < $8,770, deemed dividend arises
```

#### Section 109E - Forgiven Debts Treated as Dividends

**When debt forgiveness is a dividend**:
- Private company forgives debt owed by shareholder/associate
- Forgiveness not excluded

**Deemed Dividend** = Forgiven amount

#### Complying Loan Agreement

To avoid deemed dividend, loan must meet ALL criteria (s 109N):

**1. Written Loan Agreement**
- Before lodgment day
- Specifies loan amount
- Specifies interest rate (≥ benchmark)
- Specifies term (≤ 7 years unsecured, ≤ 25 years secured)

**2. Interest Payments**
- Charged at ≥ benchmark rate (8.77% for FY2024-25)
- Paid each year

**3. Minimum Repayments**
- Must repay minimum amount each year
- Calculated as: Loan Balance / Years Remaining

**Minimum Repayment Formula**:
```
Minimum Repayment = Loan Balance × Repayment Rate

Repayment Rates (FY2024-25, 8.77% benchmark):
- 7-year unsecured: 20.3%
- 25-year secured: 6.8%
```

**Example** (7-year loan):
```
Year 1: $100,000 × 20.3% = $20,300
Year 2: $79,700 × 23.7% = $18,889
Year 3: $60,811 × 28.6% = $17,392
... continue each year
```

**ATO Reference**: [PS LA 2010/4](https://www.ato.gov.au/law/view/document?DocID=PSR/PS20104/NAT/ATO/00001) - Division 7A

#### Exclusions (s 109J-109M)

| Exclusion | Legislation | Description |
|-----------|-------------|-------------|
| Reasonable remuneration | s 109J | Salary/wages at market rate |
| Arm's length transactions | s 109K | Genuine business dealings |
| Liquidator/administrator payments | s 109L | Insolvency proceedings |
| Amalgamated loan | s 109NA | Refinanced into complying loan |

#### Distributable Surplus Cap (s 109Y)

**Section 109Y, ITAA 1936**: A deemed dividend under Division 7A cannot exceed the company's **distributable surplus**.

**Distributable Surplus** = Net assets − paid-up share capital − non-commercial loans to company

If the total deemed dividend risk exceeds the distributable surplus, the deemed dividend is capped:

```
Capped Deemed Dividend = min(Total Deemed Dividend Risk, Distributable Surplus)
```

**System Implementation**: `estimateDistributableSurplus()` queries equity account data. Optional `knownDistributableSurplus` parameter allows callers with balance sheet data to override.

#### Amalgamated Loans (s 109E(8))

**Section 109E(8), ITAA 1936**: Multiple loans from a private company to the same shareholder/associate may be amalgamated for minimum repayment purposes.

**Key Points**:
- Multiple non-complying loans can be refinanced into a single complying loan agreement
- Minimum repayment is calculated on the amalgamated balance
- Written agreement must cover the total amalgamated amount

**System Implementation**: `checkAmalgamationProvisions()` groups loans by shareholder name and warns when multiple loans exist to the same shareholder.

#### Safe Harbour Exclusions (s 109RB)

**Section 109RB, ITAA 1936**: Certain payments are excluded from Division 7A treatment where they are made under genuine commercial terms.

**Common Safe Harbour Exclusions**:
- Arm's length salary and wages
- Genuine commercial rent payments
- Market-rate professional fees
- Standard trade creditor payments

**System Implementation**: `identifySafeHarbourExclusions()` matches transactions against safe harbour keywords (salary, wages, rent, professional fees, etc.).

#### Common Division 7A Scenarios

| Scenario | Div 7A Treatment | Mitigation |
|----------|------------------|------------|
| **Director takes cash from company** | Deemed dividend | Declare dividend or repay |
| **Company pays director's personal expense** | Deemed dividend | Repay or treat as salary (PAYG) |
| **Loan to director at 0% interest** | Deemed dividend | Charge 8.77% interest |
| **Loan repayment missed** | Deemed dividend | Make repayment before lodgment day |
| **Asset transferred below market value** | Deemed dividend (undervalue) | Transfer at market value |

---

## Source Documents

### Substantiation Requirements

**Primary Legislation**: Division 28, Taxation Administration Act 1953

#### Division 28 - Substantiation Rules

**Section 900-12**: Commissioner may require substantiation
- Must obtain and keep records
- Penalty if fail to substantiate: denial of deduction

#### Written Evidence Requirements

**Section 900-115**: Written evidence threshold
- Written evidence required for expenses ≥$82.50 (excluding GST)
- Exception: Small expenses (<$10 each, total <$200)

**Section 900-125**: What constitutes written evidence
- Invoice, receipt, or similar document
- Shows:
  - Supplier name
  - Amount of expense
  - Nature of goods/services
  - Date incurred

**Example** (Valid Receipt):
```
ABC Suppliers Pty Ltd
123 Business St, Sydney NSW 2000
ABN: 12 345 678 901

Invoice #12345
Date: 15 January 2025

Office supplies (printer paper, pens)    $95.00
GST                                        $9.50
Total                                    $104.50

Payment: Credit Card
```

#### Motor Vehicle Substantiation

**Logbook Method** (s 900-115):
- Maintain logbook for minimum 12 consecutive weeks
- Record all business journeys
- Update every 5 years (if usage pattern unchanged)

**Cents Per Kilometre** (s 900-115):
- Claim up to 5,000 km @ $0.85/km (FY2024-25)
- No written evidence required
- Must be able to show basis for calculation

**ATO Rate** (FY2024-25): **$0.85 per kilometre**

**ATO Reference**: https://www.ato.gov.au/Rates/Cents-per-kilometre/

#### Travel Expenses (Domestic)

**Section 900-30**: Travel diary required if:
- Travel ≥ 6 nights away from home
- Record activities, times, places

**Exemptions**:
- Truck drivers (routine travel)
- Public transport <$300 per trip

#### Travel Expenses (Overseas)

**Section 900-30**: Stricter substantiation
- Travel diary required for ALL overseas travel
- Receipt for ALL expenses (no $82.50 threshold)

**Travel Diary Must Record**:
- Date, time, place
- Business activities undertaken
- Duration of activities
- Income-producing purpose

#### Meal Entertainment

**Section 32-10**: Entertainment expenses
- Written evidence required
- Must show business purpose
- 50% deductible (if FBT paid)

#### Gifts & Donations

**Section 30-228**: DGR substantiation
- Receipt from Deductible Gift Recipient (DGR)
- Must show:
  - DGR name and ABN
  - Amount
  - Date
  - "Receipt for gift" statement

**Minimum Receipt Requirements**:
- Gifts <$2: No receipt needed
- Gifts $2-$10: Bucket collection receipt OK
- Gifts >$10: Specific receipt required

---

## Reconciliation

### Data Integrity & Cross-Year Consistency

**Primary Legislation**: Various provisions requiring accurate records

#### Record Keeping Requirements

**Section 262A, ITAA 1936**: Record keeping obligations
- Keep records for 5 years
- Records must explain all transactions
- Must enable accurate tax return preparation

**Section 288-25, TAA 1953**: English language requirement
- Records in English or readily accessible/convertible

#### Reconciliation Requirements

##### 1. Bank Reconciliation

**Purpose**: Verify all business income captured

**Frequency**: Monthly minimum, quarterly acceptable

**Key Checks**:
- All deposits reconciled to sales/income
- Large or irregular deposits explained
- Personal deposits excluded
- Loan proceeds identified

**ATO Benchmark**: < 5% unreconciled variance

##### 2. GST Reconciliation

**Purpose**: Ensure GST reported correctly

**Section 31-5, GST Act**: GST on supplies
**Section 11-5, GST Act**: GST credits on acquisitions

**Reconciliation**:
```
BAS Lodged GST = (Sales × 1/11) - (Purchases × 1/11)

Must reconcile to accounting system GST
```

**Common Errors**:
- Private expenses claimed for GST credit
- GST-free sales incorrectly coded
- Non-deductible purchases claimed

##### 3. PAYG Withholding Reconciliation

**Purpose**: Verify employee taxes withheld and remitted

**Section 16-70, Sch 1, TAA 1953**: Withholding obligations

**Reconciliation**:
```
Annual PAYG Summary = Sum of Monthly PAYG Withheld

Must reconcile to employee payment summaries
```

##### 4. Multi-Year Consistency Checks

**ATO Data Matching**:
- Year-over-year income trends
- Gross profit margins
- Employee-to-revenue ratios
- Asset purchases vs depreciation

**Red Flags**:
- Revenue declines >20% without explanation
- Gross profit % changes >5 percentage points
- Expenses spike without corresponding revenue increase

##### 5. Forensic Anomaly Detection

**Round Number Analysis**:
- Excessive round-number transactions may indicate estimates
- Example: $1,000, $5,000, $10,000 expenses

**Duplicate Transaction Detection**:
- Same amount, same date, same supplier
- May indicate data entry error

**Sequential Invoice Gaps**:
- Missing invoice numbers
- May indicate unrecorded sales (suppression)

**Benford's Law Analysis**:
- First digit distribution of amounts
- Natural transactions follow Benford's distribution
- Deviation may indicate fabrication

**Timing Anomalies**:
- Large expenses on 30 June (date manipulation)
- Income deferred to next financial year

---

## Trust Distributions (Section 100A)

### Section 100A - Reimbursement Agreements

**Primary Legislation**: Section 100A, Income Tax Assessment Act 1936

**Purpose**: Prevents tax avoidance through trust distributions to low-tax beneficiaries where a reimbursement agreement exists.

#### Ordinary Family Dealing Exclusion (s 100A(13))

**Section 100A(13)**: Distributions are excluded from s 100A if they constitute an "ordinary family or commercial dealing".

**TR 2022/4**: ATO ruling clarifying that distributions between family members for ordinary family purposes (e.g., school fees, living expenses) are generally excluded.

**System Implementation**: `generateSection100AFlags()` downgrades severity when the family dealing exclusion applies:
- Non-resident beneficiary: high → medium severity
- Minor beneficiary: high → low severity
- Risk reduction: 20-40 points when exclusion applies

#### Trustee Penalty Tax Rate (s 99A)

**Section 99A, ITAA 1936**: Where trust income is not distributed, the trustee is assessed at the top marginal rate.

| Component | Rate |
|-----------|------|
| Top marginal rate | 45% |
| Medicare Levy | 2% |
| **Total trustee penalty rate** | **47%** |

**Note**: The penalty rate is 47%, not 45%. This includes the Medicare Levy per s 99A ITAA 1936.

---

## Tax Losses

### Division 36 - Tax Losses (Revenue)

**Primary Legislation**: Subdivision 36-A, ITAA 1997

#### Capital vs Revenue Loss Distinction (s 102-5)

**Section 102-5, ITAA 1997**: Capital losses can ONLY offset capital gains. They cannot reduce ordinary taxable income.

| Loss Type | Can Offset | Cannot Offset | Legislation |
|-----------|-----------|---------------|-------------|
| Revenue loss | Assessable income | N/A | Div 36 ITAA 1997 |
| Capital loss | Capital gains only | Ordinary income | s 102-5 ITAA 1997 |

### Division 165 - Company Loss Rules (COT/SBT)

**Primary Legislation**: Division 165, ITAA 1997

Applies to companies. Losses can only be carried forward if:
- **Continuity of Ownership Test (COT)**: Same persons hold >50% voting, dividend, and capital rights
- **Same Business Test (SBT)**: Company carries on the same business (no new business, no new transactions of a different kind)

### Division 266/267 - Trust Loss Rules

**Primary Legislation**: Division 266/267, Schedule 2F, ITAA 1936

**Important**: Trust losses are governed by Division 266/267, NOT Division 165 (which applies only to companies).

| Provision | Purpose | Legislation |
|-----------|---------|-------------|
| Division 266 | Trust losses - income test | Schedule 2F ITAA 1936 |
| Division 267 | Trust losses - asset test | Schedule 2F ITAA 1936 |
| s 272-75 | Family Trust Election (FTE) | Schedule 2F ITAA 1936 |
| s 269-60 | Pattern of distributions test | Schedule 2F ITAA 1936 |
| Division 270 | Income injection test | Schedule 2F ITAA 1936 |

**Family Trust Election**: A trust can make an FTE to be treated as a family trust. This simplifies loss recoupment but subjects the trust to family trust distribution tax if distributions are made outside the family group.

**System Implementation**: `analyzeCotSbt()` is entity-type-aware. Trust entities are routed to `analyzeTrustLossRecoupment()` which applies Division 266/267 instead of Division 165.

---

## Capital Gains Tax (CGT)

### CGT Overview

**Primary Legislation**: Parts 3-1 and 3-3, ITAA 1997

#### Connected Entity Net Asset Test (Subdivision 152-15)

**Subdivision 152-15, ITAA 1997**: For the Division 152 small business CGT concessions, the $6M net asset value threshold includes assets of:
- The taxpayer
- Connected entities (s 152-30)
- Affiliates (s 152-25)

**Example**:
```
Taxpayer net assets: $4,000,000
Connected trust assets: $3,000,000
Aggregated net assets: $7,000,000 → FAILS $6M test
```

**System Implementation**: `CGTAnalysisOptions.connectedEntities` accepts an array of connected entity assets. `analyzeDivision152()` aggregates all assets for the $6M test. Cliff edge warning triggers within 10% of threshold ($5.4M).

#### Collectable and Personal Use Asset Quarantining

**Section 108-10, ITAA 1997**: Losses on collectables (art, jewellery, wine, coins) can ONLY offset gains on other collectables.

**Section 108-20, ITAA 1997**: Losses on personal use assets are DISREGARDED entirely.

| Asset Category | Loss Treatment | Legislation |
|---------------|---------------|-------------|
| Ordinary CGT asset | Offsets any capital gain | General CGT rules |
| Collectable | Only offsets collectable gains | s 108-10(1) |
| Personal use asset | Loss disregarded | s 108-20(1) |

**System Implementation**: `classifyAssetCategory()` categorises CGT events. Collectable losses are quarantined; personal use losses are excluded from the capital loss pool.

#### CGT Discount (s 115-25)

| Entity Type | Discount | Legislation |
|-------------|---------|-------------|
| Individual | 50% | s 115-25(1) |
| Superannuation fund | 33.33% | s 115-25(1) |
| Company | 0% (not available) | s 115-25(1) |
| Trust | 50% (flows to beneficiaries) | s 115-25(1) |

**Note**: Companies cannot access the CGT discount. Non-residents are ineligible for the discount on gains arising after 8 May 2012 on non-taxable Australian property.

---

## Fuel Tax Credits

### Fuel Tax Act 2006

**Primary Legislation**: Fuel Tax Act 2006

#### Quarterly Rate Structure

Fuel tax credit rates are updated **quarterly** by the ATO (typically February, April, August, November). Rates differ based on:
- Fuel type (diesel, petrol, LPG)
- Use type (on-road heavy vehicle, off-road, other business use)
- Quarter of claim

| Use Type | Rate Structure | Legislation |
|----------|---------------|-------------|
| Off-road business use | Full excise credit | s 41-5 Fuel Tax Act 2006 |
| On-road heavy vehicle (>4.5t GVM) | Excise minus road user charge | s 43-10 Fuel Tax Act 2006 |
| Light vehicle on-road | Not eligible | N/A |

#### Road User Charge (s 43-10)

**Section 43-10, Fuel Tax Act 2006**: For heavy vehicles (>4.5 tonnes GVM) used on public roads, the fuel tax credit is reduced by the road user charge.

```
Net Credit = Base Credit Rate − Road User Charge
```

**System Implementation**: `FUEL_TAX_CREDIT_RATES` map provides per-quarter rates. On-road heavy vehicle credits are automatically reduced by the applicable road user charge.

---

## Superannuation Guarantee

### Superannuation Guarantee (Administration) Act 1992

**Primary Legislation**: Superannuation Guarantee (Administration) Act 1992 (SGAA 1992)

#### SG Rate Schedule

| Financial Year | SG Rate | Legislation |
|---------------|---------|-------------|
| FY2024-25 | 11.5% | s 19 SGAA 1992 |
| FY2025-26 | 12.0% | s 19 SGAA 1992 |
| FY2026-27 onwards | 12.0% | s 19 SGAA 1992 |

**System Implementation**: SG rate is FY-aware. `cashflow-forecast-engine.ts` uses 12% from FY2025-26 onwards via `getCurrentFinancialYear()` comparison.

#### Carry-Forward Concessional Contributions

**Effective**: From FY2018-19

Unused concessional cap amounts can be carried forward for up to **5 years** if:
- Total superannuation balance is less than **$500,000** at 30 June of the prior year
- The unused amount originated from FY2018-19 or later

| FY | Concessional Cap |
|----|-----------------|
| FY2024-25 | $30,000 |
| FY2025-26 | $30,000 |

**Example**:
```
FY2021-22 unused cap: $5,000
FY2022-23 unused cap: $8,000
FY2023-24 unused cap: $2,000
Total carry-forward available in FY2024-25: $15,000
FY2024-25 total cap: $30,000 + $15,000 = $45,000
(Provided total super balance < $500,000)
```

---

## Appendix A: Key Tax Rates & Thresholds (FY2024-25)

### Income Tax Rates

| Entity Type | Rate | Legislation |
|-------------|------|-------------|
| Small Business Company (turnover <$50M) | 25% | s 23AA ITAA 1936 |
| Base Rate Entity (turnover <$50M AND ≤80% passive income) | 25% | s 23AA ITAA 1936 |
| Other Companies | 30% | s 23 ITAA 1936 |

### R&D Tax Incentive Rates

| Criteria | Corp Rate | Premium | Offset Rate | Refundable | Legislation |
|----------|-----------|---------|-------------|------------|-------------|
| Turnover <$20M, 25% entity | 25% | +18.5% | 43.5% | Yes (≤$4M) | s 355-105 ITAA 1997 |
| Turnover <$20M, 30% entity | 30% | +18.5% | 48.5% | Yes (≤$4M) | s 355-105 ITAA 1997 |
| Turnover ≥$20M, 25% entity | 25% | +8.5% | 33.5% | No | s 355-105 ITAA 1997 |
| Turnover ≥$20M, 30% entity | 30% | +8.5% | 38.5% | No | s 355-105 ITAA 1997 |

### Division 7A Benchmark Rate

| FY | Rate | Legislation |
|----|------|-------------|
| FY2024-25 | 8.77% | TD 2024/3 |
| FY2023-24 | 8.27% | TD 2023/3 |
| FY2022-23 | 4.77% | TD 2022/3 |

### FBT Rate

| FY | Type 1 Gross-Up | Type 2 Gross-Up | FBT Rate |
|----|-----------------|-----------------|----------|
| FY2024-25 | 2.0802 | 1.8868 | 47% |

### Instant Asset Write-Off

| Entity | Threshold | Legislation |
|--------|-----------|-------------|
| Small Business (turnover <$10M) | $20,000 | s 328-180 ITAA 1997 |

### Motor Vehicle Cents Per Km

| FY | Rate | Legislation |
|----|------|-------------|
| FY2024-25 | $0.85/km | TR 2023/2 |
| FY2023-24 | $0.78/km | TR 2022/2 |

### Substantiation Threshold

| Expense Type | Threshold | Legislation |
|--------------|-----------|-------------|
| General expenses (written evidence) | $82.50 | s 900-115 TAA 1953 |
| Small expenses (aggregate) | $200 | s 900-115 TAA 1953 |

### Superannuation Guarantee Rate

| FY | Rate | Legislation |
|----|------|-------------|
| FY2024-25 | 11.5% | s 19 SGAA 1992 |
| FY2025-26 | 12.0% | s 19 SGAA 1992 |

### Fuel Tax Credit Rates

Rates are updated quarterly. See ATO website for current rates.

| Use Type | Rate Structure | Legislation |
|----------|---------------|-------------|
| Off-road | Full excise (varies quarterly) | s 41-5 Fuel Tax Act 2006 |
| On-road heavy vehicle | Excise minus road user charge | s 43-10 Fuel Tax Act 2006 |

---

## Appendix B: Legislation Version Control

All legislation references in this guide are current as of **11 February 2026**.

| Act | Version | Compilation | Source |
|-----|---------|-------------|--------|
| ITAA 1997 | Current | No. 122, 2024 | [Federal Register](https://www.legislation.gov.au/Details/C2024C00350) |
| ITAA 1936 | Current | No. 121, 2024 | [Federal Register](https://www.legislation.gov.au/Details/C2024C00349) |
| FBTAA 1986 | Current | No. 55, 2024 | [Federal Register](https://www.legislation.gov.au/Details/C2024C00275) |
| TAA 1953 | Current | No. 123, 2024 | [Federal Register](https://www.legislation.gov.au/Details/C2024C00351) |

**Verification Process**:
1. Check Federal Register of Legislation quarterly
2. Monitor ATO website for rate updates
3. Subscribe to ATO email alerts
4. Tax agent validates all changes

**Next Review**: 1 July 2026 (FY2025-26 start)

---

## Appendix C: ATO Resources

### Key ATO Pages

| Topic | URL |
|-------|-----|
| R&D Tax Incentive | https://www.ato.gov.au/Business/Research-and-development-tax-incentive/ |
| Section 8-1 Deductions | https://www.ato.gov.au/Business/Income-and-deductions-for-business/ |
| FBT | https://www.ato.gov.au/Businesses-and-organisations/Hiring-and-paying-your-workers/FBT/ |
| Division 7A | https://www.ato.gov.au/Business/Private-company-benefits---Division-7A/ |
| Substantiation | https://www.ato.gov.au/Business/Income-and-deductions-for-business/Substantiation/ |

### Tax Rulings & Determinations

| Reference | Topic |
|-----------|-------|
| TR 2023/1 | R&D activities |
| TR 97/7 | Section 8-1 deductions |
| TD 2024/3 | Division 7A benchmark rate FY2024-25 |
| PS LA 2010/4 | Division 7A compliance |

---

**Legislation Guide Status**: Complete
**Total Provisions Documented**: 80+
**Workflow Areas Covered**: 11/11
**Next Review**: 2026-07-01 (FY2025-26 start)
**Validated By**: Tax Agent (Domain Specialist)
**Document Owner**: Compliance Officer
