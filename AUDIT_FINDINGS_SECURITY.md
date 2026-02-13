# Security & DevOps Audit Findings

**Auditor**: Security & DevOps Agent
**Date**: 2026-02-12
**Scope**: Full application security audit of C:/ATO/ato-app
**Cross-referenced**: CLAUDE.md section 12 compliance tracker (items B-1 through B-10 already fixed)

---

## Summary

- **Total findings**: 21
- **Critical**: 3 | **High**: 7 | **Medium**: 8 | **Low**: 3

Previously fixed items (B-1 through B-10) from the compliance tracker are NOT re-reported. All findings below are NEW or represent incomplete fixes.

---

## Critical Findings

### [SEC-001] OAuth Tokens Stored in Plaintext in Database

- **Severity**: Critical
- **OWASP Category**: A02:2021 - Cryptographic Failures
- **Files**:
  - `app/api/auth/xero/callback/route.ts:177-178`
  - `app/api/auth/quickbooks/callback/route.ts:127-130`
  - `app/api/auth/myob/callback/route.ts:193-204`
- **Description**: All three OAuth providers (Xero, QuickBooks, MYOB) store `access_token` and `refresh_token` as plaintext strings directly in the database. The `lib/crypto/token-encryption.ts` module exists and provides AES-256-GCM encryption, but it is **never imported or called** by any OAuth callback. A grep for `encryptToken` across the codebase finds it only in its own definition file and a documentation markdown. This means all OAuth tokens for every connected organization are sitting in plaintext in the `xero_connections`, `quickbooks_tokens`, and `myob_connections` tables.
- **Attack Scenario**: If the database is compromised (SQL injection, leaked service role key, Supabase admin panel breach, or backup theft), an attacker gains full read (and potentially write) access to every connected accounting system. For Xero, the tokens include `accounting.transactions.read` scope. For MYOB, the `access_token` grants API access to all company files.
- **Recommended Fix**: Wrap all token storage in `encryptToken()` and all token retrieval in `decryptToken()` from `lib/crypto/token-encryption.ts`. Ensure `TOKEN_ENCRYPTION_KEY` is set in production. Add a one-time migration script to encrypt existing plaintext tokens. The encryption module already handles salt-derived keys, so this is a straightforward integration.

### [SEC-002] Xero OAuth Connect Route Returns State in JSON Response Body

- **Severity**: Critical
- **OWASP Category**: A07:2021 - Identification and Authentication Failures
- **File**: `app/api/auth/xero/connect/route.ts:60-68`
- **Description**: The `/api/auth/xero/connect` endpoint returns the CSRF `state` parameter in the JSON response body (`{ authUrl, state, debug }`) to the client. The state is generated server-side with `crypto.randomUUID()` but never stored in an httpOnly cookie for validation. This is in contrast to the main `/api/auth/xero` route which correctly stores state in an httpOnly cookie. If the client uses this endpoint, the state is only available in JavaScript, vulnerable to XSS extraction.
- **Attack Scenario**: An XSS attack on the application could intercept the state parameter from the JSON response, then craft a malicious OAuth callback URL with the valid state. The callback route at `/api/auth/xero/callback:54` checks `storedState` from a cookie, but `/connect` never sets that cookie, meaning either: (a) the callback will always fail state validation for flows using `/connect`, or (b) a separate client-side storage mechanism exists that is less secure than httpOnly cookies.
- **Recommended Fix**: Either (a) remove the `/api/auth/xero/connect` route in favor of the main `/api/auth/xero` route which correctly uses httpOnly cookies, or (b) change `/connect` to redirect (not return JSON) and set the state in an httpOnly cookie, matching the pattern of `/api/auth/xero`.

### [SEC-003] Zero Rate Limiting on ANY API Route

