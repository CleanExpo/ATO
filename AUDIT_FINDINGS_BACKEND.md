# Backend & Architecture Audit Findings

**Auditor**: Senior Architecture & Backend Auditor
**Date**: 2026-02-12
**Scope**: app/api/ (90+ routes), lib/analysis/ (16 engines), lib/ (core libraries)

## Summary

- **Total findings: 38**
- **Critical: 3 | High: 10 | Medium: 14 | Low: 11**

---

## Findings

### [ARCH-001] Duplicate `determineFY()` Utility — Violates AD-7

- **Severity**: Medium
- **Files**:
  - `app/api/analysis/fuel-tax-credits/route.ts:278`
  - `app/api/analysis/superannuation-caps/route.ts:174`
  - `app/api/analysis/trust-distributions/route.ts:274`
  - `lib/analysis/reanalysis-worker.ts:445`
- **Category**: Architecture
- **Description**: The `determineFY()` function is duplicated in 4 files instead of using the shared `lib/utils/financial-year.ts` utility. AD-7 mandates all date-based tax calculations use the shared financial-year module as a single source of truth.
- **Impact**: If the FY calculation logic needs updating (e.g., edge cases around midnight on June 30/July 1), changes must be made in 5 places instead of 1. Risk of drift between implementations.
- **Recommended Fix**: Replace all 4 inline `determineFY()` with `import { getCurrentFinancialYear } from '@/lib/utils/financial-year'` or add a `getFinancialYearFromDate(date)` export if one does not already exist.

---

### [ARCH-002] `/api/tax-data/rates` Has No Authentication

- **Severity**: Low
- **File**: `app/api/tax-data/rates/route.ts:10`
- **Category**: API
- **Description**: The GET endpoint for tax rates has no authentication check. While tax rates are public data, the `?refresh=true` parameter triggers a fresh scrape from ATO/Brave, which is an expensive operation that could be abused.
- **Impact**: An unauthenticated attacker could repeatedly call `?refresh=true` to exhaust the Brave API quota or cause excessive outbound requests.
- **Recommended Fix**: Add `requireAuthOnly()` or at minimum add rate limiting to the refresh path.

---

### [ARCH-003] `/api/log-error` Has No Authentication or Rate Limiting

- **Severity**: Medium
- **File**: `app/api/log-error/route.ts:3`
- **Category**: API / Security
- **Description**: The client error logging endpoint accepts any POST body with no authentication and no rate limiting. An attacker can flood server logs with arbitrary JSON.
- **Impact**: Log injection attacks. Could fill disk/log storage, make legitimate errors hard to find, or inject misleading entries. The `console.error('[CLIENT ERROR]', JSON.stringify(body, null, 2))` directly logs attacker-controlled content.
- **Recommended Fix**: Add rate limiting (e.g., 10 req/min per IP). Validate body has expected structure (message, stack, url). Truncate body to max 2KB. Consider requiring auth.

---

### [ARCH-004] `/api/slack/test` Has No Authentication

- **Severity**: High
- **File**: `app/api/slack/test/route.ts:12`
- **Category**: API / Security
- **Description**: The POST endpoint sends a test message to the Slack webhook with no authentication. Any external caller can trigger Slack messages. The GET endpoint also exposes the app URL.
- **Impact**: An attacker could spam the Slack channel with test messages, or use this as a signal to confirm the application is running.
- **Recommended Fix**: Add `requireAdminRole()` check to the POST handler.

---

### [ARCH-005] `select('*')` Used Extensively on Internal Routes

- **Severity**: Low
- **File**: Multiple routes (30+ occurrences, see grep results)
- **Category**: Code Quality / Performance
- **Description**: Many routes use `.select('*')` when fetching from Supabase. This over-fetches data and can leak column data that was not intended for the response.
- **Impact**: Performance degradation on large tables. Potential information leakage if new sensitive columns are added to tables. The share route was already fixed (B-4), but internal routes still use `select('*')`.
- **Recommended Fix**: Replace `select('*')` with explicit column lists on all routes. Priority on routes returning data to clients: `agents/reports`, `xero/transactions`, `audit/trends`, `audit/year-comparison`.

