# Quality Gates — ATO Platform
# Specific verification commands and pass/fail criteria

---

## Quick Reference

Run all gates in sequence:
```powershell
pnpm test:run 2>&1; pnpm lint 2>&1; npx tsc --noEmit 2>&1; pnpm build 2>&1
```

---

## Gate 1: Tests

**Command:** `pnpm test:run`
**Pass:** 0 failed, total count >= previous count
**Fail:** Any failure, or test count decreased

Targeted runs:
```powershell
pnpm test:unit                  # Unit tests only
pnpm test:integration           # Integration tests only
pnpm test:run -- --grep "rnd"   # Specific feature
```

## Gate 2: Coverage

**Command:** `pnpm test:coverage`
**Pass:** >= 85% statements, >= 85% functions, >= 85% lines, >= 80% branches
**Fail:** Below thresholds (configured in vitest.config.ts)

## Gate 3: Lint

**Command:** `pnpm lint`
**Pass:** 0 errors (warnings acceptable)
**Fail:** Any error

## Gate 4: Types

**Command:** `npx tsc --noEmit`
**Pass:** 0 errors
**Fail:** Any error

**Known patterns requiring attention:**
- Xero SDK enum mismatches — see exception-registry.md `XERO-SDK-CAST`
- Supabase client async — every `createServiceClient()` needs `await`
- Next.js 16 route params — must be `Promise<{ id: string }>`

## Gate 5: Build

**Command:** `pnpm build`
**Pass:** "Ready" or success message in output
**Fail:** Any build error

**Common build failures:**
- Missing `export const dynamic = 'force-dynamic'` on pages using Supabase server client
- Missing `'use client'` on pages with onClick handlers
- Import paths breaking — use `@/` aliases

## Gate 6: Domain Validators

**Commands:**

| Validator | Test Command | When |
|---|---|---|
| Tax Calculation | `echo '{"calculation_type":"rnd","eligible_expenditure":100000,"rnd_offset":43500}' \| python .claude/hooks/validators/tax_calculation_validator.py` | After changes to `lib/analysis/` |
| Financial Year | `echo '{"financial_year":"FY2024-25","start":"2024-07-01","end":"2025-06-30"}' \| python .claude/hooks/validators/financial_year_validator.py` | After date logic changes |
| Division 7A | `echo '{"loan_amount":100000,"benchmark_rate":0.0877,"term":7}' \| python .claude/hooks/validators/div7a_validator.py` | After Div 7A engine changes |
| R&D Eligibility | `echo '{"activities":[{"description":"test","core":true}],"entity_turnover":5000000}' \| python .claude/hooks/validators/rnd_eligibility_validator.py` | After R&D engine changes |
| Deduction | `echo '{"deductions":[{"type":"general","amount":5000,"section":"8-1"}]}' \| python .claude/hooks/validators/deduction_validator.py` | After deduction engine changes |
| Loss | `echo '{"losses":[{"year":"FY2023-24","amount":50000,"test":"COT"}]}' \| python .claude/hooks/validators/loss_validator.py` | After loss engine changes |
| Xero Data | `echo '{"contacts":[{"name":"Test","status":"ACTIVE"}]}' \| python .claude/hooks/validators/xero_data_validator.py` | After Xero integration changes |

**Pass:** Exit code 0, "Validation PASSED" in output
**Fail:** Exit code 1, issues listed in output

## Gate 7: API Smoke Test

Only run when API routes are modified.

```powershell
# Health check
curl.exe -s -w "`n%{http_code}" http://localhost:3000/api/health

# Analysis endpoints (require running dev server + auth)
curl.exe -s -w "`n%{http_code}" -X POST http://localhost:3000/api/analysis/rnd ^
  -H "Content-Type: application/json" ^
  -d "{\"tenantId\":\"test-tenant\"}"
```

**Pass:** Expected HTTP status codes (200, 400 for validation errors, 401 for unauthed)
**Fail:** 500 errors, connection refused, unexpected response shape

---

## Red Flag Scan

Run after all other gates pass:

```powershell
# Code quality
Select-String -Path "lib\**\*.ts","app\**\*.ts" -Pattern "TODO|FIXME|HACK" -Recurse | Measure-Object
Select-String -Path "lib\**\*.ts","app\**\*.ts" -Pattern "console\.log" -Recurse | Measure-Object
Select-String -Path "lib\**\*.ts","app\**\*.ts" -Pattern "ts-ignore|ts-expect-error" -Recurse | Measure-Object
Select-String -Path "tests\**\*.test.*" -Pattern "\.skip|\.only|xit|xdescribe" -Recurse | Measure-Object

# Domain safety
Select-String -Path "lib\analysis\*.ts" -Pattern "\bany\b" -Recurse | Measure-Object
Select-String -Path "lib\analysis\*.ts" -Pattern "mock|fake|dummy" -Recurse | Measure-Object
Select-String -Path "lib\**\*.ts" -Pattern "password|secret|key.*=.*['\"]" -Recurse | Measure-Object
```

**Threshold:** Document all findings. New red flags introduced by the current work = FAIL.
Pre-existing red flags are acceptable but must be noted.

---

## Regression Template

Copy this into progress-log.md entries:

```markdown
### Regression Check
Before: [X] passed, [Y] failed, [Z] type errors, [W] lint errors
After:  [X] passed, [Y] failed, [Z] type errors, [W] lint errors
Delta:  [+/-N tests, +/-N type errors, +/-N lint errors]
Verdict: CLEAN / REGRESSION
```
