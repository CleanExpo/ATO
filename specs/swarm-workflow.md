# Swarm Workflow: Explore > Plan > Build > Validate
# Adapted for ATO Platform | Windows | Vitest | Supabase | Xero

This workflow integrates with the existing `.agent/` architecture.
The four phases map to quality gates defined in `lib/agents/quality-gates.ts`.

---

## Phase 1: EXPLORE (No code. Only discovery.)

**Purpose:** Understand the project as it ACTUALLY IS, not as documentation
says it should be.

**Agent:** `architect` specialist or Senior PM Enhanced

### Discovery Commands (Windows-compatible)

```powershell
# Project health
pnpm test:run 2>&1 | Select-String -Pattern "Tests|passed|failed"
pnpm lint 2>&1 | Select-String -Pattern "error|warning"
npx tsc --noEmit 2>&1 | Select-String -Pattern "error|Found"
pnpm build 2>&1 | Select-String -Pattern "error|success|Ready"

# Source layout
Get-ChildItem -Path app/api -Recurse -Filter "*.ts" | Select-Object FullName
Get-ChildItem -Path lib/analysis -Recurse -Filter "*.ts" | Select-Object FullName

# Test inventory
Get-ChildItem -Path tests -Recurse -Filter "*.test.*" | Measure-Object
Get-ChildItem -Path tests -Recurse -Filter "*.spec.*" | Measure-Object

# Dependencies
Get-Content package.json | ConvertFrom-Json | Select-Object -ExpandProperty scripts

# Environment
Get-ChildItem -Filter ".env*" -Exclude "node_modules"

# Git state
git status
git log --oneline -15

# Xero integration state
Get-ChildItem -Path lib/xero -Filter "*.ts" | Select-Object Name

# Analysis engines
Get-ChildItem -Path lib/analysis -Filter "*.ts" | Select-Object Name
```

### Output

Write `specs/discovery.md` with ONLY what the commands ACTUALLY returned.
Do NOT fill in gaps from assumption. If a command returned nothing, write "NO OUTPUT".

**GATE:** Phase 2 cannot begin until `specs/discovery.md` exists with real command output.


## Phase 2: PLAN (No code. Only planning.)

**Purpose:** Create a battle plan with measurable success criteria and
verification commands for every task.

**Agent:** Senior PM Enhanced (`.agent/agents/senior_project_manager_enhanced/`)

### Plan Format

Write `specs/plan.md`:

```markdown
# Execution Plan
Date: [ISO date]
Based on: specs/discovery.md

## Problem Statement
[What is broken/missing — specific file paths, line numbers, error messages]

## Current State (Evidence)
- Tests: [X passed, Y failed — paste the summary line]
- Types: [N errors — paste the summary line]
- Lint: [N errors — paste the summary line]
- Build: [pass/fail — paste the summary line]
- Validators: [which pass/fail — paste output]

## Target State (Measurable)
- Tests: [X+N passed, 0 failed]
- Types: 0 errors
- Lint: 0 errors
- Build: succeeds
- Validators: all pass

## Tasks

| # | Specialist | Task | Input Files | Output Files | Verify Command | Status |
|---|------------|------|-------------|-------------|----------------|--------|
| 1 | developer | Create CGT engine | lib/utils/financial-year.ts | lib/analysis/cgt-engine.ts | `pnpm test:run -- cgt` | pending |
| 2 | tester | Verify CGT engine | lib/analysis/cgt-engine.ts | tests/unit/cgt.test.ts | `pnpm test:run -- cgt` | pending |
| 3 | developer | Create CGT API route | lib/analysis/cgt-engine.ts | app/api/analysis/cgt/route.ts | `curl localhost:3000/api/analysis/cgt` | pending |
| 4 | reviewer | Code review CGT | all CGT files | - | `npx tsc --noEmit && pnpm lint` | pending |

## Scope Control
IN: [explicit list]
OUT: [explicit list — will NOT do in this iteration]

## Risk Register
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|

## Linear Integration
- Parent issue: [LINEAR-XXX or "create new"]
- Sub-tasks: [will create per specialist assignment]
```

**GATE:** Phase 3 cannot begin until `specs/plan.md` exists with task table and verify commands.


## Phase 3: BUILD (Implement one task at a time.)

**Agent:** `developer` specialist builds. `tester` specialist verifies.

For EACH task in the plan:

### 3.1 Read the Task
Know exactly what you're building, what inputs exist, what outputs are expected.

### 3.2 Capture Before-State
```powershell
pnpm test:run 2>&1 | Select-String "Tests"
npx tsc --noEmit 2>&1 | Select-String "error"
```
Paste output. This is your regression baseline.

### 3.3 Write Tests FIRST (TDD)
Write the test. Run it. Verify it FAILS. This proves the test actually tests
the right thing.

```powershell
pnpm test:run -- --grep "CGT" 2>&1
# Expected: 0 passed, N failed
```