---

### [ARCH-006] Scenario Route Has Hardcoded Tax Rates Without Provenance

- **Severity**: High
- **File**: `app/api/strategies/scenario/route.ts:16-18`
- **Category**: Engine / Tax Accuracy
- **Description**: The scenario modeling endpoint hardcodes `CORPORATE_TAX_RATE = 0.25`, `STANDARD_TAX_RATE = 0.30`, and `RND_OFFSET_RATE = 0.435` as module-level constants with no financial year attribution, no provenance tracking, and no fallback mechanism. These rates are used for what-if calculations that users may rely on.
- **Impact**: Violates AD-5 (Tax Rate Provenance). When rates change, this route will silently produce incorrect projections. The base rate entity test at line 182 uses only turnover (`taxableIncome < 50_000_000`) without checking passive income percentage, repeating finding D-3.
- **Recommended Fix**: Use `getCurrentTaxRates()` from the rates cache. Add `taxRateSource` and `taxRateVerifiedAt` to the response. Apply the passive income test for base rate entity determination.

---

### [ARCH-007] `startOfDay`/`endOfDay` Mutation Bug in Daily Summary

- **Severity**: High
- **File**: `app/api/slack/daily-summary/route.ts:31-32`
- **Category**: API / Bug
- **Description**: `new Date(today.setHours(0, 0, 0, 0))` mutates `today` in place, then `new Date(today.setHours(23, 59, 59, 999))` operates on the already-mutated `today`. Because `setHours()` returns a timestamp and modifies the date object, `startOfDay` and `endOfDay` may not represent the same calendar day depending on timezone offset.
- **Impact**: The daily summary could include data from the wrong day, or miss data entirely, producing incorrect Slack reports.
- **Recommended Fix**: Create independent date objects: `const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);` and `const endOfDay = new Date(); endOfDay.setHours(23,59,59,999);`.

---

### [ARCH-008] Daily Summary Queries `auth.users` Table Directly

- **Severity**: Medium
- **File**: `app/api/slack/daily-summary/route.ts:36-37`
- **Category**: API / Bug
- **Description**: The daily summary attempts to query `auth.users` via `supabase.from('auth.users')`. Supabase does not expose the `auth.users` table through the PostgREST API — it is in a separate schema. This query will always fail silently, returning `null` for `totalUsers` and `newSignups`.
- **Impact**: Slack daily summary always shows `totalUsers: 0` and `newSignups: 0`, producing misleading metrics.
- **Recommended Fix**: Use `supabase.auth.admin.listUsers()` or query a `profiles` table that mirrors auth data.

---

### [ARCH-009] Admin `system-stats` Returns Hardcoded Health Values

- **Severity**: Medium
- **File**: `app/api/admin/system-stats/route.ts:69-73`
- **Category**: API / Code Quality
- **Description**: The `systemHealth` section always returns `{ database: 'Connected', ai_pipeline: 'Active', xero_api: 'Healthy', myob_api: 'Healthy' }` regardless of actual status. These are hardcoded strings, not actual health checks.
- **Impact**: Administrators receive a false sense of system health. If the AI pipeline is down (expired API key) or Xero API is unreachable, the dashboard still shows "Healthy".
- **Recommended Fix**: Either remove the fake health section or integrate actual health checks (call `/api/health` internally or check relevant services).

---

### [ARCH-010] `createClient` vs `createServiceClient` Inconsistency

- **Severity**: Medium
- **File**: Multiple routes
- **Category**: Architecture / Consistency
- **Description**: Routes use a mix of `createClient` (user-scoped, respects RLS) and `createServiceClient` (service role, bypasses RLS). Some routes that perform server-side operations use `createClient` when they should use `createServiceClient` or `createAdminClient`. For example:
  - `app/api/activity/route.ts` uses `createServiceClient` but then calls `supabase.auth.getUser()` — the service client does not carry user cookies, so this relies on the request having auth headers forwarded correctly.
  - `app/api/organizations/route.ts` uses `createClient` correctly for user-scoped operations.
  - `app/api/alerts/route.ts` and `app/api/alerts/[id]/route.ts` use `createClient`.
