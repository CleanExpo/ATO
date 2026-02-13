# Migration Guide - Fix "organizations" Table Error

## Problem
You're getting errors like `ERROR: 42P01: relation "organizations" does not exist` because the database migrations haven't been run in your Supabase instance yet.

## Solution: Run Migrations in Correct Order

### Step 1: Check which migrations exist
The following migrations create the required tables:

1. `20260128000006_enhanced_multi_tenant_support.sql` - **CRITICAL** - Creates `organizations` table
2. `003_create_profiles.sql` - Creates `profiles` table
3. `004_create_purchases.sql` - Creates `purchases` table
4. `20260129000001_add_organization_to_connections.sql` - Adds `organization_id` to connections
5. `20260129000002_create_notifications.sql` - Creates `notifications` table

### Step 2: Run migrations via Supabase CLI

**Option A: Using Supabase CLI** (Recommended)

```bash
# If you have Supabase CLI installed
cd D:\ATO

# Run migrations in order
supabase db push

# This will apply all pending migrations
```

**Option B: Manual SQL Execution** (If CLI doesn't work)

1. Open Supabase Studio: https://supabase.com/dashboard
2. Go to your project
3. Navigate to: SQL Editor
4. Run each migration file in this exact order:

```sql
-- 1. First, run the organizations table migration
-- Copy and paste content from: supabase/migrations/20260128000006_enhanced_multi_tenant_support.sql

-- 2. Then run profiles table
-- Copy and paste content from: supabase/migrations/003_create_profiles.sql

-- 3. Then run purchases table
-- Copy and paste content from: supabase/migrations/004_create_purchases.sql

-- 4. Then run organization connections update
-- Copy and paste content from: supabase/migrations/20260129000001_add_organization_to_connections.sql

-- 5. Finally run notifications
-- Copy and paste content from: supabase/migrations/20260129000002_create_notifications.sql
```

### Step 3: Verify tables exist

Run this query in Supabase SQL Editor to verify:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('organizations', 'profiles', 'purchases', 'notifications', 'user_tenant_access', 'organization_invitations')
ORDER BY table_name;
```

You should see all 6 tables listed.

### Step 4: Check for RLS policies

```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('organizations', 'profiles', 'purchases', 'notifications')
ORDER BY tablename, policyname;
```

## Quick Fix Script

I'll create a consolidated migration that you can run once to set everything up:

```bash
# Run this in Supabase SQL Editor
-- This script is in: supabase/migrations/QUICKSTART_CONSOLIDATED_PHASE1_AND_2.sql
```

## Common Issues

**Issue 1**: "function uuid_generate_v4() does not exist"
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**Issue 2**: "permission denied for schema public"
- Make sure you're running migrations with the Supabase service role
- Or run via Supabase CLI which handles permissions automatically

**Issue 3**: Migrations already partially applied
```sql
-- Check which migrations have run
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
```

## Need Help?

If migrations still fail:
1. Check Supabase logs for detailed error messages
2. Ensure your Supabase project is on the latest version
3. Try creating tables manually in SQL Editor
4. Contact me with the specific error message

---

**Created**: 2026-01-29 24:00 AEST
**Author**: Claude (Senior Systems Architect)
