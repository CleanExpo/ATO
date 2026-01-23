# Deployment Guide - ATO Tax Analysis Application

This guide covers deploying the latest features to production.

## 📋 Pre-Deployment Checklist

- [x] Brave Search integration implemented
- [x] Autonomous agent system implemented
- [x] All tests passing locally
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Production deployment verified

---

## 🗄️ Database Migration

### Required Migrations

Two new tables need to be created in Supabase:

1. **agent_reports** - Stores autonomous agent findings
2. **tax_rates_cache** - Caches ATO tax rates (24hr TTL)

### How to Apply

**Option 1: Using Supabase Dashboard (Recommended)**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the contents of `supabase/migrations/20260122_new_features_consolidated.sql`
6. Paste into the SQL editor
7. Click **Run** (or press `Ctrl+Enter`)
8. Verify success messages appear in the output

**Option 2: Using Supabase CLI (if installed)**

```bash
cd C:\ATO\ato-app
supabase db push
```

### Verification

After running the migration, verify tables exist:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('agent_reports', 'tax_rates_cache');

-- Check agent_reports structure
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'agent_reports';

-- Check tax_rates_cache structure
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'tax_rates_cache';
```

---

## 🔑 Environment Variables

Ensure these variables are set in **Vercel** or your production environment:

### Required Variables (Already Set)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xwqymjisxmtcmaebcehw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Xero OAuth
NEXT_PUBLIC_XERO_CLIENT_ID=B5135FA8...
XERO_CLIENT_SECRET=PvSAXyVP...

# Google AI
GOOGLE_AI_API_KEY=AIzaSyA5i79ERLApgFdXGA3pfY0suhx7nx0WhtI
```

### Optional Variables (Recommended for New Features)

```bash
# Brave Search API (for dynamic tax rates)
BRAVE_API_KEY=BSAPnrbZRCAW5iXLG1MeZjjqt0n23R2

# Business Information
BUSINESS_NAME="Your Business Name"
BUSINESS_ABN="12345678901"
YOUR_NAME="Your Name"
```

**Note**: If `BRAVE_API_KEY` is not set, the system will use fallback values for tax rates (20,000 instant write-off, 43.5% R&D rate, 67c home office rate).

---

## 🚀 Deployment to Vercel

### Automatic Deployment (GitHub Integration)

Vercel automatically deploys when you push to `main` branch:

```bash
git push origin main
```

Check deployment status:
- **Vercel Dashboard**: https://vercel.com/unite-group/ato
- **Production URL**: Will be shown in Vercel dashboard

### Manual Deployment (if needed)

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Deploy
vercel --prod
```

---

## ✅ Post-Deployment Verification

### 1. Check Application Health

```bash
# Health check (should return 200 OK)
curl https://your-production-url.vercel.app/api/health

# Check environment
curl https://your-production-url.vercel.app/api/config
```

### 2. Test New Features

**A. Tax Rates API:**

```bash
# Get current tax rates
curl https://your-production-url.vercel.app/api/tax-data/rates

# Expected response:
{
  "success": true,
  "data": {
    "instantWriteOffThreshold": 20000,
    "homeOfficeRatePerHour": 0.67,
    "rndOffsetRate": 0.435,
    ...
  }
}
```

**B. Agent Reports API:**

```bash
# Get agent reports
curl https://your-production-url.vercel.app/api/agents/reports

# Expected: Empty array initially
{"reports": []}
```

**C. Analysis Status:**

```bash
# Check AI analysis status
curl https://your-production-url.vercel.app/api/audit/analysis-status/YOUR_TENANT_ID

# Expected: Current progress
{
  "status": "analyzing",
  "progress": 0.8,
  "transactionsAnalyzed": 100,
  "totalTransactions": 12236
}
```

### 3. Monitor Logs

In Vercel Dashboard:
1. Go to your project
2. Click on the latest deployment
3. Go to **Runtime Logs** tab
4. Watch for errors or warnings

### 4. Test Autonomous Agents (Optional)

On your local machine or server:

```bash
cd C:\ATO\ato-app

# Run all agents once
npm run agents:run analysis-monitor
npm run agents:run data-quality
npm run agents:run api-health

# Start continuous monitoring
npm run agents:start
```

---

## 🐛 Troubleshooting

### Database Connection Issues

**Symptom**: `column "agent_reports.x" does not exist`

**Fix**: Run the database migration in Supabase SQL Editor

### Tax Rates Not Fetching

**Symptom**: Console shows "Failed to fetch tax rates"

**Possible Causes**:
1. BRAVE_API_KEY not set → System uses fallback values (this is OK)
2. API rate limit exceeded → Wait and retry
3. ATO website structure changed → Update parsers in `lib/scraping/jina-scraper.ts`

**Check**:
```bash
curl https://your-url.vercel.app/api/tax-data/cache-stats
```

### Agent Reports Not Storing

**Symptom**: Agents run but reports don't appear in database

**Fix**:
1. Verify `agent_reports` table exists in Supabase
2. Check RLS policies are correct
3. Verify `SUPABASE_SERVICE_ROLE_KEY` is set

---

## 📊 Monitoring

### Key Metrics to Watch

1. **AI Analysis Progress**
   - Check: `/api/audit/analysis-status/:tenantId`
   - Expected: Progress increasing over 3-4 hours

2. **Agent Reports**
   - Check: `/api/agents/reports`
   - Expected: New reports every 5 minutes

3. **Tax Rates Cache**
   - Check: `/api/tax-data/cache-stats`
   - Expected: Cache age < 24 hours

### Dashboard Links

- **Agent Monitor**: `/dashboard/agent-monitor`
- **Forensic Audit**: `/dashboard/forensic-audit`
- **Xero Sync**: `/dashboard/xero-sync`

---

## 🔄 Rollback Procedure

If something goes wrong:

### 1. Revert Code

```bash
git revert HEAD
git push origin main
```

### 2. Remove Database Tables (if needed)

```sql
-- In Supabase SQL Editor
DROP TABLE IF EXISTS agent_reports CASCADE;
DROP TABLE IF EXISTS tax_rates_cache CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_agent_reports();
DROP FUNCTION IF EXISTS cleanup_old_tax_rates_cache();
```

### 3. Verify Rollback

```bash
curl https://your-url.vercel.app/api/health
```

---

## 📞 Support

If you encounter issues:

1. Check Vercel logs
2. Check Supabase logs (Database → Logs)
3. Review error messages in browser console
4. Check GitHub Actions for build errors

---

## 📝 Deployment History

| Date | Version | Changes | Status |
|------|---------|---------|--------|
| 2026-01-22 | v2.0 | Brave Search + Agents | ✅ Ready |
| 2026-01-21 | v1.1 | Database constraint fix | ✅ Deployed |
| 2026-01-20 | v1.0 | Initial release | ✅ Deployed |

---

## 🎉 Success!

If all verifications pass, your deployment is complete!

**New Features Available:**
- ✅ Dynamic tax rates from ATO.gov.au
- ✅ Autonomous monitoring agents
- ✅ Real-time agent dashboard
- ✅ 24-hour tax rate caching
- ✅ Comprehensive API endpoints

**Next Steps:**
1. Monitor AI analysis completion (3-4 hours)
2. Review agent findings in `/dashboard/agent-monitor`
3. Check for R&D opportunities when analysis completes
4. Generate reports (PDF/Excel)