- **Impact**: Inconsistent auth patterns make it hard to reason about which routes respect RLS and which bypass it. Could lead to data access issues in certain deployment configurations.
- **Recommended Fix**: Standardise: routes needing user context should use `requireAuth()` + the auth result's `supabase` client. Routes doing server-side operations should use `createAdminClient()`. Document the pattern.

---

### [ARCH-011] Questionnaire Generation Route Missing Tenant Validation

- **Severity**: High
- **File**: `app/api/questionnaires/generate/route.ts:35-66`
- **Category**: API / Security
- **Description**: The route checks `supabase.auth.getUser()` for authentication, but does NOT validate that the authenticated user has access to the `tenantId` provided in the body. Any authenticated user can generate questionnaires for any tenant.
- **Impact**: IDOR vulnerability. An authenticated user could generate questionnaires targeting another user's tenant, potentially revealing information about their data gaps and tax positions.
- **Recommended Fix**: Replace the manual auth check with `requireAuth(request, { tenantIdSource: 'body' })` which validates both authentication and tenant access.

---

### [ARCH-012] Analysis Queue Status Route Missing Tenant Validation

- **Severity**: High
- **File**: `app/api/analysis/queue/status/route.ts:22-41`
- **Category**: API / Security
- **Description**: The route checks `supabase.auth.getUser()` for authentication but does not validate tenant access. The `tenantId` filter is optional, so by default it returns all queue jobs visible to the service client.
- **Impact**: Any authenticated user can view analysis queue jobs for all tenants, potentially leaking information about other customers' analysis activities.
- **Recommended Fix**: Use `requireAuth()` and filter results to only the user's accessible tenants.

---

### [ARCH-013] Test/Debug Routes Accessible in Non-Production

- **Severity**: Medium
- **File**:
  - `app/api/debug/xero/route.ts:4`
  - `app/api/test/xero-auth/route.ts:4`
  - `app/api/test/xero-callback/route.ts:4`
  - `app/api/auth/xero/debug/route.ts:11`
- **Category**: API / Security
- **Description**: These routes return 404 in production (good), but are fully accessible in any non-production deployment (staging, preview). They expose Xero Client IDs, secret lengths, redirect URIs, and in the case of `test/xero-callback`, they perform actual OAuth token exchanges.
- **Impact**: In Vercel preview deployments (which are NOT production), these routes expose sensitive configuration. The `test/xero-callback` route also has a hardcoded `redirectUri` to `localhost:3000` making it non-functional in preview environments anyway.
- **Recommended Fix**: Either (a) restrict these to `process.env.NODE_ENV === 'development'` only (not just not-production), or (b) add an additional check for a debug secret, or (c) remove them entirely and use separate debug scripts.

---

### [ARCH-014] `console.error` Used Instead of Structured Logger

- **Severity**: Low
- **File**: 50+ API routes and 15+ library files
- **Category**: Code Quality
- **Description**: Many routes use raw `console.error()` instead of the structured `createLogger()` utility from `lib/logger.ts`. The structured logger outputs JSON in production (for Vercel log parsing) and includes module context, timestamps, and structured metadata.
- **Impact**: Logs from routes using `console.error` will not be structured JSON in production, making them harder to search and correlate in Vercel's log viewer. Module attribution is lost.
- **Recommended Fix**: Gradually migrate all `console.error`/`console.warn` calls to use `createLogger('module:name')`. Priority on high-traffic routes like `audit/analyze`, `xero/transactions`, and `analysis/*`.

---

### [ARCH-015] Unused Import: `createValidationError` in Multiple Analysis Routes

- **Severity**: Low
- **File**:
  - `app/api/analysis/cgt/route.ts:19`
  - `app/api/analysis/fbt/route.ts:16`
  - `app/api/analysis/psi/route.ts:21`
  - `app/api/analysis/audit-risk/route.ts:19`
  - `app/api/analysis/payroll-tax/route.ts:21`
  - `app/api/analysis/cashflow-forecast/route.ts:26`
  - `app/api/analysis/payg-instalments/route.ts:24`