### 3.4 Implement Minimum Code
Write the minimum code to pass the test. Follow patterns in CLAUDE.md:
- Error handling via `createErrorResponse` / `createValidationError`
- API routes with `export const dynamic = 'force-dynamic'`
- Money calculations with `Decimal`
- Tax rates from `rates-fetcher.ts` with fallback
- Data provenance on all numeric values

### 3.5 Run Verification
```powershell
# Feature tests
pnpm test:run -- --grep "CGT" 2>&1

# All quality gates
pnpm test:run 2>&1 | Select-String "Tests"
pnpm lint 2>&1 | Select-String "error"
npx tsc --noEmit 2>&1 | Select-String "error"
```
Paste FULL output.

### 3.6 Run Domain Validators (if lib/analysis/ changed)
```powershell
echo '{"calculation_type": "cgt", ...}' | python .claude/hooks/validators/tax_calculation_validator.py
```

### 3.7 Commit or Fix
- ALL pass: commit with meaningful message, update plan.md status to `done`
- ANY fail: fix it. Run again. Do NOT move to next task.

### 3.8 Write Progress Entry
Append to `specs/progress-log.md`:

```markdown
## [ISO timestamp]
Phase: BUILD
Task: #3 (developer — Create CGT API route)
Status: done

### Evidence
$ pnpm test:run -- --grep "CGT" 2>&1
  v calculates CGT discount for 12+ month assets (15ms)
  v applies small business concessions (23ms)
  v rejects non-CGT assets (8ms)
  Tests  3 passed (46ms)

### Regression Check
Before: 47 passed, 0 failed
After: 50 passed, 0 failed (+3 tests, 0 regressions)

### Next Task
#4 (reviewer — Code review CGT)
```

**GATE:** Each task must have verification evidence before the next task begins.


## Phase 4: VALIDATE (Separate agent reviews ALL work.)

**Agent:** `tester` and `reviewer` specialists. NEVER the agent that built the code.

### 4.1 Clean Rebuild
```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
pnpm install
pnpm build 2>&1
```

### 4.2 Full Test Suite
```powershell
pnpm test:run 2>&1
pnpm test:coverage 2>&1 | Select-String "Statements|Branches|Functions|Lines"
```

### 4.3 Full Static Analysis
```powershell
pnpm lint 2>&1
npx tsc --noEmit 2>&1
```

### 4.4 Domain Validators
Run ALL validators against sample data. See `specs/quality-gates.md` for
the complete validator test matrix.

### 4.5 API Smoke Test
```powershell
# Start dev server
Start-Job { pnpm dev }
Start-Sleep -Seconds 10

# Test each endpoint (example)
curl.exe -s -w "`n%{http_code}" http://localhost:3000/api/health
curl.exe -s -w "`n%{http_code}" -X POST http://localhost:3000/api/analysis/rnd -H "Content-Type: application/json" -d '{\"tenantId\":\"test\"}'

# Stop dev server
Stop-Job *
```

### 4.6 Red Flag Scan
```powershell
# Code quality flags
Select-String -Path "lib/**/*.ts","app/**/*.ts" -Pattern "TODO|FIXME|HACK|console\.log" -Recurse
Select-String -Path "lib/**/*.ts","app/**/*.ts" -Pattern "ts-ignore|ts-expect-error|eslint-disable" -Recurse
Select-String -Path "tests/**/*.test.*" -Pattern "\.skip|xit|xdescribe" -Recurse

# Domain flags
Select-String -Path "lib/analysis/*.ts" -Pattern "mock|fake|dummy|hardcode" -Recurse
Select-String -Path "lib/analysis/*.ts" -Pattern "\bany\b" -Recurse
```

### 4.7 Write Verdict

Write `specs/validation-report.md`:

```markdown
# Validation Report
Date: [ISO timestamp]
Validator: [agent name]

## Quality Gates
| Gate | Command | Result | Evidence |
|------|---------|--------|----------|
| Tests | pnpm test:run | PASS/FAIL | [paste summary] |
| Coverage | pnpm test:coverage | XX% | [paste summary] |
| Lint | pnpm lint | PASS/FAIL | [paste summary] |
| Types | npx tsc --noEmit | PASS/FAIL | [paste summary] |
| Build | pnpm build | PASS/FAIL | [paste summary] |
| Validators | python validators | PASS/FAIL | [paste summary] |

## Red Flags
[count and list any findings]

## API Endpoints
| Endpoint | Method | Status | Response |
|----------|--------|--------|----------|

## Verdict: PASS / FAIL
[If FAIL: list every failure with file:line reference]
```

**GATE:** Work is not "done" unless validation-report shows PASS.


## Phase 5: FINALISE (Only after Phase 4 PASS)

1. Update `specs/progress-log.md` with final status
2. Commit all changes: `feat(scope): description`
3. Create Linear issue summary (if applicable)
4. Update `specs/plan.md` — all tasks marked `done`

Documentation updates only when explicitly requested. Do not auto-generate
README changes, HANDOVER.md, or API docs unless asked.
