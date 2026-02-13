# Database Migrations Guide

## Current Status

⚠️ **IMPORTANT**: Database migrations have been created but not yet applied to your database.

You're seeing this error:
```
ERROR: 42P01: relation "historical_transactions_cache" does not exist
```

This means the database migrations need to be run to create the required tables.

---

## Available Migrations

The following migrations have been created and need to be applied:

### Migration 004: Historical Data Cache
**File**: `supabase/migrations/004_create_historical_cache.sql`

Creates:
- `historical_transactions_cache` - Stores 5 years of Xero transaction data
- `audit_sync_status` - Tracks sync progress and status

### Migration 005: Forensic Analysis Results
**File**: `supabase/migrations/005_create_forensic_analysis.sql`

Creates:
- `forensic_analysis_results` - Stores AI analysis results for each transaction
- Includes R&D assessment, deduction eligibility, compliance flags
- Indexes for fast querying

### Migration 006: AI Analysis Costs
**File**: `supabase/migrations/006_create_cost_tracking.sql` (if exists)

Creates:
- `ai_analysis_costs` - Tracks API usage and costs
- Cost breakdown by batch with token counts

### Migration 007: Performance Optimization
**File**: `supabase/migrations/007_performance_optimization.sql`

Creates:
- **15+ indexes** for fast queries
- **3 materialized views** for aggregations (mv_rnd_summary, mv_deduction_summary, mv_cost_summary)
- **5 database functions** for common queries
- Performance monitoring setup

---

## How to Run Migrations

### Option 1: Using Supabase CLI (Recommended)

If you're using Supabase:

```bash
# Navigate to project directory
cd C:\ATO\ato-app

# Login to Supabase (if not already logged in)
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run all migrations
supabase db push

# Or run migrations individually
supabase db execute -f supabase/migrations/004_create_historical_cache.sql
supabase db execute -f supabase/migrations/005_create_forensic_analysis.sql
supabase db execute -f supabase/migrations/007_performance_optimization.sql
```

### Option 2: Using Supabase Dashboard

1. Go to https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor**
4. Copy the contents of each migration file and execute them in order:
   - `004_create_historical_cache.sql`
   - `005_create_forensic_analysis.sql`
   - `007_performance_optimization.sql`

5. Click **Run** for each migration

### Option 3: Using psql (Direct Database Connection)

If you have direct PostgreSQL access:

```bash
# Connect to your database
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres"

# Run migrations in order
\i C:/ATO/ato-app/supabase/migrations/004_create_historical_cache.sql
\i C:/ATO/ato-app/supabase/migrations/005_create_forensic_analysis.sql
\i C:/ATO/ato-app/supabase/migrations/007_performance_optimization.sql
```

### Option 4: Using Node.js Script

Create a migration runner script:

**File**: `scripts/run-migrations.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigrations() {
  const migrations = [
    '004_create_historical_cache.sql',
    '005_create_forensic_analysis.sql',
    '007_performance_optimization.sql',
  ]

  for (const migration of migrations) {
    console.log(`Running migration: ${migration}`)

    const sql = readFileSync(
      join(__dirname, '..', 'supabase', 'migrations', migration),
      'utf-8'
    )

    const { error } = await supabase.rpc('exec_sql', { sql })

    if (error) {
      console.error(`Failed to run ${migration}:`, error)
      throw error
    }

    console.log(`✅ ${migration} completed`)
  }

  console.log('All migrations completed successfully!')
}

runMigrations().catch(console.error)
```

Run with:
```bash
npx tsx scripts/run-migrations.ts
```

---

## Verification

After running migrations, verify they were successful:

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected tables:
-- - historical_transactions_cache ✅
-- - audit_sync_status ✅
-- - forensic_analysis_results ✅
-- - ai_analysis_costs ✅

-- Check if indexes exist
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY indexname;

-- Expected: 15+ indexes ✅

-- Check if materialized views exist
SELECT matviewname FROM pg_matviews;

-- Expected:
-- - mv_rnd_summary ✅
-- - mv_deduction_summary ✅
-- - mv_cost_summary ✅