- **Category**: Code Quality
- **Description**: Seven analysis routes import `createValidationError` but never use it. These routes rely on `requireAuth` for tenant validation and pass body fields directly to engine functions without explicit validation.
- **Impact**: Dead imports increase bundle size marginally and signal incomplete input validation. These routes accept arbitrary body fields without Zod schema validation, unlike the `audit/analyze` route which uses `validateRequestBody`.
- **Recommended Fix**: Either remove the unused import, or add Zod schema validation for request bodies (preferred, for consistency with the audit routes).

---

### [ARCH-016] Double Body Parsing in Analysis Routes

- **Severity**: Medium
- **File**: All 7 new analysis routes (e.g., `app/api/analysis/cgt/route.ts:27-31`)
- **Category**: API / Bug
- **Description**: Each analysis route calls `requireAuth(request.clone() as NextRequest, { tenantIdSource: 'body' })` which reads the body once (to extract tenantId), then calls `const body = await request.json()` to read the body again. The `request.clone()` is necessary because `request.json()` can only be called once on a Request object. However, this means the body is parsed twice — once by `requireAuth` and once by the route handler.
- **Impact**: Minor performance overhead. More importantly, if `requireAuth` fails to parse the body (e.g., invalid JSON), it silently returns an empty tenantId instead of a validation error, because the catch block at line 74 of `require-auth.ts` swallows parsing errors.
- **Recommended Fix**: Use `validateRequestBody()` first (which handles JSON parsing errors), then pass the validated body to `requireAuth`. Or refactor `requireAuth` to accept a pre-parsed body.

---

### [ARCH-017] `reset-dashboard` Deletes Data Without Confirmation Token

- **Severity**: High
- **File**: `app/api/admin/reset-dashboard/route.ts:20`
- **Category**: API / Security
- **Description**: The destructive endpoint that wipes all connections, transactions, and analysis results requires only admin role authentication. There is no confirmation token, no "are you sure" challenge, and no dry-run mode.
- **Impact**: An admin's compromised session could be used to wipe all production data. The `.delete().neq('tenant_id', '')` pattern deletes ALL rows across all tenants.
- **Recommended Fix**: Add a required `confirmationCode` body parameter (e.g., must pass `"CONFIRM_RESET_ALL"`) or a time-limited confirmation token. Add a `dryRun` mode that shows what would be deleted.

---

### [ARCH-018] `admin/migrate` Route Exposes Raw SQL

- **Severity**: Medium
- **File**: `app/api/admin/migrate/route.ts:41-46`
- **Category**: API / Security
- **Description**: When columns don't exist, the route returns raw SQL DDL statements in the response body. While this is behind admin auth, exposing SQL schema modification commands in API responses is an anti-pattern.
- **Impact**: Information disclosure. Reveals table structure and column names to admin users via API response. If admin credentials are compromised, this aids further attacks.
- **Recommended Fix**: Return a descriptive message like "Migration required. Please run migration 20260207_analysis_columns.sql via Supabase Dashboard." without including the SQL.

---

### [ARCH-019] Activity Route Uses `createServiceClient` Without Proper Auth Flow

- **Severity**: Medium
- **File**: `app/api/activity/route.ts:20-29`
- **Category**: API / Architecture
- **Description**: The activity route uses `createServiceClient()` (service role) then calls `supabase.auth.getUser()` to check authentication. The service client's `getUser()` relies on the request having forwarded auth headers, which works in Next.js but is fragile. The route should use `requireAuth()` or `requireAuthOnly()` for consistency with the rest of the codebase.
- **Impact**: Inconsistent auth pattern. In `createServiceClient` context, `getUser()` may behave differently than expected. The POST handler also manually checks `user_tenant_access` instead of using the standard `requireAuth` with tenant validation.
- **Recommended Fix**: Refactor to use `requireAuth(request, { tenantIdSource: 'body' })` for POST and `requireAuthOnly(request)` for GET.

---

### [ARCH-020] Analysis Engine `console.error`/`console.warn` Leaks to Production Logs

