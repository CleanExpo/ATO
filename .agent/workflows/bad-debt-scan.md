---
description: Identify bad debts for tax deduction (Section 25-35) and GST recovery (Division 21) when customers go bankrupt or fail to pay
---

# /bad-debt-scan - Bad Debt Recovery Workflow

Scan for unpaid invoices from bankrupt or insolvent customers to claim tax deductions and recover GST previously paid to the ATO.

## Tax Benefits Summary

| Benefit | Legislation | Value |
|---------|-------------|-------|
| **Income Tax Deduction** | Section 25-35 ITAA 1997 | Full debt amount × tax rate |
| **GST Recovery** | Division 21 GST Act 1999 | 1/11th of total debt amount |

**Example**: $11,000 unpaid invoice = $2,750 tax saving (at 25%) + $1,000 GST refund = **$3,750 total recovery**

## Workflow Steps

### Step 1: Pull Overdue Receivables from Xero
Identify all invoices that are:
- [ ] Overdue by 90+ days (potential bad debts)
- [ ] Overdue by 365+ days (automatic GST recovery eligible)
- [ ] Marked with insolvency indicators

### Step 2: Classify Debt Status

| Status | Criteria | Action |
|--------|----------|--------|
| **BAD** | Customer bankrupt/liquidated, untraceable, no assets | Write off for full tax benefit |
| **12+ MONTHS** | Overdue 12+ months, status unknown | Claim GST recovery immediately |
| **DOUBTFUL** | Payment unlikely but not confirmed | Monitor, document collection efforts |
| **DISPUTED** | Customer disputes amount | Resolve dispute before write-off |

### Step 3: Verify Eligibility

#### For Income Tax Deduction
- [ ] Debt was included in assessable income (accruals basis)
- [ ] Debt has not been forgiven or waived
- [ ] Debt is genuinely bad (evidence of insolvency or exhausted recovery)
- [ ] Write-off decision made before 30 June

#### For GST Recovery
- [ ] Business reports GST on non-cash (accruals) basis
- [ ] GST was remitted to ATO on original invoice
- [ ] Either: debt written off as bad, OR overdue 12+ months

### Step 4: Document Write-Off Decision

**Required Documentation**:
1. Written record identifying:
   - Debtor name and details
   - Invoice number(s) and amount(s)
   - Reason for write-off
   - Date of decision
2. Evidence of collection attempts (demand letters, calls)
3. Insolvency notices (if applicable)
4. ASIC company status check (for companies)

### Step 5: Process in Xero

1. Create credit note OR direct write-off entry
2. Allocate to "Bad Debt Expense" account
3. GST will automatically reverse if correctly processed
4. Add note with supporting evidence reference

### Step 6: Update Tax Returns

- **Income Tax**: Include bad debt deduction in business expenses
- **BAS**: Include GST decreasing adjustment in next BAS
- **If Recovery Later**: Record as assessable income + GST increasing adjustment

## Timing Critical ⚠️

| Deadline | Requirement |
|----------|-------------|
| **Before 30 June** | Write-off decision must be made and documented |
| **Next BAS Period** | Claim GST decreasing adjustment |
| **Tax Return** | Include deduction in annual return |

## Common Scenarios

### Scenario 1: Customer Company in Liquidation
```
Invoice: $22,000 (incl. $2,000 GST)
Status: Liquidator advises 0 cents in dollar expected

Tax Deduction: $22,000 × 25% = $5,500 saving
GST Recovery: $2,000 refund on BAS
TOTAL BENEFIT: $7,500
```

### Scenario 2: Invoice 12+ Months Overdue (Status Unknown)
```
Invoice: $5,500 (incl. $500 GST)
Status: Customer unresponsive, 14 months overdue

GST Recovery: $500 (immediately claimable)
Tax Deduction: Consider write-off or continue attempts
```

### Scenario 3: Partial Recovery from Insolvency
```
Original Invoice: $33,000 (incl. $3,000 GST)
Dividend from Liquidator: $6,600 (20 cents in dollar)
Unrecovered Amount: $26,400

Tax Deduction: $26,400 × 25% = $6,600 saving
GST Recovery: $2,400 (GST on unrecovered portion)
TOTAL BENEFIT: $9,000
```

## Expected Output

```
╔════════════════════════════════════════════════════════════════╗
║                  💸 BAD DEBT RECOVERY REPORT                   ║
║                       FY2024-25                                ║
╠════════════════════════════════════════════════════════════════╣
║ IDENTIFIED BAD DEBTS                                           ║
║ ────────────────────────────────────────────────────────────   ║
║ 1. Bankrupt Customer Pty Ltd                                   ║
║    • Amount: $33,000 (incl. $3,000 GST)                       ║
║    • Status: LIQUIDATION (ASIC notice 2025-09-15)             ║
║    • Tax Deduction: $33,000 → $8,250 saving                   ║
║    • GST Recovery: $3,000 refund                               ║
║                                                                ║
║ 2. Untraceable Debtor Co                                       ║
║    • Amount: $11,000 (incl. $1,000 GST)                       ║
║    • Status: MAIL RETURNED, 18 months overdue                  ║
║    • Tax Deduction: $11,000 → $2,750 saving                   ║
║    • GST Recovery: $1,000 refund                               ║
╠════════════════════════════════════════════════════════════════╣
║ GST-ONLY RECOVERY (12+ months overdue)                         ║
║ ────────────────────────────────────────────────────────────   ║
║ 3. Slow Payer Corp                                             ║
║    • Amount: $5,500 (incl. $500 GST), 14 months overdue       ║
║    • GST Recovery: $500 (claimable now)                        ║
╠════════════════════════════════════════════════════════════════╣
║ SUMMARY                                                        ║
║ ────────────────────────────────────────────────────────────   ║
║ Total Bad Debt Deduction:    $44,000                          ║
║ Tax Saving (at 25%):         $11,000                          ║
║ GST Recovery:                $4,500                            ║
║ TOTAL CASH BENEFIT:          $15,500                          ║
╠════════════════════════════════════════════════════════════════╣
║ ACTIONS REQUIRED                                               ║
║ ────────────────────────────────────────────────────────────   ║
║ ⚠️  Document write-off decisions before June 30                ║
║ ⚠️  Process credit notes in Xero                               ║
║ ⚠️  Include GST adjustment in June BAS                         ║
║ ⚠️  Retain ASIC/insolvency notices for audit                   ║
╚════════════════════════════════════════════════════════════════╝
```

## Legislation References

- **Section 25-35 ITAA 1997** - Bad debts deduction
- **Division 21 GST Act 1999** - Bad debt GST adjustments
- **GSTR 2000/2** - GST and bad debts ruling
- **TD 94/39** - Determining when debts are bad
