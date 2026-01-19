---
description: Manage business closure, pivot to new business, loss carry-forward, and ATO debt negotiation
---

# /business-transition - Business Transition Workflow

Comprehensive workflow for managing the transition from a closed/failing business to a new business venture, including loss utilization, tax optimization, and ATO negotiation.

## Your Situation Summary

| Old Business | New Business |
|-------------|--------------|
| Service-based cleaning | Digital Marketing Agency |
| Ceased June 30, 2025 | CARSI - Online courses, advertising, network |
| Accumulated losses | Need to utilize losses |
| Potential ATO debt | Need to negotiate/offset |

## Workflow Steps

### Step 1: Quantify Accumulated Losses
Pull from Xero all historical losses:

```
FY2021-22: $_______ loss
FY2022-23: $_______ loss
FY2023-24: $_______ loss
FY2024-25: $_______ loss (to June 30)
─────────────────────────
TOTAL:     $_______ accumulated losses
```

**Tax Value**: Accumulated losses × applicable tax rate = **$_______ potential tax saving**

### Step 2: Assess Loss Carry-Forward Eligibility

#### For Sole Trader (ABN 62 580 077 456 - Carsi)
Non-commercial loss rules (Division 35) apply:
- [ ] $20,000 assessable income test
- [ ] Profitable in 3 of 5 prior years
- [ ] $500,000 assets test
- [ ] Real property test (land value $500K+)

#### For Companies (ABN 85 151 794 142, ABN 42 633 062 307)
Business Continuity Test:

| Test | Your Status |
|------|-------------|
| Continuity of Ownership (50%+ same owners) | PASS / FAIL |
| Same Business Test (pre-July 2015 losses) | N/A for recent losses |
| **Similar Business Test** (post-July 2015) | ⚠️ UNCERTAIN |

### Step 3: Similar Business Test (SiBT) Assessment

**Critical Question**: Is Digital Marketing/CARSI a "similar business" to cleaning services?

| Factor | Analysis |
|--------|----------|
| Same assets used | ❌ Different (cleaning vs. digital) |
| Same income sources | ❌ Different (service fees vs. courses/ads) |
| Evolution over time | ⚠️ Possibly - if documented properly |
| IP commercialization | ✅ CARSI courses based on business expertise |

#### Build Your SiBT Case:

**Document these connections**:
1. "The cleaning business developed operational expertise, business processes, and management skills"
2. "CARSI online courses commercialize this business knowledge"
3. "Marketing network utilizes contacts from cleaning industry"
4. "The pivot represents adaptation to economic circumstances"

⚠️ **Recommendation**: If losses exceed $50,000, consider requesting an **ATO Private Ruling** on SiBT eligibility before utilizing losses.

### Step 4: Business Cessation Deductions

#### Immediately Deductible
- [ ] Outstanding employee entitlements paid
- [ ] Final accounting/legal fees
- [ ] Outstanding supplier invoices

#### Bad Debts (Section 25-35)
- [ ] Write off uncollectable receivables before June 30
- [ ] Claim GST recovery on bad debts
- [ ] Run `/bad-debt-scan` workflow

#### Blackhole Expenditure (Section 40-880)
- [ ] Company deregistration costs → 20% over 5 years
- [ ] Lease termination → 20% over 5 years

### Step 5: New Business Startup Deductions

#### Immediately Deductible (Small Business)
| Expense | Status |
|---------|--------|
| Legal advice on structure | ✅ Deductible |
| Accounting setup fees | ✅ Deductible |
| Company/ABN registration | ✅ Deductible |
| Initial marketing strategy | ✅ Deductible |

#### Deductible Over 5 Years
| Expense | Rate |
|---------|------|
| Market research | 20%/year |
| Business plan development | 20%/year |
| Website development (if capital) | 20%/year |

### Step 6: Personal Capital Contributions

Record all personal money injected:

| Date | Amount | Recorded As | Notes |
|------|--------|-------------|-------|
| _____ | $_____ | Loan / Capital | Document intent |
| _____ | $_____ | Loan / Capital | Keep records |

**If Loan**: Can be repaid tax-free when business profitable
**If Capital**: Creates cost base for CGT; can be returned tax-free

### Step 7: Calculate Net ATO Position