- **Severity**: Low
- **File**: All 16 engines in `lib/analysis/` (24+ occurrences)
- **Category**: Code Quality
- **Description**: All analysis engines use raw `console.error` and `console.warn` for error logging instead of the structured logger. This is particularly problematic in engines that handle sensitive data (transaction amounts, supplier names).
- **Impact**: Unstructured log output in production. May inadvertently log sensitive data (the engines handle transaction details which could include PII before sanitisation).
- **Recommended Fix**: Replace all `console.error`/`console.warn` in engines with `createLogger('analysis:engine-name')`.

---

### [ARCH-021] No Rate Limiting on Analysis Engine API Routes

- **Severity**: High
- **File**: All 7 new analysis routes under `app/api/analysis/`
- **Category**: API / Security
- **Description**: None of the new analysis engine routes (CGT, FBT, PSI, audit-risk, payroll-tax, cashflow-forecast, PAYG-instalments) implement rate limiting. These routes perform database queries and potentially expensive calculations.
- **Impact**: An authenticated user could spam these endpoints, causing database load and potentially high compute costs. The `RATE_LIMITS.analysis` config exists but is not applied to these routes.
- **Recommended Fix**: Add rate limiting using `distributedRateLimit()` with `DISTRIBUTED_RATE_LIMITS.analysis` config to all analysis routes.

---

### [ARCH-022] Fuel Tax Credits Route Has Inline Business Logic (190+ Lines)

- **Severity**: Medium
- **File**: `app/api/analysis/fuel-tax-credits/route.ts:70-287`
- **Category**: Code Quality / Architecture
- **Description**: The fuel tax credits API route contains significant business logic inline — fuel supplier keyword matching, transaction filtering, fuel type classification, litres extraction, and FY determination. This should be in the engine layer (`lib/analysis/fuel-tax-credits-analyzer.ts`), not in the API route.
- **Impact**: Violates separation of concerns. The same filtering/classification logic cannot be reused by other consumers (e.g., the reanalysis worker). Testing requires HTTP-level integration tests rather than unit tests on the engine.
- **Recommended Fix**: Move `isFuelPurchase()`, `convertToFuelPurchase()`, and `determineFY()` into the fuel-tax-credits-analyzer or a shared utility. The API route should only handle auth, validation, and response formatting.

---

### [ARCH-023] Superannuation Caps Route Has Inline Business Logic (100+ Lines)

- **Severity**: Medium
- **File**: `app/api/analysis/superannuation-caps/route.ts:31-183`
- **Category**: Code Quality / Architecture
- **Description**: Same issue as ARCH-022. The route contains database queries, data transformation, and the `determineFY()` duplicate. The route should delegate to the engine.
- **Impact**: Same as ARCH-022: violates separation of concerns, prevents code reuse, complicates testing.
- **Recommended Fix**: Move data fetching and transformation into `lib/analysis/superannuation-cap-analyzer.ts`.

---

### [ARCH-024] Webhook Route Exposes Error Details in Response

- **Severity**: Low
- **File**: `app/api/webhooks/stripe/route.ts:88-93`
- **Category**: API / Security
- **Description**: The Stripe webhook error handler returns `error instanceof Error ? error.message : 'Internal server error'` in the response body. Stripe webhook responses should be minimal — Stripe only checks the status code.
- **Impact**: Error messages could leak implementation details to the Stripe retry mechanism (which logs response bodies).
- **Recommended Fix**: Return a generic `{ error: 'Processing failed' }` with status 500. Log the detailed error server-side only.

---

### [ARCH-025] Organization DELETE Does Not Cascade Cleanup

- **Severity**: Medium
- **File**: `app/api/organizations/[id]/route.ts:265-268`
- **Category**: API / Data Integrity
- **Description**: Organization soft-delete (`deleted_at` timestamp) does not clean up or invalidate related records: Xero connections, cached transactions, analysis results, recommendations, shared reports, or user_tenant_access entries. The GET handler at line 49 filters by `deleted_at IS NULL`, but other routes may still return data for soft-deleted organizations.
- **Impact**: Orphaned data. Users may still see data from deleted organizations. Xero tokens for deleted orgs continue to exist. Shared report links for deleted orgs may still work.
- **Recommended Fix**: Add a cascade check: revoke all shared links, mark Xero connections as inactive, and optionally remove user_tenant_access entries. Or at minimum, add `deleted_at IS NULL` filters to all organization-scoped queries.

