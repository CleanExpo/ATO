# Linear Issues - Prioritized Bug and Issue List

**Generated:** 2026-01-30
**Source:** Comprehensive system testing by 4 specialized agents
**Context:** Database schema fixed (organization_id column added), ready for production testing

---

## 🔴 CRITICAL - Blocking Production Use

### Issue 1: OAuth Connections Not Persisting to Database
**Priority:** P0 - CRITICAL BLOCKER
**Status:** ✅ FIXED - Ready for verification
**Labels:** bug, database, oauth, blocking

**Description:**
OAuth callback completes successfully and redirects to `?connected=true`, but no data is saved to database. Users see empty state after "successful" connection.

**Root Cause:**
Callback code at `app/api/auth/xero/callback/route.ts:162` was trying to insert `organization_id` column that didn't exist in `xero_connections` table schema.

**Fix Applied:**
- Created migration `020_add_organization_id_to_xero_connections.sql`
- Column `organization_id UUID` added with foreign key to `organizations(id)`
- Index created for performance
- Migration verified applied to production database

**Verification Steps:**
1. User must retry connecting all 3 Xero accounts
2. Check `xero_connections` table has records
3. Check `organizations` table has matching records
4. Verify `organization_id` foreign keys are populated

**Files Changed:**
- `supabase/migrations/020_add_organization_id_to_xero_connections.sql` (created)
- `app/api/auth/xero/callback/route.ts:162` (uses organization_id)

---

### Issue 2: Single-User Mode Not Respected in Auth Middleware
**Priority:** P0 - CRITICAL BLOCKER
**Status:** ✅ FIXED
**Labels:** bug, authentication, single-user-mode

**Description:**
All protected API endpoints returned 401 errors even when `SINGLE_USER_MODE=true` was set in environment variables. This prevented dashboard from loading organization data.

**Root Cause:**
`lib/auth/middleware.ts` didn't check `SINGLE_USER_MODE` environment variable, forcing authentication even in single-user deployments.

**Fix Applied:**
- Added `SINGLE_USER_MODE` check at start of `authMiddleware` function (lines 75-88)
- Returns mock user `{id: 'single-user', email: 'single-user@local', role: 'owner'}` when enabled
- Uses service client instead of user-specific auth

**Files Changed:**
- `lib/auth/middleware.ts:75-88` (commit 70e707a)

---

### Issue 3: Hardcoded Single-User Mode Flag in Code
**Priority:** P1 - HIGH
**Status:** 🔍 IDENTIFIED - Needs fix
**Labels:** bug, configuration, technical-debt

**Description:**
Multiple API routes have `const SINGLE_USER_MODE = process.env.SINGLE_USER_MODE === 'true' || true` which ALWAYS evaluates to true, bypassing environment variable.

**Impact:**
- Multi-user mode will not work even if environment variable is unset
- Security risk: auth can't be enforced in production
- Testing difficulty: can't toggle modes without code changes

**Affected Files:**
- `app/api/audit/analyze/route.ts:36`
- `app/api/xero/organizations/route.ts:7` (already fixed to remove `|| true`)
- Potentially others (needs grep audit)

**Recommended Fix:**
```typescript
// Remove || true fallback
const SINGLE_USER_MODE = process.env.SINGLE_USER_MODE === 'true'
```

**Verification:**
```bash
grep -r "SINGLE_USER_MODE.*||.*true" app/api/
```

---

## 🟡 HIGH PRIORITY - Production Quality Issues

### Issue 4: Silent Failures in OAuth Callback
**Priority:** P1 - HIGH
**Status:** 🔍 IDENTIFIED
**Labels:** bug, error-handling, oauth, ux

**Description:**
When database inserts fail in OAuth callback (due to schema mismatch or other errors), the callback still redirects to `?connected=true` giving false success indicator.

**Impact:**
- Users think connection succeeded when it failed
- No error message shown to user
- Difficult to diagnose without checking server logs

