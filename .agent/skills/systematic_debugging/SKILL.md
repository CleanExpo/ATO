---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behaviour, before proposing any fixes. Four-phase root-cause protocol with hard 3-attempt circuit breaker. Enhances the bug-hunter agent with structured investigation. Triggers on "bug", "error", "failing", "crash", "debug", "broken", "why isn't", "not working".
license: MIT
metadata:
  author: NodeJS-Starter-V1 — adapted from obra/superpowers (MIT)
  version: '1.0.0'
  locale: en-AU
context: fork
---

# Systematic Debugging

Adapted from [obra/superpowers](https://github.com/obra/superpowers) — MIT. Enhances the `bug-hunter` agent with a structured 4-phase investigation protocol and a hard 3-attempt circuit breaker.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## When to Use

Any technical issue:
- Failing vitest or pytest tests
- FastAPI endpoint errors (500, 422, 401, 403)
- React component rendering issues
- TypeScript type errors
- Docker / PostgreSQL connection failures
- LangGraph agent unexpected behaviour
- CI/CD pipeline failures
- Performance regressions

**Especially when:**
- Under time pressure (emergencies make guessing tempting)
- "Just one quick fix" seems obvious
- You've already tried multiple fixes that didn't work
- You don't fully understand the issue

**Don't skip when:**
- Issue seems simple (simple bugs have root causes too)
- You're in a hurry (rushing guarantees rework)
- Manager wants it fixed NOW (systematic is faster than thrashing)

## The Four Phases

Complete each phase before proceeding to the next.

---

### Phase 1: Root Cause Investigation

**Before attempting ANY fix:**

**1. Read Error Messages Carefully**

- Don't skip past errors or warnings — they often contain the exact solution
- Read stack traces completely — note line numbers, file paths, error codes
- For FastAPI: read the full Pydantic validation error body, not just "422 Unprocessable Entity"
- For vitest: read the diff between expected and received, not just "FAIL"
- For TypeScript: read the full type error chain, not just the last line

**2. Reproduce Consistently**

- Can you trigger the failure reliably?
- What are the exact steps / the exact test command?
- Does it happen every time, or intermittently?
- If not reproducible → gather more data. Do not guess.

**3. Check Recent Changes**

```bash
git diff HEAD~1           # What changed since last green state
git log --oneline -10     # Recent commit context
git stash && pnpm turbo run test  # Does it fail on main without your changes?
```

**4. Gather Evidence in Multi-Component Systems**

When the stack has multiple layers (frontend → API → backend → database), add instrumentation at each boundary before proposing fixes:

```python
# FastAPI route — log incoming request
print(f"=== Request body: {request_data.model_dump()}")

# Service layer — log what reached it
print(f"=== Service input: {params}")

# Database query — log the generated SQL
print(f"=== SQL: {str(stmt.compile(compile_kwargs={'literal_binds': True}))}")
```

```typescript
// Next.js API route
console.log('=== Fetch params:', { url, method, body })

// React component
console.log('=== Props received:', props)
console.log('=== State:', stateValue)
```

Run **once** to gather evidence. THEN analyse which layer is failing. THEN investigate that specific layer.

**5. Trace Data Flow**

- Where does the bad value originate?
- What called this function with the bad value?
- Keep tracing up the call stack until you find the source
- Fix at source, not at symptom

---

### Phase 2: Pattern Analysis

**1. Find Working Examples**

Locate similar working code in this codebase:

```bash
# Find similar patterns — Python
grep -r "similar_function" apps/backend --include="*.py"

# Find similar patterns — TypeScript/React
grep -r "SimilarComponent" apps/web --include="*.tsx"
```

**2. Compare Against References**

If implementing a known pattern, read the reference implementation completely. Do not skim — read every line. Understand the pattern fully before applying.

**3. Identify Differences**

List every difference between the working example and the broken code — however small. Don't assume "that can't matter."

**4. Understand Dependencies**

What environment variables, config, external services, or Docker containers does this depend on?

```bash
# Check env vars are present
cat .env | grep RELEVANT_KEY

# Check Docker services are running
pnpm run docker:up
docker ps
```

---

### Phase 3: Hypothesis and Testing

**1. Form a Single, Specific Hypothesis**

State clearly: "I think X is the root cause because Y."

Write it down. Be specific — not "something is wrong with auth" but "the JWT secret is not being passed to the validation middleware because the env var name changed."

**2. Test Minimally**

Make the smallest possible change to test the hypothesis. ONE variable at a time. Do not fix multiple things at once.

**3. Verify Before Continuing**

- Fix worked? YES → Phase 4
- Didn't work? Form a **new** hypothesis. Do NOT add more fixes on top of the failed one.

**4. When You Don't Know**

Say "I don't understand X." Do not pretend to know. Research more, read the docs, or ask.

---

### Phase 4: Implementation

**1. Write a Failing Test First**

Use the `tdd` skill. Write the minimal test reproducing the bug **before** writing the fix.

```bash
# Frontend — write test, confirm it fails
pnpm test --filter=web

# Backend — write test, confirm it fails
cd apps/backend && uv run pytest tests/unit/test_specific.py -v
```

**2. Implement a Single Fix**

Address the root cause identified in Phase 1. ONE change at a time. No "while I'm here" refactoring.

**3. Verify the Fix**

```bash
# Run full test suite to confirm no regressions
pnpm turbo run test
```

**4. Circuit Breaker — If Fix Doesn't Work**

| Fix Attempt | Action |
|-------------|--------|
| 1 failed | Return to Phase 1 with new information |
| 2 failed | Return to Phase 1. Add more instrumentation. |
| **3 failed** | **STOP. Invoke Step 5 — question the architecture** |

Never attempt Fix #4 without an architectural discussion first.

**5. 3+ Fixes Failed → Question the Architecture**

Pattern indicating an architectural problem:
- Each fix reveals new coupling or shared state in a different place
- Fixes require "massive refactoring" to implement correctly
- Each fix creates new symptoms elsewhere

STOP and question fundamentals:
- Is this design pattern fundamentally sound?
- Are we "sticking with it through sheer inertia"?
- Should we refactor the architecture rather than continue fixing symptoms?

**Discuss with your human partner before attempting more fixes.** This is not a failed hypothesis — this is a wrong architecture.

---

## Red Flags — STOP and Return to Phase 1

If you catch yourself thinking:
- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "It's probably X, let me fix that"
- "I don't fully understand but this might work"
- "Here are the main problems:" [lists fixes without investigation]
- Proposing solutions before tracing data flow
- **"One more fix attempt" (when already tried 2+)**
- Each fix reveals new problem in a different place

**ALL of these mean: STOP. Return to Phase 1.**

**If 3+ fixes failed:** Question the architecture (Phase 4, Step 5).

---

## Common Rationalisation → Reality

| Rationalisation | Reality |
|----------------|---------|
| "Issue is simple, don't need process" | Simple issues have root causes too. The process is fast for simple bugs. |
| "Emergency, no time for process" | Systematic debugging is faster than guess-and-check thrashing. |
| "I'll write the test after confirming the fix" | Untested fixes don't stick. Test first proves the fix. |
| "Multiple fixes at once saves time" | Can't isolate what worked. Causes new bugs. |
| "One more fix attempt" (after 2+ failures) | 3+ failures = architectural problem. Question the pattern, don't fix again. |

---

## Quick Reference

| Phase | Key Activities | Done When |
|-------|---------------|-----------|
| **1. Root Cause** | Read errors, reproduce, check recent changes, gather evidence | You understand WHAT failed and WHY |
| **2. Pattern** | Find working examples, compare differences | You understand HOW it should work |
| **3. Hypothesis** | State single specific theory, test minimally | Theory confirmed or replaced |
| **4. Implementation** | Write failing test first, fix root cause, verify all tests pass | Bug resolved, all tests green |

---

## Integration with Bug-Hunter Agent

This skill extends the `bug-hunter` agent with the mandatory 4-phase protocol. When `bug-hunter` is dispatched:

1. Always start at Phase 1 — no skipping to proposed solutions
2. Report evidence gathered before any fix proposal
3. Apply the 3-attempt circuit breaker strictly
4. Use the `tdd` skill for writing the regression test in Phase 4, Step 1
5. Use the `verification-before-completion` skill before claiming the bug is resolved

## Related Skills

- **`tdd`** — Write a failing test reproducing the bug (Phase 4, Step 1)
- **`verification-before-completion`** — Confirm the fix actually worked before claiming done
- **`execution-guardian`** — Pre-execution risk assessment before attempting risky fixes
