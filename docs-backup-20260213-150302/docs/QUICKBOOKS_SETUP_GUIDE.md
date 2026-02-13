# QuickBooks Developer App Setup Guide

This guide walks you through creating a QuickBooks Online developer app and configuring it for the ATO Tax Optimizer.

---

## Prerequisites

- Intuit Developer account (free to create)
- Access to `.env.local` file in the project
- Supabase database credentials configured

---

## Step 1: Create Intuit Developer Account

1. Visit: https://developer.intuit.com/
2. Click **"Sign In"** in the top right
3. If you don't have an account:
   - Click **"Create an account"**
   - Fill in your details
   - Verify your email address

---

## Step 2: Create a New App

1. Go to: https://developer.intuit.com/app/developer/myapps
2. Click **"Create an app"** button
3. Select **"QuickBooks Online and Payments"**
4. Fill in app details:

   **App Name:**
   ```
   ATO Tax Optimizer
   ```

   **Description:**
   ```
   Australian tax optimization platform that analyzes QuickBooks transactions
   to identify R&D tax incentives, deduction opportunities, and tax loss
   recovery for SMEs.
   ```

5. Click **"Create app"**

---

## Step 3: Configure App Settings

### 3.1 Get Your Credentials

After creating the app, you'll see:

- **Client ID**: `ABxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Client Secret**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**⚠️ Keep these secret!** Don't commit them to version control.

### 3.2 Set Redirect URI

1. In your app dashboard, find **"Keys & OAuth"** section
2. Under **"Redirect URIs"**, add:

   **For Development:**
   ```
   http://localhost:3000/api/auth/quickbooks/callback
   ```

   **For Production (later):**
   ```
   https://yourdomain.com/api/auth/quickbooks/callback
   ```

3. Click **"Add URI"**
4. Click **"Save"**

### 3.3 Set Scopes

Under **"Scopes"**, select:
- ✅ `com.intuit.quickbooks.accounting` (read/write access to accounting data)

**Note:** We only use read operations, but QuickBooks requires the read/write scope.

---

## Step 4: Add Credentials to .env.local

1. Open `.env.local` in the project root (or create it from `.env.example`)

2. Add your QuickBooks credentials:

```bash
# QuickBooks Online API
QUICKBOOKS_CLIENT_ID=ABxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
QUICKBOOKS_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Make sure base URL is set
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

3. **Never commit `.env.local` to git** (it's already in `.gitignore`)

---

## Step 5: Run Database Migrations

Apply the QuickBooks migrations to create the `quickbooks_tokens` table:

### Option A: Using npm Script (Recommended)

```bash
npm run db:migrate
```

This runs all pending migrations including:
- Platform columns (Xero/MYOB/QuickBooks support)
- QuickBooks tokens table

### Option B: Manual via Supabase Dashboard

1. Go to: https://app.supabase.com/project/_/sql
2. Copy the contents of:
   - `supabase/migrations/20260128000008_add_platform_column.sql`
   - `supabase/migrations/20260128000009_add_platform_to_analysis_tables.sql`
   - `supabase/migrations/20260128000010_create_quickbooks_tokens_table.sql`
3. Paste each into the SQL editor and click **"Run"**

### Verify Migrations

Run this SQL query in Supabase to verify:

```sql
-- Check QuickBooks tokens table
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'quickbooks_tokens'
ORDER BY ordinal_position;
```

Expected columns:
- `id` (uuid)
- `tenant_id` (uuid)
- `access_token` (text)
- `refresh_token` (text)
- `expires_at` (bigint)
- `realm_id` (text)
- `token_type` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

---

## Step 6: Test OAuth Flow

### 6.1 Start Development Server

```bash
npm run dev
```

Server should start on: http://localhost:3000

### 6.2 Create a Sandbox Company (Testing)

1. Go to: https://developer.intuit.com/app/developer/sandbox
2. Click **"Create sandbox company"**
3. Select **"QuickBooks Online Plus"** (or any plan)
4. Fill in company details
5. Click **"Create"**
6. Note the **Company ID** (realm ID) for testing

### 6.3 Test Authentication

1. Navigate to your app's dashboard
2. Click **"Connect QuickBooks"** button
3. You should be redirected to Intuit authorization page
4. Sign in with your Intuit developer account
5. Select your **sandbox company**
6. Click **"Connect"**
7. You should be redirected back to your app with success message

### 6.4 Verify Tokens Stored

Run this query in Supabase:

```sql
SELECT
  tenant_id,
  realm_id,
  expires_at,
  created_at
FROM quickbooks_tokens
WHERE tenant_id = '<your-user-id>';
```

You should see one row with your QuickBooks connection.

---

## Step 7: Test Transaction Sync

### 7.1 Add Test Data to Sandbox

1. Log in to your sandbox company: https://app.sandbox.qbo.intuit.com/
2. Add some test transactions:
   - **Expenses** → Create a few purchases
   - **Expenses** → Create a few bills
   - **Sales** → Create a few invoices

### 7.2 Trigger Sync

Use the API or dashboard to sync transactions:

**Via API:**
```bash
curl -X POST http://localhost:3000/api/quickbooks/sync \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Via Dashboard:**
- Go to Forensic Audit page
- Click "Sync QuickBooks Data"
- Wait for sync to complete

### 7.3 Verify Data Cached

Run this query in Supabase:

```sql
SELECT
  COUNT(*) as transaction_count,
  MIN(transaction_date) as earliest_date,
  MAX(transaction_date) as latest_date
FROM historical_transactions_cache
WHERE tenant_id = '<your-user-id>'
  AND platform = 'quickbooks';
```

You should see your synced transactions.

---

## Step 8: Test AI Analysis

### 8.1 Trigger Analysis

**Via API:**
```bash
curl -X POST http://localhost:3000/api/audit/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "<your-user-id>",
    "platform": "quickbooks",
    "batchSize": 10
  }'
