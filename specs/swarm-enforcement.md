# Swarm Enforcement Rules
# Adapted for ATO Platform | Windows | Next.js 16 | Vitest | Supabase

These rules are injected into every agent context. They cannot be overridden
by task descriptions or agent prompts. See `exception-registry.md` for
documented exceptions specific to this codebase.

---

## Rule 1 — Proof or It Didn't Happen

Every claim of "done", "complete", "working", or "fixed" MUST include
the terminal output proving it. Not a summary. Not a description. The
ACTUAL output, copy-pasted.

```
BAD:
  "I've updated the endpoint and it should work now."
  "The tests are passing."
  "I've verified the API returns the correct response."

GOOD:
  "Updated the endpoint. Proof:"
  $ pnpm test:run -- --grep "users" 2>&1
  stdout | tests/unit/api/users.test.ts
    v GET /api/users returns list (23ms)
    v GET /api/users/:id returns single (12ms)
  Tests  2 passed (45ms)
```

Saying "completed" without pasted terminal output is a critical failure.


## Rule 2 — No Self-Certification

The agent that builds cannot declare its own work complete.

After implementing ANY change:
1. Run the verification command defined in the plan
2. Paste the FULL output (not a summary)
3. If the output shows ANY errors, warnings, or unexpected behaviour — TASK IS NOT DONE
4. Create a fix task. Do not move to the next task.
5. After fixing, run verification AGAIN from scratch

**Agent mapping for this project:**

| Swarm Role | Maps To | Location |
|---|---|---|
| Builder | `developer` specialist | `.agent/specialists/developer/` |
| Validator | `tester` + `reviewer` specialists | `.agent/specialists/tester/`, `.agent/specialists/reviewer/` |
| Architect | `architect` specialist | `.agent/specialists/architect/` |
| Orchestrator | Senior PM Enhanced | `.agent/agents/senior_project_manager_enhanced/` |


## Rule 3 — Regression Protection

Before starting ANY work, capture the current state:

```powershell
# Windows (PowerShell)
pnpm test:run 2>&1 | Select-String -Pattern "Tests|passed|failed"
npx tsc --noEmit 2>&1 | Select-String -Pattern "error|Found"
pnpm lint 2>&1 | Select-String -Pattern "error"
```

```bash
# Git Bash / WSL
pnpm test:run 2>&1 | grep -E "Tests|passed|failed"
npx tsc --noEmit 2>&1 | tail -3
pnpm lint 2>&1 | grep -cE "error"
```

After finishing work, capture the new state and COMPARE.

| Metric | Regression = STOP |
|---|---|
| Test count | Decreased |
| Test failures | Increased |
| Type errors | Increased |
| Lint errors | Increased |
| Build | Was passing, now failing |

If ANY regression detected: **STOP. FIX. DO NOT CONTINUE.**


## Rule 4 — Verify After Each Logical Unit

Verify after completing each **logical unit of work**, not after every single file:

- A component + its test file
- An API route + its handler + its types
- A type change + all files it propagates to
- A database migration + its RLS policy
- An analysis engine + its validator test

Do NOT batch multiple unrelated changes before verification.
Do NOT wait until "the end" to run tests.

Commit at meaningful checkpoints:
- Feature complete and tested
- Bug fixed and regression-tested
- Refactor complete with unchanged test results


## Rule 5 — Explicit Failure Reporting

When something breaks:
1. Paste the EXACT error message and stack trace
2. State the file path and line number
3. State your diagnosis of the root cause
4. Propose a specific fix with the exact code change
5. Do NOT silently work around it, suppress warnings, or catch-and-ignore

```
BAD:
  "Fixed a small type error."

GOOD:
  "Type error in lib/analysis/rnd-engine.ts:47
   TS2345: Argument of type 'string' is not assignable to parameter of type 'AccountType'
   Cause: Xero SDK v13 AccountType is an enum, not a string.
   Fix: Change `account.type` to `String(account.type)` per Xero SDK pattern."
```


