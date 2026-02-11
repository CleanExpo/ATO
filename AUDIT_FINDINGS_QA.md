# QA, Test Coverage & Product Flow Audit Findings

**Audited by:** QA Analyst Agent
**Date:** 2026-02-12
**Scope:** Full QA audit of C:/ATO/ato-app -- test coverage, product flow integrity, dead code, documentation accuracy, and configuration

---

## Summary

- **Total findings:** 32
- **Critical:** 3 | **High:** 10 | **Medium:** 13 | **Low:** 6
- **Test coverage:** 50 test files, 1,496 passed, 52 skipped (MYOB/QB sandbox), 0 failed
- **E2E tests:** 7 Playwright test files (excluded from vitest, require separate `pnpm test:e2e`)
- **Estimated engine coverage:** All 16 engines have unit tests; API route coverage is sparse

---

## Test Coverage Matrix

### Engine Unit Tests (All 16 Engines Covered)

| Engine | Test File | `it()` Count | Quality |
|--------|-----------|-------------|---------|
| deduction-engine | `tests/unit/analysis/deduction-engine.test.ts` | 35 | Good -- tests edge cases, fallbacks, amendment period |
| div7a-engine | `tests/unit/analysis/div7a-engine.test.ts` | 26 | Good -- distributable surplus, amalgamation |
| rnd-engine | `tests/unit/analysis/rnd-engine.test.ts` | 27 | Good -- tiered offset, clawback |
| loss-engine | `tests/unit/analysis/loss-engine.test.ts` | 15 | Good -- trust Division 266/267, SBT evidence |
| cgt-engine | `tests/unit/analysis/cgt-engine.test.ts` | 39 | Good -- connected entities, asset categories |
| fbt-engine | `tests/unit/analysis/fbt-engine.test.ts` | 36 | Good -- Type 1/2 gross-up |
| psi-engine | `tests/unit/analysis/psi-engine.test.ts` | 24 | Good -- 3-requirement results test |
| payg-instalment-engine | `tests/unit/analysis/payg-instalment-engine.test.ts` | 22 | Good |
| payroll-tax-engine | `tests/unit/analysis/payroll-tax-engine.test.ts` | 26 | Good |
| audit-risk-engine | `tests/unit/analysis/audit-risk-engine.test.ts` | 17 | Good |
| cashflow-forecast-engine | `tests/unit/analysis/cashflow-forecast-engine.test.ts` | 19 | Good |
| fuel-tax-credits-analyzer | `tests/unit/analysis/fuel-tax-credits-analyzer.test.ts` | 22 | Good -- quarterly rates |
| trust-distribution-analyzer | `tests/unit/analysis/trust-distribution-analyzer.test.ts` | 20 | Good -- s 100A family dealing |
| superannuation-cap-analyzer | `tests/unit/analysis/superannuation-cap-analyzer.test.ts` | 14 | Good |
| reconciliation-engine | `tests/unit/analysis/reconciliation-engine.test.ts` | 20 | Good |
| deduction-optimizer (legacy) | `tests/unit/analysis/deduction-optimizer.test.ts` | 39 | Good |

### Other Test Areas

| Area | Test File | `it()` Count | Quality |
|------|-----------|-------------|---------|
| Tax calculations | `tests/unit/tax-calculations.test.ts` | 23 | Good |
| Financial year utils | `tests/unit/utils/financial-year.test.ts` | 49 | Thorough |
| Financial calculations | `tests/unit/utils/financial-calculations.test.ts` | 44 | Good |
| Tax rate utilities | `tests/unit/utils/tax-rate-utilities.test.ts` | 49 | Good |
| Tax validators | `tests/unit/validators/tax-validators.test.ts` | 58 | Thorough |
| SBE checker | `tests/unit/calculators/sbe-checker.test.ts` | 5 | Minimal |
| Bad debt analyzer | `tests/unit/analysis/bad-debt-analyzer.test.ts` | 40 | Good |
| Division 7A (legacy) | `tests/unit/analysis/division7a-analyzer.test.ts` | 21 | Good |
| ABN lookup | `tests/unit/integrations/abn-lookup.test.ts` | 14 | Good |
| Security event logger | `tests/unit/security/security-event-logger.test.ts` | 67 | Thorough |
| Forensic findings mapper | `tests/unit/accountant/forensic-findings-mapper.test.ts` | 64 | Thorough |
| Accountant report gen | `tests/unit/accountant/accountant-report-generator.test.ts` | 21 | Good |
| Resend client | `tests/unit/email/resend-client.test.ts` | 15 | Good |