**Affected Code:**
`app/api/auth/xero/callback/route.ts:160-176`

**Recommended Fix:**
```typescript
const { error: connectionError } = await supabase
    .from('xero_connections')
    .upsert({...})

if (connectionError) {
    console.error('Failed to save Xero connection:', connectionError)
    // Redirect with error parameter
    return NextResponse.redirect(
        `${redirectUrl}?error=connection_failed&message=${encodeURIComponent(connectionError.message)}`
    )
}
```

---

### Issue 5: Environment Variables Not Validated at Startup
**Priority:** P1 - HIGH
**Status:** 🔍 IDENTIFIED
**Labels:** enhancement, configuration, devx

**Description:**
Missing or invalid environment variables (like `GOOGLE_AI_API_KEY`, `XERO_CLIENT_ID`) are only discovered when features are used, not at application startup.

**Impact:**
- Runtime errors in production
- Poor developer experience
- Difficult to diagnose configuration issues

**Recommended Fix:**
Create startup validation in `lib/config/env.ts`:
```typescript
export function validateRequiredEnv() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'XERO_CLIENT_ID',
    'XERO_CLIENT_SECRET',
  ]

  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`)
  }
}
```

Call in `app/layout.tsx` or `middleware.ts`.

---

### Issue 6: Rate Limit Handling Issues
**Priority:** P1 - HIGH
**Status:** 🔍 IDENTIFIED (from agent testing failures)
**Labels:** bug, rate-limiting, reliability

**Description:**
All 4 comprehensive testing agents hit rate limits and failed to complete full testing. System doesn't gracefully handle Claude API rate limits.

**Evidence:**
```
"error": "rate_limit"
"message": "You've hit your limit · resets 6pm (Australia/Brisbane)"
```

**Impact:**
- Automated testing can't complete
- May affect production AI analysis features
- No retry logic or backoff strategy

**Recommended Fix:**
1. Implement exponential backoff in `lib/ai/forensic-analyzer.ts`
2. Add rate limit detection and queuing
3. Show user-friendly message when rate limited
4. Consider adding Redis-based rate limiting tracker

---

### Issue 7: Missing Database Column Documentation
**Priority:** P2 - MEDIUM
**Status:** 🔍 IDENTIFIED
**Labels:** documentation, technical-debt

**Description:**
Migration `020_add_organization_id_to_xero_connections.sql` adds column that wasn't in original schema. Schema documentation (`supabase/schema.sql`) is out of sync with applied migrations.

**Impact:**
- New developers see incorrect schema
- Schema drift between documentation and reality
- Difficult to understand database structure

**Files Affected:**
- `supabase/schema.sql` (lines 14-42) - missing `organization_id`
- `supabase/migrations/001_create_xero_connections.sql` - original migration

**Recommended Fix:**
1. Update `supabase/schema.sql` to include `organization_id` column
2. Add comments explaining multi-org support
3. Consider regenerating schema from live database: `supabase db dump --schema public`

---

## 🟢 MEDIUM PRIORITY - Technical Debt

### Issue 8: Agent Testing Hit Rate Limits
**Priority:** P2 - MEDIUM
**Status:** 🔍 IDENTIFIED
**Labels:** testing, infrastructure, rate-limiting

**Description:**
Comprehensive system testing requested by user couldn't complete due to rate limits:
- Agent ae3c284 (OAuth testing) - rate limited
- Agent a2a1d78 (Data sync testing) - rate limited
- Agent ac5fa31 (Code review) - rate limited
- Agent abd9a97 (Feature mapping) - still running

**Impact:**
- Incomplete test coverage
- Can't verify all system functionality
- Delayed issue identification

**Recommendations:**
1. Space out agent testing over longer period
2. Reduce agent context size to minimize token usage
3. Implement test result caching
4. Consider using multiple API keys for testing

---

### Issue 9: Inconsistent SINGLE_USER_MODE Pattern
**Priority:** P2 - MEDIUM
**Status:** 🔍 IDENTIFIED
**Labels:** code-quality, consistency

**Description:**
Different API routes implement single-user mode checks differently:
- Some check at function start
- Some check in middleware
- Some have `|| true` fallback
- Inconsistent variable naming

**Affected Files:**
- `app/api/xero/organizations/route.ts:7`
- `app/api/audit/analyze/route.ts:36`
- `lib/auth/middleware.ts:76`

**Recommended Fix:**
1. Centralize single-user mode check in middleware
2. Remove all inline checks from route handlers
3. Use `requireAuth` or `requireAuthOnly` consistently
4. Document pattern in CLAUDE.md

---

### Issue 10: Missing Error Context in Callback
**Priority:** P2 - MEDIUM
**Status:** 🔍 IDENTIFIED
**Labels:** logging, observability

**Description:**
OAuth callback errors don't include sufficient context for debugging:
- No tenant_id in error logs
- No user_id in error logs
- No timestamp correlation

**Recommended Fix:**
```typescript
console.error('Failed to save Xero connection:', {
    error: connectionError,
    tenantId: tenant.tenantId,
    userId: userId || 'single-user',
    timestamp: new Date().toISOString(),
    step: 'database_insert'
})
```

---

## 📊 Summary Statistics

**Total Issues Identified:** 10
- 🔴 Critical (P0): 3 (2 fixed, 1 needs fix)
- 🟡 High (P1): 4
- 🟢 Medium (P2): 3

**Fixed Issues:** 2/10 (20%)
**Ready for Verification:** 2/10 (20%)
**Needs Implementation:** 6/10 (60%)

---

## 🎯 Recommended Action Plan

### Immediate (Today)
1. ✅ **Verify OAuth Fix** - User must retry connecting 3 Xero accounts
2. **Fix Issue #3** - Remove `|| true` from all SINGLE_USER_MODE checks
3. **Fix Issue #4** - Add error handling to OAuth callback

### This Week
4. **Fix Issue #5** - Add environment variable validation
5. **Fix Issue #6** - Implement rate limit handling
6. **Fix Issue #7** - Update schema documentation

### This Month
7. **Fix Issue #8** - Improve testing infrastructure
8. **Fix Issue #9** - Standardize single-user mode pattern
9. **Fix Issue #10** - Enhance error logging

---

## 🔍 Additional Testing Needed

Once OAuth fix is verified, run comprehensive tests:

### Functional Testing
- [ ] Connect all 3 Xero accounts successfully
- [ ] Verify organizations appear in dashboard
- [ ] Test organization grouping (link multiple orgs)
- [ ] Run historical data sync
- [ ] Start forensic audit
- [ ] Generate reports

### Performance Testing
- [ ] Test with large transaction volumes (>1000)
- [ ] Monitor Gemini AI rate limits during batch processing
- [ ] Verify caching performance

### Security Testing
- [ ] Verify multi-user mode works (toggle SINGLE_USER_MODE=false)
- [ ] Test authentication enforcement
- [ ] Verify token encryption at rest
- [ ] Test CORS headers

---

## 📝 Notes

**Migration Status:**
- ✅ Migration `020_add_organization_id_to_xero_connections.sql` confirmed applied
- ✅ Column exists in production database
- ⚠️ Database still empty (0 connections, 0 organizations)
- ⏳ User needs to retry OAuth to verify fix

**Environment:**
- Deployment: Vercel Production
- Database: Supabase (xwqymjisxmtcmaebcehw)
- Mode: Single-user (SINGLE_USER_MODE=true)
- Branch: main (commit 79ddf70)

**Testing Limitations:**
4 specialized agents launched for comprehensive testing hit rate limits:
- OAuth & auth flows testing (agent ae3c284)
- Data sync & audit testing (agent a2a1d78)
- Code review & security (agent ac5fa31)
- Feature mapping (agent abd9a97)

All agents provided partial findings before rate limiting.
