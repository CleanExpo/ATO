# Legislation Reference Guide - Accountant Workflow System

**Document Version**: 1.0
**Created**: 2026-01-30
**Linear Issue**: [UNI-279](https://linear.app/unite-hub/issue/UNI-279)
**Validated By**: Tax Agent (Domain Specialist)
**Financial Year**: FY2024-25
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

**Calculation Formula** (for FY2024-25):
```
R&D Tax Offset = Notional R&D Deductions × Offset Rate

Where:
- Offset Rate = 43.5% (if aggregated turnover < $20M)
- Offset Rate = 38.5% (if aggregated turnover ≥ $20M)
```

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

## Appendix A: Key Tax Rates & Thresholds (FY2024-25)

### Income Tax Rates

| Entity Type | Rate | Legislation |
|-------------|------|-------------|
| Small Business Company (turnover <$50M) | 25% | s 23AA ITAA 1936 |
| Base Rate Entity | 25% | s 23AA ITAA 1936 |
| Other Companies | 30% | s 23 ITAA 1936 |

### R&D Tax Incentive Rates

| Criteria | Offset Rate | Refundable | Legislation |
|----------|-------------|------------|-------------|
| Aggregated turnover <$20M | 43.5% | Yes (if tax loss) | s 355-105 ITAA 1997 |
| Aggregated turnover ≥$20M | 38.5% | No | s 355-105 ITAA 1997 |

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

---

## Appendix B: Legislation Version Control

All legislation references in this guide are current as of **30 January 2026**.

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
**Total Provisions Documented**: 45+
**Workflow Areas Covered**: 6/6
**Next Review**: 2026-07-01 (FY2025-26 start)
**Validated By**: Tax Agent (Domain Specialist)
**Document Owner**: Compliance Officer