---

### [ARCH-026] `admin/export-audit` Fetches All Logs Without Pagination

- **Severity**: Medium
- **File**: `app/api/admin/export-audit/route.ts:16-19`
- **Category**: API / Performance
- **Description**: The audit export route fetches ALL rows from `organization_activity_log` with no limit or pagination. As the application scales, this query could return millions of rows, causing memory exhaustion on the serverless function.
- **Impact**: Out-of-memory crashes on Vercel when the activity log grows large. Timeout errors for large datasets.
- **Recommended Fix**: Add date range filters (required start/end date params). Implement streaming CSV generation or chunked download. Set a reasonable row limit (e.g., 50,000).

---

### [ARCH-027] Missing `export const dynamic = 'force-dynamic'` on Some Routes

- **Severity**: Low
- **File**:
  - `app/api/activity/route.ts`
  - `app/api/agents/reports/route.ts`
  - `app/api/council/decisions/route.ts`
  - `app/api/organizations/route.ts`
  - `app/api/organizations/[id]/route.ts`
  - `app/api/strategies/scenario/route.ts`
- **Category**: Code Quality
- **Description**: Several routes that use Supabase server clients (which depend on request cookies/headers) are missing the `export const dynamic = 'force-dynamic'` directive. Next.js may attempt to statically render these at build time.
- **Impact**: Build failures or stale responses if Next.js caches the route response. Routes using `createClient` (cookie-dependent) are most affected.
- **Recommended Fix**: Add `export const dynamic = 'force-dynamic'` to all routes that read cookies, headers, or use Supabase auth.

---

### [ARCH-028] Council Decisions Route Does Not Validate Tenant Access

- **Severity**: High
- **File**: `app/api/council/decisions/route.ts:14-17`
- **Category**: API / Security
- **Description**: The route uses `requireAuthOnly()` (no tenant validation) but accepts an `organisationId` parameter. Any authenticated user can invoke council decisions for any organisation.
- **Impact**: IDOR vulnerability. Users could trigger expensive council orchestration for organisations they don't have access to.
- **Recommended Fix**: Use `requireAuth(request, { tenantIdSource: 'body', tenantIdParam: 'organisationId' })` to validate organisation access.

---

### [ARCH-029] `admin/system-stats` Loads All Recommendations Into Memory

- **Severity**: High
- **File**: `app/api/admin/system-stats/route.ts:31-38`
- **Category**: API / Performance
- **Description**: The route fetches ALL tax_recommendations rows with `supabase.from('tax_recommendations').select('estimated_benefit, adjusted_benefit')` (no limit), then reduces them in JavaScript. Similarly, ALL `ai_analysis_costs` rows are fetched.
- **Impact**: As the application scales, this will cause memory exhaustion. With thousands of recommendations per tenant across multiple tenants, this could be millions of rows loaded into a single serverless function.
- **Recommended Fix**: Use Supabase aggregate queries: `.select('estimated_benefit.sum(), adjusted_benefit.sum()')` or create a database view/function that returns pre-aggregated stats.

---

### [ARCH-030] Inconsistent Error Response Patterns

- **Severity**: Low
- **File**: Multiple routes
- **Category**: Code Quality / Consistency
- **Description**: Routes use 3 different error response patterns:
  1. `createErrorResponse()` from `lib/api/errors` (standardised, with errorId and sanitisation)
  2. `NextResponse.json({ error: '...' }, { status: N })` (ad-hoc, no errorId)
  3. `NextResponse.json({ error: error.message }, { status: 500 })` (leaks error details)

  Examples of pattern 2: `activity/route.ts`, `organizations/route.ts`, `agents/reports/route.ts`, `council/decisions/route.ts`.
  Examples of pattern 3: `strategies/scenario/route.ts:104`, `agents/reports/route.ts:31`.
