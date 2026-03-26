---
name: tdd
description: Use when implementing any feature or bug fix. Hard gate — no production code without a failing test first. Applies to vitest (apps/web/) and pytest (apps/backend/). Triggers on "implement", "add feature", "fix bug", "new component", "new endpoint", or any code-writing task.
license: MIT
metadata:
  author: NodeJS-Starter-V1 — adapted from obra/superpowers (MIT)
  version: '1.0.0'
  locale: en-AU
context: fork
---

# Test-Driven Development (TDD)

Adapted from [obra/superpowers](https://github.com/obra/superpowers) — MIT. Stack-specific extensions for vitest (Next.js 15) + pytest (FastAPI).

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? Delete it. Start over.

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete

Implement fresh from tests. Period.

## When to Use

**Always:**
- New React components (`apps/web/`)
- New FastAPI endpoints (`apps/backend/src/api/`)
- Bug fixes in either app
- Refactoring existing functions
- New LangGraph agent logic (`apps/backend/src/agents/`)

**Exceptions (get human partner confirmation first):**
- Throwaway prototypes / proof-of-concept spikes
- Generated scaffold code (e.g., Alembic migrations)
- Configuration files

Thinking "skip TDD just this once"? Stop. That's rationalisation.

## Red–Green–Refactor

### RED — Write a Failing Test First

Write one minimal test describing the desired behaviour. Name it precisely.

**Frontend (vitest — `apps/web/__tests__/`)**

```typescript
// apps/web/__tests__/lib/validators/email.test.ts
import { describe, it, expect } from 'vitest'
import { validateEmail } from '@/lib/validators/email'

describe('validateEmail', () => {
  it('rejects empty email', () => {
    expect(validateEmail('')).toEqual({ valid: false, error: 'Email required' })
  })
})
```

**Backend (pytest — `apps/backend/tests/`)**

```python
# apps/backend/tests/unit/test_email_validator.py
from src.utils.validators import validate_email

def test_rejects_empty_email():
    result = validate_email("")
    assert result.valid is False
    assert result.error == "Email required"
```

### Verify RED — Watch It Fail

**MANDATORY. Never skip.**

```bash
# Frontend
pnpm test --filter=web

# Backend
cd apps/backend && uv run pytest tests/unit/test_email_validator.py -v
```

Confirm:
- Test **fails** (not errors out with import/syntax issues)
- Failure message is the expected one
- Fails because the feature is missing, not because of a typo

### GREEN — Minimal Code to Pass

Write the simplest possible implementation. Do not add features not required by the current test.

### Verify GREEN — Watch It Pass

```bash
# Frontend (full suite — confirm no regressions)
pnpm test --filter=web

# Backend
cd apps/backend && uv run pytest -v
```

Confirm:
- New test passes
- All other tests still pass
- No errors or warnings in output

### REFACTOR — Clean Up

After GREEN only:
- Extract helpers or shared logic
- Improve names
- Remove duplication

Keep all tests green. Do not add behaviour.

### Repeat

Write the next failing test for the next unit of behaviour.

## Good Tests

| Quality | Good | Bad |
|---------|------|-----|
| **Minimal** | Tests one thing. "and" in name? Split it. | `test_validates_email_and_domain_and_whitespace` |
| **Clear name** | `test_rejects_empty_email` | `test_email_1` |
| **Intent visible** | Shows what the code *should* do | Obscures the contract |
| **Stack-appropriate** | vitest for frontend, pytest for backend | Mixing test runners |

## Test File Locations

| Code Location | Test Location | Runner |
|---------------|---------------|--------|
| `apps/web/components/` | `apps/web/__tests__/components/` | vitest |
| `apps/web/lib/` | `apps/web/__tests__/lib/` | vitest |
| `apps/backend/src/` | `apps/backend/tests/unit/` | pytest |
| `apps/backend/src/api/routes/` | `apps/backend/tests/api/` | pytest |
| `apps/backend/src/agents/` | `apps/backend/tests/agents/` | pytest |

## Common Rationalisation → Reality

| Rationalisation | Reality |
|----------------|---------|
| "Too simple to test" | Simple code breaks. The test takes 30 seconds to write. |
| "I'll test after" | Tests passing immediately prove nothing about correctness. |
| "Already manually tested" | Ad-hoc ≠ systematic. No record, can't re-run on CI. |
| "Deleting X hours is wasteful" | Sunk cost fallacy. Unverified code is technical debt. |
| "TDD will slow me down" | TDD is faster than debugging. Pragmatism means test-first. |
| "Keep as reference, write tests first" | You'll adapt it. That's testing after. Delete means delete. |
| "Need to explore first" | Fine. Throw away the exploration, then start TDD. |
| "This is different because..." | It isn't. Delete code. Start over with TDD. |

## Red Flags — STOP and Start Over

- Code written before any test
- Test written after implementation
- Test passes immediately on first run (it should fail first)
- Can't explain why the test failed
- "I'll add tests later"
- "Just this once" rationalising
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "It's about the spirit, not the ritual"

**All of these mean: Delete code. Start over with TDD.**

## Verification Checklist

Before marking any feature or fix complete:

- [ ] Every new function/method has a test written **before** the implementation
- [ ] Watched each test **fail** before implementing
- [ ] Test failed for the expected reason (feature missing, not import error)
- [ ] Wrote minimal code to make each test pass
- [ ] All tests pass: `pnpm turbo run test`
- [ ] Output pristine — no errors, no warnings
- [ ] Tests use real code (mocks only when unavoidable — e.g., external APIs)
- [ ] Edge cases and error paths covered

Can't check all boxes? You skipped TDD. Start over.

## When Stuck

| Problem | Solution |
|---------|----------|
| Don't know how to test | Write the wished-for API first. Write the assertion before the implementation. |
| Test is too complicated | The design is too complicated. Simplify the interface. |
| Must mock everything | Code is too coupled. Use dependency injection. |
| Test setup is enormous | Extract fixtures/helpers. Still complex? Simplify the design. |

## Debugging Integration

Found a bug? Write a failing test that reproduces it. Follow the TDD cycle. The test proves the fix and prevents regression.

Never fix bugs without a test first. See the `systematic-debugging` skill.

## Final Rule

```
Production code exists → a test was written first and watched to fail
Otherwise → this is not TDD
```

No exceptions without explicit human partner confirmation.
