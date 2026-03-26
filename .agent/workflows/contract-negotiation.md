---
name: contract-negotiation
type: workflow
phases: [3.5]
version: 1.1.0
created: 26/03/2026
modified: 26/03/2026
status: active
---

# Workflow: Contract Negotiation

Covers **Phase 3.5 (Contract)** of the convergence loop — inserted between Decomposition (Phase 3) and Execution (Phase 4).

## Trigger

Senior-engineer has produced an implementation plan with task decomposition (Phase 3 complete).

## Phase 3.5: Contract Negotiation

### Step 1: Proposal — senior-engineer

1. Receive approved implementation plan from Phase 3
2. For each major deliverable, propose:
   - Concrete acceptance criteria (observable, testable)
   - Verification method (command, visual check, API test)
   - Scope boundaries (what is explicitly out of scope)
3. Submit draft sprint contract to qa-validator via orchestrator

### Step 2: Review — qa-validator

1. Receive draft sprint contract
2. Evaluate each criterion for testability:
   - Is it binary (PASS/FAIL)? If subjective, reject and counter-propose
   - Is the verification method concrete? If "should work", reject
   - Are edge cases covered? Propose additional criteria if gaps found
3. Either ACCEPT or COUNTER-PROPOSE (max 2 rounds)

### Step 3: Agreement — orchestrator

1. If both parties agree → write contract to `.claude/data/active-contract.json`
2. If 2 rounds exhausted without agreement → escalate to user
3. Contract becomes binding for Phase 6 scoring

## Negotiation Rules

- **senior-engineer** may NOT propose vague criteria ("works correctly", "looks good")
- **qa-validator** may NOT accept criteria without verification commands
- Each criterion must include a PASS example and a FAIL example
- Max 2 negotiation rounds. If no agreement → ESCALATE

## Output

A signed sprint contract (`.claude/data/active-contract.json`) ready for Phase 4 execution.

## Handoff

```
senior-engineer → qa-validator → [negotiate max 2 rounds] → orchestrator (writes contract)
```

## Contract Lifecycle

1. **Created**: Phase 3.5 (this workflow)
2. **Active**: Phases 4-7 (referenced during execution and verification)
3. **Scored**: Phase 6 (qa-validator scores against contract criteria)
4. **Archived**: Phase 8 (delivery-manager includes contract results in PR body)
5. **Deleted**: After Phase 8 completes or on escalation

## Phase Triggers

### Entry Trigger
- Auto-triggered by prd-to-spec.md when implementation plan is complete
- `/harness` command flow (Phase 3.5 activation)

### Exit Trigger
- Contract agreed → write to `.claude/data/active-contract.json` → **auto-trigger Phase 4** (spec-to-build.md)
- 2 negotiation rounds exhausted without agreement → **ESCALATE** to user

### Handoff Artifact
Signed sprint contract (JSON), passed alongside task assignments to `spec-to-build.md` workflow.