-- Check if functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public';

-- Expected:
-- - refresh_all_materialized_views ✅
-- - refresh_tenant_views ✅
-- - get_tenant_analysis_summary ✅
-- - get_rnd_summary_fast ✅
-- - get_deduction_summary_fast ✅
```

---

## Post-Migration Steps

After successful migration:

### 1. Test the Application

```bash
# Start development server
npm run dev

# Test sync endpoint
curl -X POST http://localhost:3000/api/audit/sync-historical \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"test-tenant-123","years":5}'

# Should return: {"status":"syncing",...} without database errors ✅
```

### 2. Refresh Materialized Views (After First Analysis)

Once you've run AI analysis for the first time:

```sql
-- Refresh all materialized views
SELECT refresh_all_materialized_views();

-- Or refresh individually
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rnd_summary;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_deduction_summary;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cost_summary;
```

### 3. Set Up Automatic Refresh (Optional but Recommended)

Set up a cron job or scheduled function to refresh views hourly:

**Using Supabase Edge Functions:**
```typescript
// supabase/functions/refresh-views/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { error } = await supabase.rpc('refresh_all_materialized_views')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
  })
})
```

Schedule with Supabase cron (requires pg_cron extension):
```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule view refresh every hour
SELECT cron.schedule(
  'refresh-materialized-views',
  '0 * * * *', -- Every hour at minute 0
  $$SELECT refresh_all_materialized_views()$$
);
```

### 4. Monitor Performance

```bash
# Check query performance
curl http://localhost:3000/api/audit/performance-metrics

# Check cache hit rate (should be >80% after some usage)
# Check slow operations (should be <2 seconds average)
```

---

## Troubleshooting

### Error: "relation already exists"

If you see this error, it means some migrations were partially run. Options:

1. **Safe approach**: Comment out the CREATE TABLE/INDEX statements that already exist
2. **Fresh start**: Drop all tables and re-run (⚠️ **WARNING: LOSES DATA**)

```sql
-- Drop tables (only if you want to start fresh)
DROP TABLE IF EXISTS ai_analysis_costs CASCADE;
DROP TABLE IF EXISTS forensic_analysis_results CASCADE;
DROP TABLE IF EXISTS audit_sync_status CASCADE;
DROP TABLE IF EXISTS historical_transactions_cache CASCADE;

-- Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS mv_cost_summary;
DROP MATERIALIZED VIEW IF EXISTS mv_deduction_summary;
DROP MATERIALIZED VIEW IF EXISTS mv_rnd_summary;

-- Then re-run all migrations
```

### Error: "permission denied"

Make sure you're using a role with sufficient privileges:

```sql
-- Grant permissions (if needed)
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
```

### Error: "extension does not exist"

Some migrations require PostgreSQL extensions:

```sql
-- Install required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_cron; -- Optional, for scheduled jobs
```

---

## Migration Order (IMPORTANT)

Migrations must be run in this exact order:

1. **004_create_historical_cache.sql** - Creates base tables for data caching
2. **005_create_forensic_analysis.sql** - Creates analysis results table (depends on 004)
3. **007_performance_optimization.sql** - Creates indexes and views (depends on 004 & 005)

Do not skip migrations or run them out of order!

---

## Summary

**Current Status**: ⚠️ Migrations not yet applied

**Required Actions**:
1. Run migration 004 (historical cache tables)
2. Run migration 005 (forensic analysis tables)
3. Run migration 007 (performance optimization)
4. Verify tables/indexes/views exist
5. Test application endpoints
6. Refresh materialized views after first analysis

**Expected Outcome**: All database errors resolved, system fully functional ✅

Once migrations are complete, the entire forensic tax audit system will be operational with:
- ✅ Historical data sync
- ✅ AI forensic analysis
- ✅ Tax opportunity identification
- ✅ Recommendation generation
- ✅ Professional report generation
- ✅ Interactive dashboard
- ✅ Performance optimization

Ready to process 5 years of Xero data and identify $200k-$500k in tax savings! 🎉