### Integration Tests

| Area | Test File | `it()` Count | Quality |
|------|-----------|-------------|---------|
| API: Organizations | `tests/integration/api/organizations.test.ts` | 45 | Good |
| API: Reports | `tests/integration/api/reports.test.ts` | 39 | Good |
| API: Transactions | `tests/integration/api/transactions.test.ts` | 42 | Good |
| API: Xero Sync | `tests/integration/api/xero-sync.test.ts` | 39 | Good |
| API: Xero Callback | `tests/integration/api/xero-callback.test.ts` | 32 | Good |
| API: Audit Analyze | `tests/integration/api/audit-analyze.test.ts` | 47 | Good |
| Xero Data Fetching | `tests/integration/xero/xero-data-fetching.test.ts` | 30 | Good |
| Gemini AI | `tests/integration/ai/gemini-integration.test.ts` | 25 | Good |
| Accountant Findings | `tests/integration/accountant/findings-api.test.ts` | 23 | Good |
| Consolidated Reports | `tests/reports/consolidated-report-generator.test.ts` | 14 | Good |
| Storage | `tests/storage/storage-integration.test.ts` | 21 | Good |

### Security Tests

| Area | Test File | `it()` Count | Quality |
|------|-----------|-------------|---------|
| Auth Security | `tests/security/auth-security.test.ts` | 56 | Thorough |
| API Security | `tests/security/api-security.test.ts` | 46 | Thorough |
| Admin Role | `tests/security/admin-role.test.ts` | 9 | Adequate |

### Performance Tests

| Area | Test File | `it()` Count | Quality |
|------|-----------|-------------|---------|
| API Performance | `tests/performance/api-performance.test.ts` | 50 | **FAKE** (see QA-001) |
| Database Performance | `tests/performance/database-performance.test.ts` | 28 | **FAKE** (see QA-001) |

### E2E Tests (Playwright -- excluded from Vitest)

| Area | Test File | Uses |
|------|-----------|------|
| OAuth Flow | `tests/e2e/oauth-flow.test.ts` | Playwright |
| Data Sync | `tests/e2e/data-sync-flow.test.ts` | Playwright |
| Forensic Analysis | `tests/e2e/forensic-analysis-flow.test.ts` | Playwright |
| Report Generation | `tests/e2e/report-generation-flow.test.ts` | Playwright |
| Multi-Org Workflow | `tests/e2e/multi-org-workflow.test.ts` | Playwright |
| Settings Workflow | `tests/e2e/settings-workflow.test.ts` | Playwright |
| MYOB Sandbox | `tests/integrations/myob/myob-sandbox.test.ts` | 32 skipped |
| QuickBooks Sandbox | `tests/integrations/quickbooks/quickbooks-sandbox.test.ts` | 20 skipped |

---

## Product Flow Status

| Journey | Steps | Status | Issues |
|---------|-------|--------|--------|
| New User Onboarding | Landing -> Login -> Connect Xero -> Sync -> Dashboard | Partial | Dead link to `/dashboard/notifications`; `/dashboard/organization/create` referenced but page missing |
| Data Analysis | Dashboard -> Select Org -> Run Audit -> View Progress -> Results | Works | E2E references `/dashboard/sync` which does not exist as a page |
| Report Generation | Audit Results -> Generate PDF/Excel -> Download -> Share | Works | No tests for `/api/reports/download-pdf`, `/api/reports/download-excel`, `/api/reports/amendment-schedules` |
| Tax Engine Analysis | R&D/Losses/CGT pages -> View analysis -> Export | Works | 12 analysis API routes have zero route-level integration tests |
| Accountant Workflow | Accountant page -> Generate report -> Export -> Share | Works | Accountant sub-pages are orphaned from main nav (only linked internally) |

---

## Findings