```
RECOVERABLE:
+ R&D Tax Offset (43.5%)         $________
+ Bad Debt Deductions            $________
+ Carried Forward Losses         $________ (if SiBT passes)
+ SBITO (up to $1,000)          $________
+ Other deductions/offsets       $________
─────────────────────────────────
TOTAL RECOVERABLE                $________ (A)

OWING TO ATO:
- Outstanding income tax         $________
- Outstanding GST                $________
- Outstanding PAYG withholding   $________
- Penalties and interest         $________
─────────────────────────────────
TOTAL OWING                      $________ (B)

NET POSITION                     $________ (A - B)
```

### Step 8: ATO Engagement Strategy

#### Scenario A: Net Refund (A > B)
- Lodge all returns claiming offsets
- Request refund of difference
- Ensure proper documentation

#### Scenario B: Reduced Debt (A partly offsets B)
- Apply all offsets
- Negotiate payment plan for remainder
- Request penalty/interest remission for hardship

#### Scenario C: Significant Debt Remains
**Options**:

1. **Payment Plan** (up to 5 years)
   - Online for debts < $200K
   - Contact ATO for larger amounts
   - GIC continues to accrue

2. **Interest/Penalty Remission**
   - Document financial hardship
   - Demonstrate good faith
   - Request remission of GIC and penalties

3. **Small Business Restructuring** (if < $1M total debt)
   - Directors remain in control
   - Propose restructure plan
   - ATO generally supports viable plans

### Step 9: Documentation Checklist

#### For Loss Carry-Forward (SiBT)
- [ ] Timeline showing business evolution
- [ ] Evidence of skills/knowledge carried forward
- [ ] CARSI course content based on business expertise
- [ ] Business plan showing connection

#### For ATO Negotiation
- [ ] All tax returns lodged
- [ ] Financial statements (P&L, Balance Sheet)
- [ ] Bank statements showing cash position
- [ ] Personal financial situation if hardship

#### For Deductions
- [ ] Invoices for cessation costs
- [ ] Bad debt write-off documentation
- [ ] Startup cost invoices
- [ ] Personal capital contribution records

## Expected Output

```
╔════════════════════════════════════════════════════════════════╗
║              🔄 BUSINESS TRANSITION ANALYSIS                   ║
╠════════════════════════════════════════════════════════════════╣
║ OLD BUSINESS: Cleaning Services (ceased June 30, 2025)        ║
║ NEW BUSINESS: Digital Marketing Agency (CARSI)                ║
╠════════════════════════════════════════════════════════════════╣
║ ACCUMULATED LOSSES                                             ║
║ ────────────────────────────────────────────────────────────   ║
║ FY2022-23:     $45,000                                        ║
║ FY2023-24:     $62,000                                        ║
║ FY2024-25:     $38,000                                        ║
║ TOTAL:         $145,000                                        ║
║ Tax Value:     $36,250 (at 25%)                               ║
╠════════════════════════════════════════════════════════════════╣
║ SIMILAR BUSINESS TEST                                          ║
║ ────────────────────────────────────────────────────────────   ║
║ Status: REQUIRES DOCUMENTATION                                 ║
║ Risk Level: MEDIUM-HIGH                                        ║
║ Recommendation: Seek Private Ruling                            ║
╠════════════════════════════════════════════════════════════════╣
║ TAX RECOVERY SUMMARY                                           ║
║ ────────────────────────────────────────────────────────────   ║
║ Loss carry-forward (if SiBT passes):  $36,250                 ║
║ Bad debt deductions:                   $8,250                  ║
║ GST recovery:                          $3,000                  ║
║ Startup deductions:                    $5,000                  ║
║ TOTAL POTENTIAL RECOVERY:             $52,500                  ║
╠════════════════════════════════════════════════════════════════╣
║ NET ATO POSITION                                               ║
║ ────────────────────────────────────────────────────────────   ║
║ Outstanding ATO debt:                  $65,000                 ║
║ Less: Recoverable amounts:            ($52,500)                ║
║ REMAINING DEBT:                        $12,500                 ║
║ Recommended: Payment plan + penalty remission                  ║
╚════════════════════════════════════════════════════════════════╝
```

## Legislation References

- **Division 35 ITAA 1997** - Non-commercial losses (sole traders)
- **Division 165/166 ITAA 1997** - Company loss carry-forward tests
- **LCR 2019/1** - Similar Business Test guidance
- **Section 40-880 ITAA 1997** - Blackhole/startup expenditure
- **Section 25-35 ITAA 1997** - Bad debt deductions
- **TAA 1953** - Payment arrangements
