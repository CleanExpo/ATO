# QuickBooks UI Integration Gaps - UNI-232 Production Launch

**Status**: Backend 100% Complete | Frontend Integration: 40% Complete
**Priority**: P1 - Critical for Production Launch
**Effort**: 4-6 hours remaining

---

## 🔴 Critical Issues Found

### 1. **Analyze Endpoint Missing QuickBooks Support**
**File**: `app/api/audit/analyze/route.ts` (lines 191-202)
**Problem**: `getCachedTransactionCount()` function only handles 'xero' and 'myob' platforms. Throws error for QuickBooks.

```typescript
// CURRENT CODE (BROKEN):
async function getCachedTransactionCount(tenantId: string, platform: string = 'xero'): Promise<number> {
    if (platform === 'xero') {
        const transactions = await getCachedTransactions(tenantId)
        return transactions.length
    } else if (platform === 'myob') {
        const { getCachedMYOBTransactions } = await import('@/lib/integrations/myob-historical-fetcher')
        const transactions = await getCachedMYOBTransactions(tenantId)
        return transactions.length
    } else {
        throw new Error(`Unsupported platform: ${platform}`) // ❌ FAILS FOR QUICKBOOKS
    }
}
```

**Fix Required**: Add QuickBooks case:
```typescript
} else if (platform === 'quickbooks') {
    const { getCachedQuickBooksTransactions } = await import('@/lib/integrations/quickbooks-historical-fetcher')
    const transactions = await getCachedQuickBooksTransactions(tenantId)
    return transactions.length
}
```

**Impact**: Users cannot run AI analysis on QuickBooks data until this is fixed.

---

### 2. **Settings Page Missing QuickBooks Connection UI**
**File**: `app/dashboard/settings/page.tsx` (lines 213-270)
**Problem**: Only shows Xero connection section. No QuickBooks connection option visible.

**Current UI**:
- ✅ Xero Connection Matrix (lines 213-270)
- ❌ QuickBooks Connection Section (MISSING)
- ❌ Platform selection (MISSING)

**Fix Required**: Add QuickBooks connection card similar to Xero:
- Display QuickBooks connections (OAuth already exists at `/api/auth/quickbooks`)
- "Connect QuickBooks" button linking to `/api/auth/quickbooks`
- Display connected QuickBooks realm name, country, and connection date
- "Disconnect" button for each connection

**Reference**: QuickBooks OAuth endpoints exist:
- `/api/auth/quickbooks` - Initiate OAuth
- `/api/auth/quickbooks/callback` - OAuth callback
- `/api/auth/quickbooks/disconnect` - Disconnect

---

### 3. **Forensic Audit Page Hardcoded to Xero**
**File**: `app/dashboard/forensic-audit/page.tsx` (line 119)
**Problem**: Platform is hardcoded to 'xero' in API call. No platform selection UI.

```typescript
// LINE 119 - HARDCODED TO XERO:
await fetch('/api/audit/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, platform: 'xero' }) // ❌ HARDCODED
})
```

**Fix Required**:
1. Add platform selector UI before "Start" button
2. Store selected platform in state
3. Pass selected platform to API calls (sync + analyze)
4. Show PlatformBadge with selected platform

**Design Pattern**: Similar to AnalysisProgressPanel which already supports all 3 platforms.

---

## ✅ What's Working

### Backend Infrastructure (100%)
- ✅ QuickBooks OAuth 2.0 authentication (`quickbooks-config.ts`, `quickbooks-client.ts`)
- ✅ All 6 transaction types supported (Purchase, Bill, Invoice, Expense, CreditMemo, JournalEntry)
- ✅ Historical data fetching (`quickbooks-historical-fetcher.ts`)
- ✅ Data normalization to canonical format (`quickbooks-adapter.ts`)
- ✅ Sync endpoint (`/api/quickbooks/sync`)
- ✅ Token refresh and management
- ✅ Database schema (historical_transactions_cache supports 'quickbooks' platform)
- ✅ Comprehensive test suite (`quickbooks-sandbox.test.ts`)