### [QA-001] Performance Tests Use setTimeout, Not Real APIs
- **Severity**: Critical
- **Files**: `tests/performance/api-performance.test.ts`, `tests/performance/database-performance.test.ts`
- **Category**: Test Coverage
- **Description**: All 78 performance tests use `setTimeout()` to simulate API and database latency. They test nothing real -- they verify that `Date.now()` correctly measures a hardcoded timer. Example: "should cache 1000 transactions within 10 seconds" just does `await new Promise(resolve => setTimeout(resolve, 5000))` and asserts the duration is less than 10,000ms.
- **Impact**: Zero actual performance regression detection. A 10x performance regression in any API would go unnoticed. The tests always pass regardless of real code changes.
- **Recommended Fix**: Replace with actual HTTP request tests against a local test server, or remove and replace with real benchmarks using `vitest.bench()`. At minimum, rename file to indicate these are placeholder stubs, not real performance tests.

### [QA-002] vitest.config.ts Claims "25,000 Tests" but Only 1,548 Exist
- **Severity**: Low
- **File**: `C:/ATO/ato-app/vitest.config.ts:14`
- **Category**: Documentation
- **Description**: Comment says "Parallel execution for 25,000 tests" but only 1,548 tests exist (1,496 passed + 52 skipped). This is misleading for anyone reading the config.
- **Impact**: Misleading. New developers may think the test suite is far more comprehensive than it actually is.
- **Recommended Fix**: Update comment to reflect actual test count, or remove the comment entirely.

### [QA-003] 12 Analysis API Routes Have Zero Route-Level Tests
- **Severity**: High
- **Files**: `app/api/analysis/{cgt,fbt,psi,payg-instalments,payroll-tax,audit-risk,cashflow-forecast,fuel-tax-credits,superannuation-caps,trust-distributions,queue/process,queue/status}/route.ts`
- **Category**: Test Coverage
- **Description**: While all 16 engines have thorough unit tests, NONE of the 12 analysis API route handlers have integration tests covering: authentication/authorization, input validation (tenantId parsing, body shape), HTTP status codes, error response format, or the wiring between route handler and engine.
- **Impact**: A broken import, auth check, or response serialisation in any route would not be caught by the test suite. The gap is between "engine works in isolation" and "API route correctly invokes engine and returns the result".
- **Recommended Fix**: Create `tests/integration/api/analysis-routes.test.ts` covering POST handler validation, auth checks, and response format for each route.

### [QA-004] Share System Has Zero Test Coverage
- **Severity**: High
- **Files**: `app/api/share/[token]/route.ts`, `app/api/share/[token]/feedback/route.ts`, `app/api/share/[token]/status/route.ts`, `app/api/share/[token]/documents/route.ts`
- **Category**: Test Coverage
- **Description**: The shared report system (4 API routes) has zero test coverage. This system handles password-protected sharing, file uploads, and feedback -- all security-sensitive operations. Multiple security fixes (B-1, B-3, B-4, B-5) were applied to these routes but none are validated by tests.
- **Impact**: Security regressions in share routes (password handling, file scanning, IP logging, scoped data access) would go undetected.
- **Recommended Fix**: Create `tests/integration/api/share-routes.test.ts` covering: token validation, password authentication flow (POST body per B-1), file upload scanning (B-3), scoped data access (B-4), IP extraction (B-5).

### [QA-005] Security Libraries Have No Dedicated Tests
- **Severity**: High
- **Files**: `lib/uploads/file-scanner.ts`, `lib/security/breach-detector.ts`, `lib/share/token-generator.ts`, `lib/crypto/token-encryption.ts`, `lib/middleware/distributed-rate-limit.ts`
- **Category**: Test Coverage
- **Description**: Five security-critical libraries have zero unit tests:
  - `file-scanner.ts`: Magic number validation, executable detection, double extension prevention
  - `breach-detector.ts`: Breach assessment, overdue detection, OAIC notification tracking
  - `token-generator.ts`: Rejection sampling for unbiased token generation
  - `token-encryption.ts`: AES-256-GCM encryption/decryption of OAuth tokens
  - `distributed-rate-limit.ts`: Supabase-backed atomic rate limiting
  The `security-event-logger.ts` HAS tests (67 assertions), but the other security modules do not.
- **Impact**: Security-critical code paths are untested. A regression in token encryption, file scanning, or rate limiting would go undetected.
- **Recommended Fix**: Create dedicated test files for each module. Token generator and file scanner are particularly testable in isolation.

