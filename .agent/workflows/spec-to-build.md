---
name: spec-to-build
type: workflow
phases: [4, 5]
version: 1.1.0
---

# Workflow: Spec → Build

Covers **Phase 4 (Execution)** and **Phase 5 (Aggregation)** of the convergence loop.

## Trigger

An implementation plan with task assignments has been produced in Phase 3.

## Phase 4: Execution

**Owner**: orchestrator (coordination), specialist agents (implementation)

### Orchestration Pattern Selection

The orchestrator selects the appropriate pattern based on task structure:

| Task Structure | Pattern | Description |
|---------------|---------|-------------|
| Multiple independent tasks | Plan → Parallelize → Integrate | Spawn specialist agents concurrently |
| Sequential dependencies | Sequential with Feedback | Execute in order, verify between steps |
| Single-domain task | Specialized Worker Delegation | Delegate to one specialist |

### Execution Protocol

1. Orchestrator dispatches tasks to specialist agents per the implementation plan
2. Each specialist:
   a. Reads the task assignment and acceptance criteria
   b. Follows TDD: write failing test → implement → verify pass
   c. Reports completion with evidence (test output, type-check output)
3. Orchestrator monitors progress and handles blocked agents

### Parallel Execution Rules

- Independent tasks (e.g., frontend component + backend endpoint) run concurrently
- Dependent tasks wait for upstream completion
- If a specialist is blocked, orchestrator attempts unblocking before escalation
- Maximum 2 retry attempts per specialist before escalation

### TDD Enforcement

All coding tasks MUST follow:
1. Write failing test first
2. Run test — confirm it fails
3. Write minimal implementation
4. Run test — confirm it passes
5. Refactor if needed

## Phase 5: Aggregation

**Owner**: orchestrator

1. Collect all specialist outputs
2. Verify interface contracts match between frontend and backend
3. Resolve any integration conflicts (e.g., API shape mismatches)
4. Run full verification suite:
   ```bash
   pnpm turbo run type-check lint test
   ```
5. If all pass → proceed to Phase 6 (Verification)
6. If failures → route back to responsible specialist with error context

### Conflict Resolution

| Conflict Type | Resolution |
|--------------|-----------|
| API shape mismatch | Backend contract wins — frontend adapts |
| Type mismatch | Resolve at interface boundary |
| Test failure in integration | Route to specialist who owns the failing module |
| Build failure | Route to specialist who introduced the breaking change |

## Output

Integrated, build-passing codebase ready for Phase 6 (Verification).

## Handoff

```
orchestrator → [specialists in parallel] → orchestrator (aggregation) → verification
```

## Integration with Existing Commands

- `/new-feature` maps to this workflow after spec generation
- `/minion` compresses Phases 4-5 into a single bounded iteration node

## Phase Triggers

### Entry Trigger
- Auto-triggered by contract-negotiation.md when contract is agreed
- `/harness` command flow (Phase 4-5 activation)
- For trivial scope: directly from Phase 1 (Intake)

### Exit Trigger — Execution Complete
- All specialists report completion with evidence → proceed to aggregation
- Specialist failure → retry once, then **ESCALATE**

### Exit Trigger — Aggregation Complete
- `pnpm turbo run type-check lint test` passes → **auto-trigger Phase 6** (build-to-release.md)
- Integration checks fail → route conflicts to responsible specialists

### Handoff Artifact
Integrated codebase with all specialist evidence, passed to `build-to-release.md` workflow.
