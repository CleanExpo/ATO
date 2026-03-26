---
id: state-machine
name: state-machine
type: skill
version: 1.0.0
created: 20/03/2026
modified: 20/03/2026
status: active
metadata:
  author: NodeJS-Starter-V1
  version: 1.0.0
  locale: en-AU
description: ">-"
context: fork
---


# State Machine - Finite State Machines for Complex Flows

## Description

Enforces deterministic, minimal state machines for any multi-step flow in NodeJS-Starter-V1. Codifies the project's existing patterns (TaskStatus, ExecutionStatus, NodeStatus) and provides a reusable framework for defining states, transition maps, guard conditions, and side effects across Python and TypeScript.

---

## When to Apply

### Positive Triggers

- Designing multi-step workflows with distinct status phases
- Adding new `Enum` status fields to Pydantic models
- Implementing UI components with loading/error/success states
- Reviewing state transitions for completeness and determinism
- Adding retry, escalation, or verification loops
- User mentions: "state machine", "status", "workflow state", "transitions", "FSM"

### Negative Triggers

- Defining simple boolean flags (`is_active`, `is_published`)
- Implementing form validation (use `data-validation` instead)
- Designing animation state transitions (use `scientific-luxury` + Framer Motion)
- Classifying error types without state transitions (use `error-taxonomy` instead)

## Core Directives

### The Three Laws of State Machines

1. **Deterministic**: Every (state, event) pair produces exactly one next state
2. **Minimal**: No unreachable states, no duplicate transitions
3. **Complete**: Every state has defined exit transitions or is a terminal state

### State Definition Convention

Use `str, Enum` for all status fields. String enums serialise cleanly to JSON and are readable in logs.

```python
from enum import Enum

class OrderStatus(str, Enum):
    """Status of an order — each value is a distinct FSM state."""

    DRAFT = "draft"
    SUBMITTED = "submitted"
    PROCESSING = "processing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
```

```typescript
// Frontend mirror — use const assertion, not enum
const ORDER_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
```

---

## Existing Project State Machines

### TaskStatus (Orchestrator)

**Location**: `apps/backend/src/agents/orchestrator.py`

10 states governing the task lifecycle with verification loop:

```
PENDING → IN_PROGRESS → AWAITING_VERIFICATION
                              ↓
                    VERIFICATION_IN_PROGRESS
                         ↙          ↘
           VERIFICATION_PASSED    VERIFICATION_FAILED
                    ↓                    ↓
               COMPLETED          (retry → IN_PROGRESS)
                                  (max retries → ESCALATED_TO_HUMAN)

Cross-cutting:
  Any non-terminal → BLOCKED (dependency unmet)
  Any non-terminal → FAILED (unrecoverable error)
```

**Terminal states**: COMPLETED, FAILED, ESCALATED_TO_HUMAN

### ExecutionStatus (Workflow Engine)

**Location**: `apps/backend/src/workflow/models.py`

4 states for workflow execution lifecycle:

```
PENDING → RUNNING → COMPLETED
                  → FAILED
```

**Terminal states**: COMPLETED, FAILED

### NodeStatus (Workflow Nodes)

**Location**: `apps/backend/src/workflow/state.py`

5 states for individual node execution:

```
PENDING → RUNNING → COMPLETED
                  → FAILED
       → SKIPPED (conditional branch not taken)
```

**Terminal states**: COMPLETED, FAILED, SKIPPED

---

## Design Patterns

### Pattern 1: Transition Map

Define allowed transitions as a dictionary. Reject any transition not in the map.