### [QA-006] PII Sanitizer Has No Tests
- **Severity**: High
- **File**: `lib/ai/pii-sanitizer.ts`
- **Category**: Test Coverage
- **Description**: The PII sanitizer (supplier name anonymisation before Gemini API calls) is a compliance-critical component (APP 8 data minimisation) with zero tests. It performs regex-based replacement that could easily break with edge cases (supplier names containing special characters, empty strings, duplicates).
- **Impact**: Privacy compliance regression -- personal information could leak to Google Gemini if sanitisation breaks silently.
- **Recommended Fix**: Create `tests/unit/ai/pii-sanitizer.test.ts` covering: basic anonymisation, special character handling, duplicate suppliers, round-trip de-anonymisation, empty input handling.

### [QA-007] Checkout/Stripe Routes Have Zero Tests
- **Severity**: Medium
- **Files**: `app/api/checkout/create/route.ts`, `app/api/checkout/additional-organization/route.ts`, `app/api/webhooks/stripe/route.ts`
- **Category**: Test Coverage
- **Description**: Payment and subscription routes have no test coverage. Stripe webhook signature verification, checkout session creation, and additional organisation billing are all untested.
- **Impact**: Payment flow regressions or webhook signature validation bugs would go undetected. Financial transaction handling requires higher test confidence.
- **Recommended Fix**: Create `tests/integration/api/checkout.test.ts` with mocked Stripe client.

### [QA-008] Dead Link: /dashboard/notifications
- **Severity**: Medium
- **File**: `components/collaboration/NotificationBell.tsx:274`
- **Category**: Product Flow
- **Description**: The NotificationBell component links to `/dashboard/notifications` but this page does not exist (`app/dashboard/notifications/page.tsx` is missing). Clicking "View all notifications" in the UI results in a 404.
- **Impact**: Broken user experience -- users clicking "View all notifications" hit a dead end.
- **Recommended Fix**: Either create the notifications page or remove the link and display notifications inline.

### [QA-009] Dead Link: /dashboard/organization/create
- **Severity**: Medium
- **File**: `components/dashboard/ConsolidatedDashboard.tsx:351`
- **Category**: Product Flow
- **Description**: The ConsolidatedDashboard links to `/dashboard/organization/create` but this page does not exist. Users attempting to create a new organisation from the consolidated view hit a 404.
- **Impact**: Broken user flow when managing multiple organisations.
- **Recommended Fix**: Create the page or redirect to `/dashboard/connect`.

### [QA-010] E2E Tests Reference Non-Existent /dashboard/sync Route
- **Severity**: Medium
- **File**: `tests/e2e/data-sync-flow.test.ts:22`
- **Category**: Test Coverage
- **Description**: The data-sync-flow E2E test navigates to `/dashboard/sync` which does not exist as a page. The actual sync functionality is at `/dashboard/forensic-audit/historical`. All 9 tests in this file would fail if run.
- **Impact**: E2E test suite is broken for the data sync flow. Cannot validate the sync user journey.
- **Recommended Fix**: Update test to use `/dashboard/forensic-audit/historical` or create a redirect.

### [QA-011] 11 Screenshot PowerShell Scripts Are Temporary Debris
- **Severity**: Low
- **Files**: `scripts/screenshot.ps1` through `scripts/screenshot11.ps1` (602 lines total)
- **Category**: Dead Code
- **Description**: 11 numbered PowerShell screenshot scripts in the scripts directory. These are clearly temporary debugging artifacts (taking Windows screenshots at different viewport sizes). They add 602 lines of dead code.
- **Impact**: Clutters the scripts directory, confusing for new developers.
- **Recommended Fix**: Delete all `scripts/screenshot*.ps1` files.

### [QA-012] 11 Temporary .mjs Debugging Scripts
- **Severity**: Low
- **Files**: `scripts/check-db.mjs`, `scripts/check-db-state.mjs`, `scripts/check-columns.mjs`, `scripts/check-rls.mjs`, `scripts/check-rls2.mjs`, `scripts/debug-dashboard.mjs`, `scripts/fix-rpc.mjs`, `scripts/fix-rpc-direct.mjs`, `scripts/test-api.mjs`, `scripts/view-dashboard.mjs`, `scripts/view-dashboard2.mjs`
- **Category**: Dead Code
- **Description**: 11 `.mjs` scripts used for ad-hoc database debugging, RLS policy verification, and dashboard data inspection. Most contain hardcoded Supabase URLs and service role keys for direct API queries. These are one-time debugging tools that should not be in the repository.
- **Impact**: Potential credential exposure if service role keys are committed. Clutters scripts directory.
- **Recommended Fix**: Delete all temporary `.mjs` debugging scripts. If database inspection is needed, consolidate into a single documented utility script.