- **Impact**: Inconsistent client experience. Some errors have `errorId` for support correlation, others don't. Some leak implementation details in production.
- **Recommended Fix**: Standardise all routes to use `createErrorResponse()`. Create a lint rule or code review checklist item.

---

### [ARCH-031] Engine Independence Verified (AD-1 Compliant)

- **Severity**: Info (Positive Finding)
- **File**: `lib/analysis/*.ts`
- **Category**: Architecture
- **Description**: Grep for `from '@/lib/analysis/` within `lib/analysis/` returned no results. All 16 engines are fully independent with no cross-engine imports. This confirms compliance with AD-1.
- **Impact**: N/A — this is a positive finding confirming good architecture.

---

### [ARCH-032] No `any` Types in Analysis Engines (Positive Finding)

- **Severity**: Info (Positive Finding)
- **File**: `lib/analysis/*.ts`
- **Category**: Code Quality
- **Description**: Grep for `: any` in the analysis directory returned no matches. The engines use proper TypeScript typing throughout.
- **Impact**: N/A — positive finding.

---

### [ARCH-033] FBT Engine Uses `console.warn` for Rate Fetch Failure

- **Severity**: Low
- **File**: `lib/analysis/fbt-engine.ts:173`
- **Category**: Code Quality
- **Description**: When live FBT rates cannot be fetched, the engine uses `console.warn` instead of the structured logger. This is consistent with other engines but should be upgraded.
- **Impact**: Rate fetch failures in production will produce unstructured log output, making it harder to monitor rate freshness.
- **Recommended Fix**: Use `createLogger('analysis:fbt-engine')`.

---

### [ARCH-034] Scenario Modeling Base Rate Entity Test Is Incomplete

- **Severity**: Critical
- **File**: `app/api/strategies/scenario/route.ts:182`
- **Category**: Engine / Tax Accuracy
- **Description**: The base rate entity determination uses only `taxableIncome < 50_000_000` (the turnover test). It does not check the passive income test (no more than 80% of assessable income is base rate entity passive income, per s 23AA ITAA 1997). This was already identified as finding D-3 in the compliance audit but has not been applied to the scenario route.
- **Impact**: A company with $40M turnover but 90% passive income would be modelled at 25% tax rate instead of the correct 30%. Scenario projections could show significantly wrong tax positions.
- **Recommended Fix**: Add passive income test. Accept `passiveIncomePercentage` as an optional parameter. Apply 30% rate when passive income > 80%.

---

### [ARCH-035] Scenario Modeling Uses Native Arithmetic for Money

- **Severity**: Critical
- **File**: `app/api/strategies/scenario/route.ts:160-199`
- **Category**: Engine / Tax Accuracy
- **Description**: The scenario engine uses native JavaScript `number` arithmetic for all monetary calculations (e.g., `taxableIncome * taxRate`, `base.netTaxPosition - newNetTaxPosition`). AD-2 mandates `Decimal.js` for all monetary arithmetic to avoid IEEE 754 floating-point errors.
- **Impact**: Floating-point rounding errors in tax calculations. While individual errors are small (fractions of a cent), accumulated errors across multiple adjustments could produce materially incorrect scenario comparisons.
- **Recommended Fix**: Wrap all monetary values in `new Decimal()` and use Decimal arithmetic. Return `.toNumber()` only for JSON serialisation.

---

### [ARCH-036] Scenario Route Reads Request Body Twice

- **Severity**: Low
- **File**: `app/api/strategies/scenario/route.ts:60-79`
- **Category**: API / Bug
- **Description**: In single-user mode, `tenantId` is read from `request.nextUrl.searchParams` (query string), but the scenario data comes from `request.json()` (body). This is inconsistent — the tenantId should come from the body like other analysis routes. In multi-user mode, `requireAuth(request)` reads the body to find tenantId (from query by default), but then `request.json()` is called again at line 79 on the original request. Since `requireAuth` uses the default `tenantIdSource: 'query'`, the body is not consumed, but this is fragile.
- **Impact**: In single-user mode, the tenantId from the URL could differ from the one in the body (which is validated by Zod at line 80), creating confusion.
- **Recommended Fix**: Consistently use body for tenantId: `requireAuth(request.clone(), { tenantIdSource: 'body' })`.