```

**Via Dashboard:**
- Go to Forensic Audit page
- Select "QuickBooks" as platform
- Click "Start AI Analysis"
- Monitor progress panel

### 8.2 Verify Analysis Results

Run this query in Supabase:

```sql
SELECT
  COUNT(*) as analyzed_count,
  AVG(confidence_score) as avg_confidence,
  SUM(CASE WHEN is_rnd_candidate THEN 1 ELSE 0 END) as rnd_candidates
FROM forensic_analysis_results
WHERE tenant_id = '<your-user-id>'
  AND platform = 'quickbooks';
```

You should see analysis results with R&D candidates and confidence scores.

---

## Step 9: Production Setup (When Ready)

### 9.1 Create Production App

1. Go to: https://developer.intuit.com/app/developer/myapps
2. Click your app
3. Switch from **"Development"** to **"Production"**
4. Update redirect URI to production domain:
   ```
   https://yourdomain.com/api/auth/quickbooks/callback
   ```

### 9.2 Submit for App Review (If Required)

If you plan to publish the app or use with external customers:

1. Click **"Submit for review"**
2. Provide app documentation
3. Explain OAuth flow and data usage
4. Wait for Intuit approval (typically 1-2 weeks)

### 9.3 Production Deployment

1. Update `.env.local` on production (Vercel):
   ```bash
   QUICKBOOKS_CLIENT_ID=<production-client-id>
   QUICKBOOKS_CLIENT_SECRET=<production-client-secret>
   NEXT_PUBLIC_BASE_URL=https://yourdomain.com
   ```

2. Deploy to Vercel:
   ```bash
   vercel --prod
   ```

3. Run migrations on production database

4. Test OAuth flow on production

---

## Troubleshooting

### Error: "Redirect URI mismatch"

**Cause:** The redirect URI in your app settings doesn't match the one in your code.

**Fix:**
1. Check `NEXT_PUBLIC_BASE_URL` in `.env.local`
2. Verify redirect URI in Intuit app dashboard matches:
   `{NEXT_PUBLIC_BASE_URL}/api/auth/quickbooks/callback`

### Error: "Invalid client credentials"

**Cause:** Client ID or Client Secret is incorrect.

**Fix:**
1. Double-check credentials in `.env.local`
2. Ensure no extra spaces or quotes
3. Regenerate credentials if needed in Intuit dashboard

### Error: "Token expired"

**Cause:** Access token has expired (1-hour lifespan).

**Fix:**
- Tokens are automatically refreshed by `quickbooks-client.ts`
- If refresh fails, user needs to re-authenticate

### Error: "Rate limit exceeded"

**Cause:** Exceeded QuickBooks API rate limit (500 requests/minute).

**Fix:**
- Reduce batch size in sync operations
- Implement exponential backoff (already included)
- Wait 60 seconds for rate limit reset

### Error: "Realm ID not found"

**Cause:** QuickBooks Company ID missing from callback.

**Fix:**
- Ensure OAuth callback includes `realmId` parameter
- Check browser network tab for callback URL
- Verify user selected a company during authorization

---

## Security Best Practices

✅ **Do:**
- Store credentials in environment variables only
- Use HTTPS in production
- Implement CSRF protection (state parameter)
- Refresh tokens before expiration
- Log all OAuth errors

❌ **Don't:**
- Commit `.env.local` to version control
- Log full access tokens (truncate to 8 chars)
- Share client secret publicly
- Store tokens in browser localStorage
- Skip state parameter validation

---

## Rate Limits & Quotas

| Limit Type | Value | Notes |
|-----------|-------|-------|
| Requests per minute | 500 | Per company (realm ID) |
| Burst allowance | 100 | Short-term spike allowance |
| Query result limit | 1000 | Use MAXRESULTS in queries |
| Access token lifetime | 1 hour | Auto-refreshed |
| Refresh token lifetime | 100 days | Requires re-auth after |

---

## Useful Links

- **Intuit Developer Portal:** https://developer.intuit.com/
- **My Apps:** https://developer.intuit.com/app/developer/myapps
- **API Explorer:** https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/query
- **OAuth 2.0 Docs:** https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0
- **Sandbox Companies:** https://developer.intuit.com/app/developer/sandbox
- **Support:** https://help.developer.intuit.com/s/

---

## Next Steps After Setup

1. ✅ QuickBooks OAuth working
2. ✅ Transactions syncing from sandbox
3. ✅ AI analysis producing R&D candidates
4. 🔄 Test with real client data (production company)
5. 🔄 Compare results with Xero and MYOB platforms
6. 🔄 Monitor API usage and costs
7. 🔄 Deploy to production when ready

---

## Need Help?

- Check `QUICKBOOKS_INTEGRATION_SUMMARY.md` for technical details
- Review API routes in `app/api/auth/quickbooks/` and `app/api/quickbooks/`
- Inspect network tab for OAuth flow debugging
- Check Supabase logs for database errors
- Review Vercel logs for production issues

---

**Status:** Ready for setup ✅
**Last Updated:** 2026-01-28
