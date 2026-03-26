---
name: idea-to-prd
type: workflow
phases: [1, 2]
version: 1.1.0
---

# Workflow: Idea → PRD

Covers **Phase 1 (Intake)** and **Phase 2 (Discovery)** of the convergence loop.

## Trigger

User describes a feature idea, problem, or initiative — either as a conversation message or via `/new-feature`.

## Phase 1: Intake

**Owner**: orchestrator

1. Classify intent using CLI Control Plane mode detection (BUILD, FIX, REFACTOR, etc.)
2. Assess scope: trivial (skip to Phase 4), standard (full loop), or complex (full loop + extra discovery)
3. Assess risk level: LOW / MEDIUM / HIGH
4. Decide if full convergence loop is warranted or if direct specialist delegation suffices

### Scope Decision Matrix

| Scope | Examples | Phases to Run |
|-------|----------|---------------|
| Trivial | Copy change, typo fix, config tweak | 4 → 6 → 8 (skip 1-3) |
| Standard | New component, API endpoint, feature | 1 → 8 (full loop) |
| Complex | Cross-cutting feature, migration, new system | 1 → 8 (full loop + extended discovery) |

## Phase 2: Discovery

**Owner**: product-strategist

1. If context is insufficient → invoke spec-builder in interview mode (6-phase interview)
2. Draft PRD using product-strategist's template
3. Submit PRD to qa-validator for scoring against `prd-rubric.md`
4. If score ≥ 70 → proceed to Phase 3 (Decomposition)
5. If score 50-69 → iterate once with product-strategist
6. If score < 50 → escalate to user for clarification

### Integration with spec-builder

The product-strategist may invoke spec-builder in interview mode when:
- The user's description is vague or incomplete
- Multiple valid interpretations exist
- Success metrics are undefined

Spec-builder conducts its 6-phase interview and returns structured requirements to product-strategist for PRD creation.

## Output

A scored PRD document that flows into `prd-to-spec.md` (Phase 3).

## Handoff

```
orchestrator → product-strategist → [spec-builder if needed] → qa-validator → orchestrator
```

## Phase Triggers

### Entry Trigger
- `/harness` command with standard or complex scope
- Phase 1 (Intake) completes with scope ≠ trivial
- Manual invocation: `/new-feature` (legacy path)

### Exit Trigger
- PRD scored ≥70 by qa-validator → **auto-trigger Phase 3** (prd-to-spec.md)
- PRD scored 50-69 → iterate once within this phase
- PRD scored <50 → **ESCALATE** to user

### Handoff Artifact
The approved PRD document, passed as input to `prd-to-spec.md` workflow.