### [QA-013] CLAUDE.md Says "40 API Endpoints" -- Actual Count Is 160
- **Severity**: Medium
- **File**: `CLAUDE.md:95`
- **Category**: Documentation
- **Description**: CLAUDE.md states "40 API endpoints (audit, xero, reports)" in the Core Directories section, but the actual count is 160 `route.ts` files under `app/api/`. This 4x undercount is significantly misleading.
- **Impact**: New developers or AI agents reading CLAUDE.md will have a grossly underestimated view of the API surface area.
- **Recommended Fix**: Update to "160+ API endpoints" or remove the specific count.

### [QA-014] CLAUDE.md Uses Wrong Drive Path D:\ATO\
- **Severity**: Medium
- **File**: `CLAUDE.md:105`
- **Category**: Documentation
- **Description**: The Core Directories section references `D:\ATO\` as the root path, but the actual working directory is `C:\ATO\ato-app`. This was likely an earlier development machine path that was never updated.
- **Impact**: Any automated tooling or agent reading this path would look in the wrong location.
- **Recommended Fix**: Update to `C:\ATO\ato-app\` or use a relative path notation.

### [QA-015] CLAUDE.md Says "16 Specialised Agents" -- Actual Count Is 18
- **Severity**: Low
- **File**: `CLAUDE.md:73`
- **Category**: Documentation
- **Description**: CLAUDE.md mentions "16 specialised tax agents" but the `.agent/agents/` directory contains 18 agent definitions. The agent fleet section also lists only 8 agents in its table.
- **Impact**: Incomplete documentation of available agents.
- **Recommended Fix**: Update agent count and list all 18 agents in the table.

### [QA-016] Reanalysis Worker Has No Tests
- **Severity**: Medium
- **File**: `lib/analysis/reanalysis-worker.ts`
- **Category**: Test Coverage
- **Description**: The reanalysis worker (responsible for re-running analysis when tax rates change or data updates) has zero test coverage. This is a critical background processing module.
- **Impact**: Reanalysis regressions would go undetected. Rate change events could silently fail to trigger reanalysis.
- **Recommended Fix**: Create `tests/unit/analysis/reanalysis-worker.test.ts`.

### [QA-017] Data Quality Routes Have No Tests
- **Severity**: Medium
- **Files**: `app/api/data-quality/issues/route.ts`, `app/api/data-quality/scan/route.ts`, `app/api/data-quality/corrections/route.ts`
- **Category**: Test Coverage
- **Description**: Three data quality API routes have zero test coverage. These routes handle data quality scanning, issue identification, and correction application.
- **Impact**: Data quality regressions in scan logic or correction application would go undetected.
- **Recommended Fix**: Create `tests/integration/api/data-quality.test.ts`.

### [QA-018] Alert/Cron Routes Have No Tests
- **Severity**: Medium
- **Files**: `app/api/alerts/cron/route.ts`, `app/api/slack/daily-summary/route.ts`, `app/api/slack/test/route.ts`
- **Category**: Test Coverage
- **Description**: Automated alert and Slack notification routes have zero test coverage. The cron route is particularly important as it runs on a schedule.
- **Impact**: Silent failures in automated alerts or Slack integrations would go undetected.
- **Recommended Fix**: Create `tests/integration/api/alerts-cron.test.ts`.

### [QA-019] Council/Strategy Routes Have No Tests
- **Severity**: Low
- **Files**: `app/api/council/conversion/route.ts`, `app/api/council/decisions/route.ts`, `app/api/council/metrics/route.ts`, `app/api/strategies/scenario/route.ts`
- **Category**: Test Coverage
- **Description**: Design council and strategy scenario API routes have no test coverage.
- **Impact**: Low -- these appear to be internal tooling routes.
- **Recommended Fix**: Add basic smoke tests if these routes are used in production.

### [QA-020] Questionnaire Routes Have No Tests
- **Severity**: Medium
- **Files**: `app/api/questionnaires/generate/route.ts`, `app/api/questionnaires/[questionnaireId]/responses/route.ts`
- **Category**: Test Coverage
- **Description**: Questionnaire generation and response submission routes are untested.
- **Impact**: Client-facing questionnaire functionality could break without detection.
- **Recommended Fix**: Create `tests/integration/api/questionnaires.test.ts`.

### [QA-021] License Compliance Route Has No Tests
- **Severity**: Medium
- **File**: `app/api/license/check-compliance/route.ts`
- **Category**: Test Coverage
- **Description**: The license compliance check route is untested. This route validates user licensing status.
- **Impact**: License enforcement logic could silently break.
- **Recommended Fix**: Include in checkout/billing test suite.

### [QA-022] Orphaned Pages Not Linked from Navigation
- **Severity**: Medium
- **Files**: Multiple
- **Category**: Product Flow
- **Description**: The following pages exist as routable URLs but are NOT linked from the main VerticalNav or MobileNav navigation:
  - `/dashboard/overview` -- separate overview page (Dashboard link goes to `/dashboard`)
  - `/dashboard/audit` -- separate audit page (nav points to `/dashboard/forensic-audit`)
  - `/dashboard/alerts` and `/dashboard/alerts/preferences` -- alert management
  - `/dashboard/team` -- team management
  - `/dashboard/reports/consolidated` -- consolidated reports
  - `/dashboard/agent-monitor` -- agent monitoring dashboard
  These pages are only discoverable through deep links or internal component references.
- **Impact**: Users cannot discover these features through normal navigation. The `/dashboard/alerts` and `/dashboard/team` pages in particular seem like they should be accessible.
- **Recommended Fix**: Add `/dashboard/alerts` to nav or merge into Settings. Consider whether `/dashboard/overview` and `/dashboard/audit` should redirect to their canonical paths. Link `/dashboard/team` from the Settings page.

### [QA-023] Puppeteer in devDependencies -- Only Used by One Script
- **Severity**: Low
- **Files**: `package.json:92,75`
- **Category**: Configuration
- **Description**: Both `puppeteer` and `@types/puppeteer` are in devDependencies (combined ~400MB download), but Puppeteer is only used by `scripts/generate-pdf-report.js`. The project uses Playwright for E2E testing. Having both browser automation tools is redundant and increases install time.
- **Impact**: Bloated `node_modules`, longer CI install times.
- **Recommended Fix**: Migrate the PDF report script to use Playwright (already installed) or `md-to-pdf` (already in devDeps), then remove `puppeteer` and `@types/puppeteer`.

### [QA-024] Commented-Out Import in Consolidated Report Generator
- **Severity**: Low
- **File**: `lib/reports/consolidated-report-generator.ts:19`
- **Category**: Dead Code
- **Description**: Commented-out import: `// import { createServiceClient } from '@/lib/supabase/server';`. If the import is not needed, the comment should be removed.
- **Impact**: Minor code clutter.
- **Recommended Fix**: Remove the commented-out import line.