## Rule 6 — Stop Signals (Halt and Escalate)

STOP ALL WORK and report to the human if you encounter:

**General:**
- 3+ consecutive failures on the same issue
- A dependency that won't install after 2 attempts
- A type error unresolvable in 2 attempts
- Circular dependency detected
- Build output exceeds expected size by 3x+
- npm audit critical/high vulnerability
- Any data loss risk

**ATO-specific:**
- Missing environment variables not in `.env.example`
- Supabase connection failure or RLS policy violation
- Xero OAuth token expired with no refresh path
- Port conflict on 3000 (Next.js) or 54321 (Supabase)
- Tax calculation produces negative refund or >100% offset
- Validator flags a compliance violation in `lib/analysis/`
- Division 7A interest rate returns 0 or negative


## Rule 7 — Context Preservation

For sessions exceeding 2 hours:
1. Write progress to `specs/progress-log.md` after each completed task
2. Format: timestamp, phase, task (with evidence), next task
3. On any context reset, read these files FIRST:
   - `specs/plan.md` (current plan and task status)
   - `specs/progress-log.md` (where we left off)
   - `CLAUDE.md` (domain rules — first 200 lines minimum)
4. Include plan task numbers for continuity


## Rule 8 — Dependency Verification

Before using ANY external package:
1. Check `package.json` for the dependency
2. If not listed, verify it exists: `npm info [package] version`
3. Install: `pnpm add [package]` then verify `package.json` updated
4. Verify the API you're calling exists in the installed version

**Xero SDK special handling** (xero-node v13+):
- Enums (AccountType, StatusEnum, CurrencyCode) are NOT assignable to `string`
- Use `String(enumValue)` for conversions
- Response bodies need `as any[]` casting — see `exception-registry.md`


## Rule 9 — Code Quality Standards

The following are automatic failures unless documented in `exception-registry.md`:

| Pattern | Why It Fails | Exception Key |
|---|---|---|
| `any` type | Use proper types or `unknown` | `XERO-SDK-CAST` |
| `console.log` in production | Use structured logging | `API-ERROR-CONTEXT` |
| Empty `catch` blocks | Handle or re-throw | None |
| `// TODO` / `// FIXME` | Finish the work or create Linear issue | `DEFERRED-COMPLIANCE` |
| Hardcoded secrets/keys | Use environment variables | None |
| Disabled tests (`.skip`) | Remove or fix the test | None |
| `@ts-ignore` without comment | Must document justification | `XERO-SDK-WORKAROUND` |
| `eslint-disable` without comment | Must document justification | Case-by-case |
| Functions > 50 lines (excl. tests) | Extract helpers | `TAX-ENGINE-CALC` |
| Nested callbacks > 2 levels | Flatten with async/await | None |
| Hardcoded tax rates | Use rates-fetcher.ts with fallback | None |
| Mock data in production code | All data from Xero or ATO | None |


## Rule 10 — Domain Compliance

Tax calculation code MUST pass the existing Python validators after any
change to files in `lib/analysis/`:

```powershell
# Run specific validator
echo '{"calculation_type": "rnd", "eligible_expenditure": 100000, "rnd_offset": 43500}' | python .claude/hooks/validators/tax_calculation_validator.py

# Run financial year checks
echo '{"financial_year": "FY2024-25", "start": "2024-07-01", "end": "2025-06-30"}' | python .claude/hooks/validators/financial_year_validator.py
```

**Non-negotiable compliance rules:**
- R&D offset is TIERED: corp_rate + 18.5% (<$20M) or + 8.5% (>=$20M)
- Capital losses ONLY offset capital gains (ITAA 1997 s 102-5)
- Base rate entity requires BOTH turnover <$50M AND passive income <=80%
- Audit risk engine: NEVER recommend changing expenses to match benchmarks
- All deductions marked `status='potential'` — platform is not a registered tax agent
- Every numeric value needs provenance (`source`, `retrievedAt`, `financialYear`)
- Use `Decimal` for all money calculations, never floating-point arithmetic
