---
name: build-to-release
type: workflow
phases: [6, 7, 8]
version: 1.1.0
---

# Workflow: Build → Release

Covers **Phase 6 (Verification)**, **Phase 7 (Iteration)**, and **Phase 8 (Production)** of the convergence loop.

## Trigger

Phase 5 (Aggregation) completed with a build-passing codebase.

## Phase 6: Verification

Three parallel verification tracks:

### Track A: Code Verification — verification agent (Binary PASS/FAIL)

```bash
pnpm turbo run type-check    # TypeScript compilation
pnpm turbo run lint           # Linting rules
pnpm turbo run test           # Test suite
```

All three must PASS. Any FAIL → Phase 7 (Iteration).

### Track B: Acceptance Validation — qa-validator (Rubric 0-100)

Score against applicable rubrics:
- `code-rubric.md` — always
- `ui-rubric.md` — if frontend changes
- `architecture-rubric.md` — if structural changes
- `prd-rubric.md` — if requirements were produced

All scores must be ≥ 70. Any score < 70 → Phase 7 (Iteration).

### Track C: Design Review — design-reviewer (If UI Changes)

Only triggered when frontend changes are present:
1. Audit against Scientific Luxury design system
2. Score against `ui-rubric.md`
3. Produce review report with specific fix recommendations

### Phase 6 Gate

| Condition | Result |
|-----------|--------|
| All tracks pass | → Phase 8 (Production) |
| Any track fails | → Phase 7 (Iteration) |

## Phase 7: Iteration

**Owner**: orchestrator

### Iteration Protocol

1. Collect all failure reports from Phase 6
2. Route each failure to the responsible agent:
   - Code failures → relevant specialist (frontend/backend)
   - Rubric failures → agent that produced the deliverable
   - Design failures → frontend-specialist with design-reviewer feedback
3. Specialists remediate and resubmit
4. Re-run Phase 6 verification

### Iteration Cap

| Counter | Limit |
|---------|-------|
| Per-failure remediation | 2 attempts |
| Total Phase 7 cycles | 2 |

If limits exceeded → **ESCALATE** to user. Do not retry further.

This is consistent with the minion protocol's bounded iteration principle.

### Iteration Tracking

```markdown
## Iteration Log
| Cycle | Failure | Agent | Remediation | Result |
|-------|---------|-------|-------------|--------|
| 1 | [description] | [agent] | [what was done] | [PASS/FAIL] |
```

## Phase 8: Production

**Owner**: delivery-manager

### Step 1: Release Scoring

Score against `release-rubric.md`:
- Evidence completeness
- PR quality
- Regression risk
- Rollback plan
- Documentation updates

Must score ≥ 70 to proceed.

### Step 2: PR Creation

1. Verify commit messages follow convention
2. Verify branch naming convention
3. Create PR body using delivery-manager template
4. Include all rubric scores and verification evidence
5. Add test plan with checkboxes

### Step 3: Hand-off

1. Produce delivery status report
2. Update PROGRESS.md if applicable
3. Update `.claude/memory/current-state.md` with completion status
4. **STOP** — human review gate. Never merge automatically.

## Output

A pull request ready for human review, with full evidence trail.

## Handoff

```
verification + qa-validator + design-reviewer → orchestrator → delivery-manager → HUMAN REVIEW
```

## Integration with Existing Commands

- `/verify` maps to Phase 6 (Verification) as a standalone check
- `/minion` pathway always terminates at Phase 8 PR creation with `minion-generated` label

## Phase Triggers

### Entry Trigger
- Auto-triggered by spec-to-build.md when aggregation checks pass
- `/harness` command flow (Phase 6-8 activation)
- `/verify` command (standalone Phase 6 only)

### Exit Trigger — Verification
- All 3 tracks pass → proceed to Phase 8 (Production)
- Any track fails → **auto-trigger Phase 7** (iteration within this workflow)

### Exit Trigger — Iteration
- Remediation succeeds → re-run verification
- 2 iteration cycles exhausted → **ESCALATE** to user

### Exit Trigger — Production
- Release scored ≥70 → create PR → **STOP** (human review gate)
- Release scored <70 → iterate on PR quality

### Handoff Artifact
Pull request URL with evidence trail. Contract cleaned up. Human review required.