- **Severity**: Critical
- **OWASP Category**: A04:2021 - Insecure Design
- **Files**: All files under `app/api/`
- **Description**: Despite having both in-memory (`lib/middleware/rate-limit.ts`) and distributed (`lib/middleware/distributed-rate-limit.ts`) rate limiting modules, a grep for `rateLimit` or `distributedRateLimit` across ALL route files under `app/api/` returns **zero matches**. Neither rate limiting middleware is imported or called by any route handler. The modules define rate limit configurations (`RATE_LIMITS`, `DISTRIBUTED_RATE_LIMITS`) but they are never consumed.
- **Attack Scenario**: Every API endpoint is vulnerable to brute force, credential stuffing, denial of service, and resource exhaustion. The share password endpoint (`/api/share/[token]`) is particularly critical -- without rate limiting, an attacker can make unlimited password guessing attempts. The AI analysis endpoints (`/api/audit/analyze`) are expensive operations (Gemini API calls) that can be abused to exhaust API quotas. The `logRateLimitExceeded` security event logger is called in `distributed-rate-limit.ts` but this code path is never reached.
- **Recommended Fix**: Add rate limiting to at minimum: (1) `/api/share/[token]` (POST) with `sharePassword` config, (2) all OAuth initiation routes with `oauth` config, (3) `/api/audit/analyze` and `/api/audit/analyze-chunk` with `analysis` config, (4) `/api/log-error` (unauthenticated) with strict limits, (5) `/api/health` with permissive limits. Use the existing `distributedRateLimit` function for security-critical endpoints and `rateLimit` for general protection.

---

## High Findings

### [SEC-004] Xero OAuth Route Has No Authentication Check

- **Severity**: High
- **OWASP Category**: A01:2021 - Broken Access Control
- **Files**:
  - `app/api/auth/xero/route.ts:11` (comment says "Single-user mode: No authentication required")
  - `app/api/auth/xero/connect/route.ts:9`
  - `app/api/auth/xero/logout-and-connect/route.ts:12`
- **Description**: The Xero OAuth initiation routes do not verify that the caller is an authenticated user before redirecting to Xero's authorization page. The comment explicitly states "Single-user mode: No authentication required" but the route has no auth check even when NOT in single-user mode. In contrast, both QuickBooks (`route.ts:22-29`) and MYOB (`authorize/route.ts:22-33`) correctly verify authentication before initiating OAuth.
- **Attack Scenario**: An unauthenticated attacker can initiate Xero OAuth flows, potentially connecting Xero organizations to the application without proper user association. While the callback does check `supabase.auth.getUser()`, it falls back to `userId = undefined` if no user is logged in (line 91-92), and the upsert still succeeds with NULL user_id.
- **Recommended Fix**: Add authentication check to `/api/auth/xero` and `/api/auth/xero/connect` matching the QuickBooks/MYOB pattern: verify `supabase.auth.getUser()` before redirecting. In single-user mode, skip the check as currently done in `requireAuth`.

### [SEC-005] Debug and Test Routes Deployed to Production

- **Severity**: High
- **OWASP Category**: A05:2021 - Security Misconfiguration
- **Files**:
  - `app/api/debug/xero/route.ts` (production check at line 5)
  - `app/api/auth/xero/debug/route.ts` (production check at line 11)
  - `app/api/test/xero-callback/route.ts` (production check at line 5)
  - `app/api/test/xero-auth/route.ts` (production check at line 5)
- **Description**: Four debug/test routes exist in the codebase. While each has a runtime `process.env.NODE_ENV === 'production'` check that returns 404, these routes are still deployed, routable, and visible in the build output. The `/api/debug/xero` route exposes the **full Xero client ID** and first 8 characters of the **client secret** (line 24, 28). The `/api/auth/xero/debug` route exposes the **full Supabase URL**, service role key **length**, and first 8 chars of both client ID and secret (lines 23-36). The `/api/test/xero-auth` route uses a **hardcoded state** (`'test123'` at line 18) with no CSRF protection. If `NODE_ENV` is misconfigured (set to `development` on a production server), these routes leak secrets.
- **Recommended Fix**: Delete all four debug/test route files. They provide no value in production and represent information disclosure risk. If debugging is needed, use dedicated logging or observability tools, not HTTP endpoints.

### [SEC-006] Log Error Endpoint is Unauthenticated and Unrate-Limited

- **Severity**: High
- **OWASP Category**: A04:2021 - Insecure Design
- **File**: `app/api/log-error/route.ts`
- **Description**: The `/api/log-error` POST endpoint accepts arbitrary JSON from any caller, logs it to `console.error`, and returns a success response. There is no authentication, no rate limiting, no input validation, and no size limit on the request body. The endpoint blindly calls `JSON.stringify(body, null, 2)` on user-controlled input.
- **Attack Scenario**: (1) **Log injection**: Attacker sends crafted JSON with newlines and control characters to pollute server logs and potentially confuse log aggregation tools. (2) **Denial of service**: Unlimited POST requests with large payloads exhaust logging bandwidth and disk/memory. (3) **Log forging**: Attacker injects fake error messages that appear to come from the application. (4) **PII harvesting**: If error messages contain user data (stack traces with emails/tokens), the endpoint surfaces them to console.error without sanitization.
- **Recommended Fix**: Add rate limiting (e.g., 20 requests per minute per IP), validate and truncate the request body (max 4KB), strip or escape control characters, and optionally require authentication or a CSRF token.

