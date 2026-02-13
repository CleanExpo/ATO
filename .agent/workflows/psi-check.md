---
description: Determine if income is personal services income and evaluate PSB status
---

# /psi-check - Personal Services Income Determination Workflow

Determines whether income is personal services income (PSI) under Division 84 ITAA 1997 and evaluates whether the entity qualifies as a personal services business (PSB) under Division 87.

## Quick Commands

```bash
/psi-check                      # PSI assessment for current FY
/psi-check FY2023-24            # Specific financial year
/psi-check [org_id]             # Specific entity
```

## Workflow Steps

### Step 1: Identify Income Sources
- Extract income by client/customer from Xero
- Determine total income and income per client
- Flag if entity receives > 80% from one source

### Step 2: Apply PSI Determination (s 84-5)
- Is the income mainly a reward for personal efforts/skills?
- Would the income still be earned without the individual?
- Is equipment/tools a significant part of the arrangement?

### Step 3: Apply 80% Rule (s 87-15)
- Calculate percentage of PSI from largest client
- If > 80% from one client: high PSI risk (but still check PSB tests)

### Step 4: Evaluate Four PSB Tests (need only pass ONE)

**Test 1 — Results Test (s 87-18)**: ALL THREE required
- Paid to produce a result (not just time)
- Provides own tools/equipment
- Liable for defective work (rectify at own cost)

**Test 2 — Unrelated Clients Test (s 87-20)**:
- PSI from 2+ unrelated entities
- Services offered to the public

**Test 3 — Employment Test (s 87-25)**:
- Entity employs others to do 20%+ of principal work

**Test 4 — Business Premises Test (s 87-30)**:
- Separate premises from client's AND home
- Mainly conducts personal services activities there

### Step 5: Determine Impact
- If PSB: normal deduction rules apply
- If NOT PSB (PSI rules apply): restricted deductions under Division 86
- Calculate deduction impact (associate wages, rent, entity maintenance)

### Step 6: Generate Report
- PSI determination with confidence score
- PSB test results (pass/fail for each)
- Deduction restriction analysis
- Recommendation (apply for PSB determination if borderline)

## Agents Involved

- **psi_classifier** (primary) — runs the determination
- **xero_auditor** — provides income source data
- **deduction_optimizer** — deduction restriction impact analysis

## Engine

`lib/analysis/psi-engine.ts` → `analyzePSI()`

## API

`POST /api/analysis/psi`