### UI Components (Partial)
- ✅ `AnalysisProgressPanel` supports QuickBooks (line 273: `quickbooks: 'QuickBooks'`)
- ✅ `PlatformBadge` component supports QuickBooks
- ✅ Platform type defined in forensic audit page (line 30: `type Platform = 'xero' | 'myob' | 'quickbooks'`)

---

## 📋 Production Launch Checklist

### Phase 1: Core API Fix (30 min)
- [ ] Add QuickBooks support to `getCachedTransactionCount()` in analyze endpoint
- [ ] Test analyze endpoint with QuickBooks tenant
- [ ] Verify error handling for missing QuickBooks data

### Phase 2: Settings Page (1-2 hours)
- [ ] Create QuickBooks connection component (similar to Xero)
- [ ] Add "Connect QuickBooks" button
- [ ] Fetch and display QuickBooks connections from database
- [ ] Add disconnect functionality
- [ ] Test OAuth flow end-to-end

### Phase 3: Forensic Audit UI (1-2 hours)
- [ ] Add platform selector dropdown/radio buttons
- [ ] Update sync API call to use selected platform
- [ ] Update analyze API call to use selected platform
- [ ] Show platform-specific instructions (Xero vs QuickBooks)
- [ ] Test full audit flow with QuickBooks

### Phase 4: Documentation (1 hour)
- [ ] Update README with QuickBooks setup instructions
- [ ] Document OAuth app creation in QuickBooks Developer portal
- [ ] Add environment variable configuration (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
- [ ] Create QuickBooks troubleshooting guide

### Phase 5: Testing (1 hour)
- [ ] Run sandbox tests (`QUICKBOOKS_TEST_ENABLED=true npm test`)
- [ ] Test OAuth connection with real QuickBooks sandbox account
- [ ] Test historical sync (all 6 transaction types)
- [ ] Test AI analysis with QuickBooks data
- [ ] Verify platform switching (Xero ↔ QuickBooks)

---

## 🎯 Success Criteria

**QuickBooks is production-ready when**:
1. ✅ All 6 transaction types fetch correctly
2. ✅ OAuth connection flow works end-to-end
3. ✅ Settings page shows QuickBooks connections
4. ✅ Forensic audit allows platform selection
5. ✅ AI analysis works with QuickBooks data
6. ✅ Documentation complete
7. ✅ All tests passing

---

## 📊 Transaction Type Coverage (100%)

| Transaction Type | API Entity | Supported | Notes |
|-----------------|------------|-----------|-------|
| Purchases | `Purchase` | ✅ | Vendor payments with immediate payment |
| Bills | `Bill` | ✅ | Vendor invoices for later payment |
| Invoices | `Invoice` | ✅ | Customer billing (revenue tracking) |
| Expenses | `Expense` | ✅ | Direct expenses without vendors |
| Credit Memos | `CreditMemo` | ✅ | Customer refunds and credits |
| Journal Entries | `JournalEntry` | ✅ | Manual accounting adjustments |

**Previous**: 3/6 transaction types (50%)
**Current**: 6/6 transaction types (100%) ✅

---

## 🔧 Environment Setup

QuickBooks requires these environment variables:

```bash
# QuickBooks OAuth Credentials
QUICKBOOKS_CLIENT_ID=your_client_id_here
QUICKBOOKS_CLIENT_SECRET=your_client_secret_here
QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/auth/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox # or 'production'

# Optional: Sandbox testing
QUICKBOOKS_TEST_ENABLED=false # Set to 'true' for sandbox tests
QUICKBOOKS_SANDBOX_REALM_ID=your_sandbox_realm_id
```

---

## 🚨 Deployment Blockers

**Cannot deploy to production until**:
1. ❌ Fix: `getCachedTransactionCount()` QuickBooks support
2. ❌ Fix: Settings page QuickBooks connection UI
3. ❌ Fix: Forensic audit platform selector

**Estimated Time to Production**: 4-6 hours

---

**Last Updated**: 2026-01-29
**Author**: Claude (UNI-232 Implementation)
