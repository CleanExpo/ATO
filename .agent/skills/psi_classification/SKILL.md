---
name: psi-classification
description: Personal services income determination under Division 84-87 ITAA 1997 — PSI rules, PSB tests, and deduction restrictions
---

# PSI Classification Skill

Determines whether income received by a personal services entity (PSE) is personal services income (PSI) under Division 84 ITAA 1997, and whether the entity qualifies as a personal services business (PSB) under Division 87.

## When to Use

- Assessing whether contractor/consultant income is PSI
- Evaluating PSB status to determine deduction availability
- Checking if 80% rule applies (s 87-15)
- Running the four PSB tests for borderline cases
- Determining deduction restrictions under Division 86

## PSI Determination (s 84-5)

Income is PSI if it is mainly a reward for the **personal efforts or skills** of an individual. Key indicators:
- Would the income still be earned if the individual was not involved?
- Is the income from a contract that is mainly for the individual's labour?
- Is equipment or tools a significant part of the arrangement?

## PSB Tests (Division 87)

If income IS PSI, the entity may still be a PSB if it passes ANY ONE of these tests:

### 1. Results Test (s 87-18) — ALL THREE required
- Paid to produce a result (not just for time)
- Required to provide own tools/equipment
- Liable for defective work (rectify at own cost)

### 2. Unrelated Clients Test (s 87-20)
- PSI from 2+ unrelated entities
- Services offered to the public

### 3. Employment Test (s 87-25)
- Entity employs or engages others to do 20%+ of the principal work

### 4. Business Premises Test (s 87-30)
- Maintains business premises that are separate from client's premises AND home
- Premises at which the entity mainly conducts personal services activities

## Impact of PSI Rules (if not PSB)

| Deduction | PSB | Non-PSB (PSI rules apply) |
|-----------|-----|---------------------------|
| Salary/wages to associates | Allowed | Not deductible |
| Rent on premises | Allowed | Not deductible |
| Home office expenses | Allowed | Limited to individual-only costs |
| Entity maintenance costs | Allowed | Not deductible |
| Super contributions | Allowed | Attributed to individual |

## Engine Reference

- **Engine**: `lib/analysis/psi-engine.ts`
- **Function**: `analyzePSI(tenantId, financialYear, options)`
- **Output**: PSI determination, PSB test results, deduction restrictions, confidence score
- **Database**: `psi_analysis_results` table

## Legislation

- ITAA 1997, Division 84 — What is PSI
- ITAA 1997, Division 85 — PSI entities
- ITAA 1997, Division 86 — Deduction restrictions
- ITAA 1997, Division 87 — PSB tests