### [SEC-007] ABN Lookup Endpoint Has No Authentication

- **Severity**: High
- **OWASP Category**: A01:2021 - Broken Access Control
- **File**: `app/api/integrations/abn-lookup/route.ts:23-66`
- **Description**: Both POST and GET handlers for `/api/integrations/abn-lookup` accept requests without any authentication check. While ABN data is public via the Australian Business Register, the endpoint (1) may cache results in Supabase using the `tenantId` parameter (line 45), and (2) has no rate limiting, allowing unlimited ABR API abuse through the application as a proxy.
- **Attack Scenario**: An attacker uses the application as an open proxy to the ABR API for mass ABN lookups. If the ABR has its own rate limits, this could exhaust the application's allowance, blocking legitimate users. The `tenantId` parameter in the POST body is user-controlled and passed directly to the lookup function, potentially allowing cache poisoning.
- **Recommended Fix**: Add authentication check (at minimum `requireAuthOnly`). Add rate limiting. Validate the `tenantId` parameter against the authenticated user's accessible tenants.

### [SEC-008] Tax Rates Endpoint Allows Unauthenticated Cache Bypass

- **Severity**: High
- **OWASP Category**: A01:2021 - Broken Access Control
- **File**: `app/api/tax-data/rates/route.ts:10-13`
- **Description**: The `/api/tax-data/rates` GET endpoint requires no authentication and accepts a `?refresh=true` query parameter that triggers a fresh rate fetch from external APIs (Brave Search, Jina AI). This bypasses the 24-hour cache and forces expensive external API calls.
- **Attack Scenario**: An attacker repeatedly calls `/api/tax-data/rates?refresh=true` to exhaust the Brave Search API quota and Jina AI API quota, degrading service for all users. Since the endpoint is unauthenticated and unrate-limited, this is trivially exploitable.
- **Recommended Fix**: Require authentication for the `forceRefresh` path. Rate limit the endpoint, especially when `refresh=true`.

### [SEC-009] CSP Allows unsafe-eval on All Pages

- **Severity**: High
- **OWASP Category**: A05:2021 - Security Misconfiguration
- **File**: `next.config.ts:44`
- **Description**: The global Content Security Policy includes `script-src 'self' 'unsafe-inline' 'unsafe-eval'`. While `unsafe-inline` is sometimes necessary for Next.js/React hydration, `unsafe-eval` permits `eval()`, `Function()`, and `setTimeout(string)` execution in the browser. This significantly weakens XSS protections. The stricter CSP on `/share/*` pages correctly drops `unsafe-eval` (line 54), proving it is not required.
- **Attack Scenario**: If an XSS vulnerability is found anywhere in the application (e.g., unsanitized Xero supplier names rendered in the dashboard), `unsafe-eval` allows the attacker to execute arbitrary code using `eval()`, which many XSS payloads rely on.
- **Recommended Fix**: Remove `'unsafe-eval'` from the global CSP. If specific pages require it (e.g., development tools), use per-route CSP overrides. The `/share/*` CSP already demonstrates this is feasible.

### [SEC-010] Dev Encryption Key Fallback Uses Service Role Key

- **Severity**: High
- **OWASP Category**: A02:2021 - Cryptographic Failures
- **File**: `lib/crypto/token-encryption.ts:28-33`
- **Description**: When `TOKEN_ENCRYPTION_KEY` is not set and `NODE_ENV === 'development'`, the encryption module derives a key from `SUPABASE_SERVICE_ROLE_KEY` using `scryptSync(devSecret, 'ato-dev-salt', 32)`. The salt is hardcoded (`'ato-dev-salt'`). If any tokens encrypted in development are ever present in a production database (e.g., database migration from dev to prod), they can be decrypted by anyone who knows the service role key and the hardcoded salt.
- **Attack Scenario**: Developer encrypts tokens locally during development. Database is cloned or migrated to production. Attacker who obtains the service role key (e.g., from a leaked `.env` file) can derive the exact same encryption key and decrypt all tokens. Currently moot because SEC-001 shows tokens are not encrypted at all, but will become relevant once SEC-001 is fixed.
- **Recommended Fix**: Add a startup check in production that rejects any tokens encrypted with the dev key. Log a warning if dev-encrypted tokens are detected. Consider requiring `TOKEN_ENCRYPTION_KEY` even in development (just with a different value).