---

### [ARCH-037] `_devBypassAuth` Contains Emoji in Console Output

- **Severity**: Low
- **File**: `lib/auth/require-auth.ts:185`
- **Category**: Code Quality
- **Description**: The dev bypass function uses `console.warn('⚠️ DEV MODE: Authentication bypassed')`. While this function is not exported, the emoji in log output can cause encoding issues in some terminal/log environments.
- **Impact**: Minor. Only affects development mode.
- **Recommended Fix**: Replace with `console.warn('[DEV] Authentication bypassed')`.

---

### [ARCH-038] Missing `maxDuration` on Long-Running Analysis Routes

- **Severity**: Critical
- **File**: All 7 new analysis routes under `app/api/analysis/`
- **Category**: API / Deployment
- **Description**: The new analysis engine routes (CGT, FBT, PSI, etc.) do not set `maxDuration`. For Vercel's free tier, the default is 10 seconds; for Pro, it's 60 seconds. Complex analysis (e.g., CGT with Division 152 connected entity aggregation, or payroll tax with multi-state calculations) could exceed these limits. The existing `audit/analyze` and `audit/sync-historical` routes correctly set `maxDuration = 300`.
- **Impact**: Analysis requests may timeout on Vercel, returning 504 errors to users. The engines perform database queries + calculations that could take 10-30 seconds for large datasets.
- **Recommended Fix**: Add `export const maxDuration = 60` (or higher if needed) to all analysis routes. Monitor actual execution times and adjust.

---

## Cross-Reference with Compliance Tracker

The following items from CLAUDE.md Section 12 were verified as NOT re-reported (already fixed):

- B-1 through B-10: All security findings confirmed fixed
- T-1 (Family dealing exclusion): Confirmed fixed
- T-2 (Trustee penalty rate): Confirmed fixed
- R-3 (R&D clawback): Confirmed fixed
- 7A-3, 7A-4 (Amalgamated loans, safe harbour): Confirmed fixed
- L-2 (SBT evidence): Confirmed fixed
- A-12 (Distributable surplus cap): Confirmed fixed
- A-6/CR-1 (Connected entity aggregation): Confirmed fixed
- A-9/L-3 (Trust losses Div 266/267): Confirmed fixed
- P2-8 (NDB breach detection): Confirmed fixed
- F-1, F-2 (Fuel tax quarterly rates, road user charge): Confirmed fixed

---

## Priority Remediation Order

### Immediate (Before Next Deployment)

1. **ARCH-038** (Critical): Add `maxDuration` to analysis routes
2. **ARCH-035** (Critical): Use Decimal.js in scenario route
3. **ARCH-034** (Critical): Fix base rate entity test in scenario route
4. **ARCH-011** (High): Fix IDOR in questionnaire generation
5. **ARCH-012** (High): Fix IDOR in analysis queue status
6. **ARCH-028** (High): Fix IDOR in council decisions
7. **ARCH-004** (High): Add auth to Slack test endpoint

### Short-Term (Within 1 Week)

8. **ARCH-006** (High): Fix hardcoded rates in scenario route
9. **ARCH-007** (High): Fix date mutation bug in daily summary
10. **ARCH-017** (High): Add confirmation to reset-dashboard
11. **ARCH-021** (High): Add rate limiting to analysis routes
12. **ARCH-029** (High): Fix memory issue in admin stats

### Medium-Term (Within 2 Weeks)

13. **ARCH-001** (Medium): Consolidate duplicate `determineFY()`
14. **ARCH-003** (Medium): Secure log-error endpoint
15. **ARCH-008** (Medium): Fix auth.users query in daily summary
16. **ARCH-016** (Medium): Refactor double body parsing
17-26. Remaining Medium findings

### Long-Term (Within 1 Month)

27-38. Low-severity code quality improvements
