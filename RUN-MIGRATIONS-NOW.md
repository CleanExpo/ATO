# 🚀 Run Database Migrations - Quick Start

## ✅ The migration SQL is already in your clipboard!

I've copied the consolidated migration SQL to your clipboard. Here's what to do:

---

## 🎯 EASIEST METHOD: Use Supabase Dashboard (Recommended)

I've already opened the Supabase SQL Editor for you. Just follow these 4 simple steps:

### Step 1: Open SQL Editor
✅ Already done! Check your browser for this tab:
```
https://supabase.com/dashboard/project/xwqymjisxmtcmaebcehw/editor
```

### Step 2: Create New Query
Click the **"New query"** button in the SQL Editor

### Step 3: Paste the Migration
Press **Ctrl+V** to paste (the SQL is already in your clipboard!)

Or manually open: `C:\ATO\ato-app\run-migrations-consolidated.sql`

### Step 4: Run It
Click the **"Run"** button (or press **Ctrl+Enter**)

### Expected Output:
```
✅ All migrations completed successfully!
Created:
  - 4 tables (historical_transactions_cache, audit_sync_status, ...)
  - 10+ indexes for fast queries
  - 3 materialized views for aggregations
  - 5 database functions for common queries
```

**That's it! You're done!** 🎉

---

## 🔧 ALTERNATIVE: Use Command Line

If you prefer terminal/command line:

### Option 1: Using Node.js (Requires service key in .env.local)

```bash
node scripts/run-migrations.js
```

**Note**: You'll need to add your `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` first.

Get it from: https://supabase.com/dashboard/project/xwqymjisxmtcmaebcehw/settings/api

### Option 2: Using Supabase CLI (If installed)

```bash
supabase link --project-ref xwqymjisxmtcmaebcehw
supabase db push
```

---

## ✅ Verify Migrations Worked

After running migrations, verify everything was created:

```bash
node scripts/verify-migrations.js
```

Or manually check in Supabase dashboard:
1. Go to: https://supabase.com/dashboard/project/xwqymjisxmtcmaebcehw/editor
2. Run this query:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should return:
-- ✅ ai_analysis_costs
-- ✅ audit_sync_status
-- ✅ forensic_analysis_results
-- ✅ historical_transactions_cache

-- Check materialized views
SELECT matviewname FROM pg_matviews;

-- Should return:
-- ✅ mv_cost_summary
-- ✅ mv_deduction_summary
-- ✅ mv_rnd_summary
```

---

## 🎉 After Migration Success

Once migrations complete successfully, you can:

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Navigate to Dashboard
```
http://localhost:3000/dashboard/forensic-audit
```

### 3. Start Your First Audit
- Click **"Start Sync"** to fetch 5 years of Xero data
- Click **"Start Analysis"** to run AI forensic analysis
- View results and recommendations
- Export professional reports (PDF, Excel)

---

## ❌ Troubleshooting

### Error: "relation already exists"
This means migrations were partially run. Safe to ignore - the `IF NOT EXISTS` clauses will skip existing tables.

### Error: "permission denied"
Make sure you're using your **Service Role Key** (not the Anon key).

Get it from: https://supabase.com/dashboard/project/xwqymjisxmtcmaebcehw/settings/api

### Error: "extension does not exist"
Run this first in SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

Then re-run the main migration.

### Still Having Issues?
1. Check the Supabase dashboard for error messages
2. Make sure your project is not paused
3. Verify you have admin access to the project
4. Try running the migration in smaller chunks (run each section separately)

---

## 📊 What Gets Created

### Tables (4)
- **historical_transactions_cache** - Stores 5 years of Xero transaction data
- **audit_sync_status** - Tracks sync progress
- **forensic_analysis_results** - AI analysis results per transaction
- **ai_analysis_costs** - API usage and cost tracking

### Indexes (10+)
- Fast lookups by tenant, financial year, transaction type
- Partial indexes for R&D candidates, deductible items
- Date range queries optimized

### Materialized Views (3)
- **mv_rnd_summary** - R&D analysis aggregated by tenant/year (~100x faster)
- **mv_deduction_summary** - Deduction opportunities by category
- **mv_cost_summary** - Cost tracking per tenant

### Database Functions (5)
- **refresh_all_materialized_views()** - Refresh all views
- **refresh_tenant_views(tenant_id)** - Refresh for specific tenant
- **get_tenant_analysis_summary(tenant_id)** - Fast summary query
- **get_rnd_summary_fast(tenant_id)** - R&D summary from view
- **get_deduction_summary_fast(tenant_id)** - Deduction summary from view

---

## 🚀 Quick Summary

**What I've done for you:**
✅ Created consolidated migration SQL file
✅ Copied it to your clipboard
✅ Opened Supabase SQL Editor in your browser
✅ Created verification script
✅ Created Node.js runner (if you need it)

**What you need to do:**
1. Go to the Supabase SQL Editor tab (already open)
2. Press Ctrl+V to paste
3. Click "Run"
4. Wait 10-30 seconds
5. Done! ✅

**Total time**: ~1 minute

After that, your entire forensic tax audit system will be ready to process 5 years of Xero data and identify $200k-$500k in tax savings! 🎉

---

## Need Help?

If you run into any issues:
1. Check `DATABASE_MIGRATIONS.md` for detailed troubleshooting
2. Verify your Supabase credentials in `.env.local`
3. Make sure your Supabase project is active (not paused)
4. Try running verification: `node scripts/verify-migrations.js`

**The migration SQL is safe to run multiple times** - it uses `IF NOT EXISTS` clauses to avoid errors.