---

## Medium Findings

### [SEC-011] Alerts Cron GET Endpoint Discloses Internal Configuration

- **Severity**: Medium
- **OWASP Category**: A01:2021 - Broken Access Control
- **Files**:
  - `app/api/alerts/cron/route.ts:85-96`
  - `app/api/slack/daily-summary/route.ts:141-148`
- **Description**: Both the alerts cron and Slack daily summary endpoints expose a GET handler that returns internal scheduling configuration (job types, schedule descriptions) without any authentication. While the POST handlers correctly verify `CRON_SECRET`, the GET handlers are completely open.
- **Attack Scenario**: Attacker discovers the application has cron endpoints and their exact scheduling configuration, revealing operational details useful for timing attacks or understanding the system architecture.
- **Recommended Fix**: Either remove the GET handlers or require the `CRON_SECRET` for them as well.

### [SEC-012] Admin Role Check Not Applied in Single-User Mode

- **Severity**: Medium
- **OWASP Category**: A01:2021 - Broken Access Control
- **File**: `lib/middleware/admin-role.ts:61-133`
- **Description**: The `requireAdminRole()` function does not check `isSingleUserMode()`. In single-user mode, `supabase.auth.getUser()` returns no user (since there is no session), so admin routes will return 401. This is arguably safe (denies access), but inconsistent with how `requireAuth()` handles single-user mode (which grants access). If someone adds `isSingleUserMode()` to `requireAdminRole()` to "fix" the inconsistency, it would grant admin access to anyone in single-user mode.
- **Recommended Fix**: Add explicit documentation in `requireAdminRole` about its intentional behavior in single-user mode. Consider adding a guard comment: "DO NOT add isSingleUserMode() bypass here -- admin operations should always require authentication."

### [SEC-013] Activity Feed Does Not Scope to User's Organizations

- **Severity**: Medium
- **OWASP Category**: A01:2021 - Broken Access Control
- **File**: `app/api/activity/route.ts:39-56`
- **Description**: The GET handler authenticates the user but queries `organization_activity_log` without filtering by the user's accessible organizations. While RLS may provide some protection, the query uses `createServiceClient()` (line 18) which may bypass RLS depending on context. The POST handler correctly verifies organization access (lines 140-152), but the GET handler does not.
- **Attack Scenario**: An authenticated user could view activity logs from organizations they do not have access to by browsing `/api/activity` without an `organizationId` filter, or by providing an `organizationId` they should not access.
- **Recommended Fix**: Filter the GET query by the user's accessible organizations from `user_tenant_access`. Use the user-scoped Supabase client instead of the service client.

### [SEC-014] Xero Callback Stores Tokens with Service Client (RLS Bypass)

- **Severity**: Medium
- **OWASP Category**: A01:2021 - Broken Access Control
- **File**: `app/api/auth/xero/callback/route.ts:88`
- **Description**: The Xero callback uses `createServiceClient()` to store OAuth tokens, which bypasses RLS. While this is necessary because the callback may not have a user session, it means the upsert at line 171-192 is performed without RLS protections. Combined with SEC-004 (no auth check on Xero OAuth initiation), an unauthenticated user could trigger a callback that stores tokens without proper user association.
- **Recommended Fix**: Ensure the callback verifies the user session before storing tokens. If no user is authenticated, reject the callback. The QuickBooks callback correctly does this at lines 74-82.

### [SEC-015] Environment File Missing TOKEN_ENCRYPTION_KEY