```python
from typing import TypeVar

S = TypeVar("S", bound=Enum)

TASK_TRANSITIONS: dict[TaskStatus, set[TaskStatus]] = {
    TaskStatus.PENDING: {
        TaskStatus.IN_PROGRESS,
        TaskStatus.BLOCKED,
        TaskStatus.FAILED,
    },
    TaskStatus.IN_PROGRESS: {
        TaskStatus.AWAITING_VERIFICATION,
        TaskStatus.BLOCKED,
        TaskStatus.FAILED,
    },
    TaskStatus.AWAITING_VERIFICATION: {
        TaskStatus.VERIFICATION_IN_PROGRESS,
    },
    TaskStatus.VERIFICATION_IN_PROGRESS: {
        TaskStatus.VERIFICATION_PASSED,
        TaskStatus.VERIFICATION_FAILED,
    },
    TaskStatus.VERIFICATION_PASSED: {
        TaskStatus.COMPLETED,
    },
    TaskStatus.VERIFICATION_FAILED: {
        TaskStatus.IN_PROGRESS,  # Retry
        TaskStatus.ESCALATED_TO_HUMAN,  # Max retries exceeded
    },
    # Terminal states — no outgoing transitions
    TaskStatus.COMPLETED: set(),
    TaskStatus.FAILED: set(),
    TaskStatus.BLOCKED: {
        TaskStatus.PENDING,  # Unblocked
    },
    TaskStatus.ESCALATED_TO_HUMAN: set(),
}


def validate_transition(
    current: TaskStatus,
    target: TaskStatus,
    transitions: dict[TaskStatus, set[TaskStatus]] = TASK_TRANSITIONS,
) -> bool:
    """Check if a state transition is allowed."""
    allowed = transitions.get(current, set())
    return target in allowed


def transition(
    current: TaskStatus,
    target: TaskStatus,
) -> TaskStatus:
    """Execute a validated state transition."""
    if not validate_transition(current, target):
        raise ValueError(
            f"Invalid transition: {current.value} → {target.value}"
        )
    return target
```

### Pattern 2: Guard Conditions

Guards are predicates that must be true before a transition fires.

```python
from dataclasses import dataclass
from typing import Callable


@dataclass
class GuardedTransition:
    """A transition with a guard condition."""

    source: TaskStatus
    target: TaskStatus
    guard: Callable[[TaskState], bool]
    description: str


GUARDED_TRANSITIONS = [
    GuardedTransition(
        source=TaskStatus.VERIFICATION_FAILED,
        target=TaskStatus.IN_PROGRESS,
        guard=lambda task: task.attempts < task.max_attempts,
        description="Retry only if under max attempts",
    ),
    GuardedTransition(
        source=TaskStatus.VERIFICATION_FAILED,
        target=TaskStatus.ESCALATED_TO_HUMAN,
        guard=lambda task: task.attempts >= task.max_attempts,
        description="Escalate after max retry attempts",
    ),
    GuardedTransition(
        source=TaskStatus.BLOCKED,
        target=TaskStatus.PENDING,
        guard=lambda task: len(task.error_history) == 0,
        description="Unblock only if blocking condition resolved",
    ),
]
```

### Pattern 3: Side Effects on Transition

Execute side effects (logging, notifications, metrics) when transitions occur.

```python
import structlog

logger = structlog.get_logger(__name__)


async def on_transition(
    task: TaskState,
    old_status: TaskStatus,
    new_status: TaskStatus,
) -> None:
    """Execute side effects after a state transition."""

    logger.info(
        "task_transition",
        task_id=task.task_id,
        from_status=old_status.value,
        to_status=new_status.value,
    )

    # Terminal state side effects
    if new_status == TaskStatus.COMPLETED:
        task.completed_at = datetime.now().isoformat()

    if new_status == TaskStatus.ESCALATED_TO_HUMAN:
        logger.warning(
            "task_escalated",
            task_id=task.task_id,
            attempts=task.attempts,
        )

    if new_status == TaskStatus.FAILED:
        logger.error(
            "task_failed",
            task_id=task.task_id,
            error_history=task.error_history,
        )
```

### Pattern 4: Frontend State Machine (TypeScript)

Use a reducer pattern for UI state machines:

```typescript
type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: unknown }
  | { status: 'error'; error: string };

type FetchEvent =
  | { type: 'FETCH' }
  | { type: 'RESOLVE'; data: unknown }
  | { type: 'REJECT'; error: string }
  | { type: 'RESET' };

function fetchReducer(state: FetchState, event: FetchEvent): FetchState {
  switch (state.status) {
    case 'idle':
      if (event.type === 'FETCH') return { status: 'loading' };
      return state;

    case 'loading':
      if (event.type === 'RESOLVE') return { status: 'success', data: event.data };
      if (event.type === 'REJECT') return { status: 'error', error: event.error };
      return state;

    case 'success':
      if (event.type === 'FETCH') return { status: 'loading' };
      if (event.type === 'RESET') return { status: 'idle' };
      return state;

    case 'error':
      if (event.type === 'FETCH') return { status: 'loading' };
      if (event.type === 'RESET') return { status: 'idle' };
      return state;
  }
}
```

Usage with React:

```tsx
function useStateMachine() {
  const [state, dispatch] = useReducer(fetchReducer, { status: 'idle' });
  return { state, dispatch };
}
```

---

## Creating a New State Machine

### Step 1: Enumerate States

List every distinct status. Apply the **Turing Check** — no redundant states:

```python
class MyStatus(str, Enum):
    """Each state must be reachable and have at least one exit or be terminal."""

    STATE_A = "state_a"
    STATE_B = "state_b"
    STATE_C = "state_c"  # Terminal
```

### Step 2: Define Transition Map

```python
MY_TRANSITIONS: dict[MyStatus, set[MyStatus]] = {
    MyStatus.STATE_A: {MyStatus.STATE_B},
    MyStatus.STATE_B: {MyStatus.STATE_C},
    MyStatus.STATE_C: set(),  # Terminal
}
```

### Step 3: Add Guards (If Needed)

Only add guards when a transition depends on runtime data.

### Step 4: Add Side Effects (If Needed)

Logging, metrics, notifications on transition.

### Step 5: Validate Completeness

```python
def validate_fsm(transitions: dict[Enum, set[Enum]]) -> list[str]:
    """Validate a finite state machine for completeness."""
    issues: list[str] = []
    all_states = set(transitions.keys())
    all_targets = {t for targets in transitions.values() for t in targets}

    # Check for unreachable states (not targets and not initial)
    initial = list(transitions.keys())[0]
    unreachable = all_states - all_targets - {initial}
    for state in unreachable:
        issues.append(f"Unreachable state: {state.value}")

    # Check for undefined targets
    undefined = all_targets - all_states
    for state in undefined:
        issues.append(f"Undefined target state: {state.value}")

    # Check terminal states have no transitions
    for state, targets in transitions.items():
        if len(targets) == 0:
            continue  # Valid terminal
        # Non-terminal must have at least one reachable target
        if not targets.intersection(all_states):
            issues.append(f"Dead end: {state.value} targets undefined states")

    return issues
```

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|---|---|---|
| String literals for status (`status = "running"`) | No type safety, typos cause bugs | `str, Enum` with exhaustive matching |
| Boolean flags (`is_running`, `is_complete`) | Impossible states (`is_running=True, is_complete=True`) | Single status enum |
| Implicit transitions (set status anywhere) | Race conditions, invalid states | Transition map with validation |
| God enum (20+ states) | Unmanageable complexity | Decompose into hierarchical machines |
| Missing terminal states | Processes hang forever | Every machine needs at least one terminal |

---

## Checklist for New State Machines

### Design

- [ ] All states enumerated as `str, Enum`
- [ ] Transition map defines every (state, target) pair
- [ ] Terminal states have empty transition sets
- [ ] No unreachable states
- [ ] No undefined target states
- [ ] Guards documented for conditional transitions

### Implementation

- [ ] `validate_transition()` called before every status change
- [ ] Side effects fire after transition, not before
- [ ] Logging includes `from_status` and `to_status`
- [ ] Frontend mirrors backend states exactly (snake_case)

### Council of Logic

- [ ] **Turing**: Transition lookup is O(1) via dict/set
- [ ] **Von Neumann**: State changes are atomic — no partial transitions
- [ ] **Shannon**: Enum values are minimal — no redundant states

---

## Response Format

```
[AGENT_ACTIVATED]: State Machine
[PHASE]: {Design | Implementation | Review}
[STATUS]: {in_progress | complete}

{state machine analysis or implementation guidance}

[NEXT_ACTION]: {what to do next}
```

## Integration Points

### Council of Logic (Turing Check)

- State machines must be deterministic and minimal
- Transition lookup must be O(1) — use dict, not if/elif chains
- No unreachable or duplicate states

### Error Taxonomy

- Invalid transitions raise `WORKFLOW_VALIDATION_INVALID_TRANSITION`
- Terminal error states map to the appropriate error code and severity

### Structured Logging

- Every state transition logs `task_transition` event with `from_status`, `to_status`
- Terminal states log completion or failure with context

### API Contract

- Status enums are part of the API response contract
- Frontend Zod schemas must include all enum values
- Adding a new enum value is non-breaking; removing is breaking

## Australian Localisation (en-AU)

- **Spelling**: serialise, analyse, optimise, behaviour, colour
- **Date Format**: ISO 8601 in transit; DD/MM/YYYY in UI display
- **Timezone**: AEST/AEDT — timestamps stored as UTC