### [QA-025] TODO Comments Are Properly Tracked
- **Severity**: Low (Informational)
- **Files**: Various
- **Category**: Technical Debt
- **Description**: 6 TODO comments found in the codebase, all marked with `TODO(tracked)`:
  - `lib/linear/graphql-queries.ts:373` -- Label fetching/creation
  - `app/api/auth/myob/callback/route.ts:116` -- Company file selection UI
  - `app/api/organizations/[id]/members/route.ts:90` -- Last activity tracking
  - `app/api/slack/daily-summary/route.ts:108,113` -- Revenue and error tracking integration
  - `app/dashboard/page.tsx:772` -- Group ID from API
  All are annotated as "tracked" indicating they are in the backlog.
- **Impact**: None -- properly tracked.
- **Recommended Fix**: No immediate action needed. Ensure Linear issues exist for each tracked TODO.

### [QA-026] No Component-Level Tests (React Testing Library)
- **Severity**: High
- **Category**: Test Coverage
- **Description**: Despite `@testing-library/react` being in devDependencies, there are ZERO React component tests in the entire test suite. No test files import from `@testing-library/react`. All 50 test files test backend logic (engines, APIs, security, utilities). The frontend (50+ pages, 100+ components) has zero automated test coverage.
- **Impact**: UI regressions, broken component rendering, incorrect data display, accessibility issues, and interaction bugs are all undetectable by the test suite. The only frontend testing comes from Playwright E2E tests, which reference non-existent pages (see QA-010).
- **Recommended Fix**: Prioritise component tests for critical UI paths:
  1. `TaxDisclaimer` component (compliance-critical display)
  2. Dashboard metric cards (correct data rendering)
  3. Organisation switcher (state management)
  4. Share report viewer (password flow, data display)
  5. Chart accessibility wrappers

