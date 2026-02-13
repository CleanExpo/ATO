# Database Schema Fix Instructions

## Problem

Your application is failing because the database tables are missing some required columns:

1. **audit_sync_status** - missing `total_transactions_estimated` column
2. **historical_transactions_cache** - missing `contact_name` column and has NOT NULL constraint on `transaction_id`

## Solution

Run the migration script to fix these issues.

---

## Option 1: Apply via Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://xwqymjisxmtcmaebcehw.supabase.co
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of `supabase/migrations/20260120_fix_audit_tables.sql`
5. Paste into the SQL editor
6. Click **Run** (or press Ctrl+Enter)

You should see: "Schema updates applied successfully!"

---

## Option 2: Apply via Command Line

If you have Supabase CLI installed:

```bash
cd C:\ATO\ato-app
supabase db push
```

This will apply all pending migrations.

---

## Option 3: Manual SQL Execution

If you prefer to run the SQL manually, here's the quick version:

```sql
-- Add missing columns
ALTER TABLE audit_sync_status
ADD COLUMN IF NOT EXISTS total_transactions_estimated INTEGER DEFAULT 0;

ALTER TABLE historical_transactions_cache
ADD COLUMN IF NOT EXISTS contact_name TEXT;

-- Make transaction_id nullable
ALTER TABLE historical_transactions_cache
ALTER COLUMN transaction_id DROP NOT NULL;
```

---

## Verify the Fix

After applying the migration, restart your Next.js dev server:

```bash
# Stop the current server (Ctrl+C)
# Then restart
npm run dev
```

Navigate to `/dashboard/forensic-audit` and click "Start Historical Sync".

You should no longer see these errors:
- ❌ `Could not find the 'total_transactions_estimated' column`
- ❌ `Could not find the 'contact_name' column`
- ❌ `null value in column "transaction_id" violates not-null constraint`

---

## What This Fix Does

1. **total_transactions_estimated** - Allows the sync to track total progress
2. **contact_name** - Stores supplier/contact names for transactions
3. **transaction_id nullable** - Some Xero transactions don't have IDs
4. **Indexes** - Improves query performance for date ranges and status checks

---

## Next Steps

After applying this fix:
1. ✅ Historical sync should work without errors
2. ✅ Progress tracking will be more accurate
3. ✅ All transaction data will be cached properly

If you still see errors, check the server logs for details.