- **Severity**: Medium
- **OWASP Category**: A05:2021 - Security Misconfiguration
- **File**: `.env.example`
- **Description**: The `.env.example` file does not include `TOKEN_ENCRYPTION_KEY` or `CRON_SECRET`. Developers setting up the project will not know these variables are needed. `TOKEN_ENCRYPTION_KEY` is required for token encryption (once SEC-001 is fixed), and `CRON_SECRET` is required for cron endpoint authentication.
- **Recommended Fix**: Add both variables to `.env.example`:
  ```
  # Token encryption key (generate with: openssl rand -hex 32)
  TOKEN_ENCRYPTION_KEY=

  # Cron job authentication secret (generate with: openssl rand -base64 32)
  CRON_SECRET=
  ```

### [SEC-016] Sensitive Debug Information in Non-Production Error Responses

- **Severity**: Medium
- **OWASP Category**: A05:2021 - Security Misconfiguration
- **File**: `app/api/auth/xero/callback/route.ts:264-291`
- **Description**: The Xero callback catch-all error handler returns detailed error information including `rawError` (full stack trace), `xeroDetails` (API response body), and error `type` when `NODE_ENV !== 'production'`. On Vercel preview deployments (which are NOT production but are publicly accessible), this leaks internal implementation details, Xero API error responses, and potentially partial token data from failed exchanges.
- **Attack Scenario**: Attacker triggers an OAuth error on a Vercel preview deployment and receives detailed server-side error information including stack traces and Xero API response bodies.
- **Recommended Fix**: Only expose detailed errors when `NODE_ENV === 'development'`, not when `!== 'production'`. Vercel previews use `NODE_ENV=production` by default, but this is fragile. Better: never return raw error details in HTTP responses; log them server-side and return an error reference ID.

### [SEC-017] MYOB Callback Stores UserId from Cookie Without Re-verification

- **Severity**: Medium
- **OWASP Category**: A07:2021 - Identification and Authentication Failures
- **File**: `app/api/auth/myob/callback/route.ts:56`
- **Description**: The MYOB callback extracts `userId` from the verified httpOnly cookie (`storedState.userId`) and uses it directly to store tokens (line 193) and grant tenant access (line 150, 178). However, it does not re-verify that this user ID corresponds to an active, authenticated session. The cookie was set 10 minutes ago during OAuth initiation -- the user could have been deactivated or had their session revoked since then.
- **Attack Scenario**: An admin deactivates a user's account. The user had already initiated an MYOB OAuth flow. The callback completes successfully because the cookie is still valid, granting the deactivated user access to a new organization.
- **Recommended Fix**: Re-verify the user session in the callback by calling `supabase.auth.getUser()`, matching the QuickBooks callback pattern (lines 74-82). Use the verified user ID from the fresh auth check, not the stale cookie value.

### [SEC-018] Share Token Endpoint Missing Rate Limiting for Password Brute Force

- **Severity**: Medium
- **OWASP Category**: A07:2021 - Identification and Authentication Failures
- **File**: `app/api/share/[token]/route.ts:199-216`
- **Description**: While the share endpoint correctly logs failed password attempts to the security event system (line 130), it does not enforce any rate limiting. The `DISTRIBUTED_RATE_LIMITS.sharePassword` configuration exists (5 attempts per 5 minutes) but is never applied. The `logShareBruteForce` call at line 130 records the event but does not prevent further attempts.
- **Attack Scenario**: An attacker discovers a valid share token (e.g., from a shared URL) and brute-forces the password with unlimited attempts. Bcrypt comparison adds some time cost but is not a substitute for rate limiting.
- **Recommended Fix**: Add `distributedRateLimit` check at the start of the POST handler using `DISTRIBUTED_RATE_LIMITS.sharePassword` config, keyed by IP + token combination.

---

## Low Findings

### [SEC-019] Token Truncation Shows 8 Characters

- **Severity**: Low
- **OWASP Category**: A09:2021 - Security Logging and Monitoring Failures
- **File**: `lib/crypto/token-encryption.ts:151-156`
- **Description**: `truncateTokenForLogging()` shows the first 8 characters of tokens. For some OAuth tokens (especially Xero), the first 8 characters may be predictable or constant (e.g., prefix strings). While the function is used for logging safety, showing 8 characters is more than necessary.
- **Recommended Fix**: Reduce to first 4 characters, or use `****` prefix with last 4 characters as is common practice.

### [SEC-020] reEncryptToken Mutates process.env