### [QA-027] E2E Tests Import from @playwright/test but Are Excluded from Vitest
- **Severity**: Medium
- **Category**: Configuration
- **Description**: The vitest.config.ts explicitly excludes `tests/e2e/**` (line 12). This is correct because E2E tests use Playwright, not Vitest. However, the E2E tests have not been validated against the current application state. The `data-sync-flow.test.ts` references `/dashboard/sync` which doesn't exist. Other E2E tests reference `data-testid` attributes that may not exist in current components.
- **Impact**: The E2E test suite may be substantially broken without anyone knowing, since it requires a running server and manual invocation via `pnpm test:e2e`.
- **Recommended Fix**: Run `pnpm test:e2e` against the current application and fix all broken selectors and routes. Add E2E test execution to CI pipeline.

### [QA-028] Coverage Thresholds Set but Never Run in CI
- **Severity**: High
- **File**: `vitest.config.ts:42-48`
- **Category**: Configuration
- **Description**: Coverage thresholds are configured (lines: 85%, functions: 85%, branches: 80%, statements: 85%) but there is no evidence of coverage being enforced in CI. The `pnpm test:run` command does NOT include `--coverage`. The `pnpm test:coverage` script exists but is not referenced in any CI configuration. Given that many critical modules lack tests (see QA-003 through QA-006), the actual coverage is likely well below the 85% threshold.
- **Impact**: The coverage thresholds are aspirational but unenforced. They provide false confidence about test quality.
- **Recommended Fix**: Either enforce coverage in CI via `pnpm test:coverage` with threshold failure, or lower thresholds to realistic levels and incrementally increase them.

### [QA-029] MYOB/QuickBooks Sandbox Tests Skip 52 Tests
- **Severity**: Low
- **Files**: `tests/integrations/myob/myob-sandbox.test.ts`, `tests/integrations/quickbooks/quickbooks-sandbox.test.ts`
- **Category**: Test Coverage
- **Description**: 52 tests are skipped (32 MYOB + 20 QuickBooks) via `describe.skipIf(skipTests)` which checks for sandbox credentials. These tests can only run with live sandbox API keys.
- **Impact**: MYOB and QuickBooks integrations have tests but they never run without sandbox credentials. Integration regressions would go undetected.
- **Recommended Fix**: Either provide sandbox credentials in CI secrets, or create mock-based versions of these tests that can run without credentials.

### [QA-030] Admin Export and Migration Routes Have No Tests
- **Severity**: Medium
- **Files**: `app/api/admin/export-audit/route.ts`, `app/api/admin/migrate/route.ts`, `app/api/admin/reset-dashboard/route.ts`, `app/api/admin/system-stats/route.ts`
- **Category**: Test Coverage
- **Description**: Admin routes for audit export, data migration, dashboard reset, and system stats have no test coverage. The `admin/accountant-applications` route has tests (14 assertions), but the other admin routes do not.
- **Impact**: Admin operations could break silently. The `reset-dashboard` route is particularly concerning as it could cause data loss.
- **Recommended Fix**: Create `tests/integration/api/admin-routes.test.ts`.

### [QA-031] Report Download Routes Have No Tests
- **Severity**: High
- **Files**: `app/api/reports/download-pdf/route.ts`, `app/api/reports/download-excel/route.ts`, `app/api/reports/amendment-schedules/route.ts`, `app/api/reports/consolidated/download/route.ts`, `app/api/reports/consolidated/generate/route.ts`, `app/api/audit/reports/download/[reportId]/route.ts`, `app/api/audit/reports/generate/route.ts`, `app/api/audit/reports/list/route.ts`
- **Category**: Test Coverage
- **Description**: 8 report generation and download routes have zero test coverage. These are user-facing, business-critical endpoints that generate PDFs, Excel files, and amendment schedules.
- **Impact**: Report generation regressions (incorrect calculations, broken formatting, missing data) would not be detected. Given that reports are a primary deliverable of the platform, this is a significant gap.
- **Recommended Fix**: Create `tests/integration/api/report-routes.test.ts` covering generation, content validation, and download format checks.

