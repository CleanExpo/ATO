---
name: verification-before-completion
description: Hard gate before any "Done", "Complete", or "✅" claim. Must execute verification commands and read actual output before claiming work is complete. Bans hedging language. Triggers before any completion statement, commit, PR creation, or success claim.
license: MIT
metadata:
  author: NodeJS-Starter-V1 — adapted from obra/superpowers (MIT)
  version: '2.0.0'
  modified: 26/03/2026
  locale: en-AU
context: fork
---

# Verification Before Completion

Adapted from [obra/superpowers](https://github.com/obra/superpowers) — MIT. Hard gate enforced before any completion claim. Evidence required — confidence is not evidence.

## The Iron Law

```
NO COMPLETION CLAIM WITHOUT FRESH EVIDENCE FROM RUNNING COMMANDS
```

"Should work", "probably passes", "seems correct" are not evidence.
Running a command and reading the full output is evidence.

## The 5-Step Gate

Before making **any** completion claim:

1. **Identify** the verification command that proves your claim
2. **Execute** the command freshly (not a cached or remembered result)
3. **Read** the complete output — not just the exit code
4. **Verify** the output actually confirms what you are claiming
5. **Only then** make the claim — with the evidence included

Skipping any step violates both the letter and spirit of this rule.

---

## Banned Phrases

Stop immediately if you are about to use any of these. Run verification first.

| Banned Phrase | Why It's Banned |
|---------------|-----------------|
| "should work" | Not evidence of working |
| "probably passes" | Not evidence of passing |
| "seems correct" | Not evidence of correctness |
| "likely fixed" | Not evidence of being fixed |
| "appears to be working" | Not evidence of working |
| "I believe this resolves" | Belief ≠ verification |
| "this should pass the tests" | Should ≠ does |
| "the logic looks right" | Looking right ≠ working right |
| "Done!" (before running tests) | Premature completion claim |
| "✅" (before running tests) | Premature completion signal |

---

## Verification Commands — NodeJS-Starter-V1

### Frontend Tests

```bash
# All frontend tests (required before claiming any frontend work done)
pnpm test --filter=web

# Specific test file
cd apps/web && npx vitest run __tests__/components/my-component.test.tsx

# With coverage
cd apps/web && npx vitest run --coverage
```

### Backend Tests

```bash
# All backend tests (required before claiming any backend work done)
cd apps/backend && uv run pytest -v

# Specific test file
cd apps/backend && uv run pytest tests/unit/test_specific.py -v

# With coverage report
cd apps/backend && uv run pytest --cov=src --cov-report=term-missing
```

### Full Stack

```bash
# All tests across the monorepo — required before any PR or "done" claim
pnpm turbo run test

# Type check — 0 errors required
pnpm turbo run type-check

# Lint — clean output required
pnpm turbo run lint
```

### Git State

```bash
# Confirm all changes are staged and committed
git status

# Confirm remote is up to date
git log --oneline origin/main..HEAD
```

---

## False Claims to Avoid

| Insufficient Evidence | What You Actually Need |
|----------------------|------------------------|
| "Linter passed" | Does NOT prove tests pass → run `pnpm turbo run test` |
| "Code changed" | Does NOT prove bug fixed → run the tests that were failing |
| "I'm confident it works" | Confidence ≠ correctness → run the command |
| Previous test run (old session) | Does NOT prove current state → run tests fresh |
| Partial test run (3 of 10 tests) | Does NOT prove all pass → run the full suite |
| Test passed in development | Does NOT prove CI will pass → use the same CI command |

---

## Verification Ritual — Per Task Type

### New Feature

```
□ Test(s) written BEFORE implementation (tdd skill)
□ Watched test fail for the expected reason
□ Watched test pass after implementation
□ Full test suite passing: pnpm turbo run test
□ TypeScript errors: pnpm turbo run type-check (0 errors)
□ Lint clean: pnpm turbo run lint
□ Manual smoke test in browser or Postman (if UI or API)
□ No console errors or warnings
```

### Bug Fix

```
□ Regression test written before fix (tdd + systematic-debugging skills)
□ Regression test failed before fix
□ Regression test passes after fix
□ Full test suite still green: pnpm turbo run test
□ Original bug confirmed resolved via manual verification
```

### Refactoring

```
□ Tests existed BEFORE the refactor (or written first via TDD)
□ All tests pass after refactor: pnpm turbo run test
□ TypeScript: 0 errors — pnpm turbo run type-check
□ No behaviour change observed (smoke test)
```

### Before Creating a PR

```
□ pnpm turbo run test — all passing, output shown in PR description or commit
□ pnpm turbo run type-check — 0 errors, output confirmed
□ pnpm turbo run lint — clean, output confirmed
□ git status — all changes committed
□ All features described in the PR manually verified
```

---

## Stop Signals

Stop immediately if you catch yourself:
- About to write "Done" without running tests
- About to use a banned phrase ("should work", "probably passes")
- About to commit or push without a fresh test suite run
- Relying on a test run from a previous session
- Satisfied that "the logic looks correct" without execution evidence
- About to report success on a task without completing the relevant checklist above

---

## The Non-Negotiable Rule

> **Evidence before claims, always.**

This applies to:
- All completion statements
- All implications of success ("Fixed!", "Implemented!", "✅")
- Any positive assertion about the state of the work

**No shortcuts. Run the command. Read the output. Then claim the result.**

---

## Code Completeness Scan

Before claiming work is complete, scan for placeholder patterns that indicate incomplete implementation. This check is MANDATORY and runs alongside other verification commands.

### Banned Placeholder Patterns

| Pattern | Language | Meaning |
|---------|----------|---------|
| `// TODO` | TypeScript/JavaScript | Unfinished work marker |
| `// FIXME` | TypeScript/JavaScript | Known bug marker |
| `// Add .* here` | TypeScript/JavaScript | Implementation placeholder |
| `// implement` | TypeScript/JavaScript | Stub function |
| `/* ... */` | TypeScript/JavaScript | Collapsed/elided code |
| `{/* placeholder */}` | JSX/TSX | Template placeholder |
| `pass  # TODO` | Python | Stub function |
| `raise NotImplementedError` | Python | Unimplemented method |
| `...` (Ellipsis as statement) | Python | Stub body |

### Verification Command

Run this grep before any completion claim:

```bash
rg --glob '*.{ts,tsx,py}' -n '(TODO|FIXME|Add .* here|implement|placeholder|NotImplementedError)' apps/
```

### Gate Rule

- If ANY placeholder pattern matches in files modified during this task → **VERIFICATION FAILS**
- Output: `INCOMPLETE: Placeholder code detected at {file}:{line}`
- This check cannot be overridden — placeholders MUST be resolved before completion

### Exceptions

- `TODO` in test files describing future test cases (not current deliverables) — allowed if explicitly documented
- `TODO` in comments referencing a tracked issue number (e.g., `// TODO(#123): implement after auth PR merges`) — allowed

---

## Relationship to Other Skills

- **`tdd`** — Verification before completion depends on TDD having written the tests that verification runs. Without TDD, there is nothing meaningful to verify.
- **`systematic-debugging`** — After a bug fix, use this skill to confirm the fix actually worked before claiming done.
- **`execution-guardian`** — Provides pre-execution confidence scoring; this skill provides final post-execution evidence before any completion claim.
