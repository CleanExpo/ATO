---
name: prd-to-spec
type: workflow
phases: [3]
version: 1.2.0
---

# Workflow: PRD → Spec

Covers **Phase 3 (Decomposition)** of the convergence loop.

## Trigger

A PRD has been scored ≥ 70 by qa-validator and approved in Phase 2.

## Phase 3: Decomposition

### Step 1: Architecture Delta — technical-architect

1. Receive approved PRD from orchestrator
2. Read current architecture state from CLAUDE.md and affected source files
3. Produce architecture delta document using template
4. Submit for scoring against `architecture-rubric.md`
5. If score ≥ 70 → proceed to Step 2
6. If score < 70 → iterate once with technical-architect

### Step 2: Implementation Plan — senior-engineer

1. Receive approved architecture delta
2. Read affected files to understand current implementation
3. Decompose into ordered implementation tasks
4. Identify parallelisable vs sequential tasks
5. Define interface contracts and acceptance criteria for each task
6. Submit implementation plan to orchestrator

### Step 3: Task Assignment — orchestrator

1. Map each task to the appropriate specialist agent:
   - Frontend tasks → frontend-specialist
   - Backend tasks → backend-specialist
   - Database tasks → database-specialist
   - Test tasks → test-engineer
2. Mark parallelisable tasks for concurrent execution
3. Queue sequential tasks in dependency order

### Step 4: Contract Negotiation (Standard + Complex scope only)

1. Senior-engineer drafts sprint contract from the implementation plan
2. Qa-validator reviews and negotiates testable criteria
3. Agreed contract written to `.claude/data/active-contract.json`
4. Contract binds Phase 6 verification scoring

**Workflow detail**: `.claude/workflows/contract-negotiation.md`

## Output

An implementation plan with task assignments ready for Phase 4 (Execution).

## Handoff

```
orchestrator → technical-architect → qa-validator → senior-engineer → qa-validator (contract) → orchestrator
```

## Integration with Existing Workflows

- If the task arrived via `/new-feature`, the spec-builder template output feeds into this workflow as equivalent to a PRD
- If the task arrived via `/minion`, this workflow is compressed into the blueprint's `implement` node

## Phase Triggers

### Entry Trigger
- Auto-triggered by idea-to-prd.md when PRD scores ≥70
- `/harness` command flow (Phase 3 activation)

### Exit Trigger — Architecture
- Architecture scored ≥70 → proceed to implementation planning
- Architecture scored 50-69 → iterate once with technical-architect
- Architecture scored <50 → **ESCALATE**

### Exit Trigger — Implementation Plan
- Senior-engineer produces task breakdown → **auto-trigger Phase 3.5** (contract-negotiation.md)

### Handoff Artifact
Implementation plan with task assignments, passed to `contract-negotiation.md` workflow.