### [QA-032] COMPLIANCE_RISK_ASSESSMENT.md Tracker May Be Stale
- **Severity**: Medium
- **File**: `COMPLIANCE_RISK_ASSESSMENT.md`
- **Category**: Documentation
- **Description**: The compliance risk assessment was authored on 2026-02-07 with updates through 2026-02-08. The "Risk 3: FBT Engine Systemic Miscalculation" is listed in the executive summary heat map as "HIGH" with "CERTAIN" likelihood, but per CLAUDE.md section 12, the FBT rate assignment bug was FIXED on 2026-02-07. The heat map has not been updated to reflect the fix. Similarly, Risk 2 lists TaxDisclaimer at 10px, but this was fixed to 12px on 2026-02-07.
- **Impact**: Readers of the compliance assessment may believe critical risks remain unfixed when they have already been remediated. This causes confusion during audit reviews.
- **Recommended Fix**: Update the executive summary heat map and risk descriptions to reflect current remediation status. Add a "Last Reviewed" date.

---

## Test Coverage Gap Summary

### API Routes WITHOUT Tests (47 untested route files)

**Critical (Business Logic):**
- All 12 `app/api/analysis/*/route.ts` routes
- All 4 `app/api/share/[token]/*/route.ts` routes
- All 8 `app/api/reports/*/route.ts` and `app/api/audit/reports/*/route.ts` routes

**High (Financial/Security):**
- `app/api/checkout/create/route.ts`
- `app/api/checkout/additional-organization/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/api/license/check-compliance/route.ts`

**Medium (Operational):**
- `app/api/data-quality/{issues,scan,corrections}/route.ts`
- `app/api/alerts/cron/route.ts`
- `app/api/admin/{export-audit,migrate,reset-dashboard,system-stats}/route.ts`
- `app/api/questionnaires/{generate,[id]/responses}/route.ts`
- `app/api/slack/{daily-summary,test}/route.ts`

**Low (Internal):**
- `app/api/council/{conversion,decisions,metrics}/route.ts`
- `app/api/strategies/scenario/route.ts`
- `app/api/agents/reports/route.ts`

### Libraries WITHOUT Tests

| Library | Risk | Notes |
|---------|------|-------|
| `lib/uploads/file-scanner.ts` | High | Security: magic number validation, executable detection |
| `lib/security/breach-detector.ts` | High | NDB compliance: breach assessment workflow |
| `lib/share/token-generator.ts` | High | Security: rejection sampling token generation |
| `lib/crypto/token-encryption.ts` | High | Security: AES-256-GCM OAuth token encryption |
| `lib/middleware/distributed-rate-limit.ts` | High | Security: Supabase-backed rate limiting |
| `lib/ai/pii-sanitizer.ts` | High | Privacy: APP 8 data minimisation |
| `lib/analysis/reanalysis-worker.ts` | Medium | Background processing: rate-change reanalysis |

---

## Configuration Issues

1. **vitest.config.ts line 14**: Comment "Parallel execution for 25,000 tests" is 16x overstated (actual: 1,548)
2. **vitest.config.ts coverage thresholds**: Set to 85%/80% but never enforced in CI
3. **package.json**: `puppeteer` + `@types/puppeteer` in devDeps but only used by one utility script; Playwright handles E2E
4. **tsconfig.json**: `scripts` is excluded from TypeScript compilation -- 40+ `.ts` scripts in `scripts/` are not type-checked
5. **playwright.config.ts**: `webServer.command` uses `npm run dev` instead of `pnpm dev` (inconsistent with project package manager)

---

## Scripts Directory Cleanup Candidates

| Category | Files | Count | Action |
|----------|-------|-------|--------|
| Screenshot debug | `screenshot*.ps1` | 11 | Delete |
| DB debugging | `check-db*.mjs`, `check-columns.mjs`, `check-rls*.mjs` | 5 | Delete or consolidate |
| RPC debugging | `fix-rpc*.mjs` | 2 | Delete |
| Dashboard debugging | `debug-dashboard.mjs`, `view-dashboard*.mjs` | 3 | Delete |
| API testing | `test-api.mjs` | 1 | Delete |
| Migration one-offs | `apply-migration-020.js`, `apply-migration-021*.js` | 3 | Delete |
| **Total cleanup** | | **25 files** | |