- **Severity**: Low
- **OWASP Category**: A04:2021 - Insecure Design
- **File**: `lib/crypto/token-encryption.ts:185-207`
- **Description**: The `reEncryptToken()` function temporarily mutates `process.env.TOKEN_ENCRYPTION_KEY` to perform key rotation. In a concurrent serverless environment, another request executing during the brief window between setting the old key and restoring the original could encrypt/decrypt with the wrong key, causing data corruption.
- **Recommended Fix**: Refactor to accept the key as a direct parameter to `encryptToken`/`decryptToken` rather than mutating the global environment variable. Alternatively, use a local scoped key derivation that does not touch `process.env`.

### [SEC-021] Health Endpoint Exposes Internal Configuration Details

- **Severity**: Low
- **OWASP Category**: A05:2021 - Security Misconfiguration
- **File**: `app/api/health/route.ts:43-139`
- **Description**: The health endpoint is unauthenticated and returns database connectivity status, AI model name, environment warnings (which may reveal missing API keys), and validation error messages. While health endpoints are commonly public, the level of detail exposed here is more than needed for uptime monitoring.
- **Recommended Fix**: Return only a simple status code (200/503) for unauthenticated requests. Require authentication for the detailed health check response. Alternatively, return only `{ status: "healthy" | "degraded" | "unhealthy" }` publicly and add an authenticated `/api/health/detailed` for full diagnostics.

---

## Dependency Audit

npm audit could not be run because `package-lock.json` is not present (only `bun.lockb` or `pnpm-lock.yaml` exists). The project appears to use pnpm or bun as its package manager.

**Recommendation**: Run `pnpm audit` or `bun audit` to check for known vulnerabilities. Generate a lockfile-compatible output for automated vulnerability scanning in CI/CD.

---

## RLS Policy Review

### Tables with RLS via `check_tenant_access()`

Based on `20260208_rls_standardize.sql`, the following tables have standardized RLS:
- `historical_transactions_cache`
- `forensic_analysis_results`
- `tax_recommendations`
- `ai_analysis_costs`

### Tables from `20260207_new_analysis_engines.sql`

The migration creates tables (`cgt_events`, `fbt_items`, `abn_lookup_cache`, `audit_risk_benchmarks`, `cashflow_forecasts`, `psi_analysis_results`) with `check_tenant_access()` RLS where appropriate and authenticated-only SELECT for public data tables.

### Potential Gaps

- `shared_reports`, `share_access_logs` -- accessed via service client in the share route; RLS not verified
- `organization_activity_log` -- queried with service client in `/api/activity` (SEC-013)
- `admin_audit_log` -- queried with service client (appropriate for admin use)
- `security_events`, `data_breaches` -- internal security tables; should have RLS restricting to service role only

---

## Summary Table

| ID | Severity | Category | Finding |
|----|----------|----------|---------|
| SEC-001 | Critical | Crypto | OAuth tokens stored in plaintext |
| SEC-002 | Critical | AuthN | Xero /connect returns CSRF state in JSON body |
| SEC-003 | Critical | Design | Zero rate limiting on any API route |
| SEC-004 | High | AuthZ | Xero OAuth routes have no auth check |
| SEC-005 | High | Config | Debug/test routes deployed to production |
| SEC-006 | High | Design | /log-error unauthenticated and unrate-limited |
| SEC-007 | High | AuthZ | ABN lookup has no authentication |
| SEC-008 | High | AuthZ | Tax rates endpoint allows unauth cache bypass |
| SEC-009 | High | Config | CSP allows unsafe-eval globally |
| SEC-010 | High | Crypto | Dev encryption uses service role key + hardcoded salt |
| SEC-011 | Medium | AuthZ | Cron GET endpoints disclose internal config |
| SEC-012 | Medium | AuthZ | Admin role check behavior in single-user mode |
| SEC-013 | Medium | AuthZ | Activity feed not scoped to user's orgs |
| SEC-014 | Medium | AuthZ | Xero callback stores tokens via RLS bypass |
| SEC-015 | Medium | Config | .env.example missing critical variables |
| SEC-016 | Medium | Config | Debug info in non-production error responses |
| SEC-017 | Medium | AuthN | MYOB callback uses stale userId from cookie |
| SEC-018 | Medium | AuthN | Share token missing rate limiting |
| SEC-019 | Low | Logging | Token truncation shows 8 chars |
| SEC-020 | Low | Design | reEncryptToken mutates process.env |
| SEC-021 | Low | Config | Health endpoint exposes internal details |
